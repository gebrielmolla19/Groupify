import { useState, useEffect, useRef } from 'react';
import { getCurrentPlayback } from '../lib/api';
import { isApiError } from '../lib/apiError';
import { logger } from '../utils/logger';

/** How long to stop polling after a 429 that didn't say how long to wait. */
const DEFAULT_RATE_LIMIT_WAIT_MS = 30_000;

/**
 * Spotify rate-limits the whole app, so after a 429 every poller in the page
 * (the player bar, listen tracking) waits until this time (#121).
 */
let rateLimitedUntil = 0;

export interface CurrentPlayback {
  device: {
    id: string | null;
    is_active: boolean;
    is_private_session: boolean;
    is_restricted: boolean;
    name: string;
    type: string;
    volume_percent: number | null;
  } | null;
  item: {
    id: string;
    name: string;
    artists: Array<{ name: string; id: string }>;
    album: {
      name: string;
      images: Array<{ url: string; height: number; width: number }>;
    };
    duration_ms: number;
    external_urls: { spotify: string };
  } | null;
  is_playing: boolean;
  progress_ms: number;
  timestamp: number;
}

interface UseCurrentPlaybackReturn {
  playback: CurrentPlayback | null;
  isLoading: boolean;
  error: string | null;
  lastTrackId: string | null;
}

/**
 * Hook to poll Spotify's current playback state
 * This detects playback on ANY device (phone, desktop, web player, etc.)
 * 
 * @param enabled - Whether to poll for playback (default: true)
 * @param pollInterval - How often to poll in ms (default: 8000 = 8 seconds)
 */
export const useCurrentPlayback = (
  enabled: boolean = true,
  pollInterval: number = 8000
): UseCurrentPlaybackReturn => {
  const [playback, setPlayback] = useState<CurrentPlayback | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTrackId, setLastTrackId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTrackIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const pollPlayback = async () => {
      if (Date.now() < rateLimitedUntil) return;
      try {
        setIsLoading(true);
        setError(null);
        const current = await getCurrentPlayback();
        setPlayback(current);

        // Track track changes for auto-tracking
        if (current?.item?.id) {
          const currentTrackId = current.item.id;
          if (lastTrackIdRef.current && lastTrackIdRef.current !== currentTrackId) {
            // Track changed - this will be handled by the component using this hook
            setLastTrackId(currentTrackId);
          }
          lastTrackIdRef.current = currentTrackId;
        } else {
          lastTrackIdRef.current = null;
          setLastTrackId(null);
        }
      } catch (err) {
        if (isApiError(err) && err.status === 429) {
          const waitMs = err.retryAfterMs ?? DEFAULT_RATE_LIMIT_WAIT_MS;
          rateLimitedUntil = Math.max(rateLimitedUntil, Date.now() + waitMs);
          logger.warn('Spotify rate limit: pausing playback polling', { waitMs });
          return;
        }
        const errorMsg = err instanceof Error ? err.message : 'Failed to fetch playback state';
        setError(errorMsg);
        // Don't show toast for 404/204 (no playback) - that's normal
        if (!errorMsg.includes('404') && !errorMsg.includes('204')) {
          logger.error('Failed to poll playback:', err);
        }
      } finally {
        setIsLoading(false);
      }
    };

    // Poll immediately, then set up interval
    pollPlayback();
    intervalRef.current = setInterval(pollPlayback, pollInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, pollInterval]);

  return {
    playback,
    isLoading,
    error,
    lastTrackId,
  };
};




