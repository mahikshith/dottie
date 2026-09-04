# Dottie — The Prediction Engine

**Internal reference. Not user-facing.**
Written 2026-09-04 against commit `62a1728` on `gemini-v2`.

Every number in this document was either read directly out of the source or
measured by running the real engine over synthetic cohorts. Nothing here is
estimated from memory. Where the engine has a weakness I have said so plainly —
that is the point of an internal reference.

---

## 1. The one-paragraph version

Dottie predicts your next period date with a **Bayesian Normal-Inverse-Gamma
conjugate model on the logarithm of cycle length**. It starts from a population
prior shaped by your age and conditions, updates that prior with your own logged
cycles (recent ones weighted more heavily), and reads the next cycle length off
the resulting posterior predictive distribution — a Student-t in log space,
which is a right-skewed log-Student-t in days. The point estimate is the
**median**, the ± window is derived from the predictive spread, and the
confidence number is a separate heuristic layered on top. It runs entirely
on-device in closed form: no ML runtime, no server, no network.

---

## 2. Where the code lives

| File | Lines | Status | What it does |
|---|---|---|---|
| `src/engine/prediction/bayesian-predictor.ts` | 249 | **live** | The model. Prior construction + conjugate update + posterior predictive. |
| `src/engine/prediction/predictor.ts` | 276 | **live** | Domain layer. Lifestyle shifts, condition adjustments, window, confidence, labels. |
| `src/engine/prediction/phase-calculator.ts` | 155 | **live** | Which phase you're in today, day-in-cycle. |
| `src/engine/prediction/explain-prediction.ts` | 451 | **live** | Turns the output into the explainer card's copy and figures. |
| `src/engine/prediction/chart-data.ts` | 219 | **live** | The three graphs. |
| `src/engine/prediction/confidence.ts` | 364 | **DEAD** | A whole 5-factor weighted confidence scorer. **Nothing imports it.** See §9. |
| `src/engine/prediction/health-adjustments.ts` | 383 | **DEAD** | **Nothing imports it.** See §9. |

Entry point: `useCycleStore.recomputePrediction()`, which re-runs after every
period log, un-log, and check-in save.

---

## 3. The model, precisely

### 3.1 Why log space

Cycle lengths are **right-skewed**. They stretch to 60+ days (anovulatory
cycles, PCOS) but essentially never fall below ~21. A symmetric Normal on raw
days is therefore wrong in two ways at once: it over-predicts the centre for
irregular bodies, and it produces a symmetric window when the real risk is
almost entirely on the late side.

So the model treats `y = log(x)` as Normal, i.e. cycle length is **log-normal**.
Same closed-form conjugate maths, but the point estimate becomes the
skew-robust median and the day-space interval widens on the late side for free.

### 3.2 The prior (the "pretrained" part)

`buildPopulationPrior()` — this is what makes a day-one prediction possible.

```
μ | σ²  ~  Normal(μ₀, σ²/κ₀)
σ²      ~  InverseGamma(α₀, β₀)
```

Constants, from `bayesian-predictor.ts`:

| Constant | Value | Why |
|---|---|---|
| `POPULATION_MEAN` | 29 days | Modern population median. The classic "28" is a simplification. Used only when the user reports nothing. |
| `BASE_POPULATION_SD` | 3.0 days | Regular adult. |
| `PRIOR_KAPPA` (κ₀) | 2.5 | Prior worth 2.5 "virtual cycles". Low enough that a handful of real cycles takes over. |
| `PRIOR_ALPHA` (α₀) | 2 | Weakly informative. Predictive df starts at 4 → finite variance, heavy tails. |
| `RECENCY_GAMMA` (γ) | 0.9 | Exponential discount on older cycles. |
| `MIN/MAX_PLAUSIBLE_CYCLE` | 15 / 90 days | Anything outside is treated as a typo and dropped before it reaches the model. |

The population SD is widened before anything else happens:

| Condition | SD added |
|---|---|
| PCOS | +3.0 days |
| Thyroid | +1.5 days |
| Age < 16 | +2.0 days |
| Age > 40 | +2.5 days |

