import { describe, it, expect } from 'vitest';
import {
  moreLine,
  recordRows,
  sharedAgo,
  sleepingOnEmpty,
  sleepingOnLine,
  sleptOnEmpty,
  sleptOnLine,
} from './songsSummaryCopy';
import type { SongsSummaryShare } from '../types/analytics';

const NOW = new Date('2026-11-20T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

const share = (overrides: Partial<SongsSummaryShare> = {}): SongsSummaryShare => ({
  shareId: 's1',
  spotifyTrackId: 't1',
  trackName: 'Sample Track',
  artistName: 'Sample Artist',
  trackImage: null,
  sharedBy: { id: 'u1', displayName: 'Ana' },
  sharedAt: daysAgo(2),
  ...overrides,
});

describe('songsSummaryCopy', () => {
  it('says how long ago a share was made in days', () => {
    expect(sharedAgo(daysAgo(0.2), NOW)).toBe('today');
    expect(sharedAgo(daysAgo(1.5), NOW)).toBe('yesterday');
    expect(sharedAgo(daysAgo(5), NOW)).toBe('5 days ago');
  });

  it('describes a share the viewer is sleeping on and one the group slept on', () => {
    expect(sleepingOnLine(share(), NOW)).toBe('Sample Artist · from Ana · 2 days ago');
    expect(sleptOnLine(share({ sharedAt: daysAgo(6) }), 4, NOW)).toBe('Sample Artist · 6 days ago · 0 of 4 listened');
  });

  it('counts the shares a list leaves out', () => {
    expect(moreLine(5, 8)).toBe('And 3 more');
    expect(moreLine(2, 2)).toBeNull();
  });

  it('explains empty lists for the period', () => {
    expect(sleepingOnEmpty('7d')).toBe("You've listened to every share from the others in the last 7 days.");
    expect(sleepingOnEmpty('all')).toBe("You've listened to every share from the others.");
    expect(sleptOnEmpty('30d', 0)).toBe('Shows once someone else is in the group.');
    expect(sleptOnEmpty('30d', 2)).toBe('Every share of yours in the last 30 days has a listen, or is under a day old.');
  });

  it('writes each record from its numbers, or says why there is none', () => {
    const rows = recordRows({
      fastestFullListen: { ...share({ trackName: 'Glue' }), ms: 38 * 60_000 },
      mostLiked: { ...share({ trackName: 'Pink + White' }), likes: 4, others: 4 },
      longestStreak: { days: 1 },
    }, '30d');
    expect(rows.map((r) => r.value)).toEqual(['Glue · 38 min', 'Pink + White · 4 of 4', '1 day']);

    const none = { fastestFullListen: null, mostLiked: null, longestStreak: null };
    expect(recordRows(none, 'all').map((r) => r.value)).toEqual([
      'No share has a listen from everyone yet',
      'No likes yet',
      'No shares yet',
    ]);
    expect(recordRows(none, '7d').map((r) => r.value)).toEqual([
      'No share has a listen from everyone in the last 7 days',
      'No likes in the last 7 days',
      'No shares in the last 7 days',
    ]);
  });
});
