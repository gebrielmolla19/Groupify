import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useBetweenYou } from './useBetweenYou';
import type { BetweenYou, ViewerSummaryRange } from '../types/analytics';

vi.mock('../lib/api', () => ({ getBetweenYou: vi.fn() }));
vi.mock('../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { getBetweenYou } = await import('../lib/api');

function between(range: ViewerSummaryRange, member = 'ana'): BetweenYou {
  return {
    range,
    members: [{ userId: member, displayName: 'Sample Member', profileImage: null }],
    pair: {
      member,
      theirShares: 3,
      youLiked: 1,
      yourShares: 3,
      theyLiked: 1,
      verdict: { id: 'common_ground' },
      previousVerdict: null,
    },
    biggestFan: null,
    tastemaker: null,
  };
}

describe('useBetweenYou', () => {
  beforeEach(() => vi.mocked(getBetweenYou).mockReset());

  it('loads the group, range and picked member', async () => {
    vi.mocked(getBetweenYou).mockResolvedValue(between('7d', 'bo'));

    const { result } = renderHook(() => useBetweenYou('g1', '7d', 'bo'));

    await waitFor(() => expect(result.current.data?.pair?.member).toBe('bo'));
    expect(result.current.isLoading).toBe(false);
    expect(getBetweenYou).toHaveBeenCalledWith('g1', '7d', 'bo');
  });

  it('keeps the newest answer when an older request answers last', async () => {
    let answerOld: (value: BetweenYou) => void = () => {};
    vi.mocked(getBetweenYou)
      .mockImplementationOnce(() => new Promise((resolve) => { answerOld = resolve; }))
      .mockResolvedValueOnce(between('30d', 'bo'));

    const { result, rerender } = renderHook(({ member }) => useBetweenYou('g1', '30d', member), {
      initialProps: { member: 'ana' as string | undefined },
    });
    rerender({ member: 'bo' });
    await waitFor(() => expect(result.current.data?.pair?.member).toBe('bo'));

    answerOld(between('30d', 'ana'));
    await new Promise((r) => setTimeout(r, 0));

    expect(result.current.data?.pair?.member).toBe('bo');
  });

  it('reports the HTTP status of a failed load', async () => {
    const { ApiError } = await import('../lib/apiError');
    vi.mocked(getBetweenYou).mockRejectedValueOnce(new ApiError('Bad member', { status: 400 }));

    const { result } = renderHook(() => useBetweenYou('g1', '30d', 'gone'));

    await waitFor(() => expect(result.current.errorStatus).toBe(400));
  });

  it('reports a failed load as an error, and loads again on refetch', async () => {
    vi.mocked(getBetweenYou)
      .mockRejectedValueOnce(new Error('Server error'))
      .mockResolvedValueOnce(between('30d'));

    const { result } = renderHook(() => useBetweenYou('g1', '30d', undefined));

    await waitFor(() => expect(result.current.error).toBe('Server error'));
    expect(result.current.data).toBeNull();
    expect(result.current.errorStatus).toBe(0);

    await act(() => result.current.refetch());

    expect(result.current.error).toBeNull();
    expect(result.current.data?.range).toBe('30d');
  });
});
