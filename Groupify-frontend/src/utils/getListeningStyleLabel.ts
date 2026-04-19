import type { ListenerReflexUser } from '../types';
import type { ListenerReflexRange } from '../hooks/useListenerReflex';
import {
  Archive, Zap, Clock, Target, Sparkles, Heart, Shield, Eye, Compass,
  Flame, Waves, Calendar, BookOpen, Radio, Music,
  Moon, Ghost, Hourglass, Filter, FastForward
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

interface BadgeDefinition {
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
}

interface Archetype {
  id: string;
  title: string;
  descriptions: [string, string, string];
  badge: BadgeDefinition;
  matches: (scores: UserScores) => boolean;
}

interface EngagementArchetype {
  id: string;
  title: string;
  descriptions: [string, string, string];
  badge: BadgeDefinition;
  matches: (user: ListenerReflexUser, points: Array<{ ms: number; listenedAt: string }>, groupMedianMs: number, windowDurationMs: number) => boolean;
}

/**
 * Calculate coefficient of variation for timeToListen values
 */
const calculateCV = (points: Array<{ ms: number }>): number => {
  if (points.length <= 1) return 0;
  const mean = points.reduce((sum, p) => sum + p.ms, 0) / points.length;
  if (mean === 0) return 0;
  const variance = points.reduce((sum, p) => sum + Math.pow(p.ms - mean, 2), 0) / points.length;
  return Math.sqrt(variance) / mean;
};

/**
 * Calculate clustering rate: fraction of listens that fall within cluster sessions.
 * A cluster is 3+ listens within a time window.
 */
const calculateClusteringRate = (
  points: Array<{ listenedAt: string }>,
  windowDurationMs: number
): number => {
  if (points.length < 3) return 0;

  const sorted = [...points].sort((a, b) =>
    new Date(a.listenedAt).getTime() - new Date(b.listenedAt).getTime()
  );

  // Window-aware cluster detection window
  const clusterWindow = windowDurationMs < 24 * 60 * 60 * 1000
    ? 5 * 60 * 1000   // 5 minutes for short windows
    : windowDurationMs > 7 * 24 * 60 * 60 * 1000
    ? 20 * 60 * 1000  // 20 minutes for long windows
    : 10 * 60 * 1000; // 10 minutes default

  const inCluster = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    const iTime = new Date(sorted[i].listenedAt).getTime();
    // Look ahead for cluster members
    const clusterMembers = [i];
    for (let j = i + 1; j < sorted.length; j++) {
      const jTime = new Date(sorted[j].listenedAt).getTime();
      if (jTime - iTime <= clusterWindow) {
        clusterMembers.push(j);
      } else {
        break;
      }
    }
    if (clusterMembers.length >= 3) {
      clusterMembers.forEach(idx => inCluster.add(idx));
    }
  }

  return inCluster.size / sorted.length;
};

/**
 * Detect catch-up sprinter pattern: >70% of window inactive, then burst in last 20%
 */
const isCatchUpSprinter = (
  points: Array<{ listenedAt: string }>,
  windowDurationMs: number
): boolean => {
  if (points.length < 3) return false;

  const now = Date.now();
  const burstThreshold = now - windowDurationMs * 0.2; // last 20% of window

  const inBurst = points.filter(p => new Date(p.listenedAt).getTime() >= burstThreshold).length;
  const beforeBurst = points.length - inBurst;

  // Must have 70%+ of listens in the last 20% of the window,
  // AND have very few listens in the first 80%
  return inBurst >= points.length * 0.7 && beforeBurst <= 2;
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

  const threshold = points.length * 0.4;

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
  const threshold = points.length * 0.4;

  const dominantDay = Object.entries(dayCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0];

  return {
    isWeekend: weekendCount > threshold,
    isWeekday: (points.length - weekendCount) > threshold,
    dominantDay
  };
};

/**
 * Calculate user scores based on listening patterns.
 * Uses group-relative thresholds for speed to avoid everyone landing in the same bucket.
 */
