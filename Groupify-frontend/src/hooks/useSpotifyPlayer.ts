import { useEffect, useSyncExternalStore } from 'react';
import { useUser } from '../contexts/UserContext';
import { getSpotifyAccessToken, transferPlayback, playTrack as apiPlayTrack, getSpotifyDevices as apiGetSpotifyDevices } from '../lib/api';
import { toast } from 'sonner';
import type { SpotifyPlayer, SpotifyPlayerState, SpotifyTrack } from '../types/spotifyPlayer';
import { logger } from '../utils/logger';

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';

export interface UseSpotifyPlayerReturn {
  player: SpotifyPlayer | null;
  deviceId: string | null;
  currentTrack: SpotifyTrack | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  isLoading: boolean;
  error: string | null;
  deviceReadyTimestamp: number | null;
  playTrack: (trackUri: string) => Promise<void>;
  onTrackComplete?: (trackUri: string) => void;
  setOnTrackComplete?: (callback?: (trackUri: string) => void) => void;
}

/**
 * The reactive slice of player state exposed to React. Held as a single
 * immutable snapshot object so `useSyncExternalStore` can compare by
 * reference — a new object is produced only when a value actually changes.
 */
interface PlayerSnapshot {
  player: SpotifyPlayer | null;
  deviceId: string | null;
  currentTrack: SpotifyTrack | null;
  isPlaying: boolean;
  position: number;
  duration: number;
  isLoading: boolean;
  error: string | null;
  deviceReadyTimestamp: number | null;
  onTrackComplete?: (trackUri: string) => void;
}

/**
 * Spotify Web Playback singleton store.
 *
 * There is exactly one Spotify SDK player per page, so the state that
 * backs it is genuinely process-wide. Rather than scattering that across
 * loose module variables + a hand-rolled listener Set (the previous
 * design), it is encapsulated here behind a small store with a stable
 * `getSnapshot`/`subscribe` pair, consumed via React 18's
 * `useSyncExternalStore`. Behavior is unchanged; the difference is that
 * all mutable state lives in one place, snapshots are referentially
 * stable, and the polling interval is owned by the store (so multiple
 * hook instances can no longer create competing intervals).
 */
