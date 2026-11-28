import { useState, useEffect, useCallback, useRef } from 'react';
import { getListenerReflex } from '../lib/api';
import { logger } from '../utils/logger';
import type { ListenerReflexData } from '../types';

export type ListenerReflexRange = '24h' | '7d' | '30d' | 'all';
/** 'received' is the Listening view, 'shared' the Sharing view. */
export type ListenerReflexMode = 'received' | 'shared';

/**
 * Listener Reflex for a group. Load failures come back as `error` for the
 * section to show inline with Try again; no toast.
 */
export const useListenerReflex = (
  groupId: string | undefined,
  range: ListenerReflexRange = '30d',
  mode: ListenerReflexMode = 'received'
) => {
  const [data, setData] = useState<ListenerReflexData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Only the latest request may write state, so a slow answer for an old
  // range or mode never replaces a newer one.
  const latestRequest = useRef(0);

  const fetchData = useCallback(async () => {
    if (!groupId) {
      setIsLoading(false);
      return;
    }
    const request = ++latestRequest.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getListenerReflex(groupId, range, mode);
      if (request === latestRequest.current) setData(result);
    } catch (err) {
      logger.error('Failed to fetch listener reflex data:', err);
      if (request === latestRequest.current) {
        setData(null);
        setError(err instanceof Error ? err.message : 'Failed to fetch listener reflex data');
      }
    } finally {
      if (request === latestRequest.current) setIsLoading(false);
    }
  }, [groupId, range, mode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
};
