import { useId, useState, type ElementType } from "react";
import { ExternalLink, Heart, Loader2, Music2, Play, Trash2, X } from "lucide-react";
import { Button } from "../../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../../ui/avatar";
import { cn } from "../../../lib/utils";
import { formatSharedAt, formatTime } from "../../../lib/formatTime";
import { heardStack, isUser, type HeardStack } from "../../../lib/heardStack";
import type { Share, User } from "../../../types";
import RemoveShareDialog from "./RemoveShareDialog";

interface ShareDetailProps {
  share: Share;
  viewer: User | null;
  members: User[];
  canRemove: boolean;
  isStarting: boolean;
  playDisabled: boolean;
  isRemoving: boolean;
  onPlay: () => void;
  onToggleLike: () => void;
  onRemove: () => void;
  /** Phone sheet: small art beside the title instead of above it. */
  compact?: boolean;
  /** The title element; the sheet passes its dialog title. */
  TitleTag?: ElementType;
  /** Shows a close button (the desktop pane; the sheet has its own). */
  onClose?: () => void;
}

function heardHeading({ heard, total }: HeardStack): string {
  if (total === null) return `${heard} heard it`;
  if (total > 0 && heard === total) return "Everyone has heard it";
  if (heard === 0) return "No one has heard it yet";
  return `${heard} of ${total} have heard it`;
}

/**
 * One share in full (#57 "Song row": everything the row leaves out): art,
 * who shared it and when, play and like, the menu's actions, and each
 * member with how long after the share they heard it. Listens come only from
 * playback (CONTEXT.md), so there is no "mark as heard".
 */
export default function ShareDetail({
  share, viewer, members, canRemove, isStarting, playDisabled, isRemoving,
  onPlay, onToggleLike, onRemove, compact = false, TitleTag = "h2", onClose,
}: ShareDetailProps) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const headingId = useId();
  const isMine = isUser(share.sharedBy, viewer);
  const liked = share.likes?.some((like) => isUser(like.user, viewer)) ?? false;
  const likeCount = share.likeCount || 0;
  const stack = heardStack(share, members);
  // Who has heard it first, in group order, then who hasn't.
  const people = [...stack.members.filter((m) => m.heard), ...stack.members.filter((m) => !m.heard)];
  const listenDelay = (user: User) => share.listeners.find((l) => isUser(l.user, user))?.timeToListen ?? null;

  return (
    <div className={cn("flex flex-col gap-5", compact ? "p-4 pt-6" : "p-5")}>
      {onClose && (
        <div className="-mb-2 -mt-2 flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-wider text-quiet">Song</span>
          <Button variant="ghost" size="icon" className="min-h-11 min-w-11" onClick={onClose} aria-label="Close song details">
            <X className="size-5" aria-hidden="true" />
          </Button>
        </div>
      )}

      <div className={cn(compact ? "flex items-center gap-4 pr-10" : "flex flex-col gap-4")}>
        <div className={cn("grid shrink-0 place-items-center overflow-hidden bg-selected", compact ? "size-20 rounded-lg" : "aspect-square w-full rounded-2xl")}>
          {share.trackImage ? (
            <img src={share.trackImage} alt="" className="size-full object-cover" />
          ) : (
            <Music2 className={cn("text-quiet", compact ? "size-6" : "size-12")} aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0">
          <TitleTag className={cn("break-words font-display font-extrabold leading-tight text-foreground", compact ? "text-xl" : "text-3xl")}>
            {share.trackName}
          </TitleTag>
          <p className="text-soft">{share.artistName}</p>
          <p className={cn("mt-1 font-mono text-xs", isMine ? "text-iris" : "text-quiet")}>
            Shared by {isMine ? "you" : share.sharedBy.displayName} · {formatSharedAt(new Date(share.createdAt))}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={onPlay} disabled={playDisabled || isStarting}>
          {isStarting ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Play className="fill-current" aria-hidden="true" />}
          Play
        </Button>
        <Button
          variant="outline"
          onClick={onToggleLike}
          aria-pressed={liked}
          aria-label={`Like, ${likeCount} ${likeCount === 1 ? "like" : "likes"}`}
          className={cn(liked && "text-iris")}
        >
          <Heart className={cn(liked && "fill-current")} aria-hidden="true" />
          Like
          {likeCount > 0 && <span className="font-mono text-xs">{likeCount}</span>}
        </Button>
      </div>

      {(share.trackExternalUrl || canRemove) && (
        <div className="-mx-2 flex flex-col">
          {share.trackExternalUrl && (
            <Button variant="ghost" asChild className="justify-start">
              <a href={share.trackExternalUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" /> Open in Spotify
              </a>
            </Button>
          )}
          {canRemove && (
            <Button variant="destructive" className="justify-start" onClick={() => setConfirmRemove(true)} disabled={isRemoving}>
              {isRemoving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
              Remove from group
            </Button>
          )}
        </div>
      )}

      <section aria-labelledby={headingId}>
        <h3 id={headingId} className="font-display text-lg font-bold text-foreground">{heardHeading(stack)}</h3>
        <ul className="mt-2">
          {people.map(({ user, heard }) => {
            const you = isUser(user, viewer);
            const delay = listenDelay(user);
            return (
              <li key={user._id || user.id} className="flex min-h-11 items-center gap-3">
                <Avatar className={cn("size-8", !heard && "opacity-40")}>
                  <AvatarImage src={user.profileImage || undefined} className="object-cover" />
                  <AvatarFallback className="bg-selected text-xs font-semibold text-foreground">
                    {user.displayName?.charAt(0).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <span className={cn("min-w-0 flex-1 truncate font-medium", you ? "text-iris" : heard ? "text-foreground" : "text-quiet")}>
                  {you ? "You" : user.displayName || "Member"}
                </span>
                <span className="shrink-0 font-mono text-xs text-soft">
                  {!heard ? "Not yet" : delay === null ? "Heard" : `+${formatTime(delay)}`}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <RemoveShareDialog open={confirmRemove} onOpenChange={setConfirmRemove} trackName={share.trackName} onRemove={onRemove} />
    </div>
  );
}
