import type { BetweenYou, PairVerdict, ViewerSummaryRange } from '../types/analytics';

/**
 * The words on the "Between you" cards of Group Dynamics. Every sentence is
 * built from the numbers it sits next to, so the copy can't contradict them.
 */

type Pair = NonNullable<BetweenYou['pair']>;
type Fan = NonNullable<BetweenYou['biggestFan']>;
type Tastemaker = NonNullable<BetweenYou['tastemaker']>;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Shares each side needs before a pair gets a verdict; matches the backend. */
const MIN_SHARES = 3;

const TITLES: Record<PairVerdict['id'], string> = {
  closest_match: 'Closest match',
  one_sided: 'One-sided',
  different_wavelengths: 'Different wavelengths',
  common_ground: 'Common ground',
  too_early: 'Too early to tell',
};

export const verdictTitle = (verdict: PairVerdict): string => TITLES[verdict.id];

/** One sentence saying what the verdict means for this pair. */
export const verdictLine = (pair: Pair, name: string): string => {
  const { verdict } = pair;
  switch (verdict.id) {
    case 'closest_match':
      return `You and ${name} like more of each other's shares than you and anyone else do.`;
    case 'one_sided':
      return verdict.leaning === 'you'
        ? `You like ${name}'s shares more than ${name} likes yours.`
        : `${name} likes your shares more than you like theirs.`;
    case 'different_wavelengths':
      return 'Neither of you likes much of what the other shares yet.';
    case 'common_ground':
      return 'You each like some of what the other shares.';
    case 'too_early':
      return `A verdict needs ${MIN_SHARES} shares from each of you in this period. ${name} has ${pair.theirShares}, you have ${pair.yourShares}.`;
  }
};

export const youLikedLine = (pair: Pair, name: string): string =>
  pair.theirShares === 0
    ? `${name} hasn't shared in this period`
    : `You liked ${pair.youLiked} of ${name}'s ${plural(pair.theirShares, 'share')}`;

export const theyLikedLine = (pair: Pair, name: string): string =>
  pair.yourShares === 0
    ? 'You haven\'t shared in this period'
    : `${name} liked ${pair.theyLiked} of your ${plural(pair.yourShares, 'share')}`;

/** "Previous 30 days: Common ground" */
export const previousVerdictLine = (range: ViewerSummaryRange, verdict: PairVerdict): string =>
  `Previous ${range === '7d' ? '7' : '30'} days: ${verdictTitle(verdict)}`;

/** "Ana", "Ana and Bo", "Ana, Bo and Cy", "Ana, Bo and 3 others". */
export const joinNames = (names: string[]): string => {
  if (names.length <= 1) return names[0] ?? '';
  if (names.length > 3) return `${names.slice(0, 2).join(', ')} and ${names.length - 2} others`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

export const fanLine = (fan: Fan): string => {
  const parts: string[] = [];
  if (fan.listens > 0) parts.push(`listened to ${fan.listens}`);
  if (fan.likes > 0) parts.push(`liked ${fan.likes}`);
  const sentence = `${parts.join(' and ')} of your ${plural(fan.yourShares, 'share')}.`;
  return fan.members.length > 1
    ? `Each ${sentence}`
    : sentence.charAt(0).toUpperCase() + sentence.slice(1);
};

export const fanEmptyLine = (yourShares: number): string =>
  yourShares === 0
    ? 'Shows once you share something in this period.'
    : 'No one has listened to or liked your shares in this period yet.';

export const tastemakerLine = (tastemaker: Tastemaker, names: string): string =>
  tastemaker.members.length > 1
    ? `You liked ${tastemaker.liked} of ${plural(tastemaker.shares, 'share')} from each.`
    : `You liked ${tastemaker.liked} of ${names}'s ${plural(tastemaker.shares, 'share')}.`;

export const TASTEMAKER_EMPTY = `Shows once you like shares from someone with at least ${MIN_SHARES} in this period.`;
