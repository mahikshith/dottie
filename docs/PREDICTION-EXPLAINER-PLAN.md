# Prediction Explainer + Home Day-Ring Meaning — Implementation Plan

**Status:** APPROVED by owner (2026-09-02), NOT yet built. Next session: build from
this doc — do NOT re-explore the engine, it's mapped below.

**Owner intent (verbatim gist):** When we show the next-period prediction, also show
*how* it's calculated — the factors considered, the confidence interval / standard
deviation — written to sound scientific but be understandable by anyone. It must be
**dynamic**: when the user logs/edits anything (calendar, check-in, new inputs), the
prediction AND the explanation recompute and re-render. Put it in the empty space
under the Sisterhood bridge on the Calendar tab (or somewhere creative). Separately,
the Home day-ring shows a bare number (Day 0/1/2…) — add what that day *means*.

---

## 0. Key insight — "dynamic" is already true at the engine layer

`useCycleStore.recomputePrediction()` is called after EVERY cycle mutation
(`useCycleStore.ts:21,84`) and writes `latestPrediction`. So we do NOT build a
recompute loop — the explainer must simply **subscribe to the prediction via a
Zustand selector** so it re-renders on every change. Static snapshot = wrong;
reactive selector = right. (Cache the selector per Zustand-v5 rules.)

## 1. What the engine ALREADY gives us (grounded — file refs)

- `src/engine/prediction/predictor.ts`
  - `PredictionInput` (line 43), `PredictionOutput` (line 63): `confidence` (0–1),
    `confidenceLabel` ('learning'|'moderate'|'good'|'high'), predicted date + window,
    condition-based `confidenceReduction` accumulation (PCOS/thyroid/endo/PMDD/pill,
    lines 116–144), `spreadToConfidence(posterior.std)` (line 158).
  - `predictNextPeriod()` + `generateFullPrediction()` + `getPredictionMessage()`.
- `src/engine/prediction/bayesian-predictor.ts`
  - NIG prior → Student-t predictive. `PosteriorPredictive` (line 86) exposes `mu`,
    `variance`, `std`; `df = 2*alpha` (line 196); `scaleSq` (line 198).
  - So point estimate = `mu`; spread = `std`; a **credible interval** is a central
    Student-t interval: `mu ± t_{df, 0.9} * scale` (need the t-quantile; see §3).
- `src/engine/prediction/confidence.ts` — weighted factor model (weights 0.30/0.25/…)
  — the raw material for a "what moved the needle" factor list.
- `src/engine/prediction/health-adjustments.ts` — condition adjustments.
- `src/stores/useCycleStore.ts` — `latestPrediction: CyclePrediction`,
  `predictionErrors: number[]` (past signed errors — powers a "we're learning" line),
  `recomputePrediction()`.

**Almost everything the explainer needs already exists.** The gap is (a) a few fields
not currently surfaced (explicit credible-interval bounds, a structured factor list),
and (b) the presentation layer.

## 2. Feature A — "How this prediction is made" card

### 2a. Data layer (pure, testable)
New pure builder: `src/engine/prediction/explain-prediction.ts`
- `export interface PredictionExplanation { pointDate; intervalStart; intervalEnd;
  intervalDays; stdDevDays; confidence; confidenceLabel; factors: ExplanationFactor[];
  cyclesObserved; learningNote?; plainSummary; scienceSummary }`
- `export function buildPredictionExplanation(input, output, posterior): PredictionExplanation`
- `ExplanationFactor = { icon; label; plain; effect: 'tightens'|'widens'|'shifts'|'neutral'; detail }`
  Examples the builder emits from data ALREADY computed:
  - "Your logged cycles" — N cycles → more data tightens the window.
  - "Your own regularity" — from `posterior.std`: low SD = tight, high SD = wide.
  - "Recency weighting" — recent cycles count more (RECENCY_GAMMA).
  - "Health conditions" — each active condition + its window/confidence effect.
  - "Body context" (height/weight) — ONLY if provided; see §4, context not math.
  - "Still learning" — when `cyclesObserved < 3`, honest wide-window note.
- The credible interval is the honest visual of SD/CI the owner asked for.

### 2b. UI
New: `src/components/calendar/PredictionExplainerCard.tsx`
- Lives in the empty space under the Sisterhood bridge card on
  `app/(tabs)/calendar.tsx` (bridge is at ~line 405–448; add card after it, inside
  the same `ScrollView`).
- Two reading levels in one card (serves any user):
  1. **Plain** (default): "We think your next period starts around **Sep 24**,
     most likely between **Sep 22–27**. That ~5-day window reflects how regular your
     recent cycles have been." + a confidence chip.
  2. **"Show the science"** expander: point estimate, ± standard deviation in days,
     the credible interval + one plain sentence on what a confidence interval means,
     the Student-t / Bayesian one-liner, and the factor list with effect tags.
