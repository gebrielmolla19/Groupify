import { useState, useEffect, useCallback, useRef } from 'react';
import { getTasteGravity } from '../lib/api';
import { logger } from '../utils/logger';
import type { TasteGravityResponse } from '../types/analytics';

export type TimeRange = '7d' | '30d' | '90d' | 'all';

export const useTasteGravity = (groupId: string, timeRange: TimeRange = '7d') => {
  const [data, setData] = useState<TasteGravityResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use ref to track the groupId and timeRange that the current data belongs to
  const dataRef = useRef<{ groupId: string; timeRange: TimeRange } | null>(null);

  // Clear data when groupId or timeRange changes
  useEffect(() => {
    if (groupId !== dataRef.current?.groupId || timeRange !== dataRef.current?.timeRange) {
      setData(null);
      dataRef.current = null;
      setIsLoading(true);
      setError(null);
    }
  }, [groupId, timeRange]);

  // Fetch taste gravity data
  const fetchData = useCallback(async () => {
    if (!groupId) return;

    const fetchGroupId = groupId;
    const fetchTimeRange = timeRange;

    try {
      setIsLoading(true);
      setError(null);

      const result = await getTasteGravity(fetchGroupId, fetchTimeRange);

      // Only set data if groupId and timeRange haven't changed during the fetch
      if (fetchGroupId === groupId && fetchTimeRange === timeRange) {
        setData(result);
        dataRef.current = { groupId: fetchGroupId, timeRange: fetchTimeRange };
      }
    } catch (err) {
      // Only set error if groupId and timeRange haven't changed
      if (fetchGroupId === groupId && fetchTimeRange === timeRange) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch taste gravity';
        setError(errorMessage);
        logger.error('Failed to fetch taste gravity:', err);
      }
    } finally {
      if (fetchGroupId === groupId && fetchTimeRange === timeRange) {
        setIsLoading(false);
      }
    }
  }, [groupId, timeRange]);

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


