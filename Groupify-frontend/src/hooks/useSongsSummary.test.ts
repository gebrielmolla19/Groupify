import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSongsSummary } from './useSongsSummary';
import type { SongsSummary, ViewerSummaryRange } from '../types/analytics';

vi.mock('../lib/api', () => ({ getSongsSummary: vi.fn() }));
vi.mock('../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { getSongsSummary } = await import('../lib/api');

function summary(range: ViewerSummaryRange, total = 0): SongsSummary {
  return {
    range,
    sleepingOn: { shares: [], total },
    sleptOn: { shares: [], total: 0, others: 2 },
    records: { fastestFullListen: null, mostLiked: null, longestStreak: null },
  };
}

describe('useSongsSummary', () => {
  beforeEach(() => vi.mocked(getSongsSummary).mockReset());

  it('loads the songs for the group, range and the browser\'s time zone', async () => {
    vi.mocked(getSongsSummary).mockResolvedValue(summary('30d'));

    const { result } = renderHook(() => useSongsSummary('g1', '30d'));

    await waitFor(() => expect(result.current.data?.range).toBe('30d'));
    expect(result.current.isLoading).toBe(false);
    expect(getSongsSummary).toHaveBeenCalledWith('g1', '30d', Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it('keeps the newest range when an older request answers last', async () => {
    let answerOld: (value: SongsSummary) => void = () => {};
    vi.mocked(getSongsSummary)
      .mockImplementationOnce(() => new Promise((resolve) => { answerOld = resolve; }))
      .mockResolvedValueOnce(summary('7d', 3));

    const { result, rerender } = renderHook(({ range }) => useSongsSummary('g1', range), {
      initialProps: { range: '30d' as ViewerSummaryRange },
    });
    rerender({ range: '7d' });
    await waitFor(() => expect(result.current.data?.range).toBe('7d'));

    await act(async () => answerOld(summary('30d')));

    expect(result.current.data?.range).toBe('7d');
  });

  it('reports a failure as an error and loads again on refetch', async () => {
    vi.mocked(getSongsSummary)
      .mockRejectedValueOnce(new Error('Network down'))
      .mockResolvedValueOnce(summary('30d'));

    const { result } = renderHook(() => useSongsSummary('g1', '30d'));
    await waitFor(() => expect(result.current.error).toBe('Network down'));
    expect(result.current.data).toBeNull();

    await act(async () => { await result.current.refetch(); });

    expect(result.current.error).toBeNull();
    expect(result.current.data?.range).toBe('30d');
  });

  it('loads again when a listen is recorded in this group', async () => {
    vi.mocked(getSongsSummary).mockResolvedValue(summary('30d'));
    renderHook(() => useSongsSummary('g1', '30d'));
    await waitFor(() => expect(getSongsSummary).toHaveBeenCalledTimes(1));

    act(() => { window.dispatchEvent(new CustomEvent('trackListened', { detail: { groupId: 'other' } })); });
    act(() => { window.dispatchEvent(new CustomEvent('trackListened', { detail: { groupId: 'g1' } })); });

    await waitFor(() => expect(getSongsSummary).toHaveBeenCalledTimes(2));
  });
});
