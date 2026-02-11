// Shared types for the application

export interface User {
  _id: string;
  id: string;
  spotifyId: string;
  displayName: string;
  email?: string | null;
  profileImage?: string | null;
  groups?: Group[];
  isActive?: boolean;
}

export interface Group {
  _id: string;
  id: string;
  name: string;
  description: string;
  createdBy: User;
  members: User[];
  inviteCode: string;
  isActive: boolean;
  spotifyPlaylistId?: string;
  spotifyPlaylistUrl?: string;
  spotifyPlaylistOwnerId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Listener {
  user: User;
  listenedAt: string;
  timeToListen: number | null;
}

export interface Like {
  user: User;
  likedAt: string;
}

export interface Share {
  _id: string;
  id: string;
  group: string | Group;
  sharedBy: User;
  spotifyTrackId: string;
  trackName: string;
  artistName: string;
  albumName: string;
  trackImage: string | null;
  trackPreviewUrl: string | null;
  trackExternalUrl: string | null;
  durationMs: number;
  genres: string[];
  listeners: Listener[];
  listenCount: number;
  likes: Like[];
  likeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Invite {
  _id: string;
  id: string;
  group: string | Group;
  invitedUser: User;
  invitedBy: User;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
  updatedAt: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string; id: string }[];
  album: {
    name: string;
    images: { url: string; height: number; width: number }[];
  };
  duration_ms: number;
  preview_url: string | null;
  external_urls: { spotify: string };
}

export interface SpotifyDevice {
  id: string | null;
  is_active: boolean;
  is_private_session: boolean;
  is_restricted: boolean;
  name: string;
  type: string;
  volume_percent: number | null;
}

export interface GroupStats {
  topSharer: { user: User; shareCount: number } | null;
  topGenrePioneer: { user: User; genreCount: number } | null;
  speedListener: {
    user: User;
    share: { trackName: string; artistName: string };
    timeToListen: number;
    timeToListenFormatted: string;
  } | null;
  overall: {
    totalShares: number;
    totalListens: number;
    uniqueTracks: number;
    averageListensPerShare: string;
  };
}

export interface UserStats {
  tracksShared: number;
  groupsJoined: number;
  totalListens: number;
}

export interface GroupSettings {
  name: string;
  description: string;
  members: Array<{
    id: string;
    displayName: string;
    profileImage?: string | null;
  }>;
}

export type ReflexCategory = 'instant' | 'quick' | 'slow' | 'longTail';

export interface ListenerReflexUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  listens: number;
  medianMs: number;
  p25Ms: number;
  p75Ms: number;
  category: ReflexCategory;
}

export interface ListenerReflexData {
  groupId: string;
  range: '7d' | '30d' | '90d';
  mode: 'received' | 'shared';
  generatedAt: string;
  buckets: {
    instant: string[];
    quick: string[];
    slow: string[];
    longTail: string[];
  };
  users: ListenerReflexUser[];
  ringData: Array<{
    userId: string;
    points: Array<{
      ms: number;
      listenedAt: string; // ISO timestamp
    }>;
  }>;
  summary: {
    groupMedianMs: number;
    instantReactorCount: number;
  };
}

export interface RadarProfile {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  axes: {
    speed: number;
    consistency: number;
    recency: number;
    volume: number;
    burstiness: number;
  };
  raw: {
    reactionCount: number;
    medianLatencySeconds: number;
    iqrSeconds: number;
  };
  lowData: boolean;
}

export interface ListenerReflexRadarData {
  window: '7d' | '30d' | '90d' | 'all';
  mode: 'received' | 'shared';
  maxLatencySeconds: number;
  members: RadarProfile[];
}
