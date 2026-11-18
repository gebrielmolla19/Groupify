import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../lib/api', () => ({ getCurrentPlayback: vi.fn() }));

// The pause is shared by every poller in the page, so each test gets a fresh copy.
let useCurrentPlayback: typeof import('./useCurrentPlayback').useCurrentPlayback;
let getCurrentPlayback: ReturnType<typeof vi.fn>;
let ApiError: typeof import('../lib/apiError').ApiError;

const rateLimited = (retryAfterMs: number | null) =>
  new ApiError('Spotify rate limit exceeded', { status: 429, retryAfterMs });

/** Advance fake time and let the poll's promise settle. */
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe('useCurrentPlayback and Spotify rate limits (#121)', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    ({ useCurrentPlayback } = await import('./useCurrentPlayback'));
    ({ ApiError } = await import('../lib/apiError'));
    getCurrentPlayback = vi.mocked((await import('../lib/api')).getCurrentPlayback);
    getCurrentPlayback.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stops polling for the wait Spotify asked for, then resumes', async () => {
    getCurrentPlayback.mockRejectedValueOnce(rateLimited(10_000)).mockResolvedValue(null);

    renderHook(() => useCurrentPlayback(true, 3000));
    await advance(0);
    expect(getCurrentPlayback).toHaveBeenCalledTimes(1);

    // Ticks at 3, 6 and 9 s fall inside the 10 s wait.
    await advance(9000);
    expect(getCurrentPlayback).toHaveBeenCalledTimes(1);

    await advance(3000); // 12 s
    expect(getCurrentPlayback).toHaveBeenCalledTimes(2);
  });

  it('pauses every poller in the page, not just the one that hit the limit', async () => {
    getCurrentPlayback.mockRejectedValueOnce(rateLimited(20_000)).mockResolvedValue(null);

    renderHook(() => useCurrentPlayback(true, 3000)); // the player bar
    await advance(0);
    renderHook(() => useCurrentPlayback(true, 10000)); // listen tracking
    await advance(19_000);

    expect(getCurrentPlayback).toHaveBeenCalledTimes(1);
  });

  it('waits 30 s when Spotify gives no wait', async () => {
    getCurrentPlayback.mockRejectedValueOnce(rateLimited(null)).mockResolvedValue(null);

    renderHook(() => useCurrentPlayback(true, 3000));
    await advance(29_000);
    expect(getCurrentPlayback).toHaveBeenCalledTimes(1);

    await advance(3000);
    expect(getCurrentPlayback).toHaveBeenCalledTimes(2);
  });

  it('keeps polling after other errors', async () => {
    getCurrentPlayback.mockRejectedValueOnce(new ApiError('Server error', { status: 500 })).mockResolvedValue(null);

    renderHook(() => useCurrentPlayback(true, 3000));
    await advance(3000);

    expect(getCurrentPlayback).toHaveBeenCalledTimes(2);
  });
});
