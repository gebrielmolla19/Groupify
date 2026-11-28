import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useListenerReflex, type ListenerReflexMode } from './useListenerReflex';
import type { ListenerReflexData } from '../types';

vi.mock('../lib/api', () => ({ getListenerReflex: vi.fn() }));
vi.mock('../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { getListenerReflex } = await import('../lib/api');

function reflex(mode: ListenerReflexMode): ListenerReflexData {
  return {
    groupId: 'g1',
    range: '30d',
    mode,
    generatedAt: '2026-11-20T12:00:00Z',
    buckets: { instant: [], quick: [], slow: [], longTail: [] },
    users: [],
    ringData: [],
    summary: { groupMedianMs: 0, instantReactorCount: 0, totalSharesInRange: 0 },
  };
}

describe('useListenerReflex', () => {
  beforeEach(() => vi.mocked(getListenerReflex).mockReset());

  it('loads the group\'s reflex for the range and mode', async () => {
    vi.mocked(getListenerReflex).mockResolvedValue(reflex('shared'));

    const { result } = renderHook(() => useListenerReflex('g1', '7d', 'shared'));

    await waitFor(() => expect(result.current.data?.mode).toBe('shared'));
    expect(result.current.isLoading).toBe(false);
    expect(getListenerReflex).toHaveBeenCalledWith('g1', '7d', 'shared');
  });

  it('keeps the newest mode when an older request answers last', async () => {
    let answerOld: (value: ListenerReflexData) => void = () => {};
    vi.mocked(getListenerReflex)
      .mockImplementationOnce(() => new Promise((resolve) => { answerOld = resolve; }))
      .mockResolvedValueOnce(reflex('shared'));

    const { result, rerender } = renderHook(({ mode }) => useListenerReflex('g1', '30d', mode), {
      initialProps: { mode: 'received' as ListenerReflexMode },
    });
    rerender({ mode: 'shared' });
    await waitFor(() => expect(result.current.data?.mode).toBe('shared'));

    answerOld(reflex('received'));
    await new Promise((r) => setTimeout(r, 0));

    expect(result.current.data?.mode).toBe('shared');
  });

  it('reports a failed load as an error, and loads again on refetch', async () => {
    vi.mocked(getListenerReflex)
      .mockRejectedValueOnce(new Error('Server error'))
      .mockResolvedValueOnce(reflex('received'));

    const { result } = renderHook(() => useListenerReflex('g1', '30d', 'received'));
    await waitFor(() => expect(result.current.error).toBe('Server error'));
    expect(result.current.data).toBeNull();

    await act(() => result.current.refetch());

    expect(result.current.error).toBeNull();
    expect(result.current.data?.mode).toBe('received');
  });
});
