const { summarizeSongs, LIST_LIMIT } = require('../src/services/songsSummaryService');

// A fixed "now" so windows don't move while the suite runs.
const NOW = new Date('2026-11-20T12:00:00Z');
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const ME = 'me';
const ANA = 'ana';
const BO = 'bo';
const GONE = 'gone'; // a former member
const MEMBERS = [ME, ANA, BO];
const NAMES = { [ME]: 'Me', [ANA]: 'Ana', [BO]: 'Bo', [GONE]: 'Gone' };

let seq = 0;
/** A share `daysAgo` days before NOW, with listens (ms after the share) and likes. */
function share(sharedBy, daysAgo, { listens = {}, likes = [] } = {}) {
  seq += 1;
  const createdAt = new Date(NOW.getTime() - daysAgo * DAY);
  return {
    _id: `s${seq}`,
    sharedBy,
    spotifyTrackId: `t${seq}`,
    trackName: `Track ${seq}`,
    artistName: 'Artist',
    trackImage: null,
    createdAt,
    listeners: Object.entries(listens).map(([user, ms]) => ({
      user,
      listenedAt: new Date(createdAt.getTime() + ms)
    })),
    likes: likes.map((user) => ({ user }))
  };
}

function summarize(shares, overrides = {}) {
  return summarizeSongs({
    shares,
    memberIds: MEMBERS,
    names: NAMES,
    viewerId: ME,
    range: '30d',
    now: NOW,
    timeZone: 'UTC',
    ...overrides
  });
}

const trackIds = (list) => list.shares.map((s) => s.shareId);

describe('summarizeSongs', () => {
  beforeEach(() => { seq = 0; });

  describe('sleeping on', () => {
    it('lists other members\' shares the viewer has no listen on, newest first', () => {
      const heard = share(ANA, 1, { listens: { [ME]: HOUR } });
      const older = share(BO, 5);
      const newer = share(ANA, 2);
      const mine = share(ME, 1);

      const result = summarize([heard, older, newer, mine]);

      expect(trackIds(result.sleepingOn)).toEqual([newer._id, older._id]);
      expect(result.sleepingOn.total).toBe(2);
      expect(result.sleepingOn.shares[0]).toMatchObject({
        spotifyTrackId: newer.spotifyTrackId,
        trackName: newer.trackName,
        artistName: 'Artist',
        sharedBy: { id: ANA, displayName: 'Ana' },
        sharedAt: newer.createdAt.toISOString()
      });
    });

    it('leaves out shares by former members and shares outside the range', () => {
      const result = summarize([share(GONE, 1), share(ANA, 10)], { range: '7d' });

      expect(result.sleepingOn).toEqual({ shares: [], total: 0 });
    });

    it(`returns at most ${LIST_LIMIT} rows but counts them all`, () => {
      const shares = Array.from({ length: LIST_LIMIT + 2 }, (_, i) => share(ANA, i + 1));

      const result = summarize(shares);

      expect(result.sleepingOn.shares).toHaveLength(LIST_LIMIT);
      expect(result.sleepingOn.total).toBe(LIST_LIMIT + 2);
    });
  });

  describe('slept on', () => {
    it('lists the viewer\'s shares no other member listened to, oldest first', () => {
      const newer = share(ME, 2);
      const older = share(ME, 6, { listens: { [GONE]: HOUR } }); // a former member's listen doesn't count
      const heard = share(ME, 3, { listens: { [BO]: HOUR } });

      const result = summarize([newer, older, heard, share(ANA, 4)]);

      expect(trackIds(result.sleptOn)).toEqual([older._id, newer._id]);
      expect(result.sleptOn.total).toBe(2);
      expect(result.sleptOn.others).toBe(2);
    });

    it('waits until a share is a day old', () => {
      const result = summarize([share(ME, 0.5)]);

      expect(result.sleptOn.total).toBe(0);
    });

    it('is empty when the viewer is the only member', () => {
      const result = summarize([share(ME, 3)], { memberIds: [ME] });

      expect(result.sleptOn).toEqual({ shares: [], total: 0, others: 0 });
    });
  });

  describe('records', () => {
    it('finds the fastest listen by every other member, timed to the last of them', () => {
      const slow = share(ANA, 3, { listens: { [ME]: 10 * MIN, [BO]: 5 * HOUR } });
      const fast = share(BO, 2, { listens: { [ME]: 30 * MIN, [ANA]: 38 * MIN } });
      share(ME, 1, { listens: { [ANA]: MIN } }); // Bo never listened: not a full-group listen

      const result = summarize([slow, fast]);

      expect(result.records.fastestFullListen).toMatchObject({
        shareId: fast._id,
        trackName: fast.trackName,
        sharedBy: { id: BO, displayName: 'Bo' },
        ms: 38 * MIN
      });
    });

    it('finds the most liked share, counting likes from other current members', () => {
      const a = share(ANA, 3, { likes: [ME, BO] });
      const b = share(BO, 2, { likes: [ME, BO, GONE] }); // own like and former member's don't count

      const result = summarize([a, b]);

      expect(result.records.mostLiked).toMatchObject({ shareId: a._id, likes: 2, others: 2 });
    });

    it('gives a tie for most liked to the more recent share', () => {
      const older = share(ANA, 3, { likes: [ME] });
      const newer = share(BO, 2, { likes: [ANA] });

      expect(summarize([older, newer]).records.mostLiked.shareId).toBe(newer._id);
    });

    it('counts the longest run of days on which any member shared', () => {
      const shares = [share(ANA, 9), share(ME, 8), share(BO, 7), share(ANA, 7), share(ME, 2), share(GONE, 6)];

      expect(summarize(shares).records.longestStreak).toEqual({ days: 3 });
    });

    it('has no records when nothing qualifies', () => {
      const result = summarize([share(GONE, 1, { listens: { [ME]: MIN, [ANA]: MIN, [BO]: MIN }, likes: [ME] })]);

      expect(result.records).toEqual({ fastestFullListen: null, mostLiked: null, longestStreak: null });
    });

    it('leaves out shares before the range', () => {
      const result = summarize([share(ANA, 10, { likes: [ME] })], { range: '7d' });

      expect(result.records.mostLiked).toBeNull();
      expect(result.records.longestStreak).toBeNull();
    });
  });
});
