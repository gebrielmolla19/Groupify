import { describe, it, expect } from 'vitest';
import {
  WEEKDAYS,
  cellCounts,
  heatLevel,
  peakCells,
  peakLine,
  streakLine,
  timeRangeLabel,
} from './goldenHour';
import type { GoldenHour } from '../types/analytics';

const BUCKETS: GoldenHour['buckets'] = [
  { id: 'late_night', label: 'Late night', startHour: 0, endHour: 4 },
  { id: 'early_morning', label: 'Early morning', startHour: 4, endHour: 8 },
  { id: 'morning', label: 'Morning', startHour: 8, endHour: 12 },
  { id: 'afternoon', label: 'Afternoon', startHour: 12, endHour: 16 },
  { id: 'evening', label: 'Evening', startHour: 16, endHour: 20 },
  { id: 'night', label: 'Night', startHour: 20, endHour: 24 },
];

const grid = (cells: Record<string, number> = {}) =>
  Array.from({ length: 7 }, (_, row) => Array.from({ length: 6 }, (_, col) => cells[`${row},${col}`] ?? 0));

function goldenHour(shares: Record<string, number>, listens: Record<string, number> = {}): GoldenHour {
  const s = grid(shares);
  const l = grid(listens);
  const sum = (g: number[][]) => g.flat().reduce((a, b) => a + b, 0);
  return {
    range: '30d',
    buckets: BUCKETS,
    shares: s,
    listens: l,
    totals: { shares: sum(s), listens: sum(l) },
    streak: { current: 0, longest: 0, record: 0 },
  };
}

describe('golden hour', () => {
  it('names weekdays Monday first', () => {
    expect(WEEKDAYS.map((d) => d.short)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });

  it('labels a bucket as a clock range', () => {
    expect(timeRangeLabel(BUCKETS[0])).toBe('12am–4am');
    expect(timeRangeLabel(BUCKETS[4])).toBe('4pm–8pm');
    expect(timeRangeLabel(BUCKETS[5])).toBe('8pm–12am');
  });

  it('adds shares and listens for "both", or picks one', () => {
    const data = goldenHour({ '3,4': 2 }, { '3,4': 3 });
    expect(cellCounts(data, 'both')[3][4]).toBe(5);
    expect(cellCounts(data, 'shares')[3][4]).toBe(2);
    expect(cellCounts(data, 'listens')[3][4]).toBe(3);
  });

  it('steps a count into one of four shades relative to the busiest cell, 0 when empty', () => {
    expect(heatLevel(0, 8)).toBe(0);
    expect(heatLevel(1, 8)).toBe(1);
    expect(heatLevel(4, 8)).toBe(2);
    expect(heatLevel(6, 8)).toBe(3);
    expect(heatLevel(8, 8)).toBe(4);
  });

  describe('peak', () => {
    it('finds the busiest cell', () => {
      const counts = grid({ '3,4': 4, '5,5': 2 });
      expect(peakCells(counts)).toEqual({ cells: [{ row: 3, column: 4 }], count: 4 });
    });

    it('names the peak in a sentence once there is enough activity', () => {
      const data = goldenHour({ '3,4': 4, '5,5': 2 });
      expect(peakLine(data, 'both')).toBe('Busiest: Thursday evening (4pm–8pm), with 4 shares and listens.');
    });

    it('names tied peaks together and counts the rest', () => {
      const data = goldenHour({ '3,4': 3, '5,5': 3 });
      expect(peakLine(data, 'shares')).toBe('Busiest: Thursday evening and Saturday night, with 3 shares each.');

      const three = goldenHour({ '0,2': 2, '3,4': 2, '5,5': 2 });
      expect(peakLine(three, 'shares')).toBe('Busiest: Monday morning, Thursday evening and 1 more, with 2 shares each.');
    });

    it('holds back with too little activity, and says so when there is none', () => {
      expect(peakLine(goldenHour({ '3,4': 2, '5,5': 2 }), 'both')).toBe(
        'Too early to call a golden hour: 4 shares and listens so far.',
      );
      expect(peakLine(goldenHour({}), 'listens')).toBe('No listens in this period yet.');
    });
  });

  describe('streak', () => {
    it('describes a running streak and the record', () => {
      expect(streakLine({ current: 3, longest: 5, record: 9 })).toBe(
        'Longest in this period: 5 days. Record: 9 days.',
      );
    });

    it('nudges when the streak is broken', () => {
      expect(streakLine({ current: 0, longest: 2, record: 4 })).toBe(
        'A share or listen today starts a new one. Longest in this period: 2 days. Record: 4 days.',
      );
      expect(streakLine({ current: 0, longest: 0, record: 0 })).toBe(
        'A share or listen today starts one.',
      );
    });
  });
});
