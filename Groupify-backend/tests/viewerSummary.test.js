const { summarizeViewer } = require('../src/services/viewerSummaryService');

// A fixed "now" so windows don't move while the suite runs.
const NOW = new Date('2026-11-20T12:00:00Z');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const ME = 'me';
const ANA = 'ana';
const BO = 'bo';
const MEMBERS = [ME, ANA, BO];

let seq = 0;
/** A share `daysAgo` days before NOW, with listens and likes from the given members. */
function share(sharedBy, daysAgo, { artist = 'Artist', track = 'Track', listens = {}, likes = [] } = {}) {
  seq += 1;
  const createdAt = new Date(NOW.getTime() - daysAgo * DAY);
  return {
    _id: `s${seq}`,
    sharedBy,
    trackName: `${track} ${seq}`,
    artistName: artist,
    createdAt,
    // listens: { memberId: msAfterShare }
    listeners: Object.entries(listens).map(([user, ms]) => ({
      user,
      listenedAt: new Date(createdAt.getTime() + ms),
      timeToListen: ms
    })),
    likes: likes.map((user) => ({ user, likedAt: createdAt }))
  };
}

function summarize(shares, overrides = {}) {
  return summarizeViewer({
    shares,
    memberIds: MEMBERS,
    viewerId: ME,
    range: '30d',
    now: NOW,
    timeZone: 'UTC',
    ...overrides
  });
}

