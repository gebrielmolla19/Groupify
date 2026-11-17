/**
 * "Spotify sign-in required" errors.
 *
 * Spotify refresh tokens expire six months after the user's original
 * authorisation, and can be revoked earlier. The token endpoint then answers
 * 400 `invalid_grant`, and the only fix is to send the user through Spotify
 * sign-in again (research/spotify.md §7).
 *
 * These errors carry `errorCode`, which errorHandler sends to the client as
 * `code` so the frontend can tell this 401 apart from an expired JWT.
 */

const SPOTIFY_REAUTH_REQUIRED = 'SPOTIFY_REAUTH_REQUIRED';
const SPOTIFY_REAUTH_MESSAGE = 'Your Spotify sign-in has expired. Please sign in with Spotify again.';

const createSpotifyReauthError = () => {
  const error = new Error(SPOTIFY_REAUTH_MESSAGE);
  error.statusCode = 401;
  error.errorCode = SPOTIFY_REAUTH_REQUIRED;
  return error;
};

const isSpotifyReauthError = (error) => error?.errorCode === SPOTIFY_REAUTH_REQUIRED;

module.exports = {
  SPOTIFY_REAUTH_REQUIRED,
  createSpotifyReauthError,
  isSpotifyReauthError
};
