import { formatWait } from './viewerSummaryCopy';
import type { SongSummary, SongsMember } from '../types/analytics';

/**
 * The song picker and song journey of Group Dynamics (#148). The rules for
 * each sort chip are in the issue's "Decision for review".
 */

export type SongSort = 'recent' | 'fastest' | 'yours' | 'spreading';

export const SONG_SORTS: { value: SongSort; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'fastest', label: 'Fastest spread' },
  { value: 'yours', label: 'Yours' },
  { value: 'spreading', label: 'Still spreading' },
];

const isSpreading = (song: SongSummary) => song.audience > 0 && song.spreadMs === null;

const KEEP: Record<SongSort, (song: SongSummary, viewerId: string) => boolean> = {
  recent: () => true,
  fastest: (song) => song.spreadMs !== null,
  yours: (song, viewerId) => song.sharedBy === viewerId,
  spreading: (song) => isSpreading(song),
};

/** Lowercase without accents, so "cafe" finds "Café". */
const fold = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** The shares a chip and search leave, in that chip's order. `songs` arrive newest first. */
export function pickSongs(
  songs: SongSummary[],
  { sort, query, viewerId }: { sort: SongSort; query: string; viewerId: string },
): SongSummary[] {
  const needle = fold(query.trim());
  const kept = songs.filter((song) => KEEP[sort](song, viewerId)
    && (!needle || fold(`${song.trackName} ${song.artistName}`).includes(needle)));
  // Array sort is stable, so equal spreads stay newest first.
  return sort === 'fastest' ? kept.sort((a, b) => (a.spreadMs ?? 0) - (b.spreadMs ?? 0)) : kept;
}

/** How many shares each chip holds, before search. */
export function sortCounts(songs: SongSummary[], viewerId: string): Record<SongSort, number> {
  const counts = { recent: 0, fastest: 0, yours: 0, spreading: 0 };
  for (const song of songs) {
    for (const { value } of SONG_SORTS) if (KEEP[value](song, viewerId)) counts[value] += 1;
  }
  return counts;
}

export type JourneyRow = { member: SongsMember; afterMs: number | null; isViewer: boolean };

/** One row per member of the audience: listeners by time, then the rest in group order. */
export function journeyRows(song: SongSummary, members: SongsMember[], viewerId: string): JourneyRow[] {
  const byId = new Map(members.map((m) => [m.id, m]));
  const heard: JourneyRow[] = song.listens.flatMap(({ memberId, afterMs }) => {
    const member = byId.get(memberId);
    return member ? [{ member, afterMs, isViewer: memberId === viewerId }] : [];
  });
  const listened = new Set(song.listens.map((l) => l.memberId));
  const waiting = members
    .filter((m) => m.id !== song.sharedBy && !listened.has(m.id))
    .map((member) => ({ member, afterMs: null, isViewer: member.id === viewerId }));
  return [...heard, ...waiting];
}

/** "Everyone listened within 3 hr", "1 of 2 have listened" */
export function journeyHeadline(song: SongSummary): string {
  if (song.audience === 0) return 'No one else is in the group yet';
  if (song.spreadMs !== null) return `Everyone listened within ${formatWait(song.spreadMs)}`;
  if (song.listens.length === 0) return 'No one has listened yet';
  return `${song.listens.length} of ${song.audience} have listened`;
}

export function sharedByLine(song: SongSummary, members: SongsMember[], viewerId: string): string {
  if (song.sharedBy === null) return 'Shared by a former member';
  if (song.sharedBy === viewerId) return 'Shared by you';
  return `Shared by ${members.find((m) => m.id === song.sharedBy)?.displayName ?? 'a member'}`;
}

/**
 * Where a wait sits on the journey's timeline, from 0 (the share) to 1 (the
 * longest wait). Logarithmic in minutes, since listens range from minutes to
 * days and a linear scale would crowd every quick listen at the start.
 */
export function timelinePosition(ms: number, maxMs: number): number {
  if (maxMs <= 0) return 0;
  const scale = (value: number) => Math.log1p(value / 60_000);
  return Math.min(1, scale(ms) / scale(maxMs));
}
