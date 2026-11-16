# Decision records

One short file per decision that is all three of: hard to reverse,
surprising without the reason, and the result of a real trade-off.
Anything less belongs in a code comment or `CONTRIBUTING.md`.

Name files `NNNN-short-slug.md`, numbered in order. A record can be a
single paragraph: what was decided and why. Add "Consequences" only when
they aren't obvious. When a decision is reversed, write a new record and
mark the old one as superseded at the top; don't edit history.

Playback decisions (never fall back to another device, no transfer on
page load, the Web Playback SDK on phones) are recorded with their
reasons in the `groupify-playback` skill and `CONTRIBUTING.md` §2.2 and
§2.5, and aren't repeated here.
