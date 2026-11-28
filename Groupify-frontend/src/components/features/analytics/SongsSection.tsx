import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Music2, RotateCcw, Search } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Skeleton } from "../../ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "../../ui/toggle-group";
import { Avatar, AvatarFallback, AvatarImage } from "../../ui/avatar";
import { eyebrow } from "../profile/SettingsSection";
import { useSongJourney } from "../../../hooks/useSongJourney";
import { cn } from "../../../lib/utils";
import { formatSharedAt } from "../../../lib/formatTime";
import { formatWait } from "../../../lib/viewerSummaryCopy";
import {
  SONG_SORTS,
  journeyHeadline,
  journeyRows,
  pickSongs,
  sharedByLine,
  sortCounts,
  timelinePosition,
  type SongSort,
} from "../../../lib/songPicker";
import type { SongSummary, SongsMember, SongsRange } from "../../../types/analytics";

const card = "flex flex-col gap-4 rounded-2xl border border-hair bg-raised p-4 md:p-5";

function Art({ src, className }: { src: string | null; className: string }) {
  return (
    <div className={cn("grid shrink-0 place-items-center overflow-hidden rounded-lg bg-selected", className)}>
      {src ? <img src={src} alt="" className="size-full object-cover" /> : <Music2 className="size-5 text-quiet" aria-hidden="true" />}
    </div>
  );
}

/**
 * One share's journey: a row per member of its audience, each listen placed
 * on a shared timeline. The listens replay in order when a share opens and
 * on Replay; with reduced motion they're simply shown.
 */
function SongJourney({ song, members, viewerId }: { song: SongSummary; members: SongsMember[]; viewerId: string }) {
  const reduceMotion = useReducedMotion() ?? false;
  const [replay, setReplay] = useState(0);
  const rows = journeyRows(song, members, viewerId);
  const longest = song.listens[song.listens.length - 1]?.afterMs ?? 0;
  const headingId = `journey-${song.shareId}`;

  return (
    <article className={card} aria-labelledby={headingId}>
      <div className="flex items-center gap-3">
        <Art src={song.trackImage} className="size-16" />
        <div className="min-w-0 flex-1">
          <h3 id={headingId} className="truncate font-display text-xl font-semibold text-foreground">{song.trackName}</h3>
          <p className="truncate text-sm text-soft">{song.artistName}</p>
          <p className={cn("mt-0.5 font-mono text-xs", song.sharedBy === viewerId ? "text-iris" : "text-quiet")}>
            {sharedByLine(song, members, viewerId)} · {formatSharedAt(new Date(song.sharedAt))}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-lg font-semibold text-foreground">{journeyHeadline(song)}</p>
        {!reduceMotion && song.listens.length > 0 && (
          <Button variant="ghost" className="min-h-11 shrink-0" onClick={() => setReplay((n) => n + 1)}>
            <RotateCcw aria-hidden="true" /> Replay
          </Button>
        )}
      </div>

      {rows.length > 0 && (
        <ul className="flex flex-col" key={`${song.shareId}-${replay}`}>
          {rows.map(({ member, afterMs, isViewer }, i) => {
            const at = afterMs === null ? 0 : timelinePosition(afterMs, longest);
            const delay = reduceMotion ? 0 : i * 0.35;
            return (
              // Phones: the bar sits under the name. Wider: one line per member.
              <li key={member.id} className="grid min-h-11 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-1 sm:grid-cols-[2rem_8rem_minmax(0,1fr)_5rem]">
                <Avatar className={cn("row-span-2 size-8 sm:row-span-1", afterMs === null && "opacity-40")}>
                  <AvatarImage src={member.profileImage || undefined} className="object-cover" />
                  <AvatarFallback className="bg-selected text-xs font-semibold text-foreground">
                    {member.displayName.charAt(0).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <span className={cn("truncate text-sm font-medium", isViewer ? "text-iris" : afterMs === null ? "text-quiet" : "text-foreground")}>
                  {isViewer ? "You" : member.displayName}
                </span>
                <div className="relative col-span-2 col-start-2 row-start-2 h-1.5 rounded-full bg-hair sm:col-span-1 sm:col-start-3 sm:row-start-1" aria-hidden="true">
                  {afterMs !== null && (
                    <motion.div
                      className={cn("absolute inset-y-0 left-0 w-full origin-left rounded-full", isViewer ? "bg-iris" : "bg-foreground/70")}
                      initial={reduceMotion ? false : { scaleX: 0 }}
                      animate={{ scaleX: Math.max(at, 0.02) }}
                      transition={{ delay, duration: 0.6, ease: "easeOut" }}
                    />
                  )}
                </div>
                <motion.span
                  className={cn("col-start-3 row-start-1 text-right font-mono text-xs sm:col-start-4", afterMs === null ? "text-quiet" : "text-soft")}
                  initial={reduceMotion || afterMs === null ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: delay + 0.4, duration: 0.3 }}
                >
                  {afterMs === null ? "Not yet" : formatWait(afterMs)}
                </motion.span>
              </li>
            );
          })}
        </ul>
      )}
      {song.listens.length > 0 && (
        <p className="flex justify-between font-mono text-xs text-quiet" aria-hidden="true">
          <span>Shared</span>
          <span>{formatWait(longest)} later</span>
        </p>
      )}
    </article>
  );
}

