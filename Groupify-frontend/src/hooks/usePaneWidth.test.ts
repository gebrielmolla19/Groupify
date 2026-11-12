import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { usePaneWidth } from './usePaneWidth';

const options = { storageKey: 'test-pane', initial: 248, min: 72, max: 340 };

const key = (k: string) => ({ key: k, preventDefault: () => {} }) as unknown as KeyboardEvent<HTMLElement>;
const pointer = (clientX: number) =>
  ({ clientX, pointerId: 1, currentTarget: { setPointerCapture: () => {} } }) as unknown as PointerEvent<HTMLElement>;

describe('usePaneWidth', () => {
  beforeEach(() => localStorage.clear());

  it('starts at the initial width and exposes splitter ARIA', () => {
    const { result } = renderHook(() => usePaneWidth(options));
    expect(result.current.width).toBe(248);
    expect(result.current.separatorProps).toMatchObject({
      role: 'separator',
      'aria-orientation': 'vertical',
      'aria-valuenow': 248,
      'aria-valuemin': 72,
      'aria-valuemax': 340,
    });
  });

  it('resizes by dragging, clamped to min and max', () => {
    const { result } = renderHook(() => usePaneWidth(options));
    act(() => result.current.separatorProps.onPointerDown(pointer(300)));
    act(() => result.current.separatorProps.onPointerMove(pointer(340)));
    expect(result.current.width).toBe(288);
    act(() => result.current.separatorProps.onPointerMove(pointer(900)));
    expect(result.current.width).toBe(340);
    act(() => result.current.separatorProps.onPointerMove(pointer(-900)));
    expect(result.current.width).toBe(72);

    // After the pointer is released, moving it no longer resizes.
    act(() => result.current.separatorProps.onPointerUp());
    act(() => result.current.separatorProps.onPointerMove(pointer(400)));
    expect(result.current.width).toBe(72);
  });

  it('resizes with arrow keys, Home and End', () => {
    const { result } = renderHook(() => usePaneWidth(options));
    act(() => result.current.separatorProps.onKeyDown(key('ArrowLeft')));
    expect(result.current.width).toBe(232);
    act(() => result.current.separatorProps.onKeyDown(key('ArrowRight')));
    act(() => result.current.separatorProps.onKeyDown(key('ArrowRight')));
    expect(result.current.width).toBe(264);
    act(() => result.current.separatorProps.onKeyDown(key('Home')));
    expect(result.current.width).toBe(72);
    act(() => result.current.separatorProps.onKeyDown(key('End')));
    expect(result.current.width).toBe(340);
  });

  it('saves the width and restores it, clamped', () => {
    const first = renderHook(() => usePaneWidth(options));
    act(() => first.result.current.setWidth(120));
    expect(localStorage.getItem('test-pane')).toBe('120');
    expect(renderHook(() => usePaneWidth(options)).result.current.width).toBe(120);

    localStorage.setItem('test-pane', '9999');
    expect(renderHook(() => usePaneWidth(options)).result.current.width).toBe(340);
    localStorage.setItem('test-pane', 'junk');
    expect(renderHook(() => usePaneWidth(options)).result.current.width).toBe(248);
  });
});
