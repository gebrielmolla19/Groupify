import { useState } from "react";
import { ExternalLink, Heart, Loader2, MoreHorizontal, Music2, Play, Trash2 } from "lucide-react";
import { Button } from "../../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../../ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../../ui/alert-dialog";
import { cn } from "../../../lib/utils";
import { formatAge } from "../../../lib/formatTime";
import { heardStack, isUser } from "../../../lib/heardStack";
import type { Share, User } from "../../../types";

interface ShareRowProps {
  share: Share;
  viewer: User | null;
  /** The group's members, for the heard stack. Empty while loading. */
  members: User[];
  canRemove: boolean;
  isStarting: boolean;
  playDisabled: boolean;
  isRemoving: boolean;
  onPlay: () => void;
  onToggleLike: () => void;
  onRemove: () => void;
}

const MAX_AVATARS = 5;
const initial = (user: User) => user.displayName?.charAt(0).toUpperCase() || "?";

/**
 * One share in the group feed (#57 "Song row"): art, title, artist, who
 * shared it and when, the heard stack and a like. A dot and bold title mean
 * the viewer hasn't heard it yet. Other actions live in the three-dot menu.
 * Lays out by the feed's width (container query), so it follows the panes.
 */
export default function ShareRow({ share, viewer, members, canRemove, isStarting, playDisabled, isRemoving, onPlay, onToggleLike, onRemove }: ShareRowProps) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const isMine = isUser(share.sharedBy, viewer);
  const unheard = !isMine && !share.listeners.some((l) => isUser(l.user, viewer));
  const liked = share.likes?.some((like) => isUser(like.user, viewer)) ?? false;
  const stack = heardStack(share, members);
  const heardText = stack.total === null ? `${stack.heard}` : `${stack.heard}/${stack.total}`;
  const heardLabel = stack.total === null
    ? `${stack.heard} heard`
    : `${stack.heard} of ${stack.total} members heard it`;
  const age = formatAge(Date.now() - new Date(share.createdAt).getTime());
  // The name gives way first, so the heard count always shows.
  const sharerName = <span className="min-w-[3ch] truncate">{isMine ? "You" : share.sharedBy.displayName}</span>;

  return (
    <li className="group/row relative flex items-center gap-2 @2xl:gap-3 rounded-xl py-2 pl-4 pr-0 @2xl:pl-5 @2xl:pr-2 hover:bg-selected/60 transition-colors">
      {/* The dot sits in the row's left padding, keeping width for the title on phones. */}
      {unheard && <span aria-hidden="true" className="absolute left-1 @2xl:left-1.5 top-1/2 size-2 -translate-y-1/2 rounded-full bg-iris" data-testid="unheard-dot" />}

      <button
        type="button"
        onClick={onPlay}
        disabled={playDisabled || isStarting}
        aria-label={`Play ${share.trackName}`}
        className="group/play relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-selected outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
      >
        {share.trackImage ? (
          <img src={share.trackImage} alt="" className="size-full object-cover" />
        ) : (
          <Music2 className="size-5 text-quiet" aria-hidden="true" />
        )}
        <span
          aria-hidden="true"
          className={cn(
            "absolute inset-0 grid place-items-center bg-ground/60 text-foreground transition-opacity",
            isStarting ? "opacity-100" : "opacity-0 group-hover/row:opacity-100 group-focus-visible/play:opacity-100",
          )}
        >
          {isStarting ? <Loader2 className="size-5 animate-spin" /> : <Play className="size-5 fill-current" />}
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-foreground", unheard ? "font-bold" : "font-medium")}>
          {share.trackName}
          {unheard && <span className="sr-only"> (not heard yet)</span>}
        </p>
        <p className="truncate text-sm text-soft">{share.artistName}</p>
        <p className={cn("@2xl:hidden flex gap-1 whitespace-nowrap font-mono text-[11px]", isMine ? "text-iris" : "text-quiet")}>
          {sharerName}
          {/* At phone width there's room for the name or the age, not both; the age waits for a wider feed. */}
          <span className="shrink-0"><span className="hidden @md:inline">· {age} </span>· <span data-tour="listeners">{heardText} heard</span></span>
        </p>
      </div>

      <p className={cn("hidden @2xl:flex w-40 shrink-0 gap-1 whitespace-nowrap font-mono text-xs", isMine ? "text-iris" : "text-quiet")}>
        {sharerName}
        <span className="shrink-0">· {age}</span>
      </p>

      <div className="hidden @2xl:flex w-36 shrink-0 items-center gap-2" data-tour="listeners" aria-label={heardLabel} role="group">
        <div className="flex" aria-hidden="true">
          {stack.members.slice(0, MAX_AVATARS).map(({ user, heard }) => (
            <Avatar
              key={user._id || user.id}
              title={user.displayName}
              className={cn("-ml-1.5 first:ml-0 size-6 border-2 border-pane", !heard && "opacity-40")}
            >
              <AvatarImage src={user.profileImage || undefined} className="object-cover" />
              <AvatarFallback className="bg-selected text-[10px] font-semibold text-foreground">{initial(user)}</AvatarFallback>
            </Avatar>
          ))}
        </div>
        <span className="font-mono text-xs text-soft">{heardText}</span>
      </div>

      {/* Like and menu share one group with no gap, and the like count sits
          inside its button, so the row keeps room for the title at 375px. */}
      <div className="flex shrink-0 items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              className={cn("min-h-11 min-w-11 shrink-0 gap-1 px-2 @2xl:w-16 @2xl:justify-start", liked && "text-iris")}
              onClick={onToggleLike}
              aria-pressed={liked}
              aria-label={`${liked ? "Unlike" : "Like"} ${share.trackName}, ${share.likeCount || 0} ${share.likeCount === 1 ? "like" : "likes"}`}
              data-tour="like-btn"
            >
              <Heart className={cn("size-5", liked && "fill-current")} aria-hidden="true" />
              {share.likeCount > 0 && <span className="font-mono text-xs">{share.likeCount}</span>}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {share.likes?.length > 0 ? `Liked by ${share.likes.map((l) => l.user.displayName).join(", ")}` : "Like this song"}
          </TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="min-h-11 min-w-11 shrink-0" aria-label={`More actions for ${share.trackName}`} disabled={isRemoving}>
              {isRemoving ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <MoreHorizontal className="size-5" aria-hidden="true" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onPlay} disabled={playDisabled || isStarting}>
              <Play aria-hidden="true" /> Play
            </DropdownMenuItem>
            {share.trackExternalUrl && (
              <DropdownMenuItem asChild>
                <a href={share.trackExternalUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden="true" /> Open in Spotify
                </a>
              </DropdownMenuItem>
            )}
            {canRemove && (
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmRemove(true)}>
                <Trash2 aria-hidden="true" /> Remove from group
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove song from group?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{share.trackName}" from the group feed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onRemove} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}
