/**
 * Dottie — condition families (pure)
 *
 * The predictor does not care about diagnoses. It cares about ONE thing: how
 * much extra cycle-length variability a body is likely to carry, so the prior
 * can be widened honestly rather than pretending to a precision it doesn't have.
 *
 * ─── WHY A FAMILY MAP AND NOT MORE `includes()` CALLS ───────────────
 *
 *  The predictor used to test `conditions.includes('pcos')` and
 *  `conditions.includes('thyroid')` directly. That was fine while there were
 *  exactly three conditions. Device-test-16 widened the list — PCOD, hypo- and
 *  hyperthyroidism, adenomyosis, fibroids — and with direct string tests every
 *  new value would have been silently ignored by the model: the user would tick
 *  "PCOD", see it saved, and get a prediction that had never heard of it. A
 *  setting that appears to be used and isn't is worse than one that isn't
 *  offered.
 *
 *  So conditions are grouped by what they do to a cycle, and the predictor asks
 *  about the FAMILY. Adding a condition means adding one line here.
 *
 * ─── NON-DIAGNOSTIC ─────────────────────────────────────────────────
 *
 *  Nothing here claims anything about anyone's body, and none of it is shown to
 *  a user. It is a modelling decision about prior width, and it is deliberately
 *  coarse: PCOD is grouped with PCOS because both commonly present with longer,
 *  more variable cycles, not because they are the same thing.
 */

/** What the model recognises. */
export type ConditionFamily = 'ovulatory' | 'thyroid' | 'uterine';

const FAMILY_OF: Record<string, ConditionFamily> = {
  // Long, variable, sometimes anovulatory cycles — the widest priors.
  pcos: 'ovulatory',
  pcod: 'ovulatory',
  // Thyroid function shifts cycle length in both directions.
  thyroid: 'thyroid',
  hypothyroid: 'thyroid',
  hyperthyroid: 'thyroid',
  // These affect flow, pain and period LENGTH far more than cycle length, so
  // they are tracked but do not widen the cycle-length prior. Being explicit
  // about that is the point of listing them.
  endometriosis: 'uterine',
  adenomyosis: 'uterine',
  fibroids: 'uterine',
};

/** The distinct families present in a condition list. */
export function conditionFamilies(conditions: readonly string[]): Set<ConditionFamily> {
  const out = new Set<ConditionFamily>();
  for (const c of conditions) {
    const family = FAMILY_OF[c];
    if (family) out.add(family);
  }
  return out;
}

/** PCOS/PCOD — the family that most widens the cycle-length prior. */
export function hasOvulatoryCondition(conditions: readonly string[]): boolean {
  return conditionFamilies(conditions).has('ovulatory');
}

/** Any thyroid condition, whichever direction. */
export function hasThyroidCondition(conditions: readonly string[]): boolean {
  return conditionFamilies(conditions).has('thyroid');
}

/** Endometriosis / adenomyosis / fibroids — flow and pain, not cycle length. */
export function hasUterineCondition(conditions: readonly string[]): boolean {
  return conditionFamilies(conditions).has('uterine');
}
