# Spotify platform facts Groupify depends on

Read date for everything below: **2026-11-15**.

## How to read this file (important)

This file was written in two passes on 2026-11-15.

**First pass.** `developer.spotify.com` was not reachable, so facts were
gathered from search-index excerpts of the named pages and tagged:

- **[S]** = taken from a search excerpt of the named
  developer.spotify.com page, relayed through a summariser. Quotes
  marked "relayed" are the wording the tool attributed to the page.
- **[D]** = read directly from a Spotify-owned source
  (`raw.githubusercontent.com/spotify/spotify-web-api-ts-sdk`).

**Second pass.** The host was then allowed and these pages were read
directly. Every [S] claim that rests on them was confirmed against the
live text, so treat it as verified:

- Quota modes (section 4): five users, owner needs Premium, quota per
  developer account, `QUOTA_EXCEEDED`, extended quota criteria.
- Blog posts of 2026-02-06 (including its 9 March note postponing the
  endpoint changes for existing integrations), 2026-06-18 (refresh
  token expiry) and 2026-07-23 (25 Client IDs, shared quota).
- February 2026 changelog and migration guide (section 4a): the removed
  and replacement endpoints, the search limit, the removed user fields.
- March 2026 changelog: only reverts `external_ids`; it sets no new date
  for existing apps.
- Rate limits: rolling 30-second window, 429 with `Retry-After`.
- Web Playback SDK overview: Premium required (mobile-only plans
  excluded); desktop and mobile browsers supported.
- Create Playlist reference: a collaborative playlist must be
  non-public and needs both `playlist-modify-private` and
  `playlist-modify-public`.
- Recently played reference: items carry `track`, `played_at` and
  `context`; nothing reports how much of a track was played.

[S] claims outside that list (mainly the SDK reference details in
section 1 and the per-endpoint notes in section 2) have not been re-read
on the live page. Check them there before relying on the wording.

Anything not confirmable is under "Unverified / could not confirm",
never in the fact sections.

Nothing in the fact sections comes from memory.

Source pages (all developer.spotify.com unless noted):

[sdk]: https://developer.spotify.com/documentation/web-playback-sdk
[sdk-ref]: https://developer.spotify.com/documentation/web-playback-sdk/reference
[sdk-start]: https://developer.spotify.com/documentation/web-playback-sdk/tutorials/getting-started
[sdk-howto]: https://developer.spotify.com/documentation/web-playback-sdk/howtos/web-app-player
[sdk-ga]: https://developer.spotify.com/blog/2021-09-13-web-playback-sdk-out-of-beta
[scopes]: https://developer.spotify.com/documentation/web-api/concepts/scopes
[api-calls]: https://developer.spotify.com/documentation/web-api/concepts/api-calls
[rate]: https://developer.spotify.com/documentation/web-api/concepts/rate-limits
[quota]: https://developer.spotify.com/documentation/web-api/concepts/quota-modes
[playlists]: https://developer.spotify.com/documentation/web-api/concepts/playlists
[ai-tut]: https://developer.spotify.com/documentation/web-api/tutorials/building-with-ai
[play]: https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback
[pause]: https://developer.spotify.com/documentation/web-api/reference/pause-a-users-playback
[transfer]: https://developer.spotify.com/documentation/web-api/reference/transfer-a-users-playback
[state]: https://developer.spotify.com/documentation/web-api/reference/get-information-about-the-users-current-playback
[devices]: https://developer.spotify.com/documentation/web-api/reference/get-a-users-available-devices
[recent]: https://developer.spotify.com/documentation/web-api/reference/get-recently-played
[recent-2017]: https://developer.spotify.com/community/news/2017/03/01/new-endpoint-recently-played-tracks/
[create-pl]: https://developer.spotify.com/documentation/web-api/reference/create-playlist
[change-pl]: https://developer.spotify.com/documentation/web-api/reference/change-playlist-details
[pl-items]: https://developer.spotify.com/documentation/web-api/reference/get-playlists-items
[add-items]: https://developer.spotify.com/documentation/web-api/reference/add-items-to-playlist
[replace-items]: https://developer.spotify.com/documentation/web-api/reference/reorder-or-replace-playlists-items
[save-library]: https://developer.spotify.com/documentation/web-api/reference/save-library-items
[unfollow]: https://developer.spotify.com/documentation/web-api/reference/unfollow-playlist
[collab-2015]: https://developer.spotify.com/community/news/2015/05/26/last-month-news/
[refresh]: https://developer.spotify.com/documentation/web-api/tutorials/refreshing-tokens
[code-flow]: https://developer.spotify.com/documentation/web-api/tutorials/code-flow
[blog-refresh]: https://developer.spotify.com/blog/2026-06-18-refresh-token-expiration
[blog-feb26]: https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security
[mig-feb26]: https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide
[chg-feb26]: https://developer.spotify.com/documentation/web-api/references/changes/february-2026
[chg-mar26]: https://developer.spotify.com/documentation/web-api/references/changes/march-2026
[blog-jul26]: https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates
[chg-jul26]: https://developer.spotify.com/documentation/web-api/references/changes/july-2026
[blog-apr25]: https://developer.spotify.com/blog/2025-04-15-updating-the-criteria-for-web-api-extended-access
[blog-nov24]: https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api
[blog-2021]: https://developer.spotify.com/blog/2021-05-27-improving-the-developer-and-user-experience-for-third-party-apps
[terms]: https://developer.spotify.com/terms
[ts-sdk]: https://raw.githubusercontent.com/spotify/spotify-web-api-ts-sdk/main/src/types.ts

