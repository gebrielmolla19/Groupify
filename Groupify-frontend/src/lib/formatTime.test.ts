import { describe, it, expect } from 'vitest';
import { formatTime } from './formatTime';

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