- **Reactive:** `const explanation = useCycleStore(selectPredictionExplanation)` where
  the selector memo-builds from `latestPrediction` (cache per Zustand v5). Re-renders
  automatically whenever a log/edit triggers `recomputePrediction()`.
- Non-diagnostic: "many people…", "tends to", never "your body is doing X".
- Empty state (no cycle logged yet): explain we widen uncertainty until we learn,
  invite first log — no fake numbers (respects the day-counter=0 rule).

### 2c. Motion (optional, cheap)
Use `PopOnChange` / a number tween so when the window updates after a new log, the
dates visibly animate — reinforces "this is live." (See `animate-expo` skill.)

## 3. Math to add (small, pure)
- Student-t two-sided quantile `tQuantile(df, p)` for the credible interval
  (Acklam/Hill approximation or a small lookup; df here is `2*alpha`, ≥4). Add to
  `bayesian-predictor.ts` or a `stats.ts`, unit-tested.
- Interval = `mu ± tQuantile(df, 0.9) * scale` (80% central) — pick the % that reads
  best; expose the % in copy ("~8 in 10 chance it lands in this range").

## 4. Feature B — Height / weight (columns already exist)
- Schema already has `weight_kg`,`height_cm` (`schema.ts:84-85`) +
  `weightKg`,`heightCm` (`cycle.types.ts:34-35`) — **uncollected, unused.**
- Add an OPTIONAL input (Profile → an "About you" row, and/or an onboarding step).
- **DECISION TAKEN (context-only, non-diagnostic):** do NOT feed BMI as a hard
  point-estimate shifter. The BMI↔cycle link is real but weak/sensitive; a hard input
  risks worse accuracy + body-image harm + a diagnostic feel. Instead:
  - surface as a **context factor** in the explainer ("very low or very high body
    weight lengthens or skips cycles for some people"),
  - optionally widen the confidence window slightly at BMI extremes (a soft
    `confidenceReduction` nudge in `predictor.ts`), never move the predicted date.
- Revisit as a real math input only with evidence + owner sign-off.

## 5. Feature C — Home day-ring meaning
- `app/(tabs)/home.tsx` renders the day number in `<GlowRing>` (imports line 14;
  `dayInCycle` line 88, `phase` line 87).
- Add beside/under the ring: phase name + one-line significance, e.g.
  "Day 14 · Ovulatory · energy often peaks" / "Day 3 · Menstrual · rest is valid".
- Source the one-liner from the existing phase/sub-phase engine
  (`resolveSubPhase()` in `src/engine/calendar/day-suggestions.ts`) so it stays
  consistent with the rest of the app. Gate on `hasCycleData` (no data → no fake day).

## 6. Testing (all must stay green — CI runs `test:all`)
- New `scripts/prediction-explainer-harness.ts` (`test:explainer`, wire into
  `test:all` + the CI workflow): invariants — interval always contains the point
  estimate; interval widens as SD rises and narrows as N rises; every active
  condition appears as a factor; empty state emits no numeric claims; explanation
  recomputes when inputs change.
- `npm run test:predictor` still green (don't regress the engine).
- `npm run audit:ui` — new Pressables (expander, profile input) need `onPress`.
- `npx tsc --noEmit` exit 0; `validate:content` unaffected.

## 7. Files touched (summary)
- NEW `src/engine/prediction/explain-prediction.ts` (pure)
- NEW `src/components/calendar/PredictionExplainerCard.tsx`
- NEW `scripts/prediction-explainer-harness.ts` + package.json script + CI gate
- EDIT `src/engine/prediction/bayesian-predictor.ts` (t-quantile / interval helper)
- EDIT `src/stores/useCycleStore.ts` (add `selectPredictionExplanation` cached selector)
- EDIT `app/(tabs)/calendar.tsx` (mount card under Sisterhood bridge)
- EDIT `app/(tabs)/home.tsx` (day-ring meaning line)
- EDIT profile/onboarding for optional height/weight input
- EDIT `src/engine/prediction/predictor.ts` (soft BMI-extreme window nudge, optional)

## 8. Build order for next session
1. `explain-prediction.ts` + t-quantile + harness (pure, fast, no UI risk).
2. `selectPredictionExplanation` selector (reactive wiring).
3. `PredictionExplainerCard` on Calendar tab.
4. Home day-ring meaning line.
5. Height/weight optional input + context factor.
6. `tsc` + `test:all` green → commit (no `[skip ci]`) → push → APK.
