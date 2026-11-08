import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { GroupsProvider, useGroupsContext } from './GroupsContext';
import { ApiError } from '../lib/apiError';
import type { Group } from '../types';

vi.mock('../lib/api', () => ({
  getUserGroups: vi.fn(),
  createGroup: vi.fn(),
  joinGroupByCode: vi.fn(),
  joinGroup: vi.fn(),
  leaveGroup: vi.fn(),
  getToken: vi.fn(() => 'jwt'),
}));

vi.mock('./UserContext', () => ({
  useUser: () => ({ isAuthenticated: true }),
}));

vi.mock('../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { getUserGroups } = await import('../lib/api');
const { logger } = await import('../utils/logger');

const wrapper = ({ children }: { children: ReactNode }) => (
  <GroupsProvider>{children}</GroupsProvider>
);

async function renderLoaded() {
  const hook = renderHook(() => useGroupsContext(), { wrapper });
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook;
}

describe('GroupsContext fetchGroups errors', () => {
  beforeEach(() => {
    vi.mocked(getUserGroups).mockReset();
    vi.mocked(logger.error).mockClear();
    vi.mocked(logger.debug).mockClear();
    vi.mocked(logger.warn).mockClear();
  });

  it('shows a network error when offline, without logging a failure', async () => {
    vi.mocked(getUserGroups).mockRejectedValue(
      new ApiError('Network error: Unable to reach the server.', { isNetworkError: true })
    );

    const { result } = await renderLoaded();

    expect(result.current.error).toBe('Network error: Unable to reach the server.');
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('keeps already-loaded groups when a refetch fails offline', async () => {
    const groups = [{ _id: 'g1', id: 'g1', name: 'Friday mix' }] as unknown as Group[];
    vi.mocked(getUserGroups).mockResolvedValueOnce(groups);
    const { result } = await renderLoaded();
    expect(result.current.groups).toEqual(groups);

    vi.mocked(getUserGroups).mockRejectedValueOnce(
      new ApiError('Network error: Unable to reach the server.', { isNetworkError: true })
    );
    await act(() => result.current.refetch());

    expect(result.current.groups).toEqual(groups);
    expect(result.current.error).toBe('Network error: Unable to reach the server.');
  });

  it.each([401, 403])('clears groups silently on a %i', async (status) => {
    vi.mocked(getUserGroups).mockRejectedValue(new ApiError('Unauthorized', { status }));

    const { result } = await renderLoaded();

    expect(result.current.groups).toEqual([]);
    expect(result.current.error).toBe(null);
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalled();
  });

  it('surfaces other failures as an error', async () => {
    vi.mocked(getUserGroups).mockRejectedValue(
      new ApiError('Internal server error', { status: 500 })
    );

    const { result } = await renderLoaded();

    expect(result.current.error).toBe('Internal server error');
    expect(logger.error).toHaveBeenCalled();
  });
});