These stack. A 14-year-old with PCOS starts at SD 3.0 + 3.0 + 2.0 = **8.0 days**.

The reported average cycle length is clamped to **[21, 45]** and becomes `μ₀` in
log space. The day-space SD is converted via the coefficient of variation:
`Var[log x] = log(1 + CV²)`, and `β₀ = Var[log x] · (α₀ − 1)`.

### 3.3 The update

`posteriorPredictiveCycleLength()`. Standard NIG conjugacy, with `n` replaced by
a **recency-weighted effective n**: cycle *i* (0 = most recent) gets weight
`0.9ⁱ`. Effective sample size therefore saturates around `1/(1−γ) = 10`, which
is a deliberate cap on overconfidence — twelve logged cycles is worth about
7.2 effective observations, not 12.

```
κₙ = κ₀ + n_eff
μₙ = (κ₀·μ₀ + n_eff·ȳ) / κₙ
αₙ = α₀ + n_eff/2
βₙ = β₀ + ½·Σwᵢ(yᵢ−ȳ)² + κ₀·n_eff·(ȳ−μ₀)² / (2κₙ)
```

### 3.4 The predictive

In log space: `t(ν = 2αₙ, loc = μₙ, scale² = βₙ(κₙ+1)/(αₙκₙ))`.

Back in days:
- **Point estimate** = `exp(μₙ)` — the **median**, not the mean.
- **`std`** = `median · √(exp(σ²_log) − 1)` — the day-space SD of that log-normal,
  floored at 0.5 days so the window can never collapse to nothing.

**This is worth internalising:** the number the app shows you is the *median*
cycle length. For a right-skewed body the median sits below the mean, so the
prediction is systematically a little **early** relative to the average. That is
a defensible choice for a period predictor — being prepared early beats being
surprised late — but it is a choice, and it shows up in the measured bias in §7.

---

## 4. What the engine is actually given

### 4.1 Inputs that reach the model and change the answer

| Input | Where it comes from | Effect |
|---|---|---|
| `cycleHistory[].cycleLength` | Derived from logged period days (`rebuildCycleRecords`) | **The dominant input.** Drives μₙ, the spread, and the effective n. |
| `lastPeriodStart` | Most recent period-block start | The anchor. Predicted date = anchor + predicted length. |
| `healthProfile.averageCycleLength` | Onboarding → Cycle setup | Sets μ₀. **Matters enormously before there is history** — see §7.3. |
| `healthProfile.age` | Onboarding | Widens the prior SD below 16 / above 40; reduces confidence at both ends. |
| `healthProfile.conditions` | Onboarding → Conditions | PCOS and thyroid widen the prior SD; PCOS also inflates the window and cuts confidence. |
| `healthProfile.averagePeriodLength` | Onboarding | Not used for the *date*. Used for phase boundaries and for the explainer's "how long / heaviest days". |
| `recentStressLevel` | Today's check-in | If ≥ 4: **+1.5 days** to the predicted length. |
| `recentSleepQuality` | Today's check-in | If ≤ 2: **+1.0 day**. |
| `premenstrualSymptomsDetected` | Derived from the last 7 days of symptom logs | Narrows the window by 1 day, lifts confidence by 0.05. Wired in DT12 — before that it was dead. |

The premenstrual detector (`detectPremenstrualSignal`) is deliberately
conservative: it needs **at least two distinct** premenstrual markers, within
the last few days, at severity ≥ 2. One headache is not a signal. A falsely
narrowed window is worse than none, because it makes the app confidently wrong.

### 4.2 Inputs the app collects but the prediction ignores

This is the part you asked for specifically. All of these are stored, and most
are shown back to the user somewhere, but **none of them move the predicted
date**:

