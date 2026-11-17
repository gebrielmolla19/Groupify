import { useState, useEffect, useCallback } from 'react';
import type { UnheardShares } from '../types';
import { getUnheardShares } from '../lib/api';
import { logger } from '../utils/logger';

/** Unheard shares across the viewer's groups, for Home. */
export const useUnheardShares = (limit = 10) => {
  const [data, setData] = useState<UnheardShares | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUnheard = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      setData(await getUnheardShares(limit));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load unheard tracks');
      logger.error('Failed to fetch unheard shares:', err);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchUnheard();
  }, [fetchUnheard]);

  return { data, isLoading, error, refetch: fetchUnheard };
};
