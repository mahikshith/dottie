/**
 * Dottie — Daily Decode Engine
 *
 * The Daily Decode is the user's "card of the day" — a single
 * phase-aware insight + tip that appears on the home screen each morning.
 *
 * ─── HOW IT WORKS ───────────────────────────────────────────────────
 *
 *  Morning:
 *    1. Compute today's state_key (phase, dayBand, mode, symptomCluster)
 *    2. ContentResolver.resolve(stateKey, 'daily_decode')
 *       → returns a pool of cards matching this state (3-5 typically)
 *    3. Deterministically pick ONE card for today (stable per day)
 *    4. Wrap the card's intro line in the user's companion voice
 *    5. Render: title + body + tip + companion variant
 *
 *  Why deterministic selection?
 *    Same day = same card (no re-rolls if app reopens). But across days,
 *    the user sees different cards within their cohort pool — keeps
 *    things fresh without random surprises.
 *
 * ─── PERFORMANCE ────────────────���───────────────────────────────────
 *
 *  Cold render (first open of day):  ~5-10ms
 *    └─ resolver cohort lookup + interpolation
 *  Warm render (subsequent opens):   <1ms
 *    └─ session cache hit + same deterministic pick
 *
 * ─── CACHE STRATEGY ─────────────────────────────────────────────────
 *
 *  The resolver caches the CARD POOL per state_key. The Daily Decode
 *  engine adds a thin session cache keyed by (state_key + date) for
 *  the SELECTED card — so we don't re-run pick + interpolation on
 *  every render within the same day.
 */

import {
  DailyDecodeCard,
  ContentStateKey,
  DayBand,
} from '../../types/content.types';
import {
  CompanionType,
  CompanionMood,
  DialogueContext,
} from '../../types/companion.types';
import { Phase, UserMode } from '../../types/cycle.types';
import {
  ContentResolver,
  RecentSymptom,
  buildStateKeyFromInputs,
} from './content-resolver';
import {
  wrapInsight,
  selectMood,
  buildContext,
  getCompanionGreeting,
} from './companion-dialogue';
import { getCompanion } from '../../content/companions';

// ─── RENDERED DAILY DECODE (UI-READY) ────────────────────────────────

/**
 * A fully rendered Daily Decode card, ready for display.
 * Combines raw cohort content + companion personalization + context.
 */
export interface RenderedDailyDecode {
  /** Stable ID for analytics / "have I seen this?" checks */
  cardId: string;
  /** Card title (e.g., "Your Brain is Supercharging") */
  title: string;
  /** Main body content explaining what's happening biologically */
  body: string;
  /** Actionable tip for the day */
  tip: string;
  /** Card emoji */
  emoji: string;
  /** Companion-wrapped intro line — feels personal */
  companionIntro: string;
  /** The phase this card is for */
  phase: Phase;
  /** The state key that selected this card (for analytics) */
  stateKey: string;
  /** Which day this card is showing for (ISO YYYY-MM-DD) */
  forDate: string;
}

// ─── SELECTION INPUT ─────────────────────────────────────────────────

/**
 * Inputs needed to render today's Daily Decode card.
 */
export interface DailyDecodeInput {
  phase: Phase;
  dayInPhase: number;
  dayInCycle: number;
  mode: UserMode;
  companionType: CompanionType;
  streakCount: number;
  recentSymptoms?: RecentSymptom[];
  /** Active mood conditions (from gamification + behavior tracking) */
  activeConditions?: import('../../types/companion.types').MoodCondition[];
  /** Today's date (ISO YYYY-MM-DD). Defaults to system date. */
  today?: string;
  /** Optional time-of-day override (mostly for testing) */
  now?: Date;
}

// ─── THE DAILY DECODE ENGINE ─────────────────────────────────────────

/**
 * DailyDecodeEngine — resolves and renders the user's card of the day.
 *
 * Lifecycle:
 *   1. Construct once at app startup with a shared ContentResolver
 *   2. Call getTodaysCard() on every home screen mount
 *   3. Call clearDailyCache() at midnight (or on user logout)
 */
export class DailyDecodeEngine {
  /**
   * Selection cache: stateKey + date → rendered card
   * Avoids re-picking and re-rendering when the home screen remounts.
   */
  private dailyCache = new Map<string, RenderedDailyDecode>();

  constructor(private resolver: ContentResolver) {}

