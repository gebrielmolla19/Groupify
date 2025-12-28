import type { ListenerReflexUser } from '../types';
import type { ListenerReflexRange } from '../hooks/useListenerReflex';
import {
  Archive, Zap, Clock, Target, Sparkles, Heart, Shield, Eye, Compass,
  Flame, Waves, Calendar, BookOpen, Radio, Music
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface ListeningStyleLabel {
  title: string;
  description: string;
  badge: {
    icon: LucideIcon;
    color: string;
    bgColor: string;
    borderColor: string;
  };
}

type SpeedCategory = 'instant' | 'fast' | 'steady' | 'delayed';
type HabitCategory = 'ritualist' | 'batcher' | 'erratic';
type VolumeCategory = 'high_freq' | 'casual' | 'selective';

interface UserScores {
  speedCategory: SpeedCategory;
  habitCategory: HabitCategory;
  volumeCategory: VolumeCategory;
}

interface Archetype {
  id: string;
  title: string;
  descriptions: [string, string, string]; // 3 variations
  badge: {
    icon: LucideIcon;
    color: string;
    bgColor: string;
    borderColor: string;
  };
  matches: (scores: UserScores) => boolean;
}

/**
 * Calculate standard deviation of timeToListen values
 */
const calculateStandardDeviation = (points: Array<{ ms: number }>): number => {
  if (points.length === 0 || points.length === 1) return 0;
  
  const mean = points.reduce((sum, p) => sum + p.ms, 0) / points.length;
  const variance = points.reduce((sum, p) => sum + Math.pow(p.ms - mean, 2), 0) / points.length;
  return Math.sqrt(variance);
};

/**
 * Calculate dynamic arc span in degrees based on variance
 * Window-aware: adjusts thresholds based on window duration
 */
const calculateDynamicArcSpanDegrees = (
  points: Array<{ ms: number }>,
  windowDurationMs: number
): number => {
  if (points.length === 0) return 0;
  if (points.length === 1) return 20;
  
  const stdDev = calculateStandardDeviation(points);
  const mean = points.reduce((sum, p) => sum + p.ms, 0) / points.length;
  const coefficientOfVariation = mean > 0 ? stdDev / mean : 1;
  
  // Window-aware normalization: shorter windows = stricter, longer = more lenient
  const normalizationFactor = windowDurationMs < 48 * 60 * 60 * 1000 // < 48 hours
    ? 1.5  // Stricter for short windows
    : windowDurationMs > 7 * 24 * 60 * 60 * 1000 // > 7 days
    ? 0.7  // More lenient for long windows
    : 1.0; // Default
  
  const normalizedVariance = Math.min((coefficientOfVariation / 2) * normalizationFactor, 1);
  
  const MIN_ARC_DEGREES = 20;
  const MAX_ARC_DEGREES = 330;
  const arcSpan = MIN_ARC_DEGREES + normalizedVariance * (MAX_ARC_DEGREES - MIN_ARC_DEGREES);
  
  return arcSpan;
};

/**
 * Check if listens are clustered in time
 * Window-aware: adjusts cluster window based on overall window duration
 */
const hasClusteredListens = (
  points: Array<{ listenedAt: string }>,
  windowDurationMs: number
): boolean => {
  if (points.length < 3) return false;
  
  const sorted = [...points].sort((a, b) => 
    new Date(a.listenedAt).getTime() - new Date(b.listenedAt).getTime()
  );
  
  // Window-aware cluster detection: shorter windows = smaller cluster window
  const baseClusterWindow = 10 * 60 * 1000; // 10 minutes base
  const clusterWindow = windowDurationMs < 24 * 60 * 60 * 1000 // < 24 hours
    ? baseClusterWindow * 0.5  // 5 minutes for short windows
    : windowDurationMs > 7 * 24 * 60 * 60 * 1000 // > 7 days
    ? baseClusterWindow * 2     // 20 minutes for long windows
    : baseClusterWindow;
  
  for (let i = 0; i < sorted.length - 2; i++) {
    const firstTime = new Date(sorted[i].listenedAt).getTime();
    const thirdTime = new Date(sorted[i + 2].listenedAt).getTime();
    
    if (thirdTime - firstTime <= clusterWindow) {
      return true;
    }
  }
  
  return false;
};

/**
 * Get time of day pattern from listens
 */
const getTimeOfDayPattern = (points: Array<{ listenedAt: string }>): {
  isNightTime: boolean;
  isAfternoon: boolean;
  isMorning: boolean;
} => {
  if (points.length === 0) {
    return { isNightTime: false, isAfternoon: false, isMorning: false };
  }
  
  const hours = points.map(p => new Date(p.listenedAt).getHours());
  const nightCount = hours.filter(h => h >= 22 || h <= 6).length;
  const afternoonCount = hours.filter(h => h >= 12 && h < 18).length;
  const morningCount = hours.filter(h => h >= 6 && h < 12).length;
  
  const threshold = points.length * 0.4; // 40% threshold
  
  return {
    isNightTime: nightCount > threshold,
    isAfternoon: afternoonCount > threshold,
    isMorning: morningCount > threshold
  };
};

/**
 * Get day of week pattern (for weekly windows)
 */
const getDayOfWeekPattern = (points: Array<{ listenedAt: string }>): {
  isWeekend: boolean;
  isWeekday: boolean;
  dominantDay?: string;
} => {
  if (points.length === 0) {
    return { isWeekend: false, isWeekday: false };
  }
  
  const dayCounts: Record<string, number> = {};
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  points.forEach(p => {
    const day = dayNames[new Date(p.listenedAt).getDay()];
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  });
  
  const weekendCount = (dayCounts['Saturday'] || 0) + (dayCounts['Sunday'] || 0);
  const weekdayCount = points.length - weekendCount;
  const threshold = points.length * 0.4;
  
  const dominantDay = Object.entries(dayCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0];
  
  return {
    isWeekend: weekendCount > threshold,
    isWeekday: weekdayCount > threshold,
    dominantDay
  };
};

/**
 * Calculate user scores based on listening patterns
 * Window-aware: adjusts thresholds dynamically
 */
const calculateUserScores = (
  user: ListenerReflexUser,
  points: Array<{ ms: number; listenedAt: string }>,
  windowDurationMs: number,
  groupAverageListens: number
): UserScores => {
  const { medianMs, listens } = user;
  
  // Speed Category (window-aware thresholds)
  let speedCategory: SpeedCategory;
  if (medianMs < 60 * 1000) { // < 1 minute
    speedCategory = 'instant';
  } else if (medianMs < 60 * 60 * 1000) { // < 1 hour
    speedCategory = 'fast';
  } else if (medianMs < 12 * 60 * 60 * 1000) { // < 12 hours
    speedCategory = 'steady';
  } else {
    speedCategory = 'delayed';
  }
  
  // Habit Category (window-aware)
  const dynamicArcSpan = calculateDynamicArcSpanDegrees(points, windowDurationMs);
  const hasClustered = hasClusteredListens(points, windowDurationMs);
  
  // Window-aware consistency threshold
  const consistencyThreshold = windowDurationMs < 48 * 60 * 60 * 1000 // < 48 hours
    ? 25  // Stricter for short windows
    : windowDurationMs > 7 * 24 * 60 * 60 * 1000 // > 7 days
    ? 50  // More lenient for long windows
    : 30; // Default
  
  const erraticThreshold = windowDurationMs < 48 * 60 * 60 * 1000
    ? 120  // Stricter for short windows
    : windowDurationMs > 7 * 24 * 60 * 60 * 1000
    ? 200  // More lenient for long windows
    : 150; // Default
  
  let habitCategory: HabitCategory;
  if (dynamicArcSpan < consistencyThreshold) {
    habitCategory = 'ritualist';
  } else if (hasClustered) {
    habitCategory = 'batcher';
  } else if (dynamicArcSpan > erraticThreshold) {
    habitCategory = 'erratic';
  } else {
    // Default based on clustering
    habitCategory = hasClustered ? 'batcher' : 'erratic';
  }
  
  // Volume Category
  const relativeEngagement = groupAverageListens > 0 ? listens / groupAverageListens : 1;
  let volumeCategory: VolumeCategory;
  if (relativeEngagement > 1.2) {
    volumeCategory = 'high_freq';
  } else if (relativeEngagement < 0.5) {
    volumeCategory = 'selective';
  } else {
    volumeCategory = 'casual';
  }
  
  return { speedCategory, habitCategory, volumeCategory };
};

/**
 * Archetype definitions with 3 description variations each
 */
const ARCHETYPES: Archetype[] = [
  // Instant + Batcher = Lightning Collector
  {
    id: 'lightning_collector',
    title: 'The Lightning Collector',
    descriptions: [
      'You let the songs stack up like lightning in a bottle, then crack them all open in one electric moment.',
      'The music waits for you, and when you\'re ready, you devour it all at once—fast, focused, unstoppable.',
      'You save up the beats like energy, then release them all in one brilliant flash of listening.'
    ],
    badge: {
      icon: Zap,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      borderColor: 'border-yellow-500/30'
    },
    matches: (s) => s.speedCategory === 'instant' && s.habitCategory === 'batcher'
  },
  
  // Instant + Ritualist = First Responder
  {
    id: 'first_responder',
    title: 'First Responder',
    descriptions: [
      'The moment a song drops, you\'re already there—listening, feeling, reacting before anyone else.',
      'You move at the speed of sound, always first to catch what the group shares, always ready.',
      'When music calls, you answer instantly. The group knows you\'re always listening, always present.'
    ],
    badge: {
      icon: Flame,
      color: 'text-primary',
      bgColor: 'bg-primary/20',
      borderColor: 'border-primary/30'
    },
    matches: (s) => s.speedCategory === 'instant' && s.habitCategory === 'ritualist'
  },
  
  // Instant + Erratic = The Spark
  {
    id: 'the_spark',
    title: 'The Spark',
    descriptions: [
      'You react instantly, but unpredictably—a spark that ignites at random moments, lighting up the feed.',
      'When you listen, you listen fast, but your timing is your own. Unpredictable, electric, always surprising.',
      'You\'re lightning-fast when you catch something, but you move to your own rhythm—spontaneous and free.'
    ],
    badge: {
      icon: Sparkles,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      borderColor: 'border-purple-500/30'
    },
    matches: (s) => s.speedCategory === 'instant' && s.habitCategory === 'erratic'
  },
  
  // Fast + Batcher = The Collector
  {
    id: 'collector',
    title: 'The Collector',
    descriptions: [
      'You save up the music like treasures, then dive into them all in one beautiful binge session.',
      'The songs pile up, waiting for you, and when you\'re ready, you consume them all at once.',
      'You let the music accumulate like a collection, then enjoy it all together in one perfect moment.'
    ],
    badge: {
      icon: Archive,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/20',
      borderColor: 'border-amber-500/30'
    },
    matches: (s) => s.speedCategory === 'fast' && s.habitCategory === 'batcher'
  },
  
  // Fast + Ritualist = The Ritualist
  {
    id: 'ritualist',
    title: 'The Ritualist',
    descriptions: [
      'You\'ve found your rhythm and you stick to it—reliable, steady, always there when the music calls.',
      'Your listening is a ritual, predictable and comforting. The group knows they can count on your timing.',
      'You move at a steady pace, always consistent, always there. Your rhythm is your signature.'
    ],
    badge: {
      icon: Clock,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      borderColor: 'border-blue-500/30'
    },
    matches: (s) => s.speedCategory === 'fast' && s.habitCategory === 'ritualist'
  },
  
  // Fast + Erratic = The Wanderer
  {
    id: 'wanderer',
    title: 'The Wanderer',
    descriptions: [
      'You listen when the mood strikes, following your own unpredictable rhythm through the group\'s music.',
      'You move fast when you move, but your timing is your own—wandering through songs at your pace.',
      'You\'re quick to listen, but you follow your own path. Unpredictable, free, always on your own schedule.'
    ],
    badge: {
      icon: Eye,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/20',
      borderColor: 'border-indigo-500/30'
    },
    matches: (s) => s.speedCategory === 'fast' && s.habitCategory === 'erratic'
  },
  
  // Steady + Batcher = The Archivist
  {
    id: 'archivist',
    title: 'The Archivist',
    descriptions: [
      'You let the songs pile up during the day just to enjoy them all at once when the world stays quiet.',
      'You save the music for later, archiving it until the perfect moment to listen to everything together.',
      'The songs wait for you, and when you\'re ready, you open the archive and listen to it all at once.'
    ],
    badge: {
      icon: BookOpen,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      borderColor: 'border-purple-500/30'
    },
    matches: (s) => s.speedCategory === 'steady' && s.habitCategory === 'batcher'
  },
  
  // Steady + Ritualist = The Clockwork Listener
  {
    id: 'clockwork_listener',
    title: 'The Clockwork Listener',
    descriptions: [
      'You move like clockwork—steady, predictable, always on schedule. The group knows exactly when you\'ll listen.',
      'Your timing is mechanical, precise, reliable. You listen at your own pace, but you never miss a beat.',
      'You\'ve built a rhythm that works, and you stick to it. Steady, dependable, always there when expected.'
    ],
    badge: {
      icon: Radio,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/20',
      borderColor: 'border-cyan-500/30'
    },
    matches: (s) => s.speedCategory === 'steady' && s.habitCategory === 'ritualist'
  },
  
  // Steady + Erratic = The Patient Listener
  {
    id: 'patient_listener',
    title: 'The Patient Listener',
    descriptions: [
      'You take your time, but you always come back. There\'s something beautiful about your steady approach.',
      'You move slowly, unpredictably, but you never give up. The music waits, and you always return.',
      'You listen at your own pace, following your own rhythm. Patient, unpredictable, always coming back.'
    ],
    badge: {
      icon: Compass,
      color: 'text-teal-400',
      bgColor: 'bg-teal-500/20',
      borderColor: 'border-teal-500/30'
    },
    matches: (s) => s.speedCategory === 'steady' && s.habitCategory === 'erratic'
  },
  
  // Delayed + Batcher = The Weekend Warrior
  {
    id: 'weekend_warrior',
    title: 'The Weekend Warrior',
    descriptions: [
      'You let the week\'s music build up, then dive into it all when you finally have time to really listen.',
      'The songs accumulate like weekend plans, and when you\'re ready, you enjoy them all at once.',
      'You save the music for when you can truly appreciate it—batching it all for the perfect listening moment.'
    ],
    badge: {
      icon: Calendar,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20',
      borderColor: 'border-orange-500/30'
    },
    matches: (s) => s.speedCategory === 'delayed' && s.habitCategory === 'batcher'
  },
  
  // Delayed + Ritualist = The Dependable
  {
    id: 'dependable',
    title: 'The Dependable',
    descriptions: [
      'You move at your own pace, but you never miss a beat. The group knows they can count on you.',
      'You take your time, but you\'re always consistent. Reliable, steady, always coming back.',
      'You listen slowly, but predictably. The group knows you\'ll always get there, always in your own time.'
    ],
    badge: {
      icon: Shield,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      borderColor: 'border-green-500/30'
    },
    matches: (s) => s.speedCategory === 'delayed' && s.habitCategory === 'ritualist'
  } as Archetype,
  
  // Delayed + Erratic = The Wanderer (Slow)
  {
    id: 'slow_wanderer',
    title: 'The Slow Wanderer',
    descriptions: [
      'You listen when you listen, following your own unpredictable rhythm through the group\'s music.',
      'You take your time, and your timing is your own. Unpredictable, patient, always on your own schedule.',
      'You move slowly, unpredictably, but you always find your way back to the music eventually.'
    ],
    badge: {
      icon: Waves,
      color: 'text-slate-400',
      bgColor: 'bg-slate-500/20',
      borderColor: 'border-slate-500/30'
    },
    matches: (s) => s.speedCategory === 'delayed' && s.habitCategory === 'erratic'
  } as Archetype,
  
  // High Frequency + Instant = The Group's Pulse
  {
    id: 'group_pulse',
    title: 'The Group\'s Pulse',
    descriptions: [
      'You\'re always there, always listening, always feeling the beat of what the group shares in real-time.',
      'You listen to everything, instantly. The group\'s most engaged member, always present, always reacting.',
      'You\'re the heartbeat of the group—fast, frequent, always there when the music drops.'
    ],
    badge: {
      icon: Heart,
      color: 'text-primary',
      bgColor: 'bg-primary/20',
      borderColor: 'border-primary/30'
    },
    matches: (s) => s.volumeCategory === 'high_freq' && s.speedCategory === 'instant'
  } as Archetype,
  
  // Selective + Fast = The Sniper
  {
    id: 'sniper',
    title: 'The Sniper',
    descriptions: [
      'You don\'t listen to everything, but when you do, you\'re lightning fast. Quality over quantity, always.',
      'You pick your moments carefully, then strike instantly. Selective, precise, always on target.',
      'You wait for the right song, then listen immediately. Quality over quantity, always.'
    ],
    badge: {
      icon: Target,
      color: 'text-red-400',
      bgColor: 'bg-red-500/20',
      borderColor: 'border-red-500/30'
    },
    matches: (s) => s.volumeCategory === 'selective' && s.speedCategory === 'fast'
  } as Archetype,
  
  // High Frequency + Steady = The Enthusiast
  {
    id: 'enthusiast',
    title: 'The Enthusiast',
    descriptions: [
      'You listen to everything, steadily. The group\'s most engaged member, always there, always listening.',
      'You\'re quick to listen and you listen to everything. The group knows you\'re always engaged.',
      'You listen to it all, at a steady pace. The group\'s most enthusiastic member, always present.'
    ],
    badge: {
      icon: Music,
      color: 'text-pink-400',
      bgColor: 'bg-pink-500/20',
      borderColor: 'border-pink-500/30'
    },
    matches: (s) => s.volumeCategory === 'high_freq' && s.speedCategory === 'steady'
  } as Archetype,
];

/**
 * Get window-aware contextual title based on time patterns
 */
const getContextualTitle = (
  archetype: Archetype,
  scores: UserScores,
  points: Array<{ listenedAt: string }>,
  windowDurationMs: number
): string => {
  // For windows > 5 days: use habit-based labels
  if (windowDurationMs > 5 * 24 * 60 * 60 * 1000) {
    const dayPattern = getDayOfWeekPattern(points);
    
    if (dayPattern.isWeekend && archetype.id === 'archivist') {
      return 'The Sunday Regular';
    }
    if (dayPattern.isWeekend && archetype.id === 'weekend_warrior') {
      return 'The Weekend Archivist';
    }
    if (dayPattern.dominantDay && scores.habitCategory === 'ritualist') {
      return `The ${dayPattern.dominantDay} Regular`;
    }
  }
  
  // For windows < 24 hours: use session-based labels
  if (windowDurationMs < 24 * 60 * 60 * 1000) {
    const timePattern = getTimeOfDayPattern(points);
    
    if (timePattern.isNightTime && scores.habitCategory === 'batcher') {
      return 'The Midnight Archivist';
    }
    if (timePattern.isAfternoon && scores.speedCategory === 'instant') {
      return 'The Afternoon Spark';
    }
    if (timePattern.isNightTime && scores.speedCategory === 'fast') {
      return 'The Night Owl';
    }
    if (timePattern.isMorning && scores.habitCategory === 'ritualist') {
      return 'The Morning Ritual';
    }
  }
  
  return archetype.title;
};

/**
 * Get listening style label based on user's listening patterns
 * Window-aware: adjusts thresholds and labels based on window duration
 */
export const getListeningStyleLabel = (
  user: ListenerReflexUser,
  ringData: { points: Array<{ ms: number; listenedAt: string }> },
  range: ListenerReflexRange,
  groupAverageListens?: number
): ListeningStyleLabel => {
  const { points } = ringData;
  
  // Calculate window duration from range
  const rangeMsMap: Record<ListenerReflexRange, number> = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    '90d': 90 * 24 * 60 * 60 * 1000
  };
  const windowDurationMs = rangeMsMap[range];
  
  // Calculate group average
  const groupAvg = groupAverageListens || user.listens;
  
  // Calculate user scores
  const scores = calculateUserScores(user, points, windowDurationMs, groupAvg);
  
  // Find matching archetype
  const matchingArchetype = ARCHETYPES.find(archetype => archetype.matches(scores));
  
  if (matchingArchetype) {
    // Get contextual title (window-aware)
    const title = getContextualTitle(matchingArchetype, scores, points, windowDurationMs);
    
    // Select random description variation (deterministic based on user ID)
    const variationIndex = user.userId.charCodeAt(0) % 3;
    const description = matchingArchetype.descriptions[variationIndex];
    
    return {
      title,
      description,
      badge: matchingArchetype.badge
    };
  }
  
  // Default: Balanced listener
  return {
    title: 'The Balanced Listener',
    description: 'You move through the group\'s music at your own pace, finding your way through each shared song.',
    badge: {
      icon: Heart,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/20',
      borderColor: 'border-border'
    }
  };
};
