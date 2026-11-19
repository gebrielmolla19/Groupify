import { ArrowLeft, Play, TrendingUp, Loader2, ExternalLink, Plus, ListMusic } from "lucide-react";
import { Button } from "../../ui/button";
import { Skeleton } from "../../ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "../../ui/toggle-group";
import { Share, Group } from "../../../types";
import { usePlaylist, type SortOption } from "../../../hooks/usePlaylist";
import { useSpotifyPlayer } from "../../../hooks/useSpotifyPlayer";
import { usePlayingGroup } from "../../../contexts/PlayingGroupContext";
import { exportGroupToPlaylist, followGroupPlaylist } from "../../../lib/api";
import { useUser } from "../../../contexts/UserContext";
import { toast } from "sonner";
import { isSpotifyReauthError } from "../../../lib/apiError";
import { useState, useEffect, useMemo } from "react";
import { logger } from "../../../utils/logger";
import { useParams, useNavigate } from "react-router-dom";
import { useGroups } from "../../../hooks/useGroups";
import GroupCover from "../groups/GroupCover";
import PlaylistRow from "./PlaylistRow";

const SORTS: { value: SortOption; label: string }[] = [
  { value: "most-listened", label: "Most listened" },
  { value: "recently-added", label: "Newest" },
  { value: "alphabetical", label: "A–Z" },
  { value: "shared-by", label: "Shared by" },
];

