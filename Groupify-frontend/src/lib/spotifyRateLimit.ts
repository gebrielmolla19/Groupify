/**
 * Spotify rate-limits the whole Groupify app, not one user, so after a 429
 * every poller in the page (the player bar, listen tracking) waits until the
 * same time (#121). It's deliberately kept across sign-out: signing in again
 * doesn't lift Spotify's limit.
 */

/** How long to wait after a 429 that didn't say how long. */
export const DEFAULT_RATE_LIMIT_WAIT_MS = 30_000;

let pausedUntil = 0;

/** Stop Spotify polling for `waitMs` (or the default). Never shortens a longer pause. */
export function pauseSpotifyPolling(waitMs: number | null): void {
  pausedUntil = Math.max(pausedUntil, Date.now() + (waitMs ?? DEFAULT_RATE_LIMIT_WAIT_MS));
}

/** True while Spotify asked us to wait. */
export function isSpotifyPollingPaused(): boolean {
  return Date.now() < pausedUntil;
}
