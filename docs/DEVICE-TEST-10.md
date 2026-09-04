# Device Test 10 — un-marking, the decoy exit, and thumb reach

Three reports from the owner. All fixed.

---

## 1. There was no way to un-mark a period day (P0)

**Reported:** "users were not able to unlock the period on the calendar … they
can click on any date and lock the period … the problem is unlocking. There is
no option."

**Confirmed, and it was total.** `grep` for any un-log path across the whole
codebase returned nothing: the repository only ever set `is_period_day = 1`, and
the sheet's button went `disabled` the instant a day was logged. A mis-tap was
permanent — and in a cycle tracker a wrong date is not cosmetic, it shifts every
prediction after it, forever, with no way for the user to correct it.

**Worth owning:** the simulated-user harness from device-test-9 did not catch
this, because every step in it *added* data. Adding without removing is half a
test. That gap is now closed with six steps covering removal, including the
edge cases below.

**The fix, end to end:**

- `cycleRepository.unlogPeriodDay()` — clears the flag and the flow level but
  **keeps the row**, because the day may still carry phase context the calendar
  draws. Rejects malformed dates like every other write.
- **Cycle records are rebuilt, not patched.** Removing a day can split a block,
  shorten a period, or destroy a cycle boundary. Working out which stored record
  each of those invalidates is exactly the sort of reasoning that goes quietly
  wrong, so `rebuildCycleRecords()` recomputes them all from the entries.
  Derived data should be derivable; this is also self-healing for any drift.
- `useCycleStore.unlogPeriodDay()` — same full reload as logging (last period
  start, cycle count, history, prediction can all change).
- `sisterhoodRepository.unlogShadowPeriodDay()` + store action. A mis-tap is
  *more* likely when logging for someone else, because you're entering days from
  memory rather than from your own body.
- **The sheet button is a toggle.** Tapping a logged day un-marks it, and the
  row says "Tap again to remove" so it doesn't read as a dead "logged ✓" badge.

**New harness coverage:** un-mark; un-mark twice (idempotent); re-mark after
un-marking; un-mark a block start and confirm the records rebuild rather than
keeping a stale one; un-mark the only period and land in an honest empty state
instead of crashing on a prediction with no data; un-mark a malformed date and
get a throw rather than a silent no-op; and the sister equivalent.

## 2. No way to learn how to leave the decoy screen (P1)

**Reported:** "you should show the user somewhere under the You section so they
understand how to come back from the decoy."

**One correction to the report:** it is a **triple**-tap, not a double, and it
has to land on the "Refresh garden" link at the bottom of the journal (within a
two-second window). The hardware back button also works. Writing "double tap
anywhere at the bottom" into the UI would have left the owner stuck.

An escape hatch nobody can find is not an escape hatch. The decoy hides its exit
**on purpose** — a visible "back to Dottie" button would tell a snooper the
journal is a front — but that same secrecy left the owner with no way to learn
the gesture. So it is now written down in the one place you go deliberately and
a casual snooper won't: **You → Ghost Mode**, under *"Getting back from the
journal"*.

It is also shown as a dialog at the moment it starts to matter — when you switch
on "Wrong PIN → plant journal", which is the setting that makes a mistyped PIN
drop you into the decoy silently.

## 3. The exercise action was out of thumb reach (P1)

**Reported:** "the moving forward option is at the very top. We need to bring it
down where the user's thumb is … applicable only for the inside quiz section."

The quiz screen got a pinned footer back in device-test-6; the **exercise
player** inside a lesson never did. Its Check/Continue button sat at the end of
the scrolled content, so its position depended on the length of the question:
halfway up the screen on a short exercise, below the fold on a long one. Either
way the thumb had to go hunting, on the one control you press over and over.

**Fixed.** `ExercisePlayer` now owns a fixed frame: the question, answer body
and feedback scroll; the action is pinned above the gesture bar and never moves.

**Left alone deliberately:** the lesson reading screen's "Mark as Complete"
stays at the end of the text. You press it once, at the end, and pinning a
button over a page of prose would cover the thing you opened the screen to read.
It did get proper bottom-inset padding.

---

## 4. Still needs the phone

Everything here is logic and layout changes verified by `npm run test:all`
(15 suites, 49-step simulated user in 5 timezones). Whether the toggle *feels*
right, whether the pinned action lands where the thumb actually rests, and
whether the Ghost Mode copy reads clearly — those need the owner.
