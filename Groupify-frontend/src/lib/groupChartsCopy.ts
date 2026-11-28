// Plain-language headlines for the group charts on Group Dynamics:
// Resonance Frequency, Taste Gravity and Hall of Fame.
import type { AnalyticsRange, TasteGravityResponse } from '../types/analytics';

const PERIOD: Record<AnalyticsRange, string> = {
  '7d': 'in the last 7 days',
  '30d': 'in the last 30 days',
  all: 'so far',
};

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** Resonance Frequency: how much happened in the period, and its busiest day. */
export function activityHeadline(
  totals: { shares: number; activity: number; peakDay: string | null },
  mode: 'shares' | 'engagement',
  range: AnalyticsRange
): string {
  if (totals.activity === 0 && totals.shares === 0) {
    return range === 'all' ? 'No shares, listens or likes yet.' : `No shares, listens or likes ${PERIOD[range]}.`;
  }
  const what =
    mode === 'shares'
      ? `The group shared ${totals.shares} ${plural(totals.shares, 'song', 'songs')} ${PERIOD[range]}.`
      : `The group made ${totals.activity} shares, listens and likes ${PERIOD[range]}.`;
  return totals.peakDay ? `${what} The busiest day was ${totals.peakDay}.` : what;
}

// D3's force simulation replaces a link's ends with the node objects.
type LinkEnd = string | { id: string };
const endId = (end: LinkEnd) => (typeof end === 'string' ? end : end.id);

/** Taste Gravity: the member whose taste is closest to the viewer's. */
export function tasteHeadline(data: TasteGravityResponse, viewerId: string | undefined): string {
  if (!viewerId || !data.nodes.some((n) => n.id === viewerId)) {
    return 'Members are pulled together by the artists they both listen to.';
  }
  let closest: { id: string; gravity: number } | null = null;
  for (const link of data.links) {
    const source = endId(link.source as LinkEnd);
    const target = endId(link.target as LinkEnd);
    if (source !== viewerId && target !== viewerId) continue;
    if (!closest || link.gravity > closest.gravity) {
      closest = { id: source === viewerId ? target : source, gravity: link.gravity };
    }
  }
  const name = closest && data.nodes.find((n) => n.id === closest.id)?.name;
  return name ? `You're closest in taste to ${name}.` : "You don't share a top artist with anyone in this period yet.";
}

export type SuperlativeKind = 'trendsetter' | 'hypeMan' | 'dj' | 'diehard';

const SUPERLATIVE: Record<SuperlativeKind, { did: string; one: string; many: string }> = {
  trendsetter: { did: 'got the most likes', one: 'like received', many: 'likes received' },
  hypeMan: { did: 'gave the most likes', one: 'like given', many: 'likes given' },
  dj: { did: 'shared the most songs', one: 'song shared', many: 'songs shared' },
  diehard: { did: 'listened to the most songs', one: 'song listened to', many: 'songs listened to' },
};

/** Hall of Fame headline. `name` is null when the viewer holds the title. */
export const superlativeHeadline = (kind: SuperlativeKind, name: string | null): string =>
  `${name ?? 'You'} ${SUPERLATIVE[kind].did}`;

/** The unit after a Hall of Fame number. */
export const superlativeValue = (kind: SuperlativeKind, value: number): string =>
  plural(value, SUPERLATIVE[kind].one, SUPERLATIVE[kind].many);
