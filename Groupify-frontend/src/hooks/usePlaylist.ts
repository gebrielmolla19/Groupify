import { useState, useEffect, useMemo } from 'react';
import { Share } from '../types';
import { getGroupFeed as apiGetGroupFeed } from '../lib/api';
import { toast } from 'sonner';

export type SortOption = 'most-listened' | 'recently-added' | 'alphabetical' | 'shared-by';

export interface PlaylistStats {
  totalTracks: number;
  totalDuration: number; // in milliseconds
  totalDurationFormatted: string; // formatted as "Xh Ym" or "Ym"
  uniqueArtists: number;
}

export const usePlaylist = (groupId: string, externalSortBy?: SortOption) => {
  const [shares, setShares] = useState<Share[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [internalSortBy, setInternalSortBy] = useState<SortOption>('most-listened');
  
  // Use external sortBy if provided, otherwise use internal state
  const sortBy = externalSortBy ?? internalSortBy;
  const setSortBy = externalSortBy ? (() => {}) : setInternalSortBy;

  // Fetch all shares with pagination (backend limit is 100 per request)
  useEffect(() => {
    const fetchPlaylist = async () => {
      if (!groupId) return;
      
      try {
        setIsLoading(true);
        setError(null);
        
        // Fetch all tracks using pagination
        const allShares: Share[] = [];
        let offset = 0;
        const limit = 100; // Backend max limit
        let hasMore = true;

        while (hasMore) {
          const data = await apiGetGroupFeed(groupId, limit, offset);
          allShares.push(...data.shares);
          
          // Check if we've fetched all tracks
          if (data.shares.length < limit || allShares.length >= data.total) {
            hasMore = false;
          } else {
            offset += limit;
          }
        }

        setShares(allShares);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch playlist';
        // Handle deleted group gracefully (404 errors)
        if (errorMessage.includes('not found') || errorMessage.includes('404')) {
          console.log('Group not found, clearing playlist');
          setShares([]);
          setError(null);
        } else {
          setError(errorMessage);
          console.error('Failed to fetch playlist:', err);
          toast.error(errorMessage);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlaylist();
  }, [groupId]);

  // Sort shares based on selected option
  const sortedShares = useMemo(() => {
    const sorted = [...shares];

    switch (sortBy) {
      case 'most-listened':
        return sorted.sort((a, b) => b.listenCount - a.listenCount);
      
      case 'recently-added':
        return sorted.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      
      case 'alphabetical':
        return sorted.sort((a, b) => a.trackName.localeCompare(b.trackName));
      
      case 'shared-by':
        return sorted.sort((a, b) => 
          a.sharedBy.displayName.localeCompare(b.sharedBy.displayName)
        );
      
      default:
        return sorted;
    }
  }, [shares, sortBy]);

  // Calculate playlist stats
  const stats: PlaylistStats = useMemo(() => {
    const totalDuration = shares.reduce((sum, share) => sum + (share.durationMs || 0), 0);
    const uniqueArtists = new Set(shares.map(share => share.artistName)).size;
    
    // Format duration
    const hours = Math.floor(totalDuration / (1000 * 60 * 60));
    const minutes = Math.floor((totalDuration % (1000 * 60 * 60)) / (1000 * 60));
    
    let totalDurationFormatted = '';
    if (hours > 0) {
      totalDurationFormatted = `${hours}h ${minutes}m`;
    } else {
      totalDurationFormatted = `${minutes}m`;
    }

    return {
      totalTracks: shares.length,
      totalDuration,
      totalDurationFormatted,
      uniqueArtists
    };
  }, [shares]);

  return {
    shares: sortedShares,
    isLoading,
    error,
    sortBy,
    setSortBy,
    stats,
    refetch: () => {
      // Trigger refetch by updating groupId dependency
      setShares([]);
      setIsLoading(true);
    }
  };
};

