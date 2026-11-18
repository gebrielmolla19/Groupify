import type { Share, User } from '../types';
import { isUser } from './heardStack';

export const FEED_FILTERS = ['all', 'unheard', 'yours', 'liked'] as const;
export type FeedFilter = (typeof FEED_FILTERS)[number];

/** Whether a value (say, from the URL) names a feed filter. */
export const isFeedFilter = (value: string | null): value is FeedFilter =>
  (FEED_FILTERS as readonly (string | null)[]).includes(value);

type Viewer = Pick<User, '_id' | 'id'> | null | undefined;

/**
 * Whether a share belongs under a feed filter, for the signed-in viewer.
 * Same definitions as the song row: unheard means shared by someone else and
 * with no listen by the viewer. Without a viewer only "all" matches.
 */
function matches(share: Share, filter: FeedFilter, viewer: Viewer): boolean {
  if (filter === 'all') return true;
  if (!viewer) return false;
  const mine = isUser(share.sharedBy, viewer);
  switch (filter) {
    case 'unheard':
      return !mine && !share.listeners.some((l) => isUser(l.user, viewer));
    case 'yours':
      return mine;
    case 'liked':
      return share.likes?.some((like) => isUser(like.user, viewer)) ?? false;
  }
}

/** The shares under a filter, in feed order. */
export function filterShares(shares: Share[], filter: FeedFilter, viewer: Viewer): Share[] {
  return shares.filter((share) => matches(share, filter, viewer));
}

/** How many shares each filter would show. */
export function countShares(shares: Share[], viewer: Viewer): Record<FeedFilter, number> {
  const counts = { all: 0, unheard: 0, yours: 0, liked: 0 };
  for (const share of shares) {
    for (const filter of FEED_FILTERS) if (matches(share, filter, viewer)) counts[filter]++;
  }
  return counts;
}
