/**
 * Dottie — what would make the forecast better
 *
 * ─── WHY (device-test-29) ───────────────────────────────────────────
 *
 *  Owner: "right now if a user logs one or two cycles we show 35% prediction
 *  power. We should let the user know what they need to do to increase it."
 *
 *  A bare confidence figure is a grade with no rubric. It tells someone the
 *  app is unsure without telling them whether that is their fault, their
 *  body's, or ours — and those three have completely different answers.
 *
 *  This module answers the question. It takes what the app knows about a
 *  user's inputs and returns a RANKED list of actions, each with what it does
 *  and how much it is worth — plus a breakdown of why the current number is
 *  what it is.
 *
 * ─── THE HONESTY CONSTRAINTS ────────────────────────────────────────
 *
 *  1. **No invented numbers.** Every figure quoted here comes from our own
 *     measured runs in `docs/PREDICTION-ENGINE.md` §7.1 — a synthetic cohort
 *     with a known SD, run through the real engine. Nothing is borrowed from a
 *     study we have not read or a cohort we do not have (rule 2).
 *
 *  2. **Never promise what the model cannot deliver.** The single most
 *     important finding in that document is that the engine cannot beat the
 *     user's own cycle-to-cycle variance. For someone with an SD of 5 days,
 *     twelve cycles of history still gives ~4 days of error, because the
 *     remaining error IS the body. Telling that person "log more and it will
 *     get sharper" is a lie. So `improvementActions` returns a CEILING
 *     statement for them instead, and says what would actually help — a
 *     measured signal, which we do not yet collect.
 *
 *  3. **Rank by real effect, not by what is easy to ask for.** Logging the
 *     next two periods is worth more than every profile field combined. The
 *     order here is the order from §10 of the reference.
 */

import type { HealthProfile } from '../../types/cycle.types';

// ─── WHAT WE KNOW ────────────────────────────────────────────────────

/**
 * A snapshot of the inputs, as the app can see them. Deliberately not
 * `PredictionInput` — the UI can build this without constructing a prediction,
 * and the engine stays testable with plain objects.
 */
export interface PredictionReadiness {
  /** Completed cycles derived from logged period days. */
  cycleCount: number;
  /** Is there an anchor at all? Without one there is no forecast. */
  hasLastPeriod: boolean;
  /** The spread of the user's own logged cycles, in days (SD). Null under 3. */
  cycleSpreadDays: number | null;
  healthProfile: Pick<HealthProfile, 'age' | 'averageCycleLength' | 'conditions'>;
  /** Has the user ever answered the conditions question (even with "nothing")? */
  conditionsAnswered: boolean;
  /** Two or more weight readings, far enough apart to be a change. */
  weightTracked: boolean;
  /** Check-ins in the last 7 days — stress and sleep only reach the model from these. */
  checkInsLast7: number;
  /** The confidence the predictor is currently reporting, 0..1. */
  confidence: number;
  /** The ± window it is currently reporting. */
  windowDays: number;
}

export type ImpactLevel = 'high' | 'medium' | 'small';

export interface ImprovementAction {
  id:
    | 'log_period_start'
    | 'log_more_cycles'
    | 'state_cycle_length'
    | 'answer_conditions'
    | 'add_age'
    | 'track_weight'
    | 'check_in_more'
    | 'measured_signal';
  title: string;
  /** What it does to the model, in the user's terms. */
  body: string;
  impact: ImpactLevel;
  /** True when the user has already done this — kept, so the list shows progress. */
  done: boolean;
  /** Where to go to do it, if there is a screen. */
  route?: string;
  /** Only set where we have measured it. Never a guess. */
  evidence?: string;
}

/** Sort weight. Ordering is by real effect on the forecast, §10 of the reference. */
const IMPACT_RANK: Record<ImpactLevel, number> = { high: 0, medium: 1, small: 2 };

/**
 * The ranked list. Undone actions first, most valuable first within that.
 *
 * Every entry is returned every time, done or not, so the UI can show the
 * whole picture — "four of six done" is more motivating, and more honest,
 * than a list that silently shrinks.
 */
