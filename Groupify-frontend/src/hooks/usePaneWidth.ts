import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { logger } from '../utils/logger';

interface PaneWidthOptions {
  /** localStorage key the width is saved under. */
  storageKey: string;
  initial: number;
  min: number;
  max: number;
  /** Pixels per arrow-key press. */
  step?: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function readWidth({ storageKey, initial, min, max }: PaneWidthOptions): number {
  try {
    const saved = Number(localStorage.getItem(storageKey));
    return saved ? clamp(saved, min, max) : initial;
  } catch (err) {
    logger.warn('Could not read saved pane width', err);
    return initial;
  }
}

/**
 * Width of a pane the user resizes by dragging (or arrow-keying) the gutter
 * on its right edge. Returns props for that gutter: an ARIA window splitter.
 * The width is clamped and saved per browser.
 */
export function usePaneWidth(options: PaneWidthOptions) {
  const { storageKey, min, max, step = 16 } = options;
  const [width, setWidthState] = useState(() => readWidth(options));
  const drag = useRef<{ x: number; width: number } | null>(null);

  const setWidth = useCallback((w: number) => setWidthState(clamp(Math.round(w), min, max)), [min, max]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(width));
    } catch (err) {
      logger.warn('Could not save pane width', err);
    }
  }, [storageKey, width]);

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, width };
  };
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    if (drag.current) setWidth(drag.current.width + e.clientX - drag.current.x);
  };
  const endDrag = () => {
    drag.current = null;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const next = { ArrowLeft: width - step, ArrowRight: width + step, Home: min, End: max }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setWidth(next);
  };

  const separatorProps = {
    role: 'separator',
    tabIndex: 0,
    'aria-orientation': 'vertical',
    'aria-valuenow': width,
    'aria-valuemin': min,
    'aria-valuemax': max,
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onKeyDown,
  } as const;

  return { width, setWidth, separatorProps };
}
