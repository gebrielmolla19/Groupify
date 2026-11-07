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

  it('marks fetch failures as network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    const err = await fetchWithAuth('/groups').catch((e: unknown) => e);
    expect(isApiError(err)).toBe(true);
    if (!isApiError(err)) return;
    expect(err.isNetworkError).toBe(true);
    expect(err.status).toBe(0);
  });
});