---

## 1. Web Playback SDK

Platforms and account
- [S] Supported in Chrome, Firefox, Safari and Edge, on mobile (Android
  and iOS) and desktop (macOS, Windows, Linux). Relayed: "supported by
  most web browsers". ([overview][sdk])
- [S] Premium required; relayed quote: "The Web Playback SDK requires a
  Spotify Premium subscription (mobile only types of premium
  subscriptions are excluded)." ([overview][sdk])
- [S] iOS: playback does not start automatically after a transfer; the
  user must interact. Mobile browsers' autoplay rules can block playback
  handed off from another app. ([overview][sdk], [how-to][sdk-howto])

Scopes
- [S] `streaming` is the SDK's scope; the user must have Premium.
  ([scopes])
- [S] The how-to lists `streaming`, `user-read-email` and
  `user-read-private` as the permissions the SDK needs.
  ([how-to][sdk-howto])

`activateElement()`
- [S] Purpose: mobile autoplay. A transfer started from Spotify's
  servers looks like autoplay to the browser and is blocked. Relayed:
  "The activateElement() function needs to be called in advance to keep
  the playing state during transfer. Otherwise it will be in pause state
  once it's transferred." ([reference][sdk-ref])
- [S] The reference suggests calling it from a user-initiated click
  handler, e.g. a button. ([reference][sdk-ref], [GA post][sdk-ga])

`getOAuthToken`
- [S] Required constructor parameter; a callback that must supply a
  valid access token for a Premium user. Relayed: called "every time you
  run Spotify.Player#connect or when a user's access token has expired
  (maximum of 60 minutes)". ([reference][sdk-ref])

Events ([reference][sdk-ref], all [S])
- `ready`: player connected and able to stream; handler gets
  `device_id`.
- `not_ready`: player can't play, typically lost internet connection;
  handler gets `device_id`.
- `player_state_changed`: local playback state changed (e.g. track
  change); may also fire at irregular intervals.
- `autoplay_failed`: browser blocked playback as autoplay; the
  reference points to `activateElement`.

Error events ([reference][sdk-ref], all [S]; each handler gets an object
with `message`)
- `initialization_error`: relayed, "most likely due to the browser not
  supporting EME protection".
