import { useCallback, useEffect, useRef, useState } from 'react';
import { getSongsSummary } from '../lib/api';
import { logger } from '../utils/logger';
import type { SongsSummary, ViewerSummaryRange } from '../types/analytics';

/** The browser's IANA time zone, so the group streak counts the member's own days. */
const browserTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

/**
 * "The songs" cards of Group Dynamics for the signed-in member.
 * Load failures come back as `error` for the section to show; no toast.
 */
export const useSongsSummary = (groupId: string | undefined, range: ViewerSummaryRange) => {
  const [data, setData] = useState<SongsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Only the latest request may write state, so a slow answer for an old
  // range never replaces a newer one.
  const latestRequest = useRef(0);

  const fetchSummary = useCallback(async () => {
    if (!groupId) {
      setIsLoading(false);
      return;
    }
    const request = ++latestRequest.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getSongsSummary(groupId, range, browserTimeZone());
      if (request === latestRequest.current) setData(result);
    } catch (err) {
      logger.error('Failed to fetch the songs summary:', err);
      if (request === latestRequest.current) {
        setData(null);
        setError(err instanceof Error ? err.message : 'Failed to fetch the songs');
      }
    } finally {
      if (request === latestRequest.current) setIsLoading(false);
    }
  }, [groupId, range]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { data, isLoading, error, refetch: fetchSummary };
};
