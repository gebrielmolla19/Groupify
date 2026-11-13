import { useState, useEffect, useMemo } from 'react';
import { Play, Pause, SkipForward, SkipBack, Loader2, Music, MonitorSpeaker, RefreshCw } from 'lucide-react';
import { Button } from '../../ui/button';
import { useSidebar } from '../../ui/sidebar';
import { cn } from '../../../lib/utils';
import { STACK_GAP, TAB_BAR_HEIGHT } from '../../../lib/layout';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { useSpotifyPlayer, wasPlaybackErrorNotified } from "../../../hooks/useSpotifyPlayer";
import { useCurrentPlayback } from "../../../hooks/useCurrentPlayback";
import { usePlayingGroup } from "../../../contexts/PlayingGroupContext";
import { usePlaylist } from "../../../hooks/usePlaylist";
import { SpotifyDevice } from '../../../types';
import { toast } from 'sonner';
import { getSpotifyDevices, transferPlayback, pausePlayback as apiPausePlayback, resumePlayback as apiResumePlayback, skipToNext as apiSkipToNext, skipToPrevious as apiSkipToPrevious, seekPlayback as apiSeekPlayback } from '../../../lib/api';
import PlaybackScrubber from './PlaybackScrubber';
import { logger } from '../../../utils/logger';
import { useLocation } from 'react-router-dom';
import { groupIdFromPath } from '../../../hooks/useLastGroup';
import { useGroups } from '../../../hooks/useGroups';

