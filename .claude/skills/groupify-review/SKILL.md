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
   diff?

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

## 4. Post one review
Use `mcp__github__create_pull_request_review`:
- `owner: "gebrielmolla19"`, `repo: "Groupify"`, `pull_number: <n>`
- `event: "COMMENT"`. GitHub rejects `APPROVE` and `REQUEST_CHANGES`
  from the PR author's account, and all PRs here are under the owner's
  account.
- `commit_id`: the head SHA (`headRefOid`).
- `comments`: one inline comment per finding (`path`, plus `line` in the
  new version of the file). Start each with `🔴 Blocking:` or
  `🟡 Suggestion:`, then give what's wrong, the concrete failure case,
  and the suggested fix.
  - Inline comments must land on lines inside the diff. **Every blocking
    finding must be inline,** because only inline comments create
    threads, and only threads block the merge (`main` requires
    conversation resolution).
  - If a blocking finding is about unchanged code, anchor it on the
    nearest changed line in the same file (or the PR's first changed
    line), and name the real location in the comment.
  - Suggestions about unchanged code can go in the body.
- `body`: starts **"Claude review — ✅ No blocking issues"** or
  **"Claude review — 🔴 N blocking issue(s)"**, then says in one or two
  lines what you checked, and lists any suggestions that aren't inline.
- With no findings, still post the review: the ✅ body and no comments.

## 5. Return a summary
End with a short report for whoever launched you:
- The verdict, and a link to the review (`html_url` from the response)
- Each finding: severity, `path:line`, a one-line description
- Anything you couldn't check (for example "needs Spotify Premium to
  exercise")

Don't fix the findings and don't merge. The author handles fixes, and
the owner merges.
