const { summarizeBetween } = require('../src/services/betweenYouService');

// A fixed "now" so windows don't move while the suite runs.
const NOW = new Date('2026-11-20T12:00:00Z');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const ME = 'me';
const ANA = 'ana';
const BO = 'bo';
const CY = 'cy';
const MEMBERS = [ME, ANA, BO];

let seq = 0;
/** A share `daysAgo` days before NOW, with listens and likes from the given members. */
function share(sharedBy, daysAgo, { listens = [], likes = [] } = {}) {
  seq += 1;
  const createdAt = new Date(NOW.getTime() - daysAgo * DAY);
  return {
    _id: `s${seq}`,
    sharedBy,
    createdAt,
    listeners: listens.map((user) => ({ user, timeToListen: HOUR })),
    likes: likes.map((user) => ({ user }))
  };
}

/** `n` shares by `sharedBy`, the first `liked` of them liked by `likers`. */
function shares(sharedBy, n, { liked = 0, likers = [], listens = [], daysAgo = 1 } = {}) {
  return Array.from({ length: n }, (_, i) => share(sharedBy, daysAgo, {
    likes: i < liked ? likers : [],
    listens
  }));
}

function summarize(list, overrides = {}) {
  return summarizeBetween({
    shares: list,
    memberIds: MEMBERS,
    viewerId: ME,
    memberId: undefined,
    range: '30d',
    now: NOW,
    ...overrides
  });
}

