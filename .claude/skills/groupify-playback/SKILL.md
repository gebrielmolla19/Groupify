---
name: groupify-playback
description: Guardrails and test checklist for any change touching Spotify playback in Groupify — the Web Playback SDK store (useSpotifyPlayer), SpotifyPlayerCard, auto-advance, device transfer, seek, or the backend player/Spotify service. Use when changing or debugging playback, devices, play/pause/next/prev/seek, or Spotify auth/scopes.
---

# Working on Spotify playback

## Where things live
- `Groupify-frontend/src/hooks/useSpotifyPlayer.ts`: the singleton SDK
  store (`useSyncExternalStore`). It's the **only** place that talks to
  the SDK `Player`.
- `Groupify-frontend/src/components/features/music/SpotifyPlayerCard.tsx`:
  the player UI. It handles both in-browser playback and remote playback
  (the Spotify app on another device, via `useCurrentPlayback` polling).
- `Groupify-frontend/src/hooks/useAutoPlayNext.ts`: listens for the
  `spotifyTrackComplete` event.
- `Groupify-backend/src/services/spotifyService.js`,
  `src/controllers/playerController.js` and `src/routes/playerRoutes.js`:
  the Spotify Web API calls (play, transfer, devices, next/previous,
  seek).

## Read the docs first
Before changing playback behavior, or concluding "this can't work on X",
check:
- SDK reference: https://developer.spotify.com/documentation/web-playback-sdk/reference
- SDK overview, supported platforms: https://developer.spotify.com/documentation/web-playback-sdk
- Web API player endpoints: https://developer.spotify.com/documentation/web-api (Player section)

Facts this project learned the hard way:
- **Mobile (iOS and Android) is supported.** iOS needs a user gesture.
  `player.activateElement()` must be called **synchronously inside the
  tap, before any `await`**, or audio stays paused after the transfer and
  later requests 404.
- Handle **every** SDK event: `ready`, `not_ready`,
  `player_state_changed`, `initialization_error` (no EME, common in
  in-app browsers), `authentication_error`, `account_error`
  (mobile-only Premium plans are excluded), `playback_error` and
  `autoplay_failed`.
- `getOAuthToken` is called on every `connect()` and when the token
  expires. Always call `cb`, or surface an error.

## Invariants (don't break these)
1. **Never move playback to a device the user didn't choose.** On a
   404, retry only on the **exact** requested device. Don't fall back to
   the active device, `devices[0]`, or another device with the same
   name. (That fallback once sent audio to the user's phone and froze
   the UI.)
2. **Don't transfer playback on page load.** Opening Groupify must not
   pause the user's Spotify app. The first `playTrack()` targets the SDK
   device directly.
3. **On failure, reset the state honestly** (`isPlaying: false`) and show
   **one** toast. Lower layers mark errors they've already shown
   (`wasPlaybackErrorNotified`), and callers check it.
4. Only the store owns polling intervals, and there's one interval no
   matter how many components use the hook.
5. Values no component renders (callbacks, refs) stay out of the
   reactive snapshot.
6. Disconnect the player on logout (the `groupify:logout` event).
7. Polling cadence: about 1 s for the SDK, 3–5 s for remote devices.
   Honor `Retry-After` on 429.

## Tests
- Backend: mock `axios` in `tests/spotifyService.test.js`. Cover the
  success path, 404 (including that **no other device** is used) and
  other statuses.
- Frontend: test pure logic and components (for example
  `PlaybackScrubber.test.tsx`). For SDK behavior, mock the `Player`
  object.

## Manual checklist (needs the user's Spotify Premium login)
Most of this can't be automated. Run what you can, and list the rest in
the PR as **Not verified** for the user:
- [ ] Desktop Chrome: play, next, previous, pause/resume, seek
- [ ] A finished track auto-advances and is marked as listened
- [ ] Opening Groupify while the Spotify app is playing does **not**
      pause it
- [ ] Logging out removes "Groupify Web Player" from Spotify's device
      list
- [ ] Remote mode: with music playing in the Spotify app, the card
      shows it, and play/pause/next/seek control it
- [ ] Phone, Safari and Chrome (needs a tunnel URL added as a Spotify
      redirect URI): tap to play, next/prev, lock and unlock the screen,
      then tap play
- [ ] Opening the app in an in-app browser (for example Instagram) shows
      the "this browser can't play Spotify audio" message instead of
      spinning forever