export function improvementActions(r: PredictionReadiness): ImprovementAction[] {
  const hp = r.healthProfile;
  const out: ImprovementAction[] = [];

  // ─── 1. The anchor. Without it there is nothing to predict from. ──
  out.push({
    id: 'log_period_start',
    title: 'Log the day your period starts',
    body: 'Every forecast counts forward from that day. If it is a day or two out, so is everything else — this is the input that matters most, every single cycle.',
    impact: 'high',
    done: r.hasLastPeriod,
    route: '/(tabs)/calendar',
  });

  // ─── 2. History. The dominant input, and it saturates. ────────────
  if (r.cycleCount < 6) {
    const need = Math.max(1, Math.min(6, 6) - r.cycleCount);
    out.push({
      id: 'log_more_cycles',
      title:
        r.cycleCount === 0
          ? 'Log your first full cycle'
          : `Log ${need} more ${need === 1 ? 'cycle' : 'cycles'}`,
      body:
        r.cycleCount === 0
          ? 'Until a cycle completes, the forecast is working from what you told us at setup and nothing else. The first one changes it most.'
          : 'Each completed cycle replaces a bit more of the starting assumption with your own pattern.',
      impact: 'high',
      done: false,
      route: '/(tabs)/calendar',
      evidence:
        'Measured on our own engine: for a typical cycle, error settles at about two days by six logged cycles, and barely moves after that.',
    });
  } else {
    out.push({
      id: 'log_more_cycles',
      title: 'Six or more cycles logged',
      body: 'The model has enough history that more data will not sharpen it much further. What is left is your body’s own variation.',
      impact: 'high',
      done: true,
    });
  }

  // ─── 3. The starting estimate. Huge before history exists. ────────
  out.push({
    id: 'state_cycle_length',
    title: 'Check the cycle length you gave at setup',
    body: 'Before you have logged much, the forecast leans on that number heavily. If you guessed, it is worth correcting — it stops mattering once your own cycles take over.',
    impact: r.cycleCount >= 3 ? 'small' : 'high',
    done: hp.averageCycleLength != null,
    route: '/(profile)/about-you',
  });

  // ─── 4. Conditions. A real branch in the model. ───────────────────
  out.push({
    id: 'answer_conditions',
    title: 'Confirm your conditions',
    body: 'PCOS and thyroid conditions genuinely widen what the model expects. Ticking one you do not have makes every forecast vaguer than it needs to be — and leaving one off makes it look more certain than it should.',
    impact: 'medium',
    done: r.conditionsAnswered,
    route: '/(profile)/about-you',
  });

  // ─── 5. Age. Cheap, and it is a real term in the prior. ───────────
  out.push({
    id: 'add_age',
    title: 'Add your age',
    body: 'Cycles vary more in the teens and again around the forties. Knowing which end of that you are on lets the forecast set an honest range from day one.',
    impact: 'medium',
    done: hp.age != null,
    route: '/(profile)/about-you',
  });

  // ─── 6. Weight. A live term with, until now, no source. ───────────
  out.push({
    id: 'track_weight',
    title: 'Add your weight now and then',
    body: 'A swing of more than about 5 kg in a few months is associated with cycles shifting. Two readings a few weeks apart is all it takes; one reading on its own tells the model nothing.',
    impact: 'small',
    done: r.weightTracked,
    route: '/(profile)/about-you',
  });

  // ─── 7. Check-ins. Stress and sleep only arrive this way. ─────────
  out.push({
    id: 'check_in_more',
    title: 'Check in on the days you can',
    body: 'High stress and poor sleep are the only day-to-day inputs that move the predicted date. They reach the model through your check-ins, so a week with none is a week the forecast cannot see.',
    impact: 'small',
    done: r.checkInsLast7 >= 3,
    route: '/(modals)/daily-checkin',
  });

  // ─── 8. THE CEILING ───────────────────────────────────────────────
  //
  //  For a genuinely variable cycle, no amount of logging closes the gap —
  //  the error IS the variance. Saying so is more useful than another nudge,
  //  and it is the one place where we name what the app does NOT collect.
  if (r.cycleSpreadDays !== null && r.cycleSpreadDays >= 4) {
    out.push({
      id: 'measured_signal',
      title: 'Your cycles vary a lot — and that is the real limit',
      body: `Your own cycles swing by around ${Math.round(r.cycleSpreadDays)} days. No amount of extra logging can predict past that, because the remaining error is your body rather than the maths. A measured signal — an ovulation test, waking temperature, cervical fluid — is the only thing that would go further, and Dottie does not collect those yet.`,
      impact: 'medium',
      done: false,
      evidence:
        'Measured on our own engine: with a 5-day swing, twelve logged cycles still leaves about four days of error.',
    });
  }

  return out.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact];
  });
}