| Collected | Where | Why it doesn't reach the model |
|---|---|---|
| **Mood score** (1–5) | Daily check-in | Never passed to `PredictionInput`. Feeds the mood map, the aurora palette, and the export only. |
| **Energy level** (1–5) | Daily check-in | Never passed. Feeds day-suggestions only. |
| **Symptom severity** | Symptom logging | Only the *presence* of ≥2 distinct PMS markers is used, as a boolean. Severity itself, and every non-PMS symptom, is ignored by the predictor. |
| **Flow level** (0–5) | Period logging | Not used for the date. Feeds the flow-shape chart and `averageFlow` on the cycle record. |
| **Weight (kg)** | Onboarding | `recentWeightChangeKg` is a *live parameter of the predictor* — ±5 kg would inflate the window and cut confidence — but **nothing ever computes it**, because no weight history is collected. Only one snapshot exists. **This is a dead parameter.** |
| **Height (cm)** | Onboarding | Collected, stored, used nowhere at all. |
| **Activity level** | Onboarding | Collected, stored, not used by the predictor. |
| **`onMedications`** | Onboarding | Collected, not used by the predictor. |
| **Medications list** | Profile → Medications | Reminders only. |
| **`predictionErrors[]`** | Recorded on every period log | Passed into `PredictionInput` and **explicitly ignored** — the comment says the posterior self-corrects. It is stored and displayed but has no effect on the output. |
| **Period length** | Derived from logged days | Affects phase boundaries and the explainer, not the date. |
| **Cramp-freeze usage, notes, quiz results, lesson progress** | Various | Never near the predictor. |

There is also a **documentation-vs-code gap** worth knowing about: the
`PredictionInput` type says `recentStressLevel` and `recentSleepQuality` are the
"last 7 days average". They are not. `useCycleStore` passes
`todayCheckIn?.stressLevel` — **today's single check-in**, or `undefined` if the
user hasn't checked in today. So the stress/sleep shift fires on one data point,
or not at all.

---

## 5. What happens after the model — the domain layer

`predictNextPeriod()`, in order:

1. Build the prior, run the posterior. → `posterior.mean` (median days),
   `posterior.std`, `posterior.df`, `posterior.effectiveN`.
2. **Lifestyle mean-shift**: `+1.5` if stress ≥ 4, `+1.0` if sleep ≤ 2. Additive,
   uncapped, applied to the median before rounding.
3. **Condition adjustments** to the window and confidence:

| Trigger | Window | Confidence |
|---|---|---|
| PCOS | +1 day | −0.08 |
| Thyroid | — | −0.04 |
| Age < 16 | — | −0.05 |
| Age > 40 | — | −0.05 |
| \|weight change\| > 5 kg | +1 day | −0.06 | *(dead — never fires)* |
| PMS detected | **−1 day** | **+0.05** |

4. `predictedCycleLength = round(posterior.mean + meanShift)`;
   `predictedDate = lastPeriodStart + predictedCycleLength`.
5. **Window**: `round(posterior.std × 1.15) + inflation`, then **clamped to
   [1, 8] days**. The clamp is important — see §7.2.
6. **Confidence**, three stages:
   ```
   base       = spreadToConfidence(std)     // step function, below
   dataQuality= min(1, effectiveN / 6)
   confidence = base × (0.55 + 0.45 × dataQuality) − reductions
   confidence = clamp(confidence, 0.25, 0.95)
   ```
   `spreadToConfidence`: SD ≤ 1.5 → 0.92 · ≤ 2.5 → 0.82 · ≤ 3.5 → 0.72 ·
   ≤ 5 → 0.60 · else 0.48.

7. Labels: `high` ≥ 0.80 · `good` ≥ 0.65 · `moderate` ≥ 0.50 · else `learning`.
   `predictionPhase` is purely a data-maturity badge: 1 if < 2 cycles, 2 if < 6,
   else 3.

**Ovulation** = predicted date − 14 days, flat. The luteal phase is the more
stable half of the cycle, which is why counting back is the standard estimate,
but it is a constant here — no LH, no temperature, no per-user luteal estimate.
The fertile window drawn on the calendar is that day −5 / +1 (see
`src/engine/calendar/fertile-window.ts`).

---

## 6. Confidence intervals — what the ± window actually is

