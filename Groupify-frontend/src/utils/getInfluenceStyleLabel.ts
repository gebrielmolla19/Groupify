import type { ListenerReflexUser } from '../types';
import type { ListenerReflexRange } from '../hooks/useListenerReflex';
import {
  Megaphone, Magnet, Zap, Compass, Radio
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface InfluenceStyleLabel {
  title: string;
  description: string;
  badge: {
    icon: LucideIcon;
    color: string;
    bgColor: string;
    borderColor: string;
  };
}

type GravityLevel = 'high' | 'medium' | 'low';
type UrgencyLevel = 'high' | 'medium' | 'low';
type MagnetismLevel = 'high' | 'medium' | 'low';
type VolumeLevel = 'high' | 'medium' | 'low';

interface InfluenceScores {
  gravityLevel: GravityLevel;
  urgencyLevel: UrgencyLevel;
  magnetismLevel: MagnetismLevel;
  volumeLevel: VolumeLevel;
  hasConsensus: boolean; // True if 50%+ react within first 10% of arc
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
  matches: (scores: InfluenceScores) => boolean;
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
 * Calculate coefficient of variation (CV) for urgency score
 * Low CV = high urgency (consistent reactions)
 * High CV = low urgency (variable reactions)
 */
const calculateCoefficientOfVariation = (points: Array<{ ms: number }>): number => {
  if (points.length === 0 || points.length === 1) return 0;
  
  const mean = points.reduce((sum, p) => sum + p.ms, 0) / points.length;
  if (mean === 0) return 1; // Avoid division by zero
  
  const stdDev = calculateStandardDeviation(points);
  return stdDev / mean;
};

/**
 * Calculate trimmed median: ignore the slowest 20% of responses
 * This prevents outliers (like "Ghost" listeners) from skewing the influence label
 */
const calculateTrimmedMedian = (points: Array<{ ms: number }>): number => {
  if (points.length === 0) return 0;
  if (points.length === 1) return points[0].ms;
  
  // Sort by timeToListen (ascending: fastest to slowest)
  const sorted = [...points].sort((a, b) => a.ms - b.ms);
  
  // Remove the slowest 20%
  const trimCount = Math.floor(sorted.length * 0.2);
  const trimmed = sorted.slice(0, sorted.length - trimCount);
  
  if (trimmed.length === 0) {
    // Fallback to regular median if trimming removes everything
    return calculateMedian(sorted.map(p => p.ms));
  }
  
  // Calculate median of trimmed data
  return calculateMedian(trimmed.map(p => p.ms));
};

/**
 * Calculate median of an array of numbers
 */
const calculateMedian = (values: number[]): number => {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    // Even number of values: average the two middle values
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    // Odd number of values: return the middle value
    return sorted[mid];
  }
};

/**
 * Check if 50% or more of reactions occur within the first 10% of the arc (fastest reactions)
 * This indicates strong consensus for instant reactions, regardless of outliers
 */
const hasConsensusWeighting = (points: Array<{ ms: number }>): boolean => {
  if (points.length === 0) return false;
  if (points.length === 1) return true; // Single reaction is considered consensus
  
  // Sort by timeToListen (ascending: fastest to slowest)
  const sorted = [...points].sort((a, b) => a.ms - b.ms);
  
  // Find the range (min to max)
  const minMs = sorted[0].ms;
  const maxMs = sorted[sorted.length - 1].ms;
  const range = maxMs - minMs;
  
  if (range === 0) return true; // All reactions are identical
  
  // Define "first 10% of arc" as reactions within 10% of the range from the minimum
  const threshold = minMs + (range * 0.1);
  
  // Count reactions within the first 10% of the arc
  const fastReactions = sorted.filter(p => p.ms <= threshold).length;
  const consensusPercentage = (fastReactions / sorted.length) * 100;
  
  // Return true if 50% or more react within the first 10%
  return consensusPercentage >= 50;
};

/**
 * Calculate influence scores based on group's reaction to user's shares
 * Uses outlier-resistant methods: trimmed median and consensus weighting
 */
const calculateInfluenceScores = (
  user: ListenerReflexUser,
  points: Array<{ ms: number }>,
  totalGroupMembers: number
): InfluenceScores => {
  const { listens } = user;
  
  // Calculate trimmed median (ignores slowest 20% to prevent outlier skewing)
  const trimmedMedianMs = calculateTrimmedMedian(points);
  
  // Check for consensus weighting: 50%+ react within first 10% of arc
  const hasConsensus = hasConsensusWeighting(points);
  
  // Gravity Score: Based on trimmed median timeToListen (lower = higher gravity)
  // High gravity: trimmed median < 1 hour (people react quickly)
  // Medium: 1 hour ≤ trimmed median < 12 hours
  // Low: trimmed median ≥ 12 hours (people take their time)
  // BUT: If consensus weighting applies, force to 'high' (majority react instantly)
  let gravityLevel: GravityLevel;
  if (hasConsensus) {
    // Consensus weighting: majority react quickly, so treat as high gravity
    gravityLevel = 'high';
  } else if (trimmedMedianMs < 60 * 60 * 1000) { // < 1 hour
    gravityLevel = 'high';
  } else if (trimmedMedianMs < 12 * 60 * 60 * 1000) { // < 12 hours
    gravityLevel = 'medium';
  } else {
    gravityLevel = 'low';
  }
  
  // Urgency Score: Based on variance (low variance = high urgency/ritual)
  // Calculate coefficient of variation (CV)
  const cv = calculateCoefficientOfVariation(points);
  let urgencyLevel: UrgencyLevel;
  if (cv < 0.5) { // Very consistent
    urgencyLevel = 'high';
  } else if (cv < 1.5) { // Moderately consistent
    urgencyLevel = 'medium';
  } else { // High variance
    urgencyLevel = 'low';
  }
  
  // Magnetism Score: Based on percentage of group that reacts
  // Note: This is an approximation using total listens as a proxy for unique listeners
  // A more accurate calculation would require unique listener tracking from the backend
  // For now, we normalize: if listens >= groupMembers, assume 100% engagement
  // Otherwise, use listens/groupMembers as a proxy for engagement percentage
  const magnetismPercentage = totalGroupMembers > 0 
    ? Math.min((listens / totalGroupMembers) * 100, 100)
    : 0;
  
  let magnetismLevel: MagnetismLevel;
  if (magnetismPercentage > 70) {
    magnetismLevel = 'high';
  } else if (magnetismPercentage >= 40) {
    magnetismLevel = 'medium';
  } else {
    magnetismLevel = 'low';
  }
  
  // Volume Level: Based on number of listens (relative to group size)
  // High: > 50% of group has listened (or high absolute listens)
  // Medium: 20-50% of group
  // Low: < 20% of group
  const volumePercentage = totalGroupMembers > 0 
    ? Math.min((listens / totalGroupMembers) * 100, 100)
    : 0;
  
  let volumeLevel: VolumeLevel;
  if (volumePercentage > 50) {
    volumeLevel = 'high';
  } else if (volumePercentage >= 20) {
    volumeLevel = 'medium';
  } else {
    volumeLevel = 'low';
  }
  
  return {
    gravityLevel,
    urgencyLevel,
    magnetismLevel,
    volumeLevel,
    hasConsensus
  };
};

/**
 * Define archetypes for influence styles
 */
const ARCHETYPES: Archetype[] = [
  {
    id: 'main_stage',
    title: 'The Main Stage',
    descriptions: [
      'The group treats your shares like a scheduled ritual—everyone drops everything to listen immediately.',
      'Your music commands instant attention. The group has learned to clear their schedule when you share.',
      'When you post, the group stops scrolling. Your shares have become appointment listening for everyone.'
    ],
    badge: {
      icon: Megaphone,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      borderColor: 'border-yellow-500/30'
    },
    matches: (scores) => 
      // "The Main Stage": High gravity + High urgency, OR consensus weighting (50%+ react instantly)
      (scores.gravityLevel === 'high' && scores.urgencyLevel === 'high') ||
      (scores.hasConsensus && scores.urgencyLevel === 'high')
  },
  {
    id: 'slow_burn',
    title: 'The Slow Burn',
    descriptions: [
      'The group respects your curation deeply—they savor your shares later, knowing they\'re worth the wait.',
      'Others see you as a trusted curator. Your music doesn\'t demand immediate attention, but it always gets it eventually.',
      'The group treats your shares like fine wine—they appreciate them more when they take their time.'
    ],
    badge: {
      icon: Magnet,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      borderColor: 'border-purple-500/30'
    },
    matches: (scores) => 
      scores.gravityLevel === 'low' && scores.magnetismLevel === 'high'
  },
  {
    id: 'flash_point',
    title: 'The Flash Point',
    descriptions: [
      'You share rarely, but when you do, the group reacts instantly. Your music has explosive impact.',
      'Quality over quantity—the group knows your shares are special and reacts immediately when they appear.',
      'Your shares are like lightning strikes: rare, powerful, and impossible to ignore when they happen.'
    ],
    badge: {
      icon: Zap,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/20',
      borderColor: 'border-amber-500/30'
    },
    matches: (scores) => 
      scores.gravityLevel === 'high' && scores.volumeLevel === 'low'
  },
  {
    id: 'discovery_zone',
    title: 'The Discovery Zone',
    descriptions: [
      'Your diverse taste means different people react at different times. The group finds something new in your shares whenever they check.',
      'The group sees you as a musical explorer. Your variety keeps everyone engaged, but reactions spread out over time.',
      'Your shares create waves across the group—some people dive in immediately, others discover them days later.'
    ],
    badge: {
      icon: Compass,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/20',
      borderColor: 'border-cyan-500/30'
    },
    matches: (scores) => 
      scores.urgencyLevel === 'low' && scores.volumeLevel === 'high'
  }
];

/**
 * Get influence style label based on how the group reacts to user's shares
 */
export const getInfluenceStyleLabel = (
  user: ListenerReflexUser,
  ringData: { points: Array<{ ms: number; listenedAt: string }> },
  range: ListenerReflexRange,
  totalGroupMembers: number
): InfluenceStyleLabel => {
  const { points } = ringData;
  
  // Calculate influence scores
  const scores = calculateInfluenceScores(user, points, totalGroupMembers);
  
  // Find matching archetype
  const matchingArchetype = ARCHETYPES.find(archetype => archetype.matches(scores));
  
  if (matchingArchetype) {
    // Select random description variation (deterministic based on user ID)
    const variationIndex = user.userId.charCodeAt(0) % 3;
    const description = matchingArchetype.descriptions[variationIndex];
    
    return {
      title: matchingArchetype.title,
      description,
      badge: matchingArchetype.badge
    };
  }
  
  // Default: Balanced influencer
  return {
    title: 'The Balanced Influencer',
    description: 'The group engages with your shares at a steady pace, finding value in your music over time.',
    badge: {
      icon: Radio,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/20',
      borderColor: 'border-border'
    }
  };
};

