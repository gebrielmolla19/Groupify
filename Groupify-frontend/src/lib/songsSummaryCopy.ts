import { formatWait } from './viewerSummaryCopy';
import type { SongsSummary, SongsSummaryShare, ViewerSummaryRange } from '../types/analytics';

/**
 * The words on "The songs" cards of Group Dynamics. Every sentence is built
 * from the numbers it sits next to.
 */

const DAY_MS = 86_400_000;

const PERIOD: Record<ViewerSummaryRange, string> = {
  '7d': 'in the last 7 days',
  '30d': 'in the last 30 days',
  all: 'yet',
};

/** "today", "yesterday", "3 days ago" */
export const sharedAgo = (sharedAt: string, now: Date): string => {
  const days = Math.floor((now.getTime() - new Date(sharedAt).getTime()) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
};

const sharerName = (share: SongsSummaryShare) => share.sharedBy.displayName ?? 'a member';

/** "Tame Impala · from Dre · 2 days ago" */
export const sleepingOnLine = (share: SongsSummaryShare, now: Date): string =>
  `${share.artistName} · from ${sharerName(share)} · ${sharedAgo(share.sharedAt, now)}`;

/** "Phoebe Bridgers · 6 days ago · 0 of 4 listened" */
export const sleptOnLine = (share: SongsSummaryShare, others: number, now: Date): string =>
  `${share.artistName} · ${sharedAgo(share.sharedAt, now)} · 0 of ${others} listened`;

/** "And 3 more" under a list that shows only some of its shares. */
export const moreLine = (shown: number, total: number): string | null =>
  total > shown ? `And ${total - shown} more` : null;

export const sleepingOnEmpty = (range: ViewerSummaryRange): string =>
  range === 'all'
    ? "You've listened to every share from the others."
    : `You've listened to every share from the others ${PERIOD[range]}.`;

export const sleptOnEmpty = (range: ViewerSummaryRange, others: number): string => {
  if (others === 0) return 'Shows once someone else is in the group.';
  return range === 'all'
    ? 'Every share of yours has a listen, or is under a day old.'
    : `Every share of yours ${PERIOD[range]} has a listen, or is under a day old.`;
};

export type RecordRow = { key: string; label: string; value: string };

/** The three group records, each a value or a sentence saying why there's none. */
export const recordRows = (records: SongsSummary['records'], range: ViewerSummaryRange): RecordRow[] => {
  const { fastestFullListen: fastest, mostLiked, longestStreak } = records;
  const period = PERIOD[range];
  return [
    {
      key: 'fastest',
      label: 'Fastest full-group listen',
      value: fastest
        ? `${fastest.trackName} · ${formatWait(fastest.ms)}`
        : `No share has a listen from everyone ${period}`,
    },
    {
      key: 'most-liked',
      label: 'Most liked',
      value: mostLiked
        ? `${mostLiked.trackName} · ${mostLiked.likes} of ${mostLiked.others}`
        : `No likes ${period}`,
    },
    {
      key: 'streak',
      label: 'Longest group streak',
      value: longestStreak
        ? `${longestStreak.days} ${longestStreak.days === 1 ? 'day' : 'days'}`
        : `No shares ${period}`,
    },
  ];
};
