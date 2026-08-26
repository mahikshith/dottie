# 🌱 Dottie — Features, Algorithms & Research (Deep Dive)

> The complete picture of Dottie's engines, the newer features, the Mood-Aurora
> design system, and the competitive/scientific research behind them. Written for
> a future engineer (or a future Claude) to understand *what* is built and *why*.
>
> **Status:** most of what's described here (the predictor upgrade, the two new
> features, the aurora components) lives on the **`design-v2`** branch and is
> **⚠️ UNVERIFIED** — authored without a Node toolchain (see `CLAUDE.md` §constraints).
> First thing on a Node machine: `npm install`, `npm run type-check`, and a device run.
>
> Companion docs: `docs/HANDOFF.md` (live status log), `CLAUDE.md` (how-we-work),
> `docs/SESSION-CONTEXT.md` (original brief).

---

## 1. The Prediction Engine (the heart of Dottie)

**Files:** `src/engine/prediction/bayesian-predictor.ts` (the model),
`src/engine/prediction/predictor.ts` (the domain layer + public API),
`src/engine/prediction/phase-calculator.ts` (phase from dates).

### 1.1 What it is
A **real Bayesian model** of cycle length: a **Normal-Inverse-Gamma (NIG) conjugate
model** whose **posterior predictive is a Student-t distribution**. It runs entirely
**on-device, in closed form** — no ML runtime, no server, nothing leaves the phone.

> The *old* engine was a heuristic (weighted average + hand-tuned rules) that merely
> *called itself* "Bayesian". This upgrade makes the claim true.

### 1.2 The model (the math)
Cycle lengths `x₁, x₂, …` are modelled as `Normal(μ, σ²)` with **unknown** mean `μ`
and variance `σ²`. We put a conjugate NIG **prior** on them:

```
μ | σ²  ~  Normal(μ₀, σ²/κ₀)
σ²      ~  InverseGamma(α₀, β₀)
```

- The prior is the **"pretrained" population knowledge** — see §1.3.
- Conjugacy means the **posterior** after observing cycles is again NIG, in **closed
  form** (no MCMC / no gradient descent), and the **posterior predictive** for the
  next cycle length is a Student-t:

```
x*  ~  t( ν = 2·αₙ,   loc = μₙ,   scale² = βₙ·(κₙ+1)/(αₙ·κₙ) )
```

The closed-form update (with recency-weighted effective count `n` — see §1.4):

```
κₙ = κ₀ + n
μₙ = (κ₀·μ₀ + n·x̄) / κₙ
αₙ = α₀ + n/2
βₙ = β₀ + ½·Σwᵢ(xᵢ − x̄)² + (κ₀·n·(x̄ − μ₀)²) / (2·κₙ)
```

**Why this is the right model for Dottie:** honest uncertainty *falls out of the math*.
Few cycles → heavy-tailed `t` → **wide** window; more cycles → it **tightens**;
inherently irregular bodies **stay** wide instead of showing false precision. No
hand-tuned "confidence" fudge. And it's interpretable + private, unlike a black-box NN.

### 1.3 The population prior (`buildPopulationPrior`)
The "pretrained" part — sensible day-1 predictions, and humility for variable bodies:
- `μ₀` = the user's self-reported average, else **29 days** (modern population median;
  the classic "28" is a simplification), clamped to [21, 45].
- Population **SD** starts at **3.0 days** (regular adult) and **widens**:
  `+3.0` PCOS, `+1.5` thyroid, `+2.0` age < 16 (still regulating), `+2.5` age > 40
  (perimenopausal drift).
- `κ₀ = 2.5` (prior worth ~2–3 "virtual" cycles — weak enough that real data takes over).
- `α₀ = 2` (weakly-informative: E[σ²] still = population variance, but the user's *own*
  variance is learned fast — a very regular body gets a tight window without waiting a year).
- `β₀ = populationVariance · (α₀ − 1)` so E[σ²] = the population variance.

### 1.4 How a prediction is produced (`predictNextPeriod`, step by step)
1. **Build the prior** from the health profile (§1.3).
2. **Take the user's cycle lengths** (most-recent-first), **filter implausible** ones
   (outside 15–90 days = data-entry errors) so a typo can't poison the model.
3. **Recency-weight**: older cycles are discounted by `γ = 0.9` per step (recent cycle
   counts 1.0, the one before 0.9, …). Effective sample size saturates ≈ `1/(1−γ) = 10`,
   which sensibly caps overconfidence and tracks a changing body.
4. **Conjugate update** → posterior params (§1.2) → **Student-t posterior predictive**:
   `mean` (predicted length), `std` (spread in days), `df`.
5. **Lifestyle mean-shifts** (domain knowledge on top of the posterior mean): high recent
   stress `+1.5d`, poor recent sleep `+1d` (both tend to delay).
