import { useCallback, useEffect, useRef, useState } from 'react';
import { getSongs } from '../lib/api';
import { logger } from '../utils/logger';
import type { SongsRange, SongsResponse } from '../types/analytics';

/**
 * "The songs" in Group Dynamics: every share in the period with its listens.
 * `shareId` (the share opened from the feed) stays in the answer even when
 * it's older than the period. Load failures come back as `error`; no toast.
 */
export const useSongJourney = (groupId: string | undefined, range: SongsRange, shareId: string | null) => {
  const [data, setData] = useState<SongsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Only the latest request may write state, so a slow answer for an old
  // range never replaces a newer one.
  const latestRequest = useRef(0);

  const fetchSongs = useCallback(async () => {
    if (!groupId) {
      setIsLoading(false);
      return;
    }
    const request = ++latestRequest.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getSongs(groupId, range, shareId);
      if (request === latestRequest.current) setData(result);
    } catch (err) {
      logger.error('Failed to fetch the songs:', err);
      if (request === latestRequest.current) {
        setData(null);
        setError(err instanceof Error ? err.message : 'Failed to fetch the songs');
      }
    } finally {
      if (request === latestRequest.current) setIsLoading(false);
    }
  }, [groupId, range, shareId]);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  return { data, isLoading, error, refetch: fetchSongs };
};
