import { ArrowLeft, Search, UserPlus, List, Music2, Plus, Loader2, Settings, TrendingUp } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Card, CardContent } from "../../ui/card";
import { Skeleton } from "../../ui/skeleton";
import { ScrollArea } from "../../ui/scroll-area";
import { Share, SpotifyTrack } from "../../../types";
import { toast } from "sonner";
import { useGroupFeed } from "../../../hooks/useGroupFeed";
import { useSpotifySearch } from "../../../hooks/useSpotifySearch";
import { useSpotifyPlayer } from "../../../hooks/useSpotifyPlayer";
import { useUser } from "../../../contexts/UserContext";
import { usePlayingGroup } from "../../../contexts/PlayingGroupContext";
import { useMemo, useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useGroups } from "../../../hooks/useGroups";

import { useGroupInvites } from "../../../hooks/useGroupInvites";
import InviteFriendDialog from "./InviteFriendDialog";
import InvitesList from "./InvitesList";
import ShareRow from "./ShareRow";
import ShareDetail from "./ShareDetail";
import DetailPane from "../../layout/DetailPane";
import { Sheet, SheetContent, SheetTitle } from "../../ui/sheet";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import FeedFilters, { EMPTY_FILTER_TEXT } from "./FeedFilters";
import { countShares, filterShares, isFeedFilter, type FeedFilter } from "../../../lib/feedFilter";
import { isUser } from "../../../lib/heardStack";
import { logger } from "../../../utils/logger";

