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
   - **Evidence**: before/after proof, only when the change is
     something you can see. It goes here in the description, not in a
     comment. See "Evidence" below. Otherwise delete the section.
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
Add evidence when it lets the user see that the change works without
checking out the branch. Not every PR needs it.

**When it makes sense:** the change has a difference someone can
observe. That means a UI change, an interaction or flow, or a bug a user
actually hit (a broken screen, an error toast, a failed request).

**When to skip it:** docs, refactors with no behavior change, tests,
dependency bumps, CI or config, and backend internals that the tests and
verify output already prove. Delete the Evidence section. Don't fill it
with "N/A" or a copy of the diff.

When it applies, capture it **before** opening the PR. For bugs, capture
the "before" while reproducing, ahead of the fix.

**Where it goes:** the PR description's Evidence section, because that's
where reviewers look. If you capture it after the PR is open, edit the
description: read the current body (`mcp__github__pull_request_read`,
method `get`), fill in its Evidence section, and send the whole body
back with `mcp__github__update_pull_request` (it replaces the body, so
never send only the new section). A PR comment is a **fallback**, only
for when the description can't be edited. In that case, put a link to
the comment in the description's Evidence section.

**What to capture**
- **UI change:** before and after screenshots of the affected screen,
  at desktop width and at 375 px.
- **Flow or interaction** (playback, seek, drag, toasts, navigation): a
  short GIF or video of the after, plus the before if it's a bug.
- **Backend bug with a visible symptom** (a wrong status, a bad
  response, an error in the logs the user reported): before/after text in fenced code blocks,
  such as the `curl` response (status and body), the relevant log lines,
  or the regression test failing on the old code and passing on the new.

**How to capture**
- Run the app (`run` skill, or the dev servers in CLAUDE.md) and open it
  in a browser you can save files from. The `chrome-devtools` MCP works.
- **Save to `.evidence/`** at the root of the checkout you're working in
  (`take_screenshot` with `filePath: "<checkout>/.evidence/before-desktop.png"`).
  The `chrome-devtools` MCP only writes inside its workspace roots, so a
  scratchpad path is refused with `Access denied: … not within any of
  the configured workspace roots`. `.evidence/` is gitignored, so it
  can't be committed by accident. Delete it after the push to
  `pr-evidence` (below).
- **One viewport at a time, in this order:** set the viewport first
  (`resize_page` 1280×800, or `emulate` with `375x812x2,mobile,touch`),
  *then* reproduce, *then* take the shot. Changing the viewport can
  reload the page, and a reload drops anything that set up the
  reproduction, such as a `navigate_page` `initScript`. After every
  viewport change, reproduce again before the next shot.
- `screencast_start` / `screencast_stop` records a flow. Convert it to a
  GIF with `ffmpeg` if that's installed, so it plays inline on GitHub.
- iOS Simulator: the simulator `screenshot` action.
- **Look at every image before using it.** It must show the state you're
  proving (the bug in a "before" shot, the fix in an "after"), not just
  the right page. A shot can look plausible and still show the normal
  screen because the reproduction was lost. It also mustn't be a login
  page, a loading spinner or the wrong screen.
- **Reproducing an outage or a failed request:** don't stop the backend.
  Reloading with it down logs you out first (#46), so the request you
  care about never runs. Instead, make only that request fail with an
  `initScript` on `navigate_page`. This goes through the same
  `fetchWithAuth` → `ApiError { isNetworkError: true }` path as a real
  outage:
  ```js
  const realFetch = window.fetch;
  window.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (method === 'GET' && url.pathname === '/api/v1/groups') {
      return Promise.reject(new TypeError('Failed to fetch'));
    }
    return realFetch(input, init);
  };
  ```
  Change the method and path to the request you're testing. For an HTTP
  error instead of a network one, resolve with
  `new Response(JSON.stringify({ message: '…' }), { status: 500 })`.
- **The repo is public.** Use test data only. No real emails, tokens,
  Spotify account names or other personal data in a screenshot. Crop or
  retake if any show up.

**How to attach**
GitHub's API can't upload images to a PR body, so images go on the
`pr-evidence` branch, which holds only evidence and is never merged.
Never commit them to the feature branch.
```bash
W=<scratch>/pr-evidence
if git ls-remote --exit-code --heads origin pr-evidence >/dev/null; then
  git fetch origin pr-evidence
  git worktree add -B pr-evidence "$W" origin/pr-evidence
else
  git worktree add --orphan -b pr-evidence "$W"
fi
mkdir -p "$W/<branch>" && cp .evidence/* "$W/<branch>/"
git -C "$W" add <branch>
git -C "$W" commit -m "evidence: <branch>"
git -C "$W" pull --rebase origin pr-evidence 2>/dev/null || true  # skip on first push
git -C "$W" push -u origin pr-evidence
git worktree remove "$W"
rm -rf .evidence
```
Always start from `origin/pr-evidence` (`-B` resets any stale local
copy), so another session's evidence is never lost. If the push is still
rejected, someone pushed at the same moment: run the `pull --rebase` and
push again. If any step fails, stop and fix it. Never create a new orphan
branch over an existing `pr-evidence`.
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
