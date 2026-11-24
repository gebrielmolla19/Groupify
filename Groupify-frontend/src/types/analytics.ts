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



/** Periods the "You" section of Group Dynamics covers. */
export type ViewerSummaryRange = '7d' | '30d' | 'all';

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
