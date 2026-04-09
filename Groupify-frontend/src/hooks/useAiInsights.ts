import { useState, useEffect, useCallback } from 'react';
import { getAiInsights } from '../lib/api';
import { logger } from '../utils/logger';

export const useAiInsights = (
  groupId: string | undefined,
  type: string,
  timeRange: string,
  mode?: string
) => {
  const [data, setData] = useState<Record<string, string> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!groupId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const result = await getAiInsights(groupId, type, timeRange, mode);
      if (result.generated && result.insights) {
        setData(result.insights);
      } else {
        setData(null);
      }
    } catch (err) {
      logger.warn('AI insights unavailable:', err);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [groupId, type, timeRange, mode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading };
};
