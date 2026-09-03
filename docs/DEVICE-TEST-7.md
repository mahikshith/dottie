# Device Test 7 — findings + what was done

**Round:** owner tested the DT6 build on a Nothing Phone (Android) and sent 10
screenshots. This file is the *actionable* record: one section per reported bug,
each with the root cause and the fix. Superseded rounds live in `DEVICE-TEST-6.md`.

---

## 1. Companions were always happy (P0 — fixed)

**Reported:** "the animations shows only one icon it is always happy when I
tested them out", "for every exercise the companions showing the same
expression".

**Root cause — mine, not the art's.** `CompanionLottie` mapped *every* emotional
state onto the same Lottie file via `allStates(asset)`, varying only playback
tempo. A Noto animation is one fixed happy performance; tempo cannot carry an
emotion, so sad / proud / celebrate all rendered as the same grin.

**Fix:** expressive states now route to the **vector rig** (`CompanionCreature`,
SVG body + real eyes/brows/mouth driven by `expressionFor(state, intensity)`).
Lottie is used only for neutral idle, where a happy loop is correct.

```
EXPRESSIVE = state !== 'idle'  →  render CompanionCreature
```

## 2. Confetti drawn over the companion's face (P1 — fixed)

The "moment" animation (party/mindblown/sparkles) was played at full character
size on top of the character. It is now a **corner badge** at `size * 0.42`,
anchored top-right, `pointerEvents="none"`.

## 3. Status bar ate the top heading; bottom options unreachable (P0 — fixed)

**Reported:** "you brought the screen section so down it actually started eating
the top heading and this true for all the screens except home screen … the down
screen change effect is not letting the user to see the below options … the top
and bottom parts of the ui are both cut off for multiple screens … 1/3 is being
cut off below."

**Two separate causes:**

1. **Top.** The DT6 status cap was an **opaque rectangle** over `insets.top`.
   It stopped headings colliding with the clock, but it also painted a hard
   ground-coloured band with a visible seam right above the title.
   → It is now a **gradient veil**: solid over the true inset, fading out over
   `STATUS_FADE = 14px` below it (`AuroraBackground`). Same protection, no band.

2. **Bottom.** No tab screen had *any* `paddingBottom`. The floating tab pill
   (`BAR_H 64` + 8 float gap + `insets.bottom`) simply covered the last card,
   and the quiz's pinned footer covered the "N of M correct so far" pill.
   → New token `Spacing.tabBarClearance = 96`, applied as
   `insets.bottom + Spacing.tabBarClearance` on home / calendar / learn /
   profile / community / sisterhood circle; quiz and exercise get
   `insets.bottom + footer height`.

## 4. Sisterhood still asked you to type a date (P1 — fixed)

**Reported:** "I believe I told u to remove the sliding calendar for sisterhood
and also entering date during sisterhood. we should let the users use the same
calendar as original cycle."

The wizard still had a free-text `YYYY-MM-DD` field — the worst input in the
app: no validation, no hint what a valid string looked like, and a second date
UI to learn when the Cycle tab already has one. **Removed.** In its place a
signpost explaining that a sister's days are logged on the *main* calendar (tap
a day → choose who it's for; their days render in gold). The seed-period write
that used the typed value is gone with it.

**Age validation** added in the same screen: the field accepted any 3 digits and
`parseAge()` silently discarded out-of-range values, so "644" sat there looking
accepted. Bounds are now `MIN_AGE 8` / `MAX_AGE 60`, with an inline error.

## 5. "THE CALENDAR IS TRANSPARENT AGAIN" (P0 — fixed)

Removing the Android blur (the DT6 ANR fix) left `DayDetailSheet` with only
`palette.glass.bg` — about 8% white — so the calendar grid read straight through
the sheet content. The card is now **opaque `palette.ground` with the glass tint
painted on top of it**, and the backdrop scrim went `0.55 → 0.78`.

## 6. Explanation + graphs did not show after logging (P0 — fixed)

**Reported:** "even after entering the period the explanation is not showing up
and the graphs are not showing up and shows a default message … showing up the
examination on the cycle pane is not consistent … make sure these graph and
scientific explanation are mandatory no matter what and should show up at any
cost."

**Root cause:** the card trusted a single store field, `latestExplanation`. Any
path that left it null — a log that landed on a *sister* rather than the user, a
`refresh()` that hadn't finished when the card mounted, an early return in
`recomputePrediction()` — produced the empty card even though the data to
explain was sitting in the same store.

**Fix:** the card no longer trusts one field. If the store has no explanation
but there is an anchor period date anywhere (`lastPeriodStart`, else the newest
`cycleHistory[].startDate`), it calls the same pure `explainPrediction()` itself
in a `useMemo`. Same numbers, no stale gap. **And the figures are now
unconditional** — the empty state draws them too, from the population shape,
labelled as such.

## 7. Only one graph, and not a useful one (P1 — fixed)

**Reported:** "u are only showing one graph of normal distribution or something
which is not really useful. I believe some of the competitors uses graphs for
explanation right, try learning from them."

Competitor scan (Flo cycle-length variation bars, Clue cycle-history strip,
Natural Cycles deviation band) converges on three figures, each answering a
different question. Dottie now ships all three:

| Question | Figure | File |
| --- | --- | --- |
| When will it start? | log-normal posterior density + quoted ± window | `PredictionDistributionChart` |
| Am I regular? | my own cycle lengths as dots, mean line, **±1 SD band** | `CycleLengthHistoryChart` |
| Which days will be bad? | predicted heaviness per period day | `FlowShapeChart` |

