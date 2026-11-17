# New Spotify scopes are granted by signing in again, all at once

Since February 2026 a development-mode app follows a playlist by saving it
to the user's library (`PUT /me/library`), and that endpoint lists
`user-library-modify`, `user-follow-modify` and `playlist-modify-public`,
none of which Groupify asked for. Spotify only grants scopes at sign-in;
refreshing a token keeps the scopes it was issued with. So Groupify stores
the scopes Spotify granted (`User.spotifyScopes`), and when they don't cover
every scope in `config/spotifyScopes.js`, `TokenManager` answers any Spotify
request with the same "sign in with Spotify again" error used for an
expired refresh token. Every user who signed in before the change signs in
once more; anyone who adds a scope later gets the same behaviour for free.

Rejected: asking only when a call fails with 403. The follow happens for
every member during the owner's export, in the background, where a member
can't be sent to sign in, so those follows would fail silently until each
member happened to hit a 403 themselves. Keeping the old follow endpoint
avoids the sign-in, but Spotify has removed it for development-mode apps
created since 2026-02-11 and will remove it for older ones on a date not
yet announced.

## Consequences

- When this ships, every signed-in user is signed out on their next
  Spotify request and sees "Groupify needs a few more Spotify permissions".
- Users who signed in before scopes were stored have no `spotifyScopes`,
  and are treated as missing scopes.
