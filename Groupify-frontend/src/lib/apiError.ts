export class ApiError extends Error {
  status: number;
  statusCode: number;
  isNetworkError: boolean;
  /** Machine-readable reason from the server's `code` field, if it sent one. */
  code: string | null;
  /** On a 429: how long Spotify asked us to wait, in ms, if it said. */
  retryAfterMs: number | null;

  constructor(
    message: string,
    opts: { status?: number; isNetworkError?: boolean; code?: string | null; retryAfterMs?: number | null } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = opts.status ?? 0;
    this.statusCode = opts.status ?? 0;
    this.isNetworkError = opts.isNetworkError ?? false;
    this.code = opts.code ?? null;
    this.retryAfterMs = opts.retryAfterMs ?? null;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/**
 * The server's code for "Spotify rejected this user's refresh token": it
 * expired (six months after sign-in) or was revoked. Only signing in with
 * Spotify again fixes it.
 */
export const SPOTIFY_REAUTH_REQUIRED = 'SPOTIFY_REAUTH_REQUIRED';

/**
 * Window event fired by the API client when the server answers with
 * SPOTIFY_REAUTH_REQUIRED. UserContext listens and signs the user out.
 * `detail.message` is the server's message.
 */
export const SPOTIFY_REAUTH_EVENT = 'groupify:spotify-reauth-required';

export function isSpotifyReauthError(e: unknown): boolean {
  return isApiError(e) && e.code === SPOTIFY_REAUTH_REQUIRED;
}
