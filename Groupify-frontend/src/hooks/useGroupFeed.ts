import { useState, useEffect, useCallback } from 'react';
import { Share } from '../types';
import {
  getGroupFeed as apiGetGroupFeed,
  shareSong as apiShareSong,
  markAsListened as apiMarkAsListened,
  unmarkAsListened as apiUnmarkAsListened,
  toggleLike as apiToggleLike,
  removeShare as apiRemoveShare
} from '../lib/api';
import { toast } from 'sonner';
import { logger } from '../utils/logger';
import { useSocket } from '../contexts/SocketContext';

export const useGroupFeed = (groupId: string) => {
  const [shares, setShares] = useState<Share[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const { socket, joinGroup, leaveGroup } = useSocket();

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

      // Dispatch global event for other listeners
      window.dispatchEvent(new CustomEvent('trackListened', {
        detail: { groupId, shareId, updatedShare }
      }));

      return updatedShare;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to mark as listened';
      toast.error(errorMessage);
      throw err;
    }
  }, []);

  const unmarkListened = useCallback(async (shareId: string) => {
    try {
      const updatedShare = await apiUnmarkAsListened(shareId);
      setShares(prev =>
        prev.map(share =>
          share._id === shareId ? updatedShare : share
        )
      );
      logger.info('Track unmarked as listened:', { shareId, trackName: updatedShare.trackName });
      toast.success('Unmarked as listened');

      // Dispatch global event for other listeners
      window.dispatchEvent(new CustomEvent('trackUnlistened', {
        detail: { groupId, shareId, updatedShare }
      }));

      return updatedShare;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unmark as listened';
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

  const removeShare = useCallback(async (shareId: string) => {
    try {
      await apiRemoveShare(shareId);
      setShares(prev => prev.filter(share => share._id !== shareId));
      setTotal(prev => prev - 1);
      toast.success('Track removed from group');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove song';
      toast.error(errorMessage);
      throw err;
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // Window event listeners for same-tab cross-hook sync (legacy, kept for compatibility)
  useEffect(() => {
    const handleGlobalListened = (event: CustomEvent) => {
      const { groupId: eventGroupId, shareId, updatedShare } = event.detail;
      if (eventGroupId !== groupId) return;

      if (updatedShare) {
        setShares(prev => prev.map(s => (s._id === shareId ? updatedShare : s)));
      } else {
        fetchFeed();
      }
    };

    const handleGlobalRemoved = (event: CustomEvent) => {
      const { groupId: eventGroupId, shareId } = event.detail;
      if (eventGroupId !== groupId) return;
      setShares(prev => prev.filter(s => s._id !== shareId));
      setTotal(prev => prev - 1);
    };

    window.addEventListener('trackListened', handleGlobalListened as EventListener);
    window.addEventListener('trackRemoved', handleGlobalRemoved as EventListener);

    return () => {
      window.removeEventListener('trackListened', handleGlobalListened as EventListener);
      window.removeEventListener('trackRemoved', handleGlobalRemoved as EventListener);
    };
  }, [fetchFeed, groupId]);

  // Socket.io real-time listeners — updates from other users in the same group room
  useEffect(() => {
    if (!socket || !groupId) return;

    joinGroup(groupId);

    const onSongShared = (payload: { share: Share }) => {
      const incomingShare = payload.share;
      setShares(prev => {
        // Deduplicate: if this user's optimistic update is already in state, skip
        const alreadyExists = prev.some(s => s._id === incomingShare._id);
        if (alreadyExists) return prev;
        return [incomingShare, ...prev];
      });
      setTotal(prev => prev + 1);
      logger.debug('Socket songShared received:', incomingShare._id);
    };

    const onSongLiked = (payload: { shareId: string; userId: string; likeCount: number; likes: string[] }) => {
      setShares(prev =>
        prev.map(s =>
          s._id === payload.shareId
            ? { ...s, likeCount: payload.likeCount, likes: payload.likes }
            : s
        )
      );
      logger.debug('Socket songLiked received:', payload.shareId);
    };

    const onSongRemoved = (payload: { shareId: string; groupId: string }) => {
      setShares(prev => prev.filter(s => s._id !== payload.shareId));
      setTotal(prev => Math.max(0, prev - 1));
      logger.debug('Socket songRemoved received:', payload.shareId);
    };

    const onSongListened = (payload: { shareId: string; userId: string; listenCount: number }) => {
      setShares(prev =>
        prev.map(s =>
          s._id === payload.shareId ? { ...s, listenCount: payload.listenCount } : s
        )
      );
      logger.debug('Socket songListened received:', payload.shareId);
    };

    const onSongUnlistened = (payload: { shareId: string; userId: string; listenCount: number }) => {
      setShares(prev =>
        prev.map(s =>
          s._id === payload.shareId ? { ...s, listenCount: payload.listenCount } : s
        )
      );
      logger.debug('Socket songUnlistened received:', payload.shareId);
    };

    socket.on('songShared', onSongShared);
    socket.on('songLiked', onSongLiked);
    socket.on('songRemoved', onSongRemoved);
    socket.on('songListened', onSongListened);
    socket.on('songUnlistened', onSongUnlistened);

    return () => {
      leaveGroup(groupId);
      socket.off('songShared', onSongShared);
      socket.off('songLiked', onSongLiked);
      socket.off('songRemoved', onSongRemoved);
      socket.off('songListened', onSongListened);
      socket.off('songUnlistened', onSongUnlistened);
    };
  }, [socket, groupId, joinGroup, leaveGroup]);

  return {
    shares,
    total,
    isLoading,
    error,
    shareTrack,
    markListened,
    unmarkListened,
    toggleLike,
    removeShare,
    refetch: fetchFeed
  };
};

