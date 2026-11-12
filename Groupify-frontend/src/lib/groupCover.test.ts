import { describe, it, expect } from 'vitest';
import { makeGroupCover, COVER_PATTERNS } from './groupCover';

// Mongo-style ObjectIds, like real group IDs.
const ids = Array.from({ length: 300 }, (_, i) => `65f1a2b3c4d5e6f7${i.toString(16).padStart(8, '0')}`);

describe('makeGroupCover', () => {
  it('gives the same cover for the same ID', () => {
    expect(makeGroupCover(ids[0])).toEqual(makeGroupCover(ids[0]));
  });

  it('keeps existing groups on the cover they already have', () => {
    // Pinned so a change to the generator can't silently redraw every group.
    const cover = makeGroupCover(ids[0]);
    expect({ pattern: cover.pattern, background: cover.background, first: cover.shapes[0] }).toMatchInlineSnapshot(`
      {
        "background": "hsl(135 42% 15%)",
        "first": {
          "color": "hsl(135 90% 70%)",
          "height": "165.8%",
          "left": "-32.9%",
          "radius": "50%",
          "top": "-32.9%",
          "width": "165.8%",
        },
        "pattern": "rings",
      }
    `);
  });

  it('uses all three patterns and hues spread over the whole wheel', () => {
    const covers = ids.map((id) => makeGroupCover(id));
    const patterns = new Set(covers.map((c) => c.pattern));
    expect([...patterns].sort()).toEqual([...COVER_PATTERNS].sort());

    // Every 60° sixth of the wheel is used, so it's no fixed short palette.
    const sixths = new Set(covers.map((c) => Math.floor(c.hue / 60)));
    expect(sixths.size).toBe(6);
  });

  it('gives neighbouring IDs different covers', () => {
    const keys = ids.map((id) => JSON.stringify(makeGroupCover(id)));
    expect(new Set(keys).size).toBe(ids.length);
  });

  it.each(COVER_PATTERNS)('draws a %s cover with valid shapes', (pattern) => {
    for (const id of ids.slice(0, 50)) {
      const cover = makeGroupCover(id, pattern);
      expect(cover.pattern).toBe(pattern);
      expect(cover.shapes.length).toBeGreaterThan(0);
      for (const s of cover.shapes) {
        for (const v of [s.left, s.top, s.width, s.height]) expect(v).toMatch(/^-?\d+(\.\d)?%$/);
        expect(s.color).toMatch(/^hsl\(\d+ \d+% \d+%\)$/);
      }
    }
  });

  it('keeps bars inside the cover', () => {
    for (const id of ids.slice(0, 50)) {
      for (const s of makeGroupCover(id, 'bars').shapes) {
        expect(parseFloat(s.top)).toBeGreaterThanOrEqual(0);
        expect(parseFloat(s.top) + parseFloat(s.height)).toBeLessThanOrEqual(100.1);
      }
    }
  });
});
