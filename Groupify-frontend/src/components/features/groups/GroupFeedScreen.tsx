import { ArrowLeft, Search, UserPlus, List, Play, Clock, CheckCircle2, Headphones, Music2, Plus, Loader2, Settings, Heart, TrendingUp } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "../../ui/avatar";
import { Card, CardContent } from "../../ui/card";
import { Skeleton } from "../../ui/skeleton";
import { ScrollArea } from "../../ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../ui/tooltip";
import { Share, SpotifyTrack } from "../../../types";
import { toast } from "sonner";
import { useGroupFeed } from "../../../hooks/useGroupFeed";
import { useSpotifySearch } from "../../../hooks/useSpotifySearch";
import { useSpotifyPlayer } from "../../../hooks/useSpotifyPlayer";
import { useUser } from "../../../contexts/UserContext";
import { usePlayingGroup } from "../../../contexts/PlayingGroupContext";
import SpotifyPlayerCard from "../music/SpotifyPlayerCard";
import { formatDistanceToNow } from "date-fns";
import { useMemo, useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useGroups } from "../../../hooks/useGroups";

import { useGroupInvites } from "../../../hooks/useGroupInvites";
import InviteFriendDialog from "./InviteFriendDialog";
import InvitesList from "./InvitesList";
import { logger } from "../../../utils/logger";

