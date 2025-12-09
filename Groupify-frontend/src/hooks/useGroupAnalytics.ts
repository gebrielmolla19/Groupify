import { useState, useEffect, useCallback } from 'react';
import { getGroupActivity, getMemberStats, getSuperlatives } from '../lib/api';

interface AnalyticsData {
  activity: any[];
  members: any[];
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

      const [activity, members, superlatives] = await Promise.all([
        getGroupActivity(groupId, '7d'),
        getMemberStats(groupId),
        getSuperlatives(groupId)
      ]);

      setData({ activity, members, superlatives });
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
