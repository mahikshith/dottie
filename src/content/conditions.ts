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
  /**
   * ─── THE EXPLAINER (device-test-29) ──────────────────────────────
   *
   *  Owner: "some users may not know what PCOD or hyperthyroid even is, so
   *  they could select something random and the prediction confidence goes
   *  off. Until they are completely sure, they shouldn't tick it."
   *
   *  Exactly right, and it is the one input where a wrong answer is both easy
   *  to give and permanent: a ticked ovulatory condition widens the model's
   *  prior for every forecast from then on. So each row can be OPENED, and
   *  what it opens is three plain lines: what the thing is, why we ask, and
   *  what ticking it actually does to the maths.
   *
   *  `what` is descriptive, never diagnostic (rule 1) — it says what the
   *  condition is, not what the reader has. Nothing here tells anyone they
   *  might have something; that is a clinician's job and we say so.
   */
  what: string;
  why: string;
  /** What ticking it does to the forecast, in one honest sentence. */
  predictionEffect: string;
  /** Selecting this clears every other selection. */
  exclusive?: boolean;
}

export const CONDITION_OPTIONS: readonly ConditionOption[] = [
  // ─── Ovulatory family — widens the cycle-length prior most ───────
  { id: 'pcos', emoji: '🌀', label: 'PCOS', hint: 'Polycystic ovary syndrome', affectsPrediction: true,
    what: 'A hormonal condition where ovulation happens late or not every cycle, so cycles are often long or hard to predict. Diagnosed by a clinician, usually with blood tests or a scan.',
    why: 'Cycle length varies far more with PCOS, and a forecast that ignores that would look confident and be wrong.',
    predictionEffect: 'Widens the expected range and lowers the confidence figure — deliberately, because the honest answer is less certain.' },
  { id: 'pcod', emoji: '🫧', label: 'PCOD', hint: 'Polycystic ovarian disease', affectsPrediction: true,
    what: 'A term used in some countries for ovaries with many small follicles. It overlaps heavily with PCOS and is often used interchangeably.',
    why: 'It affects cycle regularity the same way PCOS does, so the model treats them alike.',
    predictionEffect: 'Same effect as PCOS: a wider expected range and a lower confidence figure.' },

  // ─── Thyroid family ──────────────────────────────────────────────
  { id: 'thyroid', emoji: '🦋', label: 'Thyroid', hint: 'Not sure which — that is fine', affectsPrediction: true,
    what: 'A thyroid condition of some kind, when you know there is one but not which. The thyroid sets your metabolic pace, and cycle length follows it.',
    why: 'Either direction can lengthen or shorten cycles, so knowing there is something is already useful.',
    predictionEffect: 'Slightly widens the expected range and trims the confidence figure.' },
  { id: 'hypothyroid', emoji: '🐢', label: 'Hypothyroid', hint: 'Underactive thyroid', affectsPrediction: true,
    what: 'An underactive thyroid — it makes less hormone than the body expects. Diagnosed with a blood test, usually treated with daily medication.',
    why: 'Underactive thyroid is associated with longer, heavier and less regular cycles.',
    predictionEffect: 'Slightly widens the expected range and trims the confidence figure.' },
  { id: 'hyperthyroid', emoji: '⚡', label: 'Hyperthyroid', hint: 'Overactive thyroid', affectsPrediction: true,
    what: 'An overactive thyroid — it makes more hormone than the body expects. Also diagnosed with a blood test.',
    why: 'Overactive thyroid is associated with shorter or lighter cycles, and with skipped ones.',
    predictionEffect: 'Slightly widens the expected range and trims the confidence figure.' },

  // ─── Uterine family — flow and pain, not cycle length ────────────
  { id: 'endometriosis', emoji: '🌸', label: 'Endometriosis', hint: 'Painful periods, endo tissue', affectsPrediction: true,
    what: 'A condition where tissue like the uterine lining grows outside the uterus, often causing significant period pain. Diagnosed by a clinician, often by laparoscopy.',
    why: 'It rarely changes cycle LENGTH much, but it changes what the days feel like, and it belongs in your doctor report.',
    predictionEffect: 'A small widening of the expected range. Most of its value is in your own records, not the maths.' },
  { id: 'adenomyosis', emoji: '🩸', label: 'Adenomyosis', hint: 'Tissue in the uterine wall', affectsPrediction: true,
    what: 'A condition where lining-like tissue grows into the muscular wall of the uterus, often causing heavy bleeding and cramping.',
    why: 'Like endometriosis, it shapes the experience of a period more than its timing — but it is worth recording.',
    predictionEffect: 'A small widening of the expected range.' },
  { id: 'fibroids', emoji: '🪨', label: 'Fibroids', hint: 'Heavy or long periods', affectsPrediction: true,
    what: 'Non-cancerous growths in or on the uterus. Very common, and often found on a routine scan.',
    why: 'They are associated with heavier and longer bleeding, which affects how your period days are counted.',
    predictionEffect: 'A small widening of the expected range.' },

  // ─── Recorded, but the model does not branch on them ─────────────
  //
  //  Every one of these is common enough to belong in the list, and each is
  //  worth having in your own history and your doctor report. None of them
  //  changes the forecast today, and the app says so rather than implying a
  //  cleverness it does not have.
  { id: 'pmdd', emoji: '🌙', label: 'PMDD', hint: 'Severe premenstrual mood changes', affectsPrediction: false,
    what: 'Premenstrual dysphoric disorder — severe mood symptoms in the luteal phase that lift when the period starts. A clinical diagnosis, distinct from ordinary PMS.',
    why: 'So the app knows the second half of your cycle matters to you, and so it appears in your doctor report.',
    predictionEffect: 'Recorded for your own history and your doctor report. It does not change the forecast.' },
  { id: 'birth_control', emoji: '💊', label: 'On the pill or BC', hint: 'Hormonal birth control', affectsPrediction: false,
    what: 'Any hormonal contraceptive — pill, implant, injection, hormonal coil or ring.',
    why: 'Hormonal birth control usually replaces your natural cycle with a scheduled one, so tracking means something different.',
    predictionEffect: 'Nothing yet — the forecast still works from your logged days. A proper birth-control mode is planned.' },
  { id: 'perimenopause', emoji: '🍂', label: 'Perimenopause', hint: 'Cycles changing as they wind down', affectsPrediction: false,
    what: 'The years of change before periods stop, when cycles often get shorter, then longer, then irregular.',
    why: 'It explains a pattern that would otherwise look like noise, and it belongs in your records.',
    predictionEffect: 'Nothing yet, though it is the cohort where cycles vary most. A dedicated mode is planned.' },
  { id: 'postpartum', emoji: '🍼', label: 'Recently postpartum', hint: 'In the first year after birth', affectsPrediction: false,
    what: 'The year or so after giving birth, while cycles return — often unpredictably.',
    why: 'Cycles in this period are genuinely unpredictable, and it helps to know that is expected rather than wrong.',
    predictionEffect: 'Recorded for your own history and your doctor report. It does not change the forecast.' },
  { id: 'breastfeeding', emoji: '🤱', label: 'Breastfeeding', hint: 'Cycles often pause or run long', affectsPrediction: false,
    what: 'Breastfeeding, which often delays the return of periods or stretches cycles while it continues.',
    why: 'A long gap is normal here, and the app should not read it as a missed log.',
    predictionEffect: 'Recorded for your own history and your doctor report. It does not change the forecast.' },
  { id: 'fertility_treatment', emoji: '🧪', label: 'Fertility treatment', hint: 'IVF, IUI or medicated cycles', affectsPrediction: false,
    what: 'Medicated or assisted cycles — IVF, IUI, or ovulation-induction medication.',
    why: 'These cycles are set by a clinic, not by your own pattern, so your logs mean something different.',
    predictionEffect: 'Recorded for your own history and your doctor report. It does not change the forecast.' },
  { id: 'menstrual_migraine', emoji: '🌩️', label: 'Menstrual migraine', hint: 'Headaches tied to your cycle', affectsPrediction: false,
    what: 'Migraine that reliably arrives at a particular point in the cycle, usually just before a period.',
    why: 'So the app can put your own pattern in front of you, and so it reaches your doctor report.',
    predictionEffect: 'Recorded for your own history and your doctor report. It does not change the forecast.' },
  { id: 'anaemia', emoji: '🍋', label: 'Anaemia / low iron', hint: 'Often alongside heavy periods', affectsPrediction: false,
    what: 'Low iron or low haemoglobin, confirmed by a blood test. Common alongside heavy periods.',
    why: 'It gives context to fatigue you log, and it is worth a clinician seeing next to your flow records.',
    predictionEffect: 'Recorded for your own history and your doctor report. It does not change the forecast.' },
  { id: 'chronic_pelvic_pain', emoji: '🧷', label: 'Chronic pelvic pain', hint: 'Pain that is there most days', affectsPrediction: false,
    what: 'Pelvic pain lasting months, whether or not a cause has been found.',
    why: 'So pain you log is read as ongoing rather than as a one-off cycle symptom.',
    predictionEffect: 'Recorded for your own history and your doctor report. It does not change the forecast.' },

  // ─── The two exclusive answers ───────────────────────────────────
  {
    id: 'nothing',
    emoji: '🌱',
    label: 'Nothing diagnosed yet',
    hint: "That's totally fine — I'll still learn your patterns",
    affectsPrediction: false,
    what: 'Nothing a clinician has diagnosed. Most people start here, and it is the right answer if you are not certain.',
    why: 'The forecast learns from your logged days either way. A condition you are unsure about is better left unticked than guessed.',
    predictionEffect: 'Nothing changes. The model works from your own cycle history.',
    exclusive: true,
  },
  {
    id: 'prefer_not_say',
    emoji: '🤫',
    label: 'Prefer not to say',
    hint: "You don't have to share this",
    affectsPrediction: false,
    what: 'Exactly what it says — you would rather not record this, and the app does not need it.',
    why: 'It is your data. This option exists so that skipping is a deliberate choice rather than an unanswered question.',
    predictionEffect: 'Nothing changes. Nothing is stored beyond this choice.',
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
