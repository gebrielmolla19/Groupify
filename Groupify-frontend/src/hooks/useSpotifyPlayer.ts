import { useState, useEffect, useCallback } from 'react';
import { useUser } from '../contexts/UserContext';
import { getSpotifyAccessToken, transferPlayback, playTrack as apiPlayTrack } from '../lib/api';
import { toast } from 'sonner';
import type { SpotifyPlayer, SpotifyPlayerState, SpotifyTrack } from '../types/spotifyPlayer';

const SDK_URL = 'https://sdk.scdn.co/spotify-player.js';

// Module-level state to ensure singleton player instance
let globalPlayer: SpotifyPlayer | null = null;
let globalDeviceId: string | null = null;
let globalCurrentTrack: SpotifyTrack | null = null;
let globalIsPlaying = false;
let globalPosition = 0;
let globalDuration = 0;
let globalIsLoading = true;
let globalError: string | null = null;
let globalDeviceReadyTimestamp: number | null = null;

// Module-level refs to prevent multiple initializations
const scriptLoadedRef = { current: false };
const playerInitializedRef = { current: false };
const transferCalledRef = { current: false };

// Listeners to notify all hook instances of state changes
const stateListeners = new Set<() => void>();

// Track completion callback
let globalOnTrackComplete: ((trackUri: string) => void) | undefined = undefined;
let lastTrackUri: string | null = null;
let hasTrackCompleted = false;
let lastPosition = 0;
let completionCheckInterval: NodeJS.Timeout | null = null;

const notifyListeners = () => {
  stateListeners.forEach(listener => listener());
};

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
 * Hook for integrating with Spotify Web Playback SDK
 * Loads the SDK, initializes player, transfers playback, and exposes player state
 */
