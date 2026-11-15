# Groupify

A web app where friends share Spotify tracks into a **group**, play them
in the browser, and compare listening habits. Users sign in with Spotify;
each group has a feed of shares, a playlist, and Group Dynamics: measures
of who shares and who listens.

Two separate npm projects, no root `package.json`:

- `Groupify-backend/`: Express + MongoDB (Mongoose) + Socket.io,
  CommonJS JavaScript. REST API under `/api/v1`.
- `Groupify-frontend/`: React 18 + TypeScript + Vite + Tailwind 4 +
  shadcn/ui, installed as a PWA. Deployed on Vercel.

## Where knowledge lives

- **What the words mean**: `CONTEXT.md` is the glossary. Use its terms
  in code, issues and PRs, and read it before discussing any domain
  concept (share, listen, owner, playlist, invite).
- **Why it is built this way**: `adr/` holds the decisions that are hard
  to reverse and surprising without their reason. Read the relevant one
  before changing Spotify sign-in or the group's Spotify playlist, and
  add one when you make a decision of that kind (`adr/README.md`).
- **How to make a change**: the `groupify-change` skill, backed by
  `CONTRIBUTING.md` (lifecycle in §1, engineering rules in §2, local
  running and the manual playback checklist in §4).
- **Playback, devices, Spotify auth or scopes**: the `groupify-playback`
  skill, before reading or changing that code.
- **API surface**: `Groupify-backend/src/routes/` and the typed client in
  `Groupify-frontend/src/lib/api.ts`.
- **Data model**: `Groupify-backend/src/models/`.
- **Screens and URLs**: `Groupify-frontend/src/App.tsx`.

`Groupify-backend/README.md` is reliable for first-time setup only. Its
endpoint list, Socket.io events, "Background Jobs" and "Next Steps"
sections describe an early version of the app; trust the code above.

## What the code won't tell you

- **A "listen" is recorded by the frontend.** It watches the user's
  Spotify playback and calls the shares API when a shared track has been
  played. The backend cron in `src/utils/scheduler.js` that polls
  "recently played" is switched off in `app.js`. The feed also still
  has a manual "Mark as listened" button, which contradicts the
  glossary's definition of a listen and is due for removal (#79).
- **One Spotify app allows only 5 users in development mode**, so the
  backend supports several Spotify apps side by side
  (`SPOTIFY_CLIENT_ID_1`, `/login?app=1`, `User.spotifyAppIndex`). A
  user's tokens only work with the app that issued them.
- **A track can be shared once per group.** The same track in two groups
  is two shares with separate listens and likes.
- **Playback needs Spotify Premium**, so most playback behaviour can't be
  exercised from an automated session. Report it as not verified, as the
  playback skill describes.
- **Backend tests bring their own database** (`mongodb-memory-server`).
  The running app uses hosted Atlas through `MONGO_URI`.
- **Frontend installs need `--legacy-peer-deps`** (`npm ci
  --legacy-peer-deps`).
- `Groupify-frontend/{dev-dist,playwright-report,test-results}` are
  generated output that happens to be committed. Leave them out of
  commits.
