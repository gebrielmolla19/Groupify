/** What Home knows about the viewer's unheard shares. */
export interface WaitingCounts {
  total: number;
  /** Unheard shares from the last 7 days. */
  newThisWeek: number;
  groupCount: number;
  oldestAt: string | null;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const DAY_MS = 86_400_000;

/** Home's opening sentence: what's new this week, else what's still waiting. */
export function waitingHeadline({ total, newThisWeek }: WaitingCounts): string {
  if (total === 0) return "You're all caught up";
  if (newThisWeek > 0) return `${newThisWeek} new ${newThisWeek === 1 ? 'track' : 'tracks'} this week`;
  return total === 1 ? '1 track is still waiting for you' : `${total} tracks are still waiting for you`;
}

/** How long something has waited, gentler the longer it gets: hours, days, months, then years. */
function waitedFor(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return 'for less than an hour';
  if (hours < 24) return `for ${plural(hours, 'hour')}`;
  const days = Math.floor(ms / DAY_MS);
  if (days < 60) return `for ${plural(days, 'day')}`;
  if (days < 365) return `for ${Math.floor(days / 30)} months`;
  const years = Math.floor(days / 365);
  return years === 1 ? 'for over a year' : `for over ${years} years`;
}

/** The line under the headline: the older backlog, or where the new tracks are. */
export function waitingSummary({ total, newThisWeek, groupCount, oldestAt }: WaitingCounts, now: Date = new Date()): string {
  if (total === 0) return "Nothing new in your groups. Share a track and see who's listening.";
  const older = total - newThisWeek;
  if (older === 0) return groupCount === 1 ? 'In 1 group.' : `Across ${groupCount} groups.`;

  const lead = newThisWeek > 0
    ? `${older === 1 ? '1 older track is' : `${older} older tracks are`} still waiting too.`
    : 'Nothing new this week.';
  if (!oldestAt) return lead;
  const who = older === 1 ? 'It has' : 'The oldest has';
  return `${lead} ${who} been waiting ${waitedFor(now.getTime() - new Date(oldestAt).getTime())}.`;
}
