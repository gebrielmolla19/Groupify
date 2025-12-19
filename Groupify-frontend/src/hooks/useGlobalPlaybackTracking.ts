import { useEffect, useRef } from 'react';
import { useCurrentPlayback } from './useCurrentPlayback';
import { useGroups } from './useGroups';
import { useUser } from '../contexts/UserContext';
import { markAsListened, getGroupFeed } from '../lib/api';
import { toast } from 'sonner';

/**
 * Global hook to auto-track plays from any device across all user groups
 * This works regardless of which screen the user is on
 */
export const useGlobalPlaybackTracking = () => {
  const { user } = useUser();
  const { groups } = useGroups();
  const { playback: remotePlayback } = useCurrentPlayback(
    !!user, // Only poll when user is authenticated
    5000 // Poll every 5 seconds
  );

  // Track remote playback for auto-marking as listened
  // Track ALL matching shares across all groups (same track can be in multiple groups)
  const remotePlaybackRef = useRef<{
    trackId: string | null;
    startTime: number | null;
    shareIds: Array<{ shareId: string; groupId: string }>; // Track all matching shares
  }>({ trackId: null, startTime: null, shareIds: [] });

  // Cache for group shares to avoid repeated API calls
  // Cache includes timestamp for expiration (5 minutes)
  const sharesCacheRef = useRef<Map<string, {
    shares: Array<{
      _id: string;
      spotifyTrackId: string;
      trackName: string;
    }>;
    timestamp: number;
  }>>(new Map());
  
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  const isFetchingRef = useRef(false); // Prevent concurrent fetches

  // Fetch shares for a group (with caching and expiration)
  const getGroupShares = async (groupId: string): Promise<Array<{
    _id: string;
    spotifyTrackId: string;
    trackName: string;
  }>> => {
    // Check cache first (with expiration check)
    const cached = sharesCacheRef.current.get(groupId);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return cached.shares;
    }

    try {
      // Fetch up to 100 shares to ensure we don't miss tracks
      // Most groups won't have more than 100 shares, so this should cover most cases
      const data = await getGroupFeed(groupId, 100, 0);
      
      if (data.shares) {
        const shares = data.shares.map((s) => ({
          _id: s._id,
          spotifyTrackId: s.spotifyTrackId,
          trackName: s.trackName,
        }));
        sharesCacheRef.current.set(groupId, {
          shares,
          timestamp: Date.now()
        });
        console.log(`[Global Auto-track] Cached ${shares.length} shares for group ${groupId}`);
        return shares;
      }
    } catch (err) {
      console.error(`[Global Auto-track] Failed to fetch shares for group ${groupId}:`, err);
    }

    return [];
  };

  // Auto-detect and track plays from other devices across all groups
  useEffect(() => {
    if (!user || !groups.length) return;

    // Debug logging
    if (remotePlayback?.item?.id) {
      console.log('[Global Auto-track] Polling playback:', {
        trackId: remotePlayback.item.id,
        trackName: remotePlayback.item.name,
        isPlaying: remotePlayback.is_playing,
        progress: remotePlayback.progress_ms,
        duration: remotePlayback.item.duration_ms,
        device: remotePlayback.device?.name
      });
    }

    if (!remotePlayback) {
      // No playback detected - this is normal when nothing is playing
      return;
    }

    const currentTrackId = remotePlayback.item?.id;
    const wasPlaying = remotePlayback.is_playing;
    const prevTrackId = remotePlaybackRef.current.trackId;
    const progressMs = remotePlayback.progress_ms || 0;
    const durationMs = remotePlayback.item?.duration_ms || 0;
    const isAtEnd = durationMs > 0 && progressMs >= durationMs - 1000;

    // Track started playing (new track) OR track is playing but we haven't tracked it yet
    if (wasPlaying && currentTrackId && (currentTrackId !== prevTrackId || remotePlaybackRef.current.shareIds.length === 0) && !isFetchingRef.current) {
      // Prevent concurrent fetches
      isFetchingRef.current = true;
      
      // Search through all groups to find ALL matching shares (same track can be in multiple groups)
      // OPTIMIZATION: Fetch all groups in parallel instead of sequentially
      const findMatchingShares = async () => {
        try {
          const matchingShares: Array<{ shareId: string; groupId: string; trackName: string; groupName: string }> = [];
          
          console.log(`[Global Auto-track] 🔍 Searching for track "${remotePlayback.item?.name}" (${currentTrackId}) across ${groups.length} group(s)...`);
          
          // Fetch shares for all groups in parallel
          const sharePromises = groups.map(async (group) => {
            try {
              const shares = await getGroupShares(group._id);
              console.log(`[Global Auto-track] Group "${group.name}": ${shares.length} shares loaded`);
              
              const matchingShare = shares.find(s => s.spotifyTrackId === currentTrackId);
              
              if (matchingShare) {
                console.log(`[Global Auto-track] ✅ Found match in group "${group.name}": ${matchingShare.trackName}`);
                return {
                  shareId: matchingShare._id,
                  groupId: group._id,
                  trackName: matchingShare.trackName,
                  groupName: group.name
                };
              } else {
                // Log what track IDs we have for debugging
                const trackIds = shares.map(s => s.spotifyTrackId).slice(0, 5);
                console.log(`[Global Auto-track] ❌ No match in group "${group.name}". Sample track IDs:`, trackIds);
              }
            } catch (err) {
              console.error(`[Global Auto-track] Error fetching shares for group ${group._id}:`, err);
            }
            return null;
          });
          
          const results = await Promise.all(sharePromises);
          const validMatches = results.filter((m): m is NonNullable<typeof m> => m !== null);
          
          if (validMatches.length > 0) {
            // Only update if we don't already have this track tracked, or update the start time if we do
            const existingStartTime = remotePlaybackRef.current.trackId === currentTrackId 
              ? remotePlaybackRef.current.startTime 
              : null;
            
            remotePlaybackRef.current = {
              trackId: currentTrackId,
              startTime: existingStartTime || Date.now(),
              shareIds: validMatches.map(m => ({ shareId: m.shareId, groupId: m.groupId }))
            };
            
            console.log(`[Global Auto-track] ✅ Detected playback: "${validMatches[0].trackName}" (${currentTrackId}) in ${validMatches.length} group(s):`, 
              validMatches.map(m => m.groupName).join(', '));
            console.log(`[Global Auto-track] Tracking ${validMatches.length} share(s) for auto-marking`);
          } else {
            console.log(`[Global Auto-track] ⚠️ Track "${remotePlayback.item?.name}" (${currentTrackId}) not found in any group shares`);
            console.log(`[Global Auto-track] 💡 Tip: If this track was just shared, the cache might be stale. It will refresh in 5 minutes or when you navigate to the group.`);
            
            // If we have a cached result but no match, clear cache to force refresh on next poll
            // This helps if a track was just shared
            if (groups.length > 0) {
              console.log(`[Global Auto-track] Clearing cache to force refresh on next detection...`);
              sharesCacheRef.current.clear();
            }
          }
        } finally {
          isFetchingRef.current = false;
        }
      };

      void findMatchingShares();
    }

    // Track completed naturally (reached the end)
    if (isAtEnd && currentTrackId && remotePlaybackRef.current.shareIds.length > 0 && remotePlaybackRef.current.trackId === currentTrackId) {
      console.log(`[Global Auto-track] 🎵 Track completed - marking ${remotePlaybackRef.current.shareIds.length} share(s) as listened`);
      // Mark ALL matching shares as listened (OPTIMIZATION: parallelize API calls)
      const markAllShares = async () => {
        const shareIds = remotePlaybackRef.current.shareIds;
        const groupIds = new Set<string>();
        
        // Mark all shares in parallel instead of sequentially
        const markPromises = shareIds.map(async ({ shareId, groupId }) => {
          groupIds.add(groupId);
          try {
            await markAsListened(shareId);
            console.log(`[Global Auto-track] Marked share ${shareId} as listened`);
            return { success: true, shareId };
          } catch (err) {
            // If already listened, that's fine - just log
            if (err instanceof Error && err.message?.includes('already')) {
              console.log(`[Global Auto-track] Share ${shareId} already marked as listened`);
              return { success: true, shareId }; // Treat as success
            } else {
              console.error(`[Global Auto-track] Failed to mark share ${shareId} as listened:`, err);
              return { success: false, shareId };
            }
          }
        });
        
        await Promise.all(markPromises);
        
        // Clear cache for all affected groups to refresh data
        groupIds.forEach(groupId => sharesCacheRef.current.delete(groupId));
        
        if (shareIds.length > 0) {
          toast.success(`Track auto-marked as listened in ${shareIds.length} group(s)`);
        }
      };
      
      void markAllShares();
      
      // Reset tracking
      remotePlaybackRef.current = { trackId: null, startTime: null, shareIds: [] };
      return;
    }

    // Track stopped playing (paused)
    if (!wasPlaying && prevTrackId && remotePlaybackRef.current.shareIds.length > 0 && currentTrackId === prevTrackId) {
      const timePlayed = remotePlaybackRef.current.startTime 
        ? Date.now() - remotePlaybackRef.current.startTime 
        : 0;
      
      const progressPercent = durationMs > 0 ? (progressMs / durationMs) * 100 : 0;
      const shouldMark = timePlayed >= 30000 || progressPercent >= 80;
      
      console.log(`[Global Auto-track] Track paused - timePlayed: ${Math.round(timePlayed/1000)}s, progress: ${Math.round(progressPercent)}%, shouldMark: ${shouldMark}`);
      
      if (shouldMark) {
        console.log(`[Global Auto-track] ⏸️ Track paused after sufficient playtime - marking ${remotePlaybackRef.current.shareIds.length} share(s) as listened`);
        // Mark ALL matching shares as listened (OPTIMIZATION: parallelize API calls)
        const markAllShares = async () => {
          const shareIds = remotePlaybackRef.current.shareIds;
          const groupIds = new Set<string>();
          
          // Mark all shares in parallel instead of sequentially
          const markPromises = shareIds.map(async ({ shareId, groupId }) => {
            groupIds.add(groupId);
            try {
              await markAsListened(shareId);
              console.log(`[Global Auto-track] Marked share ${shareId} as listened`);
              return { success: true, shareId };
            } catch (err) {
              // If already listened, that's fine - just log
              if (err instanceof Error && err.message?.includes('already')) {
                console.log(`[Global Auto-track] Share ${shareId} already marked as listened`);
                return { success: true, shareId }; // Treat as success
              } else {
                console.error(`[Global Auto-track] Failed to mark share ${shareId} as listened:`, err);
                return { success: false, shareId };
              }
            }
          });
          
          await Promise.all(markPromises);
          
          // Clear cache for all affected groups to refresh data
          groupIds.forEach(groupId => sharesCacheRef.current.delete(groupId));
          
          if (shareIds.length > 0) {
            toast.success(`Track auto-marked as listened in ${shareIds.length} group(s)`);
          }
        };
        
        void markAllShares();
      }
      
      // Reset tracking
      remotePlaybackRef.current = { trackId: null, startTime: null, shareIds: [] };
    }

    // Track changed to a different track
    if (currentTrackId && currentTrackId !== prevTrackId && prevTrackId && remotePlaybackRef.current.shareIds.length > 0) {
      const timePlayed = remotePlaybackRef.current.startTime 
        ? Date.now() - remotePlaybackRef.current.startTime 
        : 0;
      
      if (timePlayed >= 30000) {
        console.log(`[Global Auto-track] 🔄 Track changed after sufficient playtime - marking ${remotePlaybackRef.current.shareIds.length} share(s) as listened`);
        // Mark ALL matching shares as listened (OPTIMIZATION: parallelize API calls)
        const markAllShares = async () => {
          const shareIds = remotePlaybackRef.current.shareIds;
          const groupIds = new Set<string>();
          
          // Mark all shares in parallel instead of sequentially
          const markPromises = shareIds.map(async ({ shareId, groupId }) => {
            groupIds.add(groupId);
            try {
              await markAsListened(shareId);
              console.log(`[Global Auto-track] Marked share ${shareId} as listened`);
              return { success: true, shareId };
            } catch (err) {
              // If already listened, that's fine - just log
              if (err instanceof Error && err.message?.includes('already')) {
                console.log(`[Global Auto-track] Share ${shareId} already marked as listened`);
                return { success: true, shareId }; // Treat as success
              } else {
                console.error(`[Global Auto-track] Failed to mark share ${shareId} as listened:`, err);
                return { success: false, shareId };
              }
            }
          });
          
          await Promise.all(markPromises);
          
          // Clear cache for all affected groups to refresh data
          groupIds.forEach(groupId => sharesCacheRef.current.delete(groupId));
          
          if (shareIds.length > 0) {
            toast.success(`Track auto-marked as listened in ${shareIds.length} group(s)`);
          }
        };
        
        void markAllShares();
      }
      
      // Reset for new track
      remotePlaybackRef.current = { trackId: null, startTime: null, shareIds: [] };
    }

    // Update current track ID
    if (currentTrackId && currentTrackId !== prevTrackId) {
      remotePlaybackRef.current.trackId = currentTrackId;
    }
    
    // Periodic check: If track is playing but we haven't found matching shares yet,
    // try searching again (in case shares were added or cache was stale)
    if (wasPlaying && currentTrackId && remotePlaybackRef.current.trackId === currentTrackId && remotePlaybackRef.current.shareIds.length === 0 && !isFetchingRef.current) {
      // Only retry every 30 seconds to avoid excessive API calls
      const lastRetry = (remotePlaybackRef.current as any).lastRetry || 0;
      if (Date.now() - lastRetry > 30000) {
        console.log(`[Global Auto-track] 🔄 Retrying search for track "${remotePlayback.item?.name}" (${currentTrackId}) - no matches found yet`);
        (remotePlaybackRef.current as any).lastRetry = Date.now();
        
        isFetchingRef.current = true;
        const findMatchingShares = async () => {
          try {
            // Clear cache to force fresh fetch
            sharesCacheRef.current.clear();
            
            const matchingShares: Array<{ shareId: string; groupId: string; trackName: string; groupName: string }> = [];
            
            const sharePromises = groups.map(async (group) => {
              try {
                const shares = await getGroupShares(group._id);
                const matchingShare = shares.find(s => s.spotifyTrackId === currentTrackId);
                
                if (matchingShare) {
                  return {
                    shareId: matchingShare._id,
                    groupId: group._id,
                    trackName: matchingShare.trackName,
                    groupName: group.name
                  };
                }
              } catch (err) {
                console.error(`[Global Auto-track] Error fetching shares for group ${group._id}:`, err);
              }
              return null;
            });
            
            const results = await Promise.all(sharePromises);
            const validMatches = results.filter((m): m is NonNullable<typeof m> => m !== null);
            
            if (validMatches.length > 0) {
              remotePlaybackRef.current = {
                trackId: currentTrackId,
                startTime: Date.now(),
                shareIds: validMatches.map(m => ({ shareId: m.shareId, groupId: m.groupId }))
              };
              
              console.log(`[Global Auto-track] ✅ Found on retry: "${validMatches[0].trackName}" in ${validMatches.length} group(s)`);
            }
          } finally {
            isFetchingRef.current = false;
          }
        };
        
        void findMatchingShares();
      }
    }
  }, [remotePlayback, user, groups]);
};
