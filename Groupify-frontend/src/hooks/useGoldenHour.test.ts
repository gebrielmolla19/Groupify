import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useGoldenHour } from './useGoldenHour';
import type { GoldenHour, GoldenHourRange } from '../types/analytics';

vi.mock('../lib/api', () => ({ getGoldenHour: vi.fn() }));
vi.mock('../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { getGoldenHour } = await import('../lib/api');

const empty = () => Array.from({ length: 7 }, () => new Array(6).fill(0));

function goldenHour(range: GoldenHourRange, current = 0): GoldenHour {
  return {
    range,
    buckets: [],
    shares: empty(),
    listens: empty(),
    totals: { shares: 0, listens: 0 },
    streak: { current, longest: current, record: current },
  };
}

describe('useGoldenHour', () => {
  beforeEach(() => vi.mocked(getGoldenHour).mockReset());

  it('loads for the group, range and the browser\'s time zone', async () => {
    vi.mocked(getGoldenHour).mockResolvedValue(goldenHour('30d'));

    const { result } = renderHook(() => useGoldenHour('g1', '30d'));

    await waitFor(() => expect(result.current.data?.range).toBe('30d'));
    expect(result.current.isLoading).toBe(false);
    expect(getGoldenHour).toHaveBeenCalledWith('g1', '30d', Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it('keeps the newest range when an older request answers last', async () => {
    let answerOld: (value: GoldenHour) => void = () => {};
    vi.mocked(getGoldenHour)
      .mockImplementationOnce(() => new Promise((resolve) => { answerOld = resolve; }))
      .mockResolvedValueOnce(goldenHour('7d', 2));

    const { result, rerender } = renderHook(({ range }) => useGoldenHour('g1', range), {
      initialProps: { range: '30d' as GoldenHourRange },
    });
    rerender({ range: '7d' });
    await waitFor(() => expect(result.current.data?.range).toBe('7d'));

    answerOld(goldenHour('30d', 9));
    await new Promise((r) => setTimeout(r, 0));

    expect(result.current.data?.range).toBe('7d');
    expect(result.current.data?.streak.current).toBe(2);
  });

  it('reports a failed load as an error, and loads again on refetch', async () => {
    vi.mocked(getGoldenHour)
      .mockRejectedValueOnce(new Error('Server error'))
      .mockResolvedValueOnce(goldenHour('30d'));

    const { result } = renderHook(() => useGoldenHour('g1', '30d'));

    await waitFor(() => expect(result.current.error).toBe('Server error'));
    expect(result.current.data).toBeNull();

    await act(() => result.current.refetch());

    expect(result.current.error).toBeNull();
    expect(result.current.data?.range).toBe('30d');
  });
});