describe('summarizeViewer', () => {
  beforeEach(() => { seq = 0; });

  describe('hit rate', () => {
    it('counts the viewer\'s shares that every other member played', () => {
      const result = summarize([
        share(ME, 1, { listens: { [ANA]: HOUR, [BO]: HOUR } }),
        share(ME, 2, { listens: { [ANA]: HOUR } }),
        share(ME, 3),
        share(ANA, 1, { listens: { [ME]: HOUR, [BO]: HOUR } })
      ]);

      expect(result.hitRate).toEqual({ hits: 1, total: 3 });
    });

    it('ignores the sharer\'s own listen and shares outside the range', () => {
      const result = summarize([
        share(ME, 1, { listens: { [ME]: 0, [ANA]: HOUR } }),
        share(ME, 40, { listens: { [ANA]: HOUR, [BO]: HOUR } })
      ]);

      expect(result.hitRate).toEqual({ hits: 0, total: 1 });
    });

    it('is null when the viewer is the only member', () => {
      const result = summarize([share(ME, 1)], { memberIds: [ME] });
      expect(result.hitRate).toBeNull();
    });
  });

  describe('sharing streak', () => {
    it('finds the longest run of days in the range and the all-time record', () => {
      const result = summarize([
        // all-time record: 4 days in a row, before the range
        share(ME, 60), share(ME, 61), share(ME, 62), share(ME, 63),
        // in range: 2 days, a gap, then 3 days (two shares on one day count once)
        share(ME, 20), share(ME, 21),
        share(ME, 5), share(ME, 6), share(ME, 6.1), share(ME, 7),
        share(ANA, 1), share(ANA, 2), share(ANA, 3), share(ANA, 4), share(ANA, 5)
      ]);

      expect(result.streak).toEqual({ longest: 3, record: 4 });
    });

    it('counts days in the given time zone', () => {
      // 23:30 and 00:30 UTC on consecutive UTC days fall on the same day in New York.
      const a = share(ME, 0);
      a.createdAt = new Date('2026-11-18T23:30:00Z');
      const b = share(ME, 0);
      b.createdAt = new Date('2026-11-19T00:30:00Z');

      expect(summarize([a, b], { timeZone: 'UTC' }).streak.longest).toBe(2);
      expect(summarize([a, b], { timeZone: 'America/New_York' }).streak.longest).toBe(1);
    });
  });

  describe('best-landing share', () => {
    it('picks the viewer\'s share with the most listens and likes from others', () => {
      const result = summarize([
        share(ME, 1, { track: 'Quiet', listens: { [ANA]: HOUR } }),
        share(ME, 2, { track: 'Loud', artist: 'Band', listens: { [ANA]: HOUR, [BO]: HOUR }, likes: [ANA, BO, ME] }),
        share(ANA, 1, { listens: { [ME]: HOUR, [BO]: HOUR }, likes: [ME, BO] })
      ]);

      expect(result.bestShare).toEqual({
        shareId: 's2',
        trackName: 'Loud 2',
        artistName: 'Band',
        listens: 2,
        likes: 2,
        others: 2
      });
    });

    it('is null when the viewer has no shares in the range, or none that landed', () => {
      expect(summarize([share(ANA, 1)]).bestShare).toBeNull();
      expect(summarize([share(ME, 1)]).bestShare).toBeNull();
    });
  });

  describe('discovery credit', () => {
    it('counts artists the viewer brought first, and how many others shared later', () => {
      const result = summarize([
        share(ME, 10, { artist: 'First A' }),
        share(ANA, 5, { artist: 'First A' }), // reshared by someone else
        share(ME, 9, { artist: 'First B' }),
        share(ME, 3, { artist: 'First B' }), // the viewer again doesn't count
        share(ANA, 12, { artist: 'Old' }),
        share(ME, 2, { artist: 'old' }), // Ana got there first (case-insensitive)
        share(ME, 50, { artist: 'Long Ago' }) // first, but before the range
      ]);

      expect(result.discovery).toEqual({ artists: 2, resharedByOthers: 1 });
    });
  });

  describe('reflex', () => {
    it('compares how fast the viewer plays others\' shares, and others play the viewer\'s, against the group', () => {
      const result = summarize([
        share(ANA, 1, { listens: { [ME]: 10 * 60 * 1000, [BO]: 3 * HOUR } }),
        share(BO, 2, { listens: { [ME]: 20 * 60 * 1000, [ANA]: 5 * HOUR } }),
        share(ME, 3, { listens: { [ANA]: 1 * HOUR, [BO]: 2 * HOUR, [ME]: 1 } })
      ]);

      // Me: median of 10 and 20 minutes. Ana: 5h then 1h (median 3h). Bo: 3h and 2h (2.5h).
      expect(result.reflex.youPlayMs).toBe(15 * 60 * 1000);
      expect(result.reflex.groupPlayMs).toBe(2.5 * HOUR);
      // Others play mine: 1h and 2h (median 90 min). Ana's shares: 10 min and 3h (95 min).
      // Bo's: 20 min and 5h (160 min). The group's typical sharer: 95 min.
      expect(result.reflex.yoursPlayedMs).toBe(90 * 60 * 1000);
      expect(result.reflex.groupYoursPlayedMs).toBe(95 * 60 * 1000);
    });

    it('reports nulls when there are no timed listens', () => {
      expect(summarize([]).reflex).toEqual({
        youPlayMs: null,
        groupPlayMs: null,
        yoursPlayedMs: null,
        groupYoursPlayedMs: null
      });
    });
  });

  describe('role', () => {
    it('is Tastemaker when no one\'s shares are liked more often (at least 3 shares)', () => {
      const result = summarize([
        share(ME, 1, { likes: [ANA, BO] }),
        share(ME, 2, { likes: [ANA] }),
        share(ME, 3, { likes: [BO] }),
        share(ANA, 1, { likes: [ME] }),
        share(ANA, 2),
        share(ANA, 3)
      ]);

      expect(result.role.id).toBe('tastemaker');
      expect(result.role.title).toBe('Tastemaker');
      expect(result.role.reason).toBe('No one\'s shares get liked more often than yours: 4 likes across 3 songs.');
    });

    it('is Crowd Pleaser when no one gets more shares played by the whole group', () => {
      const all = { [ANA]: HOUR, [BO]: HOUR };
      const result = summarize([
        share(ME, 1, { listens: all }),
        share(ME, 2, { listens: all }),
        share(ME, 3),
        share(ANA, 1, { listens: { [ME]: HOUR, [BO]: HOUR }, likes: [ME] }),
        share(ANA, 2),
        share(ANA, 3)
      ]);

      expect(result.role.id).toBe('crowd_pleaser');
      expect(result.role.reason).toBe('No one gets more of their shares played by the whole group: 2 of your 3.');
    });

    it('is Patient Zero when the viewer brought the most new artists (at least 2)', () => {
      const result = summarize([
        share(ME, 1, { artist: 'A' }),
        share(ME, 2, { artist: 'B' }),
        share(ANA, 3, { artist: 'C' })
      ]);

      expect(result.role.id).toBe('patient_zero');
      expect(result.role.reason).toBe('You brought 2 artists to the group before anyone else did.');
    });

    it('is The Regular when the viewer has the longest sharing streak (at least 3 days)', () => {
      const result = summarize([
        share(ME, 1, { artist: 'Same' }), share(ME, 2, { artist: 'Same' }), share(ANA, 3, { artist: 'Same' }),
        share(ME, 3, { artist: 'Same' })
      ].map((s, i) => (i === 2 ? { ...s, createdAt: new Date(NOW.getTime() - 9 * DAY) } : s)));

      expect(result.role.id).toBe('regular');
      expect(result.role.reason).toBe('You shared 3 days in a row, and no one in the group did more.');
    });

    it('is Front Row when no one played more of the group\'s songs (at least 3)', () => {
      const result = summarize([
        share(ANA, 1, { listens: { [ME]: HOUR } }),
        share(ANA, 2, { listens: { [ME]: HOUR, [BO]: HOUR } }),
        share(BO, 3, { listens: { [ME]: HOUR } }),
        share(BO, 4)
      ]);

      expect(result.role.id).toBe('front_row');
      expect(result.role.reason).toBe('No one played more of the group\'s songs: you heard 3 of the 4 others shared.');
    });

    it('falls back to a plain sharer role with too little data', () => {
      const result = summarize([share(ME, 1, { artist: 'Same' }), share(ANA, 2, { artist: 'Same' })]);
      expect(result.role).toEqual({
        id: 'sharer',
        title: 'Sharer',
        reason: 'You shared 1 song. A role needs a few more shares or listens to settle.'
      });
    });

    it('says so when the viewer did nothing in the range', () => {
      const result = summarize([share(ANA, 1)]);
      expect(result.role.id).toBe('quiet');
      expect(result.role.reason).toBe('No shares or listens from you in this period yet.');
    });

    it('reports the role from the previous period of the same length', () => {
      const result = summarize([
        // Previous 30 days: two new artists → Patient Zero
        share(ME, 40, { artist: 'X' }),
        share(ME, 41, { artist: 'Y' }),
        // This period: nothing
        share(ANA, 1, { artist: 'Z' })
      ]);

      expect(result.role.id).toBe('quiet');
      expect(result.previousRole).toEqual({ id: 'patient_zero', title: 'Patient Zero' });
    });

    it('has no previous role for all time', () => {
      expect(summarize([share(ME, 1)], { range: 'all' }).previousRole).toBeNull();
    });
  });

  it('only counts members of the group', () => {
    // A former member's listen doesn't make a hit, and their shares don't compete.
    const result = summarize([
      share(ME, 1, { listens: { [ANA]: HOUR, [BO]: HOUR, gone: HOUR } }),
      share('gone', 1, { listens: { [ME]: HOUR } })
    ]);

    expect(result.hitRate).toEqual({ hits: 1, total: 1 });
  });
});
