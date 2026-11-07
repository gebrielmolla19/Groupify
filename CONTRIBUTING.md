# Contributing to Groupify

How we plan, build, verify and ship changes. This applies to everyone
making changes, including AI assistants (Claude Code, Cursor, Codex).

The rules are short on purpose. Most of them come from real bugs this
project has had; those are noted inline so the reason is never lost.

**Using Claude Code?** These practices are also packaged as project
skills in `.claude/skills/`. Claude picks them up automatically, and you
can run any of them as a slash command:

| Skill | Use it for |
|---|---|
| `/groupify-change` | Any change, from issue to merged PR (the overall flow) |
| `/groupify-bugfix` | Bugs: reproduce → evidence → root cause → failing test → fix |
| `/groupify-verify` | The Definition of Done checks (`scripts/verify.sh`) |
| `/groupify-pr` | Opening or updating a PR the project's way (launches a fresh reviewer) |
| `/groupify-review` | Independent review of a PR, posted as inline comments; run it in a fresh context |
| `/groupify-playback` | Anything touching Spotify playback: doc links, invariants, checklist |

Without Claude, you can run the checks directly:
`bash .claude/skills/groupify-verify/scripts/verify.sh` (add `--all`, or
a base ref for stacked branches).

---

## 1. The lifecycle of a change

```
Issue → Branch → Build → Verify → Pull request → Review → Merge → Confirm → Close
```

### 1.1 Start from an issue
- **Every change starts as a GitHub issue**, except typo-level fixes. The
  issue says *what* and *why*, and ends with a **"Done when"** line that
  someone else could check.
- Label it with an area (`frontend`, `backend`, `playback`, `tests`) and a
  kind (`bug`, `enhancement`, `refactor`, `performance`, `documentation`).
- Found something unrelated while working? **Open an issue for it.** Don't
  fix it in the current branch.

### 1.2 Branch
- Branch from an up-to-date `main`. Use one branch per concern:
  `type/short-description`, for example `fix/graceful-shutdown` or
  `feat/player-scrubbing`.
- Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`.
- If one change depends on another unmerged branch, **stack it**: branch
  from that branch, open the PR against it, and say "Stacked on #N" at
  the top of the PR. Merge bottom-up.
- Working on several things in parallel? Use `git worktree` so branches
  don't trample each other's uncommitted changes.

### 1.3 Build
- Keep PRs small: aim for under ~400 changed lines (excluding lockfiles and
  tests). Split refactors from behavior changes, so a refactor can be
  reviewed as "no behavior change".
- Commit in logical steps using
  [Conventional Commits](https://www.conventionalcommits.org):
  `type(scope): summary`, for example `fix(player): stop hijacking playback on 404`.
  The body explains **why**, not just what.

### 1.4 Verify (Definition of Done)
A change is done when **all** of these are true:

- [ ] **Backend:** `cd Groupify-backend && npm run lint -- --quiet && npm test`
- [ ] **Frontend:** `cd Groupify-frontend && npm run lint -- --quiet && npm run test:run && npm run build`
- [ ] **Bug fixes include a regression test** that fails without the fix.
- [ ] **New logic has tests** (services, hooks, utilities). UI-only tweaks
      can rely on manual checks.
- [ ] **Manually exercised** in the running app (§4), including at phone
      width (375 px) for any UI change.
- [ ] **No new type errors** in the files you touched
      (`npx tsc --noEmit -p Groupify-frontend`).
- [ ] The issue's "Done when" line is satisfied.

`bash .claude/skills/groupify-verify/scripts/verify.sh` runs all the
automated items for the apps your branch touched. CI runs them on every
PR. A red CI blocks the merge.

### 1.5 Pull request
- Fill in the PR template: linked issue (`Fixes #N`), what changed and why,
  how it was verified (with real output), risk and rollback.
