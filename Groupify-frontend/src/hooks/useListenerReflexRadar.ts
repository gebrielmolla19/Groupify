import { useState, useEffect, useCallback } from 'react';
import { getListenerReflexRadar } from '../lib/api';
import { logger } from '../utils/logger';
import type { ListenerReflexRadarData } from '../types';

export type ListenerReflexRadarWindow = '7d' | '30d' | '90d' | 'all';
export type ListenerReflexRadarMode = 'received' | 'shared';

export const useListenerReflexRadar = (
  groupId: string | undefined,
  window: ListenerReflexRadarWindow = '30d',
  mode: ListenerReflexRadarMode = 'received'
) => {
  const [data, setData] = useState<ListenerReflexRadarData | null>(null);
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

      const result = await getListenerReflexRadar(groupId, window, mode);
      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch radar data';
      setError(errorMessage);
      logger.error('Failed to fetch listener reflex radar data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [groupId, window, mode]);

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
