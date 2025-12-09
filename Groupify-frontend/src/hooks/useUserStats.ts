import { useState, useEffect, useCallback } from 'react';
import { UserStats } from '../types';
import { getUserStats } from '../lib/api';

export const useUserStats = () => {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const userStats = await getUserStats();
      setStats(userStats);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch user stats';
      setError(errorMessage);
      console.error('Failed to fetch user stats:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    isLoading,
    error,
    refetch: fetchStats
  };
};

