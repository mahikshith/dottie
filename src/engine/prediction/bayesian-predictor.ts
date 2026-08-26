/**
 * Dottie — Bayesian Cycle-Length Model (design-v2 / engine upgrade)
 *
 * Replaces the old heuristic ("weighted average + rules") with a REAL Bayesian
 * model of cycle length. Closed-form, on-device, private — no ML runtime, no
 * server, no data leaves the phone.
 *
 * ─── THE MODEL ──────────────────────────────────────────────────────
 *
 *  Cycle lengths x_i ~ Normal(μ, σ²), with an unknown mean μ and variance σ².
 *  We put a conjugate Normal-Inverse-Gamma (NIG) PRIOR on (μ, σ²):
 *
 *      μ | σ²  ~  Normal(μ0, σ²/κ0)
 *      σ²      ~  InverseGamma(α0, β0)
 *
 *  The prior is the "pretrained" part — set from population cycle science and
 *  widened for teens / PCOS / thyroid / perimenopause (see buildPopulationPrior).
 *  Conjugacy means the POSTERIOR after observing cycles is again NIG, in CLOSED
 *  FORM (no MCMC / variational inference), and the POSTERIOR PREDICTIVE for the
 *  next cycle length is a Student-t distribution:
 *
 *      x* ~ t(ν = 2·α_n,  loc = μ_n,  scale² = β_n·(κ_n+1)/(α_n·κ_n))
 *
 *  Why this is the right upgrade for Dottie:
 *   - Honest uncertainty falls out of the math: few cycles → heavy-tailed t →
 *     wide window; more cycles → tightens. Irregular cyclers keep a wide window
 *     instead of false precision. No hand-tuned "confidence" fudge.
 *   - The population prior gives a sensible day-1 prediction (cold start) and is
 *     gently overridden by the user's own data (Bayesian updating).
 *   - Recency matters: older cycles are exponentially down-weighted (a standard
 *     Bayesian online-learning discount), so a changing body is tracked without
 *     throwing away history.
 *
 *  Reference: Urteaga et al., "A Use Case on Menstrual Cycle Length Prediction"
 *  (PMLR 2021) — the generative/Bayesian framing this follows, simplified to a
 *  conjugate closed form that fits a phone.
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device). The math is standard NIG conjugacy;
 *  verify numerically on a Node machine (a few unit tests against known cases
 *  would be worth adding — project convention is no tests unless asked).
 */

// ─── PLAUSIBILITY BOUNDS ─────────────────────────────────────────────
// Filter obvious data-entry errors before they poison the model. Real
// human cycles essentially never fall outside this range.
const MIN_PLAUSIBLE_CYCLE = 15;
const MAX_PLAUSIBLE_CYCLE = 90;

// Default population mean cycle length (days). ~29 is the modern population
// median (the classic "28" is a simplification).
const POPULATION_MEAN = 29;

// Base population SD of cycle length for a regular adult (days).
const BASE_POPULATION_SD = 3.0;

// Prior strength: how many "virtual observations" the population prior is
// worth. Low enough that a handful of real cycles takes over.
const PRIOR_KAPPA = 2.5;

// InverseGamma shape. α0 = 2 is weakly-informative: E[σ²] still equals the
// population variance, but the belief is vague enough that a user's OWN cycle
// variance is learned quickly (a very regular body gets a tight window without
// waiting a year). Predictive df starts at 4 (finite variance, heavy tails).
const PRIOR_ALPHA = 2;

// Exponential recency discount for older cycles (0<γ≤1). γ=0.9 → the most
// recent cycle counts 1.0, the one before 0.9, etc.; effective sample size
// saturates around 1/(1-γ) ≈ 10, which sensibly caps overconfidence.
const RECENCY_GAMMA = 0.9;

// ─── TYPES ───────────────────────────────────────────────────────────

export interface NIGPrior {
  /** prior mean of μ */
  mu0: number;
  /** prior strength (virtual observations) */
  kappa0: number;
  /** InverseGamma shape */
  alpha0: number;
  /** InverseGamma rate */
  beta0: number;
  /** population SD used to build it (kept for diagnostics) */
  populationSd: number;
}

export interface PosteriorPredictive {
  /** predicted next cycle length (posterior mean μ_n) */
  mean: number;
  /** SD of the posterior predictive (Student-t) in days */
  std: number;
  /** degrees of freedom ν = 2·α_n */
  df: number;
  /** effective (recency-weighted) number of observations */
  effectiveN: number;
}

