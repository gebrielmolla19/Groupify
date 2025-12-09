/**
 * TypeScript type definitions for Spotify Web Playback SDK
 */

export interface SpotifyTrack {
  uri: string;
  id: string;
  type: string;
  media_type: string;
  name: string;
  is_playable: boolean;
  album: {
    uri: string;
    name: string;
    images: Array<{
      url: string;
      height: number;
      width: number;
    }>;
  };
  artists: Array<{
    uri: string;
    name: string;
  }>;
}

export interface SpotifyPlayerState {
  context: {
    uri: string | null;
    metadata: any;
  };
  disallows: {
    pausing?: boolean;
    peeking_next?: boolean;
    peeking_prev?: boolean;
    seeking?: boolean;
    skipping_next?: boolean;
    skipping_prev?: boolean;
  };
  paused: boolean;
  position: number;
  duration: number;
  repeat_mode: number;
  shuffle: boolean;
  track_window: {
    current_track: SpotifyTrack | null;
    previous_tracks: SpotifyTrack[];
    next_tracks: SpotifyTrack[];
  };
}

export interface WebPlaybackInstance {
  device_id: string;
}

export interface SpotifyPlayerError {
  message: string;
}

export interface SpotifyPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: 'ready', callback: (data: WebPlaybackInstance) => void): boolean;
  addListener(event: 'not_ready', callback: (data: WebPlaybackInstance) => void): boolean;
  addListener(event: 'player_state_changed', callback: (state: SpotifyPlayerState | null) => void): boolean;
  addListener(event: 'authentication_error', callback: (error: SpotifyPlayerError) => void): boolean;
  addListener(event: 'account_error', callback: (error: SpotifyPlayerError) => void): boolean;
  removeListener(event: string, callback?: Function): boolean;
  getCurrentState(): Promise<SpotifyPlayerState | null>;
  setName(name: string): Promise<void>;
  getVolume(): Promise<number>;
  setVolume(volume: number): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  togglePlay(): Promise<void>;
  seek(position_ms: number): Promise<void>;
  previousTrack(): Promise<void>;
  nextTrack(): Promise<void>;
}

export interface SpotifyPlayerConstructor {
  new (options: {
    name: string;
    getOAuthToken: (callback: (token: string) => void) => void;
    volume?: number;
  }): SpotifyPlayer;
}

export interface SpotifyNamespace {
  Player: SpotifyPlayerConstructor;
}

declare global {
  interface Window {
    Spotify?: SpotifyNamespace;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

