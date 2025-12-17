import { useState, useEffect, useMemo } from 'react';
import { Play, Pause, SkipForward, SkipBack, Loader2, Music, MonitorSpeaker, RefreshCw } from 'lucide-react';
import { Button } from '../../ui/button';
import { Skeleton } from '../../ui/skeleton';
import { Card, CardContent } from '../../ui/card';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../../ui/tooltip';
import { useSidebar } from '../../ui/sidebar';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { useSpotifyPlayer } from "../../../hooks/useSpotifyPlayer";
import { usePlayingGroup } from "../../../contexts/PlayingGroupContext";
import { usePlaylist } from "../../../hooks/usePlaylist";
import { Group, SpotifyDevice } from '../../../types';
import { toast } from 'sonner';
import { getSpotifyDevices, transferPlayback } from '../../../lib/api';

interface SpotifyPlayerCardProps {
  selectedGroup?: Group | null;
}

export default function SpotifyPlayerCard({ selectedGroup }: SpotifyPlayerCardProps) {
  const { player, currentTrack, isPlaying, isLoading, error, deviceId, playTrack } = useSpotifyPlayer();
  const { playingGroup, setPlayingGroup, sortBy: contextSortBy } = usePlayingGroup();
  const { shares: playlistShares } = usePlaylist(playingGroup?._id || '', contextSortBy);
  const { state: sidebarState, isMobile } = useSidebar();
  const [isDeviceRecentlyReady, setIsDeviceRecentlyReady] = useState(false);
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
      console.error('Failed to load Spotify devices:', err);
      toast.error('Failed to load Spotify devices');
    } finally {
      setIsDevicesLoading(false);
    }
  };

  const handleSelectDevice = async (nextDeviceId: string) => {
    if (!nextDeviceId) return;
    try {
      setIsSwitchingDevice(true);
      await transferPlayback(nextDeviceId);
      setSelectedOutputDeviceId(nextDeviceId);

      const selected = mergedDevices.find(d => d.id === nextDeviceId);
      toast.success(`Playback device set to ${selected?.name || 'selected device'}`);
    } catch (err) {
      console.error('Failed to transfer playback:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to switch playback device');
    } finally {
      setIsSwitchingDevice(false);
    }
  };

  // Calculate sidebar offset based on state
  // Expanded: 16rem (half = 8rem) | Collapsed: 4rem (half = 2rem) | Mobile: 0rem
  const sidebarOffset = isMobile 
    ? '0rem' 
    : sidebarState === 'expanded' 
      ? '8rem'  // Half of 16rem expanded width
      : '2rem'; // Half of 4rem collapsed width

  // Responsive positioning: centered with dynamic sidebar offset
  const playerStyle = {
    position: 'fixed' as const,
    bottom: '24px',
    left: `calc(50% + ${sidebarOffset})`,
    transform: 'translateX(-50%)',
    width: 'min(90%, 600px)',
    maxWidth: '600px',
    zIndex: 9999
  };

  // Also load the selected group's playlist to check if current track belongs to it
  const { shares: selectedGroupShares } = usePlaylist(selectedGroup?._id || '', contextSortBy);

  // Track when device becomes ready and show a brief "warming up" state
  useEffect(() => {
    if (deviceId && !isLoading) {
      setIsDeviceRecentlyReady(true);
      // Clear the flag after 10 seconds
      const timer = setTimeout(() => {
        setIsDeviceRecentlyReady(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [deviceId, isLoading]);

  // Load devices when the popover opens (and when SDK deviceId appears)
  useEffect(() => {
    if (!isDevicePopoverOpen) return;
    void loadDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDevicePopoverOpen, deviceId]);

  // Auto-detect playing group when track is playing and we're viewing a group
  useEffect(() => {
    if (currentTrack && selectedGroup && selectedGroupShares.length > 0) {
      // Check if current track belongs to the selected group
      const currentTrackId = currentTrack.uri?.replace('spotify:track:', '');
      if (currentTrackId) {
        // Check if track exists in the selected group's playlist
        const trackInGroup = selectedGroupShares.some(
          share => share.spotifyTrackId === currentTrackId
        );

        // If track is in the selected group, set it as playing group
        // This handles both initial load and when navigating between groups
        if (trackInGroup && playingGroup?._id !== selectedGroup._id) {
          setPlayingGroup(selectedGroup);
        }
      }
    }
  }, [currentTrack, selectedGroup, playingGroup, setPlayingGroup, selectedGroupShares]);
  const [isControlling, setIsControlling] = useState(false);

  const handlePlayPause = async () => {
    if (!player) return;

    try {
      setIsControlling(true);
      await player.togglePlay();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to control playback';
      console.error('Playback control error:', err);
      toast.error(errorMsg);
    } finally {
      setIsControlling(false);
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
    if (!player || !deviceId) {
      toast.error('Player is not ready');
      return;
    }

    // If we have a playing group and playlist, navigate through it
    if (playingGroup && playlistShares.length > 0) {
      try {
        setIsControlling(true);

        // Find next track index (loop to first if at end)
        const nextIndex = currentTrackIndex >= 0
          ? (currentTrackIndex + 1) % playlistShares.length
          : 0;

        const nextShare = playlistShares[nextIndex];
        const nextTrackUri = `spotify:track:${nextShare.spotifyTrackId}`;

        await playTrack(nextTrackUri);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to skip to next track';
        console.error('Next track error:', err);
        toast.error(errorMsg);
      } finally {
        setIsControlling(false);
      }
    } else {
      // Fallback to Spotify's native next track
      try {
        setIsControlling(true);
        await player.nextTrack();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to skip to next track';
        console.error('Next track error:', err);
        toast.error(errorMsg);
      } finally {
        setIsControlling(false);
      }
    }
  };

  const handlePreviousTrack = async () => {
    if (!player || !deviceId) {
      toast.error('Player is not ready');
      return;
    }

    // If we have a playing group and playlist, navigate through it
    if (playingGroup && playlistShares.length > 0) {
      try {
        setIsControlling(true);

        // Find previous track index (loop to last if at beginning)
        const prevIndex = currentTrackIndex > 0
          ? currentTrackIndex - 1
          : playlistShares.length - 1;

        const prevShare = playlistShares[prevIndex];
        const prevTrackUri = `spotify:track:${prevShare.spotifyTrackId}`;

        await playTrack(prevTrackUri);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to skip to previous track';
        console.error('Previous track error:', err);
        toast.error(errorMsg);
      } finally {
        setIsControlling(false);
      }
    } else {
      // Fallback to Spotify's native previous track
      try {
        setIsControlling(true);
        await player.previousTrack();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to skip to previous track';
        console.error('Previous track error:', err);
        toast.error(errorMsg);
      } finally {
        setIsControlling(false);
      }
    }
  };


  // Loading state
  if (isLoading) {
    return (
      <TooltipProvider>
        <div
          className="shadow-2xl"
          style={playerStyle}
          data-testid="spotify-player-loading"
        >
          <Card className="rounded-full border-white/10 shadow-xl backdrop-blur-xl bg-black/80" style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}>
            <CardContent className="px-6 py-2">
              <div className="flex items-center gap-4 h-16 overflow-hidden">
                <Skeleton className="size-12 rounded-lg shrink-0 bg-white/10" />
                <div className="flex-1 min-w-0 space-y-2">
                  <Skeleton className="h-4 w-32 bg-white/10" />
                  <Skeleton className="h-3 w-24 bg-white/10" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="size-10 rounded-full bg-white/10" />
                  <Skeleton className="size-10 rounded-full bg-white/10" />
                  <Skeleton className="size-10 rounded-full bg-white/10" />
                </div>
                <Skeleton className="w-24 h-1.5 hidden md:block bg-white/10 rounded-full" />
              </div>
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>
    );
  }

  // Error state
  if (error) {
    return (
      <TooltipProvider>
        <div
          className="shadow-2xl"
          style={playerStyle}
          data-testid="spotify-player-error"
        >
          <Card className="rounded-full border-destructive/30 shadow-xl backdrop-blur-xl bg-red-950/80" style={{ backgroundColor: 'rgba(127, 29, 29, 0.8)' }}>
            <CardContent className="px-6 py-2">
              <div className="flex items-center gap-4 h-16 overflow-hidden">
                <div className="size-12 rounded-lg bg-destructive/20 flex items-center justify-center shrink-0">
                  <Music className="size-6 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">Player Error</p>
                  <p className="text-xs text-white/70 truncate">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>
    );
  }

  // Empty state - no player or no track
  if (!player || !deviceId) {
    return (
      <TooltipProvider>
        <div
          className="shadow-2xl"
          style={playerStyle}
          data-testid="spotify-player-global"
        >
          <Card className="rounded-full border border-zinc-800 shadow-xl overflow-hidden backdrop-blur-xl bg-black/80" style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}>
            <CardContent className="px-6 py-2">
              <div className="flex items-center gap-4 h-16 overflow-hidden">
                <div className="size-12 rounded-lg bg-zinc-900/50 flex items-center justify-center shrink-0">
                  <Music className="size-6 text-zinc-500" />
                </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">
                  {isDeviceRecentlyReady ? 'Player Activating...' : 'No Player Connected'}
                </p>
                <p className="text-xs text-zinc-400 truncate">
                  {isDeviceRecentlyReady ? 'Wait 10 seconds before playing' : 'Connect to Spotify to start playing'}
                </p>
              </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </TooltipProvider>
    );
  }

  // No track playing state
  if (!currentTrack) {
    return (
      <TooltipProvider>
        <div
          className="shadow-2xl"
          style={playerStyle}
          data-testid="spotify-player-global"
        >
        <Card className="rounded-full border border-zinc-800 shadow-xl overflow-hidden backdrop-blur-xl bg-black/80" style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}>
          <CardContent className="px-6 py-2">
            <div className="flex items-center gap-4 h-16 overflow-hidden">
              <div className="size-12 rounded-lg bg-zinc-900/50 flex items-center justify-center shrink-0">
                <Music className="size-6 text-zinc-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">
                  {isDeviceRecentlyReady ? 'Player Activating...' : 'Ready to Play'}
                </p>
                <p className="text-xs text-zinc-400 truncate">
                  {isDeviceRecentlyReady ? 'Please wait 10 seconds...' : 'Click a track to start'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handlePreviousTrack}
                      disabled={isControlling}
                      className="h-10 w-10 rounded-full hover:bg-white/10 text-white"
                    >
                      <SkipBack className="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Previous Track</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handlePlayPause}
                      disabled={isControlling}
                      className="h-10 w-10 rounded-full !bg-white !text-black hover:!bg-white/90 hover:scale-105 transition-all"
                    >
                      {isControlling ? (
                        <Loader2 className="size-5 animate-spin" />
                      ) : (
                        <Play className="size-5 fill-current" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Play</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleNextTrack}
                      disabled={isControlling}
                      className="h-10 w-10 rounded-full hover:bg-white/10 text-white"
                    >
                      <SkipForward className="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Next Track</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </TooltipProvider>
    );
  }

  // Main player state - track is playing
  const albumImage = currentTrack.album.images?.[0]?.url || currentTrack.album.images?.[1]?.url;
  const artists = currentTrack.artists.map((artist) => artist.name).join(', ');

  // Main player
  return (
    <TooltipProvider>
      <div
        className="shadow-2xl"
        style={playerStyle}
        data-testid="spotify-player-global"
      >
      <Card className="rounded-full border border-zinc-800 shadow-2xl transition-colors overflow-hidden backdrop-blur-xl bg-black/80" style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}>
        <CardContent className="px-6 py-3">
          <div className="flex items-center gap-4 h-14">
            {/* Album Artwork */}
            <div className="h-10 w-10 shrink-0 rounded overflow-hidden relative bg-neutral-800/50">
              {albumImage ? (
                <img
                  src={albumImage}
                  alt={currentTrack.album.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <Music className="size-5 text-white/50" />
                </div>
              )}
            </div>

            {/* Track Info */}
            <div className="flex-1 min-w-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <h3 className="text-sm font-semibold text-white truncate cursor-default">
                    {currentTrack.name}
                  </h3>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{currentTrack.name}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-xs text-white/70 truncate cursor-default hover:text-white transition-colors">
                    {artists}
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{artists}</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Playback Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePreviousTrack}
                    disabled={isControlling}
                    className="h-10 w-10 rounded-full hover:bg-white/10 text-white"
                    aria-label="Previous track"
                  >
                    <SkipBack className="size-5 fill-current opacity-90" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Previous Track</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePlayPause}
                    disabled={isControlling}
                    className="h-12 w-12 rounded-full !bg-white !text-black hover:!bg-white/90 shadow-lg hover:scale-105 transition-all"
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isControlling ? (
                      <Loader2 className="size-6 animate-spin" />
                    ) : isPlaying ? (
                      <Pause className="size-6 fill-current" />
                    ) : (
                      <Play className="size-6 fill-current pl-0.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isPlaying ? 'Pause' : 'Play'}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleNextTrack}
                    disabled={isControlling}
                    className="h-10 w-10 rounded-full hover:bg-white/10 text-white"
                    aria-label="Next track"
                  >
                    <SkipForward className="size-5 fill-current opacity-90" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Next Track</p>
                </TooltipContent>
              </Tooltip>

              {/* Device Picker */}
              <Popover open={isDevicePopoverOpen} onOpenChange={setIsDevicePopoverOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-full hover:bg-white/10 text-white"
                        aria-label="Select playback device"
                      >
                        <MonitorSpeaker className="size-5 opacity-90" />
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{activeDevice ? `Device: ${activeDevice.name}` : 'Select playback device'}</p>
                  </TooltipContent>
                </Tooltip>

                <PopoverContent align="end" className="w-80">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Playback device</p>
                        <p className="text-xs text-muted-foreground truncate">
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
                        {isDevicesLoading ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <RefreshCw className="size-4" />
                        )}
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
                          .filter(d => !!d.id)
                          .map((d) => (
                            <SelectItem key={d.id as string} value={d.id as string}>
                              {d.name}{d.is_active ? ' (active)' : ''}
                            </SelectItem>
                          ))}
                        {mergedDevices.filter(d => !!d.id).length === 0 && (
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
            </div>

          </div>
        </CardContent>
      </Card>
      </div>
    </TooltipProvider>
  );
}

