const { summarizeGoldenHour, TIME_OF_DAY_BUCKETS } = require('../src/services/goldenHourService');

// Friday 2026-11-20, 12:00 UTC. A fixed "now" so windows don't move.
const NOW = new Date('2026-11-20T12:00:00Z');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const ME = 'me';
const ANA = 'ana';
const BO = 'bo';
const MEMBERS = [ME, ANA, BO];

// Weekday rows (Monday first) and time-of-day columns.
const MON = 0;
const THU = 3;
const FRI = 4;
const MORNING = 2; // 08–12
const EVENING = 4; // 16–20

let seq = 0;
/** A share at an exact time, with listens as { memberId: Date }. */
function share(sharedBy, at, listens = {}) {
  seq += 1;
  return {
    _id: `s${seq}`,
    sharedBy,
    createdAt: new Date(at),
    listeners: Object.entries(listens).map(([user, listenedAt]) => ({ user, listenedAt: new Date(listenedAt) }))
  };
}

function summarize(shares, overrides = {}) {
  return summarizeGoldenHour({
    shares,
    memberIds: MEMBERS,
    range: '30d',
    now: NOW,
    timeZone: 'UTC',
    ...overrides
  });
}

const total = (grid) => grid.flat().reduce((a, b) => a + b, 0);

describe('summarizeGoldenHour', () => {
  beforeEach(() => { seq = 0; });

  it('has six 4-hour buckets covering the day', () => {
    expect(TIME_OF_DAY_BUCKETS.map((b) => [b.startHour, b.endHour])).toEqual([
      [0, 4], [4, 8], [8, 12], [12, 16], [16, 20], [20, 24]
    ]);
  });

  describe('heatmap', () => {
    it('puts shares at their weekday and time of day, Monday first', () => {
      const result = summarize([
        share(ME, '2026-11-19T17:30:00Z'), // Thursday evening
        share(ANA, '2026-11-19T19:59:00Z'), // Thursday evening
        share(BO, '2026-11-16T09:00:00Z') // Monday morning
      ]);

      expect(result.shares).toHaveLength(7);
      expect(result.shares[0]).toHaveLength(6);
      expect(result.shares[THU][EVENING]).toBe(2);
      expect(result.shares[MON][MORNING]).toBe(1);
      expect(result.totals).toEqual({ shares: 3, listens: 0 });
    });

    it('puts listens at listenedAt and leaves out a sharer\'s own listen', () => {
      const result = summarize([
        share(ME, '2026-11-16T09:00:00Z', {
          [ME]: '2026-11-16T09:05:00Z',
          [ANA]: '2026-11-20T09:00:00Z' // Friday morning
        })
      ]);

      expect(result.listens[FRI][MORNING]).toBe(1);
      expect(result.listens[MON][MORNING]).toBe(0);
      expect(result.totals).toEqual({ shares: 1, listens: 1 });
    });

    it('uses the viewer\'s time zone for the day and hour', () => {
      // 03:00 UTC Friday is 22:00 Thursday in New York (EST, UTC-5).
      const result = summarize([share(ME, '2026-11-20T03:00:00Z')], { timeZone: 'America/New_York' });

      expect(result.shares[THU][5]).toBe(1);
      expect(total(result.shares)).toBe(1);
    });

    it('handles a DST change: the hour is local, not a fixed offset', () => {
      // 2026-07-15 12:30 UTC is 08:30 in New York (EDT, UTC-4): morning, not early morning.
      const result = summarize([share(ME, '2026-07-15T12:30:00Z')], { range: 'all', timeZone: 'America/New_York' });

      expect(result.shares[2][MORNING]).toBe(1); // Wednesday
    });

    it('counts only what falls inside the range, each event by its own time', () => {
      const result = summarize([
        // Shared 40 days ago (outside 30d), listened to yesterday (inside).
        share(ME, NOW.getTime() - 40 * DAY, { [ANA]: NOW.getTime() - DAY })
      ]);

      expect(result.totals).toEqual({ shares: 0, listens: 1 });
    });

    it('leaves out former members\' shares and listens', () => {
      const result = summarize([
        share('gone', '2026-11-19T10:00:00Z', { [ANA]: '2026-11-19T11:00:00Z' }),
        share(ME, '2026-11-19T10:00:00Z', { gone: '2026-11-19T11:00:00Z' })
      ]);

      expect(result.totals).toEqual({ shares: 1, listens: 1 });
    });
  });

  describe('group streak', () => {
    const at = (daysAgo, hour = 10) => NOW.getTime() - daysAgo * DAY + (hour - 12) * HOUR;

    it('counts consecutive days with a share or listen, up to today', () => {
      const result = summarize([
        share(ME, at(2)),
        share(ANA, at(5), { [BO]: at(1) }),
        share(BO, at(0))
      ]);

      expect(result.streak.current).toBe(3); // today, yesterday, two days ago
    });

    it('keeps the streak going when nothing has happened yet today', () => {
      const result = summarize([share(ME, at(1)), share(ANA, at(2))]);
      expect(result.streak.current).toBe(2);
    });

    it('is 0 when the last activity was before yesterday', () => {
      const result = summarize([share(ME, at(2)), share(ANA, at(3))]);
      expect(result.streak.current).toBe(0);
    });

    it('reports the longest run in the range and the all-time record', () => {
      const result = summarize([
        // record: 4 days in a row, before the 30d window
        share(ME, at(60)), share(ME, at(61)), share(ME, at(62)), share(ME, at(63)),
        // in range: a 2-day run
        share(ANA, at(10)), share(ANA, at(11))
      ]);

      expect(result.streak).toEqual({ current: 0, longest: 2, record: 4 });
    });

    it('counts days in the viewer\'s time zone', () => {
      // Both fall on Nov 19 in UTC. In Los Angeles the first is still Nov 18.
      const shares = [share(ME, '2026-11-19T01:00:00Z'), share(ANA, '2026-11-19T23:00:00Z')];

      expect(summarize(shares).streak.longest).toBe(1);
      expect(summarize(shares, { timeZone: 'America/Los_Angeles' }).streak.longest).toBe(2);
    });

    it('is all zeros for a group with no activity', () => {
      const result = summarize([]);
      expect(result.streak).toEqual({ current: 0, longest: 0, record: 0 });
      expect(result.totals).toEqual({ shares: 0, listens: 0 });
    });
  });
});