**The honest answer: the ± window shown in the app is not a named confidence
interval.** It is `1.15 × SD`, which for a Normal is about a **75% interval**,
and the explainer computes the stated coverage dynamically from the actual ratio
`k = window / SD` rather than hard-coding "75%". Then it is clamped to 8 days,
which breaks the relationship entirely for irregular bodies.

Measured against the real posterior, here is what the window is versus what a
true 80 / 95 / 99% interval would need to be:

| Scenario | Median | Pred. SD | df | eff. n | App window | 80% | 95% | 99% |
|---|---|---|---|---|---|---|---|---|
| No history, default profile | 28.0 | 3.55 | 4.0 | 0.00 | ±4 (conf 33%) | ±5.4 | ±9.9 | **±16.4** |
| 3 regular cycles (28,28,29) | 28.2 | 2.18 | 6.7 | 2.71 | ±3 (conf 62%) | ±3.1 | ±5.3 | ±8.1 |
| 6 regular cycles | 28.2 | 1.82 | 8.7 | 4.69 | ±2 (conf 74%) | ±2.5 | ±4.2 | ±6.1 |
| 12 regular cycles | 28.0 | 1.47 | 11.2 | 7.18 | ±2 (conf 92%) | ±2.1 | ±3.4 | ±4.9 |
| 6 variable cycles (24–35) | 28.8 | 3.95 | 8.7 | 4.69 | ±5 (conf 54%) | ±5.5 | ±9.1 | ±13.2 |
| 6 PCOS cycles (32–55) | 41.1 | 8.02 | 8.7 | 4.69 | **±8** (conf 35%) | ±11.2 | ±18.5 | **±26.9** |

Read the last row carefully. For a PCOS-like history the app shows ±8 days
because that is the clamp. An honest 99% interval would be **±27 days** — which
is to say, for that user the model is telling you it barely knows. The
confidence number (35%) is the part carrying that message; the window is not.

Degrees of freedom are low throughout (4 to ~11), which is why the Student-t
matters: at df = 4 the 99% multiplier is 4.60, not the Normal's 2.58. Using a
Normal here would understate the tails by nearly a factor of two.

---

## 7. How accurate is it, really

I ran the real engine over synthetic cohorts with known generating
distributions — 400 simulated users per cell, deterministic seed. "Error" is
predicted cycle length minus true cycle length; negative bias means the app
predicts **earlier** than the truth.

### 7.1 Accuracy by cohort and history depth

| Cohort | History | MAE (days) | Median AE | Bias | Window | Truth inside window | within ±1 | ±2 | ±3 |
|---|---|---|---|---|---|---|---|---|---|
| Very regular (SD 1.0) | 0 | 0.86 | 1.0 | −0.03 | ±4.0 | 100% | 83% | 97% | 100% |
| Very regular | 6 | 0.88 | 1.0 | +0.04 | ±2.0 | 97% | 83% | 97% | 100% |
| Very regular | 12 | 0.89 | 1.0 | −0.10 | ±2.0 | 98% | 81% | 98% | 100% |
| Typical (SD 2.5) | 0 | 2.31 | 2.0 | −1.15 | ±4.0 | 90% | 40% | 60% | 76% |
| Typical | 6 | 2.20 | 2.0 | −0.53 | ±3.3 | 87% | 39% | 63% | 83% |
| Typical | 12 | 2.15 | 2.0 | −0.32 | ±3.2 | 82% | 42% | 64% | 80% |
| Variable (SD 5) | 0 | 5.01 | 4.0 | −2.31 | ±4.0 | 51% | 16% | 26% | 38% |
| Variable | 6 | 4.08 | 3.0 | −0.72 | ±5.4 | 76% | 23% | 38% | 51% |
| Variable | 12 | 4.01 | 3.0 | −0.42 | ±5.6 | 77% | 23% | 39% | 51% |
| Teen (SD 6) | 0 | 5.46 | 5.0 | −2.18 | ±7.0 | 72% | 17% | 28% | 39% |
| Teen | 12 | 4.70 | 4.0 | −0.93 | ±6.9 | 78% | 19% | 34% | 47% |
| Perimenopause (SD 8) | 0 | 8.10 | 7.0 | −4.81 | ±8.0 | 58% | 12% | 19% | 26% |
| Perimenopause | 12 | 6.71 | 6.0 | −1.88 | ±7.8 | 66% | 16% | 23% | 33% |
| PCOS-like (SD 9) | 0 | 11.50 | 11.0 | −9.93 | ±8.0 | 43% | 8% | 14% | 18% |
| PCOS-like | 12 | 7.32 | 6.0 | −2.88 | ±8.0 | 67% | 14% | 22% | 30% |

