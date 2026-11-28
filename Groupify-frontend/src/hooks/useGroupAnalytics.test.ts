import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useGroupAnalytics } from './useGroupAnalytics';
import type { AnalyticsRange } from '../types/analytics';

vi.mock('../lib/api', () => ({ getGroupActivity: vi.fn(), getSuperlatives: vi.fn() }));
vi.mock('../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { getGroupActivity, getSuperlatives } = await import('../lib/api');

type Points = { timestamp: string; shares: number }[];
const point = (label: string): Points => [{ timestamp: label, shares: 1 }];
const fame = (name: string) => ({ dj: { user: { displayName: name }, value: 1 } });

describe('useGroupAnalytics', () => {
  beforeEach(() => {
    vi.mocked(getGroupActivity).mockReset();
    vi.mocked(getSuperlatives).mockReset();
  });

  it('loads activity and Hall of Fame for the given range', async () => {
    vi.mocked(getGroupActivity).mockResolvedValue(point('a'));
    vi.mocked(getSuperlatives).mockResolvedValue(fame('Sample'));

    const { result } = renderHook(() => useGroupAnalytics('g1', '7d'));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(getGroupActivity).toHaveBeenCalledWith('g1', '7d', 'shares');
    expect(getSuperlatives).toHaveBeenCalledWith('g1', '7d');
    expect(result.current.activity).toEqual(point('a'));
    expect(result.current.superlatives).toEqual(fame('Sample'));
  });

  it('reloads both for a new range, keeping the old numbers meanwhile', async () => {
    vi.mocked(getGroupActivity).mockResolvedValueOnce(point('30d'));
    vi.mocked(getSuperlatives).mockResolvedValueOnce(fame('Thirty'));
    const { result, rerender } = renderHook(({ range }) => useGroupAnalytics('g1', range), {
      initialProps: { range: '30d' as AnalyticsRange },
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let answer: (value: Points) => void = () => {};
    vi.mocked(getGroupActivity).mockImplementationOnce(() => new Promise((resolve) => { answer = resolve; }));
    vi.mocked(getSuperlatives).mockResolvedValueOnce(fame('All'));
    rerender({ range: 'all' });

    await waitFor(() => expect(result.current.isActivityLoading).toBe(true));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.activity).toEqual(point('30d'));
    expect(getSuperlatives).toHaveBeenLastCalledWith('g1', 'all');

    await act(async () => answer(point('all')));
    expect(result.current.activity).toEqual(point('all'));
    expect(result.current.superlatives).toEqual(fame('All'));
  });

  it('keeps the newest range when an older request answers last', async () => {
    let answerOld: (value: Points) => void = () => {};
    vi.mocked(getGroupActivity)
      .mockImplementationOnce(() => new Promise((resolve) => { answerOld = resolve; }))
      .mockResolvedValueOnce(point('newest'));
    vi.mocked(getSuperlatives).mockResolvedValue(fame('Sample'));

    const { result, rerender } = renderHook(({ range }) => useGroupAnalytics('g1', range), {
      initialProps: { range: '30d' as AnalyticsRange },
    });
    rerender({ range: '7d' });
    await waitFor(() => expect(result.current.activity).toEqual(point('newest')));

    await act(async () => answerOld(point('old')));
    expect(result.current.activity).toEqual(point('newest'));
  });

  it('reloads activity in the chosen mode for the same range', async () => {
    vi.mocked(getGroupActivity).mockResolvedValue(point('a'));
    vi.mocked(getSuperlatives).mockResolvedValue(fame('Sample'));
    const { result } = renderHook(() => useGroupAnalytics('g1', '30d'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.changeActivityMode('engagement'));

    await waitFor(() => expect(getGroupActivity).toHaveBeenLastCalledWith('g1', '30d', 'engagement'));
    expect(result.current.activityMode).toBe('engagement');
    expect(getSuperlatives).toHaveBeenCalledTimes(1);
  });

  it('reports a failed load as an error', async () => {
    vi.mocked(getGroupActivity).mockRejectedValue(new Error('Server down'));
    vi.mocked(getSuperlatives).mockResolvedValue(fame('Sample'));

    const { result } = renderHook(() => useGroupAnalytics('g1', '30d'));

    await waitFor(() => expect(result.current.error).toBe('Server down'));
    expect(result.current.isLoading).toBe(false);
  });
});
