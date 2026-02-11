import { useState, useEffect, useCallback } from 'react';
import { getListenerReflex } from '../lib/api';
import { logger } from '../utils/logger';
import type { ListenerReflexData } from '../types';

export type ListenerReflexRange = '24h' | '7d' | '30d' | '90d' | 'all';
export type ListenerReflexMode = 'received' | 'shared';

export const useListenerReflex = (
  groupId: string | undefined,
  range: ListenerReflexRange = '30d',
  mode: ListenerReflexMode = 'received'
) => {
  const [data, setData] = useState<ListenerReflexData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!groupId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await getListenerReflex(groupId, range, mode);
      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch listener reflex data';
      setError(errorMessage);
      logger.error('Failed to fetch listener reflex data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [groupId, range, mode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchData
  };
};

