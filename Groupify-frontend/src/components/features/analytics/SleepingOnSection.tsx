import { useMemo, useState, type ReactNode } from "react";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../ui/button";
import { Skeleton } from "../../ui/skeleton";
import { useSongsSummary } from "../../../hooks/useSongsSummary";
import { useSpotifyPlayer, wasPlaybackErrorNotified } from "../../../hooks/useSpotifyPlayer";
import { useGroups } from "../../../hooks/useGroups";
import { usePlayingGroup } from "../../../contexts/PlayingGroupContext";
import {
  moreLine,
  recordRows,
  sleepingOnEmpty,
  sleepingOnLine,
  sleptOnEmpty,
  sleptOnLine,
} from "../../../lib/songsSummaryCopy";
import type { SongsSummary, SongsSummaryShare, ViewerSummaryRange } from "../../../types/analytics";
import { logger } from "../../../utils/logger";

const card = "flex min-w-0 flex-col gap-3 rounded-2xl border border-hair bg-raised p-4 md:p-5";
const cardTitle = "font-display text-lg font-semibold text-foreground";
const cardSubtitle = "text-sm text-soft";

function ShareRow({ share, line, action }: { share: SongsSummaryShare; line: string; action: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-semibold text-foreground">{share.trackName}</span>
        <span className="text-xs text-soft">{line}</span>
      </div>
      {action}
    </li>
  );
}

/**
 * Plays a share the way the feed does: the group becomes the playing group
 * so next and previous work, and the listen is recorded by the app's usual
 * playback tracking.
 */
function usePlayShare(groupId: string) {
  const { playTrack, deviceId, isLoading: isPlayerLoading } = useSpotifyPlayer();
  const { setPlayingGroup } = usePlayingGroup();
  const { groups } = useGroups();
  const group = useMemo(() => groups.find((g) => g._id === groupId) ?? null, [groups, groupId]);
  const [starting, setStarting] = useState<string | null>(null);

  const play = async (share: SongsSummaryShare) => {
    if (!deviceId || isPlayerLoading) {
      toast.error("Player is not ready. Please wait for the player to connect.");
      return;
    }
    try {
      setStarting(share.shareId);
      if (group) setPlayingGroup(group);
      await playTrack(`spotify:track:${share.spotifyTrackId}`);
    } catch (err) {
      logger.error("Failed to play track from Group Dynamics:", err);
      // playTrack toasts some failures itself (device gone, not Premium); say the rest once here.
      if (!wasPlaybackErrorNotified(err)) toast.error(err instanceof Error ? err.message : "Couldn't play this track.");
    } finally {
      setStarting(null);
    }
  };

  return { play, starting };
}

function SleepingOnCard({ data, groupId, now }: { data: SongsSummary; groupId: string; now: Date }) {
  const { play, starting } = usePlayShare(groupId);
  const { shares, total } = data.sleepingOn;
  const more = moreLine(shares.length, total);

  return (
    <div className={card}>
      <div>
        <h3 className={cardTitle}>You're sleeping on</h3>
        <p className={cardSubtitle}>Shared with you, not listened to yet</p>
      </div>
      {shares.length === 0 ? (
        <p className="text-sm text-foreground">{sleepingOnEmpty(data.range)}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shares.map((share) => (
            <ShareRow
              key={share.shareId}
              share={share}
              line={sleepingOnLine(share, now)}
              action={
                <Button
                  className="min-h-11 min-w-11 shrink-0 gap-1.5"
                  onClick={() => play(share)}
                  disabled={starting === share.shareId}
                  aria-label={`Play ${share.trackName} by ${share.artistName}`}
                >
                  {starting === share.shareId ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Play className="size-4 fill-current" aria-hidden="true" />
                  )}
                  Play
                </Button>
              }
            />
          ))}
        </ul>
      )}
      {more && <p className="text-xs text-quiet">{more}</p>}
    </div>
  );
}

function SleptOnCard({ data, now }: { data: SongsSummary; now: Date }) {
  const { shares, total, others } = data.sleptOn;
  const more = moreLine(shares.length, total);
  // A stand-in: real nudge notifications are out of scope (#56).
  const nudge = () => toast.info("Nudges aren't available yet.");

  return (
    <div className={card}>
      <div>
        <h3 className={cardTitle}>The group slept on</h3>
        <p className={cardSubtitle}>Your shares nobody has listened to</p>
      </div>
      {shares.length === 0 ? (
        <p className="text-sm text-foreground">{sleptOnEmpty(data.range, others)}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shares.map((share) => (
            <ShareRow
              key={share.shareId}
              share={share}
              line={sleptOnLine(share, others, now)}
              action={
                <Button
                  variant="outline"
                  className="min-h-11 min-w-11 shrink-0"
                  onClick={nudge}
                  aria-label={`Nudge the group about ${share.trackName}`}
                >
                  Nudge
                </Button>
              }
            />
          ))}
        </ul>
      )}
      {more && <p className="text-xs text-quiet">{more}</p>}

      <div className="mt-1 flex flex-col gap-2 border-t border-hair pt-3">
        <h3 className="text-sm text-soft">Group records</h3>
        <dl className="flex flex-col gap-2">
          {recordRows(data.records, data.range).map((record) => (
            <div key={record.key} className="flex items-baseline justify-between gap-3 text-sm">
              <dt className="shrink-0 text-foreground">{record.label}</dt>
              <dd className="min-w-0 text-right font-semibold text-foreground">{record.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/**
 * "The songs" cards of Group Dynamics (#150): shares the viewer hasn't
 * listened to, with a play button; the viewer's shares nobody has listened
 * to, with a nudge; and the group's records for the period.
 */
export default function SleepingOnSection({ groupId, range }: { groupId: string; range: ViewerSummaryRange }) {
  const { data, isLoading, error, refetch } = useSongsSummary(groupId, range);
  // "2 days ago" only needs the day, so the time the section opened will do.
  const [now] = useState(() => new Date());

  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-label="Songs to catch up on and group records" data-tour="analytics-sleeping-on">
      {error ? (
        <div className={`${card} items-start md:col-span-2`} role="alert">
          <p className="text-sm text-foreground">The songs didn't load.</p>
          <Button variant="outline" className="min-h-11" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : isLoading && !data ? (
        <>
          <Skeleton className="h-56 rounded-2xl" aria-label="Loading the songs" />
          <Skeleton className="h-56 rounded-2xl" />
        </>
      ) : data ? (
        <>
          <SleepingOnCard data={data} groupId={groupId} now={now} />
          <SleptOnCard data={data} now={now} />
        </>
      ) : null}
    </section>
  );
}
