import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { usePlaylist } from './usePlaylist';
import type { Share } from '../types';

vi.mock('../lib/api', () => ({ getGroupFeed: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

const { getGroupFeed } = await import('../lib/api');

const share = { _id: 'sh1', trackName: 'Sample Track', listenCount: 0, createdAt: '2026-01-01T00:00:00.000Z', durationMs: 60_000, artistName: 'Sample Artist' } as Share;

describe('usePlaylist', () => {
  beforeEach(() => vi.mocked(getGroupFeed).mockReset());

  it('refetch loads the playlist again after a failed load', async () => {
    vi.mocked(getGroupFeed)
      .mockRejectedValueOnce(new Error('Server error'))
      .mockResolvedValueOnce({ shares: [share], total: 1, limit: 100, offset: 0 });

    const { result } = renderHook(() => usePlaylist('g1'));
    await waitFor(() => expect(result.current.error).toBe('Server error'));

    act(() => result.current.refetch());

    await waitFor(() => expect(result.current.shares).toEqual([share]));
    expect(result.current.error).toBe(null);
    expect(result.current.isLoading).toBe(false);
    expect(getGroupFeed).toHaveBeenCalledTimes(2);
  });
});