function listLine(song: SongSummary): string {
  if (song.audience === 0) return song.artistName;
  return `${song.artistName} · ${song.spreadMs !== null ? `all in ${formatWait(song.spreadMs)}` : `${song.listens.length}/${song.audience} listened`}`;
}

/** Search, sort chips and a fixed-height list, so a group with hundreds of shares stays one screen. */
function SongPicker({ songs, viewerId, selectedId, onSelect }: {
  songs: SongSummary[];
  viewerId: string;
  selectedId: string | null;
  onSelect: (shareId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SongSort>("recent");
  const counts = useMemo(() => sortCounts(songs, viewerId), [songs, viewerId]);
  const picked = useMemo(() => pickSongs(songs, { sort, query, viewerId }), [songs, sort, query, viewerId]);

  return (
    <div className={cn(card, "gap-3")}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-quiet" aria-hidden="true" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search songs or artists"
          aria-label="Search songs"
          className="pl-10 text-base"
        />
      </div>
      <ToggleGroup
        type="single"
        value={sort}
        // Radix sends "" when the selected chip is pressed again; keep it selected.
        onValueChange={(next) => next && setSort(next as SongSort)}
        role="radiogroup"
        aria-label="Sort songs"
        className="-mx-1 flex w-auto justify-start gap-1.5 overflow-x-auto px-1 pb-1 md:flex-wrap"
      >
        {SONG_SORTS.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            aria-label={`${option.label} ${counts[option.value]}`}
            className="min-h-11 flex-none whitespace-nowrap rounded-xl first:rounded-xl last:rounded-xl border border-line px-3 text-sm text-foreground hover:bg-raised hover:text-foreground data-[state=on]:border-iris data-[state=on]:bg-selected data-[state=on]:text-foreground"
          >
            {option.label}
            <span className="font-mono text-xs text-soft">{counts[option.value]}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <ul className="-mx-2 h-80 overflow-y-auto overscroll-contain" aria-label="Songs">
        {picked.length === 0 ? (
          <li className="px-2 py-6 text-center text-sm text-soft">
            {query.trim() ? `No songs match "${query.trim()}".` : "No shares here in this period."}
          </li>
        ) : (
          picked.map((song) => {
            const selected = song.shareId === selectedId;
            return (
              <li key={song.shareId}>
                <button
                  type="button"
                  onClick={() => onSelect(song.shareId)}
                  aria-pressed={selected}
                  className={cn(
                    "flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left outline-none hover:bg-selected focus-visible:ring-2 focus-visible:ring-iris",
                    selected && "bg-selected",
                  )}
                >
                  <Art src={song.trackImage} className="size-10" />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-sm font-medium", selected ? "text-iris" : "text-foreground")}>{song.trackName}</span>
                    <span className="block truncate text-xs text-soft">{listLine(song)}</span>
                  </span>
                  {song.sharedBy === viewerId && <span className="shrink-0 font-mono text-xs text-iris">You</span>}
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

/**
 * "The songs" in Group Dynamics (#56 §3): pick any share and see how it
 * spread through the group. A link from the feed opens one share
 * (`?share=<id>`), even when it's older than the period.
 */
export default function SongsSection({ groupId, range }: { groupId: string; range: SongsRange }) {
  const [searchParams, setSearchParams] = useSearchParams();
  // Only the share the page was opened with is sent to the backend, so
  // picking another share doesn't load everything again. The URL follows
  // the picked share, so a reload or a copied link opens it.
  const [linkedShare, setLinkedShare] = useState(() => searchParams.get("share"));
  const { data, isLoading, error, refetch } = useSongJourney(groupId, range, linkedShare);
  const [picked, setPicked] = useState<string | null>(linkedShare);
  // A new period keeps the picked share selected, even when it's older than
  // the period: it becomes the share the next load must include. Set while
  // rendering, so the range and the share are fetched together, once.
  const [loadedRange, setLoadedRange] = useState(range);
  if (range !== loadedRange) {
    setLoadedRange(range);
    if (picked) setLinkedShare(picked);
  }
  const sectionRef = useRef<HTMLElement>(null);
  const journeyRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion() ?? false;

  const selected = data?.songs.find((s) => s.shareId === picked) ?? data?.songs[0] ?? null;

  // Opened from a share in the feed: bring its journey into view once.
  // Only the share the page was opened with: a period change mustn't scroll.
  const scrolledToLink = useRef(!searchParams.get("share"));
  useEffect(() => {
    if (!data || scrolledToLink.current) return;
    scrolledToLink.current = true;
    sectionRef.current?.scrollIntoView({ block: "start", behavior: reduceMotion ? "auto" : "smooth" });
  }, [data, reduceMotion]);

  const onSelect = (shareId: string) => {
    setPicked(shareId);
    setSearchParams((params) => {
      params.set("share", shareId);
      return params;
    }, { replace: true });
    // On a phone the journey sits above the list.
    journeyRef.current?.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
  };

  return (
    <section ref={sectionRef} className="flex scroll-mt-20 flex-col gap-3 md:gap-4" aria-labelledby="songs-heading" data-tour="analytics-songs">
      <h2 id="songs-heading" className={cn(eyebrow, "px-2")}>The songs</h2>

      {error ? (
        <div className={cn(card, "items-start")} role="alert">
          <p className="text-sm text-foreground">
            {linkedShare ? "The songs didn't load. The share you opened may have been removed." : "The songs didn't load."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="min-h-11" onClick={() => refetch()}>
              Try again
            </Button>
            {linkedShare && (
              <Button variant="ghost" className="min-h-11" onClick={() => {
                  setLinkedShare(null);
                  setSearchParams((params) => {
                    params.delete("share");
                    return params;
                  }, { replace: true });
                }}>
                Show all songs
              </Button>
            )}
          </div>
        </div>
      ) : isLoading && !data ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-busy="true" aria-label="Loading the songs">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : data && data.songs.length === 0 ? (
        <div className={card}>
          <p className="text-sm text-soft">No shares in this period yet. Once someone shares a track, you'll see how it spread here.</p>
        </div>
      ) : data && selected ? (
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div ref={journeyRef} className="scroll-mt-20">
            <SongJourney song={selected} members={data.members} viewerId={data.viewerId} />
          </div>
          <SongPicker songs={data.songs} viewerId={data.viewerId} selectedId={selected.shareId} onSelect={onSelect} />
        </div>
      ) : null}
    </section>
  );
}