- `authentication_error`: relayed, "Emitted when the Spotify.Player
  fails to instantiate a valid Spotify connection from the access token
  provided to getOAuthToken."
- `account_error`: relayed, "Emitted when the user authenticated does
  not have a valid Spotify Premium subscription."
- `playback_error`: emitted when loading and/or playing a track fails.

## 2. Web API player endpoints

All [S]. Paths confirmed as still available to development-mode apps in
the [February 2026 changelog][chg-feb26].

| Call | Method + path | Scope ([scopes]) |
|---|---|---|
| Start/resume | `PUT /me/player/play` | `user-modify-playback-state` |
| Pause | `PUT /me/player/pause` | `user-modify-playback-state` |
| Transfer | `PUT /me/player` | `user-modify-playback-state` |
| Next / previous | `POST /me/player/next`, `/previous` | `user-modify-playback-state` |
| Seek | `PUT /me/player/seek` | `user-modify-playback-state` |
| Devices | `GET /me/player/devices` | `user-read-playback-state` |
| Playback state | `GET /me/player` | `user-read-playback-state` |

- Start/resume and transfer "only work for users who have Spotify
  Premium" (relayed). ([play], [transfer])
- `device_id` is optional on play and pause: "If not supplied, the
  user's currently active device is the target" (relayed). ([play],
  [pause])
- Transfer takes `device_ids` (array) and `play` (bool). Only one device
  id is supported; more than one returns **400**. ([transfer])
- Device objects have `is_active` and `is_restricted`; when
  `is_restricted` is true, "no Web API commands will be accepted by this
  device" (relayed). ([state], [devices])
- Generic status meanings: **204** success with no body, **401** missing
  or refused authentication, **403** request refused, **429** rate or
  quota limit. Some endpoints return only a status code. ([api-calls])
- [D] Spotify's own TypeScript SDK types: `PlaybackState` = `device`,
  `repeat_state`, `shuffle_state`, `context`, `timestamp`,
  `progress_ms`, `is_playing`, `item`, `currently_playing_type`,
  `actions`; `Device` = `id` (nullable), `is_active`,
  `is_private_session`, `is_restricted`, `name`, `type`,
  `volume_percent` (nullable). ([ts-sdk]; the SDK repo may lag the API.)
- Per-endpoint meaning of 404 / 403 on player calls, and anything on
  "no active device": **not found, see Unverified**.

## 3. Rate limits and quota

- [S] Relayed: rate limit is "based on the number of calls that your app
  makes to Spotify in a rolling 30 second window". ([rate])
- [S] Over the limit returns **429**. Relayed: "The header of the 429
  response will normally include a Retry-After header with a value in
  seconds. Consider waiting for the number of seconds specified in
  Retry-After before your app calls the Web API again." ([rate])
- [S] Extended-quota apps have a much higher rate limit than
  development-mode apps. Some endpoints have their own limits (e.g.
  playlist image upload). ([rate])
- [S] Guidance: build a backoff-retry strategy; use batch endpoints
  where they exist. ([rate]) Also: exponential backoff, respect
  `Retry-After`, never retry immediately or in tight loops. ([ai-tut])