6. **Predicted length** = `round(mean + shift)`; **predicted date** = `lastPeriod + length`.
7. **Window (± days)** = `round(std · 1.15)` (≈ a 75–80% band) `+` condition inflation
   (PCOS +1, weight-change +1, PMS-detected −1), clamped to **[1, 8]**.
8. **Confidence** = `spreadToConfidence(std)` (≤1.5d→0.92 … >5d→0.48) `×` a data-volume
   factor (`0.55 + 0.45·min(effN/6, 1)` — never fully trust with little data) `−` condition
   reductions (PCOS −0.08, teen −0.05, perimenopause −0.05, weight-change −0.06,
   PMS-detected −0.05 i.e. a boost), clamped to **[0.25, 0.95]**.
9. **Ovulation** ≈ predicted period − 14 (luteal phase is near-constant).
10. **Labels** kept for UI continuity: `predictionPhase` 1/2/3 by cycle count;
    `confidenceLabel` learning/moderate/good/high by the final confidence.

**Public API is unchanged** (`predictNextPeriod`, `generateFullPrediction`,
`getPredictionMessage`, `PredictionInput`), so `useCycleStore` and the UI were untouched —
a clean drop-in.

### 1.5 Illustrative behaviour (hand-computed; verify on device)
| Situation | Window | Confidence |
|---|---|---|
| Day 1, no cycles | prior predictive → ~±4 days | low (~learning) |
| ~8 *regular* cycles (~28±1) | posterior tightens → ~±2 days | high |
| PCOS / irregular | posterior stays honestly wide | moderate at best |

### 1.6 Future options (not built)
- A tiny on-device **neural net** (TFLite), Flo-style (per-user + population) — heavier
  (needs a model runtime + training data). Marginal gain over the Bayesian model for a
  local-first app.
- **HealthKit temperature / heart-rate** (the app already declares HealthKit) → research
  shows ~85–87% fertile-window accuracy. A strong optional booster.
- A few **unit tests** over known histories (regular→tight, sparse/PCOS→wide, cold-start→prior).

---

## 2. Symptom ↔ Cycle Correlation Insights

**Files:** `src/engine/predicts/symptom-correlations.ts` (analysis), plus additions to
`src/engine/predicts/dottie-predicts.ts`, `templates.ts`, `dottie-predicts.types.ts`.

**What it does:** mines the user's *own* symptom logs for personal patterns and surfaces
them as a warm insight — *"Dottie's noticed you tend to log headaches ~2 days before your
period — 4 times now."* This is the single most-loved feature in competitor apps
(Bearable), built on-device from data Dottie already collects.

**How:** for each symptom type, it looks at *where in the cycle* it falls (phase +
median day-in-cycle), deriving the phase from the cycle day when `phaseAtLog` is absent.
It only calls something a pattern at **conservative thresholds** (≥3 dated occurrences,
≥55% concentrated in one phase); luteal-phase symptoms are framed as "~N days before your
period". Cramps are excluded (they already have a dedicated heads-up). Returns 0–2.

**Integration:** purely additive — a new `symptom_pattern_learned` insight kind (priority
72) + `buildSymptomPatternLearned` template (curious tone, **explicitly non-diagnostic**) +
a generator wired into `buildPredictsDeck`. The UI auto-renders any `DottieInsight`, so
**no store/UI changes**.

---

## 3. Responsible Condition-Pattern Flags (in the Doctor Report)

**Files:** `src/engine/reports/condition-signals.ts` (detection), plus additions to
`src/engine/reports/doctor-report.ts` and `src/types/report.types.ts`.

**What it does:** surfaces gentle, **NON-diagnostic** "patterns worth mentioning to a
clinician" — the kinds of signals that *sometimes* relate to PCOS, PMDD, endometriosis, or
heavy bleeding.

**Where — and why it matters:** it lives in the **doctor report**, NOT the home feed. A
"possible PCOS" card on a teen's home screen could cause real anxiety; the report is
literally *for taking to a doctor* and already carries a "not a diagnosis" footer. This is
the `apple-design` **Responsibility** principle applied literally.

**Signals (conservative):** irregular cycles, long (>35d) / short (<21d) average cycles,
long periods (>7.5d), frequent high-severity (≥7/10) pain → endometriosis-adjacent, strong
luteal-phase mood symptoms (≥7/10) → PMDD-adjacent. **Every output is an *observation*
that's "worth mentioning", never a diagnosis;** condition names appear only as hedged
context ("sometimes described as PMDD").

**Integration:** new `ReportPatternObservation` / `ReportPatternsSection` types +
`patternsToDiscuss` on `DoctorReportData`; the report engine computes it and adds a
"PATTERNS WORTH MENTIONING" block to the shared text (only when non-empty). Store/UI just
consume the report → no breakage. **UI-phase TODO:** render the section in
`ReportPreview.tsx`. **⚠️ Thresholds are clinician-*informed* rules of thumb, not validated
cutoffs — review with a professional before a public launch.**

---

## 4. The "Mood Aurora" Design System (design-v2)

