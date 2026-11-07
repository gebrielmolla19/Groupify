---
name: groupify-pr
description: Open or update a Groupify pull request the project's way — verified, linked to its issue, filled from the PR template, stacked correctly, and tracked. Use when a change is ready for review, when asked to "open a PR", "push this", or "get this merged", or when a stacked PR's base has merged.
---

# Opening a Groupify pull request

## Before opening
- [ ] The `groupify-verify` skill passed on the final commit.
- [ ] Self-review the full diff (`git diff <base>...HEAD`). Look for
      debug leftovers, unrelated changes, commented-out code and secrets.
- [ ] Commits follow Conventional Commits, with **no `Co-Authored-By`
      trailers**.
- [ ] `git fetch origin`. If the base moved, check the branch still
      merges: `git merge-tree --write-tree origin/<base> HEAD`.

## Push and open
1. `git push -u origin <branch>`.
2. Base branch: `main`, or the parent branch if this is **stacked**.
   Stacked PRs start with: "**Stacked on #N** — merge that first."
3. Body: follow `.github/pull_request_template.md`.
   - `Fixes #N` (or `Refs #N` if it doesn't fully close the issue)
   - **What & why**: for bugs, the root cause
   - **How it was verified**: real numbers from the verify script, plus
     the manual checks you actually did
   - **Not verified**: unchecked boxes for anything left to the user
     (Premium playback, a real phone, and so on)
   - **Risk & rollback**: env vars, OAuth scopes, migrations
4. Create it with `gh pr create`. On this machine the `gh` token can't
   create PRs (it returns 403), so use the GitHub MCP connector instead:
   `mcp__github__create_pull_request` with owner `gebrielmolla19` and
   repo `Groupify`.
5. Track it: in the desktop app, bind the PR to the session
   (`mcp__ccd_pr__bind_pr`) and read its CI with `mcp__ccd_pr__get_status`.
   Don't poll CI in a loop.
6. Comment on the issue only if something needs explaining. `Fixes #N`
   already links them.

## After opening
- **CI fails:** read the failing job's log, fix the cause, push again,
  and say what you changed.
- **Review comments:** fix each one or reply with a reason, then run
  `groupify-verify` again.
- **A stacked PR's base merged:** confirm GitHub retargeted it to `main`
  (`gh pr view <n> --json baseRefName`) and that it still merges cleanly.
- **Merging is the user's call.** Don't merge or enable auto-merge unless
  they ask.
