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
  const [activityRange, setActivityRange] = useState<'30d' | 'all'>('30d');

  const fetchStats = useCallback(async () => {
    if (!groupId) return;

    try {
      setIsLoading(true);
      setError(null);

      const [vibes, superlatives] = await Promise.all([
        getMemberVibes(groupId),
        getSuperlatives(groupId)
      ]);

      // Activity is time-bucketed and can be sparse; default to 30d and
      // fallback to all-time if 30d was inactive.
      let activity = await getGroupActivity(groupId, '30d');
      if (Array.isArray(activity) && activity.length === 0) {
        activity = await getGroupActivity(groupId, 'all');
        setActivityRange('all');
      } else {
        setActivityRange('30d');
      }

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
    activityRange,
    refetch: fetchStats
  };
};