export const useSpotifyPlayer = (): UseSpotifyPlayerReturn => {
  const { isAuthenticated, token } = useUser();
  
  // Use module-level state, but create local state for reactivity
  const [player, setPlayer] = useState<SpotifyPlayer | null>(globalPlayer);
  const [deviceId, setDeviceId] = useState<string | null>(globalDeviceId);
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(globalCurrentTrack);
  const [isPlaying, setIsPlaying] = useState(globalIsPlaying);
  const [position, setPosition] = useState(globalPosition);
  const [duration, setDuration] = useState(globalDuration);
  const [isLoading, setIsLoading] = useState(globalIsLoading);
  const [error, setError] = useState<string | null>(globalError);
  const [deviceReadyTimestamp, setDeviceReadyTimestamp] = useState<number | null>(globalDeviceReadyTimestamp);
  const [onTrackComplete, setOnTrackComplete] = useState<((trackUri: string) => void) | undefined>(globalOnTrackComplete);

  // Subscribe to global state changes
  useEffect(() => {
    const updateState = () => {
      setPlayer(globalPlayer);
      setDeviceId(globalDeviceId);
      setCurrentTrack(globalCurrentTrack);
      setIsPlaying(globalIsPlaying);
      setPosition(globalPosition);
      setDuration(globalDuration);
      setIsLoading(globalIsLoading);
      setError(globalError);
      setDeviceReadyTimestamp(globalDeviceReadyTimestamp);
      setOnTrackComplete(globalOnTrackComplete);
    };
    
    stateListeners.add(updateState);
    return () => {
      stateListeners.delete(updateState);
    };
  }, []);

  // Initialize player when SDK is ready
  const initializePlayer = useCallback(async () => {
    if (!isAuthenticated || playerInitializedRef.current || !window.Spotify) {
      return;
    }

    try {
      globalIsLoading = true;
      globalError = null;
      setIsLoading(true);
      setError(null);
      notifyListeners();

      // Fetch Spotify access token from backend
      try {
        // Warm up / validate token early so the SDK can connect reliably.
        // The SDK will also request tokens via getOAuthToken, but this catches
        // auth issues sooner and improves error messaging.
        await getSpotifyAccessToken();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to get Spotify access token';
        console.error('Failed to get Spotify token:', err);
        globalError = errorMsg;
        globalIsLoading = false;
        setError(errorMsg);
        setIsLoading(false);
        notifyListeners();
        toast.error('Failed to connect to Spotify. Please try logging in again.');
        return;
      }

      // Create player instance
      const spotifyPlayer = new window.Spotify.Player({
        name: 'Groupify Web Player',
        getOAuthToken: async (cb) => {
          try {
            // Always fetch fresh token to ensure it's valid
            const freshToken = await getSpotifyAccessToken();
            cb(freshToken);
          } catch (err) {
            console.error('Failed to refresh Spotify token:', err);
            toast.error('Failed to refresh Spotify token');
          }
        },
        volume: 1.0,
      });

      // Set up event listeners
      spotifyPlayer.addListener('ready', async ({ device_id }) => {
        globalDeviceId = device_id;
        globalDeviceReadyTimestamp = Date.now();
        globalIsLoading = false;
        playerInitializedRef.current = true;
        setDeviceId(device_id);
        setIsLoading(false);
        setDeviceReadyTimestamp(globalDeviceReadyTimestamp);
        notifyListeners();

        // CRITICAL: Web Playback SDK devices need to be activated
        // Try to activate the device by calling resume (even though nothing is playing)
        // This makes Spotify's backend recognize the device
        try {
          // Attempt to resume playback (will fail gracefully if nothing is playing)
          await spotifyPlayer.resume();
        } catch (activateErr) {
          // Resume failed (expected if no track)
        }

        // Wait 2 seconds then try to transfer playback to make device active
        setTimeout(async () => {
          if (!transferCalledRef.current) {
            transferCalledRef.current = true;
            try {
              await transferPlayback(device_id);
              toast.success('Spotify player ready! Click any track to play.', { duration: 3000 });
            } catch (err) {
              console.warn('⚠️ Initial transfer failed (device will activate on first play):', err);
              toast.info('Player connected. Click any track to start playing.', { duration: 3000 });
            }
          }
        }, 2000);
      });

      spotifyPlayer.addListener('not_ready', () => {
        globalDeviceId = null;
        globalDeviceReadyTimestamp = null;
        globalIsPlaying = false;
        globalCurrentTrack = null;
        globalPosition = 0;
        setDeviceId(null);
        setDeviceReadyTimestamp(null);
        setIsPlaying(false);
        setCurrentTrack(null);
        setPosition(0);
        notifyListeners();
      });

      spotifyPlayer.addListener('player_state_changed', (state: SpotifyPlayerState | null) => {
        if (state) {
          const currentTrack = state.track_window.current_track;
          const newPosition = state.position;
          const newDuration = state.duration;
          const newIsPlaying = !state.paused;
          
          // Track completion detection
          const currentTrackUri = currentTrack?.uri || null;
          
          // Reset completion flag if track changed
          if (currentTrackUri !== lastTrackUri) {
            hasTrackCompleted = false;
            lastTrackUri = currentTrackUri;
            lastPosition = 0;
          }
          
          // Check for completion: position reached or exceeded duration
          // Also check if position stopped advancing near the end (track finished)
          const isAtEnd = newDuration > 0 && newPosition >= newDuration - 1000; // 1 second threshold (more lenient)
          const positionStopped = newPosition === lastPosition && newPosition > 0 && newPosition >= newDuration - 2000;
          const hasCompleted = (isAtEnd || positionStopped) && !hasTrackCompleted && currentTrackUri;
          
          if (hasCompleted && globalOnTrackComplete) {
            hasTrackCompleted = true;
            // Call completion callback
            try {
              globalOnTrackComplete(currentTrackUri);
            } catch (err) {
              console.error('Error in track completion callback:', err);
            }
          }
          
          lastPosition = newPosition;
          globalCurrentTrack = currentTrack;
          globalIsPlaying = newIsPlaying;
          globalPosition = newPosition;
          globalDuration = newDuration;
          setCurrentTrack(currentTrack);
          setIsPlaying(newIsPlaying);
          setPosition(newPosition);
          setDuration(newDuration);
        } else {
          globalCurrentTrack = null;
          globalIsPlaying = false;
          globalPosition = 0;
          globalDuration = 0;
          lastTrackUri = null;
          hasTrackCompleted = false;
          lastPosition = 0;
          setCurrentTrack(null);
          setIsPlaying(false);
          setPosition(0);
          setDuration(0);
        }
        notifyListeners();
      });

      spotifyPlayer.addListener('authentication_error', ({ message }) => {
        const errorMsg = `Spotify authentication error: ${message}`;
        console.error(errorMsg);
        globalError = errorMsg;
        globalIsLoading = false;
        setError(errorMsg);
        setIsLoading(false);
        notifyListeners();
        toast.error('Spotify authentication failed. Please log in again.');
      });

      spotifyPlayer.addListener('account_error', ({ message }) => {
        const errorMsg = `Spotify account error: ${message}`;
        console.error(errorMsg);
        globalError = errorMsg;
        globalIsLoading = false;
        setError(errorMsg);
        setIsLoading(false);
        notifyListeners();
        toast.error('Spotify account error. Premium account may be required.');
      });

      // Connect player
      const connected = await spotifyPlayer.connect();
      if (!connected) {
        throw new Error('Failed to connect Spotify player');
      }

      globalPlayer = spotifyPlayer;
      setPlayer(spotifyPlayer);
      notifyListeners();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to initialize Spotify player';
      console.error('Player initialization error:', err);
      globalError = errorMsg;
      globalIsLoading = false;
      setError(errorMsg);
      setIsLoading(false);
      notifyListeners();
      toast.error(errorMsg);
    }
  }, [isAuthenticated, token]);

  // Load SDK script
  useEffect(() => {
    // Only load if authenticated and script not already loaded
    if (!isAuthenticated || scriptLoadedRef.current) {
      return;
    }

    // Set the callback BEFORE checking for existing script or creating new one
    // This ensures it's always available when SDK calls it
    window.onSpotifyWebPlaybackSDKReady = initializePlayer;

    // Check if script already exists in DOM
    const existingScript = document.querySelector(`script[src="${SDK_URL}"]`);
    if (existingScript) {
      scriptLoadedRef.current = true;
      // If SDK is already available, initialize player immediately
      if (window.Spotify) {
        initializePlayer();
      }
      // Otherwise, the SDK will call our callback when ready
      return;
    }

    // Create and load script
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;

    script.onload = () => {
      scriptLoadedRef.current = true;
      // SDK will call onSpotifyWebPlaybackSDKReady when ready
      // We already set the callback above, so just wait for it
      // But if Spotify is already available, initialize now
      if (window.Spotify) {
        initializePlayer();
      }
    };

    script.onerror = () => {
      const errorMsg = 'Failed to load Spotify Web Playback SDK';
      setError(errorMsg);
      setIsLoading(false);
      console.error(errorMsg);
      toast.error(errorMsg);
    };

    document.head.appendChild(script);

    // Cleanup function - DON'T clear the callback as SDK might still need it
    return () => {
      // Don't remove script or clear callback to avoid issues
    };
  }, [isAuthenticated, initializePlayer]);

  // Don't disconnect player on unmount - keep it alive across navigation
  // Only disconnect on app unmount (handled elsewhere if needed)

  // Lightweight interval to update position when playing (only for UI smoothness)
  // The player_state_changed event handles most updates, but we poll position
  // every 1 second for smoother progress bar updates when playing
  useEffect(() => {
    if (!player || !isPlaying) {
      // Clear interval when not playing
      if (completionCheckInterval) {
        clearInterval(completionCheckInterval);
        completionCheckInterval = null;
      }
      return;
    }

    // Clear any existing interval
    if (completionCheckInterval) {
      clearInterval(completionCheckInterval);
      completionCheckInterval = null;
    }

    // Only poll position when actively playing (reduces unnecessary calls)
    // Also checks for track completion since player_state_changed might miss natural endings
    const interval = setInterval(async () => {
      try {
        const state = await player.getCurrentState();
        if (state) {
          const currentTrack = state.track_window.current_track;
          const newPosition = state.position;
          const newDuration = state.duration;
          const newIsPlaying = !state.paused;
          const currentTrackUri = currentTrack?.uri || null;
          
          // Reset completion flag if track changed
          if (currentTrackUri !== lastTrackUri) {
            hasTrackCompleted = false;
            lastTrackUri = currentTrackUri;
            lastPosition = 0;
          }
          
          // Check for completion: position reached or exceeded duration
          // Also check if position stopped advancing near the end (track finished)
          const isAtEnd = newDuration > 0 && newPosition >= newDuration - 1000; // 1 second threshold
          const positionStopped = newPosition === lastPosition && newPosition > 0 && newPosition >= newDuration - 2000;
          const hasCompleted = (isAtEnd || positionStopped) && !hasTrackCompleted && currentTrackUri;
          
          if (hasCompleted && globalOnTrackComplete) {
            hasTrackCompleted = true;
            // Call completion callback
            try {
              globalOnTrackComplete(currentTrackUri);
            } catch (err) {
              console.error('Error in track completion callback:', err);
            }
          }
          
          lastPosition = newPosition;
          
          // Only update if values changed (avoid unnecessary re-renders)
          if (newPosition !== globalPosition || newDuration !== globalDuration || newIsPlaying !== globalIsPlaying) {
          globalPosition = newPosition;
          globalDuration = newDuration;
          globalIsPlaying = newIsPlaying;
          setPosition(newPosition);
          setDuration(newDuration);
          setIsPlaying(newIsPlaying);
          notifyListeners();
          }
        } else {
          // State is null - track might have ended
          // If we were playing a track and now state is null, it likely completed
          if (lastTrackUri && !hasTrackCompleted && globalOnTrackComplete) {
            hasTrackCompleted = true;
            try {
              globalOnTrackComplete(lastTrackUri);
            } catch (err) {
              console.error('Error in track completion callback (null state):', err);
            }
          }
          
          // Reset state
          lastTrackUri = null;
          hasTrackCompleted = false;
          lastPosition = 0;
        }
      } catch (err) {
        // Silently handle errors - player_state_changed will handle state updates
        // Only log if it's a persistent issue
        if (err instanceof Error && !err.message.includes('No active device')) {
        console.error('Error getting current state:', err);
        }
      }
    }, 1000); // Check every 1 second for position updates and completion detection

    completionCheckInterval = interval;

    return () => {
      if (completionCheckInterval) {
        clearInterval(completionCheckInterval);
        completionCheckInterval = null;
      }
    };
  }, [player, isPlaying]);

  /**
   * Play a specific track by URI
   * @param trackUri - Spotify track URI (spotify:track:xxx)
   */
  const playTrack = useCallback(async (trackUri: string) => {
    if (!deviceId) {
      throw new Error('No device connected. Please wait for the player to initialize.');
    }

    if (!player) {
      throw new Error('Player not initialized. Please wait for the player to connect.');
    }

    if (!trackUri || !trackUri.startsWith('spotify:track:')) {
      throw new Error('Invalid track URI. Expected format: spotify:track:xxx');
    }

    // Check if device was recently registered - wait if too soon
    const timeSinceReady = globalDeviceReadyTimestamp ? Date.now() - globalDeviceReadyTimestamp : Infinity;
    if (timeSinceReady < 5000) {
      const waitTime = 5000 - timeSinceReady;
      toast.info(`Preparing player... ${Math.ceil(waitTime/1000)}s`, { duration: waitTime });
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    try {
      // Use backend API endpoint to play track
      await apiPlayTrack(deviceId, trackUri);
      
      toast.success('Track playing!');
      // The player state will update automatically via the player_state_changed event
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to play track';
      console.error('❌ Play track error:', error);
      
      // If device not found (404), provide helpful guidance
      if (errorMsg.includes('404') || errorMsg.includes('not found') || errorMsg.includes('not ready')) {
        toast.error('⚠️ Web player activation needed: Open Spotify app → Play any song → Wait 5s → Try again', {
          duration: 10000
        });
      } else if (errorMsg.includes('403') || errorMsg.includes('Premium')) {
        toast.error('Spotify Premium is REQUIRED for web playback');
      }
      
      throw error;
    }
  }, [deviceId, player]);

  // Set track completion callback
  const setTrackCompleteCallback = useCallback((callback?: ((trackUri: string) => void)) => {
    globalOnTrackComplete = callback;
    setOnTrackComplete(callback);
  }, []);

  return {
    player,
    deviceId,
    currentTrack,
    isPlaying,
    position,
    duration,
    isLoading,
    error,
    deviceReadyTimestamp,
    playTrack,
    onTrackComplete,
    setOnTrackComplete: setTrackCompleteCallback,
  };
};

