import { describe, it, expect } from 'vitest';
import { placeTourCard } from './tourPlacement';

const viewport = { width: 1440, height: 900 };
const card = { width: 320, height: 200 };
const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height });

describe('placeTourCard', () => {
  it('puts the card under the target, aligned to its left edge', () => {
    expect(placeTourCard({ target: rect(300, 100, 600, 64), card, viewport, bottomInset: 92 })).toEqual({ left: 300, top: 176 });
  });

  it('goes above the target when there is no room below it', () => {
    expect(placeTourCard({ target: rect(300, 600, 600, 64), card, viewport, bottomInset: 92 })).toEqual({ left: 300, top: 388 });
  });

  it('keeps the card inside the viewport horizontally', () => {
    expect(placeTourCard({ target: rect(1300, 100, 120, 40), card, viewport, bottomInset: 0 }).left).toBe(1440 - 320 - 16);
    expect(placeTourCard({ target: rect(-40, 100, 120, 40), card, viewport, bottomInset: 0 }).left).toBe(16);
  });

  it('sits beside a target too tall to go above or below, such as the detail pane', () => {
    expect(placeTourCard({ target: rect(1060, 8, 372, 800), card, viewport, bottomInset: 92 })).toEqual({ left: 1060 - 12 - 320, top: 16 });
  });

  it('sits at the bottom centre, above the player, without a target', () => {
    expect(placeTourCard({ target: null, card, viewport, bottomInset: 92 })).toEqual({ left: 560, top: 900 - 92 - 200 });
  });

  it('narrows to the phone width and stays above the tab bar and player', () => {
    const phone = { width: 390, height: 844 };
    const narrow = { width: 358, height: 220 };
    const placed = placeTourCard({ target: rect(8, 700, 374, 72), card: narrow, viewport: phone, bottomInset: 145 });
    expect(placed.left).toBe(16);
    expect(placed.top + narrow.height).toBeLessThanOrEqual(700);
  });
});
