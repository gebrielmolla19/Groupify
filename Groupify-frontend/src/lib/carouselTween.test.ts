import { describe, it, expect } from 'vitest';
import { cardTween, visibleFraction } from './carouselTween';

const rect = (left: number, width: number) => ({ left, right: left + width, width });

describe('visibleFraction', () => {
  it('is 1 for a card fully inside the viewport', () => {
    expect(visibleFraction(rect(10, 300), rect(0, 375))).toBe(1);
  });

  it('is the share of the card that shows when it peeks in from the side', () => {
    expect(visibleFraction(rect(300, 300), rect(0, 375))).toBe(0.25);
    expect(visibleFraction(rect(-240, 300), rect(0, 375))).toBe(0.2);
  });

  it('is 0 for a card out of view or with no width', () => {
    expect(visibleFraction(rect(400, 300), rect(0, 375))).toBe(0);
    expect(visibleFraction(rect(0, 0), rect(0, 375))).toBe(0);
  });
});

describe('cardTween', () => {
  it('leaves a fully visible card at full size and opacity', () => {
    expect(cardTween(1)).toEqual({ scale: 1, opacity: 1 });
  });

  it('shrinks and dims a card that is mostly out of view', () => {
    const { scale, opacity } = cardTween(0);
    expect(scale).toBeCloseTo(0.92);
    expect(opacity).toBeCloseTo(0.45);
  });

  it('moves smoothly in between and clamps out-of-range input', () => {
    const half = cardTween(0.5);
    expect(half.scale).toBeCloseTo(0.96);
    expect(half.opacity).toBeCloseTo(0.725);
    expect(cardTween(2)).toEqual({ scale: 1, opacity: 1 });
    expect(cardTween(-1)).toEqual(cardTween(0));
  });
});
