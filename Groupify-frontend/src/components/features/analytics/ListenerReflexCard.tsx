import { useId, useMemo, useState } from 'react';
import { Button } from '../../ui/button';
import { Skeleton } from '../../ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '../../ui/toggle-group';
import { useUser } from '../../../contexts/UserContext';
import { useListenerReflex, type ListenerReflexMode } from '../../../hooks/useListenerReflex';
import type { AnalyticsRange } from '../../../types/analytics';
import {
  breakdownRows,
  breakdownTitle,
  emptyBreakdownLine,
  rankMembers,
  reflexExplainer,
  reflexHeadline,
  type ReflexRow,
} from '../../../lib/listenerReflex';
import { formatWait } from '../../../lib/viewerSummaryCopy';
import { cn } from '../../../lib/utils';

interface ListenerReflexCardProps {
  groupId: string;
  /** The period to rank; the page's range control owns it. */
  range: AnalyticsRange;
}

const MODES: { value: ListenerReflexMode; label: string }[] = [
  { value: 'received', label: 'Listening' },
  { value: 'shared', label: 'Sharing' },
];

const card = 'rounded-2xl border border-hair bg-raised p-4 md:p-6';
// Bars grow when the numbers change, unless the member asked for less motion.
const barMotion = 'motion-safe:transition-[width] motion-safe:duration-500 motion-safe:ease-out';

