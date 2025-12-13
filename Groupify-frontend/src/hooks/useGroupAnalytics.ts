import { useState, useEffect, useCallback, useRef } from 'react';
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
  
  // Use ref to track the groupId that the current data belongs to
  const dataGroupIdRef = useRef<string | null>(null);

  // Clear data when groupId changes
  useEffect(() => {
    if (groupId !== dataGroupIdRef.current) {
      setData(null);
      dataGroupIdRef.current = null;
      setIsLoading(true);
      setError(null);
      setActivityRange('30d');
    }
  }, [groupId]);

  // Initial fetch: load everything
  const fetchAllStats = useCallback(async () => {
    if (!groupId) return;

    const fetchGroupId = groupId; // Capture groupId at fetch start

    try {
      setIsLoading(true);
      setError(null);

      const [activity, vibes, superlatives] = await Promise.all([
        getGroupActivity(fetchGroupId, '30d'),
        getMemberVibes(fetchGroupId),
        getSuperlatives(fetchGroupId)
      ]);

      // Only set data if groupId hasn't changed during the fetch
      if (fetchGroupId === groupId) {
        setData({ activity, vibes, superlatives });
        dataGroupIdRef.current = fetchGroupId;
        setActivityRange('30d');
      }
    } catch (err) {
      // Only set error if groupId hasn't changed
      if (fetchGroupId === groupId) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch analytics';
        setError(errorMessage);
        console.error('Failed to fetch analytics:', err);
      }
    } finally {
      if (fetchGroupId === groupId) {
        setIsLoading(false);
      }
    }
  }, [groupId]);

  // Fetch only activity data for time range changes
  const fetchActivity = useCallback(async (range: TimeRange) => {
    // Don't proceed if:
    // 1. No groupId
    // 2. Currently loading initial data (data might be stale)
    // 3. No data exists yet (initial load not complete)
    // 4. Data belongs to a different group (stale data)
    if (!groupId || isLoading || !data || dataGroupIdRef.current !== groupId) {
      return;
    }

    const fetchGroupId = groupId; // Capture groupId at fetch start

    try {
      setIsActivityLoading(true);
      const activity = await getGroupActivity(fetchGroupId, range);
      
      // Only update if groupId hasn't changed during the fetch and data still belongs to this group
      if (fetchGroupId === groupId && dataGroupIdRef.current === groupId) {
        setData(prev => prev ? { ...prev, activity } : null);
        setActivityRange(range);
      }
    } catch (err) {
      // Only set error if groupId hasn't changed
      if (fetchGroupId === groupId) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch activity';
        setError(errorMessage);
        console.error('Failed to fetch activity:', err);
      }
    } finally {
      if (fetchGroupId === groupId) {
        setIsActivityLoading(false);
      }
    }
  }, [groupId, data, isLoading]);

  useEffect(() => {
    fetchAllStats();
  }, [groupId]); // Re-fetch when groupId changes

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
