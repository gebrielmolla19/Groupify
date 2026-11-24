import { useCallback, useEffect, useRef, useState } from 'react';
import { getViewerSummary } from '../lib/api';
import { logger } from '../utils/logger';
import type { ViewerSummary, ViewerSummaryRange } from '../types/analytics';

/** The browser's IANA time zone, so a streak counts the member's own days. */
const browserTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

/**
 * The "You" section of Group Dynamics for the signed-in member.
 * Load failures come back as `error` for the screen to show; no toast.
 */
export const useViewerSummary = (groupId: string | undefined, range: ViewerSummaryRange) => {
  const [data, setData] = useState<ViewerSummary | null>(null);
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
      const result = await getViewerSummary(groupId, range, browserTimeZone());
      if (request === latestRequest.current) setData(result);
    } catch (err) {
      logger.error('Failed to fetch viewer summary:', err);
      if (request === latestRequest.current) {
        setData(null);
        setError(err instanceof Error ? err.message : 'Failed to fetch your numbers');
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
