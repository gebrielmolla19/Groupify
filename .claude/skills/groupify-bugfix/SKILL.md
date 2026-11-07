---
name: groupify-bugfix
description: Root-cause-first workflow for fixing a bug in Groupify — reproduce, gather evidence, explain the cause, write a failing regression test, then fix. Use when the user reports something broken, stuck, crashing, erroring, or "not working" (e.g. playback stops, next/prev fails, UI freezes, 4xx/5xx responses).
---

# Fixing a Groupify bug

Don't change code until you can explain **why** the bug happens. A
symptom patch is allowed only as a labelled stop-gap, with an issue open
for the real fix.

## 1. Reproduce
- Write down the exact steps, the environment (device, browser, desktop
  or phone, in-browser player or Spotify app, Premium?) and expected vs
  actual behavior.
- If you can't reproduce it, gather evidence (step 2) before guessing.
- **If the bug has a visible symptom, capture the "before" now**, while
  it still happens: a screenshot or recording of the broken UI, or the
  failing request and log lines.
  Once it's fixed you can't get it back. See "Evidence" in the
  `groupify-pr` skill for how to capture and save it.

## 2. Gather evidence
- **Backend logs:** `Groupify-backend/logs/combined-<date>.log` and
  `error-<date>.log` (JSON lines). Match timestamps against the user's
  report.
- **Browser:** console errors and network responses (status and body).
  Use the browser pane's console and network tools.
- **Data:** inspect the relevant MongoDB documents read-only if it's a
  data bug. Never change production data without asking.
- **The user's screenshots and logs count as evidence.** Quote the
  exact lines that matter, for example "same device id: 200 at 07:44:55,
  then 404 at 07:45:06".

## 3. Find the root cause
- Trace the failing path through the code: route → controller → service
  → external API, or component → hook → `api.ts`.
- **External API involved (Spotify)?** Check the official docs before
  concluding anything about platform limits. See the `groupify-playback`
  skill. A wrong assumption about the docs nearly sent this project down
  a days-long detour.
- Look for the usual suspects in this codebase: silent fallbacks to a
  different target, swallowed errors, state that isn't reset on failure,
  duplicate toasts, missing event handlers, races between polling and
  events.
- **Tell the user the root cause in plain language** before fixing it.
  If the fix changes product behavior (not only code), confirm it with
  them first.

## 4. Write a failing test
- Backend: Jest in `Groupify-backend/tests/`, mocking `axios` for
  Spotify calls.
- Frontend: Vitest with Testing Library, next to the file
  (`*.test.ts(x)`).
- The test must fail on the current code for the right reason. Run it
  and see it fail.
- If a test really isn't feasible (for example it needs real Spotify
  audio), write down the manual reproduction steps in the PR instead,
  and say why there's no test.

## 5. Fix
- Make the smallest change that removes the cause. Look for the same
  pattern elsewhere (`grep`) and either fix it too or open an issue.
- Fail clearly: when the intended action can't happen, show the user one
  clear message and leave the UI in a correct state.

## 6. Verify and ship
- The regression test passes. Run the `groupify-verify` skill.
- Then the `groupify-pr` skill. The PR explains **root cause → fix →
  evidence it's fixed** (the regression test, plus a before/after in
  its Evidence section when the symptom was visible), and lists anything that needs the user (for
  example "retest on a phone with Premium").