- [S] Development-mode **quota** is a separate mechanism from rate
  limits. A quota 429 has a JSON body with
  `"reason": "QUOTA_EXCEEDED"` (status 429, message "Too many
  requests"). Quota is per endpoint bucket; buckets and limits may
  change. ([July 2026 post][blog-jul26], [July 2026 changelog][chg-jul26])
- [S] Since July 2026 development-mode quota is counted **per developer
  account**, shared across all that account's development-mode Client
  IDs. ([July 2026 post][blog-jul26])
- No documented polling interval was found (see Unverified).

## 4. Development mode vs extended quota mode

Current development-mode rules (all [S])
- "Up to 5 authenticated Spotify users can use an app that is in
  development mode"; each user must be added to the app's allowlist
  first (relayed). ([quota])
- The app owner must have Spotify Premium; if it lapses the app stops
  working. ([quota], [Feb 2026 post][blog-feb26])
- Client IDs per developer account: 1 from Feb 2026, raised to **25** in
  July 2026. ([Feb 2026 post][blog-feb26], [July 2026 changelog][chg-jul26])
  Apps that already had more Client IDs or users keep them (section 4,
  policy timeline).
- Development mode is for learning and personal, non-commercial
  projects; not to be used as the foundation for a business.
  ([Feb 2026 post][blog-feb26])
- Reduced endpoint set and removed fields for development-mode apps: see
  section 4a.

Extended quota mode (all [S])
- Unlimited users; the allowlist no longer applies. ([quota])
- Requirements listed: legally registered business entity, active
  launched service, at least 250k monthly active users, availability in
  key Spotify markets, commercial viability, adherence to terms.
  ([quota])
- Since 15 May 2025 applications are accepted from organisations only,
  via company email; request through the app's Developer Dashboard page
  ("Request Extension"). ([quota], [April 2025 post][blog-apr25])
- Relayed: extended access is "reserved for apps with established,
  scalable, and impactful use cases". Apps granted before the change
  keep it. ([April 2025 post][blog-apr25])
- Extra quota may only be used for the reviewed use case. ([terms])

Timeline of policy changes (all [S])
- 2021-05-27: quota modes introduced; cap was then 25 users.
  ([2021 post][blog-2021]) Superseded.
- 2024-11-27: Audio Features, Audio Analysis, Recommendations, Related
  Artists, featured/category playlists and others closed to new apps and
  to development-mode apps without a pending extension request.
  ([Nov 2024 post][blog-nov24])
- 2025-04-15 / 2025-05-15: extended access criteria tightened (above).
- 2026-02-06 post: from 2026-02-11 new development-mode Client IDs get
  Premium-owner requirement, one Client ID per developer, five users,
  reduced endpoints. Existing apps were to follow on 2026-03-09.
  ([Feb 2026 post][blog-feb26], [migration guide][mig-feb26])
- 2026-03-09 update: **endpoint access changes postponed for existing
  integrations**; Premium requirement, five-user cap and Client ID limit
  still applied on schedule. Revised timeline "to be shared later".
  ([Feb 2026 post][blog-feb26])
- Existing apps are grandfathered on the limits: "If you already have
  multiple Client IDs or more than 5 users, you will retain them. These
  limits only restrict what you can create or add going forward."
  ([migration guide][mig-feb26])
- 2026-06-18: refresh tokens expire after six months (section 7).
- 2026-07-23: Client ID limit 1 to 25; quota per developer account;
  `QUOTA_EXCEEDED` body. ([July 2026 post][blog-jul26])

### 4a. February 2026 development-mode API changes

All [S] from the [changelog][chg-feb26] and [migration guide][mig-feb26].
Extended-quota apps are not affected. Whether these already apply to a
development-mode app created before 2026-02-11 is unverified (postponed,
see above).

Endpoints Groupify calls today:

| Old | Status | Replacement |
|---|---|---|
| `POST /users/{user_id}/playlists` | removed | `POST /me/playlists` |
| `POST/GET/PUT/DELETE /playlists/{id}/tracks` | removed | `/playlists/{id}/items` (response field `tracks` renamed `items`) |
| `PUT /playlists/{id}/followers` (follow) | removed | `PUT /me/library` (takes Spotify URIs) |
| `DELETE /playlists/{id}/followers` (unfollow) | removed | `DELETE /me/library` |
| `GET /tracks` (several tracks) | removed | `GET /tracks/{id}` per track |
| `GET /search` | changed | `limit` max 50 to **10**, default 20 to **5** |
| `GET /audio-features` | deprecated / closed since Nov 2024 ([Nov 2024 post][blog-nov24]) | none |

- User object from `GET /me` loses `country`, `email`,
  `explicit_content`, `followers`, `product`. ([migration guide][mig-feb26])
- Track/album/artist objects lose fields such as `available_markets`,
  `popularity`, `label`, `followers`. `external_ids` was reinstated in
  March 2026. ([migration guide][mig-feb26], [March changelog][chg-mar26])
- Still available: `GET /me/player/recently-played` and all player
  endpoints in section 2. ([changelog][chg-feb26])

### 4b. Replacement endpoints as Groupify uses them

Read directly on 2026-11-17 for #87.
- `POST /me/playlists`: JSON body `name`, `public`, `collaborative`,
  `description`; returns the playlist (201). `collaborative: true` needs
  `public: false`. ([create][create-pl])
- `POST /playlists/{id}/items`: `uris` in the query or a JSON body (the
  query wins if both), at most 100 per request; returns `snapshot_id`
  (201). ([add items][add-items])
- `PUT /playlists/{id}/items`: replaces every item with up to 100 `uris`
  (an empty list clears the playlist); returns `snapshot_id` (200).
  Scope `playlist-modify-public` or `-private` by the playlist's
  visibility. ([update items][replace-items])
- `GET /playlists/{id}/items`: `limit` at most **50** (default 20). Each
  entry has the track or episode under **`item`**; `track` is kept but
  deprecated. Only for playlists the user owns or collaborates on,
  otherwise 403. Scope `playlist-read-private`. ([items][pl-items])
- `PUT /me/library`: `uris` as a comma-separated **query** parameter, at
  most 40; accepts `spotify:playlist:{id}` among other types. The page
  lists the scopes `user-library-modify`, `user-follow-modify` and
  `playlist-modify-public` without saying which applies to which URI
  type. Returns 200. ([save to library][save-library])
- Token responses (code exchange and refresh) include `scope`, the
  space-separated scopes granted. ([refreshing tokens][refresh])

## 5. Playlists

All [S].
- Collaborative requires non-public: to create one "you must also set
  public to false"; `collaborative: true` can only be set on non-public
  playlists. ([create][create-pl], [change details][change-pl])
- Scopes: `playlist-modify-public` for public playlists,
  `playlist-modify-private` for private ones. Relayed: "To create
  collaborative playlists you must have granted playlist-modify-private
  and playlist-modify-public scopes." ([create][create-pl], [scopes])
- `playlist-read-collaborative` includes collaborative playlists when
  listing a user's playlists. ([scopes])
- Who can modify: relayed, setting collaborative "means that anyone with
  the link can add to or remove a track from it. Note that this is
  slightly different from adding/removing collaborators, which is
  currently not possible through the WebAPI." ([playlists]; the search
  tool flagged this page copy as old.)