  /**
   * Get today's rendered Daily Decode card for this user.
   *
   * Returns null if no content is registered for this cohort state —
   * the UI should show a friendly fallback in that case.
   */
  getTodaysCard(input: DailyDecodeInput): RenderedDailyDecode | null {
    const today = input.today ?? new Date().toISOString().split('T')[0]!;

    // Build the cohort state key for this user RIGHT NOW
    const { stateKey, state } = buildStateKeyFromInputs({
      phase: input.phase,
      dayInPhase: input.dayInPhase,
      mode: input.mode,
      recentSymptoms: input.recentSymptoms,
    });

    // Daily cache check — same user, same day, same state → instant return
    const cacheKey = `${stateKey}::${today}`;
    const cached = this.dailyCache.get(cacheKey);
    if (cached) return cached;

    // Fetch the card pool for this cohort from the resolver
    const cardPool = this.resolver.resolve<DailyDecodeCard[]>(
      stateKey,
      'daily_decode'
    );

    // Try fallback strategies if no exact match
    const finalPool =
      cardPool ?? this.findFallbackPool(state, input.recentSymptoms);

    if (!finalPool || finalPool.length === 0) {
      return null;
    }

    // Deterministically pick today's card from the pool
    const selectedCard = pickCardForDay(finalPool, today, input.dayInCycle);

    // Build dialogue context
    const context: DialogueContext = buildContext({
      companionType: input.companionType,
      phase: input.phase,
      dayInPhase: input.dayInPhase,
      dayInCycle: input.dayInCycle,
      streakCount: input.streakCount,
      now: input.now,
    });

    // Pick the right mood based on user state
    const mood: CompanionMood = selectMood(
      input.activeConditions ?? [],
      input.companionType,
      input.phase
    );

    // Render the card with companion voice
    const rendered = renderCard({
      card: selectedCard,
      companionType: input.companionType,
      mood,
      context,
      stateKey,
      forDate: today,
    });

    // Cache the rendered result for the rest of the day
    this.dailyCache.set(cacheKey, rendered);
    return rendered;
  }

  /**
   * Preview which card the user would see tomorrow (used by prefetch).
   * Does NOT cache the result — only used to warm the cohort cache.
   */
  previewTomorrow(input: DailyDecodeInput): RenderedDailyDecode | null {
    const today = input.today ?? new Date().toISOString().split('T')[0]!;
    const tomorrow = addDays(today, 1);

    return this.getTodaysCard({
      ...input,
      dayInPhase: input.dayInPhase + 1,
      dayInCycle: input.dayInCycle + 1,
      today: tomorrow,
    });
  }

  /**
   * Render a simple fallback when no card is available for this cohort.
   * Uses the companion's default phase greeting + a generic phase tip.
   */
  getFallbackCard(input: DailyDecodeInput): RenderedDailyDecode {
    const today = input.today ?? new Date().toISOString().split('T')[0]!;
    const companion = getCompanion(input.companionType);
    const greeting = getCompanionGreeting(input.companionType, input.phase);

    return {
      cardId: `fallback_${input.phase}`,
      title: getDefaultTitle(input.phase),
      body: getDefaultBody(input.phase),
      tip: getDefaultTip(input.phase),
      emoji: getDefaultEmoji(input.phase),
      companionIntro: greeting,
      phase: input.phase,
      stateKey: `fallback::${input.phase}::${input.mode}`,
      forDate: today,
    };
  }

  /**
   * Clear the daily selection cache.
   * Should be called at midnight + on user logout.
   */
  clearDailyCache(): void {
    this.dailyCache.clear();
  }

  /**
   * Drop only entries older than the given date (memory hygiene).
   * Safe to call periodically — keeps today + future, removes past.
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
    return removed;
  }

  /**
   * Try fallback strategies when the exact cohort has no card.
   * Order:
   *   1. Same phase + dayBand + mode, but cluster='none' (drop cluster)
   *   2. Same phase + dayBand, but mode='adult' (fall back to adult content)
   *   3. Same phase + dayBand='4-7' + mode='adult' + cluster='none' (most generic)
   *
   * This lets us ship with partial content coverage and gracefully degrade
   * instead of showing nothing.
   */
  private findFallbackPool(
    state: ContentStateKey,
    _recentSymptoms?: RecentSymptom[]
  ): DailyDecodeCard[] | null {
    // Fallback 1: drop the cluster
    const noCluster = `${state.phase}_${state.dayBand}_${state.mode}_none`;
    let pool = this.resolver.resolve<DailyDecodeCard[]>(
      noCluster,
      'daily_decode'
    );
    if (pool && pool.length > 0) return pool;

    // Fallback 2: drop mode to 'adult'
    if (state.mode !== 'adult') {
      const adultMode = `${state.phase}_${state.dayBand}_adult_none`;
      pool = this.resolver.resolve<DailyDecodeCard[]>(adultMode, 'daily_decode');
      if (pool && pool.length > 0) return pool;
    }

    // Fallback 3: most generic for this phase
    const generic = `${state.phase}_4-7_adult_none`;
    pool = this.resolver.resolve<DailyDecodeCard[]>(generic, 'daily_decode');
    if (pool && pool.length > 0) return pool;

    return null;
  }
}

// ─── INTERNAL: CARD PICKING & RENDERING ──────────────────────────────

/**
 * Deterministically pick a card from the pool for a given day.
 *
 * Stable per (date + dayInCycle) so:
 *   - Same day always picks the same card (no re-rolls on app reopen)
 *   - Different days within the same cohort cycle through the pool
 *   - Across cycles, the same day-of-cycle gets a different card
 *     (because the date changes), keeping content fresh
 */
