/**
 * The swipe effect on carousel cards: a card shrinks and dims as it leaves
 * the viewport and grows back as it snaps in. Driven by how much of the card
 * is visible, so it follows the finger and works with one or two cards in
 * view.
 */

type Span = { left: number; right: number; width: number };

const MIN_SCALE = 0.92;
const MIN_OPACITY = 0.45;

/** How much of `card` (0 to 1) lies inside `viewport`, horizontally. */
export function visibleFraction(card: Span, viewport: Span): number {
  if (card.width <= 0) return 0;
  const overlap = Math.min(card.right, viewport.right) - Math.max(card.left, viewport.left);
  return Math.max(0, Math.min(1, overlap / card.width));
}

/** Scale and opacity for a card that is `visible` (0 to 1) in view. */
export function cardTween(visible: number): { scale: number; opacity: number } {
  const t = Math.max(0, Math.min(1, visible));
  return {
    scale: MIN_SCALE + (1 - MIN_SCALE) * t,
    opacity: MIN_OPACITY + (1 - MIN_OPACITY) * t,
  };
}
