/** Home's opening sentence: how many unheard tracks are waiting. */
export function waitingHeadline(total: number): string {
  if (total === 0) return "You're all caught up";
  return total === 1 ? '1 track is waiting for you' : `${total} tracks are waiting for you`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function waitedFor(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return 'under an hour';
  if (hours < 24) return plural(hours, 'hour');
  return plural(Math.floor(hours / 24), 'day');
}

/** The line under the headline: where the tracks are and how long they've waited. */
export function waitingSummary(
  { total, groupCount, oldestAt }: { total: number; groupCount: number; oldestAt: string | null },
  now: Date = new Date(),
): string {
  if (total === 0) return "Nothing new in your groups. Share a track and see who's listening.";
  const where = groupCount === 1 ? 'In 1 group.' : `Across ${groupCount} groups.`;
  if (!oldestAt) return where;
  const who = total === 1 ? 'It has' : 'The oldest has';
  return `${where} ${who} been sitting for ${waitedFor(now.getTime() - new Date(oldestAt).getTime())}.`;
}
