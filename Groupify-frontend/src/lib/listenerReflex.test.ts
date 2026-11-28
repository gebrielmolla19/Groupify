import { describe, it, expect } from 'vitest';
import {
  breakdownRows,
  breakdownTitle,
  rankMembers,
  reflexHeadline,
} from './listenerReflex';
import type { ListenerReflexData, ListenerReflexUser } from '../types';

const MIN = 60_000;
const HOUR = 60 * MIN;
const NO_TIMING = { sameHour: 0, sameDay: 0, withinWeek: 0, later: 0 };

function member(userId: string, displayName: string, medianMs: number | null, listens = 3): ListenerReflexUser {
  return {
    userId,
    displayName,
    avatarUrl: null,
    listens: medianMs === null ? 0 : listens,
    medianMs,
    p25Ms: medianMs,
    p75Ms: medianMs,
    category: medianMs === null ? null : 'quick',
    listenRatio: 0.5,
    timing: medianMs === null ? NO_TIMING : { sameHour: listens, sameDay: 0, withinWeek: 0, later: 0 },
  };
}

function reflex(users: ListenerReflexUser[], mode: 'received' | 'shared' = 'received'): ListenerReflexData {
  return {
    groupId: 'g1',
    range: '30d',
    mode,
    generatedAt: '2026-11-20T12:00:00Z',
    buckets: { instant: [], quick: [], slow: [], longTail: [] },
    users,
    ringData: users.map((u) => ({
      userId: u.userId,
      points: u.medianMs === null ? [] : [{ ms: u.medianMs, listenedAt: '2026-11-19T12:00:00Z' }],
    })),
    summary: { groupMedianMs: 30 * MIN, instantReactorCount: 0, totalSharesInRange: 6 },
  };
}

describe('rankMembers', () => {
  it('puts the fastest median first and members without listens last', () => {
    const rows = rankMembers(
      reflex([member('slow', 'Slow', 9 * HOUR), member('none', 'None', null), member('me', 'Me', 6 * MIN)]),
      'me',
      '30d'
    );

    expect(rows.map((r) => r.userId)).toEqual(['me', 'slow', 'none']);
    expect(rows[0]).toMatchObject({ name: 'You', isViewer: true });
    expect(rows[2].medianMs).toBeNull();
  });

  it('gives the fastest a full bar, the slowest a short one and no bar without listens', () => {
    const rows = rankMembers(
      reflex([member('a', 'A', 6 * MIN), member('b', 'B', HOUR), member('c', 'C', 30 * HOUR), member('d', 'D', null)]),
      'a',
      '30d'
    );

    expect(rows[0].barPercent).toBe(100);
    expect(rows[1].barPercent).toBeLessThan(100);
    expect(rows[1].barPercent).toBeGreaterThan(rows[2].barPercent);
    expect(rows[2].barPercent).toBeGreaterThan(0);
    expect(rows[3].barPercent).toBe(0);
  });

  it('gives every member a listening badge', () => {
    const rows = rankMembers(reflex([member('a', 'A', 6 * MIN), member('b', 'B', null)]), 'a', '30d');

    rows.forEach((row) => expect(row.badge).toEqual(expect.any(String)));
  });

  it('gives no sharing badge to a member nobody has listened to yet', () => {
    const rows = rankMembers(reflex([member('a', 'A', 6 * MIN), member('b', 'B', null)], 'shared'), 'a', '30d');

    expect(rows[0].badge).toEqual(expect.any(String));
    expect(rows[1].badge).toBeNull();
  });
});

describe('reflexHeadline', () => {
  it('names the viewer when they are first', () => {
    const rows = rankMembers(reflex([member('me', 'Me', MIN), member('b', 'Bo', HOUR)]), 'me', '30d');

    expect(reflexHeadline(rows, 'received')).toBe("You're the fastest to listen");
    expect(reflexHeadline(rows, 'shared')).toBe('Your shares get listened to fastest');
  });

  it('names the fastest member otherwise', () => {
    const rows = rankMembers(reflex([member('me', 'Me', HOUR), member('b', 'Bo', MIN)]), 'me', '30d');

    expect(reflexHeadline(rows, 'received')).toBe('Bo is the fastest to listen');
    expect(reflexHeadline(rows, 'shared')).toBe("Bo's shares get listened to fastest");
  });

  it('says so when nobody has a listen yet', () => {
    const rows = rankMembers(reflex([member('me', 'Me', null), member('b', 'Bo', null)]), 'me', '30d');

    expect(reflexHeadline(rows, 'received')).toBe('No listens in this period yet');
  });
});

describe('breakdownTitle', () => {
  it('speaks to the viewer, or names the member', () => {
    expect(breakdownTitle('received', 'You', true)).toBe('When you listen to a new share');
    expect(breakdownTitle('received', 'Bo', false)).toBe('When Bo listens to a new share');
    expect(breakdownTitle('shared', 'You', true)).toBe('When others listen to your shares');
    expect(breakdownTitle('shared', 'Bo', false)).toBe("When others listen to Bo's shares");
  });
});

describe('breakdownRows', () => {
  it('lists the four buckets in order, scaled to the biggest', () => {
    const rows = breakdownRows({ sameHour: 14, sameDay: 7, withinWeek: 0, later: 1 });

    expect(rows.map((r) => [r.label, r.count])).toEqual([
      ['Same hour', 14],
      ['Same day', 7],
      ['Within the week', 0],
      ['Later', 1],
    ]);
    expect(rows.map((r) => r.percent)).toEqual([100, 50, 0, 7]);
  });

  it('has no bars when there are no listens', () => {
    expect(breakdownRows(NO_TIMING).every((r) => r.percent === 0)).toBe(true);
  });
});
