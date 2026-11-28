import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSongJourney } from './useSongJourney';
import type { SongsRange, SongsResponse } from '../types/analytics';

vi.mock('../lib/api', () => ({ getSongs: vi.fn() }));
vi.mock('../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { getSongs } = await import('../lib/api');

const answer = (range: SongsRange, viewerId = 'u1'): SongsResponse => ({ range, viewerId, members: [], songs: [] });

describe('useSongJourney', () => {
  beforeEach(() => vi.mocked(getSongs).mockReset());

  it('loads the songs for the group, range and requested share', async () => {
    vi.mocked(getSongs).mockResolvedValue(answer('30d'));

    const { result } = renderHook(() => useSongJourney('g1', '30d', 'sh1'));

    await waitFor(() => expect(result.current.data?.range).toBe('30d'));
    expect(result.current.isLoading).toBe(false);
    expect(getSongs).toHaveBeenCalledWith('g1', '30d', 'sh1');
  });

  it('keeps the newest range when an older request answers last', async () => {
    let answerOld: (value: SongsResponse) => void = () => {};
    vi.mocked(getSongs)
      .mockImplementationOnce(() => new Promise((resolve) => { answerOld = resolve; }))
      .mockResolvedValueOnce(answer('7d', 'newest'));

    const { result, rerender } = renderHook(({ range }) => useSongJourney('g1', range, null), {
      initialProps: { range: '30d' as SongsRange },
    });
    rerender({ range: '7d' });
    await waitFor(() => expect(result.current.data?.viewerId).toBe('newest'));

    answerOld(answer('30d', 'stale'));
    await new Promise((r) => setTimeout(r, 0));

    expect(result.current.data?.viewerId).toBe('newest');
  });

  it('reports a failed load as an error, and loads again on refetch', async () => {
    vi.mocked(getSongs)
      .mockRejectedValueOnce(new Error('Server error'))
      .mockResolvedValueOnce(answer('30d'));

    const { result } = renderHook(() => useSongJourney('g1', '30d', null));

    await waitFor(() => expect(result.current.error).toBe('Server error'));
    expect(result.current.data).toBeNull();

    await act(() => result.current.refetch());

    expect(result.current.error).toBeNull();
    expect(result.current.data?.range).toBe('30d');
  });
});
