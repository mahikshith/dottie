---
name: dottie-device-round
description: Turn an owner device-test report (screenshots plus "this is broken") into shipped fixes for Dottie — how to triage the findings, root-cause instead of guess, batch the changes, and land them without burning a 25-minute APK. Use when the owner reports bugs from the installed app or sends device screenshots.
---

# Handling a device round

The owner installs each APK by hand and reports what is wrong, usually with
screenshots. That report is the highest-value input this project gets — and a
wrong fix costs a full round.

## Order of work

1. **Read `docs/HANDOFF.md` §1 first.** It is the open list; several findings
   are usually already known.
2. **Number every finding** (`DT26-3`) and restate it in the owner's words.
   Their phrasing carries the symptom — "it may open, it may not" was a 40pt
   row with an 18pt caret, not a flaky handler.
3. **Root-cause before touching anything.** The real cause has been non-obvious
   almost every time:
   - the period-log freeze was `addDay` being the identity east of Greenwich;
   - "limbs never move" was Reanimated driving a prop `<G>` does not apply;
   - the stuck quiz spinner was a hydration failure hidden behind a
     `if (__DEV__) console.warn`;
   - "one tap locked the whole week" was two cells at ΔE 0.
   If you cannot name the mechanism, you are guessing.
4. **Reproduce in a harness, not in your head.** `scripts/` drives the real
   stores, repositories and engines on a Node shim — `test:app:tz` runs a whole
   simulated user in five timezones. A finding you can reproduce there is a
   finding you can prove you fixed.
5. **Make the fix provable.** Add or extend the harness that would have caught
   it. Every audit in this repo exists because something shipped that shouldn't
   have.
6. **Ship small batches.** DT8–DT14 went to a device together and white-screened.
7. `npm run test:all`, commit with the Claude trailer, push to `gemini-v2`
   (= a ~25-minute APK), and write the verify list into `docs/HANDOFF.md` §1 so
   the owner knows exactly what to look at.

## Reporting back

Say what was wrong, what the mechanism was, and what now prevents it — in that
order. Name anything you could NOT fix and why, rather than leaving it silent.
If a finding is a design decision rather than a bug, say so plainly and give
the owner the call; do not quietly reinterpret the request.
