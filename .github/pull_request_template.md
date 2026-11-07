<!-- See CONTRIBUTING.md. Delete sections that don't apply. -->

Fixes #

<!-- If this is stacked on another unmerged PR: "Stacked on #N — merge that first." -->

## What & why
<!-- What changes, and why. For bugs: the root cause, not just the symptom. -->

## How it was verified
<!-- Paste real results. Never tick a box you didn't run. -->
- [ ] Backend: `npm run lint -- --quiet && npm test`
- [ ] Frontend: `npm run lint -- --quiet && npm run test:run && npm run build`
- [ ] Regression test added (bug fixes)
- [ ] Manually tested in the app, including at 375 px for UI changes
- [ ] Playback checklist (CONTRIBUTING.md §4), if this touches the player, auth or the API client

## Not verified
<!-- Anything you couldn't check (e.g. "needs Premium on a phone"). Leave as unchecked boxes. -->

## Risk & rollback
<!-- What could break, who notices, and how to undo it (usually: revert this PR). Mention env vars, migrations, or OAuth scope changes. -->

## Evidence
<!-- Only when someone could see the difference: UI, an interaction, or a bug a user hit. Delete this section for
     docs, refactors, tests, dependencies, CI, or backend internals already covered by tests. See the groupify-pr skill, "Evidence".
     UI: before / after screenshots, desktop and 375 px. A GIF or video for flows (playback, drag, toasts).
     Backend bug with a visible symptom: before / after output in code blocks (curl response, log lines, the regression test failing then passing).
     Couldn't capture it? Say why here and add it to "Not verified".
     Images go in the table. Text output can't go in a table cell: use "**Before**" / "**After**" headings, each followed by a code block, and delete the table. -->

| Before | After |
|---|---|
|  |  |
