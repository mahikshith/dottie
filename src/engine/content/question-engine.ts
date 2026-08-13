/**
 * Dottie — Phase-Responsive Question Engine
 *
 * Powers the daily check-in prompts on the home screen. Each day the
 * user sees 2-3 short questions tailored to their current cycle phase,
 * mode, and recent symptoms — wrapped in their companion's voice.
 *
 * ─── WHY PHASE-RESPONSIVE QUESTIONS MATTER ──────────────────────────
 *
 * Generic apps ask the same thing every day ("Rate your mood 1-10").
 * Dottie asks what's actually RELEVANT:
 *   - Menstrual day 1: "How are your cramps today?"
 *   - Follicular day 4: "Feeling that energy boost? What feels possible?"
 *   - Ovulatory day 1: "Noticing extra confidence today?"
 *   - Luteal day 22: "Sleep quality dipping? Cravings ramping?"
 *
 * This means:
 *   - Questions feel SEEN, not robotic
 *   - We gather the RIGHT data at the RIGHT time
 *   - Symptom correlations get richer (because we asked when it mattered)
 *
 * ─── PIPELINE ───────────────────────────────────────────────────────
 *
 *  HomeScreen.mount()
 *    → QuestionEngine.getTodaysQuestions(input)
 *    → resolve cohort question pool from ContentResolver
 *    → deterministically pick N questions (default 3)
 *    → wrap each question text in companion voice
 *    → return RenderedQuestion[] ready for UI
 *
 *  HomeScreen.onAnswer(questionId, value)
 *    → QuestionEngine.markAnswered(questionId)
 *    → filtered out of today's pool to avoid re-showing
 *
 * ─── PERFORMANCE ────────────────────────────────────────────────────
 *
 *  Cold render:  ~10ms (resolver lookup + N interpolations)
 *  Warm render:  <1ms (session cache hit)
 *  Per-answer mark: <1ms (in-memory set update)
 */

import {
  PhaseQuestion,
  QuestionResponseType,
  TrackedMetric,
} from '../../types/content.types';
import {
  CompanionType,
  CompanionMood,
  DialogueContext,
  MoodCondition,
} from '../../types/companion.types';
import { Phase, UserMode } from '../../types/cycle.types';
import {
  ContentResolver,
  RecentSymptom,
  buildStateKeyFromInputs,
} from './content-resolver';
import {
  wrapQuestion,
  selectMood,
  buildContext,
} from './companion-dialogue';

// ─── RENDERED QUESTION (UI-READY) ────────────────────────────────────

/**
 * A fully rendered phase question, ready for display.
 * Contains both the raw question text AND the companion-wrapped version.
 */
export interface RenderedQuestion {
  /** Stable question ID (used for answer tracking + analytics) */
  id: string;
  /** The phase this question targets */
  phase: Phase;
  /** Response input type (drives UI control choice) */
  responseType: QuestionResponseType;
  /** Available response options (e.g., ["None", "Mild", "Strong"]) */
  options: string[];
  /** Original question text (unwrapped — useful for accessibility) */
  rawText: string;
  /** Question text wrapped in user's companion voice */
  companionText: string;
  /** Which metric this question's answer maps to */
  tracksMetric: TrackedMetric;
  /** State key that produced this question (for analytics) */
  stateKey: string;
  /** Date this question was rendered for (ISO YYYY-MM-DD) */
  forDate: string;
}

// ─── INPUT TYPES ─────────────────────────────────────────────────────

export interface QuestionEngineInput {
  phase: Phase;
  dayInPhase: number;
  dayInCycle: number;
  mode: UserMode;
  companionType: CompanionType;
  streakCount: number;
  recentSymptoms?: RecentSymptom[];
  activeConditions?: MoodCondition[];
  /** How many questions to show today (default 3) */
  questionsPerDay?: number;
  /** Question IDs the user has already answered today */
  answeredToday?: string[];
  /** Today's date (ISO YYYY-MM-DD). Defaults to system date. */
  today?: string;
  /** Optional time-of-day override (for testing) */
  now?: Date;
}

