/** A box in viewport pixels, as from getBoundingClientRect. */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface PlaceTourCardInput {
  /** The highlighted element, already padded; null when the step has none on screen. */
  target: Box | null;
  card: { width: number; height: number };
  viewport: { width: number; height: number };
  /** Space kept clear at the bottom of the viewport (player bar, tab bar). */
  bottomInset: number;
}

const MARGIN = 16;
const GAP = 12;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

/**
 * Where the walkthrough card goes (#57): under its target, else above it,
 * else beside it, always inside the viewport and clear of the bottom inset.
 * With no target, or no room anywhere, it sits at the bottom centre.
 */
export function placeTourCard({ target, card, viewport, bottomInset }: PlaceTourCardInput): { left: number; top: number } {
  const floor = viewport.height - bottomInset;
  const fallback = { left: Math.round((viewport.width - card.width) / 2), top: floor - card.height };
  if (!target) return fallback;

  const right = target.left + target.width;
  const bottom = target.top + target.height;
  const alignedLeft = clamp(target.left, MARGIN, viewport.width - card.width - MARGIN);
  const besideTop = clamp(target.top, MARGIN, floor - card.height);

  if (bottom + GAP + card.height <= floor) return { left: alignedLeft, top: bottom + GAP };
  if (target.top - GAP - card.height >= MARGIN) return { left: alignedLeft, top: target.top - GAP - card.height };
  if (target.left - GAP - card.width >= MARGIN) return { left: target.left - GAP - card.width, top: besideTop };
  if (right + GAP + card.width <= viewport.width - MARGIN) return { left: right + GAP, top: besideTop };
  return fallback;
}