**Headline: for a regular or typical user, mean absolute error is roughly
0.9–2.2 days and settles by about six logged cycles.** That is competitive with
what published cycle-tracking accuracy studies report for calendar-based
methods, and it is genuinely all the accuracy that is available from cycle
length alone — the biological floor is the user's own cycle-to-cycle variance.

The engine cannot beat SD. Look at the "Variable (SD 5)" row: MAE 4.0 with 12
cycles of history, against a true SD of 5. The model has essentially converged
on the right distribution; the remaining error *is* the body's variability. More
data will not fix that. Only a measured signal (basal temperature, LH, cervical
fluid) would, and Dottie collects none of those.

### 7.2 The window clamp is the weakest part

Coverage should be roughly constant across cohorts if the window were
calibrated. It is not:

- Very regular: **97–100%** inside the window. Over-wide — the ±2 floor is
  generous for someone with SD 1.
- Typical: **82–90%**. Reasonable.
- Variable: **51–77%**.
- PCOS / perimenopause: **43–67%**, and it barely improves with data because
  the ±8 clamp binds in every single cell.

So the window is too wide for the people who least need it and too narrow for
the people who most do. Raising `windowDays` clamp from 8 to ~14, or scaling
with `posterior.std` without a hard ceiling, would fix the irregular end. The
counter-argument is UI: a ±14-day band shaded on a month grid covers half the
calendar and looks useless. That is a real design tension, not an oversight,
but the current resolution favours the chart over the truth.

### 7.3 Onboarding's reported average matters more than anything else early on

Same PCOS cohort (true mean 38 days), varying only what the user typed during
onboarding:

| Reported average | History | MAE | Bias | Coverage |
|---|---|---|---|---|
| 28 days (default) | 0 | 11.53 | −10.05 | 40% |
| 28 days | 3 | 9.09 | −5.92 | 52% |
| 28 days | 12 | 8.40 | −4.53 | 56% |
| **38 days (accurate)** | 0 | **7.97** | **+0.33** | 60% |
| 38 days | 3 | 7.69 | −0.97 | 61% |
| 38 days | 12 | 7.39 | −0.85 | 65% |

Reporting an accurate average is worth **more than twelve logged cycles**. And
note how long the bad prior persists: with the wrong μ₀ the bias is still −4.5
days after twelve cycles, because κ₀ = 2.5 and the recency discount caps
effective n around 7 — the prior never fully washes out.

**Practical implication:** the cycle-setup screen in onboarding is a
higher-leverage surface than anything in the model. If someone doesn't know
their average and we default them to 28, we have handed them a systematically
early prediction for a year.

### 7.4 Confidence is under-stated, which is the safe direction

Stated confidence versus the fraction of cases where the truth actually landed
inside the shown window (6,000 mixed simulated users):

| Label | n | Stated confidence | Actually inside window |
|---|---|---|---|
| learning | 4409 | 38% | **71%** |
| moderate | 1113 | 58% | **79%** |
| good | 304 | 73% | **89%** |
| high | 174 | 82% | **91%** |

Monotonic — the labels are ordered correctly, which is the important property.
But every band under-states by 13–33 points. The engine is more right than it
claims to be.

That is the correct direction to be miscalibrated in a health app, and I would
not "fix" it by simply inflating the numbers. But it's worth knowing that
"learning, 38%" in the UI empirically means "about 7 times in 10". Two caveats
on this table: the confidence number and the window are computed by *different*
formulas, so "confidence" was never defined as window coverage in the first
place; and the cohort mix here is deliberately harsh (a fifth of it is SD-9
bodies).