The middle one is the one that makes "standard deviation" mean something: the
band *is* the SD, drawn around the user's own dots.

All the numbers come from a pure engine module, `src/engine/prediction/chart-data.ts`
(`buildCycleLengthSeries`, `buildFlowShape`), tested by `npm run test:charts` —
12 scenarios covering hand-computed mean/SD, chronological ordering, noise
rejection, the domain always containing the band it must draw, monotone
heaviness, own-flow scaling, and a tone check banning
"abnormal/irregular/disorder". A chart cannot be eyeballed for correctness: a
wrong SD still draws a plausible band, which is why these are asserted.

---

## 8. THE PERIOD-LOG FREEZE — found, and it was a date bug

**Reported again:** "THE ISSUE STILL PERSISTS ABOUT THE SCREEN FREEZE WHEN
LOGGING THE PERIOD FOR A SECOND DATE ONWARD."

The owner sent a diagnostic log. It ended the guessing.

### What the log showed

Three freezes, all with the same shape — and the shape is the whole answer:

```
23:59:37.287  daySheet:open date=<date>
23:59:38.287  tap  Mark as period
23:59:38.289  logPeriodDay:start forSister=false
              << nothing, ever again — force-close >>
```

`logPeriodDay:start` is logged, and `store.logPeriodDay ms=…` — the very next
line on all 40+ successful logs in the same file — never arrives. So the app is
wedged **inside the store call**, not in the sheet, not in the animation, not in
a blur. Two further facts narrow it to a spin rather than slow I/O:

- The 1-second heartbeat **never logged a stall** for these. It logged two
  (2827ms, 2622ms) for the Android share sheet, so the detector works. It
  reports a gap when the next tick runs; here no tick ever ran again.
- Every restart after one of these logs `previous session ended WITHOUT a clean
  exit`.

A JS thread that never ticks again is an infinite loop, not a slow query.

### The cause

`cycle.repo.ts` walked forward through the days of the previous period:

```ts
let cursor = priorStart;
while (true) {
  const nextDay = addDay(cursor);
  if (priorDates.has(nextDay)) { priorEnd = nextDay; cursor = nextDay; }
  else break;
}
```

and `addDay` was:

```ts
const d = new Date(`${date}T00:00:00`);  // parsed as LOCAL midnight
d.setDate(d.getDate() + 1);
return d.toISOString().split('T')[0];    // serialised as UTC
```

Local in, UTC out. East of Greenwich, local midnight is still the *previous* day
in UTC, so the +1 day and the −offset cancel:

```
TZ=UTC               addDay('2026-09-01') -> '2026-09-02'   ✅
TZ=America/New_York  addDay('2026-09-01') -> '2026-09-02'   ✅
TZ=Europe/London     addDay('2026-09-01') -> '2026-09-01'   ❌ (BST)
TZ=Asia/Kolkata      addDay('2026-09-01') -> '2026-09-01'   ❌ the owner's phone
```

**`addDay` is the identity function on the owner's device.** `cursor` came out
of `priorDates`, so `priorDates.has(addDay(cursor))` is permanently true, and
`while (true)` never exits. The thread spins until the process is killed.

This is exactly "second date onward": `detectAndSaveCycleRecord` returns early
when there is no earlier period day, so the *first* day ever logged is safe.
Logging a day **earlier** than everything already logged is also safe (the
`date < newPeriodStart` query comes back empty) — which is why the owner got a
run of successful logs before one hung. The first day logged *after* an existing
one enters the walk, and hangs.

### Why no test caught it

CI and every harness run at **UTC+0, where the broken helper is accidentally
correct.** The bug was invisible to a test suite that only ever ran in one
timezone.

### The fix

1. **One shared, UTC-only date module** — `src/utils/civil-date.ts`. It never
   constructs a local `Date`: parsing, arithmetic and formatting all go through
   UTC, so the result depends only on the input string. Six files had each grown
   their own copy of this helper and **every copy had the bug**; all six now
   import from here (`cycle.repo`, `sisterhood.repo`, `checkin.repo`,
   `engine/content/daily-decode`, `engine/sisterhood`, `usePredictsStore`).
2. **The walk can no longer hang regardless.** It is a bounded `for` over at
   most 30 days, and each step must move *strictly forward* or it stops. A
   future date bug can now only produce a wrong answer, never an unresponsive
   app.
3. **`npm run test:dates`** — a harness that **re-execs itself under 8
   timezones** (Node reads `TZ` at process start, so a child process is the only
   honest way). Verified by reverting `addDays` to the old implementation: the
   harness fails in London, Berlin, Kolkata, Tokyo and Kiritimati, on exactly
   the "a day forward is a DIFFERENT, later day" and "5-day block ends on day 5"
   assertions, and passes everywhere on the fix.

### The same bug's second victim

`getLastPeriodStart()` asks "is the previous calendar day also a period day?".
With `subtractDay` returning **d−2** east of Greenwich, it compared against the
wrong day and returned the wrong period start — which is where the bogus
**"Day 168 / 0 cycles / still learning"** reading on Home came from. Fixed by
the same change; the harness asserts the scan directly (D7).

### Note on the two earlier diagnoses

Both were wrong, and neither fix is being reverted — the Reanimated teardown
decoupling and the removal of `dimezisBlurView` are correct on their own merits.
But they were guesses at a UI symptom, and the bug was in date arithmetic three
layers down. The logger is what found it; it should be the first move next time,
not the fallback.