- A 2015 announcement says an app may modify a playlist on a user's
  behalf only if the user owns it. ([2015 news][collab-2015]) Old; it
  conflicts with the line above and was not reconciled.
- Reading items is "only accessible for playlists owned by the current
  user or playlists the user is a collaborator of" (relayed).
  ([get items][pl-items])
- `public` is not access control: "anyone with the link to the playlist
  can access it unless it's made private" (relayed). ([playlists])
- Deleting: relayed, "We have no endpoint for deleting a playlist in the
  Web API; the notion of deleting a playlist is not relevant within the
  Spotify's playlist system. Even if you are the playlist's owner and
  you choose to manually remove it from your own list of playlists, you
  are simply unfollowing it." Other followers keep it. ([playlists],
  [unfollow])
- Follow/unfollow endpoint paths: see 4a.
- Transferring ownership to another account: nothing found (Unverified).

## 6. Recently played (`GET /me/player/recently-played`)

- [S] Scope `user-read-recently-played`. ([scopes])
- [S] `limit` default 20, max 50. `after` / `before` are Unix
  millisecond cursors; only one may be set. Response has `next` and
  `cursors`. ([reference][recent])
- [S] Does not support podcast episodes. ([reference][recent])
- [S] Tracks played in a private session are excluded.
  ([2017 announcement][recent-2017])
