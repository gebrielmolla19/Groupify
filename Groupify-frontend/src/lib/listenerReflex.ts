import type { ListenTiming, ListenerReflexData } from '../types';
import type { ListenerReflexMode, ListenerReflexRange } from '../hooks/useListenerReflex';
import { getListeningStyleLabel } from '../utils/getListeningStyleLabel';
import { getInfluenceStyleLabel } from '../utils/getInfluenceStyleLabel';

/**
 * The words and shapes of the Listener Reflex section of Group Dynamics.
 * Every headline is built from the ranking it sits above, so the copy can't
 * contradict the numbers.
 *
 * Modes: 'received' is the Listening view (how soon each member listens to
 * others' shares); 'shared' is the Sharing view (how soon others listen to
 * each member's shares).
 */

export interface ReflexRow {
  userId: string;
  /** "You" for the viewer, otherwise the member's display name. */
  name: string;
  isViewer: boolean;
  /**
   * The member's listening (or sharing) badge, e.g. "The Enthusiast". Null in
   * the Sharing view when nobody has listened to their shares: there's
   * nothing to judge yet.
   */
  badge: string | null;
  listens: number;
  /** Median time to listen, or null when there are no listens in the period. */
  medianMs: number | null;
  /** Bar length, 0 to 100: the fastest member is 100, slower ones shorter. */
  barPercent: number;
  timing: ListenTiming;
}

// The slowest member's bar, so it stays visible next to a much faster one.
const SHORTEST_BAR = 12;

/**
 * Members fastest first, then those with no listens in the period. Bars use a
 * log scale because medians run from minutes to days.
 */
export const rankMembers = (
  data: ListenerReflexData,
  viewerId: string | undefined,
  range: ListenerReflexRange
): ReflexRow[] => {
  const { users, ringData, summary, mode } = data;
  const groupAverageListens = users.length > 0
    ? users.reduce((sum, u) => sum + u.listens, 0) / users.length
    : 0;
  const medians = users.map((u) => u.medianMs).filter((m): m is number => m !== null && m > 0);
  const fastest = medians.length > 0 ? Math.min(...medians) : 0;
  const slowest = medians.length > 0 ? Math.max(...medians) : 0;
  const spread = fastest > 0 ? Math.log(slowest / fastest) : 0;

  const barFor = (medianMs: number | null): number => {
    if (medianMs === null) return 0;
    if (spread === 0 || medianMs <= fastest) return 100;
    const slower = Math.log(medianMs / fastest) / spread; // 0 = fastest, 1 = slowest
    return Math.round(100 - slower * (100 - SHORTEST_BAR));
  };

  const rows = users.map((user): ReflexRow => {
    const points = ringData.find((r) => r.userId === user.userId)?.points ?? [];
    const badge = mode === 'shared'
      ? (user.listens > 0 ? getInfluenceStyleLabel(user, { points }, range, users.length).title : null)
      : getListeningStyleLabel(user, { points }, range, groupAverageListens, summary.groupMedianMs, users.length).title;
    const isViewer = user.userId === viewerId;
    return {
      userId: user.userId,
      name: isViewer ? 'You' : user.displayName,
      isViewer,
      badge,
      listens: user.listens,
      medianMs: user.medianMs,
      barPercent: barFor(user.medianMs),
      timing: user.timing,
    };
  });

  return rows.sort((a, b) => {
    if (a.medianMs === null && b.medianMs === null) return a.name.localeCompare(b.name);
    if (a.medianMs === null) return 1;
    if (b.medianMs === null) return -1;
    return a.medianMs - b.medianMs;
  });
};

const possessive = (name: string) => (name.endsWith('s') ? `${name}'` : `${name}'s`);

/** The card's headline: who is first in the ranking. */
export const reflexHeadline = (rows: ReflexRow[], mode: ListenerReflexMode): string => {
  const first = rows[0];
  if (!first || first.medianMs === null) return 'No listens in this period yet';
  if (mode === 'shared') {
    return first.isViewer
      ? 'Your shares get listened to fastest'
      : `${possessive(first.name)} shares get listened to fastest`;
  }
  return first.isViewer ? "You're the fastest to listen" : `${first.name} is the fastest to listen`;
};

/** What the ranking measures, under the headline. */
export const reflexExplainer = (mode: ListenerReflexMode): string =>
  mode === 'shared'
    ? "How long the group typically takes to listen to each member's shares. Tap a member for the breakdown."
    : 'How long each member typically takes to listen to a share after it is shared. Tap a member for the breakdown.';

/** The heading over the selected member's four buckets. */
export const breakdownTitle = (mode: ListenerReflexMode, name: string, isViewer: boolean): string => {
  if (mode === 'shared') {
    return isViewer ? 'When others listen to your shares' : `When others listen to ${possessive(name)} shares`;
  }
  return isViewer ? 'When you listen to a new share' : `When ${name} listens to a new share`;
};

/** Shown instead of the buckets when the selected member has no listens. */
export const emptyBreakdownLine = (mode: ListenerReflexMode, name: string, isViewer: boolean): string => {
  if (mode === 'shared') {
    return isViewer
      ? 'Nobody has listened to your shares in this period yet.'
      : `Nobody has listened to ${possessive(name)} shares in this period yet.`;
  }
  return isViewer
    ? "You haven't listened to a share in this period yet."
    : `${name} hasn't listened to a share in this period yet.`;
};

export interface BreakdownRow {
  key: keyof ListenTiming;
  label: string;
  count: number;
  /** Bar length, 0 to 100, relative to the biggest bucket. */
  percent: number;
}

const BUCKETS: { key: keyof ListenTiming; label: string }[] = [
  { key: 'sameHour', label: 'Same hour' },
  { key: 'sameDay', label: 'Same day' },
  { key: 'withinWeek', label: 'Within the week' },
  { key: 'later', label: 'Later' },
];

export const breakdownRows = (timing: ListenTiming): BreakdownRow[] => {
  const most = Math.max(...BUCKETS.map((b) => timing[b.key]));
  return BUCKETS.map(({ key, label }) => ({
    key,
    label,
    count: timing[key],
    percent: most > 0 ? Math.round((timing[key] / most) * 100) : 0,
  }));
};
