import { useState, useEffect, useCallback, useRef } from 'react';
import { getGroupActivity, getMemberVibes, getSuperlatives } from '../lib/api';

interface AnalyticsData {
  activity: any[];
  vibes: any[];
  superlatives: any;
}

export type TimeRange = '24h' | '7d' | '30d' | '90d' | 'all';
export type ActivityMode = 'shares' | 'engagement';

export const useGroupAnalytics = (groupId: string) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActivityLoading, setIsActivityLoading] = useState(false);
  const [isVibesLoading, setIsVibesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activityRange, setActivityRange] = useState<TimeRange>('30d');
  const [activityMode, setActivityMode] = useState<ActivityMode>('shares');
  const [vibesRange, setVibesRange] = useState<TimeRange>('all');
  
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
      setVibesRange('all');
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
        getGroupActivity(fetchGroupId, '30d', 'shares'),
        getMemberVibes(fetchGroupId, 'all'),
        getSuperlatives(fetchGroupId)
      ]);

      // Only set data if groupId hasn't changed during the fetch
      if (fetchGroupId === groupId) {
      setData({ activity, vibes, superlatives });
        dataGroupIdRef.current = fetchGroupId;
        setActivityRange('30d');
        setVibesRange('all');
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

  // Fetch only activity data for time range or mode changes
  const fetchActivity = useCallback(async (range: TimeRange, mode: ActivityMode = activityMode) => {
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
      const activity = await getGroupActivity(fetchGroupId, range, mode);
      
      // Only update if groupId hasn't changed during the fetch and data still belongs to this group
      if (fetchGroupId === groupId && dataGroupIdRef.current === groupId) {
        setData(prev => prev ? { ...prev, activity } : null);
        setActivityRange(range);
        setActivityMode(mode);
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
  }, [groupId, data, isLoading, activityMode]);

  useEffect(() => {
    fetchAllStats();
  }, [groupId]); // Re-fetch when groupId changes

  // Fetch only vibes data for time range changes
  const fetchVibes = useCallback(async (range: TimeRange) => {
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
      setIsVibesLoading(true);
      const vibes = await getMemberVibes(fetchGroupId, range);
      
      // Only update if groupId hasn't changed during the fetch and data still belongs to this group
      if (fetchGroupId === groupId && dataGroupIdRef.current === groupId) {
        setData(prev => prev ? { ...prev, vibes } : null);
        setVibesRange(range);
      }
    } catch (err) {
      // Only set error if groupId hasn't changed
      if (fetchGroupId === groupId) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch vibes';
        setError(errorMessage);
        console.error('Failed to fetch vibes:', err);
      }
    } finally {
      if (fetchGroupId === groupId) {
        setIsVibesLoading(false);
      }
    }
  }, [groupId, data, isLoading]);

  const changeTimeRange = useCallback((range: TimeRange) => {
    fetchActivity(range, activityMode);
  }, [fetchActivity, activityMode]);

  const changeActivityMode = useCallback((mode: ActivityMode) => {
    fetchActivity(activityRange, mode);
  }, [fetchActivity, activityRange]);

  const changeVibesRange = useCallback((range: TimeRange) => {
    fetchVibes(range);
  }, [fetchVibes]);

  return {
    data,
    isLoading,
    isActivityLoading,
    isVibesLoading,
    error,
    activityRange,
    activityMode,
    vibesRange,
    changeTimeRange,
    changeActivityMode,
    changeVibesRange,
    refetch: fetchAllStats
  };
};
