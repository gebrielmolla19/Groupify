import { useEffect, useSyncExternalStore } from 'react';
import { useUser } from '../contexts/UserContext';
import { getSpotifyAccessToken, playTrack as apiPlayTrack, getSpotifyDevices as apiGetSpotifyDevices } from '../lib/api';
import { toast } from 'sonner';
import type { SpotifyPlayer, SpotifyPlayerState, SpotifyTrack } from '../types/spotifyPlayer';
import { logger } from '../utils/logger';

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';

/** Dispatched on `window` by UserContext on logout so the player can tear down. */
export const SPOTIFY_LOGOUT_EVENT = 'groupify:logout';

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
}

const INITIAL_SNAPSHOT: PlayerSnapshot = {
  player: null,
  deviceId: null,
  currentTrack: null,
  isPlaying: false,
  position: 0,
  duration: 0,
  isLoading: true,
  error: null,
  deviceReadyTimestamp: null,
};

/**
 * Errors that `playTrack` has already shown a toast for. Callers check
 * this via `wasPlaybackErrorNotified` so the user doesn't see the same
 * failure twice.
 */
const notifiedErrors = new WeakSet<object>();

export const wasPlaybackErrorNotified = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && notifiedErrors.has(err);

const isDeviceGoneError = (msg: string) =>
  msg.includes('404') || msg.includes('not found') || msg.includes('not ready');

/**
 * Spotify Web Playback singleton store.
 *
 * There is exactly one Spotify SDK player per page, so the state that
 * backs it is genuinely process-wide. It is encapsulated here behind a
 * small store with a stable `getSnapshot`/`subscribe` pair, consumed via
 * React 18's `useSyncExternalStore`. All mutable state lives in one
 * place, snapshots are referentially stable, and the polling interval is
 * owned by the store (so multiple hook instances can't create competing
 * intervals).
 *
 * Follows https://developer.spotify.com/documentation/web-playback-sdk/reference:
 * - `activateElement()` is called synchronously inside the user's tap
 *   before playback starts, which browser autoplay rules (iOS in
 *   particular) require. Without it the device sits paused after the
 *   transfer and later requests 404.
 * - Every documented error event is handled.
 * - Playback is never transferred to this device until the user plays
 *   something, so opening Groupify doesn't pause the user's Spotify app.
 */
