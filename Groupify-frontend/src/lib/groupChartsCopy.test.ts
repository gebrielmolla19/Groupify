import { describe, expect, it } from 'vitest';
import { activityHeadline, superlativeHeadline, superlativeValue, tasteHeadline } from './groupChartsCopy';
import type { TasteGravityResponse } from '../types/analytics';

describe('activityHeadline', () => {
  const totals = { shares: 36, activity: 151, peakDay: 'Jan 18' };

  it('counts songs shared in Shares mode, with the busiest day', () => {
    expect(activityHeadline(totals, 'shares', '30d')).toBe(
      'The group shared 36 songs in the last 30 days. The busiest day was Jan 18.'
    );
  });

  it('counts shares, listens and likes in Engagement mode', () => {
    expect(activityHeadline(totals, 'engagement', '7d')).toBe(
      'The group made 151 shares, listens and likes in the last 7 days. The busiest day was Jan 18.'
    );
  });

  it('says "so far" for All and leaves out a missing busiest day', () => {
    expect(activityHeadline({ shares: 1, activity: 1, peakDay: null }, 'shares', 'all')).toBe(
      'The group shared 1 song so far.'
    );
  });

  it('says plainly when the period is empty', () => {
    expect(activityHeadline({ shares: 0, activity: 0, peakDay: null }, 'shares', '7d')).toBe(
      'No shares, listens or likes in the last 7 days.'
    );
    expect(activityHeadline({ shares: 0, activity: 0, peakDay: null }, 'engagement', 'all')).toBe(
      'No shares, listens or likes yet.'
    );
  });
});

describe('tasteHeadline', () => {
  const node = (id: string, name: string) => ({ id, name, img: null, mass: 0.5, topArtists: [] });
  const data: TasteGravityResponse = {
    nodes: [node('me', 'Me'), node('a', 'Alex'), node('b', 'Blair')],
    links: [
      { source: 'me', target: 'a', gravity: 0.3, reasons: [] },
      { source: 'b', target: 'me', gravity: 0.7, reasons: [] },
      { source: 'a', target: 'b', gravity: 0.9, reasons: [] },
    ],
    insights: [],
  };

  it("names the member whose taste is closest to the viewer's", () => {
    expect(tasteHeadline(data, 'me')).toBe("You're closest in taste to Blair.");
  });

  it('reads links whose ends the D3 simulation replaced with nodes', () => {
    const simulated = {
      ...data,
      links: data.links.map((l) => ({ ...l, source: { id: l.source as string }, target: { id: l.target as string } })),
    } as unknown as TasteGravityResponse;
    expect(tasteHeadline(simulated, 'me')).toBe("You're closest in taste to Blair.");
  });

  it('says so when the viewer shares no artist with anyone', () => {
    expect(tasteHeadline({ ...data, links: [data.links[2]] }, 'me')).toBe(
      "You don't share a top artist with anyone in this period yet."
    );
  });

  it('explains the chart when the viewer is not in it', () => {
    expect(tasteHeadline(data, 'someone-else')).toBe('Members are pulled together by the artists they both listen to.');
    expect(tasteHeadline(data, undefined)).toBe('Members are pulled together by the artists they both listen to.');
  });
});

describe('superlativeHeadline and superlativeValue', () => {
  it('names the holder, or says "You" for the viewer', () => {
    expect(superlativeHeadline('trendsetter', 'Alex')).toBe('Alex got the most likes');
    expect(superlativeHeadline('hypeMan', null)).toBe('You gave the most likes');
    expect(superlativeHeadline('dj', 'Alex')).toBe('Alex shared the most songs');
    expect(superlativeHeadline('diehard', null)).toBe('You listened to the most songs');
  });

  it('gives the number its unit, singular for one', () => {
    expect(superlativeValue('trendsetter', 5)).toBe('likes received');
    expect(superlativeValue('hypeMan', 1)).toBe('like given');
    expect(superlativeValue('dj', 1)).toBe('song shared');
    expect(superlativeValue('diehard', 6)).toBe('songs listened to');
  });
});
