import { describe, it, expect } from 'vitest';
import {
  bestShareLine,
  discoveryLine,
  formatWait,
  hitRateLine,
  hitRatePercent,
  previousRoleLine,
  reflexLine,
  roleLabel,
  streakLine,
} from './viewerSummaryCopy';

const MIN = 60_000;
const HR = 60 * MIN;

describe('viewerSummaryCopy', () => {
  it('names the period', () => {
    expect(roleLabel('30d')).toBe('Your role, last 30 days');
    expect(roleLabel('all')).toBe('Your role so far');
    expect(previousRoleLine('7d', 'Tastemaker')).toBe('Previous 7 days: Tastemaker');
  });

  it('formats waits in the unit a person would use', () => {
    expect(formatWait(20_000)).toBe('under a minute');
    expect(formatWait(6 * MIN)).toBe('6 min');
    expect(formatWait(3 * HR)).toBe('3 hr');
    expect(formatWait(30 * HR)).toBe('30 hr');
    expect(formatWait(72 * HR)).toBe('3 days');
  });

  it('describes the hit rate, including when there is nothing to rate', () => {
    expect(hitRatePercent({ hits: 7, total: 9 })).toBe(78);
    expect(hitRatePercent({ hits: 0, total: 0 })).toBeNull();
    expect(hitRatePercent(null)).toBeNull();
    expect(hitRateLine({ hits: 7, total: 9 })).toBe('7 of your 9 shares were listened to by everyone.');
    expect(hitRateLine({ hits: 1, total: 1 })).toBe('1 of your 1 share was listened to by everyone.');
    expect(hitRateLine({ hits: 0, total: 0 })).toBe('None of your shares in this period yet.');
    expect(hitRateLine(null)).toBe('Shows once someone else is in the group.');
  });

  it('describes the streak against the record', () => {
    expect(streakLine({ longest: 5, record: 6 }, '30d')).toBe('Your longest in the last 30 days. Record: 6.');
    expect(streakLine({ longest: 0, record: 2 }, '7d')).toBe('No shares in the last 7 days. Record: 2.');
    expect(streakLine({ longest: 4, record: 4 }, 'all')).toBe('Your longest run of days with a share.');
  });

  it('says how the best share landed, with "all" only when everyone did', () => {
    const share = { shareId: 's1', trackName: 'Sample', artistName: 'Sample Artist', others: 4 };
    expect(bestShareLine({ ...share, listens: 4, likes: 3 })).toBe('Sample Artist · all 4 listened, 3 of 4 liked');
    expect(bestShareLine({ ...share, others: 1, listens: 1, likes: 0 })).toBe('Sample Artist · 1 of 1 listened, 0 of 1 liked');
  });

  it('describes discovery credit', () => {
    expect(discoveryLine({ artists: 6, resharedByOthers: 2 })).toBe('artists you brought to the group first. 2 were shared again by others.');
    expect(discoveryLine({ artists: 1, resharedByOthers: 0 })).toBe('artist you brought to the group first. None shared again by others yet.');
    expect(discoveryLine({ artists: 0, resharedByOthers: 0 })).toBe('No artists you brought to the group first in this period.');
  });

  it('compares the viewer\'s speeds with the group only from the numbers it has', () => {
    expect(reflexLine({ youPlayMs: 6 * MIN, groupPlayMs: 3 * HR, yoursPlayedMs: 42 * MIN, groupYoursPlayedMs: 5 * HR }))
      .toBe('You listen to others\' shares faster than the group usually does, and the group gets to your picks sooner than usual.');
    expect(reflexLine({ youPlayMs: 3 * HR, groupPlayMs: 3 * HR, yoursPlayedMs: null, groupYoursPlayedMs: null }))
      .toBe('You listen to others\' shares about as fast as the group usually does.');
    expect(reflexLine({ youPlayMs: null, groupPlayMs: null, yoursPlayedMs: 9 * HR, groupYoursPlayedMs: 2 * HR }))
      .toBe('The group gets to your picks later than usual.');
    expect(reflexLine({ youPlayMs: null, groupPlayMs: null, yoursPlayedMs: null, groupYoursPlayedMs: null })).toBeNull();
  });
});
