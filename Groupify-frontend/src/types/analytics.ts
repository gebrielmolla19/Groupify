// Analytics type definitions

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


