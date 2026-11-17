import { useState, useCallback } from 'react';
import { SpotifyTrack } from '../types';
import { searchSpotifyTracks } from '../lib/api';
import { toast } from 'sonner';
import { isSpotifyReauthError } from '../lib/apiError';
import { logger } from '../utils/logger';

export const useSpotifySearch = () => {
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string, limit: number = 20) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    try {
      setIsSearching(true);
      setError(null);
      const tracks = await searchSpotifyTracks(query, limit);
      setResults(tracks);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search tracks';
      setError(errorMessage);
      // UserContext already told the user to sign in with Spotify again.
      if (!isSpotifyReauthError(err)) toast.error(errorMessage);
      logger.error('Failed to search tracks:', err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clear = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return {
    results,
    isSearching,
    error,
    search,
    clear
  };
};

