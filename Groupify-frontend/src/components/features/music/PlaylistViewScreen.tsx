import { ArrowLeft, Play, Clock, Filter, TrendingUp, Loader2, ExternalLink } from "lucide-react";
import { Button } from "../../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../../ui/avatar";
import { Badge } from "../../ui/badge";
import { Card, CardContent } from "../../ui/card";
import { Skeleton } from "../../ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { Share } from "../../../types";
import { usePlaylist } from "../../../hooks/usePlaylist";
import { useSpotifyPlayer } from "../../../hooks/useSpotifyPlayer";
import { usePlayingGroup } from "../../../contexts/PlayingGroupContext";
import { exportGroupToPlaylist } from "../../../lib/api";
import { toast } from "sonner";
import { useState, useEffect, useMemo } from "react";
import { logger } from "../../../utils/logger";
import { useParams, useNavigate } from "react-router-dom";
import { useGroups } from "../../../hooks/useGroups";

// Format duration from milliseconds to MM:SS
const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export default function PlaylistViewScreen() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { groups } = useGroups();
  
  // Find the group from the groups list
  const group = useMemo(() => groups.find(g => g._id === groupId) || null, [groups, groupId]);
  
  const { shares, isLoading, error, sortBy, setSortBy, stats } = usePlaylist(groupId || '');
  const { playTrack, deviceId, isLoading: isPlayerLoading } = useSpotifyPlayer();
  const { setPlayingGroup, setSortBy: setContextSortBy } = usePlayingGroup();

  // Sync sortBy changes to context so player uses the same order
  useEffect(() => {
    if (group && sortBy) {
      setContextSortBy(sortBy);
    }
  }, [sortBy, group, setContextSortBy]);
  
  const [isExporting, setIsExporting] = useState(false);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);

  const handlePlayAll = async () => {
    if (shares.length === 0) {
      toast.error('No tracks to play');
      return;
    }

    // Check if player is available
    if (!deviceId || isPlayerLoading) {
      toast.error('Player is not ready. Please wait for the player to connect.');
      return;
    }

    // Play first track
    const firstTrack = shares[0];
    const trackUri = `spotify:track:${firstTrack.spotifyTrackId}`;

    try {
      setIsPlaying(firstTrack._id);
      // Set the playing group so next/previous buttons work
      if (group) {
        setPlayingGroup(group);
      }
      await playTrack(trackUri);
    } catch (err) {
      // Error already handled in playTrack with toast
      logger.error('Failed to play track:', err);
    } finally {
      setIsPlaying(null);
    }
  };

  const handleExportToSpotify = async () => {
    if (!groupId) return;

    if (shares.length === 0) {
      toast.error('No tracks to export');
      return;
    }

    try {
      setIsExporting(true);
      const playlist = await exportGroupToPlaylist(
        groupId,
        `${group?.name || 'Group'} - Groupify Playlist`,
        false
      );

      logger.info('Playlist exported to Spotify:', { groupId, playlistId: playlist.id });
      toast.success('Playlist exported to Spotify!');

      // Open the playlist in Spotify
      if (playlist.external_urls?.spotify) {
        window.open(playlist.external_urls.spotify, '_blank');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export playlist';
      toast.error(errorMessage);
      logger.error('Failed to export playlist:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleTrackClick = async (share: Share) => {
    // Check if player is available
    if (!deviceId || isPlayerLoading) {
      toast.error('Player is not ready. Please wait for the player to connect.');
      return;
    }

    // Convert spotifyTrackId to track URI
    const trackUri = `spotify:track:${share.spotifyTrackId}`;

    try {
      setIsPlaying(share._id);
      // Set the playing group so next/previous buttons work
      if (group) {
        setPlayingGroup(group);
      }
      await playTrack(trackUri);
    } catch (err) {
      // Error already handled in playTrack with toast
      logger.error('Failed to play track:', err);
    } finally {
      setIsPlaying(null);
    }
  };

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-10 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-4 md:px-6 py-4">
            <div className="flex items-center gap-2 md:gap-4 flex-wrap">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/groups/${groupId}`)}
                className="hover:bg-primary/10 shrink-0"
                aria-label="Back to group feed"
              >
                <ArrowLeft className="w-5 h-5" aria-hidden="true" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1 className="truncate">Group Playlist</h1>
                <p className="text-sm text-muted-foreground truncate">
                  {group?.name || "Playlist"} • {stats.totalTracks} tracks
                </p>
              </div>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                <SelectTrigger className="w-32 sm:w-48 border-primary/30 shrink-0" aria-label="Sort playlist">
                  <Filter className="w-4 h-4 mr-2" aria-hidden="true" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="most-listened">Most Listened</SelectItem>
                  <SelectItem value="recently-added">Recently Added</SelectItem>
                  <SelectItem value="alphabetical">Alphabetical</SelectItem>
                  <SelectItem value="shared-by">Shared By</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                className="border-primary/30 hover:bg-primary/10 shrink-0"
                onClick={() => navigate(`/groups/${groupId}/analytics`)}
                aria-label="View group analytics"
              >
                <TrendingUp className="w-4 h-4" aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                className="border-primary/30 hover:bg-primary/10 shrink-0"
                onClick={handleExportToSpotify}
                disabled={isExporting || shares.length === 0}
                aria-label="Export playlist to Spotify"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                    <span className="hidden md:inline">Exporting...</span>
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4 mr-2" aria-hidden="true" />
                    <span className="hidden md:inline">Export</span>
                  </>
                )}
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90 text-black shrink-0"
                onClick={handlePlayAll}
                disabled={shares.length === 0 || !deviceId || isPlayerLoading || isPlaying !== null}
                aria-label="Play all tracks in playlist"
              >
                {isPlaying ? (
                  <>
                    <Loader2 className="w-4 h-4 md:mr-2 animate-spin" aria-hidden="true" />
                    <span className="hidden md:inline">Playing...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current md:mr-2" aria-hidden="true" />
                    <span className="hidden md:inline">Play All</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </header>

        {/* Playlist Hero */}
        <section className="relative px-4 md:px-6 pt-6 md:pt-8 pb-4 md:pb-6 bg-gradient-to-b from-primary/5 to-background" aria-labelledby="playlist-title">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 md:gap-6 max-w-6xl">
            <div className="relative flex-shrink-0" aria-hidden="true">
              <div className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center">
                <Play className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 text-primary" />
              </div>
            </div>
            <div className="flex-1 min-w-0 pb-0 sm:pb-2">
              <Badge className="mb-2 md:mb-3 bg-primary/10 text-primary border-primary/30 text-xs" aria-label="Playlist type">
                Group Playlist
              </Badge>
              <h2 id="playlist-title" className="text-2xl sm:text-3xl md:text-4xl mb-2 md:mb-3 truncate">{group?.name || "Group Playlist"}</h2>
              <p className="text-sm md:text-base text-muted-foreground mb-3 md:mb-4 line-clamp-2">
                {group?.description || "Collaborative playlist"}
              </p>
              <div className="flex items-center gap-2 md:gap-4 text-xs sm:text-sm flex-wrap">
                <span className="text-primary whitespace-nowrap">{group?.members?.length || 0} members</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground whitespace-nowrap">
                  {stats.totalTracks} songs
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground whitespace-nowrap">{stats.totalDurationFormatted}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content */}
        <main className="p-4 md:p-6">
          {/* Error State */}
          {error && (
            <Card className="border-destructive mb-6">
              <CardContent className="p-6">
                <p className="text-destructive">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="w-10 md:w-12">#</TableHead>
                    <TableHead className="min-w-[200px]">Title</TableHead>
                    <TableHead className="hidden md:table-cell min-w-[150px]">Album</TableHead>
                    <TableHead className="hidden lg:table-cell min-w-[150px]">Shared By</TableHead>
                    <TableHead className="hidden sm:table-cell w-16">Plays</TableHead>
                    <TableHead className="w-16 md:w-20 text-right">
                      <Clock className="w-4 h-4 ml-auto" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <TableRow key={i} className="border-border">
                      <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-3 w-24" />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Skeleton className="h-4 w-20" />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Skeleton className="h-4 w-8" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-12 ml-auto" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Playlist Table */}
          {!isLoading && shares.length > 0 && (
            <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="w-10 md:w-12" aria-label="Track number">#</TableHead>
                    <TableHead className="min-w-[200px]">Title</TableHead>
                    <TableHead className="hidden md:table-cell min-w-[150px]">Album</TableHead>
                    <TableHead className="hidden lg:table-cell min-w-[150px]">Shared By</TableHead>
                    <TableHead className="hidden sm:table-cell w-16">Plays</TableHead>
                    <TableHead className="w-16 md:w-20 text-right">
                      <Clock className="w-4 h-4 ml-auto" aria-label="Duration" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shares.map((share, index) => {
                    const isTopTrack = share.listenCount > 0 && share.listenCount >= Math.max(...shares.map(s => s.listenCount)) * 0.8;
                    return (
                      <TableRow
                        key={share._id}
                        className="group cursor-pointer hover:bg-primary/5 border-border"
                        onClick={() => handleTrackClick(share)}
                      >
                        <TableCell>
                          <button
                            className="flex items-center justify-center w-full h-full disabled:opacity-50"
                            aria-label={`Play ${share.trackName} by ${share.artistName}`}
                            disabled={!deviceId || isPlayerLoading || isPlaying === share._id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTrackClick(share);
                            }}
                          >
                            {isPlaying === share._id ? (
                              <Loader2 className="w-4 h-4 text-primary animate-spin" aria-hidden="true" />
                            ) : (
                              <>
                                <span className="group-hover:hidden text-sm">{index + 1}</span>
                                <Play className="w-4 h-4 hidden group-hover:block text-primary fill-current" aria-hidden="true" />
                              </>
                            )}
                          </button>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 min-w-0">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="truncate text-sm md:text-base">{share.trackName}</span>
                                {isTopTrack && (
                                  <TrendingUp className="w-3 h-3 text-primary shrink-0" aria-label="Top track" />
                                )}
                              </div>
                              <p className="text-xs md:text-sm text-muted-foreground truncate">
                                {share.artistName}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                          <span className="truncate block">{share.albumName}</span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar className="w-6 h-6 border border-primary/30 shrink-0">
                              <AvatarImage src={share.sharedBy.profileImage || undefined} alt={`${share.sharedBy.displayName}'s avatar`} />
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {share.sharedBy.displayName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm truncate">{share.sharedBy.displayName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                          {share.listenCount}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground text-sm whitespace-nowrap">
                          {formatDuration(share.durationMs || 0)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && shares.length === 0 && !error && (
            <Card className="border-dashed border-2 border-border">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="bg-primary/10 border border-primary/30 p-4 rounded-full mb-4" aria-hidden="true">
                  <Play className="w-8 h-8 text-primary" />
                </div>
                <h3 className="mb-2">No Tracks Yet</h3>
                <p className="text-muted-foreground mb-4 max-w-md">
                  Start sharing tracks in the group feed to build your playlist!
                </p>
                <Button
                  variant="outline"
                  onClick={() => navigate(`/groups/${groupId}`)}
                  className="border-primary/30 hover:bg-primary/10"
                >
                  Go to Group Feed
                </Button>
              </CardContent>
            </Card>
          )}
        </main>
    </>
  );
}