// ─── THE QUESTION ENGINE ─────────────────────────────────────────────

/**
 * QuestionEngine — resolves and renders today's phase-responsive questions.
 *
 * Lifecycle:
 *   1. Construct once at app startup with a shared ContentResolver
 *   2. Call getTodaysQuestions() on home screen mount
 *   3. Call markAnswered(questionId) as user answers each one
 *   4. Call clearForDate() at midnight to reset
 */
export class QuestionEngine {
  /** Daily cache: stateKey + date → rendered question selection */
  private dailyCache = new Map<string, RenderedQuestion[]>();

  /** Track which questions the user has answered today (by date) */
  private answeredByDate = new Map<string, Set<string>>();

  constructor(private resolver: ContentResolver) {}

  /**
   * Get today's rendered question set for this user.
   *
   * Returns at most `questionsPerDay` questions, filtered to:
   *   - Not yet answered today
   *   - Matching the user's phase + mode + symptom cluster
   *
   * Returns an empty array if the user has answered everything available.
   */
  getTodaysQuestions(input: QuestionEngineInput): RenderedQuestion[] {
    const today = input.today ?? new Date().toISOString().split('T')[0]!;
    const questionsPerDay = input.questionsPerDay ?? 3;

    // Build the cohort state key
    const { stateKey } = buildStateKeyFromInputs({
      phase: input.phase,
      dayInPhase: input.dayInPhase,
      mode: input.mode,
      recentSymptoms: input.recentSymptoms,
    });

    const cacheKey = `${stateKey}::${today}`;
    const cached = this.dailyCache.get(cacheKey);

    // Get answered set (merge cached + caller-provided)
    const answered = this.getAnsweredSet(today, input.answeredToday);

    // If we have a cached pool, filter and return
    if (cached) {
      return filterUnanswered(cached, answered).slice(0, questionsPerDay);
    }

    // Cold path: resolve pool from cohort, render, cache
    const pool = this.resolver.resolve<PhaseQuestion[]>(stateKey, 'questions');
    const finalPool = pool ?? this.findFallbackPool(input);

    if (!finalPool || finalPool.length === 0) {
      // Last-resort: use built-in defaults for this phase
      return this.renderDefaultQuestions(input, today, stateKey, questionsPerDay);
    }

    // Render all available questions (cache full set; filter on return)
    const context = this.buildDialogueContext(input);
    const mood = selectMood(
      input.activeConditions ?? [],
      input.companionType,
      input.phase
    );

    const renderedAll = finalPool.map(q =>
      renderQuestion({
        question: q,
        companionType: input.companionType,
        mood,
        context,
        stateKey,
        forDate: today,
      })
    );

    // Cache the full rendered set for the day
    this.dailyCache.set(cacheKey, renderedAll);

    // Return only unanswered ones, up to the daily limit
    return filterUnanswered(renderedAll, answered).slice(0, questionsPerDay);
  }

  /**
   * Mark a question as answered today.
   * Called from the home screen after the user submits a response.
   */
  markAnswered(questionId: string, today?: string): void {
    const date = today ?? new Date().toISOString().split('T')[0]!;
    const set = this.answeredByDate.get(date) ?? new Set<string>();
    set.add(questionId);
    this.answeredByDate.set(date, set);
  }

  /**
   * Check whether a question has been answered today.
   */
  isAnswered(questionId: string, today?: string): boolean {
    const date = today ?? new Date().toISOString().split('T')[0]!;
    return this.answeredByDate.get(date)?.has(questionId) ?? false;
  }

  /**
   * Get count of questions answered today.
   * Used for the "all questions answered" bonus XP/Gem reward.
   */
  getAnsweredCountToday(today?: string): number {
    const date = today ?? new Date().toISOString().split('T')[0]!;
    return this.answeredByDate.get(date)?.size ?? 0;
  }

