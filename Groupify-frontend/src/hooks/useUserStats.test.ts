import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useUserStats } from './useUserStats';

vi.mock('../lib/api', () => ({
  getUserStats: vi.fn()
}));

const { getUserStats } = await import('../lib/api');

describe('useUserStats', () => {
  beforeEach(() => {
    vi.mocked(getUserStats).mockReset();
  });

  it('returns loading then stats when fetch succeeds', async () => {
    const mockStats = {
      tracksShared: 10,
      groupsJoined: 2,
      totalListens: 5
    };
    vi.mocked(getUserStats).mockResolvedValue(mockStats);

    const { result } = renderHook(() => useUserStats());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.stats).toBe(null);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.stats).toEqual(mockStats);
    expect(result.current.error).toBe(null);
  });

  it('sets error when fetch fails', async () => {
    vi.mocked(getUserStats).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useUserStats());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.stats).toBe(null);
  });
});