describe('summarizeBetween', () => {
  beforeEach(() => { seq = 0; });

  describe('pair', () => {
    it('counts the other member\'s shares the viewer liked, and the viewer\'s shares they liked', () => {
      const result = summarize([
        ...shares(ANA, 4, { liked: 3, likers: [ME] }),
        ...shares(ME, 5, { liked: 1, likers: [ANA] })
      ], { memberId: ANA });

      expect(result.pair).toMatchObject({
        member: ANA,
        theirShares: 4,
        youLiked: 3,
        yourShares: 5,
        theyLiked: 1
      });
    });

    it('ignores the viewer\'s likes on their own shares and shares outside the period', () => {
      const result = summarize([
        share(ME, 1, { likes: [ME, ANA] }),
        share(ANA, 40, { likes: [ME] })
      ], { memberId: ANA });

      expect(result.pair).toMatchObject({ theirShares: 0, youLiked: 0, yourShares: 1, theyLiked: 1 });
    });

    it('defaults to the member with the most likes between you', () => {
      const result = summarize([
        ...shares(ANA, 3, { liked: 1, likers: [ME] }),
        ...shares(BO, 3, { liked: 2, likers: [ME] }),
        ...shares(ME, 3, { liked: 1, likers: [BO] })
      ]);

      expect(result.pair.member).toBe(BO);
    });

    it('is null when the viewer is the only member', () => {
      const result = summarize([share(ME, 1)], { memberIds: [ME] });

      expect(result.pair).toBeNull();
      expect(result.biggestFan).toBeNull();
      expect(result.tastemaker).toBeNull();
    });
  });

  describe('verdict', () => {
    it('is too early when either side has fewer than 3 shares', () => {
      const result = summarize([
        ...shares(ANA, 2, { liked: 2, likers: [ME] }),
        ...shares(ME, 5, { liked: 5, likers: [ANA] })
      ], { memberId: ANA });

      expect(result.pair.verdict).toEqual({ id: 'too_early' });
    });

    it('is closest match for the member with the highest like rate both ways', () => {
      const list = [
        ...shares(ANA, 3, { liked: 2, likers: [ME] }),
        ...shares(BO, 3, { liked: 3, likers: [ME] }),
        ...shares(ME, 3, { liked: 2, likers: [ANA, BO] })
      ];

      expect(summarize(list, { memberId: BO }).pair.verdict).toEqual({ id: 'closest_match' });
      // Ana's pair is just as close on the lower side (2 of 3 both ways), so she ties.
      expect(summarize(list, { memberId: ANA }).pair.verdict).toEqual({ id: 'closest_match' });
    });

    it('is not closest match when someone else\'s pair is closer', () => {
      const result = summarize([
        ...shares(ANA, 3, { liked: 3, likers: [ME] }),
        ...shares(BO, 3, { liked: 1, likers: [ME] }),
        ...shares(ME, 3, { liked: 3, likers: [ANA] }),
        // Bo likes 1 of my 4: well behind Ana both ways.
        share(ME, 2, { likes: [BO] })
      ], { memberId: BO });

      expect(result.pair.verdict.id).not.toBe('closest_match');
    });

    it('is one-sided, leaning towards whoever likes more', () => {
      const mine = summarize([
        ...shares(ANA, 4, { liked: 4, likers: [ME] }),
        ...shares(ME, 4)
      ], { memberId: ANA });
      const theirs = summarize([
        ...shares(ANA, 4),
        ...shares(ME, 4, { liked: 3, likers: [ANA] })
      ], { memberId: ANA });

      expect(mine.pair.verdict).toEqual({ id: 'one_sided', leaning: 'you' });
      expect(theirs.pair.verdict).toEqual({ id: 'one_sided', leaning: 'them' });
    });

    it('is different wavelengths when both like few of the other\'s shares', () => {
      const result = summarize([
        ...shares(ANA, 6),
        ...shares(ME, 6, { liked: 1, likers: [ANA] })
      ], { memberId: ANA });

      expect(result.pair.verdict).toEqual({ id: 'different_wavelengths' });
    });

    it('is common ground otherwise', () => {
      const result = summarize([
        ...shares(ANA, 4, { liked: 1, likers: [ME] }),
        ...shares(ME, 4, { liked: 1, likers: [ANA] }),
        // Bo's pair is closer, so Ana's isn't the closest match.
        ...shares(BO, 3, { liked: 3, likers: [ME] }),
        share(ME, 2, { likes: [BO] }),
        share(ME, 2, { likes: [BO] })
      ], { memberId: ANA });

      expect(result.pair.verdict).toEqual({ id: 'common_ground' });
    });

    it('gives the verdict for the previous period of the same length', () => {
      const list = [
        ...shares(ANA, 3, { liked: 3, likers: [ME], daysAgo: 10 }),
        ...shares(ME, 3, { daysAgo: 10 })
      ];

      expect(summarize(list, { memberId: ANA, range: '7d' }).pair.previousVerdict)
        .toEqual({ id: 'one_sided', leaning: 'you' });
      expect(summarize(list, { memberId: ANA, range: 'all' }).pair.previousVerdict).toBeNull();
    });
  });

  describe('biggest fan', () => {
    it('is the member with the most listens and likes on the viewer\'s shares', () => {
      const result = summarize([
        share(ME, 1, { listens: [ANA, BO], likes: [ANA] }),
        share(ME, 2, { listens: [ANA] }),
        share(ME, 3, { listens: [BO] })
      ]);

      expect(result.biggestFan).toEqual({ members: [ANA], listens: 2, likes: 1, yourShares: 3 });
    });

    it('breaks a tie by likes, and names members still level together', () => {
      const byLikes = summarize([
        share(ME, 1, { listens: [ANA, BO], likes: [BO] }),
        share(ME, 2, { listens: [ANA] })
      ]);
      const level = summarize([
        share(ME, 1, { listens: [ANA, BO] })
      ]);

      expect(byLikes.biggestFan.members).toEqual([BO]);
      expect(level.biggestFan.members).toEqual([ANA, BO]);
    });

    it('is null when no one has listened to or liked the viewer\'s shares', () => {
      expect(summarize([share(ME, 1)]).biggestFan).toBeNull();
    });

    it('doesn\'t count former members', () => {
      const result = summarize([share(ME, 1, { listens: [CY], likes: [CY] })]);

      expect(result.biggestFan).toBeNull();
    });
  });

  describe('tastemaker', () => {
    it('is the member whose shares the viewer likes at the highest rate', () => {
      const result = summarize([
        ...shares(ANA, 6, { liked: 4, likers: [ME] }),
        ...shares(BO, 3, { liked: 3, likers: [ME] })
      ]);

      expect(result.tastemaker).toEqual({ members: [BO], liked: 3, shares: 3 });
    });

    it('needs at least 3 shares from the member', () => {
      const result = summarize([
        ...shares(ANA, 2, { liked: 2, likers: [ME] }),
        ...shares(BO, 4, { liked: 1, likers: [ME] })
      ]);

      expect(result.tastemaker).toEqual({ members: [BO], liked: 1, shares: 4 });
    });

    it('breaks a rate tie by number of likes', () => {
      const result = summarize([
        ...shares(ANA, 6, { liked: 3, likers: [ME] }),
        ...shares(BO, 4, { liked: 2, likers: [ME] })
      ]);

      expect(result.tastemaker.members).toEqual([ANA]);
    });

    it('is null when the viewer has liked none of the others\' shares', () => {
      expect(summarize(shares(ANA, 4)).tastemaker).toBeNull();
    });

    it('ignores shares by former members', () => {
      expect(summarize(shares(CY, 4, { liked: 4, likers: [ME] })).tastemaker).toBeNull();
    });
  });
});