  /**
   * Check if the user answered ALL of today's questions.
   * Used to award the "allQuestionsAnswered" bonus in xp.ts / gems.ts.
   */
  didAnswerAllToday(input: QuestionEngineInput): boolean {
    const today = input.today ?? new Date().toISOString().split('T')[0]!;
    const all = this.getTodaysQuestions({ ...input, answeredToday: [] });
    const answered = this.answeredByDate.get(today);
    if (!answered || all.length === 0) return false;
    return all.every(q => answered.has(q.id));
  }

  /**
   * Clear cached questions and answer tracking for a specific date.
   * Call at midnight to reset for the new day.
   */
  clearForDate(date: string): void {
    // Remove daily cache entries for this date
    for (const key of Array.from(this.dailyCache.keys())) {
      if (key.endsWith(`::${date}`)) {
        this.dailyCache.delete(key);
      }
    }
    this.answeredByDate.delete(date);
  }

  /**
   * Clear ALL caches (e.g., on logout or major state change).
   */
  clearAll(): void {
    this.dailyCache.clear();
    this.answeredByDate.clear();
  }

  /**
   * Drop entries older than the given date (memory hygiene).
   * Keeps today + future, removes past.
   */
  evictOldEntries(today: string): number {
    let removed = 0;

    for (const key of Array.from(this.dailyCache.keys())) {
      const datePart = key.split('::')[1];
      if (datePart && datePart < today) {
        this.dailyCache.delete(key);
        removed++;
      }
    }

    for (const date of Array.from(this.answeredByDate.keys())) {
      if (date < today) {
        this.answeredByDate.delete(date);
        removed++;
      }
    }

    return removed;
  }

  // ─── INTERNAL HELPERS ────────────────────────────────────────────

  /**
   * Build the merged answered set: in-engine tracked + caller-provided.
   * Caller can pass answered IDs from persistent storage (DB) when
   * the engine's in-memory state was cleared (e.g., app restart).
   */
  private getAnsweredSet(
    today: string,
    callerProvided?: string[]
  ): Set<string> {
    const set = new Set<string>(this.answeredByDate.get(today) ?? []);
    if (callerProvided) {
      for (const id of callerProvided) set.add(id);
    }
    return set;
  }

  /**
   * Build dialogue context for rendering.
   */
  private buildDialogueContext(input: QuestionEngineInput): DialogueContext {
    return buildContext({
      companionType: input.companionType,
      phase: input.phase,
      dayInPhase: input.dayInPhase,
      dayInCycle: input.dayInCycle,
      streakCount: input.streakCount,
      now: input.now,
    });
  }

  /**
   * Fallback pool lookup with the same degradation chain as Daily Decode:
   *   1. Drop the symptom cluster (most users)
   *   2. Drop the mode to 'adult'
   *   3. Generic: phase + day 4-7 + adult + none
   */
  private findFallbackPool(input: QuestionEngineInput): PhaseQuestion[] | null {
    const dayBand = bandForDay(input.dayInPhase);

    // Fallback 1: drop cluster
    const noCluster = `${input.phase}_${dayBand}_${input.mode}_none`;
    let pool = this.resolver.resolve<PhaseQuestion[]>(noCluster, 'questions');
    if (pool && pool.length > 0) return pool;

    // Fallback 2: drop mode to 'adult'
    if (input.mode !== 'adult') {
      const adultMode = `${input.phase}_${dayBand}_adult_none`;
      pool = this.resolver.resolve<PhaseQuestion[]>(adultMode, 'questions');
      if (pool && pool.length > 0) return pool;
    }

    // Fallback 3: most generic for the phase
    const generic = `${input.phase}_4-7_adult_none`;
    pool = this.resolver.resolve<PhaseQuestion[]>(generic, 'questions');
    if (pool && pool.length > 0) return pool;

    return null;
  }

