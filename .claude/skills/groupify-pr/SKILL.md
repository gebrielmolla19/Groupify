---
name: groupify-pr
description: Open, review or update a Groupify pull request the project's way — verified, linked to its issue, filled from the PR template, stacked correctly, reviewed with inline comments posted to GitHub, and tracked. Use when a change is ready for review, when asked to "open a PR", "push this", "review this PR" (including PRs opened by the user or Cursor), or "get this merged", or when a stacked PR's base has merged.
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

## Review (every PR, before telling the user it's ready)
This is the project's review gate. It runs in the Claude Code session, so
it costs nothing beyond the user's plan. `main`'s ruleset requires every
review thread to be resolved, so a posted finding blocks the merge until
it's fixed or answered.

1. **Review the PR as a reviewer, not as its author.**
   - Read the whole diff (`gh pr diff <n>`) and enough of the surrounding
     code to judge it.
   - Use the `code-review` skill on the PR number if it's available, at
     its default level. Run it report-only: don't use its `--comment`
     option, because this repo's `gh` token can't post reviews.
   - Check correctness first: edge cases, error paths, auth and
     authorization, races, state left behind after failures.
   - Then check the rules in `CONTRIBUTING.md` §2, and for playback
     changes the `groupify-playback` invariants.
   - Then check tests: does a bug fix have a regression test? Is new
     logic covered?
   - **Verify every finding before posting it.** Re-read the code, and
     run it or write a quick check where you can. Drop anything you
     can't support.
2. **Classify each finding:**
   - `🔴 Blocking`: a bug, security problem, broken `CONTRIBUTING.md`
     rule, or missing regression test
   - `🟡 Suggestion`: worth doing, but not a reason to hold the merge
3. **Post one review** with `mcp__github__create_pull_request_review`:
   - `event: "COMMENT"`. GitHub rejects `APPROVE` and `REQUEST_CHANGES`
     on PRs authored by the same account, which is every PR here.
   - `commit_id`: the PR's head SHA
     (`gh pr view <n> --json headRefOid -q .headRefOid`).
   - `comments`: one inline comment per finding, with `path` and the
     `line` in the new version of the file. Start each with
     `🔴 Blocking:` or `🟡 Suggestion:`, then say what's wrong, the
     concrete failure case, and the suggested fix.
   - Inline comments must land on lines inside the diff. If a finding is
     about unchanged code, put it in the review body instead.
   - `body`: starts **"Claude review — ✅ No blocking issues"** or
     **"Claude review — 🔴 N blocking issue(s)"**, then says in one or two
     lines what was checked, and lists any findings that aren't inline.
   - With no findings, still post the review: the ✅ body and no
     comments.
4. **Blocking findings on your own PR:** fix them on the branch, run
   `groupify-verify`, push, and reply on each thread with the commit
   that fixed it. Then try to resolve each thread:
   `gh api graphql -f query='mutation{resolveReviewThread(input:{threadId:"<id>"}){thread{isResolved}}}'`.
   Get thread ids from
   `gh api graphql -f query='{repository(owner:"gebrielmolla19",name:"Groupify"){pullRequest(number:<n>){reviewThreads(first:50){nodes{id isResolved comments(first:1){nodes{body}}}}}}}'`.
   If the token can't resolve threads, tell the user which ones are ready
   to resolve.
5. **Report to the user:** the verdict, a link to the review, the
   blocking items and how each was handled, and the suggestions left
   for them to decide. **The merge is theirs.**

## After opening
- **CI fails:** read the failing job's log, fix the cause, push again,
  and say what you changed.
- **Review comments** (yours or anyone else's): fix each one or reply
  with a reason, run `groupify-verify` again, and resolve the thread.
- **New commits after a review:** re-review the new changes (`gh pr diff`
  or `git diff <old-head>..<new-head>`) and post a short follow-up
  review.
- **A stacked PR's base merged:** confirm GitHub retargeted it to `main`
  (`gh pr view <n> --json baseRefName`) and that it still merges cleanly.
- **Merging is the user's call.** Don't merge or enable auto-merge unless
  they ask.