export interface PriorOptions {
  /** user-reported average cycle length, if any */
  reportedCycleLength?: number | null;
  /** user age, if known */
  age?: number | null;
  /** health condition keys (e.g. 'pcos', 'thyroid') */
  conditions: readonly string[];
}

// ─── PRIOR CONSTRUCTION (the "pretrained" population knowledge) ───────

/**
 * Build the population NIG prior, widened for known sources of irregularity.
 * This is what gives a good cold-start prediction and keeps the model humble
 * for bodies that are inherently more variable.
 */
export function buildPopulationPrior(opts: PriorOptions): NIGPrior {
  const mu0 = clampNumber(opts.reportedCycleLength ?? POPULATION_MEAN, 21, 45);

  // Population SD grows with real biological variability.
  let sd = BASE_POPULATION_SD;
  if (opts.conditions.includes('pcos')) sd += 3.0; // PCOS: long, variable cycles
  if (opts.conditions.includes('thyroid')) sd += 1.5;
  if (opts.age !== null && opts.age !== undefined) {
    if (opts.age < 16) sd += 2.0; // teens still regulating
    if (opts.age > 40) sd += 2.5; // perimenopausal drift
  }

  const populationVar = sd * sd;
  // Set β0 so the prior mean of σ² equals the population variance:
  //   E[σ²] = β0 / (α0 - 1)  ⇒  β0 = populationVar · (α0 - 1)
  const beta0 = populationVar * (PRIOR_ALPHA - 1);

  return { mu0, kappa0: PRIOR_KAPPA, alpha0: PRIOR_ALPHA, beta0, populationSd: sd };
}

// ─── POSTERIOR PREDICTIVE (the closed-form Bayesian update) ──────────

/**
 * Compute the posterior predictive distribution of the NEXT cycle length,
 * given observed cycle lengths (most-recent-first) and the population prior.
 *
 * Older cycles are exponentially down-weighted by RECENCY_GAMMA.
 */
export function posteriorPredictiveCycleLength(
  cycleLengthsRecentFirst: readonly number[],
  prior: NIGPrior,
  recencyGamma: number = RECENCY_GAMMA
): PosteriorPredictive {
  // Keep only plausible observations.
  const xs = cycleLengthsRecentFirst.filter(
    (x) => Number.isFinite(x) && x >= MIN_PLAUSIBLE_CYCLE && x <= MAX_PLAUSIBLE_CYCLE
  );

  const { mu0, kappa0, alpha0, beta0 } = prior;

  // No data → the prior IS the predictive.
  if (xs.length === 0) {
    return predictiveFromPosterior(mu0, kappa0, alpha0, beta0, 0);
  }

  // Recency-weighted sufficient statistics.
  let wSum = 0; // Σ w_i               (effective n)
  let wxSum = 0; // Σ w_i x_i
  xs.forEach((x, i) => {
    const w = Math.pow(recencyGamma, i);
    wSum += w;
    wxSum += w * x;
  });
  const xBar = wxSum / wSum;

  // Weighted sum of squared deviations from the weighted mean.
  let wSS = 0; // Σ w_i (x_i - x̄)²
  xs.forEach((x, i) => {
    const w = Math.pow(recencyGamma, i);
    const d = x - xBar;
    wSS += w * d * d;
  });

  const nEff = wSum;

  // Conjugate NIG update (with n replaced by the effective, recency-weighted n).
  const kappaN = kappa0 + nEff;
  const muN = (kappa0 * mu0 + nEff * xBar) / kappaN;
  const alphaN = alpha0 + nEff / 2;
  const betaN =
    beta0 + 0.5 * wSS + (kappa0 * nEff * (xBar - mu0) * (xBar - mu0)) / (2 * kappaN);

  return predictiveFromPosterior(muN, kappaN, alphaN, betaN, nEff);
}

/** Turn NIG posterior params into the Student-t posterior predictive. */
function predictiveFromPosterior(
  mu: number,
  kappa: number,
  alpha: number,
  beta: number,
  effectiveN: number
): PosteriorPredictive {
  const df = 2 * alpha;
  // scale² of the predictive t
  const scaleSq = (beta * (kappa + 1)) / (alpha * kappa);
  // Variance of a Student-t is scale²·ν/(ν−2) for ν>2; guard small ν.
  const variance = df > 2 ? scaleSq * (df / (df - 2)) : scaleSq * 3;
  return {
    mean: mu,
    std: Math.sqrt(Math.max(variance, 0.25)), // floor so the window never collapses
    df,
    effectiveN,
  };
}

// ─── HELPERS ─────────────────────────────────────────────────────────

function clampNumber(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
