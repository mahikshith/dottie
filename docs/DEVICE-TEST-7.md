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

## 8. STILL OPEN — the period-log freeze

**Reported again:** "THE ISSUE STILL PERSISTS ABOUT THE SCREEN FREEZE WHEN
LOGGING THE PERIOD FOR A SECOND DATE ONWARD, WHICH IS STILL A VERY HUGE PROBLEM."

Two diagnoses have now been wrong:

1. **DT6 #1** — a dropped Reanimated `runOnJS` teardown callback. Wrong: a
   wedged JS thread would defeat that fix too. (Fix kept anyway; it is correct
   defensive code.)
2. **DT6 #2** — `experimentalBlurMethod="dimezisBlurView"` snapshotting a heavy
   view tree → ANR. Plausible, removed, **and the freeze survived it**.

**Do not guess a third time.** The diagnostic logger shipped in `2dc4ae8` exists
precisely for this. Ask the owner to:

> Profile → Diagnostics → **Clear**, reproduce the freeze (log a period on a
> second date), force-close, reopen, then **Share** the log.

The logger writes through to MMKV on every event, so the trail survives a
force-close, and `startFreezeDetector()` (1s heartbeat, `FREEZE_THRESHOLD_MS
2500`) stamps the gap. The last `daySheet:*` / `calendar:logPeriod` bracket
before the gap names the culprit. `openSession`/`closeSession` will confirm the
unclean exit.
