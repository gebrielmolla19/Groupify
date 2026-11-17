import { describe, it, expect } from 'vitest';
import { waitingHeadline, waitingSummary } from './waiting';

const now = new Date('2026-11-17T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe('waitingHeadline', () => {
  it('counts the tracks waiting', () => {
    expect(waitingHeadline(6)).toBe('6 tracks are waiting for you');
    expect(waitingHeadline(1)).toBe('1 track is waiting for you');
  });

  it('says when there is nothing to hear', () => {
    expect(waitingHeadline(0)).toBe("You're all caught up");
  });
});

describe('waitingSummary', () => {
  it('names how many groups and how long the oldest has waited', () => {
    expect(waitingSummary({ total: 6, groupCount: 3, oldestAt: ago(5 * DAY) }, now))
      .toBe('Across 3 groups. The oldest has been sitting for 5 days.');
  });

  it('uses the singular for one group, one track and one day', () => {
    expect(waitingSummary({ total: 1, groupCount: 1, oldestAt: ago(DAY + HOUR) }, now))
      .toBe('In 1 group. It has been sitting for 1 day.');
  });

  it('counts hours under a day and says "under an hour" below that', () => {
    expect(waitingSummary({ total: 2, groupCount: 1, oldestAt: ago(3 * HOUR) }, now))
      .toBe('In 1 group. The oldest has been sitting for 3 hours.');
    expect(waitingSummary({ total: 2, groupCount: 2, oldestAt: ago(20 * 60_000) }, now))
      .toBe('Across 2 groups. The oldest has been sitting for under an hour.');
  });

  it('leaves out the age when it is unknown', () => {
    expect(waitingSummary({ total: 2, groupCount: 2, oldestAt: null }, now)).toBe('Across 2 groups.');
  });

  it('invites a share when nothing is waiting', () => {
    expect(waitingSummary({ total: 0, groupCount: 0, oldestAt: null }, now))
      .toBe("Nothing new in your groups. Share a track and see who's listening.");
  });
});