---

## 8. Failure modes and edge cases

| Situation | Behaviour |
|---|---|
| No period ever logged | `recomputePrediction()` returns null and clears the explanation. The explainer card still renders — it explains what *will* be used, and draws the population-shaped figures, labelled as such. |
| One period logged, no completed cycle | Prior-only prediction. `effectiveN = 0`, df = 4, window ±4, confidence floored around 0.33. |
| Cycle length outside 15–90 days | Silently dropped before the model sees it. A 200-day gap from someone who stopped logging cannot poison the posterior. |
| Non-finite / corrupt values | Filtered by the same guard. |
| Future-dated period log | `getLastPeriodStart` has `AND date <= today`, so a mis-tap on a future day can't become the anchor. |
| Period day un-logged | Cycle records are **rebuilt from scratch** from the entries, never patched, then the prediction re-runs. |
| Timezone | All date arithmetic goes through `src/utils/civil-date.ts` (UTC-only on `YYYY-MM-DD`). The predictor itself still uses `Date` + `setDate` for the final offset, which is safe because it's a local-to-local operation, but it is the last non-civil-date arithmetic in the prediction path and would be worth migrating. |

---

## 9. Dead code and dead parameters — the honest list

1. **`confidence.ts` (364 lines) is entirely unreferenced.** It implements a
   more sophisticated 5-factor weighted confidence score — data quantity (0.30),
   regularity (0.25), health profile (0.20), data freshness (0.15), past
   prediction accuracy (0.10) — with per-factor user-facing explanations. It is
   arguably better than the 3-line heuristic actually in use, and it includes
   the two signals the live path ignores: logging freshness and track record.
   **Nothing imports it.** Either wire it in or delete it; leaving it is how the
   next person wastes a day reading the wrong file.
2. **`health-adjustments.ts` (383 lines) is entirely unreferenced.** Same call.
3. **`recentWeightChangeKg`** — live parameter, no producer.
4. **`predictionErrors`** — computed, stored, passed in, explicitly ignored.
5. **Stress/sleep are today-only**, not the 7-day average the type documents.

None of these is a bug in the sense of producing a wrong answer. They are the
gap between what the code looks like it does and what it does, which is the
thing that costs time later.

---

## 10. If you want to improve accuracy, in priority order

1. **Make onboarding's cycle-length question harder to get wrong** (§7.3). Biggest
   single lever, and it's a UI change, not a model change.
2. **Unclamp or raise the window ceiling for high-SD users** (§7.2), and solve
   the calendar-shading problem separately — e.g. a gradient rather than a hard
   band.
3. **Collect a weight history** (two data points, three months apart) so the
   existing `recentWeightChangeKg` parameter stops being decorative.
4. **Use the 7-day average for stress/sleep** as the type already claims, so the
   shift stops depending on whether someone happened to check in today.
5. **Wire in `confidence.ts`** — freshness and track record are real signal being
   thrown away — or delete it.
6. **Per-user luteal estimate** instead of the flat 14 days, once there's enough
   history. This changes ovulation and the whole fertile window.
7. **Anything measured.** Basal temperature or LH would do more for accuracy
   than every item above combined, because they break the SD floor described in
   §7.1. It is also a much bigger product decision.

---

## 11. Reproducing the numbers

The tables in §6 and §7 came from throwaway probes run against the live engine.
They are not in the repo (they're analysis, not tests). The permanent coverage
is:

```
npm run test:predictor    14 real-user scenarios, ~60 assertions
npm run test:journey      10 pure-engine end-to-end journeys
npm run test:explainer    the explainer's numbers and copy
npm run test:charts       the three figures
npm run simulate          non-assertive eyeball simulation
npm run test:all          everything, 21 suites
```

To regenerate §7: build a synthetic cohort with a known mean and SD, call
`predictNextPeriod` with `n` history records drawn from it, and compare
`predictedCycleLength` against a held-out draw. To regenerate §6: call
`posteriorPredictiveCycleLength` directly and multiply `std` by the Student-t
quantile at `df = 2αₙ`.
