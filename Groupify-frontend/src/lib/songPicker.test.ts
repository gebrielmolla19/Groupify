import { describe, it, expect } from 'vitest';
import { journeyHeadline, journeyRows, pickSongs, sharedByLine, sortCounts, timelinePosition } from './songPicker';
import type { SongSummary, SongsMember } from '../types/analytics';

const HOUR = 3_600_000;
const members: SongsMember[] = [
  { id: 'me', displayName: 'Sample User', profileImage: null },
  { id: 'ana', displayName: 'Test Friend', profileImage: null },
  { id: 'bo', displayName: 'Other Member', profileImage: null },
];

let seq = 0;
function song(sharedBy: string | null, listens: Record<string, number> = {}, extra: Partial<SongSummary> = {}): SongSummary {
  seq += 1;
  const audience = members.filter((m) => m.id !== sharedBy).length;
  const list = Object.entries(listens).map(([memberId, afterMs]) => ({ memberId, afterMs })).sort((a, b) => a.afterMs - b.afterMs);
  return {
    shareId: `s${seq}`,
    trackName: `Track ${seq}`,
    artistName: 'Artist',
    trackImage: null,
    sharedBy,
    sharedAt: new Date(Date.UTC(2026, 10, 30 - seq)).toISOString(),
    audience,
    listens: list,
    spreadMs: list.length === audience && audience > 0 ? list[list.length - 1].afterMs : null,
    ...extra,
  };
}

describe('pickSongs', () => {
  const mine = song('me', { ana: HOUR, bo: 5 * HOUR });
  const fast = song('ana', { me: HOUR, bo: 2 * HOUR });
  const spreading = song('bo', { me: HOUR });
  const former = song(null, { me: HOUR });
  const all = [mine, fast, spreading, former];
  const ids = (list: SongSummary[]) => list.map((s) => s.shareId);

  it('Recent keeps every share, newest first', () => {
    expect(ids(pickSongs(all, { sort: 'recent', query: '', viewerId: 'me' }))).toEqual(ids(all));
  });

  it('Fastest spread keeps the shares everyone listened to, shortest spread first', () => {
    expect(ids(pickSongs(all, { sort: 'fastest', query: '', viewerId: 'me' }))).toEqual([fast.shareId, mine.shareId]);
  });

  it('Yours keeps the viewer\'s shares and never a former member\'s', () => {
    expect(ids(pickSongs(all, { sort: 'yours', query: '', viewerId: 'me' }))).toEqual([mine.shareId]);
  });

  it('Still spreading keeps the shares someone hasn\'t listened to yet', () => {
    expect(ids(pickSongs(all, { sort: 'spreading', query: '', viewerId: 'me' }))).toEqual([spreading.shareId, former.shareId]);
  });

  it('searches track and artist names, ignoring case and accents', () => {
    const accented = song('ana', {}, { trackName: 'Café Del Mar', artistName: 'Energy 52' });
    const list = [...all, accented];
    expect(ids(pickSongs(list, { sort: 'recent', query: 'cafe', viewerId: 'me' }))).toEqual([accented.shareId]);
    expect(ids(pickSongs(list, { sort: 'recent', query: '  ENERGY ', viewerId: 'me' }))).toEqual([accented.shareId]);
  });

  it('counts the shares behind each chip', () => {
    expect(sortCounts(all, 'me')).toEqual({ recent: 4, fastest: 2, yours: 1, spreading: 2 });
  });
});

describe('journeyRows', () => {
  it('lists listeners by time, then who hasn\'t listened in group order, never the sharer', () => {
    const rows = journeyRows(song('ana', { bo: HOUR }), members, 'me');
    expect(rows.map((r) => [r.member.id, r.afterMs, r.isViewer])).toEqual([
      ['bo', HOUR, false],
      ['me', null, true],
    ]);
  });
});

describe('journeyHeadline', () => {
  it('says how long the whole group took', () => {
    expect(journeyHeadline(song('me', { ana: HOUR, bo: 3 * HOUR }))).toBe('Everyone listened within 3 hr');
  });

  it('says how many have listened so far', () => {
    expect(journeyHeadline(song('me', { ana: HOUR }))).toBe('1 of 2 have listened');
    expect(journeyHeadline(song('me'))).toBe('No one has listened yet');
  });

  it('handles a group with no one else in it', () => {
    expect(journeyHeadline(song('me', {}, { audience: 0 }))).toBe('No one else is in the group yet');
  });
});

describe('sharedByLine', () => {
  it('names the sharer, the viewer as "you", or a former member', () => {
    expect(sharedByLine(song('me'), members, 'me')).toBe('Shared by you');
    expect(sharedByLine(song('ana'), members, 'me')).toBe('Shared by Test Friend');
    expect(sharedByLine(song(null), members, 'me')).toBe('Shared by a former member');
  });
});

describe('timelinePosition', () => {
  it('spreads waits on a log scale between 0 and 1', () => {
    expect(timelinePosition(0, 10 * HOUR)).toBe(0);
    expect(timelinePosition(10 * HOUR, 10 * HOUR)).toBe(1);
    const minute = timelinePosition(60_000, 10 * HOUR);
    const hour = timelinePosition(HOUR, 10 * HOUR);
    expect(minute).toBeGreaterThan(0.05);
    expect(hour).toBeGreaterThan(minute);
    expect(hour).toBeLessThan(1);
  });

  it('puts everything at the start when the longest wait is zero', () => {
    expect(timelinePosition(0, 0)).toBe(0);
  });
});
