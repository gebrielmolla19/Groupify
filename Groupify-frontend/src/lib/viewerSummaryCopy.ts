import type { ViewerSummary, ViewerSummaryRange } from '../types/analytics';

/**
 * The words on the "You" cards of Group Dynamics. Every sentence is built
 * from the numbers it sits next to, so the copy can't contradict them.
 */

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const PERIOD: Record<ViewerSummaryRange, string> = {
  '7d': 'last 7 days',
  '30d': 'last 30 days',
  all: 'all time',
};

/** "Your role, last 30 days" */
export const roleLabel = (range: ViewerSummaryRange): string =>
  range === 'all' ? 'Your role so far' : `Your role, ${PERIOD[range]}`;

/** "Previous 30 days: Patient Zero" */
export const previousRoleLine = (range: ViewerSummaryRange, title: string): string =>
  `Previous ${range === '7d' ? '7' : '30'} days: ${title}`;

/** How long a wait is, in the unit a person would say: "6 min", "3 hr", "2 days". */
export const formatWait = (ms: number): string => {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(ms / 3_600_000);
  if (hours < 48) return `${hours} hr`;
  return plural(Math.round(ms / 86_400_000), 'day');
};

export const hitRatePercent = (hitRate: ViewerSummary['hitRate']): number | null =>
  hitRate && hitRate.total > 0 ? Math.round((hitRate.hits / hitRate.total) * 100) : null;

export const hitRateLine = (hitRate: ViewerSummary['hitRate']): string => {
  if (!hitRate) return 'Shows once someone else is in the group.';
  if (hitRate.total === 0) return 'None of your shares in this period yet.';
  return `${hitRate.hits} of your ${plural(hitRate.total, 'share')} ${hitRate.total === 1 ? 'was' : 'were'} listened to by everyone.`;
};

export const streakLine = (streak: ViewerSummary['streak'], range: ViewerSummaryRange): string => {
  if (range === 'all') return 'Your longest run of days with a share.';
  const record = `Record: ${streak.record}.`;
  return streak.longest === 0
    ? `No shares in the ${PERIOD[range]}. ${record}`
    : `Your longest in the ${PERIOD[range]}. ${record}`;
};

const outOf = (n: number, others: number, verb: string) =>
  n === others && others > 1 ? `all ${others} ${verb}` : `${n} of ${others} ${verb}`;

/** "Frank Ocean · all 4 listened, 3 of 4 liked" */
export const bestShareLine = (share: NonNullable<ViewerSummary['bestShare']>): string =>
  `${share.artistName} · ${outOf(share.listens, share.others, 'listened')}, ${outOf(share.likes, share.others, 'liked')}`;

export const discoveryLine = (discovery: ViewerSummary['discovery']): string => {
  if (discovery.artists === 0) return 'No artists you brought to the group first in this period.';
  const again = discovery.resharedByOthers === 0
    ? 'None shared again by others yet.'
    : `${discovery.resharedByOthers} ${discovery.resharedByOthers === 1 ? 'was' : 'were'} shared again by others.`;
  return `${discovery.artists === 1 ? 'artist' : 'artists'} you brought to the group first. ${again}`;
};

type Pace = 'faster' | 'slower' | 'about the same';
const pace = (mine: number, typical: number): Pace => {
  if (mine < typical * 0.8) return 'faster';
  if (mine > typical * 1.25) return 'slower';
  return 'about the same';
};

/**
 * One sentence comparing the viewer's two speeds with the group's typical
 * member, or null when there's nothing to compare yet.
 */
export const reflexLine = (reflex: ViewerSummary['reflex']): string | null => {
  const parts: string[] = [];
  if (reflex.youPlayMs !== null && reflex.groupPlayMs !== null) {
    const p = pace(reflex.youPlayMs, reflex.groupPlayMs);
    parts.push(p === 'about the same'
      ? 'You listen to others\' shares about as fast as the group usually does'
      : `You listen to others' shares ${p} than the group usually does`);
  }
  if (reflex.yoursPlayedMs !== null && reflex.groupYoursPlayedMs !== null) {
    const p = pace(reflex.yoursPlayedMs, reflex.groupYoursPlayedMs);
    const clause = p === 'about the same'
      ? 'the group gets to your picks at its usual pace'
      : `the group gets to your picks ${p === 'faster' ? 'sooner' : 'later'} than usual`;
    parts.push(parts.length === 0 ? clause.charAt(0).toUpperCase() + clause.slice(1) : clause);
  }
  return parts.length === 0 ? null : `${parts.join(', and ')}.`;
};