- **List anything you could not verify** (for example "needs a Premium
  account on a phone") as an unchecked box. Never claim a test you didn't run.
- Review your own diff before asking anyone else.

### 1.6 Review
- Every PR gets a review before merging, from **a reviewer who didn't
  write the code.** In practice that's Claude in a fresh context: a
  reviewer subagent or a new session running `/groupify-review`. Never
  the session that wrote the change. `/groupify-pr` launches it
  automatically. The findings are posted as **inline review comments**
  on the PR. A human reviewer works too.
- Reviewers check correctness first (edge cases, error paths, auth), then
  design, then style. Style nits that a linter could catch should become
  lint rules instead.
- **Each review comment gets fixed or answered**, then its thread is
  resolved. `main`'s ruleset requires all conversations to be resolved,
  so an open finding blocks the merge.
- **The merge click is the owner's approval.** The ruleset needs 0 formal
  approvals: GitHub doesn't let a PR's author approve it, and every PR
  here is opened under the owner's account.

`main`'s ruleset enforces: PR required · status checks `Backend tests` +
`Frontend tests` must pass · conversations resolved · no force pushes or
deletion.

### 1.7 Merge, confirm, close
- Merge only with green CI and the PR's manual checklist ticked.
- `main` must always be deployable. If a merge breaks it, **revert first**
  (`git revert` in a new PR) and debug afterwards.
- After merging, confirm the change in the running app or deploy, then
  close the issue (`Fixes #N` closes it automatically) and delete the branch.

---

## 2. Engineering rules

### 2.1 Architecture
- **Backend:** `Routes → Controllers (thin) → Services (all logic) → Models`.
  Controllers parse and validate input, call a service, and shape the
  response. Business logic and external API calls live in services.
- **Frontend:** `Components → Hooks → src/lib/api.ts → Backend`.
  Components never call `fetch` directly.
- Global singletons (like the Spotify player) live in **one store** read
  through `useSyncExternalStore`. Don't scatter module-level variables.

### 2.2 Errors and logging
- **No empty `catch` blocks.** Handle the error, log it with context, or
  rethrow it. A swallowed error once hid real playback failures.
- **No `console.*` in backend code.** Use the Winston `logger`, which has
  levels and doesn't leak to stdout in production. The frontend uses
  `src/utils/logger`.
- Service errors carry a `statusCode` so the controller returns the right
  HTTP status. Unexpected errors go to `next(error)`.
- **Never silently fall back to a different target.** The old playback
  code moved audio to "any active device" when the browser player
  vanished, which sent music to the user's phone and froze the UI. When the
  intended thing fails, fail clearly and tell the user.
- One user-facing toast per failure. If a lower layer already notified
  the user, callers must not show a second one.

### 2.3 Security
- **Authenticate and authorize every route.** Check that the user may act
  on *this* group or resource, not only that they're logged in (for
  example, only owners can export a group's playlist).
- Validate and normalize input at the controller (types, ranges,
  `parseInt(x, 10)`).
- **Secrets never go in git.** Add every new env var to `.env.example`
  with a comment, and to `src/config/env.js` validation.
- Request the minimum Spotify OAuth scopes a feature needs.

### 2.4 Frontend
- **TypeScript strict, no `any`.** Use `unknown` and narrow it. Model API
  responses with types.
- **Styling:** use Tailwind theme tokens (`bg-background`, `text-primary`),
  not hex colors. No `!important`. Build on shadcn/ui primitives and merge
  classes with `cn` from `src/lib/utils`.
- **Accessibility:** interactive elements have labels (`aria-label`, or
  `aria-valuetext` for sliders), touch targets are at least 44 px, and
  everything works with the keyboard.
- Use stable `key`s from IDs, never array indexes.
- Mobile is a first-class target. Check every UI change at 375 px.

### 2.5 External APIs (Spotify)
- **Read the official docs before diagnosing or designing around an API.**
  We once planned a whole mobile workaround on the belief that the Web
  Playback SDK doesn't support mobile; the docs say it does, provided
  `activateElement()` is called inside the user's tap.
- Handle every documented error event and status code. Link the doc
  section in a code comment when behavior is non-obvious.
- Rate limits: poll no faster than needed (about 1 s for the in-browser
  player, 3–5 s for remote devices), and honor `Retry-After` on 429.

### 2.6 Data (MongoDB)
- Every hot query has a supporting index. Check new queries with
  `explain()`.
- Prefer aggregation pipelines over fetching documents and computing in JS.
- Schema changes that affect existing documents need a migration note in
  the PR.

### 2.7 Dependencies
- Add a dependency only when it clearly beats writing the code. Note the
  reason in the PR.
- The frontend installs with `npm ci --legacy-peer-deps` (a known
  `date-fns` / `react-day-picker` peer conflict). Don't add more peer
  conflicts.

---

## 3. Fixing bugs

1. **Reproduce** it and write down the exact steps.
2. **Collect evidence**: browser console, network tab, and backend logs
   (`Groupify-backend/logs/`).
3. **Find the root cause.** Explain why it happens before changing code.
   Fixing a symptom is acceptable only when labelled as a stop-gap, with
   an issue open for the real fix.
4. **Write a failing test** that captures the bug.
5. **Fix it**, watch the test pass, and run the full Definition of Done.
6. In the PR, describe the root cause, the fix, and how you know it's fixed.

---

## 4. Running and testing locally

```bash
cd Groupify-backend && npm run dev     # http://localhost:5001  (needs .env; see .env.example)
cd Groupify-frontend && npm run dev    # http://127.0.0.1:3000
```

MongoDB is hosted (Atlas); don't start a local one.

**Manual playback checklist** (needs Spotify Premium; run it for anything
touching the player, auth or the API client):
- [ ] Desktop Chrome: play, next, previous, pause/resume, seek
- [ ] A track that ends auto-advances and is marked as listened
- [ ] Opening Groupify while music plays in the Spotify app does **not**
      pause it
- [ ] Logging out removes "Groupify Web Player" from the Spotify device list
- [ ] Phone (Safari and Chrome, through a tunnel with its URL added as a
      Spotify redirect URI): tap to play, next/prev, lock and unlock the
      screen, then tap play

---

## 5. Tracking work

- Open work lives in **GitHub Issues**. Write the "Done when" line in
  each issue and keep it up to date.
- Use the `needs-review` label for branches that are pushed and waiting
  on review.
- Tech debt gets an issue with the `refactor` or `performance` label. It
  doesn't get fixed inside an unrelated PR.
