---
name: groupify-pr
description: Open or update a Groupify pull request the project's way — verified, linked to its issue, filled from the PR template, stacked correctly, reviewed by a fresh-context reviewer, and tracked. Use when a change is ready for review, when asked to "open a PR", "push this" or "get this merged", or when a stacked PR's base has merged. (To review a PR someone else opened, use groupify-review.)
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
   - **Evidence**: before/after proof of the change. Required, see
     "Evidence" below.
4. Create it with `gh pr create`. On this machine the `gh` token can't
   create PRs (it returns 403), so use the GitHub MCP connector instead:
   `mcp__github__create_pull_request` with owner `gebrielmolla19` and
   repo `Groupify`.
5. Track it: in the desktop app, bind the PR to the session
   (`mcp__ccd_pr__bind_pr`) and read its CI with `mcp__ccd_pr__get_status`.
   Don't poll CI in a loop.
6. Comment on the issue only if something needs explaining. `Fixes #N`
   already links them.

## Evidence
Every PR shows the thing it fixed or built, so the user can see it
works without checking out the branch. Capture it **before** opening
the PR (for bugs, capture the "before" while reproducing, ahead of the
fix).

**What to capture**
- **UI change:** before and after screenshots of the affected screen,
  at desktop width and at 375 px.
- **Flow or interaction** (playback, seek, drag, toasts, navigation): a
  short GIF or video of the after, plus the before if it's a bug.
- **Backend, API or logic:** before/after text in fenced code blocks,
  such as the `curl` response (status and body), the relevant log lines,
  or the regression test failing on the old code and passing on the new.
- **Refactor or chore with no visible change:** one line saying so, plus
  the verify output. That's the evidence.

**How to capture**
- Run the app (`run` skill, or the dev servers in CLAUDE.md) and open it
  in a browser you can save files from. The `chrome-devtools` MCP works:
  `resize_page` (1280×800, then 375×812), then
  `take_screenshot` with a `filePath` in the scratchpad directory.
  `screencast_start` / `screencast_stop` records a flow. Convert it to a
  GIF with `ffmpeg` if that's installed, so it plays inline on GitHub.
- iOS Simulator: the simulator `screenshot` action.
- Look at every image before using it. It must show the change, not a
  login page, a loading spinner or the wrong screen.
- **The repo is public.** Use test data only. No real emails, tokens,
  Spotify account names or other personal data in a screenshot. Crop or
  retake if any show up.

**How to attach**
GitHub's API can't upload images to a PR body, so images go on the
`pr-evidence` branch, which holds only evidence and is never merged.
Never commit them to the feature branch.
```bash
git fetch origin pr-evidence 2>/dev/null \
  && git worktree add <scratch>/pr-evidence pr-evidence \
  || git worktree add --orphan -b pr-evidence <scratch>/pr-evidence
mkdir -p <scratch>/pr-evidence/<branch> && cp <images> <scratch>/pr-evidence/<branch>/
git -C <scratch>/pr-evidence add <branch>
git -C <scratch>/pr-evidence commit -m "evidence: <branch>"
git -C <scratch>/pr-evidence push -u origin pr-evidence
git worktree remove <scratch>/pr-evidence
```
Then reference each image in the Evidence table as
`![after, 375 px](https://raw.githubusercontent.com/gebrielmolla19/Groupify/pr-evidence/<branch>/after-375.png)`.
Name files `before-desktop.png`, `after-375.png`, `after-flow.gif` and
so on. Open one raw URL to check it loads before you finish the PR.

**Couldn't capture it?** For example, it needs Premium audio or a real
phone. Say why in Evidence, and add an unchecked box under "Not
verified". Never use a mock-up, an edited image or a screenshot of
other code as evidence.

## Review (every PR, before telling the user it's ready)
This is the project's review gate. It costs nothing beyond the user's
Claude Code plan. With `main`'s ruleset in place (CONTRIBUTING.md §1.6),
a posted finding blocks the merge until it's fixed or answered. If
`gh api repos/gebrielmolla19/Groupify/rules/branches/main` returns `[]`,
the ruleset isn't active. Tell the user, because then nothing actually
blocks a merge.

**The review must come from a fresh context, never from the session that
wrote the code.** The author knows what the code was *meant* to do, and
that's exactly what hides bugs.

1. **Launch a fresh reviewer.** Use the Agent tool with a
   general-purpose subagent. **Not a fork:** a fork inherits this
   conversation, which defeats the purpose. Give it only this brief,
   nothing about how the code was written:
   > Review pull request #<n> in gebrielmolla19/Groupify. Read
   > `.claude/skills/groupify-review/SKILL.md` and follow it exactly:
   > review independently, post one GitHub review with inline comments,
   > and return the summary it describes. Don't modify the branch.

   If the user wants to watch or steer the review, start a separate
   session for it instead (fresh context, same brief).
2. **Wait for the summary**, then check that the review actually posted
   (its link, or `gh pr view <n> --json reviews`).
3. **Blocking findings:** fix them on the branch, run
   `groupify-verify`, push, and record which commit fixed each finding.
   Try replying on each thread first. If that isn't possible (the
   connector has no reply tool, and the `gh` token can't write to PRs),
   post **one** PR comment with `mcp__github__add_issue_comment` listing
   each finding → the commit that fixed it. Then try to resolve each
   thread:
   `gh api graphql -f query='mutation{resolveReviewThread(input:{threadId:"<id>"}){thread{isResolved}}}'`.
   Get thread ids from
   `gh api graphql -f query='{repository(owner:"gebrielmolla19",name:"Groupify"){pullRequest(number:<n>){reviewThreads(first:50){nodes{id isResolved comments(first:1){nodes{body}}}}}}}'`.
   If the token can't resolve threads, tell the user which ones are ready
   to resolve.
   - **Disagree with a finding?** Don't resolve it silently. Reply with
     your reasoning (or put it in the summary comment) and leave the
     thread for the user to decide.
4. **Suggestions:** apply the cheap, clearly right ones that are about
   this PR's own changes. A finding about **existing behavior** (it
   predates the PR, even in a touched file) gets a new issue instead
   (CONTRIBUTING §1.1). Reply on its thread, or in the summary comment,
   with "Tracked in #N", and resolve the thread. Don't fix it here
   unless the user says so. List anything left for the user.
5. **Report to the user:** the verdict, a link to the review, the
   blocking items and how each was handled, and the suggestions left
   for them to decide. **The merge is theirs.**

## After opening
- **CI fails:** read the failing job's log, fix the cause, push again,
  and say what you changed.
- **The change looks different after new commits** (a review fix changed
  the UI, say): retake the after shots, push them to `pr-evidence`, and
  update the PR body.
- **Review comments** (yours or anyone else's): fix each one or reply
  with a reason, run `groupify-verify` again, and resolve the thread.
- **New commits after a review** that do more than fix review findings:
  launch a **new** fresh reviewer (step 1) and tell it to focus on
  `git diff <old-head>..<new-head>`.
- **A stacked PR's base merged:** confirm GitHub retargeted it to `main`
  (`gh pr view <n> --json baseRefName`) and that it still merges cleanly.
- **Merging is the user's call.** Don't merge or enable auto-merge unless
  they ask.
