import { useState, useEffect, useCallback } from 'react';
import { getGroupActivity, getMemberVibes, getSuperlatives } from '../lib/api';

interface AnalyticsData {
  activity: any[];
  vibes: any[];
  superlatives: any;
}

export type TimeRange = '24h' | '7d' | '30d' | '90d' | 'all';

export const useGroupAnalytics = (groupId: string) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActivityLoading, setIsActivityLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activityRange, setActivityRange] = useState<TimeRange>('30d');

  // Initial fetch: load everything
  const fetchAllStats = useCallback(async () => {
    if (!groupId) return;

    try {
      setIsLoading(true);
      setError(null);

      const [activity, vibes, superlatives] = await Promise.all([
        getGroupActivity(groupId, '30d'),
        getMemberVibes(groupId),
        getSuperlatives(groupId)
      ]);

      setData({ activity, vibes, superlatives });
      setActivityRange('30d');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch analytics';
      setError(errorMessage);
      console.error('Failed to fetch analytics:', err);
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  // Fetch only activity data for time range changes
  const fetchActivity = useCallback(async (range: TimeRange) => {
    if (!groupId || !data) return;

    try {
      setIsActivityLoading(true);
      const activity = await getGroupActivity(groupId, range);
      
      setData(prev => prev ? { ...prev, activity } : null);
      setActivityRange(range);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch activity';
      setError(errorMessage);
      console.error('Failed to fetch activity:', err);
    } finally {
      setIsActivityLoading(false);
    }
  }, [groupId, data]);

  useEffect(() => {
    fetchAllStats();
  }, [groupId]); // Only re-fetch when groupId changes

  const changeTimeRange = useCallback((range: TimeRange) => {
    fetchActivity(range);
  }, [fetchActivity]);

  return {
    data,
    isLoading,
    isActivityLoading,
    error,
    activityRange,
    changeTimeRange,
    refetch: fetchAllStats
  };
};
