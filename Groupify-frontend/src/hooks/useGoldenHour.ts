import { useCallback, useEffect, useRef, useState } from 'react';
import { getGoldenHour } from '../lib/api';
import { logger } from '../utils/logger';
import type { GoldenHour, GoldenHourRange } from '../types/analytics';

/** The browser's IANA time zone, so weekdays, hours and days are the member's own. */
const browserTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

/**
 * Golden hour and group streak in Group Dynamics, in the viewer's time zone.
 * Load failures come back as `error` for the screen to show; no toast.
 */
export const useGoldenHour = (groupId: string | undefined, range: GoldenHourRange) => {
  const [data, setData] = useState<GoldenHour | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Only the latest request may write state, so a slow answer for an old
  // range never replaces a newer one.
  const latestRequest = useRef(0);

  const fetchGoldenHour = useCallback(async () => {
    if (!groupId) {
      setIsLoading(false);
      return;
    }
    const request = ++latestRequest.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getGoldenHour(groupId, range, browserTimeZone());
      if (request === latestRequest.current) setData(result);
    } catch (err) {
      logger.error('Failed to fetch golden hour:', err);
      if (request === latestRequest.current) {
        setData(null);
        setError(err instanceof Error ? err.message : 'Failed to fetch golden hour');
      }
    } finally {
      if (request === latestRequest.current) setIsLoading(false);
    }
  }, [groupId, range]);

  useEffect(() => {
    fetchGoldenHour();
  }, [fetchGoldenHour]);

  return { data, isLoading, error, refetch: fetchGoldenHour };
};
