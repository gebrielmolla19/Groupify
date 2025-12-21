import { useState, useEffect, useCallback } from 'react';
import { Share } from '../types';
import {
  getGroupFeed as apiGetGroupFeed,
  shareSong as apiShareSong,
  markAsListened as apiMarkAsListened,
  toggleLike as apiToggleLike
} from '../lib/api';
import { toast } from 'sonner';
import { logger } from '../utils/logger';

export const useGroupFeed = (groupId: string) => {
  const [shares, setShares] = useState<Share[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const fetchFeed = useCallback(async (limit: number = 50, offset: number = 0) => {
    if (!groupId) return;

    try {
      setIsLoading(true);
      setError(null);
      const data = await apiGetGroupFeed(groupId, limit, offset);
      setShares(data.shares);
      setTotal(data.total);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch group feed';
      // Handle deleted group gracefully (404 errors)
      if (errorMessage.includes('not found') || errorMessage.includes('404')) {
        logger.debug('Group not found, clearing feed');
        setShares([]);
        setTotal(0);
        setError(null);
      } else {
        setError(errorMessage);
        logger.error('Failed to fetch group feed:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [groupId]);

  const shareTrack = useCallback(async (spotifyTrackId: string) => {
    try {
      const newShare = await apiShareSong(groupId, spotifyTrackId);
      setShares(prev => [newShare, ...prev]);
      setTotal(prev => prev + 1);
      logger.info('Track shared:', { groupId, trackId: spotifyTrackId, trackName: newShare.trackName });
      toast.success('Track shared successfully');
      return newShare;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to share track';
      toast.error(errorMessage);
      throw err;
    }
  }, [groupId]);

  const markListened = useCallback(async (shareId: string) => {
    try {
      const updatedShare = await apiMarkAsListened(shareId);
      setShares(prev =>
        prev.map(share =>
          share._id === shareId ? updatedShare : share
        )
      );
      logger.info('Track marked as listened:', { shareId, trackName: updatedShare.trackName });
      toast.success('Marked as listened');
      return updatedShare;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to mark as listened';
      toast.error(errorMessage);
      throw err;
    }
  }, []);

  const toggleLike = useCallback(async (shareId: string) => {
    try {
      // Optimistic update
      setShares(prev =>
        prev.map(share => {
          if (share._id === shareId) {
            // Check if user already liked
            // Note: We don't have easy access to current user ID here without context
            // So we'll rely on the API response for the final state, but we can try to be optimistic
            // For now, let's just wait for the API response to be safe and accurate
            return share;
          }
          return share;
        })
      );

      const updatedShare = await apiToggleLike(shareId);

      setShares(prev =>
        prev.map(share =>
          share._id === shareId ? updatedShare : share
        )
      );

      return updatedShare;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle like';
      toast.error(errorMessage);
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  return {
    shares,
    total,
    isLoading,
    error,
    shareTrack,
    markListened,
    toggleLike,
    refetch: fetchFeed
  };
};

