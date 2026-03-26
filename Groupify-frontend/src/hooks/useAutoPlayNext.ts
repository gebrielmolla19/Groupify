import { useEffect, useRef } from 'react';
import { usePlayingGroup } from '../contexts/PlayingGroupContext';
import { usePlaylist } from './usePlaylist';
import { useSpotifyPlayer } from './useSpotifyPlayer';
import { toast } from 'sonner';
import { logger } from '../utils/logger';

/**
 * Auto-plays the next song in the group playlist when the current track finishes.
 * Must be mounted inside PlayingGroupProvider (e.g., AuthenticatedLayout).
 */
export function useAutoPlayNext() {
  const { playingGroup, sortBy } = usePlayingGroup();
  const { shares } = usePlaylist(playingGroup?._id || '', sortBy);
  const { playTrack } = useSpotifyPlayer();
  const isAutoPlayingRef = useRef(false);

  useEffect(() => {
    const handler = async (event: Event) => {
      const { trackUri } = (event as CustomEvent<{ trackUri: string }>).detail;
      if (!playingGroup || shares.length === 0) return;
      if (isAutoPlayingRef.current) return;

      const currentTrackId = trackUri.replace('spotify:track:', '');
      const currentIndex = shares.findIndex(s => s.spotifyTrackId === currentTrackId);

      if (currentIndex < 0) return;

      if (currentIndex < shares.length - 1) {
        const nextShare = shares[currentIndex + 1];
        const nextTrackUri = `spotify:track:${nextShare.spotifyTrackId}`;
        try {
          isAutoPlayingRef.current = true;
          await playTrack(nextTrackUri);
        } catch (err) {
          logger.error('Auto-play next track failed:', err);
          toast.error('Failed to auto-play next track');
        } finally {
          isAutoPlayingRef.current = false;
        }
      } else {
        toast.info('End of playlist reached');
      }
    };

    window.addEventListener('spotifyTrackComplete', handler);
    return () => window.removeEventListener('spotifyTrackComplete', handler);
  }, [playingGroup, shares, playTrack]);
}