  /**
   * Render built-in default questions when no cohort content is registered.
   * Ensures the home screen ALWAYS has questions, even on day 1 of content
   * rollout.
   */
  private renderDefaultQuestions(
    input: QuestionEngineInput,
    today: string,
    stateKey: string,
    limit: number
  ): RenderedQuestion[] {
    const defaults = DEFAULT_QUESTIONS_BY_PHASE[input.phase];
    const context = this.buildDialogueContext(input);
    const mood = selectMood(
      input.activeConditions ?? [],
      input.companionType,
      input.phase
    );

    const rendered = defaults.map(q =>
      renderQuestion({
        question: q,
        companionType: input.companionType,
        mood,
        context,
        stateKey: `default::${stateKey}`,
        forDate: today,
      })
    );

    const answered = this.getAnsweredSet(today, input.answeredToday);
    return filterUnanswered(rendered, answered).slice(0, limit);
  }
}

// ─── INTERNAL: RENDERING ─────────────────────────────────────────────

function renderQuestion(args: {
  question: PhaseQuestion;
  companionType: CompanionType;
  mood: CompanionMood;
  context: DialogueContext;
  stateKey: string;
  forDate: string;
}): RenderedQuestion {
  const { question, companionType, mood, context, stateKey, forDate } = args;

  // 1. Prefer a baked-in companion variant if the content author provided one
  const baked = question.companionVariants?.[companionType];

  // 2. Otherwise wrap the raw question text in companion voice
  const companionText = baked
    ? baked
    : wrapQuestion(companionType, question.text, context, mood);

  return {
    id: question.id,
    phase: question.phase,
    responseType: question.type,
    options: question.options,
    rawText: question.text,
    companionText,
    tracksMetric: question.tracksMetric,
    stateKey,
    forDate,
  };
}

function filterUnanswered(
  questions: RenderedQuestion[],
  answered: Set<string>
): RenderedQuestion[] {
  return questions.filter(q => !answered.has(q.id));
}

function bandForDay(dayInPhase: number): string {
  if (dayInPhase <= 3) return '1-3';
  if (dayInPhase <= 7) return '4-7';
  if (dayInPhase <= 11) return '8-11';
  return '12-14';
}

// ─── DEFAULT QUESTIONS PER PHASE (fallback content) ──────────────────

/**
 * Built-in default questions per phase. Used when the cohort content
 * table has no questions registered yet — guarantees the home screen
 * is never empty.
 *
 * These intentionally use 'adult' mode + 'none' cluster as a generic
 * baseline. Real content authoring will produce richer cohort-specific
 * variants over time.
 */