function pickCardForDay(
  pool: DailyDecodeCard[],
  date: string,
  dayInCycle: number
): DailyDecodeCard {
  // Hash date string (YYYY-MM-DD) into a number
  let hash = 0;
  for (let i = 0; i < date.length; i++) {
    hash = (hash * 31 + date.charCodeAt(i)) >>> 0;
  }
  hash = (hash + dayInCycle * 17) >>> 0;
  return pool[hash % pool.length]!;
}

/**
 * Render a single card with companion voice + interpolation.
 */
function renderCard(args: {
  card: DailyDecodeCard;
  companionType: CompanionType;
  mood: CompanionMood;
  context: DialogueContext;
  stateKey: string;
  forDate: string;
}): RenderedDailyDecode {
  const { card, companionType, mood, context, stateKey, forDate } = args;

  // 1. The companion-specific intro line baked into the card (if present)
  const bakedVariant = card.companionVariants?.[companionType];

  // 2. The body becomes the "rendered_insight" placeholder content
  //    The dialogue engine wraps it with the companion's tone.
  const companionIntro = bakedVariant
    ? bakedVariant
    : wrapInsight(companionType, card.title, context, mood);

  return {
    cardId: card.id,
    title: card.title,
    body: card.body,
    tip: card.tip,
    emoji: card.emoji,
    companionIntro,
    phase: card.phase,
    stateKey,
    forDate,
  };
}

// ─── FALLBACK CONTENT (used when cohort table is empty) ──────────────

function getDefaultTitle(phase: Phase): string {
  switch (phase) {
    case 'menstrual':
      return 'Today is a Rest Day';
    case 'follicular':
      return 'Energy is Rising';
    case 'ovulatory':
      return 'Peak Energy Window';
    case 'luteal':
      return 'Time to Slow Down';
  }
}

function getDefaultBody(phase: Phase): string {
  switch (phase) {
    case 'menstrual':
      return (
        'Your body is doing the brave work of renewal. Hormones are at their ' +
        'lowest, which is why energy feels low — that’s biology, not weakness.'
      );
    case 'follicular':
      return (
        'Estrogen is climbing, which often means sharper focus, more energy, ' +
        'and a brighter mood. Great window for trying new things or tackling ' +
        'challenging tasks.'
      );
    case 'ovulatory':
      return (
        'You’re at peak hormone levels right now. Verbal fluency, social ' +
        'confidence, and physical strength tend to peak in this short window. ' +
        'Enjoy it — it doesn’t last long.'
      );
    case 'luteal':
      return (
        'Progesterone is dominant now — its calming effect can feel like ' +
        'slowness or sleepiness. Honoring this slower rhythm is wisdom, ' +
        'not laziness.'
      );
  }
}

function getDefaultTip(phase: Phase): string {
  switch (phase) {
    case 'menstrual':
      return 'Cozy clothes, warm drinks, gentle movement. Cancel the optional plans.';
    case 'follicular':
      return 'Schedule the important conversation or that new workout today.';
    case 'ovulatory':
      return 'Lean into social plans and creative work — you’re in your zone.';
    case 'luteal':
      return 'Earlier bedtime, magnesium-rich foods, gentler workouts.';
  }
}

function getDefaultEmoji(phase: Phase): string {
  switch (phase) {
    case 'menstrual':
      return '🌊';
    case 'follicular':
      return '🌱';
    case 'ovulatory':
      return '☀️';
    case 'luteal':
      return '🌙';
  }
}

// ─── DATE HELPERS ────────────────────────────────────────────────────

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0]!;
}

// ─── PUBLIC HELPER: bulk card validation ─────────────────────────────

/**
 * Validate that a card pool is well-formed.
 * Used by tests and by content-update tooling later.
 */
export function validateCardPool(
  pool: DailyDecodeCard[]
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const seenIds = new Set<string>();

  for (const card of pool) {
    if (!card.id) errors.push('Card missing id');
    if (seenIds.has(card.id)) errors.push(`Duplicate card id: ${card.id}`);
    seenIds.add(card.id);

    if (!card.title) errors.push(`Card ${card.id} missing title`);
    if (!card.body) errors.push(`Card ${card.id} missing body`);
    if (!card.tip) errors.push(`Card ${card.id} missing tip`);
    if (!card.emoji) errors.push(`Card ${card.id} missing emoji`);

    const variants = card.companionVariants ?? {};
    const companionKeys: CompanionType[] = [
      'fox', 'bunny', 'butterfly', 'cat', 'owl', 'blossom',
    ];
    for (const key of companionKeys) {
      if (!variants[key]) {
        errors.push(`Card ${card.id} missing companion variant for ${key}`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Re-export the DayBand type for convenience (used by content authoring).
 */
export type { DayBand };
