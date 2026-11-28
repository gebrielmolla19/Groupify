import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnalyticsRange, ANALYTICS_RANGE_STORAGE_KEY } from './useAnalyticsRange';

vi.mock('../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { logger } = await import('../utils/logger');

describe('useAnalyticsRange', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(logger.warn).mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it('starts on 30d when nothing is saved', () => {
    const { result } = renderHook(() => useAnalyticsRange());
    expect(result.current[0]).toBe('30d');
  });

  it('starts on the saved range', () => {
    localStorage.setItem(ANALYTICS_RANGE_STORAGE_KEY, '7d');
    const { result } = renderHook(() => useAnalyticsRange());
    expect(result.current[0]).toBe('7d');
  });

  it('ignores a saved value that is no longer a range, such as 24h', () => {
    localStorage.setItem(ANALYTICS_RANGE_STORAGE_KEY, '24h');
    const { result } = renderHook(() => useAnalyticsRange());
    expect(result.current[0]).toBe('30d');
  });

  it('saves the chosen range so the next visit starts on it', () => {
    const { result } = renderHook(() => useAnalyticsRange());
    act(() => result.current[1]('all'));

    expect(result.current[0]).toBe('all');
    expect(localStorage.getItem(ANALYTICS_RANGE_STORAGE_KEY)).toBe('all');
    const { result: next } = renderHook(() => useAnalyticsRange());
    expect(next.current[0]).toBe('all');
  });

  it('falls back to 30d and warns when storage cannot be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useAnalyticsRange());

    expect(result.current[0]).toBe('30d');
    expect(logger.warn).toHaveBeenCalled();
  });

  it('still switches range, and warns, when storage cannot be written', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const { result } = renderHook(() => useAnalyticsRange());
    act(() => result.current[1]('7d'));

    expect(result.current[0]).toBe('7d');
    expect(logger.warn).toHaveBeenCalled();
  });
});