**Concept:** the cycle as a luminous night sky — **glassmorphism + claymorphism +
aurora-mesh + grain**, a glowing cycle ring, a fluid glass tab bar. **The signature idea:
the logged mood recolours the entire UI** (the daily check-in becomes the hook).

**Palettes (`src/theme/palettes.ts`):** one glass/clay/aurora token system wearing 5 mood
palettes. Low/rough moods stay **WARM & soothing** (Twilight, Ember), never grey — a hard
day must not *look* hard (apple-design *Responsibility*).

| Mood (score) | Palette | Feeling |
|---|---|---|
| 😊 great (5) | Radiance (gold/coral) | radiant |
| 🙂 good (4) | Meadow (mint/aqua) | fresh |
| 😐 okay (3) | Nocturne (violet/aqua, **default**) | steady |
| 😔 low (2) | Twilight (soft periwinkle) | held |
| 😤 rough (1) | Ember (warm rose/amber) | grounded |

**Theme system (`src/theme/`):** `mood-palette.ts` (score→palette), `ThemeProvider.tsx`
(`AuroraProvider` + `useAurora()`, holds the active palette + the **origin-aware mood
reveal**: a circle of the new colour radiates from the tapped mood, commits the palette
underneath, then fades into the settled aurora). `AuroraProvider` is wired at the app root.

**Components (`src/components/ui/aurora/`):** `AuroraBackground` (SVG radial blooms +
Reanimated drift + re-bloom), `GlassCard` (translucent; upgrades to real frost with
`expo-blur`), `ClayButton` (gradient + sheen + spring press), `GlowRing` (self-drawing
progress ring), `AuroraTabBar` (fluid spring indicator + custom line icons + haptics — not
yet wired into `(tabs)/_layout.tsx`). All built to the `.claude/skills/animate-expo`
recipes; all Reduce-Motion aware.

**Visual mockups (published, interactive):**
- Mood Aurora (mood recolours the world): https://claude.ai/code/artifact/64d7a36b-cca1-4c8d-a731-889d936b97d6
- All 5 screens in the aurora world: https://claude.ai/code/artifact/ca1f800f-1f53-4f7d-a387-bf7c44c2d432

**UI-phase TODO (needs a Node machine):** `npx expo install expo-blur`; theme each screen
(Home + its cards first) to read palette tokens + wrap in `<AuroraBackground>`; wire the
mood buttons to `applyMood(score, {x,y})`; plug in `AuroraTabBar`; drive the palette from
the check-in on mount; render the new report "patterns" section; then `tsc` + device feel-check.

---

## 5. Research (2026-08) — the evidence behind the decisions

### 5.1 Prediction landscape
- **Flo** = two-step **ML**: per-user models learn individual patterns → features into a
  **neural network** trained on 5M+ users; reported **+54% accuracy**. (This is the
  "small pretrained model + personalization" pattern.)
- **Natural Cycles** = FDA-cleared (De Novo) **basal-body-temperature** algorithm (93%
  typical / 98% perfect use).
- **Clue** = calendar/statistics on period dates only (FDA-cleared as "substantially
  equivalent").
- **Academic SOTA** = **hierarchical Bayesian generative models** (Urteaga et al., PMLR
  2021) — handle irregular cyclers, improve as cycles evolve. Dottie's new model follows
  this framing in a phone-friendly conjugate closed form.
- Sources: Flo/InData Labs (indatalabs.com), Urteaga et al. (proceedings.mlr.press/v149/urteaga21a),
  arXiv 2308.07927, Natural Cycles & Clue FDA (mobihealthnews.com).

### 5.2 Feature gaps worth incorporating
1. **Privacy as a headline** — Flo paid a **$59.5M (2025) settlement** over sharing
   intimate data with Meta. Dottie is local-first / no-ads → a real trust moat; make it a
   spearhead, not a footnote.
2. **Perimenopause mode** — fastest-growing segment; Flo/ENdi only just entered (2025).
3. **Symptom↔cycle correlations** — ✅ built (§2).
4. **Responsible condition flags** — ✅ built (§3).
5. **Hormonal birth-control (pill) mode** — commonly requested; track packs/placebo week;
   do NOT claim contraception (regulatory line).
6. **Inclusivity** — research repeatedly flags heteronormative / over-pink / fertility-
   centric assumptions; keep language inclusive + customization high.
   Sources: BMC Women's Health 2025 (doaj.org), UW study (washington.edu/news 2017),
   bearable.app roundups 2026.

---

## 6. Where things stand
- **`main`** = the current (pre-redesign) build.
- **`design-v2`** = everything in this doc (aurora system + predictor v2 + the 2 features).
  All committed + pushed; all **UNVERIFIED** (no Node here).
- **Next:** the UI/UX phase — theme the screens to Mood Aurora (Home first), render the new
  report section, then perimenopause / BC-pill modes. Then merge `design-v2` → `main` once
  verified on a device.
