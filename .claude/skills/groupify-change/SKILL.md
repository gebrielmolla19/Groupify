---
name: groupify-change
description: The end-to-end workflow for making any change to Groupify (feature, fix, refactor, chore) from issue to merged PR. Use when starting work on a GitHub issue, when asked to add/change/fix something in the app, or when unsure what the next step in shipping a change is.
---

# Making a change to Groupify

The rules live in `CONTRIBUTING.md` at the repo root. Read the relevant
section when a step points to it. This skill is the order of operations.

Track progress with a checklist and don't skip steps. If a step doesn't
apply, say so in one line.

## 1. Issue
- Find the GitHub issue, or create one with `.github/ISSUE_TEMPLATE/`.
  It must have a **"Done when"** line. Typo-level changes are exempt.
- If the request is ambiguous, settle the scope with the user now, not
  after building.
- Anything new you find later (a bug, a gap, a review suggestion about
  existing behavior, related or not) becomes **a new issue** by default,
  not part of this branch. Fold it in only for the exceptions in
  CONTRIBUTING §1.1: this change causes it, this change can't be correct
  or pass review without it, or it's trivial and on lines you already touch. When
  unsure, open the issue and ask the user.
- Don't start the new issue's work, or a session for it, unless the
  user asks. Two places fixing the same thing produce duplicate PRs.

## 2. Branch
- `git fetch origin`, then branch from `origin/main`:
  `git checkout -b <type>/<short-desc> origin/main`.
  Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`.
- **Depends on unmerged work?** Branch from that branch instead, and plan
  to open the PR against it ("stacked").
- In a git worktree session, only edit files inside your own worktree.

## 3. Understand before editing
- Read the code you'll touch and its callers (`grep` for usages).
- Follow the layering in CONTRIBUTING §2.1. Business logic goes in
  backend services; frontend components call hooks, which call
  `src/lib/api.ts`.
- **Touching Spotify playback or auth?** Read the official Spotify docs
  for the APIs involved first (CONTRIBUTING §2.5). Use the
  `groupify-playback` skill.
- **Fixing a bug?** Use the `groupify-bugfix` skill. It requires a root
  cause and a regression test.

## 4. Build
- Keep it small: about 400 changed lines or fewer, excluding tests and
  lockfiles. Separate refactors from behavior changes.
- Check your code against CONTRIBUTING §2: no empty catches, no backend
  `console.*`, no silent fallbacks, auth on routes, no `any`, theme
  tokens instead of hex, accessible controls, stable `key`s.
- Add or update tests alongside the code: services, hooks and utilities.
- Reuse existing helpers before writing new ones. Search `src/lib`,
  `src/utils` and `src/hooks` first.

## 5. Verify
Run the `groupify-verify` skill. Don't continue until it's green, and
report the real output.

## 6. Commit
- Conventional Commits: `type(scope): summary`. The body explains
  **why**.
- **Don't add `Co-Authored-By` trailers** (repo owner's preference).
- Stage files explicitly with `git add <paths>`. Never commit `.env`,
  `node_modules` symlinks or `.claude/` local files.

## 7. Pull request
Use the `groupify-pr` skill.

## 8. After merge
- Confirm the change in the running app or on the Vercel preview or
  deploy.
- Make sure the issue closed (`Fixes #N` does this automatically), and
  clean up the branch and worktree.
- If `main` broke, **revert first** in a new PR, then debug.
