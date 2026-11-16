# Several Spotify apps side by side

A Spotify app in development mode only lets five allow-listed users sign
in, and Groupify has more users than that. Until one app is approved for
more, the backend accepts several Spotify apps at once: each user signs
in through one of them (`/login?app=N`) and is tied to it from then on,
because Spotify tokens only work with the app that issued them.

## Consequences

- Exchanging and refreshing a user's tokens must use the credentials of
  that user's app; Spotify rejects another app's.
- Each app needs the same redirect URIs and its own allow-list, kept up
  by hand in the Spotify dashboard.
- Once one app has enough quota for everyone, users of the other apps
  must sign in again to move over; their stored tokens can't be carried
  across.
