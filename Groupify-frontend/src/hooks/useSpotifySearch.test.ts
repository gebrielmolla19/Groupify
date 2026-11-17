import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpotifySearch } from './useSpotifySearch';
import { ApiError, SPOTIFY_REAUTH_REQUIRED } from '../lib/apiError';
import { wasPlaybackErrorNotified } from './useSpotifyPlayer';

vi.mock('../lib/api', () => ({
  searchSpotifyTracks: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../contexts/UserContext', () => ({ useUser: vi.fn() }));

const { searchSpotifyTracks } = await import('../lib/api');
const { toast } = await import('sonner');

const reauthError = () =>
  new ApiError('Your Spotify sign-in has expired. Please sign in with Spotify again.', {
    status: 401,
    code: SPOTIFY_REAUTH_REQUIRED,
  });

// UserContext shows the one "sign in again" message (#86); callers must not add a second.
describe('error toasts when Spotify sign-in has expired', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('search does not show its own toast', async () => {
    vi.mocked(searchSpotifyTracks).mockRejectedValue(reauthError());
    const { result } = renderHook(() => useSpotifySearch());

    await act(() => result.current.search('song'));

    expect(toast.error).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/sign in with Spotify again/);
  });

  it('search still shows other failures', async () => {
    vi.mocked(searchSpotifyTracks).mockRejectedValue(new ApiError('Search failed', { status: 500 }));
    const { result } = renderHook(() => useSpotifySearch());

    await act(() => result.current.search('song'));

    expect(toast.error).toHaveBeenCalledWith('Search failed');
  });

  it('player call sites treat it as already shown', () => {
    expect(wasPlaybackErrorNotified(reauthError())).toBe(true);
    expect(wasPlaybackErrorNotified(new ApiError('Not found', { status: 404 }))).toBe(false);
  });
});
