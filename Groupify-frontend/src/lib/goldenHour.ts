import type { GoldenHour, TimeOfDayBucket } from '../types/analytics';

/**
 * The numbers and words of the golden hour heatmap and group streak. Every
 * sentence is built from the counts it describes, so it can't contradict them.
 */

export type GoldenHourMode = 'both' | 'shares' | 'listens';

/** Heatmap rows, in the order the backend sends them. */
export const WEEKDAYS = [
  { short: 'Mon', long: 'Monday' },
  { short: 'Tue', long: 'Tuesday' },
  { short: 'Wed', long: 'Wednesday' },
  { short: 'Thu', long: 'Thursday' },
  { short: 'Fri', long: 'Friday' },
  { short: 'Sat', long: 'Saturday' },
  { short: 'Sun', long: 'Sunday' },
] as const;

/** Below this many events in the period, a "busiest time" would be noise. */
export const MIN_EVENTS_FOR_PEAK = 5;

/** Shades of the heatmap above empty. */
export const HEAT_LEVELS = 4;

const UNITS: Record<GoldenHourMode, { one: string; many: string }> = {
  both: { one: 'share or listen', many: 'shares and listens' },
  shares: { one: 'share', many: 'shares' },
  listens: { one: 'listen', many: 'listens' },
};

export const countLabel = (n: number, mode: GoldenHourMode): string =>
  `${n} ${n === 1 ? UNITS[mode].one : UNITS[mode].many}`;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const clock = (hour: number): string => {
  const h = hour % 24;
  return `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`;
};

/** "4pm–8pm" */
export const timeRangeLabel = (bucket: TimeOfDayBucket): string =>
  `${clock(bucket.startHour)}–${clock(bucket.endHour)}`;

/** "Thursday evening" */
export const cellName = (row: number, bucket: TimeOfDayBucket): string =>
  `${WEEKDAYS[row].long} ${bucket.label.toLowerCase()}`;

/** The grid for one mode: shares, listens, or both added together. */
export const cellCounts = (data: GoldenHour, mode: GoldenHourMode): number[][] => {
  if (mode === 'shares') return data.shares;
  if (mode === 'listens') return data.listens;
  return data.shares.map((row, r) => row.map((n, c) => n + data.listens[r][c]));
};

export const modeTotal = (data: GoldenHour, mode: GoldenHourMode): number =>
  mode === 'shares' ? data.totals.shares : mode === 'listens' ? data.totals.listens : data.totals.shares + data.totals.listens;

/** 0 for an empty cell, else 1..HEAT_LEVELS relative to the busiest cell. */
export const heatLevel = (count: number, max: number): number =>
  count <= 0 || max <= 0 ? 0 : Math.max(1, Math.ceil((count / max) * HEAT_LEVELS));

/** The cell or cells with the most activity. */
export const peakCells = (counts: number[][]) => {
  const count = Math.max(0, ...counts.flat());
  const cells: { row: number; column: number }[] = [];
  if (count > 0) {
    counts.forEach((row, r) => row.forEach((n, c) => {
      if (n === count) cells.push({ row: r, column: c });
    }));
  }
  return { cells, count };
};

/** The headline under the heatmap: when the group is busiest, or why that's not known yet. */
export const peakLine = (data: GoldenHour, mode: GoldenHourMode): string => {
  const total = modeTotal(data, mode);
  if (total === 0) return `No ${UNITS[mode].many} in this period yet.`;
  if (total < MIN_EVENTS_FOR_PEAK) return `Too early to call a golden hour: ${countLabel(total, mode)} so far.`;

  const { cells, count } = peakCells(cellCounts(data, mode));
  const names = cells.map(({ row, column }) => cellName(row, data.buckets[column]));
  if (cells.length === 1) {
    const bucket = data.buckets[cells[0].column];
    return `Busiest: ${names[0]} (${timeRangeLabel(bucket)}), with ${countLabel(count, mode)}.`;
  }
  const named = cells.length === 2
    ? `${names[0]} and ${names[1]}`
    : `${names[0]}, ${names[1]} and ${cells.length - 2} more`;
  return `Busiest: ${named}, with ${countLabel(count, mode)} each.`;
};

/** The line under the streak number. */
export const streakLine = (streak: GoldenHour['streak']): string => {
  const history = streak.record > 0
    ? `Longest in this period: ${plural(streak.longest, 'day')}. Record: ${plural(streak.record, 'day')}.`
    : '';
  if (streak.current > 0) return history;
  if (streak.record === 0) return 'A share or listen today starts one.';
  return `A share or listen today starts a new one. ${history}`;
};
