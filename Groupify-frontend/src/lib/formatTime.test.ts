import { describe, it, expect } from 'vitest';
import { formatAge, formatSharedAt, formatTime, formatTrackTime } from './formatTime';

describe('formatTrackTime', () => {
  it('formats as m:ss', () => {
    expect(formatTrackTime(0)).toBe('0:00');
    expect(formatTrackTime(9_999)).toBe('0:09');
    expect(formatTrackTime(245_000)).toBe('4:05');
  });

  it('switches to h:mm:ss past an hour', () => {
    expect(formatTrackTime(3_725_000)).toBe('1:02:05');
  });

  it('clamps negative values to 0:00', () => {
    expect(formatTrackTime(-500)).toBe('0:00');
  });
});

describe('formatTime', () => {
  it('returns "0s" for negative ms', () => {
    expect(formatTime(-100)).toBe('0s');
  });

  it('returns ms string for values under 1000', () => {
    expect(formatTime(0)).toBe('0ms');
    expect(formatTime(500)).toBe('500ms');
    expect(formatTime(999)).toBe('999ms');
  });

  it('returns seconds for 1s to under 1m', () => {
    expect(formatTime(1000)).toBe('1s');
    expect(formatTime(59000)).toBe('59s');
  });

  it('returns minutes for 1m to under 1h', () => {
    expect(formatTime(60000)).toBe('1m');
    expect(formatTime(300000)).toBe('5m');
  });

  it('returns hours and minutes when applicable', () => {
    expect(formatTime(3600000)).toBe('1h');
    expect(formatTime(7320000)).toBe('2h 2m'); // 2h 2m
  });

  it('returns days and hours when applicable', () => {
    expect(formatTime(86400000)).toBe('1d');
    expect(formatTime(90000000)).toBe('1d 1h'); // 25h
  });
});

describe('formatAge', () => {
  it('uses the largest whole unit, short', () => {
    expect(formatAge(30_000)).toBe('now');
    expect(formatAge(5 * 60_000)).toBe('5m');
    expect(formatAge(3 * 3_600_000)).toBe('3h');
    expect(formatAge(2 * 86_400_000)).toBe('2d');
    expect(formatAge(15 * 86_400_000)).toBe('2w');
    expect(formatAge(45 * 86_400_000)).toBe('1mo');
    expect(formatAge(400 * 86_400_000)).toBe('1y');
  });

  it('treats future times as now', () => {
    expect(formatAge(-60_000)).toBe('now');
  });
});

describe('formatSharedAt', () => {
  // Local times, so the test holds in any time zone. 2026-01-08 is a Thursday.
  const now = new Date(2026, 0, 8, 12, 0);
  it('says today, a weekday this week, or a date', () => {
    expect(formatSharedAt(new Date(2026, 0, 8, 9, 5), now)).toBe('Today at 9:05am');
    expect(formatSharedAt(new Date(2026, 0, 7, 23, 42), now)).toBe('Yesterday at 11:42pm');
    expect(formatSharedAt(new Date(2026, 0, 3, 12, 0), now)).toBe('Saturday at 12:00pm');
    expect(formatSharedAt(new Date(2026, 0, 1, 0, 30), now)).toBe('Jan 1 at 12:30am');
    expect(formatSharedAt(new Date(2025, 11, 31, 18, 0), now)).toBe('Dec 31, 2025 at 6:00pm');
  });
});