const spotifyPlayerStore = (() => {
  let snapshot: PlayerSnapshot = INITIAL_SNAPSHOT;

  const listeners = new Set<() => void>();

  // Non-reactive internals (initialization guards + completion tracking).
  const internal = {
    scriptLoaded: false,
    initStarted: false,
    initializing: false,
    readyAnnounced: false,
    reconnecting: false,
    lastTrackUri: null as string | null,
    hasTrackCompleted: false,
    lastPosition: 0,
    pollInterval: null as ReturnType<typeof setInterval> | null,
    // No component renders from this, so it lives outside the snapshot —
    // changing it must not re-render every consumer.
    onTrackComplete: undefined as ((trackUri: string) => void) | undefined,
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
    if (internal.onTrackComplete) {
      try {
        internal.onTrackComplete(trackUri);
      } catch (err) {
        logger.error('Error in track completion callback:', err);
      }
    }
  };

  const resetCompletionTracking = () => {
    internal.lastTrackUri = null;
    internal.hasTrackCompleted = false;
    internal.lastPosition = 0;
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
          resetCompletionTracking();
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

  /**
   * Re-register the SDK device with Spotify. Used after `not_ready`
   * (typically a dropped connection), when the network comes back, when
   * the tab becomes visible again (phones suspend background tabs), and
   * after Spotify reports the device as gone (`force`).
   */
  const reconnect = async (reason: string, { force = false } = {}) => {
    const player = snapshot.player;
    if (!player || internal.reconnecting) return;
    if (!force && snapshot.deviceId) return;
    internal.reconnecting = true;
    logger.info('[SpotifyPlayer] Reconnecting', { reason });
    try {
      if (force) {
        // The SDK still thinks it's connected but Spotify has dropped the
        // device. Disconnect first so connect() re-registers it and emits
        // a fresh 'ready' with a device id.
        player.disconnect();
        setState({ deviceId: null, deviceReadyTimestamp: null });
      }
      await player.connect();
    } catch (err) {
      logger.warn('[SpotifyPlayer] Reconnect failed', err);
    } finally {
      internal.reconnecting = false;
    }
  };

  const handleOnline = () => {
    void reconnect('online');
  };
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') void reconnect('visible');
  };

  const loadSdkScript = (onReady: () => void) => {
    if (internal.scriptLoaded) {
      if (window.Spotify) onReady();
      return;
    }
    // Must be defined before the SDK script runs (per Spotify docs).
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
    // onload and onSpotifyWebPlaybackSDKReady can both call this — make
    // sure only one player is ever created.
    if (internal.initializing || snapshot.player || !window.Spotify) return;
    internal.initializing = true;

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
            // The SDK keeps waiting if cb is never called; surface it so
            // the UI doesn't sit on a dead player.
            logger.error('Failed to refresh Spotify token:', err);
            setState({ error: 'Lost connection to Spotify. Please log in again.', isPlaying: false });
            toast.error('Failed to refresh Spotify token. Please log in again.');
          }
        },
        volume: 1.0,
      });

      spotifyPlayer.addListener('ready', ({ device_id }) => {
        setState({
          deviceId: device_id,
          deviceReadyTimestamp: Date.now(),
          isLoading: false,
          error: null,
        });
        logger.info('Spotify player ready:', { deviceId: device_id });

        // Playback is deliberately NOT transferred here. Transferring on
        // page load (even with play=false) moves the user's Spotify
        // session to the browser and pauses whatever they were listening
        // to elsewhere. The first playTrack() targets this device_id
        // directly instead.
        if (!internal.readyAnnounced) {
          internal.readyAnnounced = true;
          toast.success('Spotify player ready! Click any track to play.', { duration: 3000 });
        }
      });

      spotifyPlayer.addListener('not_ready', ({ device_id }) => {
        logger.warn('Spotify player went offline:', { deviceId: device_id });
        setState({
          deviceId: null,
          deviceReadyTimestamp: null,
          isPlaying: false,
          currentTrack: null,
          position: 0,
        });
        // Usually a dropped connection — try to come back if we're online.
        if (navigator.onLine) void reconnect('not_ready');
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
          resetCompletionTracking();
          setState({
            currentTrack: null,
            isPlaying: false,
            position: 0,
            duration: 0,
          });
        }
      });

      spotifyPlayer.addListener('initialization_error', ({ message }) => {
        // Most likely the browser lacks EME (encrypted media) — common in
        // in-app browsers such as Instagram or Messages.
        logger.error('Spotify initialization error:', message);
        setState({
          error: "This browser can't play Spotify audio. Open Groupify in Chrome, Safari, Firefox or Edge.",
          isLoading: false,
        });
        toast.error("This browser can't play Spotify audio. Try opening Groupify in Chrome or Safari.", {
          duration: 8000,
        });
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
        toast.error('Spotify Premium is required for playback (mobile-only Premium plans are not supported).');
      });

      spotifyPlayer.addListener('playback_error', ({ message }) => {
        // A track failed to load or play — don't leave the UI showing it
        // as playing.
        logger.error('Spotify playback error:', message);
        setState({ isPlaying: false });
        toast.error("Couldn't play this track. Try another one or skip ahead.");
      });

      spotifyPlayer.addListener('autoplay_failed', () => {
        // The browser blocked audio because playback didn't start from a
        // user tap (e.g. auto-advance on iOS).
        logger.warn('Spotify autoplay blocked by the browser');
        setState({ isPlaying: false });
        toast.info('Tap play to start listening.', { duration: 6000 });
      });

      const connected = await spotifyPlayer.connect();
      if (!connected) {
        throw new Error('Failed to connect Spotify player');
      }

      window.addEventListener('online', handleOnline);
      document.addEventListener('visibilitychange', handleVisibility);

      setState({ player: spotifyPlayer });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to initialize Spotify player';
      logger.error('Player initialization error:', err);
      setState({ error: msg, isLoading: false });
      toast.error(msg);
    } finally {
      internal.initializing = false;
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

  /**
   * Disconnect and reset everything (on logout), so the device leaves the
   * user's Spotify Connect list and the next login starts fresh.
   */
  const teardown = () => {
    stopPolling();
    window.removeEventListener('online', handleOnline);
    document.removeEventListener('visibilitychange', handleVisibility);
    try {
      snapshot.player?.disconnect();
    } catch (err) {
      logger.warn('Error disconnecting Spotify player:', err);
    }
    internal.initStarted = false;
    internal.readyAnnounced = false;
    internal.reconnecting = false;
    internal.onTrackComplete = undefined;
    resetCompletionTracking();
    setState(INITIAL_SNAPSHOT);
  };
  window.addEventListener(SPOTIFY_LOGOUT_EVENT, teardown);

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

    // Must run synchronously inside the user's tap, before any await.
    // Otherwise browsers (iOS especially) block the audio element and the
    // device stays paused after Spotify transfers playback to it.
    player.activateElement().catch(() => {
      // Not fatal; 'autoplay_failed' fires if audio was actually blocked.
    });

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
      logger.info('Playback started:', { trackUri });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to play track';
      logger.error('❌ Play track error:', error);
      if (isDeviceGoneError(msg)) {
        // Spotify no longer knows this device. The backend no longer
        // silently transfers playback to another device (e.g. the phone
        // Spotify app), so nothing is playing — reflect that so the UI
        // doesn't freeze on the old track, then re-register the device.
        setState({ isPlaying: false, position: 0 });
        toast.error('Lost connection to the Spotify player. Reconnecting — tap play again in a moment.', {
          duration: 6000,
        });
        if (error instanceof Error) notifiedErrors.add(error);
        void reconnect('play-404', { force: true });
      } else if (msg.includes('403') || msg.includes('Premium')) {
        toast.error('Spotify Premium is required for playback.');
        if (error instanceof Error) notifiedErrors.add(error);
      }
      throw error;
    }
  };

  const setOnTrackComplete = (callback?: (trackUri: string) => void) => {
    internal.onTrackComplete = callback;
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
    setOnTrackComplete: spotifyPlayerStore.setOnTrackComplete,
  };
};