export default function PlaylistViewScreen() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { groups, refetch: refetchGroups, setGroups } = useGroups();
  const { user } = useUser();
  
  // Find the group from the groups list
  const group = useMemo(() => groups.find(g => g._id === groupId) || null, [groups, groupId]);
  
  // Check if group has a collaborative playlist
  const hasCollaborativePlaylist = useMemo(() => !!group?.spotifyPlaylistId, [group]);
  
  // Check if current user is the playlist owner
  // If no playlist exists yet, any group member can create it
  const isPlaylistOwner = useMemo(() => {
    if (!user || !group) return false;
    
    // If no playlist exists, user can create it (they'll become the owner)
    if (!group.spotifyPlaylistId) return true;
    
    // If playlist exists, check if user is the owner
    if (!group.spotifyPlaylistOwnerId) return false;
    return group.spotifyPlaylistOwnerId === user._id || group.spotifyPlaylistOwnerId === user.id;
  }, [group, user]);
  
  const { shares, isLoading, error, sortBy, setSortBy, stats, refetch } = usePlaylist(groupId || '');
  const { playTrack, deviceId, isLoading: isPlayerLoading } = useSpotifyPlayer();
  const { setPlayingGroup, setSortBy: setContextSortBy } = usePlayingGroup();

  // Sync sortBy changes to context so player uses the same order
  useEffect(() => {
    if (group && sortBy) {
      setContextSortBy(sortBy);
    }
  }, [sortBy, group, setContextSortBy]);
  
  const [isExporting, setIsExporting] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
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
      
      // Remember if we had a playlist before (to detect recreation)
      const hadPlaylistBefore = hasCollaborativePlaylist;
      
      const result = await exportGroupToPlaylist(
        groupId,
        `${group?.name || 'Group'} - Groupify Collaborative Playlist`
      );

      logger.info('Playlist exported to Spotify:', { 
        groupId, 
        playlistId: result.playlistId,
        isNewPlaylist: result.isNewPlaylist,
        hadPlaylistBefore
      });

      // Show appropriate success message
      if (result.canModify === false) {
        // User doesn't have permission to modify the playlist
        toast.info('Playlist opened in Spotify', {
          description: 'Only the playlist creator can update tracks via Groupify. You can add tracks directly in Spotify.'
        });
      } else if (result.replacedPlaylist) {
        toast.success('Created a new playlist', {
          description: "Spotify wouldn't let Groupify update the old one. Members who followed it need to follow the new one.",
        });
      } else if (result.isNewPlaylist) {
        // If we had a playlist before but got isNewPlaylist = true, it was recreated
        if (hadPlaylistBefore) {
          toast.success('Playlist recreated successfully! (Previous playlist was deleted on Spotify)', {
            description: 'All group members will be re-invited to collaborate.'
          });
        } else {
          toast.success('Collaborative playlist created successfully!');
        }
      } else {
        toast.success('Collaborative playlist updated successfully!');
      }

      // Update local group state immediately with playlist info (optimistic update)
      if (group && result.playlistId && setGroups) {
        const updatedGroup: Group = {
          ...group,
          spotifyPlaylistId: result.playlistId,
          spotifyPlaylistUrl: result.playlistUrl || undefined,
          spotifyPlaylistOwnerId: user?._id || user?.id
        };
        setGroups(prevGroups => 
          prevGroups.map(g => g._id === groupId ? updatedGroup : g)
        );
      }
      
      // Refresh groups to get updated playlist ID and owner from server
      await refetchGroups();

      // Open the playlist in Spotify
      if (result.playlistUrl) {
        window.open(result.playlistUrl, '_blank');
      } else if (result.playlist.external_urls?.spotify) {
        window.open(result.playlist.external_urls.spotify, '_blank');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to export playlist';
      // UserContext already told the user to sign in with Spotify again.
      if (!isSpotifyReauthError(err)) toast.error(errorMessage);
      logger.error('Failed to export playlist:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFollowPlaylist = async () => {
    if (!groupId) return;

    try {
      setIsFollowing(true);
      
      const result = await followGroupPlaylist(groupId);

      logger.info('Playlist followed:', { 
        groupId, 
        playlistId: result.playlistId
      });

      toast.success('Successfully followed the collaborative playlist!', {
        description: 'You can now add tracks directly in Spotify.'
      });

      // Open the playlist in Spotify
      if (result.playlistUrl) {
        window.open(result.playlistUrl, '_blank');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to follow playlist';
      // UserContext already told the user to sign in with Spotify again.
      if (!isSpotifyReauthError(err)) toast.error(errorMessage);
      logger.error('Failed to follow playlist:', err);
    } finally {
      setIsFollowing(false);
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

  const sharerCount = new Set(shares.map((s) => s.sharedBy._id)).size;
  const summary = `${stats.totalTracks} ${stats.totalTracks === 1 ? "track" : "tracks"} from ${sharerCount} ${sharerCount === 1 ? "member" : "members"}, ${stats.totalDurationFormatted} to play through.`;
  const showList = !isLoading && !error && shares.length > 0;

  return (
    <main className="@container mx-auto w-full max-w-5xl space-y-6 md:space-y-8">
      <header className="space-y-5 md:space-y-6">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2 min-h-11 min-w-11 shrink-0"
            onClick={() => navigate(`/groups/${groupId}`)}
            aria-label="Back to group feed"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Button>
          <p className="flex-1 font-mono text-xs uppercase tracking-[0.2em] text-quiet">Playlist</p>
          <Button
            variant="outline"
            className="min-h-11 shrink-0 px-3"
            onClick={() => navigate(`/groups/${groupId}/analytics`)}
            aria-label="View group analytics"
          >
            <TrendingUp className="size-4" aria-hidden="true" />
            <span className="hidden @xl:inline">Analytics</span>
          </Button>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          {groupId && <GroupCover groupId={groupId} className="size-20 shrink-0 rounded-2xl md:size-28" />}
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">
              {group?.name || "Group playlist"}
            </h1>
            {isLoading ? (
              <Skeleton className="mt-3 h-4 w-2/3" />
            ) : (
              showList && <p className="mt-2 text-soft md:text-lg">{summary}</p>
            )}
          </div>
        </div>

        {showList && (
          <div className="flex flex-wrap gap-2">
            <Button
              className="min-h-11"
              onClick={handlePlayAll}
              disabled={!deviceId || isPlayerLoading || isPlaying !== null}
              aria-label="Play all tracks in playlist"
            >
              {isPlaying ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Play className="size-4 fill-current" aria-hidden="true" />}
              Play all
            </Button>
            {/* The owner creates or updates the Spotify copy; other members follow it (adr/0002). */}
            {group && (!hasCollaborativePlaylist || isPlaylistOwner) && (
              <Button
                variant="outline"
                className="min-h-11"
                onClick={handleExportToSpotify}
                disabled={isExporting}
                aria-label={hasCollaborativePlaylist ? "Update collaborative playlist" : "Create collaborative playlist"}
              >
                {isExporting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : hasCollaborativePlaylist ? (
                  <ExternalLink className="size-4" aria-hidden="true" />
                ) : (
                  <Plus className="size-4" aria-hidden="true" />
                )}
                {hasCollaborativePlaylist ? "Update collaborative playlist" : "Create collaborative playlist"}
              </Button>
            )}
            {hasCollaborativePlaylist && group && user && !isPlaylistOwner && (
              <Button
                variant="outline"
                className="min-h-11"
                onClick={handleFollowPlaylist}
                disabled={isFollowing}
                aria-label="Follow collaborative playlist"
              >
                {isFollowing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ListMusic className="size-4" aria-hidden="true" />}
                Follow collaborative playlist
              </Button>
            )}
          </div>
        )}
      </header>

      {error && !isLoading && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm text-soft">
          <span className="flex-1">Couldn't load this playlist.</span>
          <Button variant="outline" size="sm" className="min-h-11" onClick={refetch}>Try again</Button>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3" aria-hidden="true">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 pl-8">
              <Skeleton className="size-12 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {showList && (
        <section aria-labelledby="playlist-tracks-heading" className="space-y-3">
          <h2 id="playlist-tracks-heading" className="sr-only">Tracks</h2>
          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <ToggleGroup
              type="single"
              value={sortBy}
              // Radix sends "" when the selected chip is pressed again; keep it selected.
              onValueChange={(next) => next && setSortBy(next as SortOption)}
              role="radiogroup"
              aria-label="Sort playlist"
              className="gap-1.5 md:gap-2"
            >
              {SORTS.map(({ value, label }) => (
                <ToggleGroupItem
                  key={value}
                  value={value}
                  className="min-h-11 flex-none rounded-xl first:rounded-xl last:rounded-xl border border-line px-2.5 text-foreground hover:bg-raised hover:text-foreground data-[state=on]:border-iris data-[state=on]:bg-selected data-[state=on]:text-foreground md:px-3.5"
                >
                  {label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="hidden gap-3 pr-2 font-mono text-[11px] uppercase tracking-[0.15em] text-quiet @2xl:flex" aria-hidden="true">
            <span className="w-6 text-right">#</span>
            <span className="flex-1 pl-12">Track</span>
            <span className="w-40">Shared by</span>
            <span className="w-24">Listens</span>
            <span className="w-12 text-right">Time</span>
          </div>
          <ol aria-label="Playlist tracks" className="-mx-2 md:mx-0">
            {shares.map((share, index) => (
              <PlaylistRow
                key={share._id}
                share={share}
                position={index + 1}
                viewer={user}
                isStarting={isPlaying === share._id}
                playDisabled={!deviceId || isPlayerLoading}
                onPlay={() => handleTrackClick(share)}
              />
            ))}
          </ol>
        </section>
      )}

      {!isLoading && !error && shares.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
          <p className="font-display text-xl font-bold">Nothing to play yet</p>
          <p className="mx-auto mt-2 max-w-md text-soft">
            Every track shared in the group feed lands here. Share one to start the playlist.
          </p>
          <Button variant="outline" className="mt-5 min-h-11" onClick={() => navigate(`/groups/${groupId}`)}>
            Go to the group feed
          </Button>
        </div>
      )}
    </main>
  );
}
