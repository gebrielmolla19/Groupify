import { describe, it, expect } from 'vitest';
import {
  fanLine,
  fanEmptyLine,
  joinNames,
  previousVerdictLine,
  tastemakerLine,
  theyLikedLine,
  verdictLine,
  verdictTitle,
  youLikedLine,
} from './betweenYouCopy';
import type { BetweenYou } from '../types/analytics';

type Pair = NonNullable<BetweenYou['pair']>;
const pair = (overrides: Partial<Pair> = {}): Pair => ({
  member: 'ana',
  theirShares: 4,
  youLiked: 3,
  yourShares: 5,
  theyLiked: 1,
  verdict: { id: 'one_sided', leaning: 'you' },
  previousVerdict: null,
  ...overrides,
});

describe('betweenYouCopy', () => {
  it('titles each verdict', () => {
    expect(verdictTitle({ id: 'closest_match' })).toBe('Closest match');
    expect(verdictTitle({ id: 'one_sided', leaning: 'them' })).toBe('One-sided');
    expect(verdictTitle({ id: 'different_wavelengths' })).toBe('Different wavelengths');
    expect(verdictTitle({ id: 'common_ground' })).toBe('Common ground');
    expect(verdictTitle({ id: 'too_early' })).toBe('Too early to tell');
  });

  it('explains the verdict from the numbers', () => {
    expect(verdictLine(pair(), 'Ana')).toBe('You like Ana\'s shares more than Ana likes yours.');
    expect(verdictLine(pair({ verdict: { id: 'one_sided', leaning: 'them' } }), 'Ana'))
      .toBe('Ana likes your shares more than you like theirs.');
    expect(verdictLine(pair({ verdict: { id: 'closest_match' } }), 'Ana'))
      .toBe('You and Ana like more of each other\'s shares than you and anyone else do.');
    expect(verdictLine(pair({ verdict: { id: 'too_early' }, theirShares: 2, yourShares: 1 }), 'Ana'))
      .toBe('A verdict needs 3 shares from each of you in this period. Ana has 2, you have 1.');
  });

  it('counts likes each way, or says who hasn\'t shared', () => {
    expect(youLikedLine(pair(), 'Ana')).toBe('You liked 3 of Ana\'s 4 shares');
    expect(theyLikedLine(pair(), 'Ana')).toBe('Ana liked 1 of your 5 shares');
    expect(youLikedLine(pair({ theirShares: 0, youLiked: 0 }), 'Ana')).toBe('Ana hasn\'t shared in this period');
    expect(theyLikedLine(pair({ yourShares: 0, theyLiked: 0 }), 'Ana')).toBe('You haven\'t shared in this period');
    expect(theyLikedLine(pair({ yourShares: 1, theyLiked: 1 }), 'Ana')).toBe('Ana liked 1 of your 1 share');
  });

  it('names the previous period\'s verdict', () => {
    expect(previousVerdictLine('30d', { id: 'common_ground' })).toBe('Previous 30 days: Common ground');
    expect(previousVerdictLine('7d', { id: 'too_early' })).toBe('Previous 7 days: Too early to tell');
  });

  it('joins names, folding long lists', () => {
    expect(joinNames(['Ana'])).toBe('Ana');
    expect(joinNames(['Ana', 'Bo'])).toBe('Ana and Bo');
    expect(joinNames(['Ana', 'Bo', 'Cy'])).toBe('Ana, Bo and Cy');
    expect(joinNames(['Ana', 'Bo', 'Cy', 'Di', 'Ed'])).toBe('Ana, Bo and 3 others');
  });

  it('describes the biggest fan\'s listens and likes', () => {
    expect(fanLine({ members: ['a'], listens: 2, likes: 1, yourShares: 3 })).toBe('Listened to 2 and liked 1 of your 3 shares.');
    expect(fanLine({ members: ['a', 'b'], listens: 2, likes: 0, yourShares: 3 })).toBe('Each listened to 2 of your 3 shares.');
    expect(fanLine({ members: ['a'], listens: 0, likes: 1, yourShares: 1 })).toBe('Liked 1 of your 1 share.');
    expect(fanEmptyLine(0)).toBe('Shows once you share something in this period.');
    expect(fanEmptyLine(4)).toBe('No one has listened to or liked your shares in this period yet.');
  });

  it('describes the tastemaker\'s shares you liked', () => {
    expect(tastemakerLine({ members: ['a'], liked: 3, shares: 4 }, 'Ana')).toBe('You liked 3 of Ana\'s 4 shares.');
    expect(tastemakerLine({ members: ['a', 'b'], liked: 2, shares: 3 }, 'Ana and Bo')).toBe('You liked 2 of 3 shares from each.');
  });
});
