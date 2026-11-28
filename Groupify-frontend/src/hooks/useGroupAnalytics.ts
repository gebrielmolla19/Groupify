import { useCallback, useEffect, useRef, useState } from 'react';
import { getGroupActivity, getSuperlatives } from '../lib/api';
import { logger } from '../utils/logger';
import type { AnalyticsRange } from '../types/analytics';

export type ActivityMode = 'shares' | 'engagement';

type Activity = Awaited<ReturnType<typeof getGroupActivity>>;
type Superlatives = Awaited<ReturnType<typeof getSuperlatives>>;

/**
 * Resonance Frequency (activity) and Hall of Fame (superlatives) for one
 * group over the page's shared range. While a new range or mode loads, the
 * previous numbers stay on screen; only a new group starts from empty.
 */
export const useGroupAnalytics = (groupId: string, range: AnalyticsRange) => {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [superlatives, setSuperlatives] = useState<Superlatives | null>(null);
  const [activityMode, setActivityMode] = useState<ActivityMode>('shares');
  const [isActivityLoading, setIsActivityLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only the latest request of each kind may write state, so a slow answer
  // for an old group, range or mode never replaces a newer one.
  const activityRequest = useRef(0);
  const superlativesRequest = useRef(0);

  useEffect(() => {
    setActivity(null);
    setSuperlatives(null);
    setError(null);
  }, [groupId]);

  const fetchActivity = useCallback(async () => {
    if (!groupId) return;
    const request = ++activityRequest.current;
    setIsActivityLoading(true);
    try {
      const result = await getGroupActivity(groupId, range, activityMode);
      if (request === activityRequest.current) setActivity(result);
    } catch (err) {
      logger.error('Failed to fetch activity:', err);
      if (request === activityRequest.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch activity');
      }
    } finally {
      if (request === activityRequest.current) setIsActivityLoading(false);
    }
  }, [groupId, range, activityMode]);

  const fetchSuperlatives = useCallback(async () => {
    if (!groupId) return;
    const request = ++superlativesRequest.current;
    try {
      const result = await getSuperlatives(groupId, range);
      if (request === superlativesRequest.current) setSuperlatives(result);
    } catch (err) {
      logger.error('Failed to fetch superlatives:', err);
      if (request === superlativesRequest.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
      }
    }
  }, [groupId, range]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  useEffect(() => {
    fetchSuperlatives();
  }, [fetchSuperlatives]);

  const refetch = useCallback(async () => {
    setError(null);
    await Promise.all([fetchActivity(), fetchSuperlatives()]);
  }, [fetchActivity, fetchSuperlatives]);

  return {
    activity: activity ?? [],
    superlatives: superlatives ?? {},
    /** True until the group's first activity and Hall of Fame have loaded. */
    isLoading: (activity === null || superlatives === null) && !error,
    isActivityLoading,
    error,
    activityMode,
    changeActivityMode: setActivityMode,
    refetch,
  };
};
