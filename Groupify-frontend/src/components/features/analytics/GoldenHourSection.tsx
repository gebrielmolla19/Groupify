import { useState } from "react";
import { Skeleton } from "../../ui/skeleton";
import { Button } from "../../ui/button";
import { ToggleGroup, ToggleGroupItem } from "../../ui/toggle-group";
import { eyebrow } from "../profile/SettingsSection";
import { useGoldenHour } from "../../../hooks/useGoldenHour";
import {
  WEEKDAYS,
  cellCounts,
  cellName,
  countLabel,
  heatLevel,
  peakCells,
  peakLine,
  streakLine,
  timeRangeLabel,
  type GoldenHourMode,
} from "../../../lib/goldenHour";
import type { GoldenHour, GoldenHourRange } from "../../../types/analytics";

const MODES: { value: GoldenHourMode; label: string }[] = [
  { value: "both", label: "Both" },
  { value: "shares", label: "Shares" },
  { value: "listens", label: "Listens" },
];

const card = "flex flex-col gap-3 rounded-2xl border border-hair bg-raised p-4 md:p-5";
const cardLabel = "text-sm text-soft";

/**
 * One hue, light to dark: iris mixed into the card surface. The faintest
 * shade still reaches 2:1 against the card in both themes (checked with the
 * dataviz validator); an empty cell is the pane colour with a hairline.
 */
const HEAT_CLASSES = [
  "bg-pane ring-1 ring-inset ring-hair",
  "bg-[color-mix(in_oklab,var(--iris)_46%,var(--raised))]",
  "bg-[color-mix(in_oklab,var(--iris)_64%,var(--raised))]",
  "bg-[color-mix(in_oklab,var(--iris)_82%,var(--raised))]",
  "bg-iris",
];

const startClock = (hour: number) => `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? "a" : "p"}`;

/**
 * The visible heatmap: time of day down, weekday across, so it fits a
 * phone without scrolling. Screen readers get the table below instead.
 */
function Heatmap({ data, mode }: { data: GoldenHour; mode: GoldenHourMode }) {
  const counts = cellCounts(data, mode);
  const { count: max } = peakCells(counts);

  return (
    <div aria-hidden="true" className="grid grid-cols-[2.25rem_repeat(7,minmax(0,1fr))] gap-1">
      <span />
      {WEEKDAYS.map((day) => (
        <span key={day.short} className="text-center font-mono text-[11px] text-quiet">
          {day.short}
        </span>
      ))}
      {data.buckets.map((bucket, column) => (
        <div key={bucket.id} className="contents">
          <span className="self-center font-mono text-[11px] text-quiet">{startClock(bucket.startHour)}</span>
          {WEEKDAYS.map((day, row) => {
            const n = counts[row][column];
            return (
              <span
                key={day.short}
                title={`${cellName(row, bucket)} (${timeRangeLabel(bucket)}): ${countLabel(n, mode)}`}
                className={`aspect-square rounded-md md:aspect-auto md:h-9 ${HEAT_CLASSES[heatLevel(n, max)]}`}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function HeatLegend() {
  return (
    <div className="flex items-center justify-end gap-1.5 font-mono text-[11px] text-quiet" aria-hidden="true">
      <span>Less</span>
      {HEAT_CLASSES.map((shade) => (
        <span key={shade} className={`size-3 rounded-sm ${shade}`} />
      ))}
      <span>More</span>
    </div>
  );
}

/**
 * Every cell as text, for screen readers. Always lists shares and listens.
 * The wrapper is what's visually hidden: `sr-only` on a table doesn't clip it.
 */
function HeatTable({ data }: { data: GoldenHour }) {
  return (
    <div className="sr-only">
      <table>
        <caption>Shares and listens by weekday and time of day, in your time zone</caption>
        <thead>
          <tr>
            <th scope="col">Time of day</th>
            {WEEKDAYS.map((day) => (
              <th key={day.short} scope="col">{day.long}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.buckets.map((bucket, column) => (
            <tr key={bucket.id}>
              <th scope="row">{`${bucket.label}, ${timeRangeLabel(bucket)}`}</th>
              {WEEKDAYS.map((day, row) => (
                <td key={day.short}>
                  {`${countLabel(data.shares[row][column], "shares")}, ${countLabel(data.listens[row][column], "listens")}`}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GoldenHourCards({ data }: { data: GoldenHour }) {
  const [mode, setMode] = useState<GoldenHourMode>("both");
  const nothing = data.totals.shares + data.totals.listens === 0;
  const days = data.streak.current;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]">
      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={cardLabel}>When the group shares and listens</p>
          {!nothing && (
            <ToggleGroup
              type="single"
              value={mode}
              // Radix sends "" when the selected chip is pressed again; keep it selected.
              onValueChange={(next) => next && setMode(next as GoldenHourMode)}
              role="radiogroup"
              aria-label="What the heatmap counts"
              className="gap-1.5"
            >
              {MODES.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  className="min-h-11 min-w-11 flex-none rounded-xl first:rounded-xl last:rounded-xl border border-line px-3 font-mono text-xs text-foreground hover:bg-pane hover:text-foreground data-[state=on]:border-iris data-[state=on]:bg-selected data-[state=on]:text-foreground"
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        </div>
        <p className="text-base font-medium text-foreground" aria-live="polite">
          {nothing ? "No shares or listens in this period yet. The heatmap fills in as the group plays." : peakLine(data, mode)}
        </p>
        {!nothing && (
          <>
            <Heatmap data={data} mode={mode} />
            <HeatLegend />
            <HeatTable data={data} />
          </>
        )}
      </div>

      <div className={`${card} md:self-start`}>
        <p className={cardLabel}>Group streak</p>
        <p className="font-display text-3xl font-semibold text-foreground">
          {days} {days === 1 ? "day" : "days"}
        </p>
        <p className="text-sm text-soft">
          {days > 0 ? "in a row with a share or listen from someone in the group. " : ""}
          {streakLine(data.streak)}
        </p>
      </div>
    </div>
  );
}

/**
 * Golden hour and group streak, in "The group" part of Group Dynamics:
 * when in the week the group is active, and for how many days running.
 * Weekdays, hours and days are the viewer's own time zone.
 */
export default function GoldenHourSection({ groupId, range }: { groupId: string; range: GoldenHourRange }) {
  const { data, isLoading, error, refetch } = useGoldenHour(groupId, range);

  return (
    <section className="flex flex-col gap-3 md:gap-4" aria-labelledby="golden-hour-heading" data-tour="analytics-golden-hour">
      <h2 id="golden-hour-heading" className={`${eyebrow} px-2`}>Golden hour</h2>

      {error ? (
        <div className={`${card} items-start`} role="alert">
          <p className="text-sm text-foreground">The golden hour didn't load.</p>
          <Button variant="outline" className="min-h-11" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : isLoading && !data ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]" aria-busy="true" aria-label="Loading the golden hour">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      ) : data ? (
        <GoldenHourCards data={data} />
      ) : null}
    </section>
  );
}
