/**
 * The Spotify scopes Groupify asks for at sign-in, and the check that a
 * user's stored grant still covers them.
 *
 * Spotify only grants scopes during sign-in; refreshing a token keeps the
 * scopes it was issued with. So when this list grows, existing users must sign
 * in again before the new scopes reach their tokens. TokenManager asks them to
 * (decision record 0003 in adr/).
 */
const SPOTIFY_SCOPES = [
  'user-read-email',
  'user-read-private',
  'user-read-recently-played',
  'user-read-playback-state',
  'user-read-currently-playing',
  'user-modify-playback-state',
  'playlist-modify-private',
  // Collaborative playlists need both playlist-modify scopes, and following
  // a playlist (PUT /me/library, February 2026) lists the next three.
  'playlist-modify-public',
  'user-library-modify',
  'user-follow-modify',
  'playlist-read-private',
  'streaming'
];

/**
 * True when a space-separated scope string (as Spotify returns it in a token
 * response) includes every scope Groupify asks for.
 * @param {string|undefined|null} grantedScopes
 * @returns {boolean}
 */
const hasRequiredScopes = (grantedScopes) => {
  if (!grantedScopes) return false;
  const granted = new Set(grantedScopes.split(/\s+/).filter(Boolean));
  return SPOTIFY_SCOPES.every((scope) => granted.has(scope));
};

module.exports = { SPOTIFY_SCOPES, hasRequiredScopes };
