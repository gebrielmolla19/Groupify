---
name: groupify-verify
description: Run Groupify's Definition of Done checks (lint, tests, build, type errors in touched files) for whichever app(s) the current branch changed, and report real results. Use before committing, before opening or updating a PR, after fixing review comments, or whenever asked "does it pass?" / "is it ready?".
---

# Verify a Groupify change

## 1. Automated checks
From anywhere in the repo:

```bash
bash .claude/skills/groupify-verify/scripts/verify.sh            # vs origin/main
bash .claude/skills/groupify-verify/scripts/verify.sh <base-ref> # stacked branch: pass its base
bash .claude/skills/groupify-verify/scripts/verify.sh --all      # both apps regardless of diff
```

The script checks whichever apps changed against the base (committed,
staged, unstaged and untracked files):

| App | Checks |
|---|---|
| Backend | `eslint . --quiet`, `jest` using CI's placeholder env vars (no `.env` needed) |
| Frontend | `eslint . --quiet`, `vitest run`, `vite build`, and **type errors in files you touched** |

It exits non-zero if anything fails. Fix every failure and re-run. If a
failure looks unrelated to the change, show that it also fails on the
base before calling it pre-existing.

If `node_modules` is missing, the script stops and tells you to install:
`npm ci` for the backend, `npm ci --legacy-peer-deps` for the frontend.

## 2. Coverage
- **Bug fix:** is there a test that fails without the fix? To prove it,
  revert the fix locally, run the test, and watch it fail.
- **New logic** (services, hooks, utilities): is it tested?

## 3. Manual checks
- **UI change:** run the app (`npm run dev` in both apps; MongoDB is
  remote, so don't start one). Check desktop width and **375 px**, using
  the browser pane's viewport tools. Check keyboard use and labels.
- **Player, auth or API client:** run the checklist in the
  `groupify-playback` skill. Most of it needs the user's Spotify Premium
  login, so hand those items to the user rather than skipping them.
- If no real data is available, render the component in isolation in
  the dev server, or write a test.

## 4. Report
Report what ran, with numbers (for example "backend 93/93, frontend
22/22, build OK"), plus **everything that was not verified**. Never
describe something as tested if it wasn't.