// ─── WHY THE NUMBER IS THE NUMBER ────────────────────────────────────

export interface ConfidenceFactor {
  label: string;
  /** 'lifts' / 'lowers' / 'neutral' — the direction this pushes confidence. */
  direction: 'lifts' | 'lowers' | 'neutral';
  detail: string;
}

/**
 * A plain-language breakdown of the current confidence figure.
 *
 * Mirrors the actual arithmetic in `predictor.ts` §6: spread → confidence,
 * scaled by data volume, minus condition and age reductions, plus the
 * premenstrual narrowing. If that code changes, this must change with it —
 * `test:improve` asserts the directions against real predictor output.
 */
export function confidenceBreakdown(r: PredictionReadiness): ConfidenceFactor[] {
  const out: ConfidenceFactor[] = [];
  const hp = r.healthProfile;

  if (r.cycleCount === 0) {
    out.push({
      label: 'No completed cycles yet',
      direction: 'lowers',
      detail: 'The forecast is running on the cycle length you gave at setup. This is the biggest single reason the figure is low.',
    });
  } else if (r.cycleCount < 6) {
    out.push({
      label: `${r.cycleCount} ${r.cycleCount === 1 ? 'cycle' : 'cycles'} logged`,
      direction: 'lowers',
      detail: 'Enough to have started learning your pattern, not yet enough to be sure of it. The figure climbs as this grows, up to about six.',
    });
  } else {
    out.push({
      label: `${r.cycleCount} cycles logged`,
      direction: 'lifts',
      detail: 'Enough history for the model to be working from you rather than from an assumption.',
    });
  }

  if (r.cycleSpreadDays !== null) {
    const tight = r.cycleSpreadDays < 2;
    out.push({
      label: `Your cycles swing by about ${Math.round(r.cycleSpreadDays)} ${
        Math.round(r.cycleSpreadDays) === 1 ? 'day' : 'days'
      }`,
      direction: tight ? 'lifts' : 'lowers',
      detail: tight
        ? 'A steady cycle is the strongest thing a forecast can have. Nothing else raises confidence this much.'
        : 'This is the ceiling on how sharp any forecast can be for you, and it is about your body rather than the app.',
    });
  }

  const engineConditions = hp.conditions.filter((c) =>
    ['pcos', 'pcod', 'thyroid', 'hypothyroid', 'hyperthyroid'].includes(c)
  );
  if (engineConditions.length > 0) {
    out.push({
      label: 'Conditions you told us about',
      direction: 'lowers',
      detail: 'These widen the range the model expects on purpose. The figure is lower because the honest answer is less certain — not because anything is wrong.',
    });
  }

  if (hp.age !== null && (hp.age < 16 || hp.age > 40)) {
    out.push({
      label: 'Your age group',
      direction: 'lowers',
      detail: 'Cycles vary more in the teens and around the forties, so the forecast holds a wider range for both.',
    });
  }

  if (hp.age === null) {
    out.push({
      label: 'Age not set',
      direction: 'neutral',
      detail: 'Without it the model uses a middle assumption. Adding it makes the range fit you rather than the average.',
    });
  }

  return out;
}

/** The label the app shows beside the percentage. Mirrors `predictor.ts` §7. */
export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.65) return 'Good';
  if (confidence >= 0.5) return 'Moderate';
  return 'Still learning';
}
