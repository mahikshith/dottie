# Device Test 12 — mood map, and symptoms that finally reach the prediction

---

## 1. The question you asked: are symptom inputs used in predictions?

**Before this round: no.** I checked rather than guessed, and the answer had a
sharp edge to it.

`PredictionInput` has had a `premenstrualSymptomsDetected` flag since the
predictor was written, and the predictor genuinely acts on it — it narrows the
window by a day and lifts confidence, on the reasoning that a period which is
both imminent *and* signalled is more predictable:

```ts
if (input.premenstrualSymptomsDetected) {
  windowInflation -= 1;
  confidenceReduction -= 0.05;
  factorsUsed.push('pms_detected_narrow');
}
```

**Nothing ever set it.** `useCycleStore.recomputePrediction()` built its input
with cycle history, health profile, last period, stress and sleep — and stopped.
Every symptom logged (nausea, headache, cramps, bloating…) went into
`symptom_logs` and was never read back for anything the user could see.

Two more gaps found in the same place:

- `recentWeightChangeKg` — also a live predictor parameter, also never set.
  Still unwired; it needs a weight history the app doesn't collect yet, so
  wiring it would mean inventing the input. Left alone deliberately.
- `recentStressLevel` / `recentSleepQuality` are documented as "last 7 days
  average" but are read from **today's check-in only**. If you haven't checked
  in today, neither shift applies at all. Not changed this round — it is a real
  behaviour change to the predictor and deserves its own decision.

**Now: yes, for symptoms.** `detectPremenstrualSignal()` reads the last 7 days
of real logs and feeds the flag. It is deliberately conservative — **two
distinct** premenstrual markers, within 3 days, above severity 1. One headache
is not a signal, and a falsely narrowed window is worse than none: it makes the
app confidently wrong.

The simulated-user harness proves the wiring end to end: `pms_detected_narrow`
is absent from `factorsUsed`, two symptoms are logged, and it appears.

## 2. "What your last periods felt like" — on the Cycle tab

Symptoms are now aligned to the **day of the period** they fell in, so the app
can say: *"On day 2 you've logged nausea in 2 of your last 3 periods. It may
show up again — worth having what helps within reach."*

**One thing I did not build, on purpose.** You asked for lines like *"previously
people felt nauseous on this particular day"*. Dottie has no cohort — it is
local-first, nothing leaves the phone, there is no population to aggregate. A
number like "68% of people report nausea on day 2" would be invented, and this
app already had to strip exactly that once (the "You & 12,363 others" counters
in DT6). So every claim is about **your own logged history, with the sample size
attached**, which is checkable and gets stronger the longer you use the app.

The harness enforces this rather than trusting review: `test:recall` asserts no
line matches population language (`%`, "most people", "users", "average
woman"), no line is diagnostic, every day-line states `N of your last M`, and
every claim is hedged.

It also stays **silent on a single occurrence**. One nausea log is a
coincidence; presenting it as a forecast is how an app loses trust. Only things
that repeated get a line.

## 3. The mood map

A contribution-graph-style grid of the last 91 days under the Home hero, with a
distribution bar beneath it.

### Two design calls worth explaining

**It is not green tints.** GitHub's heatmap is *sequential* — one hue, light to
dark — which is right for commits, because commits are pure magnitude: more is
more, and zero is the bottom of the same scale. Mood is not magnitude. A 1 is
not "less mood" than a 5, it is the opposite **end** of a scale with a neutral
middle. That makes it **diverging**: two hues, neutral grey midpoint, one arm
each way. One hue would say "a rough day is an empty day" — wrong, and in a
period app, unkind. The hues follow the app's existing care rule: a rough day
gets the **warm** Ember tones, never something dark or drained.

**Emoji are in the legend, not the grid.** You asked for emoji instead of
colour. At the size a 90-day grid forces — 10–12px a cell — an emoji is an
unreadable smudge, and five different smudges are indistinguishable at a glance,
which is the one job a heatmap has. So the grid uses colour and the emoji appear
in the legend and the distribution bar, where each has room to be read.

### The colour was computed, not eyeballed

Validated against the aurora ground with the dataviz validator's **ordinal**
checks (the categorical ones fail a correct ramp by design). Each arm is
monotone in lightness, every adjacent step clears ΔL ≥ 0.06, each arm's coloured
steps are a single hue, and every step clears 3:1 against the surface —
midpoint 3.6:1, poles 8.6:1 and 12.6:1. Don't hand-tweak without re-running it.

### The two invariants the harness protects

- **A gap is not a zero.** "You didn't log" must never be painted as "you felt
  neutral" — collapsing those turns absence into data. The empty tone is
  distinct from every mood step.
- **The distribution divides by LOGGED days, not calendar days.** Dividing by
  the window would make the bar shrink whenever you took a week off, which
  reads as being told off for a gap.

Thin data says so: under 5 days it prints "too few to call it a pattern, but
it's a start" rather than a percentage.

## 4. Still open / not done

- `recentWeightChangeKg` stays unwired (no weight history collected).
- Stress/sleep still read today's check-in only, not a 7-day average.
- Everything visual needs the phone: grid density at 91 days on a real screen,
  whether the distribution bar's small segments are legible, and whether the
  recall card earns its space on the Cycle tab.