- [D] Item shape in Spotify's TypeScript SDK is exactly `track`,
  `played_at`, `context`. There is **no field for how much of the track
  was played**. ([ts-sdk])
- What qualifies as "played" (minimum duration, skips): not stated in
  anything retrieved (Unverified).

## 7. Tokens (Authorization Code flow)

All [S].
- Access tokens last one hour; `expires_in` is the access token's
  lifetime, not the refresh token's. ([refreshing tokens][refresh],
  [refresh expiry post][blog-refresh])
- A refresh response may omit `refresh_token`; keep using the stored
  one. ([refreshing tokens][refresh])
- **Refresh tokens expire six months after the user's original
  authorisation.** New apps from 2026-06-18, existing apps from
  2026-07-20. Refreshing does not extend the window. Tokens carry no
  issue timestamp, so the app must track the authorisation date itself.
  ([refresh expiry post][blog-refresh])
- Expired or revoked refresh token: token endpoint returns **400** with
  `{"error": "invalid_grant"}`. Do not retry; discard stored tokens and
  send the user through authorisation again. Previously granted scopes
  carry over if the same ones are requested.
  ([refresh expiry post][blog-refresh])
- Tokens tied to the issuing Client ID: no statement found (Unverified).
- **Redirect URIs** (read on the live page 2026-11-18, [redirect URI][redirect]):
  HTTPS is required unless the URI is a loopback address, and loopback
  must be an IP literal (`http://127.0.0.1:PORT`, `http://[::1]:PORT`):
  "`localhost` is not allowed as redirect URI". The URI must match the
  one registered on the app exactly; the only allowance is a dynamic
  port on a loopback URI registered without one. No wildcards are
  mentioned.

[redirect]: https://developer.spotify.com/documentation/web-api/concepts/redirect_uri

---

## Mismatches with the repo

Items 1 to 7 were fixed in #87 (2026-11-17): Groupify now uses the
replacement endpoints in section 4b for every development-mode removal,
caps search at 10, and asks for the extra scopes (adr/0003).

1. Fixed: playlists are created with `POST /me/playlists`.
2. Fixed: add, replace and read use `/playlists/{id}/items`; reads page
   at 50 and the controller reads `items.total` (falling back to
   `tracks.total`).
3. Fixed: following saves `spotify:playlist:{id}` with `PUT /me/library`.
4. Fixed: search asks for at most 10; the frontend default is 10.
5. Fixed: the unused `getTracks` and `getAudioFeatures` were removed.
6. No change needed: sign-in already stores `email: null` when `GET /me`
   leaves it out.
7. Partly fixed: `playlist-modify-public` is now requested, so creating
   a collaborative playlist has both modify scopes.
   `playlist-read-collaborative` is still not requested.
