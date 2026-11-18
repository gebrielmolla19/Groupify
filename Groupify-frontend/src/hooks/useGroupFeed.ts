import { useState, useEffect, useCallback } from 'react';
import { Like, Share } from '../types';
import {
  getGroupFeed as apiGetGroupFeed,
  shareSong as apiShareSong,
  markAsListened as apiMarkAsListened,
  toggleLike as apiToggleLike,
  removeShare as apiRemoveShare,
  getUnheardShares as apiGetUnheardShares
} from '../lib/api';
import { mergeShares } from '../lib/feedFilter';
import { toast } from 'sonner';
import { isSpotifyReauthError } from '../lib/apiError';
import { logger } from '../utils/logger';
import { withListen } from '../lib/heardStack';
import { useSocket } from '../contexts/SocketContext';

export const useGroupFeed = (groupId: string) => {
  const [shares, setShares] = useState<Share[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  // The feed loads only its newest page. Older unheard shares are fetched
  // after it and kept in `shares` too (so likes and listens update them), but
  // marked here so All still shows just the page.
  const [olderIds, setOlderIds] = useState<ReadonlySet<string>>(new Set());
  // 'complete' once every unheard share in the group is loaded.
  const [unheardStatus, setUnheardStatus] = useState<'complete' | 'loading' | 'incomplete'>('complete');
  const { socket, joinGroup, leaveGroup } = useSocket();

  const loadOlderUnheard = useCallback(async (pageIds: Set<string>) => {
    setUnheardStatus('loading');
    try {
      const unheard = await apiGetUnheardShares(100, groupId);
      setOlderIds(new Set(unheard.shares.map((s) => s._id).filter((id) => !pageIds.has(id))));
      setShares((prev) => mergeShares(prev, unheard.shares));
      setUnheardStatus(unheard.total <= unheard.shares.length ? 'complete' : 'incomplete');
    } catch (err) {
      logger.error('Failed to fetch older unheard shares:', err);
      setUnheardStatus('incomplete');
    }
  }, [groupId]);

  const fetchFeed = useCallback(async (limit: number = 50, offset: number = 0) => {
    if (!groupId) return;

    try {
      setIsLoading(true);
      setError(null);
      const data = await apiGetGroupFeed(groupId, limit, offset);
      setShares(data.shares);
      setTotal(data.total);
      setOlderIds(new Set());
      setUnheardStatus('complete');
      // A backlog is mostly older than the page: fetch the group's unheard
      // shares in the background, without holding up the feed.
      if (data.total > data.shares.length) void loadOlderUnheard(new Set(data.shares.map((s) => s._id)));
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
  }, [groupId, loadOlderUnheard]);

  const shareTrack = useCallback(async (spotifyTrackId: string) => {
    try {
      const newShare = await apiShareSong(groupId, spotifyTrackId);
      // Don't add to state here — the socket `songShared` event handles it for all
      // clients in the room including the sharer, preventing duplicates.
      logger.info('Track shared:', { groupId, trackId: spotifyTrackId, trackName: newShare.trackName });
      toast.success('Track shared successfully');
      return newShare;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to share track';
      // UserContext already told the user to sign in with Spotify again.
      if (!isSpotifyReauthError(err)) toast.error(errorMessage);
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

    const onSongLiked = (payload: { shareId: string; userId: string; likeCount: number; likes: Like[] }) => {
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
          s._id === payload.shareId ? withListen(s, payload.userId, payload.listenCount, new Date().toISOString()) : s
        )
      );
      logger.debug('Socket songListened received:', payload.shareId);
    };

    socket.on('songShared', onSongShared);
    socket.on('songLiked', onSongLiked);
    socket.on('songRemoved', onSongRemoved);
    socket.on('songListened', onSongListened);

    return () => {
      leaveGroup(groupId);
      socket.off('songShared', onSongShared);
      socket.off('songLiked', onSongLiked);
      socket.off('songRemoved', onSongRemoved);
      socket.off('songListened', onSongListened);
    };
  }, [socket, groupId, joinGroup, leaveGroup]);

  return {
    shares,
    olderIds,
    total,
    unheardStatus,
    isLoading,
    error,
    shareTrack,
    markListened,
    toggleLike,
    removeShare,
    refetch: fetchFeed
  };
};

