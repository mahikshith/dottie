/**
 * Dottie — the conditions list, once
 *
 * ─── WHY THIS FILE EXISTS (device-test-23) ──────────────────────────
 *
 *  Owner: "PCOS and PCOD, thyroid and hyperthyroid… we need to have different
 *  logos, not the same logos."
 *
 *  They were right, and the reason is worth naming: the list was written
 *  BY FAMILY. PCOS and PCOD both got 🌀 because they behave alike in the
 *  model; all three thyroids got ⚙️; endo, adeno and fibroids all got 💗.
 *  That is how the PREDICTOR groups them (see condition-families.ts) — and it
 *  is exactly the wrong thing to show a person, who is looking for the one
 *  line that is about them. Three identical icons in a vertical list is a list
 *  you have to read word by word.
 *
 *  The list also lived twice — onboarding and add-to-circle — so it could
 *  drift. One source now.
 *
 * ─── AND THE HONESTY FLAG ───────────────────────────────────────────
 *
 *  `affectsPrediction` says whether the forecast actually changes when this is
 *  ticked. Some do (they widen the cycle-length prior); some are recorded for
 *  the user's own history and their doctor report and change nothing in the
 *  maths. The transparency panel under the calendar and the exported
 *  spreadsheet both read this flag, so what the app claims and what the model
 *  does cannot drift apart. Adding a condition here WITHOUT adding it to a
 *  family in condition-families.ts means the model ignores it — so such an
 *  entry must be marked `affectsPrediction: false` and say so out loud.
 */

import type { HealthCondition } from '../types/cycle.types';

/** Every key the two pickers can offer, including the non-engine ones. */
export type ConditionKey =
  | HealthCondition
  | 'pmdd'
  | 'birth_control'
  | 'perimenopause'
  | 'postpartum'
  | 'breastfeeding'
  | 'fertility_treatment'
  | 'menstrual_migraine'
  | 'anaemia'
  | 'chronic_pelvic_pain'
  | 'nothing'
  | 'prefer_not_say';

export interface ConditionOption {
  id: ConditionKey;
  /** ONE per condition. Never shared with another row — that is the bug. */
  emoji: string;
  label: string;
  hint: string;
  /**
   * Does ticking this change the forecast? Read by the transparency panel and
   * the export, so the app can never claim more than the model does.
   */
  affectsPrediction: boolean;
  /** Selecting this clears every other selection. */
  exclusive?: boolean;
}

export const CONDITION_OPTIONS: readonly ConditionOption[] = [
  // ─── Ovulatory family — widens the cycle-length prior most ───────
  { id: 'pcos', emoji: '🌀', label: 'PCOS', hint: 'Polycystic ovary syndrome', affectsPrediction: true },
  { id: 'pcod', emoji: '🫧', label: 'PCOD', hint: 'Polycystic ovarian disease', affectsPrediction: true },

  // ─── Thyroid family ──────────────────────────────────────────────
  { id: 'thyroid', emoji: '🦋', label: 'Thyroid', hint: 'Not sure which — that is fine', affectsPrediction: true },
  { id: 'hypothyroid', emoji: '🐢', label: 'Hypothyroid', hint: 'Underactive thyroid', affectsPrediction: true },
  { id: 'hyperthyroid', emoji: '⚡', label: 'Hyperthyroid', hint: 'Overactive thyroid', affectsPrediction: true },

  // ─── Uterine family — flow and pain, not cycle length ────────────
  { id: 'endometriosis', emoji: '🌸', label: 'Endometriosis', hint: 'Painful periods, endo tissue', affectsPrediction: true },
  { id: 'adenomyosis', emoji: '🩸', label: 'Adenomyosis', hint: 'Tissue in the uterine wall', affectsPrediction: true },
  { id: 'fibroids', emoji: '🪨', label: 'Fibroids', hint: 'Heavy or long periods', affectsPrediction: true },

  // ─── Recorded, but the model does not branch on them ─────────────
  //
  //  Every one of these is common enough to belong in the list, and each is
  //  worth having in your own history and your doctor report. None of them
  //  changes the forecast today, and the app says so rather than implying a
  //  cleverness it does not have.
  { id: 'pmdd', emoji: '🌙', label: 'PMDD', hint: 'Severe premenstrual mood changes', affectsPrediction: false },
  { id: 'birth_control', emoji: '💊', label: 'On the pill or BC', hint: 'Hormonal birth control', affectsPrediction: false },
  { id: 'perimenopause', emoji: '🍂', label: 'Perimenopause', hint: 'Cycles changing as they wind down', affectsPrediction: false },
  { id: 'postpartum', emoji: '🍼', label: 'Recently postpartum', hint: 'In the first year after birth', affectsPrediction: false },
  { id: 'breastfeeding', emoji: '🤱', label: 'Breastfeeding', hint: 'Cycles often pause or run long', affectsPrediction: false },
  { id: 'fertility_treatment', emoji: '🧪', label: 'Fertility treatment', hint: 'IVF, IUI or medicated cycles', affectsPrediction: false },
  { id: 'menstrual_migraine', emoji: '🌩️', label: 'Menstrual migraine', hint: 'Headaches tied to your cycle', affectsPrediction: false },
  { id: 'anaemia', emoji: '🍋', label: 'Anaemia / low iron', hint: 'Often alongside heavy periods', affectsPrediction: false },
  { id: 'chronic_pelvic_pain', emoji: '🧷', label: 'Chronic pelvic pain', hint: 'Pain that is there most days', affectsPrediction: false },

  // ─── The two exclusive answers ───────────────────────────────────
  {
    id: 'nothing',
    emoji: '🌱',
    label: 'Nothing diagnosed yet',
    hint: "That's totally fine — I'll still learn your patterns",
    affectsPrediction: false,
    exclusive: true,
  },
  {
    id: 'prefer_not_say',
    emoji: '🤫',
    label: 'Prefer not to say',
    hint: "You don't have to share this",
    affectsPrediction: false,
    exclusive: true,
  },
];

/**
 * The keys that map to a real engine-side `HealthCondition` AND sit in a
 * prediction family. Everything else is captured as a soft flag.
 */
export const ENGINE_CONDITIONS: readonly ConditionKey[] = CONDITION_OPTIONS.filter(
  (c) => c.affectsPrediction
).map((c) => c.id);

export function conditionOption(id: string): ConditionOption | undefined {
  return CONDITION_OPTIONS.find((c) => c.id === id);
}

/** "PCOS", "Hypothyroid" — for the export and the doctor report. */
export function conditionLabel(id: string): string {
  return conditionOption(id)?.label ?? id;
}