const DEFAULT_QUESTIONS_BY_PHASE: Record<Phase, PhaseQuestion[]> = {
  menstrual: [
    makeDefault({
      id: 'def_menstrual_cramps',
      phase: 'menstrual',
      text: 'How are your cramps today?',
      type: 'scale',
      options: ['None', 'Mild', 'Moderate', 'Strong', 'Intense'],
      tracksMetric: 'cramps',
    }),
    makeDefault({
      id: 'def_menstrual_energy',
      phase: 'menstrual',
      text: 'How is your energy today?',
      type: 'scale',
      options: ['Drained', 'Low', 'Okay', 'Good', 'Great'],
      tracksMetric: 'energy',
    }),
    makeDefault({
      id: 'def_menstrual_mood',
      phase: 'menstrual',
      text: 'How are you feeling emotionally?',
      type: 'emoji',
      options: ['😢', '😕', '😐', '🙂', '😊'],
      tracksMetric: 'mood',
    }),
  ],
  follicular: [
    makeDefault({
      id: 'def_follicular_energy',
      phase: 'follicular',
      text: 'Feeling that energy boost? How are you today?',
      type: 'scale',
      options: ['Low', 'Steady', 'Lifted', 'Sharp', 'Electric'],
      tracksMetric: 'energy',
    }),
    makeDefault({
      id: 'def_follicular_focus',
      phase: 'follicular',
      text: 'How is your focus today?',
      type: 'scale',
      options: ['Scattered', 'Foggy', 'Okay', 'Sharp', 'Laser'],
      tracksMetric: 'focus',
    }),
    makeDefault({
      id: 'def_follicular_skin',
      phase: 'follicular',
      text: 'How is your skin looking today?',
      type: 'choice',
      options: ['Breakout', 'A bit oily', 'Normal', 'Clear', 'Glowing'],
      tracksMetric: 'skin',
    }),
  ],
  ovulatory: [
    makeDefault({
      id: 'def_ovulatory_social',
      phase: 'ovulatory',
      text: 'Feeling extra social or confident today?',
      type: 'scale',
      options: ['Not really', 'A little', 'Yes', 'A lot', 'On fire'],
      tracksMetric: 'social_energy',
    }),
    makeDefault({
      id: 'def_ovulatory_mood',
      phase: 'ovulatory',
      text: 'How is your mood today?',
      type: 'emoji',
      options: ['😢', '😕', '😐', '🙂', '😊'],
      tracksMetric: 'mood',
    }),
    makeDefault({
      id: 'def_ovulatory_libido',
      phase: 'ovulatory',
      text: 'Noticing a shift in your libido today?',
      type: 'boolean',
      options: ['Not really', 'Yes, a bit'],
      tracksMetric: 'libido',
    }),
  ],
  luteal: [
    makeDefault({
      id: 'def_luteal_sleep',
      phase: 'luteal',
      text: 'How was your sleep last night?',
      type: 'scale',
      options: ['Restless', 'Poor', 'Okay', 'Good', 'Deep'],
      tracksMetric: 'sleep',
    }),
    makeDefault({
      id: 'def_luteal_cravings',
      phase: 'luteal',
      text: 'Any cravings showing up today?',
      type: 'choice',
      options: ['None', 'Sweet', 'Salty', 'Carbs', 'Chocolate'],
      tracksMetric: 'cravings',
    }),
    makeDefault({
      id: 'def_luteal_mood',
      phase: 'luteal',
      text: 'How are you feeling emotionally today?',
      type: 'emoji',
      options: ['😢', '😕', '😐', '🙂', '😊'],
      tracksMetric: 'mood',
    }),
  ],
};

/**
 * Build a default question with empty companion variants — the
 * dialogue engine will wrap them at render time using wrapQuestion().
 */
function makeDefault(args: {
  id: string;
  phase: Phase;
  text: string;
  type: QuestionResponseType;
  options: string[];
  tracksMetric: TrackedMetric;
}): PhaseQuestion {
  return {
    id: args.id,
    phase: args.phase,
    mode: 'adult',
    text: args.text,
    type: args.type,
    options: args.options,
    tracksMetric: args.tracksMetric,
    companionVariants: {
      fox: '', bunny: '', butterfly: '', cat: '', owl: '', blossom: '',
    },
  };
}

// ─── PUBLIC HELPERS ──────────────────────────────────────────────────

/**
 * Validate a question pool for correctness.
 * Used by tests and content-update tooling.
 */
export function validateQuestionPool(
  pool: PhaseQuestion[]
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const seenIds = new Set<string>();

  for (const q of pool) {
    if (!q.id) errors.push('Question missing id');
    if (seenIds.has(q.id)) errors.push(`Duplicate question id: ${q.id}`);
    seenIds.add(q.id);

    if (!q.text) errors.push(`Question ${q.id} missing text`);
    if (!q.type) errors.push(`Question ${q.id} missing response type`);
    if (!q.options || q.options.length === 0) {
      errors.push(`Question ${q.id} has no response options`);
    }
    if (!q.tracksMetric) {
      errors.push(`Question ${q.id} missing tracksMetric`);
    }
  }

  return { ok: errors.length === 0, errors };
}