8. Refresh token lifetime: fixed for the expiry itself (#86).
   `SpotifyService.refreshAccessToken` turns `400 invalid_grant` into a
   401 with code `SPOTIFY_REAUTH_REQUIRED`, `TokenManager` clears the
   stored tokens, and the frontend signs the user out. Still open: no
   authorisation date is stored, so the app can't warn before expiry.
9. Recently played as proof of listening:
   `Groupify-backend/src/utils/scheduler.js:34-70` marks a share as
   listened for any item in recently-played. (The scheduler is switched
   off in `app.js`, so this is not live behaviour.) The response has no
   played-duration field and the docs retrieved do not define what
   counts as a play.
10. `adr/0001-several-spotify-apps-side-by-side.md` and the five-user
    bullet in `CLAUDE.md`:
    the five-user cap matches. Not covered by the ADR: development-mode
    quota is now shared across all Client IDs of one developer account;
    the app owner needs Premium; and Spotify describes development mode
    as for personal, non-commercial projects. The ADR's claim that
    tokens only work with the issuing app could not be confirmed from
    docs (Unverified).
11. `spotifyService.js:826` comment says following is "required for
    users to collaborate", and `spotifyController.js` tells non-owners
    they "can add tracks directly in Spotify". The playlists page (old
    copy) says anyone with the link can add or remove; no retrieved
    page says following is required.
12. `spotifyService.js:961-980` handles 204 inside `catch`. Spotify
    documents 204 as a success status, so axios resolves and the
    function returns the empty body, not `null`.
13. `.claude/skills/groupify-playback/SKILL.md` says
    `initialization_error` is "common in in-app browsers". The reference
    only says EME is the likely cause; in-app browsers are not
    mentioned in anything retrieved.
14. `Groupify-frontend/src/hooks/useCurrentPlayback.ts:48` defaults to
    8000 ms while the skill and `CONTRIBUTING.md` §2.5 say 3-5 s. It
    has two callers: `SpotifyPlayerCard.tsx:36` passes 3000, and
    `useGlobalPlaybackTracking.ts:16`, the hook that records listens,
    passes 10000, outside the project's own range. Spotify documents no
    polling interval; these numbers are the project's own.
15. `Groupify-backend/.env.example` uses
    `http://localhost:5001/api/v1/auth/callback` as
    `SPOTIFY_REDIRECT_URI`. (The same value in `src/config/env.js` is a
    placeholder used only when `NODE_ENV=test`, and never reaches
    Spotify.) Spotify's redirect URI page (section 7)
    says `localhost` is not allowed; `http://127.0.0.1:5001/...` is.
    Existing apps may still accept a URI registered earlier (not
    confirmed). CONTRIBUTING §4's phone steps use HTTPS tunnel URLs, so
    they aren't affected.

Consistent with the docs: SDK scopes requested (`streaming`,
`user-read-email`, `user-read-private`), player scopes, all eight SDK
events handled in `useSpotifyPlayer.ts:335-433`, `activateElement()` in
the tap, `getOAuthToken` behaviour described in the skill,
collaborative forced non-public (`spotifyService.js:395-400`), keeping
the old refresh token when none is returned.

## Unverified / could not confirm

Could not confirm
- The [S] facts not listed as verified in the header: they still need a
  re-read on the live page, especially quoted wording.
- The revised date on which the February 2026 endpoint changes hit
  existing development-mode apps.

Docs retrieved did not say
- Per-endpoint status codes for the player endpoints, and what 404 and
  403 mean on each. The repo's readings (404 = device not found or no
  active device; 403 on pause = already paused; 404 on transfer =
  "device activated without playback") are **not confirmed by any
  source retrieved**.
- Any "no active device" error name or reason code for the Web API.
- Whether a Web Playback SDK device must be transferred to before
  `play?device_id=` works.
- SDK support in in-app browsers / webviews; a browser version table.
- Whether `account_error` is the event fired for mobile-only Premium
  plans (the exclusion is stated on the overview, not tied to the
  event).
- What `getOAuthToken` does if the callback is never called.
- Any recommended polling interval for playback state.
- The numeric rate limit.
- Whether tokens are bound to the Client ID that issued them, and that
  refresh must use that app's credentials (ADR 0001 assumes this).
- Whether creating several development-mode apps to exceed the user cap
  is permitted. The terms retrieved only say Spotify may impose quotas
  and restrictions; no explicit rule found either way.
- Whether a playlist can be transferred to another account.
- Whether a user must follow a collaborative playlist to edit it, and
  how the 2015 "owner only" statement relates to current behaviour.
- What counts as "played" for recently-played, and whether results are
  capped to the last 50 plays overall.
- Whether rotation of refresh tokens happens in the Authorization Code
  flow (only "may be omitted" was found).