const calculateUserScores = (
  user: ListenerReflexUser,
  points: Array<{ ms: number; listenedAt: string }>,
  windowDurationMs: number,
  groupAverageListens: number,
  groupMedianMs: number,
  totalUsers: number
): UserScores => {
  const { medianMs, listens } = user;

  // Speed Category — relative to group median
  let speedCategory: SpeedCategory;

  if (medianMs === null || medianMs === undefined) {
    speedCategory = 'delayed';
  } else if (totalUsers < 3 || groupMedianMs <= 0) {
    // Fallback to wider absolute thresholds for tiny groups
    if (medianMs < 5 * 60 * 1000) speedCategory = 'instant';          // < 5 min
    else if (medianMs < 2 * 60 * 60 * 1000) speedCategory = 'fast';   // < 2 hr
    else if (medianMs < 24 * 60 * 60 * 1000) speedCategory = 'steady'; // < 24 hr
    else speedCategory = 'delayed';
  } else {
    // Group-relative thresholds
    if (medianMs < groupMedianMs * 0.25) speedCategory = 'instant';
    else if (medianMs < groupMedianMs * 0.7) speedCategory = 'fast';
    else if (medianMs <= groupMedianMs * 1.5) speedCategory = 'steady';
    else speedCategory = 'delayed';
  }

  // Habit Category — CV-based with tightened batcher detection
  const cv = calculateCV(points);
  const clusteringRate = calculateClusteringRate(points, windowDurationMs);

  let habitCategory: HabitCategory;
  if (cv < 0.3) {
    habitCategory = 'ritualist';
  } else if (clusteringRate >= 0.4) {
    // True batcher: 40%+ of listens are in cluster sessions
    habitCategory = 'batcher';
  } else if (cv > 0.8) {
    habitCategory = 'erratic';
  } else {
    // Ambiguous zone — default to erratic instead of batcher
    habitCategory = 'erratic';
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

// ─── Engagement Archetypes (motivational/negative) ─────────────────────────

const ENGAGEMENT_ARCHETYPES: EngagementArchetype[] = [
  {
    id: 'hibernating',
    title: 'Hibernating',
    descriptions: [
      'Your music feed is collecting dust. The group misses your ears.',
      'Zero plays? It\'s hibernation season. Wake up — there are bangers waiting.',
      'The songs are piling up like unread emails. Time for a listening spree?'
    ],
    badge: {
      icon: Moon,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/20',
      borderColor: 'border-indigo-500/30'
    },
    matches: (user) => user.listens === 0
  },
  {
    id: 'ghost_listener',
    title: 'Ghost Listener',
    descriptions: [
      'Your listening history is like a UFO sighting — rare and hard to confirm.',
      'The group can barely tell you\'re here. A few more plays and they\'ll believe in you.',
      'Are you even real? Your listening stats say "maybe." Time to make your presence known.'
    ],
    badge: {
      icon: Ghost,
      color: 'text-slate-400',
      bgColor: 'bg-slate-500/20',
      borderColor: 'border-slate-500/30'
    },
    matches: (user) => user.listens <= 2 && user.listenRatio < 0.15
  },
  {
    id: 'fashionably_late',
    title: 'Fashionably Late',
    descriptions: [
      'You arrive to the party after the DJ has packed up. But hey, better late than never.',
      'Songs shared on Monday? You\'ll get to them by Thursday. Your timeline runs on island time.',
      'You take "slow jam" literally. The group has moved on, but you\'re just getting started.'
    ],
    badge: {
      icon: Hourglass,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/20',
      borderColor: 'border-orange-500/30'
    },
    matches: (user, _points, groupMedianMs) =>
      user.listens >= 3 && user.medianMs !== null && groupMedianMs > 0 && user.medianMs > groupMedianMs * 3
  },
  {
    id: 'catch_up_sprinter',
    title: 'Catch-Up Sprinter',
    descriptions: [
      'You disappeared, then came back in a blaze of glory. The comeback kid of listening.',
      'After a long silence, you binged it all at once. Respect the hustle.',
      'You went dark, then speedran the playlist. The group appreciates the effort.'
    ],
    badge: {
      icon: FastForward,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/20',
      borderColor: 'border-cyan-500/30'
    },
    matches: (user, points, _groupMedianMs, windowDurationMs) =>
      user.listens >= 3 && isCatchUpSprinter(points, windowDurationMs)
  },
  {
    id: 'picky_ear',
    title: 'Picky Ear',
    descriptions: [
      'You\'re the Simon Cowell of the group — only the best get through your audition.',
      'Most songs don\'t make your cut. The ones that do get your full attention.',
      'You listen to what you want, when you want. Selective? Sure. Picky? Absolutely.'
    ],
    badge: {
      icon: Filter,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/20',
      borderColor: 'border-amber-500/30'
    },
    matches: (user, _points, groupMedianMs) =>
      user.listens >= 3 &&
      user.listenRatio < 0.3 &&
      (user.medianMs === null || groupMedianMs <= 0 || user.medianMs <= groupMedianMs * 1.5)
  }
];

// ─── Standard Archetypes ────────────────────────────────────────────────────

const ARCHETYPES: Archetype[] = [
  // Volume-based archetypes FIRST (so they're checked before speed+habit combos)
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
  },
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
  },
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
  },

  // Speed + Habit archetypes
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
  },
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
  }
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
 * Get listening style label based on user's listening patterns.
 * Uses group-relative thresholds and checks engagement archetypes first.
 */
export const getListeningStyleLabel = (
  user: ListenerReflexUser,
  ringData: { points: Array<{ ms: number; listenedAt: string }> },
  range: ListenerReflexRange,
  groupAverageListens?: number,
  groupMedianMs?: number,
  totalUsers?: number
): ListeningStyleLabel => {
  const { points } = ringData;

  const rangeMsMap: Record<ListenerReflexRange, number> = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
    'all': 90 * 24 * 60 * 60 * 1000
  };
  const windowDurationMs = rangeMsMap[range] ?? 30 * 24 * 60 * 60 * 1000;
  const gMedian = groupMedianMs ?? 0;

  // Check engagement archetypes first (motivational badges for low engagement)
  const engagementMatch = ENGAGEMENT_ARCHETYPES.find(a =>
    a.matches(user, points, gMedian, windowDurationMs)
  );

  if (engagementMatch) {
    const variationIndex = user.userId.charCodeAt(0) % 3;
    return {
      title: engagementMatch.title,
      description: engagementMatch.descriptions[variationIndex],
      badge: engagementMatch.badge
    };
  }

  // Calculate user scores for standard archetypes
  const groupAvg = groupAverageListens || user.listens;
  const scores = calculateUserScores(user, points, windowDurationMs, groupAvg, gMedian, totalUsers ?? 0);

  // Find matching standard archetype
  const matchingArchetype = ARCHETYPES.find(archetype => archetype.matches(scores));

  if (matchingArchetype) {
    const title = getContextualTitle(matchingArchetype, scores, points, windowDurationMs);
    const variationIndex = user.userId.charCodeAt(0) % 3;
    const description = matchingArchetype.descriptions[variationIndex];

    return { title, description, badge: matchingArchetype.badge };
  }

  // Default fallback
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
