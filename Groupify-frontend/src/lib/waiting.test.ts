import { describe, it, expect } from 'vitest';
import { waitingHeadline, waitingSummary } from './waiting';

const now = new Date('2026-11-17T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const counts = (total: number, newThisWeek: number, groupCount = 2, oldestAt: string | null = ago(5 * DAY)) =>
  ({ total, newThisWeek, groupCount, oldestAt });

describe('waitingHeadline', () => {
  it('leads with what is new this week', () => {
    expect(waitingHeadline(counts(42, 5))).toBe('5 new tracks this week');
    expect(waitingHeadline(counts(42, 1))).toBe('1 new track this week');
  });

  it('falls back to the backlog when nothing is new', () => {
    expect(waitingHeadline(counts(42, 0))).toBe('42 tracks are still waiting for you');
    expect(waitingHeadline(counts(1, 0))).toBe('1 track is still waiting for you');
  });

  it('says when there is nothing to hear', () => {
    expect(waitingHeadline(counts(0, 0))).toBe("You're all caught up");
  });
});

describe('waitingSummary', () => {
  it('names the groups when everything waiting is new', () => {
    expect(waitingSummary(counts(3, 3, 2), now)).toBe('Across 2 groups.');
    expect(waitingSummary(counts(1, 1, 1), now)).toBe('In 1 group.');
  });

  it('mentions the older backlog and how long it has waited', () => {
    expect(waitingSummary(counts(42, 5, 6, ago(400 * DAY)), now))
      .toBe('37 older tracks are still waiting too. The oldest has been waiting for over a year.');
    expect(waitingSummary(counts(6, 5, 2, ago(9 * DAY)), now))
      .toBe('1 older track is still waiting too. It has been waiting for 9 days.');
  });

  it('says nothing is new when it is all backlog', () => {
    expect(waitingSummary(counts(4, 0, 2, ago(20 * DAY)), now))
      .toBe('Nothing new this week. The oldest has been waiting for 20 days.');
    expect(waitingSummary(counts(1, 0, 1, ago(10 * DAY)), now))
      .toBe('Nothing new this week. It has been waiting for 10 days.');
  });

  it('switches to months after about two months, and years after one', () => {
    const age = (ms: number) => waitingSummary(counts(4, 0, 1, ago(ms)), now).replace('Nothing new this week. The oldest has been waiting ', '');
    expect(age(59 * DAY)).toBe('for 59 days.');
    expect(age(7 * 30 * DAY)).toBe('for 7 months.');
    expect(age(371 * DAY)).toBe('for over a year.');
    expect(age(800 * DAY)).toBe('for over 2 years.');
  });

  it('leaves out the age when it is unknown', () => {
    expect(waitingSummary(counts(4, 0, 2, null), now)).toBe('Nothing new this week.');
  });

  it('invites a share when nothing is waiting', () => {
    expect(waitingSummary(counts(0, 0, 0, null), now))
      .toBe("Nothing new in your groups. Share a track and see who's listening.");
  });
});
