import { Loader2, Music2, Play } from "lucide-react";
import { cn } from "../../../lib/utils";
import { formatTrackTime } from "../../../lib/formatTime";
import { isUser } from "../../../lib/heardStack";
import type { Share, User } from "../../../types";

interface PlaylistRowProps {
  share: Share;
  /** 1-based place in the current sort. */
  position: number;
  viewer: User | null;
  isStarting: boolean;
  playDisabled: boolean;
  onPlay: () => void;
}

const listensText = (n: number) => `${n} ${n === 1 ? "listen" : "listens"}`;

/**
 * One track in the group playlist: place, art (the play button), title,
 * artist, who shared it, its listens and its length. Lays out by the
 * playlist's width (container query); on phones the sharer, listens and
 * length share one mono line under the artist.
 */
export default function PlaylistRow({ share, position, viewer, isStarting, playDisabled, onPlay }: PlaylistRowProps) {
  const isMine = isUser(share.sharedBy, viewer);
  const sharer = isMine ? "You" : share.sharedBy.displayName;
  const duration = formatTrackTime(share.durationMs || 0);

  return (
    <li
      className="group/row flex cursor-pointer items-center gap-2 rounded-xl py-2 pr-2 transition-colors hover:bg-selected/60 @2xl:gap-3"
      // Not guarded on playDisabled: a tap while the player isn't ready should
      // still reach onPlay, which says so in a toast.
      onClick={() => { if (!isStarting) onPlay(); }}
    >
      <span className="w-6 shrink-0 text-right font-mono text-xs text-quiet" aria-hidden="true">{position}</span>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onPlay(); }}
        disabled={playDisabled || isStarting}
        aria-label={`Play ${share.trackName} by ${share.artistName}`}
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
        <p className="truncate font-medium text-foreground">{share.trackName}</p>
        <p className="truncate text-sm text-soft">{share.artistName}</p>
        <p className="flex gap-1 whitespace-nowrap font-mono text-[11px] text-quiet @2xl:hidden">
          {/* The name gives way first, so the listens and length always show. */}
          <span className={cn("min-w-[3ch] truncate", isMine && "text-iris")}>{sharer}</span>
          <span className="shrink-0">· {listensText(share.listenCount)} · {duration}</span>
        </p>
      </div>

      <p className={cn("hidden w-40 shrink-0 truncate font-mono text-xs @2xl:block", isMine ? "text-iris" : "text-quiet")}>{sharer}</p>
      <p className="hidden w-24 shrink-0 font-mono text-xs text-soft @2xl:block">{listensText(share.listenCount)}</p>
      <p className="hidden w-12 shrink-0 text-right font-mono text-xs text-quiet @2xl:block">{duration}</p>
    </li>
  );
}