export default function SpotifyPlayerCard() {
  // Rendered by the app layout, outside the routes, so read the group from the path.
  const groupId = groupIdFromPath(useLocation().pathname);
  const { groups } = useGroups();
  const { player, currentTrack, isPlaying, position, duration, isLoading, error, deviceId, deviceReadyTimestamp, playTrack } = useSpotifyPlayer();
  const { playingGroup, setPlayingGroup, sortBy: contextSortBy } = usePlayingGroup();
  const { shares: playlistShares } = usePlaylist(playingGroup?._id || '', contextSortBy);
  const { isMobile } = useSidebar();
  
  // Find the group currently being viewed
  const viewedGroup = useMemo(() => groups.find(g => g._id === groupId) || null, [groups, groupId]);

  // Poll for playback on other devices (only if Web SDK player isn't showing a track)
  // This lets us detect when user plays on phone/desktop app
  const { playback: remotePlayback } = useCurrentPlayback(
    !currentTrack && !!deviceId, // Only poll if web player isn't active
    3000 // Poll every 3 seconds
  );
  
  // Determine which track/device to show: Web SDK takes priority, fallback to remote playback
  const displayTrack = currentTrack || (remotePlayback?.item ? {
    uri: `spotify:track:${remotePlayback.item.id}`,
    id: remotePlayback.item.id,
    name: remotePlayback.item.name,
    artists: remotePlayback.item.artists.map(a => ({ name: a.name, uri: `spotify:artist:${a.id}` })),
    album: {
      name: remotePlayback.item.album.name,
      uri: `spotify:album:${remotePlayback.item.album.images[0]?.url || ''}`,
      images: remotePlayback.item.album.images.map(img => ({
        url: img.url,
        height: img.height,
        width: img.width
      }))
    }
  } : null);
  
  const displayIsPlaying = currentTrack ? isPlaying : (remotePlayback?.is_playing ?? false);
  // Progress for the scrubber: the in-browser player when it has a track,
  // otherwise whatever Spotify reports for the remote device.
  const displayPosition = currentTrack ? position : (remotePlayback?.progress_ms ?? 0);
  const displayDuration = currentTrack ? duration : (remotePlayback?.item?.duration_ms ?? 0);
  const activeDeviceName = remotePlayback?.device?.name || (deviceId ? 'Groupify Web Player' : null);
  
  // Check if device was recently initialized (within last 10 seconds)
  // This persists across component remounts since deviceReadyTimestamp is module-level
  const isDeviceRecentlyReady = useMemo(() => {
    if (!deviceReadyTimestamp || !deviceId) return false;
    const timeSinceReady = Date.now() - deviceReadyTimestamp;
    return timeSinceReady < 10000; // 10 seconds
  }, [deviceReadyTimestamp, deviceId]);
  const [isDevicePopoverOpen, setIsDevicePopoverOpen] = useState(false);
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [isDevicesLoading, setIsDevicesLoading] = useState(false);
  const [isSwitchingDevice, setIsSwitchingDevice] = useState(false);
  const [selectedOutputDeviceId, setSelectedOutputDeviceId] = useState<string>('');

  const mergedDevices = useMemo(() => {
    const normalized = (devices || []).filter((d): d is SpotifyDevice => !!d && typeof d.name === 'string');

    // Include the Web Playback SDK device (from the SDK "ready" event) even if Spotify hasn't
    // surfaced it in /me/player/devices yet.
    const hasSdkDeviceInList = !!deviceId && normalized.some(d => d.id === deviceId);
    const withSdkDevice = !hasSdkDeviceInList && deviceId
      ? [
          {
            id: deviceId,
            name: 'Groupify Web Player (Browser)',
            type: 'Web Playback SDK',
            is_active: false,
            is_private_session: false,
            is_restricted: false,
            volume_percent: null,
          } satisfies SpotifyDevice,
          ...normalized,
        ]
      : normalized;

    return withSdkDevice;
  }, [devices, deviceId]);

  const activeDevice = useMemo(() => mergedDevices.find(d => d.is_active), [mergedDevices]);

  const loadDevices = async () => {
    try {
      setIsDevicesLoading(true);
      const list = await getSpotifyDevices();
      setDevices(list);

      // Default selection: active device, else keep existing, else SDK device if present
      setSelectedOutputDeviceId(prev => {
        if (prev) return prev;
        if (list?.some(d => d.is_active && d.id)) return list.find(d => d.is_active && d.id)?.id || '';
        if (deviceId) return deviceId;
        return '';
      });
    } catch (err) {
      logger.error('Failed to load Spotify devices:', err);
      toast.error('Failed to load Spotify devices');
    } finally {
      setIsDevicesLoading(false);
    }
  };

  const handleSelectDevice = async (nextDeviceId: string) => {
    if (!nextDeviceId) return;
    try {
      setIsSwitchingDevice(true);
      
      // Check if something is currently playing (from Web SDK or remote device)
      const shouldResume = isPlaying || (remotePlayback?.is_playing ?? false);
      
      // Transfer playback and resume if something was playing
      await transferPlayback(nextDeviceId, shouldResume);
      setSelectedOutputDeviceId(nextDeviceId);

      const selected = mergedDevices.find(d => d.id === nextDeviceId);
      const message = shouldResume 
        ? `Playback transferred to ${selected?.name || 'selected device'} and resumed`
        : `Playback device set to ${selected?.name || 'selected device'}`;
      toast.success(message);
    } catch (err) {
      logger.error('Failed to transfer playback:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to switch playback device');
    } finally {
      setIsSwitchingDevice(false);
    }
  };

  // Also load the viewed group's playlist to check if current track belongs to it
  const { shares: viewedGroupShares } = usePlaylist(viewedGroup?._id || '', contextSortBy);

  // Load devices when the popover opens (and when SDK deviceId appears)
  useEffect(() => {
    if (!isDevicePopoverOpen) return;
    void loadDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDevicePopoverOpen, deviceId]);

  // Auto-detect playing group when track is playing and we're viewing a group
  useEffect(() => {
    if (currentTrack && viewedGroup && viewedGroupShares.length > 0) {
      // Check if current track belongs to the viewed group
      const currentTrackId = currentTrack.uri?.replace('spotify:track:', '');
      if (currentTrackId) {
        // Check if track exists in the viewed group's playlist
        const trackInGroup = viewedGroupShares.some(
          share => share.spotifyTrackId === currentTrackId
        );

        // If track is in the viewed group, set it as playing group
        // This handles both initial load and when navigating between groups
        if (trackInGroup && playingGroup?._id !== viewedGroup._id) {
          setPlayingGroup(viewedGroup);
        }
      }
    }
  }, [currentTrack, viewedGroup, playingGroup, setPlayingGroup, viewedGroupShares]);
  const [isControlling, setIsControlling] = useState(false);

  const handlePlayPause = async () => {
    try {
      setIsControlling(true);
      const isRemote = !currentTrack && !!remotePlayback;
      if (isRemote) {
        const remoteDeviceId = remotePlayback?.device?.id || undefined;
        if (displayIsPlaying) {
          await apiPausePlayback(remoteDeviceId);
        } else {
          await apiResumePlayback(remoteDeviceId);
        }
      } else if (player) {
        // Unlock audio inside this tap (required after the browser blocks
        // autoplay, e.g. on iOS) before resuming.
        player.activateElement().catch(() => {});
        await player.togglePlay();
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to control playback';
      logger.error('Playback control error:', err);
      toast.error(errorMsg);
    } finally {
      setIsControlling(false);
    }
  };

  const handleSeek = async (positionMs: number) => {
    const isRemote = !currentTrack && !!remotePlayback;
    try {
      if (isRemote) {
        await apiSeekPlayback(positionMs, remotePlayback?.device?.id || undefined);
      } else if (player) {
        await player.seek(positionMs);
      }
    } catch (err) {
      logger.error('Seek error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to seek');
    }
  };

  // Find current track's position in the sorted playlist
  const currentTrackIndex = useMemo(() => {
    if (!currentTrack || !playingGroup || playlistShares.length === 0) {
      return -1;
    }

    // Extract track ID from URI (spotify:track:xxx)
    const currentTrackId = currentTrack.uri?.replace('spotify:track:', '');
    if (!currentTrackId) return -1;

    // Find the index of the current track in the sorted playlist
    return playlistShares.findIndex(share => share.spotifyTrackId === currentTrackId);
  }, [currentTrack, playingGroup, playlistShares]);

  const handleNextTrack = async () => {
    const isRemote = !currentTrack && !!remotePlayback;

    // If we have a playing group and playlist, navigate through it
    if (playingGroup && playlistShares.length > 0) {
      try {
        setIsControlling(true);
        // Pause immediately so the current song doesn't bleed through during the API round-trip
        if (player && isPlaying) player.pause().catch(() => {});
        const nextIndex = currentTrackIndex >= 0
          ? (currentTrackIndex + 1) % playlistShares.length
          : 0;
        const nextShare = playlistShares[nextIndex];
        const nextTrackUri = `spotify:track:${nextShare.spotifyTrackId}`;
        logger.info('Next track:', { nextIndex, total: playlistShares.length, trackName: nextShare.trackName });
        await playTrack(nextTrackUri);
      } catch (err) {
        logger.error('Next track error:', err);
        // playTrack already showed a toast (and is reconnecting) when the
        // device is gone — don't stack a second one or resume a dead device.
        if (!wasPlaybackErrorNotified(err)) {
          toast.error(err instanceof Error ? err.message : 'Failed to skip to next track');
          // Try to resume if play failed so user isn't left in silence
          if (player) player.resume().catch(() => {});
        }
      } finally {
        setIsControlling(false);
      }
    } else if (isRemote) {
      try {
        setIsControlling(true);
        await apiSkipToNext(remotePlayback?.device?.id || undefined);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to skip to next track';
        logger.error('Next track error:', err);
        toast.error(errorMsg);
      } finally {
        setIsControlling(false);
      }
    } else if (player) {
      try {
        setIsControlling(true);
        await player.nextTrack();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to skip to next track';
        logger.error('Next track error:', err);
        toast.error(errorMsg);
      } finally {
        setIsControlling(false);
      }
    }
  };

  const handlePreviousTrack = async () => {
    const isRemote = !currentTrack && !!remotePlayback;

    // If we have a playing group and playlist, navigate through it
    if (playingGroup && playlistShares.length > 0) {
      try {
        setIsControlling(true);
        // Pause immediately so the current song doesn't bleed through during the API round-trip
        if (player && isPlaying) player.pause().catch(() => {});
        const prevIndex = currentTrackIndex > 0
          ? currentTrackIndex - 1
          : playlistShares.length - 1;
        const prevShare = playlistShares[prevIndex];
        const prevTrackUri = `spotify:track:${prevShare.spotifyTrackId}`;
        logger.info('Previous track:', { prevIndex, total: playlistShares.length, trackName: prevShare.trackName });
        await playTrack(prevTrackUri);
      } catch (err) {
        logger.error('Previous track error:', err);
        // playTrack already showed a toast (and is reconnecting) when the
        // device is gone — don't stack a second one or resume a dead device.
        if (!wasPlaybackErrorNotified(err)) {
          toast.error(err instanceof Error ? err.message : 'Failed to skip to previous track');
          // Try to resume if play failed so user isn't left in silence
          if (player) player.resume().catch(() => {});
        }
      } finally {
        setIsControlling(false);
      }
    } else if (isRemote) {
      try {
        setIsControlling(true);
        await apiSkipToPrevious(remotePlayback?.device?.id || undefined);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to skip to previous track';
        logger.error('Previous track error:', err);
        toast.error(errorMsg);
      } finally {
        setIsControlling(false);
      }
    } else if (player) {
      try {
        setIsControlling(true);
        await player.previousTrack();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to skip to previous track';
        logger.error('Previous track error:', err);
        toast.error(errorMsg);
      } finally {
        setIsControlling(false);
      }
    }
  };


  // What the player can show right now. Without a track, the bar shows a
  // status line instead of the song.
  const controlsReady = !isLoading && !error && !!player && !!deviceId;
  const status = isLoading
    ? { title: 'Connecting to Spotify…', detail: '' }
    : error
      ? { title: 'Player error', detail: error }
      : !player || !deviceId
        ? isDeviceRecentlyReady
          ? { title: 'Player activating…', detail: 'Wait a few seconds before playing' }
          : { title: 'No player connected', detail: 'Connect to Spotify to start playing' }
        : !displayTrack
          ? isDeviceRecentlyReady
            ? { title: 'Player activating…', detail: 'Wait a few seconds before playing' }
            : { title: 'Ready to play', detail: activeDeviceName ? `Playing on ${activeDeviceName}` : 'Choose a song to start' }
          : null;

  const albumImage = displayTrack?.album.images?.[0]?.url || displayTrack?.album.images?.[1]?.url;
  const artists = displayTrack?.artists.map((artist) => artist.name).join(', ') ?? '';
  const isRemotePlayback = !currentTrack && !!remotePlayback;
  const title = displayTrack?.name ?? status?.title ?? '';
  const subtitle = displayTrack ? artists : status?.detail ?? '';
  const where = isRemotePlayback && activeDeviceName ? `Playing on ${activeDeviceName}` : 'Playing in this browser';
  const busy = isControlling || !controlsReady;

  const art = (size: string) => (
    <span className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-sm bg-selected', size)}>
      {albumImage ? (
        <img src={albumImage} alt="" className="size-full object-cover" />
      ) : isLoading ? (
        <Loader2 className="size-5 animate-spin text-quiet" aria-hidden="true" />
      ) : (
        <Music className={cn('size-5', error ? 'text-danger' : 'text-quiet')} aria-hidden="true" />
      )}
    </span>
  );
  const text = (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className={cn('truncate text-sm font-semibold', error && !displayTrack && 'text-danger')}>{title}</span>
      {subtitle && <span className="truncate text-xs text-soft">{subtitle}</span>}
    </span>
  );
  const playButton = (size: string) => (
    <button
      type="button"
      onClick={handlePlayPause}
      disabled={busy}
      aria-label={displayIsPlaying ? 'Pause' : 'Play'}
      className={cn('flex shrink-0 items-center justify-center rounded-full bg-foreground text-pane transition-opacity hover:opacity-90 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', size)}
    >
      {isControlling ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : displayIsPlaying ? (
        <Pause className="size-4 fill-current" aria-hidden="true" />
      ) : (
        <Play className="size-4 translate-x-px fill-current" aria-hidden="true" />
      )}
    </button>
  );
  const skipButton = (direction: 'previous' | 'next', className = '') => (
    <button
      type="button"
      onClick={direction === 'next' ? handleNextTrack : handlePreviousTrack}
      disabled={busy}
      aria-label={direction === 'next' ? 'Next track' : 'Previous track'}
      className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-foreground hover:bg-selected disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
    >
      {direction === 'next' ? <SkipForward className="size-[18px] fill-current" aria-hidden="true" /> : <SkipBack className="size-[18px] fill-current" aria-hidden="true" />}
    </button>
  );

  const devicePicker = (
    <Popover open={isDevicePopoverOpen} onOpenChange={setIsDevicePopoverOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={!controlsReady}
          aria-label={activeDevice ? `Playback device: ${activeDevice.name}` : 'Select playback device'}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] text-soft hover:bg-selected hover:text-foreground disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MonitorSpeaker className="size-5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-[calc(100vw-2rem)] sm:w-80">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">Playback device</p>
              <p className="truncate text-xs text-muted-foreground">
                {activeDevice ? `Active: ${activeDevice.name}` : 'Choose where Spotify plays'}
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={() => void loadDevices()}
              disabled={isDevicesLoading || isSwitchingDevice}
              aria-label="Refresh devices"
            >
              {isDevicesLoading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            </Button>
          </div>
          <Select
            value={selectedOutputDeviceId}
            onValueChange={(val) => void handleSelectDevice(val)}
            disabled={isDevicesLoading || isSwitchingDevice}
          >
            <SelectTrigger aria-label="Select Spotify playback device">
              <SelectValue placeholder={isDevicesLoading ? 'Loading devices…' : 'Select a device'} />
            </SelectTrigger>
            <SelectContent>
              {mergedDevices
                .filter((d) => !!d.id)
                .map((d) => (
                  <SelectItem key={d.id as string} value={d.id as string}>
                    {d.name}{d.is_active ? ' (active)' : ''}
                  </SelectItem>
                ))}
              {mergedDevices.filter((d) => !!d.id).length === 0 && (
                <SelectItem value="__none" disabled>
                  No devices found
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Tip: if your device isn’t listed, open Spotify on that device and play any song once.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );

  // Phone: a mini player above the tab bar. Previous and seeking move to the
  // song sheet in #57 slice 4; a thin line shows progress meanwhile.
  if (isMobile) {
    const progress = displayDuration > 0 ? Math.min(100, (displayPosition / displayDuration) * 100) : 0;
    return (
      <section
        aria-label="Player"
        data-testid="spotify-player"
        className="fixed inset-x-2 z-30 flex items-center gap-2.5 overflow-hidden rounded-[14px] bg-selected py-2 pl-2 pr-1.5"
        style={{ bottom: `calc(${TAB_BAR_HEIGHT + STACK_GAP}px + env(safe-area-inset-bottom, 0px))` }}
      >
        {art('size-10')}
        <span className="min-w-0 flex-1">{text}</span>
        {devicePicker}
        {playButton('size-11')}
        {skipButton('next')}
        {displayTrack && (
          <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-0.5 overflow-hidden rounded-full bg-hair">
            <span className="block h-full bg-iris" style={{ width: `${progress}%` }} />
          </span>
        )}
      </section>
    );
  }

  // Desktop: a full-width bar under the panes.
  return (
    <footer
      aria-label="Player"
      data-testid="spotify-player"
      className="grid h-[76px] shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] items-center gap-6 px-5"
    >
      <div className="flex min-w-0 items-center gap-3">
        {art('size-12')}
        {text}
      </div>
      <div className="flex min-w-0 flex-col items-center gap-1">
        <div className="flex items-center gap-2">
          {/* Compact for a mouse; 44px on touch screens (CONTRIBUTING §2.4). */}
          {skipButton('previous', 'h-9 pointer-coarse:h-11')}
          {playButton('size-10 pointer-coarse:size-11')}
          {skipButton('next', 'h-9 pointer-coarse:h-11')}
        </div>
        {displayTrack && (
          <PlaybackScrubber
            className="max-w-[560px]"
            position={displayPosition}
            duration={displayDuration}
            isPlaying={displayIsPlaying}
            trackKey={displayTrack.uri}
            onSeek={handleSeek}
            disabled={isControlling}
          />
        )}
      </div>
      <div className="flex min-w-0 items-center justify-end gap-2 text-xs text-soft">
        {displayTrack && (
          <>
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-iris" />
            <span className="truncate">{where}</span>
          </>
        )}
        {devicePicker}
      </div>
    </footer>
  );
}