export default function GroupFeedScreen() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useUser();
  const { setPlayingGroup } = usePlayingGroup();
  const { groups } = useGroups();
  
  // Find the group from the groups list
  const group = useMemo(() => groups.find(g => g._id === groupId) || null, [groups, groupId]);
  
  const { shares, olderIds, total, unheardStatus, isLoading, error, markListened, shareTrack, toggleLike, removeShare } = useGroupFeed(groupId || '');
  const { results: searchResults, isSearching, search, clear } = useSpotifySearch();
  const { playTrack, deviceId, isLoading: isPlayerLoading, setOnTrackComplete } = useSpotifyPlayer();

  const { invites, isLoading: isLoadingInvites, fetchInvites, sendInvite, acceptInvite, declineInvite } = useGroupInvites();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSharing, setIsSharing] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  // Filters work on the shares already loaded, not the group's full history.
  // The route remounts this screen per group, so each group starts on All.
  // Home links here with ?filter=unheard to open on that filter.
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState<FeedFilter>(() => {
    const requested = searchParams.get('filter');
    return isFeedFilter(requested) ? requested : 'all';
  });
  // All, Yours and Liked cover the loaded page; Unheard also has the group's older unheard shares.
  const pageShares = useMemo(() => (olderIds.size ? shares.filter((s) => !olderIds.has(s._id)) : shares), [shares, olderIds]);
  const filterCounts = useMemo(
    () => ({ ...countShares(pageShares, user), unheard: countShares(shares, user).unheard }),
    [pageShares, shares, user],
  );
  const visibleShares = useMemo(
    () => filterShares(filter === 'unheard' ? shares : pageShares, filter, user),
    [shares, pageShares, filter, user],
  );

  // The share open in the song detail: a pane beside the feed on wide
  // screens, a bottom sheet otherwise. The last one stays shown while the
  // sheet slides away, and focus goes back to its row (or, if it was
  // removed, the first row). The pane needs 1280px so the feed keeps room
  // with the rail and the pane both at their widest.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const lastShown = useRef<Share | null>(null);
  const isWide = useMediaQuery('(min-width: 1280px)');
  const selectedShare = shares.find(s => s._id === selectedId);
  if (selectedShare) lastShown.current = selectedShare;
  const shownShare = selectedShare ?? lastShown.current;
  const focusRow = (shareId: string | undefined) =>
    (document.querySelector<HTMLElement>(`[data-share-details="${shareId}"]`)
      ?? document.querySelector<HTMLElement>('[data-share-details]'))?.focus();

  // Track which share is currently playing (map track URI to share ID)
  const playingShareRef = useRef<Map<string, string>>(new Map());
  
  // Compute hasListened map
  const hasListened = useMemo(() => {
    const listenerMap: Record<string, boolean> = {};
    shares.forEach(share => {
      const listened = share.listeners.some(
        listener => listener.user._id === user?._id || listener.user.id === user?.id
      );
      listenerMap[share._id] = listened;
    });
    return listenerMap;
  }, [shares, user]);
  
  // Debounce search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setShowSearchResults(false);
      clear();
      return;
    }

    const timeoutId = setTimeout(() => {
      search(searchQuery, 10);
      setShowSearchResults(true);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, search, clear]);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleShareTrack = async (track: SpotifyTrack) => {
    if (!groupId || isSharing) return;

    try {
      setIsSharing(track.id);
      await shareTrack(track.id);
      setSearchQuery('');
      setShowSearchResults(false);
      clear();
    } catch (err) {
      // Error already handled in hook with toast
      logger.error('Failed to share track:', err);
    } finally {
      setIsSharing(null);
    }
  };


  const handleToggleLike = async (shareId: string) => {
    try {
      await toggleLike(shareId);
    } catch (err) {
      // Error handled in hook
      logger.error('Failed to toggle like:', err);
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    try {
      setIsRemoving(shareId);
      await removeShare(shareId);
    } catch (err) {
      logger.error('Failed to remove share:', err);
    } finally {
      setIsRemoving(null);
    }
  };

  // What the row and the song detail both need for a share.
  const shareProps = (share: Share) => ({
    share,
    viewer: user,
    members: group?.members ?? [],
    canRemove: isUser(share.sharedBy, user) || (!!group && isUser(group.createdBy, user)),
    isStarting: isPlaying === share._id,
    playDisabled: !deviceId || isPlayerLoading,
    isRemoving: isRemoving === share._id,
    onPlay: () => handlePlayTrack(share),
    onToggleLike: () => handleToggleLike(share._id),
    onRemove: () => handleRemoveShare(share._id),
  });

  const handlePlayTrack = async (share: Share) => {
    // Check if player is available
    if (!deviceId || isPlayerLoading) {
      toast.error('Player is not ready. Please wait for the player to connect.');
      return;
    }

    // Convert spotifyTrackId to track URI
    const trackUri = `spotify:track:${share.spotifyTrackId}`;

    try {
      setIsPlaying(share._id);
      // Track which share is playing this track URI
      playingShareRef.current.set(trackUri, share._id);
      // Set the playing group so next/previous buttons work
      if (group) {
        setPlayingGroup(group);
      }
      await playTrack(trackUri);
    } catch (err) {
      // Error already handled in playTrack with toast
      logger.error('Failed to play track:', err);
      // Remove from tracking if play failed
      playingShareRef.current.delete(trackUri);
    } finally {
      setIsPlaying(null);
    }
  };

  // Set up track completion callback to auto-mark as listened
  useEffect(() => {
    if (!setOnTrackComplete) return;

    const handleTrackComplete = async (trackUri: string) => {
      // Find the share that corresponds to this track URI
      const shareId = playingShareRef.current.get(trackUri);

      if (!shareId) {
        // Try to find share by matching track URI
        const share = shares.find(s => {
          const shareTrackUri = `spotify:track:${s.spotifyTrackId}`;
          return shareTrackUri === trackUri;
        });

        if (share) {
          // Check if user hasn't already listened
          const alreadyListened = hasListened[share._id];

          if (!alreadyListened) {
            try {
              await markListened(share._id);
              toast.success(`Marked "${share.trackName}" as listened`);
            } catch (err) {
              logger.error('Failed to auto-mark track as listened:', err);
              toast.error('Failed to mark track as listened');
            }
          }
        }
        // Silently return if share not found - might be from another group or external playback
        return;
      }

      // Check if user hasn't already listened
      const alreadyListened = hasListened[shareId];

      if (!alreadyListened) {
        try {
          await markListened(shareId);
          toast.success('Track marked as listened');
        } catch (err) {
          logger.error('Failed to auto-mark track as listened:', err);
          toast.error('Failed to mark track as listened');
        }
      }

      // Clean up tracking
      playingShareRef.current.delete(trackUri);
    };

    setOnTrackComplete(handleTrackComplete);

    // Cleanup on unmount - set empty callback to clear
    return () => {
      if (setOnTrackComplete) {
        // Set empty callback to clear the completion handler
        setOnTrackComplete(() => {
          // No-op: callback cleared
        });
      }
    };
  }, [setOnTrackComplete, shares, hasListened, markListened]);

  // Fetch invites when group changes
  useEffect(() => {
    if (groupId) {
      fetchInvites(groupId);
    }
  }, [groupId, fetchInvites]);

  return (
    <>
      {/* Header - Full Width */}
      <header className="sticky top-0 z-10 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        {/* The button labels follow the feed's width, not the window's, so
            the group name keeps room when the detail pane is open. */}
        <div className="@container px-4 md:px-6 py-3 md:py-4">
              <div className="flex items-center gap-2 md:gap-4 mb-3 md:mb-4">
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 min-w-[44px] min-h-[44px]"
                  onClick={() => navigate("/")}
                  aria-label="Back to dashboard"
                >
                  <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                </Button>
                <div className="flex-1 min-w-0">
                  <h1 className="text-base md:text-lg truncate">{group?.name || "Group Feed"}</h1>
                  <p className="text-xs md:text-sm text-muted-foreground truncate hidden sm:block">
                    {group?.members?.length || 0} members • {total || 0} tracks shared
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="border-border hover:border-ring/40 shrink-0 min-h-[44px] px-2 sm:px-4"
                  onClick={() => navigate(`/groups/${groupId}/playlist`)}
                  aria-label="View group playlist"
                  data-tour="playlist-btn"
                >
                  <List className="w-4 h-4" aria-hidden="true" />
                  <span className="hidden @3xl:block ml-2">View Playlist</span>
                </Button>
                <Button
                  variant="outline"
                  className="border-border hover:border-ring/40 shrink-0 min-h-[44px] px-2 sm:px-4"
                  onClick={() => navigate(`/groups/${groupId}/analytics`)}
                  aria-label="View group analytics"
                  data-tour="analytics-btn"
                >
                  <TrendingUp className="w-4 h-4" aria-hidden="true" />
                  <span className="hidden @3xl:block ml-2">Analytics</span>
                </Button>
                <Button
                  variant="outline"
                  className="border-border hover:border-ring/40 shrink-0 min-h-[44px] px-2 sm:px-4"
                  onClick={() => navigate(`/groups/${groupId}/settings`)}
                  aria-label="Group settings"
                  data-tour="settings-btn"
                >
                  <Settings className="w-4 h-4" aria-hidden="true" />
                  <span className="hidden @3xl:block ml-2">Settings</span>
                </Button>
                <Button
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 rounded-full min-h-[44px] px-2 sm:px-4"
                  aria-label="Invite a friend to group"
                  onClick={() => setIsInviteDialogOpen(true)}
                  data-tour="invite-btn"
                >
                  <UserPlus className="w-4 h-4" aria-hidden="true" />
                  <span className="hidden @3xl:block ml-2">Invite</span>
                </Button>
              </div>

              {/* Search Bar */}
              <div className="relative" ref={searchContainerRef} data-tour="share-input">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground z-10" aria-hidden="true" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (searchResults.length > 0) {
                      setShowSearchResults(true);
                    }
                  }}
                  placeholder="Search and add a track from Spotify..."
                  className="pl-9 bg-muted/50 border-border"
                  aria-label="Search and add tracks from Spotify"
                />

                {/* Search Results Dropdown */}
                {showSearchResults && (searchResults.length > 0 || isSearching) && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-[10000] max-h-[60vh] md:max-h-[400px] overflow-hidden">
                    <ScrollArea className="max-h-[60vh] md:max-h-[400px]">
                      <div className="p-2">
                        {isSearching ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 text-primary animate-spin" />
                            <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
                          </div>
                        ) : searchResults.length > 0 ? (
                          <div className="space-y-1">
                            {searchResults.map((track) => (
                              <button
                                key={track.id}
                                onClick={() => handleShareTrack(track)}
                                disabled={isSharing === track.id}
                                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed group min-h-[60px] touch-manipulation"
                                aria-label={`Share ${track.name} by ${track.artists.map(a => a.name).join(', ')}`}
                              >
                                {/* Album Art */}
                                {track.album.images && track.album.images.length > 0 ? (
                                  <img
                                    src={track.album.images[track.album.images.length - 1]?.url}
                                    alt={track.album.name}
                                    className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    <Music2 className="w-6 h-6 text-primary" />
                                  </div>
                                )}

                                {/* Track Info */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{track.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {track.artists.map(a => a.name).join(', ')}
                                  </p>
                                </div>

                                {/* Share Button */}
                                {isSharing === track.id ? (
                                  <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                                ) : (
                                  <Plus className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                )}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Content Area - Feed */}
          <div className="relative min-h-screen overflow-visible">
            {/* Feed Content */}
            <main className="flex-1 min-w-0 p-4 md:p-6">
              {/* Pending invites sit in the feed, above the songs, so they
                  follow the pane layout instead of covering the header (#75).
                  Only shown when there is something pending. */}
              {groupId && invites.some(invite => invite.status === 'pending') && (
                <section aria-labelledby="group-invites-heading" className="max-w-4xl mb-4 md:mb-6">
                  <h2 id="group-invites-heading" className="text-lg font-semibold mb-3">Group Invites</h2>
                  <InvitesList
                    groupId={groupId}
                    invites={invites}
                    onAcceptInvite={acceptInvite}
                    onDeclineInvite={declineInvite}
                    isLoading={isLoadingInvites}
                  />
                </section>
              )}

              {/* Error State */}
              {error && (
                <Card className="border-destructive mb-4 md:mb-6">
                  <CardContent className="p-4 md:p-6">
                    <p className="text-sm md:text-base text-destructive">{error}</p>
                  </CardContent>
                </Card>
              )}

              {/* Loading State */}
              {isLoading && (
                <div className="space-y-3 max-w-4xl">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="overflow-hidden">
                      <CardContent className="p-3 md:p-4">
                        <div className="flex items-center gap-3 md:gap-4">
                          <Skeleton className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg" />
                          <div className="flex-1">
                            <Skeleton className="h-4 w-3/4 mb-2" />
                            <Skeleton className="h-3 w-1/2" />
                          </div>
                          <Skeleton className="h-10 w-10 sm:h-10 sm:w-10 rounded-full" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Feed Content */}
              {!isLoading && shares.length > 0 && (
                <FeedFilters value={filter} counts={filterCounts} onChange={setFilter} />
              )}
              {/* Some older unheard shares weren't loaded: don't claim the list is complete. */}
              {!isLoading && filter === 'unheard' && unheardStatus === 'incomplete' && (
                <p className="max-w-4xl pb-2 text-sm text-soft">Some older unheard tracks couldn't be loaded here.</p>
              )}
              {!isLoading && filter !== 'all' && shares.length > 0 && visibleShares.length === 0 && (filter !== 'unheard' || unheardStatus === 'complete') && (
                <p className="max-w-4xl py-8 text-center text-sm md:text-base text-soft">{EMPTY_FILTER_TEXT[filter]}</p>
              )}
              {!isLoading && visibleShares.length > 0 && (
                <ul aria-label="Shares" className="@container max-w-4xl space-y-1">
                  {visibleShares.map((share) => (
                    <ShareRow
                      key={share._id}
                      {...shareProps(share)}
                      selected={share._id === selectedId}
                      onSelect={() => setSelectedId(share._id)}
                    />
                  ))}
                </ul>
              )}

              {/* Empty State */}
              {!isLoading && shares.length === 0 && !error && (
                <Card className="border-dashed border-2 border-border">
                  <CardContent className="flex flex-col items-center justify-center py-8 md:py-12 text-center px-4">
                    <div className="bg-primary/10 border border-primary/30 p-3 md:p-4 rounded-full mb-3 md:mb-4" aria-hidden="true">
                      <Music2 className="w-6 h-6 md:w-8 md:h-8 text-primary" />
                    </div>
                    <h3 className="text-base md:text-lg mb-2">No Tracks Shared Yet</h3>
                    <p className="text-sm md:text-base text-muted-foreground mb-4 max-w-md">
                      Be the first to share a track! Search for a song above and add it to the group.
                    </p>
                  </CardContent>
                </Card>
              )}
            </main>
          </div>

      {/* Song detail */}
      {isWide && selectedShare && (
        <DetailPane key={selectedShare._id} label="Song details">
          <ShareDetail
            {...shareProps(selectedShare)}
            onClose={() => {
              setSelectedId(null);
              focusRow(selectedShare._id);
            }}
          />
        </DetailPane>
      )}
      <Sheet open={!isWide && !!selectedShare} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent
          side="bottom"
          aria-describedby={undefined}
          className="max-h-[90dvh] gap-0 overflow-y-auto rounded-t-2xl border-line pb-[env(safe-area-inset-bottom)]"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            focusRow(lastShown.current?._id);
          }}
        >
          {shownShare && <ShareDetail {...shareProps(shownShare)} compact TitleTag={SheetTitle} />}
        </SheetContent>
      </Sheet>

      {/* Invite Dialog */}
      {groupId && (
        <InviteFriendDialog
          open={isInviteDialogOpen}
          onOpenChange={setIsInviteDialogOpen}
          groupId={groupId}
          onSendInvite={sendInvite}
          isSubmitting={isLoadingInvites}
        />
      )}
    </>
  );
}