const spotifyPlayerStore = (() => {
  let snapshot: PlayerSnapshot = {
    player: null,
    deviceId: null,
    currentTrack: null,
    isPlaying: false,
    position: 0,
    duration: 0,
    isLoading: true,
    error: null,
    deviceReadyTimestamp: null,
    onTrackComplete: undefined,
  };

  const listeners = new Set<() => void>();

  // Non-reactive internals (initialization guards + completion tracking).
  const internal = {
    scriptLoaded: false,
    playerInitialized: false,
    transferCalled: false,
    initStarted: false,
    lastTrackUri: null as string | null,
    hasTrackCompleted: false,
    lastPosition: 0,
    pollInterval: null as ReturnType<typeof setInterval> | null,
  };

  const getSnapshot = () => snapshot;

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  /**
   * Merge a partial patch into the snapshot. Produces a new snapshot
   * object (and notifies subscribers) only if at least one field actually
   * changed — this keeps `useSyncExternalStore` from looping.
   */
  const setState = (patch: Partial<PlayerSnapshot>) => {
    let changed = false;
    for (const key of Object.keys(patch) as (keyof PlayerSnapshot)[]) {
      if (snapshot[key] !== patch[key]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    snapshot = { ...snapshot, ...patch };
    listeners.forEach(l => l());
  };

  const fireTrackComplete = (trackUri: string) => {
    window.dispatchEvent(new CustomEvent('spotifyTrackComplete', { detail: { trackUri } }));
    if (snapshot.onTrackComplete) {
      try {
        snapshot.onTrackComplete(trackUri);
      } catch (err) {
        logger.error('Error in track completion callback:', err);
      }
    }
  };

  /**
   * Shared completion-detection logic, used by both the SDK
   * `player_state_changed` event and the 1s polling fallback.
   */
  const detectCompletion = (trackUri: string | null, position: number, duration: number) => {
    if (trackUri !== internal.lastTrackUri) {
      internal.hasTrackCompleted = false;
      internal.lastTrackUri = trackUri;
      internal.lastPosition = 0;
    }
    const isAtEnd = duration > 0 && position >= duration - 1000;
    const positionStopped =
      position === internal.lastPosition && position > 0 && position >= duration - 2000;
    if ((isAtEnd || positionStopped) && !internal.hasTrackCompleted && trackUri) {
      internal.hasTrackCompleted = true;
      fireTrackComplete(trackUri);
    }
    internal.lastPosition = position;
  };

  const stopPolling = () => {
    if (internal.pollInterval) {
      clearInterval(internal.pollInterval);
      internal.pollInterval = null;
    }
  };

  const startPolling = () => {
    stopPolling();
    const player = snapshot.player;
    if (!player) return;

    internal.pollInterval = setInterval(async () => {
      try {
        const state = await player.getCurrentState();
        if (state) {
          const track = state.track_window.current_track;
          const newPosition = state.position;
          const newDuration = state.duration;
          const newIsPlaying = !state.paused;
          const trackUri = track?.uri || null;

          detectCompletion(trackUri, newPosition, newDuration);

          if (
            newPosition !== snapshot.position ||
            newDuration !== snapshot.duration ||
            newIsPlaying !== snapshot.isPlaying
          ) {
            setState({ position: newPosition, duration: newDuration, isPlaying: newIsPlaying });
          }
        } else {
          // Null state — track likely ended.
          if (internal.lastTrackUri && !internal.hasTrackCompleted) {
            internal.hasTrackCompleted = true;
            fireTrackComplete(internal.lastTrackUri);
          }
          internal.lastTrackUri = null;
          internal.hasTrackCompleted = false;
          internal.lastPosition = 0;
        }
      } catch (err) {
        if (err instanceof Error && !err.message.includes('No active device')) {
          logger.error('Error getting current state:', err);
        }
      }
    }, 1000);
  };

  // Keep the polling interval in sync with play state, owned solely by
  // the store (one interval, regardless of how many hooks are mounted).
  const syncPolling = () => {
    if (snapshot.player && snapshot.isPlaying) {
      if (!internal.pollInterval) startPolling();
    } else {
      stopPolling();
    }
  };
  listeners.add(syncPolling);

  const loadSdkScript = (onReady: () => void) => {
    if (internal.scriptLoaded) {
      if (window.Spotify) onReady();
      return;
    }
    window.onSpotifyWebPlaybackSDKReady = onReady;

    const existing = document.querySelector(`script[src="${SDK_URL}"]`);
    if (existing) {
      internal.scriptLoaded = true;
      if (window.Spotify) onReady();
      return;
    }

    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => {
      internal.scriptLoaded = true;
      if (window.Spotify) onReady();
    };
    script.onerror = () => {
      const msg = 'Failed to load Spotify Web Playback SDK';
      setState({ error: msg, isLoading: false });
      logger.error(msg);
      toast.error(msg);
    };
    document.head.appendChild(script);
  };

  const initializePlayer = async () => {
    if (internal.playerInitialized || !window.Spotify) return;

    try {
      setState({ isLoading: true, error: null });

      try {
        // Warm up / validate token early for clearer error messaging.
        await getSpotifyAccessToken();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to get Spotify access token';
        logger.error('Failed to get Spotify token:', err);
        setState({ error: msg, isLoading: false });
        toast.error('Failed to connect to Spotify. Please try logging in again.');
        return;
      }

      const spotifyPlayer = new window.Spotify.Player({
        name: 'Groupify Web Player',
        getOAuthToken: async (cb) => {
          try {
            const freshToken = await getSpotifyAccessToken();
            cb(freshToken);
          } catch (err) {
            logger.error('Failed to refresh Spotify token:', err);
            toast.error('Failed to refresh Spotify token');
          }
        },
        volume: 1.0,
      });

      spotifyPlayer.addListener('ready', async ({ device_id }) => {
        internal.playerInitialized = true;
        setState({
          deviceId: device_id,
          deviceReadyTimestamp: Date.now(),
          isLoading: false,
        });
        logger.info('Spotify player initialized:', { deviceId: device_id });

        // Web Playback SDK devices need activation — a resume() nudge
        // makes Spotify's backend recognize the device.
        try {
          await spotifyPlayer.resume();
        } catch {
          // Expected when nothing is playing.
        }

        setTimeout(async () => {
          if (!internal.transferCalled) {
            internal.transferCalled = true;
            try {
              await transferPlayback(device_id);
              toast.success('Spotify player ready! Click any track to play.', { duration: 3000 });
            } catch (err) {
              logger.warn('⚠️ Initial transfer failed (device will activate on first play):', err);
              toast.info('Player connected. Click any track to start playing.', { duration: 3000 });
            }
          }
        }, 2000);
      });

      spotifyPlayer.addListener('not_ready', () => {
        setState({
          deviceId: null,
          deviceReadyTimestamp: null,
          isPlaying: false,
          currentTrack: null,
          position: 0,
        });
      });

      spotifyPlayer.addListener('player_state_changed', (state: SpotifyPlayerState | null) => {
        if (state) {
          const track = state.track_window.current_track;
          const newPosition = state.position;
          const newDuration = state.duration;
          const newIsPlaying = !state.paused;
          const trackUri = track?.uri || null;

          detectCompletion(trackUri, newPosition, newDuration);

          setState({
            currentTrack: track,
            isPlaying: newIsPlaying,
            position: newPosition,
            duration: newDuration,
          });
        } else {
          internal.lastTrackUri = null;
          internal.hasTrackCompleted = false;
          internal.lastPosition = 0;
          setState({
            currentTrack: null,
            isPlaying: false,
            position: 0,
            duration: 0,
          });
        }
      });

      spotifyPlayer.addListener('authentication_error', ({ message }) => {
        const msg = `Spotify authentication error: ${message}`;
        logger.error(msg);
        setState({ error: msg, isLoading: false });
        toast.error('Spotify authentication failed. Please log in again.');
      });

      spotifyPlayer.addListener('account_error', ({ message }) => {
        const msg = `Spotify account error: ${message}`;
        logger.error(msg);
        setState({ error: msg, isLoading: false });
        toast.error('Spotify account error. Premium account may be required.');
      });

      const connected = await spotifyPlayer.connect();
      if (!connected) {
        throw new Error('Failed to connect Spotify player');
      }

      setState({ player: spotifyPlayer });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to initialize Spotify player';
      logger.error('Player initialization error:', err);
      setState({ error: msg, isLoading: false });
      toast.error(msg);
    }
  };

  /**
   * Idempotently kick off SDK load + player init. Safe to call from
   * every hook instance / re-render; guarded so it runs once.
   */
  const ensureInitialized = () => {
    if (internal.initStarted) return;
    internal.initStarted = true;
    loadSdkScript(() => {
      void initializePlayer();
    });
  };

  const playTrack = async (trackUri: string) => {
    const { deviceId, player, deviceReadyTimestamp } = snapshot;

    if (!deviceId) {
      throw new Error('No device connected. Please wait for the player to initialize.');
    }
    if (!player) {
      throw new Error('Player not initialized. Please wait for the player to connect.');
    }
    if (!trackUri || !trackUri.startsWith('spotify:track:')) {
      throw new Error('Invalid track URI. Expected format: spotify:track:xxx');
    }

    // If the device was just registered, confirm it's visible to Spotify
    // before issuing the play command.
    const timeSinceReady = deviceReadyTimestamp ? Date.now() - deviceReadyTimestamp : Infinity;
    if (timeSinceReady < 3000) {
      for (let i = 0; i < 5; i++) {
        try {
          const devices = await apiGetSpotifyDevices();
          if (devices.some(d => d.id === deviceId)) break;
        } catch {
          // ignore — fall through to retry / play attempt
        }
        if (i < 4) await new Promise(r => setTimeout(r, 500));
      }
    }

    try {
      await apiPlayTrack(deviceId, trackUri);
      try {
        await player.resume();
      } catch {
        // SDK will pick it up via state change.
      }
      logger.info('Playback started:', { trackUri });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to play track';
      logger.error('❌ Play track error:', error);
      if (msg.includes('404') || msg.includes('not found') || msg.includes('not ready')) {
        // The Web Playback device is gone. The backend no longer
        // silently transfers playback to another device (e.g. the
        // phone Spotify app), so nothing is playing. Reflect that in
        // state so the UI doesn't stay frozen showing a "playing"
        // track, and best-effort re-register the SDK device so the
        // next attempt can succeed. (On mobile browsers Spotify's Web
        // Playback SDK is unsupported, so this will keep failing there
        // — see the planned mobile remote-control mode.)
        setState({ isPlaying: false, position: 0 });
        try {
          await snapshot.player?.connect();
        } catch {
          // best effort — device may re-register and emit 'ready'
        }
        toast.error(
          'Playback device unavailable. On a phone, control playback from the Spotify app — the in-browser player isn’t supported on mobile.',
          { duration: 8000 }
        );
      } else if (msg.includes('403') || msg.includes('Premium')) {
        toast.error('Spotify Premium is REQUIRED for web playback');
      }
      throw error;
    }
  };

  const setOnTrackComplete = (callback?: (trackUri: string) => void) => {
    setState({ onTrackComplete: callback });
  };

  return {
    subscribe,
    getSnapshot,
    ensureInitialized,
    playTrack,
    setOnTrackComplete,
  };
})();

/**
 * Hook for integrating with the Spotify Web Playback SDK.
 * Thin wrapper over the singleton store: subscribes to its snapshot and
 * ensures the SDK is initialized once the user is authenticated.
 */
export const useSpotifyPlayer = (): UseSpotifyPlayerReturn => {
  const { isAuthenticated } = useUser();
  const snapshot = useSyncExternalStore(spotifyPlayerStore.subscribe, spotifyPlayerStore.getSnapshot);

  useEffect(() => {
    if (isAuthenticated) {
      spotifyPlayerStore.ensureInitialized();
    }
  }, [isAuthenticated]);

  return {
    player: snapshot.player,
    deviceId: snapshot.deviceId,
    currentTrack: snapshot.currentTrack,
    isPlaying: snapshot.isPlaying,
    position: snapshot.position,
    duration: snapshot.duration,
    isLoading: snapshot.isLoading,
    error: snapshot.error,
    deviceReadyTimestamp: snapshot.deviceReadyTimestamp,
    playTrack: spotifyPlayerStore.playTrack,
    onTrackComplete: snapshot.onTrackComplete,
    setOnTrackComplete: spotifyPlayerStore.setOnTrackComplete,
  };
};
