import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { UserProvider, useUser } from './UserContext';
import { ApiError } from '../lib/apiError';
import type { User } from '../types';

vi.mock('../lib/api', () => ({
  getToken: vi.fn(),
  setToken: vi.fn(),
  getCurrentUser: vi.fn(),
  logout: vi.fn(),
  removeToken: vi.fn(),
}));

vi.mock('../lib/pushNotifications', () => ({
  registerServiceWorker: vi.fn(() => Promise.resolve()),
  requestPermissionAndSubscribe: vi.fn(() => Promise.resolve()),
}));

vi.mock('../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { getToken, getCurrentUser, removeToken } = await import('../lib/api');
const { logger } = await import('../utils/logger');

const user = { _id: 'u1', id: 'u1', displayName: 'Test User' } as unknown as User;
const networkError = () =>
  new ApiError('Network error: Unable to reach the server.', { isNetworkError: true });

const wrapper = ({ children }: { children: ReactNode }) => <UserProvider>{children}</UserProvider>;

async function renderLoaded() {
  const hook = renderHook(() => useUser(), { wrapper });
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook;
}

describe('UserContext startup with a stored token', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getToken).mockReturnValue('jwt');
  });

  it('keeps the token and reports the error when the server is unreachable', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(networkError());

    const { result } = await renderLoaded();

    expect(removeToken).not.toHaveBeenCalled();
    expect(result.current.token).toBe('jwt');
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.authError).toBe('Network error: Unable to reach the server.');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('keeps the token when the server fails with a 500', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(new ApiError('Internal error', { status: 500 }));

    const { result } = await renderLoaded();

    expect(removeToken).not.toHaveBeenCalled();
    expect(result.current.token).toBe('jwt');
    expect(result.current.authError).toEqual(expect.any(String));
  });

  it.each([401, 403])('clears the token when the server rejects it (%i)', async (status) => {
    vi.mocked(getCurrentUser).mockRejectedValue(new ApiError('Invalid token', { status }));

    const { result } = await renderLoaded();

    expect(removeToken).toHaveBeenCalled();
    expect(result.current.token).toBeNull();
    expect(result.current.authError).toBeNull();
  });

  it('signs in on retry once the server is reachable again', async () => {
    vi.mocked(getCurrentUser).mockRejectedValueOnce(networkError()).mockResolvedValueOnce(user);
    const { result } = await renderLoaded();
    expect(result.current.authError).not.toBeNull();

    await act(() => result.current.retryAuth());

    expect(result.current.user).toEqual(user);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.authError).toBeNull();
  });

  it('drops the session on retry if the stored token is gone (logged out in another tab)', async () => {
    vi.mocked(getCurrentUser).mockRejectedValue(networkError());
    const { result } = await renderLoaded();
    expect(result.current.authError).not.toBeNull();

    vi.mocked(getToken).mockReturnValue(null);
    await act(() => result.current.retryAuth());

    expect(result.current.token).toBeNull();
    expect(result.current.authError).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('loads the user normally when the server accepts the token', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user);

    const { result } = await renderLoaded();

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.authError).toBeNull();
    expect(removeToken).not.toHaveBeenCalled();
  });
});