function ModeToggle({ mode, onChange }: { mode: ListenerReflexMode; onChange: (mode: ListenerReflexMode) => void }) {
  return (
    <ToggleGroup
      type="single"
      value={mode}
      // Radix sends "" when the selected option is pressed again; keep it selected.
      onValueChange={(next) => next && onChange(next as ListenerReflexMode)}
      role="radiogroup"
      aria-label="Rank by"
      className="w-fit gap-1 rounded-xl border border-hair p-1"
    >
      {MODES.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          className="min-h-11 flex-none rounded-lg first:rounded-lg last:rounded-lg px-4 text-sm font-medium text-soft hover:bg-selected hover:text-foreground data-[state=on]:bg-iris data-[state=on]:text-on-iris"
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function MemberRow({
  row,
  selected,
  onSelect,
  controls,
}: {
  row: ReflexRow;
  selected: boolean;
  onSelect: () => void;
  controls: string;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-controls={controls}
        className={cn(
          'flex min-h-11 w-full flex-col gap-2 rounded-xl border px-3 py-2.5 text-left',
          'outline-none focus-visible:ring-2 focus-visible:ring-ring',
          // Iris is the viewer's colour, so selection uses the plain strong line.
          selected ? 'border-foreground/60 bg-selected' : 'border-hair hover:bg-selected'
        )}
      >
        <span className="flex w-full min-w-0 items-start gap-2">
          {/* On a phone the badge wraps under the name rather than being cut off. */}
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn('min-w-0 break-words font-semibold', row.isViewer ? 'text-iris' : 'text-foreground')}>
              {row.name}
            </span>
            {row.badge && (
              <span className="rounded-full border border-line px-2 py-0.5 text-xs text-soft">
                {row.badge}
              </span>
            )}
          </span>
          <span className="shrink-0 pl-2 text-sm font-semibold text-foreground">
            {row.medianMs === null ? (
              <span className="font-normal text-quiet">No listens</span>
            ) : (
              <>
                <span className="sr-only">median </span>
                {formatWait(row.medianMs)}
              </>
            )}
          </span>
        </span>
        <span className="h-1.5 w-full overflow-hidden rounded-full bg-hair" aria-hidden="true">
          <span
            className={cn('block h-full rounded-full', barMotion, row.isViewer ? 'bg-iris' : 'bg-foreground')}
            style={{ width: `${row.barPercent}%` }}
          />
        </span>
      </button>
    </li>
  );
}

function Breakdown({ row, mode, id }: { row: ReflexRow; mode: ListenerReflexMode; id: string }) {
  const headingId = `${id}-heading`;
  return (
    <section id={id} aria-labelledby={headingId} aria-live="polite" className="flex flex-col gap-3 border-t border-hair pt-4">
      <h4 id={headingId} className="text-sm text-soft">
        {breakdownTitle(mode, row.name, row.isViewer)}
      </h4>
      {row.listens === 0 ? (
        <p className="text-sm text-foreground">{emptyBreakdownLine(mode, row.name, row.isViewer)}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {breakdownRows(row.timing).map((bucket) => (
            <li key={bucket.key} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3 text-sm">
              <span className="text-foreground">{bucket.label}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-hair" aria-hidden="true">
                <span
                  className={cn('block h-full rounded-full', barMotion, row.isViewer ? 'bg-iris' : 'bg-foreground')}
                  style={{ width: `${bucket.percent}%` }}
                />
              </span>
              <span className="text-right font-semibold text-foreground">{bucket.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ReflexSkeleton() {
  return (
    <div className={cn(card, 'grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]')} aria-busy="true" aria-label="Loading Listener Reflex">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-11 w-48" />
      </div>
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((n) => (
          <Skeleton key={n} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/**
 * Listener Reflex, in Group Dynamics: one ranked list of how soon members
 * listen after a share (Listening), or how soon others listen to each
 * member's shares (Sharing). Tapping a member shows when their listens
 * landed: the same hour, the same day, within the week, or later.
 */
export default function ListenerReflexCard({ groupId, range }: ListenerReflexCardProps) {
  const [mode, setMode] = useState<ListenerReflexMode>('received');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { user } = useUser();
  const viewerId = user?._id || user?.id;
  const { data, isLoading, error, refetch } = useListenerReflex(groupId, range, mode);
  const breakdownId = useId();

  const rows = useMemo(() => (data ? rankMembers(data, viewerId, range) : []), [data, viewerId, range]);

  if (error) {
    return (
      <div className={cn(card, 'flex flex-col items-start gap-3')} role="alert">
        <p className="text-sm text-foreground">Listener Reflex didn't load.</p>
        <Button variant="outline" className="min-h-11" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (isLoading && !data) return <ReflexSkeleton />;
  if (!data) return null;

  const hasListens = rows.some((r) => r.medianMs !== null);
  // The words follow the numbers on screen: while the other mode loads, the
  // headline and breakdown keep describing the ranking that's still shown.
  const shownMode = data.mode;
  const selected = rows.find((r) => r.userId === selectedId)
    ?? rows.find((r) => r.isViewer)
    ?? rows[0];

  return (
    <div className={cn(card, 'grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-center', isLoading && 'opacity-70')}>
      <div className="flex flex-col gap-3">
        <h3 className="font-display text-2xl font-semibold text-foreground md:text-3xl">
          {rows.length < 2 ? 'Better with company' : reflexHeadline(rows, shownMode)}
        </h3>
        <p className="text-sm text-soft">
          {rows.length < 2
            ? 'Listener Reflex compares members, so it needs at least two. Invite someone to the group.'
            : reflexExplainer(shownMode)}
        </p>
        {rows.length >= 2 && <ModeToggle mode={mode} onChange={setMode} />}
      </div>

      {rows.length >= 2 && (
        <div className="flex min-w-0 flex-col gap-4">
          {hasListens ? (
            <>
              <ol aria-label={shownMode === 'shared' ? 'Members, shares listened to fastest first' : 'Members, fastest to listen first'} className="flex flex-col gap-2">
                {rows.map((row) => (
                  <MemberRow
                    key={row.userId}
                    row={row}
                    selected={row.userId === selected?.userId}
                    onSelect={() => setSelectedId(row.userId)}
                    controls={breakdownId}
                  />
                ))}
              </ol>
              {selected && <Breakdown row={selected} mode={shownMode} id={breakdownId} />}
            </>
          ) : (
            <p className="text-sm text-foreground">
              Once members listen to each other's shares in this period, their times show up here.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
