---
name: groupify-review
description: Independently review a Groupify pull request and post the findings to GitHub as inline review comments. Meant to run in a FRESH context (a reviewer subagent or a new session) that did not write the code. Use when asked to "review PR #N", or when launched as the reviewer by the groupify-pr skill.
---

# Reviewing a Groupify pull request

You are the **reviewer, not the author.** Judge the PR only by its diff,
the code around it, and the project's rules. You weren't part of the
conversation that wrote it, so treat claims in the PR description ("tested
X", "no behavior change") as things to check, not facts.

Input: a PR number in `gebrielmolla19/Groupify`. If you weren't given
one, ask for it.

## 1. Gather
```bash
gh pr view <n> --json title,body,baseRefName,headRefName,headRefOid,files
gh pr diff <n>
```
- Read `CONTRIBUTING.md` (§2 has the engineering rules). For anything
  touching playback, also read `.claude/skills/groupify-playback/SKILL.md`.
- Read enough of the surrounding code to judge the change: callers,
  types, tests. Read files from the PR's head commit
  (`git fetch origin <headRefName>` and
  `git show origin/<headRefName>:<path>`) rather than a working tree that
  may be on another branch.
- **Don't modify the branch.** You only review.

## 2. Review in this order
1. **Correctness:** edge cases, error paths, auth and authorization,
   races (polling vs events), state left behind after failures, wrong
   assumptions about external APIs (check the Spotify docs when it
   matters).
2. **Rules:** `CONTRIBUTING.md` §2 (no swallowed errors, no silent
   fallback to another target, one toast per failure, no `any`, theme
   tokens, accessibility, layering) and the playback invariants.
3. **Tests:** does a bug fix have a regression test? Is new logic
   covered? Do the tests actually check the behavior?
4. **The PR's own claims:** do the description and checklist match the
   diff? If the change is visible (UI, a flow, a bug a user hit), does
   the Evidence section show it: the right screen, before and after,
   phone width for UI? Missing evidence there, with no reason given, is
   a blocking finding. Don't ask for evidence on docs, refactors, tests
   or internal changes.

If the `code-review` skill is available, you can also run it on the PR
for a second pass, report-only (no `--comment` option). Its findings get
the same verification as yours.

**Verify every finding before posting it.** Re-read the exact lines, and
run a quick check (a test, a script, a `grep`) where you can. Drop
anything you can't support with a concrete failure case. Precision beats
volume: three real findings are better than ten maybes.

## 3. Classify
- `🔴 Blocking`: a bug, security problem, broken `CONTRIBUTING.md` rule,
  missing regression test, or the PR claiming something it doesn't do
- `🟡 Suggestion`: worth doing, but not a reason to hold the merge
- If a finding is about behavior that **predates the PR**, say so
  ("existing behavior"). It belongs in its own issue, not this PR,
  unless this PR makes it worse. In that case it's blocking.

## 4. Post one review
Post through the GitHub MCP connector (the `gh` token is read-only and
returns 403 on writes). Every call takes `owner: "gebrielmolla19"`,
`repo: "Groupify"`, `pullNumber: <n>`. It takes three steps:

1. **Create a pending review:** `mcp__github__pull_request_review_write`
   with `method: "create"`, `commitID`: the head SHA (`headRefOid`), and
   **no `event`** (an `event` would submit it right away, before the
   comments are added).
2. **Add each inline comment:** `mcp__github__add_comment_to_pending_review`
   once per finding, with `path`, `line` (in the new version of the
   file), `side: "RIGHT"`, `subjectType: "LINE"` and `body`. For a range,
   add `startLine` and `startSide: "RIGHT"`. Start each body with
   `🔴 Blocking:` or `🟡 Suggestion:`, then give what's wrong, the
   concrete failure case, and the suggested fix.
3. **Submit it:** `mcp__github__pull_request_review_write` with
   `method: "submit_pending"`, `event: "COMMENT"` and the review `body`
   (below). GitHub rejects `APPROVE` and `REQUEST_CHANGES` from the PR
   author's account, and all PRs here are under the owner's account.

If a step fails partway, delete the pending review
(`pull_request_review_write`, `method: "delete_pending"`) and start over,
so a half-built review isn't left on the PR.

What goes in the review:
- Inline comments must land on lines inside the diff. **Every blocking
  finding must be inline,** because only inline comments create
  threads, and only threads block the merge (`main` requires
  conversation resolution).
- If a blocking finding is about unchanged code, anchor it on the
  nearest changed line in the same file (or the PR's first changed
  line), and name the real location in the comment.
- Suggestions about unchanged code can go in the body.
- `body` (sent in step 3): starts **"Claude review — ✅ No blocking issues"** or
  **"Claude review — 🔴 N blocking issue(s)"**, then says in one or two
  lines what you checked, and lists any suggestions that aren't inline.
- With no findings, still post the review: create it, skip step 2, and
  submit it with the ✅ body.

## 5. Return a summary
End with a short report for whoever launched you:
- The verdict, and a link to the review (from the submit response, or
  `mcp__github__pull_request_read` with `method: "get_reviews"`)
- Each finding: severity, `path:line`, a one-line description
- Anything you couldn't check (for example "needs Spotify Premium to
  exercise")

Don't fix the findings and don't merge. The author handles fixes, and
the owner merges.
