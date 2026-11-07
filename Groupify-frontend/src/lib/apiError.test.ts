import { describe, it, expect, vi, afterEach } from 'vitest';
import { ApiError, isApiError } from './apiError';
import { fetchWithAuth } from './api';

describe('ApiError', () => {
  it('carries status and statusCode, and is an Error', () => {
    const err = new ApiError('Not found', { status: 404 });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.name).toBe('ApiError');
    expect(err.message).toBe('Not found');
    expect(err.status).toBe(404);
    expect(err.statusCode).toBe(404);
    expect(err.isNetworkError).toBe(false);
  });

  it('defaults status to 0 for network errors', () => {
    const err = new ApiError('offline', { isNetworkError: true });
    expect(err.status).toBe(0);
    expect(err.isNetworkError).toBe(true);
  });

  it('isApiError narrows only ApiError instances', () => {
    expect(isApiError(new ApiError('x'))).toBe(true);
    expect(isApiError(new Error('x'))).toBe(false);
    expect(isApiError({ status: 401 })).toBe(false);
    expect(isApiError(undefined)).toBe(false);
  });
});

describe('fetchWithAuth errors', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws an ApiError with the response status and server message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Group not found' }), { status: 404 })
      )
    );

    const err = await fetchWithAuth('/groups/abc').catch((e: unknown) => e);
    expect(isApiError(err)).toBe(true);
    if (!isApiError(err)) return;
    expect(err.status).toBe(404);
    expect(err.message).toBe('Group not found');
  });

  it('throws an ApiError for a non-expiry 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Invalid token' }), { status: 401 })
      )
    );

    const err = await fetchWithAuth('/users/me').catch((e: unknown) => e);
    expect(isApiError(err) && err.status).toBe(401);
  });

  it('throws an ApiError when the retry after a token refresh fails', async () => {
    localStorage.setItem('groupify_token', 'expired-jwt');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Token expired' }), { status: 401 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, token: 'fresh-jwt' }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 })
      );
    vi.stubGlobal('fetch', fetchMock);

    const err = await fetchWithAuth('/groups/abc').catch((e: unknown) => e);
    localStorage.removeItem('groupify_token');

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/auth/refresh-jwt');
    expect(isApiError(err)).toBe(true);
    if (!isApiError(err)) return;
    expect(err.status).toBe(403);
    expect(err.message).toBe('Forbidden');
  });

  it.each([
    ['Chrome', 'Failed to fetch'],
    ['Safari', 'Load failed'],
    ['Firefox', 'NetworkError when attempting to fetch resource.'],
  ])('marks %s fetch failures as network errors', async (_browser, message) => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError(message)));

    const err = await fetchWithAuth('/groups').catch((e: unknown) => e);
    expect(isApiError(err)).toBe(true);
    if (!isApiError(err)) return;
    expect(err.isNetworkError).toBe(true);
    expect(err.status).toBe(0);
  });

  it('marks a network failure on the post-refresh retry as a network error', async () => {
    localStorage.setItem('groupify_token', 'expired-jwt');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ message: 'Token expired' }), { status: 401 })
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ success: true, token: 'fresh-jwt' }), { status: 200 })
        )
        .mockRejectedValueOnce(new TypeError('Load failed'))
    );

    const err = await fetchWithAuth('/groups').catch((e: unknown) => e);
    localStorage.removeItem('groupify_token');

    expect(isApiError(err) && err.isNetworkError).toBe(true);
  });

  it('does not mark a TypeError raised after fetch resolves as a network error', async () => {
    // A response-like object without json(): handling it throws a TypeError
    // after fetch() has already succeeded, which must not be reported as
    // "unable to reach the server".
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const err = await fetchWithAuth('/groups').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TypeError);
    expect(isApiError(err)).toBe(false);
  });

  it('passes aborts through unchanged', async () => {
    const abort = new DOMException('The operation was aborted.', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort));

    const err = await fetchWithAuth('/groups').catch((e: unknown) => e);
    expect(err).toBe(abort);
    expect(isApiError(err)).toBe(false);
  });
});
