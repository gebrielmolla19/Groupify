import { useState } from "react";
import { Skeleton } from "../../ui/skeleton";
import { Button } from "../../ui/button";
import { ToggleGroup, ToggleGroupItem } from "../../ui/toggle-group";
import { eyebrow } from "../profile/SettingsSection";
import { useViewerSummary } from "../../../hooks/useViewerSummary";
import {
  bestShareLine,
  discoveryLine,
  formatWait,
  hitRateLine,
  hitRatePercent,
  previousRoleLine,
  reflexLine,
  roleLabel,
  streakLine,
} from "../../../lib/viewerSummaryCopy";
import type { ViewerSummary, ViewerSummaryRange } from "../../../types/analytics";

const RANGES: { value: ViewerSummaryRange; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "all", label: "All" },
];

const card = "flex flex-col gap-1.5 rounded-2xl border border-hair bg-raised p-4 md:p-5";
const cardLabel = "text-sm text-soft";
const bigNumber = "font-display text-3xl font-semibold text-foreground";

/** A ring that fills to `percent`, in iris because it's the viewer's number. */
function HitRateRing({ percent }: { percent: number | null }) {
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const filled = percent === null ? 0 : (percent / 100) * circumference;
  return (
    <svg viewBox="0 0 64 64" className="size-16 shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="8" className="stroke-hair" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        className="stroke-iris"
      />
    </svg>
  );
}

function YouCards({ data, range }: { data: ViewerSummary; range: ViewerSummaryRange }) {
  const percent = hitRatePercent(data.hitRate);
  const reflex = reflexLine(data.reflex);
  const { youPlayMs, groupPlayMs, yoursPlayedMs, groupYoursPlayedMs } = data.reflex;

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
      <div className={`${card} md:col-span-2`}>
        <p className={cardLabel}>{roleLabel(range)}</p>
        <p className="font-display text-2xl font-semibold text-iris md:text-3xl">{data.role.title}</p>
        <p className="text-sm text-foreground">{data.role.reason}</p>
        {data.previousRole && (
          <p className="text-xs text-quiet">{previousRoleLine(range, data.previousRole.title)}</p>
        )}
      </div>

      <div className={`${card} flex-row items-center gap-4`}>
        <HitRateRing percent={percent} />
        <div className="flex min-w-0 flex-col gap-1">
          <p className={cardLabel}>Hit rate</p>
          <p className={bigNumber}>{percent === null ? "–" : `${percent}%`}</p>
          <p className="text-sm text-soft">{hitRateLine(data.hitRate)}</p>
        </div>
      </div>

      <div className={card}>
        <p className={cardLabel}>Sharing streak</p>
        <p className={bigNumber}>
          {data.streak.longest} {data.streak.longest === 1 ? "day" : "days"}
        </p>
        <p className="text-sm text-soft">{streakLine(data.streak, range)}</p>
      </div>

      <div className={card}>
        <p className={cardLabel}>Your best-landing share</p>
        {data.bestShare ? (
          <>
            <p className="truncate font-display text-xl font-semibold text-foreground">{data.bestShare.trackName}</p>
            <p className="text-sm text-soft">{bestShareLine(data.bestShare)}</p>
          </>
        ) : (
          <p className="text-sm text-soft">None of your shares in this period has a listen or like from others yet.</p>
        )}
      </div>

      <div className={card}>
        <p className={cardLabel}>Discovery credit</p>
        {data.discovery.artists > 0 && <p className={bigNumber}>{data.discovery.artists}</p>}
        <p className="text-sm text-soft">{discoveryLine(data.discovery)}</p>
      </div>

      <div className={`${card} md:col-span-2`}>
        <p className={cardLabel}>Your reflex</p>
        <dl className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-soft">You play others' shares in</dt>
            <dd className="font-mono text-lg text-iris">{youPlayMs === null ? "–" : formatWait(youPlayMs)}</dd>
            {groupPlayMs !== null && <dd className="text-xs text-quiet">Group typical: {formatWait(groupPlayMs)}</dd>}
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-soft">Your shares get played in</dt>
            <dd className="font-mono text-lg text-iris">{yoursPlayedMs === null ? "–" : formatWait(yoursPlayedMs)}</dd>
            {groupYoursPlayedMs !== null && (
              <dd className="text-xs text-quiet">Group typical: {formatWait(groupYoursPlayedMs)}</dd>
            )}
          </div>
        </dl>
        <p className="text-sm text-foreground">{reflex ?? "Shows once there are listens to compare."}</p>
      </div>
    </div>
  );
}

/**
 * The top of Group Dynamics: the signed-in member's own numbers for the
 * chosen period. Iris marks the viewer, as everywhere in the app.
 */
export default function YouSection({ groupId }: { groupId: string }) {
  const [range, setRange] = useState<ViewerSummaryRange>("30d");
  const { data, isLoading, error, refetch } = useViewerSummary(groupId, range);

  return (
    <section className="flex flex-col gap-3 md:gap-4" aria-labelledby="you-heading" data-tour="analytics-you">
      <div className="flex flex-wrap items-center justify-between gap-2 px-2">
        <h2 id="you-heading" className={eyebrow}>You</h2>
        <ToggleGroup
          type="single"
          value={range}
          // Radix sends "" when the selected chip is pressed again; keep it selected.
          onValueChange={(next) => next && setRange(next as ViewerSummaryRange)}
          role="radiogroup"
          aria-label="Period for your numbers"
          className="gap-1.5"
        >
          {RANGES.map((option) => (
            <ToggleGroupItem
              key={option.value}
              value={option.value}
              className="min-h-11 min-w-11 flex-none rounded-xl first:rounded-xl last:rounded-xl border border-line px-3 font-mono text-xs text-foreground hover:bg-raised hover:text-foreground data-[state=on]:border-iris data-[state=on]:bg-selected data-[state=on]:text-foreground"
            >
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {error ? (
        <div className={`${card} items-start`} role="alert">
          <p className="text-sm text-foreground">Your numbers didn't load.</p>
          <Button variant="outline" className="min-h-11" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : isLoading && !data ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4" aria-busy="true" aria-label="Loading your numbers">
          <Skeleton className="h-32 rounded-2xl md:col-span-2" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
      ) : data ? (
        <YouCards data={data} range={data.range} />
      ) : null}
    </section>
  );
}
