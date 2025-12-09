import { useState, useEffect, useCallback } from 'react';
import { getGroupActivity, getMemberVibes, getSuperlatives } from '../lib/api';

interface AnalyticsData {
  activity: any[];
  vibes: any[];
  superlatives: any;
}

export const useGroupAnalytics = (groupId: string) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!groupId) return;

    try {
      setIsLoading(true);
      setError(null);

      const [activity, vibes, superlatives] = await Promise.all([
        getGroupActivity(groupId, '7d'),
        getMemberVibes(groupId),
        getSuperlatives(groupId)
      ]);

      setData({ activity, vibes, superlatives });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch analytics';
      setError(errorMessage);
      console.error('Failed to fetch analytics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchStats
  };
};