export default function GroupFeedScreen() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useUser();
  const { setPlayingGroup } = usePlayingGroup();
  const { groups } = useGroups();
  
  // Find the group from the groups list
  const group = useMemo(() => groups.find(g => g._id === groupId) || null, [groups, groupId]);
  
  const { shares, total, isLoading, error, markListened, shareTrack, toggleLike } = useGroupFeed(groupId || '');
  const { results: searchResults, isSearching, search, clear } = useSpotifySearch();
  const { playTrack, deviceId, isLoading: isPlayerLoading, setOnTrackComplete } = useSpotifyPlayer();

  const { invites, isLoading: isLoadingInvites, fetchInvites, sendInvite, acceptInvite, declineInvite } = useGroupInvites();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSharing, setIsSharing] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

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

  const handleMarkListened = async (shareId: string) => {
    if (hasListened[shareId]) return; // Already listened
    try {
      await markListened(shareId);
    } catch (err) {
      // Error already handled in hook with toast
      logger.error('Failed to mark as listened:', err);
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
        <div className="px-4 md:px-6 py-4">
              <div className="flex items-center gap-2 md:gap-4 mb-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/")}
                  className="hover:bg-primary/10 shrink-0"
                  aria-label="Back to dashboard"
                >
                  <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                </Button>
                <div className="flex-1 min-w-0">
                  <h1 className="truncate">{group?.name || "Group Feed"}</h1>
                  <p className="text-sm text-muted-foreground truncate">
                    {group?.members?.length || 0} members • {total || 0} tracks shared
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="border-primary/30 hover:bg-primary/10 hidden md:flex shrink-0"
                  onClick={() => navigate(`/groups/${groupId}/playlist`)}
                  aria-label="View group playlist"
                >
                  <List className="w-4 h-4 mr-2" aria-hidden="true" />
                  <span>View Playlist</span>
                </Button>
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
                  size="icon"
                  className="border-primary/30 hover:bg-primary/10 shrink-0"
                  onClick={() => navigate(`/groups/${groupId}/settings`)}
                  aria-label="Group settings"
                >
                  <Settings className="w-4 h-4" aria-hidden="true" />
                </Button>
                <Button
                  size="icon"
                  className="bg-primary hover:bg-primary/90 text-black shrink-0 rounded-full"
                  aria-label="Invite a friend to group"
                  onClick={() => setIsInviteDialogOpen(true)}
                >
                  <UserPlus className="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>

              {/* Search Bar */}
              <div className="relative" ref={searchContainerRef}>
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
                  <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg shadow-lg z-[10000] max-h-[400px] overflow-hidden">
                    <ScrollArea className="max-h-[400px]">
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
                                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed group"
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
                <div className="space-y-3 max-w-4xl">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <Skeleton className="w-16 h-16 rounded-lg" />
                          <div className="flex-1">
                            <Skeleton className="h-4 w-3/4 mb-2" />
                            <Skeleton className="h-3 w-1/2" />
                          </div>
                          <Skeleton className="h-10 w-10 rounded-full" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Feed Content */}
              {!isLoading && shares.length > 0 && (
                <div className="space-y-3 max-w-4xl">
                  {shares.map((share) => (
                    <Card
                      key={share._id}
                      className="group overflow-hidden border-border hover:border-primary/50 transition-all duration-300 hover:shadow-[0_0_15px_rgba(0,255,136,0.1)]"
                    >
                      <CardContent className="p-3 md:p-4 relative">
                        <div className="flex items-center gap-3 md:gap-4">
                          {/* Album Art */}
                          <div className="relative flex-shrink-0">
                            {share.trackImage ? (
                              <img
                                src={share.trackImage}
                                alt={share.trackName}
                                className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Music2 className="w-6 h-6 text-primary" />
                              </div>
                            )}
                            <Button
                              size="icon"
                              className="absolute inset-0 m-auto w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity bg-primary hover:bg-primary/90 text-black rounded-full disabled:opacity-50"
                              aria-label={`Play ${share.trackName}`}
                              onClick={() => handlePlayTrack(share)}
                              disabled={!deviceId || isPlayerLoading || isPlaying === share._id}
                            >
                              {isPlaying === share._id ? (
                                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                              ) : (
                                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                              )}
                            </Button>
                          </div>

                          {/* Track Info */}
                          <div className="flex-1 min-w-0">
                            <h4 className="truncate mb-1 text-sm sm:text-base">{share.trackName}</h4>
                            <p className="text-xs sm:text-sm text-muted-foreground truncate">
                              {share.artistName}
                            </p>
                          </div>

                          {/* Sharer Info */}
                          <div className="hidden lg:flex items-center gap-2 min-w-0 max-w-[150px]">
                            <Avatar className="w-8 h-8 border border-primary/30 shrink-0">
                              <AvatarImage src={share.sharedBy.profileImage || undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {share.sharedBy.displayName.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm truncate">{share.sharedBy.displayName}</p>
                              <p className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatDistanceToNow(new Date(share.createdAt), { addSuffix: true })}
                              </p>
                            </div>
                          </div>

                          {/* Stats */}
                          <div className="flex items-center gap-2 md:gap-4 text-sm text-muted-foreground shrink-0">
                            <div className="flex items-center gap-1" aria-label={`${share.listenCount} listeners`}>
                              <Headphones className="w-4 h-4" aria-hidden="true" />
                              <span className="hidden sm:inline">{share.listenCount}</span>
                            </div>
                            {hasListened[share._id] ? (
                              <CheckCircle2
                                className="w-4 h-4 sm:w-5 sm:h-5 text-primary"
                                aria-label="Listened"
                              />
                            ) : (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="w-8 h-8 hover:bg-primary/10"
                                onClick={() => handleMarkListened(share._id)}
                                aria-label="Mark as listened"
                              >
                                <Clock className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                              </Button>
                            )}
                          </div>

                          {/* Like Button */}
                          <div className="flex items-center gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 hover:bg-primary/10"
                                    onClick={() => handleToggleLike(share._id)}
                                  >
                                    <Heart
                                      className={`w-4 h-4 ${share.likes?.some(like => like.user._id === user?._id || like.user.id === user?.id)
                                        ? "fill-primary text-primary"
                                        : "text-muted-foreground"
                                        }`}
                                    />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {share.likes?.length > 0 ? (
                                    <div className="text-xs">
                                      <p className="font-semibold mb-1">Liked by:</p>
                                      {share.likes.map(like => (
                                        <div key={like.user._id || like.user.id} className="block">
                                          {like.user.displayName}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p>Like this song</p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <span className="text-xs text-muted-foreground min-w-[1ch]">
                              {share.likeCount || 0}
                            </span>
                          </div>
                        </div>

                        {/* Listener Avatars - Bottom Right Corner */}
                        {share.listeners && share.listeners.length > 0 && (() => {
                          // Sort listeners by listenedAt timestamp (chronological order)
                          const sortedListeners = [...share.listeners].sort((a, b) => {
                            const dateA = new Date(a.listenedAt).getTime();
                            const dateB = new Date(b.listenedAt).getTime();
                            return dateA - dateB; // Oldest first
                          });

                          return (
                            <div className="absolute bottom-3 right-3 flex items-center">
                              {sortedListeners.map((listener, index) => {
                                // Handle both populated and unpopulated listener objects
                                const listenerUser = listener.user && typeof listener.user === 'object'
                                  ? listener.user
                                  : null;

                                if (!listenerUser) return null;

                                return (
                                  <Avatar
                                    key={listenerUser._id || listenerUser.id || index}
                                    className="w-6 h-6 border-2 border-background shrink-0"
                                    style={{
                                      marginLeft: index > 0 ? '-8px' : '0',
                                      zIndex: index + 1
                                    }}
                                    title={listenerUser.displayName}
                                  >
                                    <AvatarImage src={listenerUser.profileImage || undefined} />
                                    <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                                      {listenerUser.displayName?.charAt(0).toUpperCase() || '?'}
                                    </AvatarFallback>
                                  </Avatar>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {/* Mobile sharer info */}
                        <div className="lg:hidden flex items-center gap-2 mt-3 pt-3 border-t border-border">
                          <Avatar className="w-6 h-6 border border-primary/30 shrink-0">
                            <AvatarImage src={share.sharedBy.profileImage || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {share.sharedBy.displayName.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">
                            Shared by {share.sharedBy.displayName} • {formatDistanceToNow(new Date(share.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Empty State */}
              {!isLoading && shares.length === 0 && !error && (
                <Card className="border-dashed border-2 border-border">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="bg-primary/10 border border-primary/30 p-4 rounded-full mb-4" aria-hidden="true">
                      <Music2 className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="mb-2">No Tracks Shared Yet</h3>
                    <p className="text-muted-foreground mb-4 max-w-md">
                      Be the first to share a track! Search for a song above and add it to the group.
                    </p>
                  </CardContent>
                </Card>
              )}
            </main>
          </div>

      {/* Spotify Player - Floating Glass Bar */}
      <SpotifyPlayerCard
        key={`group-feed-player-${groupId || 'no-group'}`}
      />

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

      {/* Invites List - Show in a sidebar or section */}
      {groupId && (
        <div className="hidden lg:block fixed right-0 top-0 bottom-0 w-80 border-l border-border bg-card overflow-y-auto z-20" style={{ marginTop: '73px' }}>
          <div className="p-4">
            <h2 className="text-lg font-semibold mb-4">Group Invites</h2>
            <InvitesList
              groupId={groupId}
              invites={invites}
              onAcceptInvite={acceptInvite}
              onDeclineInvite={declineInvite}
              isLoading={isLoadingInvites}
            />
          </div>
        </div>
      )}
    </>
  );
}
