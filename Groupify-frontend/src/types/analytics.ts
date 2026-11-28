// Analytics type definitions

export interface AiInsightsResponse {
  type: string;
  generated: boolean;
  cachedAt?: string;
  insights: Record<string, string> | null;
}

export interface TasteGravityNode {
  id: string;              // User ID
  name: string;            // displayName
  img: string | null;      // profileImage
  mass: number;            // Calculated mass (0-1 range)
  topArtists: string[];    // Top 3-5 artists by listen count

  // D3 Simulation properties
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface TasteGravityLink {
  source: string;          // User ID
  target: string;          // User ID
  gravity: number;         // 0-1 gravity score
  reasons: string[];       // Human-readable reasons (e.g., "Shared Artists: Radiohead, Kaytranada")
}

export interface TasteGravityResponse {
  nodes: TasteGravityNode[];
  links: TasteGravityLink[];
  insights: string[];      // e.g., "The strongest pull is between X and Y due to shared love for [Artist]"
}



/** The periods Group Dynamics offers in its one range control, shared by every section. */
export const ANALYTICS_RANGES = ['7d', '30d', 'all'] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

/** Periods the "You" section of Group Dynamics covers. */
export type ViewerSummaryRange = AnalyticsRange;

export type ViewerRoleId =
  | 'tastemaker'
  | 'crowd_pleaser'
  | 'patient_zero'
  | 'regular'
  | 'front_row'
  | 'sharer'
  | 'listener'
  | 'quiet';

/** GET /analytics/:groupId/you: numbers about the signed-in member. */
export interface ViewerSummary {
  range: ViewerSummaryRange;
  role: { id: ViewerRoleId; title: string; reason: string };
  /** The role over the period of the same length before this one; null for all time. */
  previousRole: { id: ViewerRoleId; title: string } | null;
  /** Shares every other member played; null when the viewer is the only member. */
  hitRate: { hits: number; total: number } | null;
  /** Consecutive days with a share: longest in the period, and ever. */
  streak: { longest: number; record: number };
  /** The viewer's share with the most listens and likes from others; null if none landed. */
  bestShare: {
    shareId: string;
    trackName: string;
    artistName: string;
    listens: number;
    likes: number;
    others: number;
  } | null;
  /** Artists the viewer shared first in the group, and how many others shared later. */
  discovery: { artists: number; resharedByOthers: number };
  /** Median time to listen, in ms; null without data. */
  reflex: {
    youPlayMs: number | null;
    groupPlayMs: number | null;
    yoursPlayedMs: number | null;
    groupYoursPlayedMs: number | null;
  };
}

/** One share in "The songs" cards of Group Dynamics. */
export interface SongsSummaryShare {
  shareId: string;
  spotifyTrackId: string;
  trackName: string;
  artistName: string;
  trackImage: string | null;
  sharedBy: { id: string; displayName: string | null };
  sharedAt: string;
}

/**
 * GET /analytics/:groupId/songs: shares the signed-in member is sleeping on,
 * their shares the group slept on, and group records, for one period.
 * Lists hold at most five shares; `total` counts them all.
 */
export interface SongsSummary {
  range: ViewerSummaryRange;
  /** Other members' shares the viewer has no listen on, newest first. */
  sleepingOn: { shares: SongsSummaryShare[]; total: number };
  /** The viewer's shares, a day old or more, no other member listened to; oldest first. */
  sleptOn: { shares: SongsSummaryShare[]; total: number; others: number };
  records: {
    /** Shortest time from a share to the last other member's listen. */
    fastestFullListen: (SongsSummaryShare & { ms: number }) | null;
    /** Most likes from other members. */
    mostLiked: (SongsSummaryShare & { likes: number; others: number }) | null;
    /** Most consecutive days with at least one share. */
    longestStreak: { days: number } | null;
  };
}
