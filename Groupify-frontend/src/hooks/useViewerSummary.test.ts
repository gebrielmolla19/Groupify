import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useViewerSummary } from './useViewerSummary';
import type { ViewerSummary, ViewerSummaryRange } from '../types/analytics';

vi.mock('../lib/api', () => ({ getViewerSummary: vi.fn() }));
vi.mock('../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { getViewerSummary } = await import('../lib/api');

function summary(range: ViewerSummaryRange, title = 'Tastemaker'): ViewerSummary {
  return {
    range,
    role: { id: 'tastemaker', title, reason: 'Sample reason.' },
    previousRole: null,
    hitRate: { hits: 1, total: 2 },
    streak: { longest: 1, record: 2 },
    bestShare: null,
    discovery: { artists: 0, resharedByOthers: 0 },
    reflex: { youPlayMs: null, groupPlayMs: null, yoursPlayedMs: null, groupYoursPlayedMs: null },
  };
}

describe('useViewerSummary', () => {
  beforeEach(() => vi.mocked(getViewerSummary).mockReset());

  it('loads the summary for the group, range and the browser\'s time zone', async () => {
    vi.mocked(getViewerSummary).mockResolvedValue(summary('30d'));

    const { result } = renderHook(() => useViewerSummary('g1', '30d'));

    await waitFor(() => expect(result.current.data?.range).toBe('30d'));
    expect(result.current.isLoading).toBe(false);
    expect(getViewerSummary).toHaveBeenCalledWith('g1', '30d', Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it('keeps the newest range when an older request answers last', async () => {
    let answerOld: (value: ViewerSummary) => void = () => {};
    vi.mocked(getViewerSummary)
      .mockImplementationOnce(() => new Promise((resolve) => { answerOld = resolve; }))
      .mockResolvedValueOnce(summary('7d', 'Newest'));

    const { result, rerender } = renderHook(({ range }) => useViewerSummary('g1', range), {
      initialProps: { range: '30d' as ViewerSummaryRange },
    });
    rerender({ range: '7d' });
    await waitFor(() => expect(result.current.data?.role.title).toBe('Newest'));

    answerOld(summary('30d', 'Stale'));
    await new Promise((r) => setTimeout(r, 0));

    expect(result.current.data?.role.title).toBe('Newest');
  });

  it('reports a failed load as an error, and loads again on refetch', async () => {
    vi.mocked(getViewerSummary)
      .mockRejectedValueOnce(new Error('Server error'))
      .mockResolvedValueOnce(summary('30d'));

    const { result } = renderHook(() => useViewerSummary('g1', '30d'));

    await waitFor(() => expect(result.current.error).toBe('Server error'));
    expect(result.current.data).toBeNull();
    expect(result.current.isLoading).toBe(false);

    await act(() => result.current.refetch());

    expect(result.current.error).toBeNull();
    expect(result.current.data?.range).toBe('30d');
  });
});
