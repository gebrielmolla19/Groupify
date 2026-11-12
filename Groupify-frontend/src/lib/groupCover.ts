/**
 * Generated group covers (#57).
 *
 * A cover is drawn entirely from the group's ID: a hue from the full colour
 * wheel, a second hue offset from it, and one of three crisp patterns. The
 * same ID always gives the same cover. Ported from `makeCover` in the design
 * mock (`project/Covers.dc.html`); keep the two in step so covers match it.
 *
 * Covers are artwork, like album art, so their colours are the same in light
 * and dark mode rather than following the theme tokens.
 */

export type CoverPattern = 'rings' | 'bars' | 'tiles';

export const COVER_PATTERNS: readonly CoverPattern[] = ['rings', 'bars', 'tiles'];

/** One absolutely positioned shape. Positions and sizes are % of the cover. */
export interface CoverShape {
  left: string;
  top: string;
  width: string;
  height: string;
  color: string;
  radius: string;
}

export interface CoverArt {
  pattern: CoverPattern;
  hue: number;
  background: string;
  shapes: CoverShape[];
}

/** The near-white third colour. Fixed because covers don't follow the theme. */
const COVER_WHITE = 'hsl(225 50% 97%)';

/** 32-bit FNV-1a hash of a string. */
function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32: a small seeded PRNG returning floats in [0, 1). */
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pct = (n: number) => `${Math.round(n * 10) / 10}%`;

const pick = <T,>(items: readonly T[], r: () => number): T => items[Math.floor(r() * items.length)];

export function makeGroupCover(groupId: string, forcePattern?: CoverPattern): CoverArt {
  const seed = hashString(groupId);
  const r0 = seededRandom(seed);
  const hue = Math.floor(r0() * 360);
  const offset = pick([35, 150, 180, 210], r0);
  const rolled = pick(COVER_PATTERNS, r0);
  const pattern = forcePattern ?? rolled;

  const background = `hsl(${hue} 42% 15%)`;
  const colors = [`hsl(${hue} 90% 70%)`, `hsl(${(hue + offset) % 360} 85% 62%)`, COVER_WHITE];
  const r = seededRandom(seed + 1);
  const shapes: CoverShape[] = [];

  if (pattern === 'rings') {
    // Concentric discs, alternating colour and background, around one anchor.
    const anchors = [[0, 100], [100, 100], [50, 50], [0, 0], [100, 0], [50, 100], [100, 50]];
    const [cx, cy] = pick(anchors, r);
    let d = 150 + r() * 70;
    for (let i = 0; d > 8 && i < 14; i++) {
      const color = i % 2 === 0 ? colors[Math.floor(i / 2) % colors.length] : background;
      shapes.push({ left: pct(cx - d / 2), top: pct(cy - d / 2), width: pct(d), height: pct(d), color, radius: '50%' });
      d -= i % 2 === 0 ? 9 + r() * 14 : 14 + r() * 24;
    }
  } else if (pattern === 'bars') {
    // Equaliser bars, bottom-aligned or mirrored around the middle.
    const n = 5 + Math.floor(r() * 4);
    const slot = 100 / n;
    const mirror = r() < 0.5;
    for (let i = 0; i < n; i++) {
      const h = 18 + r() * 72;
      shapes.push({
        left: pct(i * slot + slot * 0.2),
        top: pct(mirror ? (100 - h) / 2 : 92 - h),
        width: pct(slot * 0.6),
        height: pct(h),
        color: colors[Math.floor(r() * 2)],
        radius: '999px',
      });
    }
  } else {
    // 3×3 tiles, each a quarter circle, circle or square; some left empty.
    const cell = 100 / 3;
    const corners = ['100% 0 0 0', '0 100% 0 0', '0 0 100% 0', '0 0 0 100%', '50%', '0'];
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        if (r() < 0.18) {
          // Consume the same draws as a drawn tile so later tiles don't shift.
          r();
          r();
          continue;
        }
        shapes.push({
          left: pct(x * cell),
          top: pct(y * cell),
          width: pct(cell + 0.4),
          height: pct(cell + 0.4),
          color: pick(colors, r),
          radius: pick(corners, r),
        });
      }
    }
  }

  return { pattern, hue, background, shapes };
}
