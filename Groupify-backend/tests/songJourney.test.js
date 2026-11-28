const { summarizeSongs } = require('../src/services/songJourneyService');

const NOW = new Date('2026-11-20T12:00:00Z');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const ME = 'me';
const ANA = 'ana';
const BO = 'bo';
const GONE = 'gone';
const MEMBERS = [ME, ANA, BO];

let seq = 0;
/** A share `daysAgo` days before NOW; listens: { memberId: msAfterShare }. */
function share(sharedBy, daysAgo, listens = {}) {
  seq += 1;
  const createdAt = new Date(NOW.getTime() - daysAgo * DAY);
  return {
    _id: `s${seq}`,
    sharedBy,
    trackName: `Track ${seq}`,
    artistName: 'Artist',
    trackImage: null,
    createdAt,
    listeners: Object.entries(listens).map(([user, ms]) => ({
      user,
      listenedAt: new Date(createdAt.getTime() + ms),
      timeToListen: ms
    }))
  };
}

function summarize(shares, overrides = {}) {
  return summarizeSongs({
    shares,
    memberIds: MEMBERS,
    viewerId: ME,
    range: '30d',
    now: NOW,
    ...overrides
  });
}

describe('summarizeSongs', () => {
  beforeEach(() => { seq = 0; });

  it('lists the shares in the period, newest first', () => {
    const result = summarize([share(ANA, 3), share(ME, 1), share(BO, 40)]);
    expect(result.songs.map((s) => s.shareId)).toEqual(['s2', 's1']);
    expect(result.viewerId).toBe(ME);
    expect(result.range).toBe('30d');
  });

  it('lists every share for all time', () => {
    const result = summarize([share(ANA, 3), share(BO, 400)], { range: 'all' });
    expect(result.songs).toHaveLength(2);
  });

  it('keeps the requested share even when it is older than the period', () => {
    const recent = share(ME, 1);
    const old = share(ANA, 90);
    const result = summarize([recent, old, share(BO, 60)], { shareId: old._id });
    expect(result.songs.map((s) => s.shareId)).toEqual([recent._id, old._id]);
  });

  it('gives each listen from the audience, earliest first, and ignores the sharer\'s own', () => {
    const [s] = summarize([share(ME, 1, { [BO]: 3 * HOUR, [ME]: 0, [ANA]: HOUR })]).songs;
    expect(s.listens).toEqual([
      { memberId: ANA, afterMs: HOUR },
      { memberId: BO, afterMs: 3 * HOUR }
    ]);
    expect(s.audience).toBe(2);
  });

  it('works out the wait from listenedAt when timeToListen is missing', () => {
    const s0 = share(ANA, 2);
    s0.listeners.push({ user: ME, listenedAt: new Date(s0.createdAt.getTime() + 2 * HOUR), timeToListen: null });
    const [s] = summarize([s0]).songs;
    expect(s.listens).toEqual([{ memberId: ME, afterMs: 2 * HOUR }]);
  });

  describe('spread', () => {
    it('is the time to the last listen once the whole audience has listened', () => {
      const [s] = summarize([share(ME, 1, { [ANA]: HOUR, [BO]: 5 * HOUR })]).songs;
      expect(s.spreadMs).toBe(5 * HOUR);
    });

    it('is null while someone in the audience has not listened', () => {
      const [s] = summarize([share(ME, 1, { [ANA]: HOUR })]).songs;
      expect(s.spreadMs).toBeNull();
    });

    it('is null when there is no one else in the group', () => {
      const [s] = summarize([share(ME, 1)], { memberIds: [ME] }).songs;
      expect(s.audience).toBe(0);
      expect(s.spreadMs).toBeNull();
    });
  });

  describe('former members', () => {
    it('shows their shares as shared by no one, with every current member as the audience', () => {
      const [s] = summarize([share(GONE, 1, { [ME]: HOUR, [ANA]: HOUR, [BO]: 2 * HOUR })]).songs;
      expect(s.sharedBy).toBeNull();
      expect(s.audience).toBe(3);
      expect(s.spreadMs).toBe(2 * HOUR);
    });

    it('leaves out their listens', () => {
      const [s] = summarize([share(ME, 1, { [GONE]: HOUR, [ANA]: 2 * HOUR })]).songs;
      expect(s.listens).toEqual([{ memberId: ANA, afterMs: 2 * HOUR }]);
    });
  });

  it('returns the current members in group order', () => {
    expect(summarize([]).members).toEqual([ME, ANA, BO]);
  });
});
