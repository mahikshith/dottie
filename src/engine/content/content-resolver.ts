/**
 * Dottie — Content Resolver (Shared Context Cache)
 *
 * The HEART of the content engine. Every piece of phase-aware content
 * (Daily Decode cards, phase questions, tips, predictions) is keyed by
 * a "state_key" — a deterministic hash of:
 *   - phase (menstrual / follicular / ovulatory / luteal)
 *   - dayBand (1-3 / 4-7 / 8-11 / 12-14)
 *   - mode (teen / adult / endocrine)
 *   - symptomCluster (pain / fatigue / mood / skin / none)
 *
 * Total unique states: 4 × 4 × 3 × 5 = 240
 * Total users:        millions
 * → Each state serves thousands of users with the SAME base content.
 *
 * Personalization (companion voice, streak count) is applied locally
 * as a thin wrapper layer — cheap, zero network cost.
 *
 * ─── CACHE ARCHITECTURE ─────────────────────────────────────────────
 *
 *  ┌─ Session Cache ──────────────────────┐  (in-memory, RAM)
 *  │ Key: state_key + contentType         │  <1ms hit
 *  │ Lifetime: app session                │
 *  │ Size: ~5KB (current state only)      │
 *  └──────────────────────────────────────┘
 *               │ miss
 *               ▼
 *  ┌─ Prefetch Cache ─────────────────────┐  (in-memory, RAM)
 *  │ Key: tomorrow's predicted state_key  │  <2ms hit
 *  │ Lifetime: until midnight             │
 *  │ Size: ~10KB (tomorrow + transitions) │
 *  └──────────────────────────────────────┘
 *               │ miss
 *               ▼
 *  ┌─ Cohort Provider ────────────────────┐  (SQLite, later)
 *  │ Key: state_key                       │  <5ms lookup
 *  │ Lifetime: app lifetime               │
 *  │ Size: ~200KB (all 240 states)        │
 *  └──────────────────────────────────────┘
 */

import {
  ContentStateKey,
  DayBand,
  SymptomCluster,
  buildStateKey,
} from '../../types/content.types';
import { Phase, UserMode } from '../../types/cycle.types';

// ─── CONTENT TYPES THE RESOLVER CAN SERVE ─────────────────────────────

/**
 * Categories of content keyed by cohort state.
 * Each cohort can have multiple content types associated with it.
 */
export type CohortContentType =
  | 'daily_decode'      // Phase insight card
  | 'questions'         // Phase-responsive questions
  | 'tips'              // Phase-specific tips
  | 'predictions'       // "Dottie Predicts" templates
  | 'phase_weather';    // Global pulse data

// ─── PROVIDER INTERFACE (Pluggable Storage) ───────────────────────────

/**
 * The cohort content provider — fetches content for a given state_key.
 *
 * Initial implementation: in-memory static data (bundled with app)
 * Future implementation: SQLite query (lazy-loaded from `cohort_content` table)
 *
 * The resolver doesn't care which — it just calls `getContent(stateKey, type)`.
 */
export interface CohortContentProvider {
  /**
   * Fetch raw content for a state + content type.
   * Returns null if no content registered for this combination.
   */
  getContent<T = unknown>(
    stateKey: string,
    contentType: CohortContentType
  ): T | null;

  /**
   * List all state_keys that have content registered.
   * Used for diagnostics and validation.
   */
  listKnownStates(): string[];
}

// ─── DAY BAND MAPPING ─────────────────────────────────────────────────

/**
 * Map a day-in-phase number to its day-band.
 * Day-bands group similar-feeling days so we don't need 28 unique content sets.
 *
 *   Day 1-3:  Early in phase — adjustment period
 *   Day 4-7:  Mid-phase — steady state
 *   Day 8-11: Late mid-phase — transition signals
 *   Day 12-14: Late phase — preparing for next phase
 *
 * Days beyond 14 wrap into the 12-14 band (rare for any single phase).
 */
export function getDayBand(dayInPhase: number): DayBand {
  if (dayInPhase <= 3) return '1-3';
  if (dayInPhase <= 7) return '4-7';
  if (dayInPhase <= 11) return '8-11';
  return '12-14';
}

// ─── SYMPTOM CLUSTER DETECTION ────────────────────────────────────────

/**
 * A recent symptom log entry (last 7 days).
 * Used to detect the user's current dominant symptom cluster.
 */
export interface RecentSymptom {
  category: 'physical' | 'emotional' | 'skin' | 'energy' | 'sleep';
  symptomType: string;
  severity: number; // 1-10
  date: string;     // ISO YYYY-MM-DD
}

/**
 * Detect the user's dominant symptom cluster from recent logs.
 *
 * This is used to refine content delivery — a user in luteal phase
 * with high pain gets different content than someone in luteal with
 * mostly mood symptoms.
 *
 * Algorithm:
 * 1. Weight recent logs (last 3 days = full weight, days 4-7 = half weight)
 * 2. Sum severity by cluster
 * 3. Return the cluster with the highest weighted score
 * 4. If nothing is significant, return 'none'
 *
 * @param recentSymptoms - Symptom logs from last 7 days
 * @param today - Today's date (for recency weighting)
 */
export function detectSymptomCluster(
  recentSymptoms: RecentSymptom[],
  today: string = new Date().toISOString().split('T')[0]!
): SymptomCluster {
  if (recentSymptoms.length === 0) return 'none';

  const clusterScores: Record<SymptomCluster, number> = {
    pain: 0,
    fatigue: 0,
    mood: 0,
    skin: 0,
    none: 0,
  };

  for (const symptom of recentSymptoms) {
    const daysAgo = daysBetween(symptom.date, today);
    if (daysAgo > 7) continue;

    // Recent logs weigh more heavily
    const weight = daysAgo <= 3 ? 1.0 : 0.5;
    const score = symptom.severity * weight;

    const cluster = mapSymptomToCluster(symptom);
    if (cluster !== 'none') {
      clusterScores[cluster] += score;
    }
  }

  // Find the cluster with the highest score
  let topCluster: SymptomCluster = 'none';
  let topScore = 0;

  for (const [cluster, score] of Object.entries(clusterScores) as [
    SymptomCluster,
    number
  ][]) {
    if (cluster === 'none') continue;
    if (score > topScore) {
      topScore = score;
      topCluster = cluster;
    }
  }

  // Require a minimum threshold to call it "significant"
  // Below 5 cumulative severity, content stays general (cluster='none')
  return topScore >= 5 ? topCluster : 'none';
}

/**
 * Map a single symptom log to a content cluster.
 * Multiple symptoms map to the same cluster (e.g., cramps + headache → pain).
 */
function mapSymptomToCluster(symptom: RecentSymptom): SymptomCluster {
  const type = symptom.symptomType.toLowerCase();

  // Pain cluster
  if (
    type.includes('cramp') ||
    type.includes('pain') ||
    type.includes('headache') ||
    type.includes('back') ||
    type.includes('breast')
  ) {
    return 'pain';
  }

  // Fatigue cluster
  if (
    type.includes('tired') ||
    type.includes('fatigue') ||
    type.includes('exhausted') ||
    type.includes('sleep') ||
    symptom.category === 'energy' ||
    symptom.category === 'sleep'
  ) {
    return 'fatigue';
  }

  // Mood cluster
  if (
    type.includes('anxiety') ||
    type.includes('sad') ||
    type.includes('irritable') ||
    type.includes('mood') ||
    type.includes('stress') ||
    symptom.category === 'emotional'
  ) {
    return 'mood';
  }

  // Skin cluster
  if (
    type.includes('acne') ||
    type.includes('breakout') ||
    type.includes('skin') ||
    type.includes('oily') ||
    type.includes('dry') ||
    symptom.category === 'skin'
  ) {
    return 'skin';
  }

  return 'none';
}

// ─── STATE KEY BUILDING ───────────────────────────────────────────────

/**
 * Build a content state_key from raw inputs.
 * Convenience wrapper around buildStateKey() with day-band conversion.
 */
export function buildStateKeyFromInputs(input: {
  phase: Phase;
  dayInPhase: number;
  mode: UserMode;
  recentSymptoms?: RecentSymptom[];
}): { stateKey: string; state: ContentStateKey } {
  const state: ContentStateKey = {
    phase: input.phase,
    dayBand: getDayBand(input.dayInPhase),
    mode: input.mode,
    symptomCluster: input.recentSymptoms
      ? detectSymptomCluster(input.recentSymptoms)
      : 'none',
  };

  return {
    stateKey: buildStateKey(state),
    state,
  };
}

// ─── THE RESOLVER ─────────────────────────────────────────────────────

/**
 * ContentResolver — the public API for fetching cohort-shared content.
 *
 * Lifecycle:
 *   1. Create once at app startup with a provider
 *   2. Call resolve() throughout the session
 *   3. Call prefetch() after daily check-in to warm tomorrow's cache
 *   4. Call clearSession() on logout
 *
 * Thread safety: This is single-threaded JS — no locks needed.
 */
export class ContentResolver {
  private sessionCache = new Map<string, unknown>();
  private prefetchCache = new Map<string, unknown>();
  private hitStats = { session: 0, prefetch: 0, cohort: 0, miss: 0 };

  constructor(private provider: CohortContentProvider) {}

  /**
   * Resolve content for a given state + content type.
   * Checks caches in order: session → prefetch → cohort provider.
   *
   * @returns Content or null if no content registered
   */
  resolve<T = unknown>(
    stateKey: string,
    contentType: CohortContentType
  ): T | null {
    const cacheKey = `${stateKey}::${contentType}`;

    // Layer 1: Session cache (fastest)
    if (this.sessionCache.has(cacheKey)) {
      this.hitStats.session++;
      return this.sessionCache.get(cacheKey) as T;
    }

    // Layer 2: Prefetch cache (still in-memory)
    if (this.prefetchCache.has(cacheKey)) {
      this.hitStats.prefetch++;
      const value = this.prefetchCache.get(cacheKey) as T;
      // Promote to session cache for next time
      this.sessionCache.set(cacheKey, value);
      return value;
    }

    // Layer 3: Cohort provider (might be SQLite later)
    const value = this.provider.getContent<T>(stateKey, contentType);
    if (value !== null) {
      this.hitStats.cohort++;
      this.sessionCache.set(cacheKey, value);
      return value;
    }

    this.hitStats.miss++;
    return null;
  }

  /**
   * Prefetch content for predicted future states.
   * Called after daily check-in to warm tomorrow's cache.
   *
   * This is what makes phase transitions feel INSTANT.
   *
   * @param stateKeys - Array of state_keys to pre-warm
   * @param contentTypes - Content types to fetch for each (default: all)
   */
  prefetch(
    stateKeys: string[],
    contentTypes: CohortContentType[] = [
      'daily_decode',
      'questions',
      'tips',
      'predictions',
    ]
  ): { prefetched: number; alreadyCached: number } {
    let prefetched = 0;
    let alreadyCached = 0;

    for (const stateKey of stateKeys) {
      for (const contentType of contentTypes) {
        const cacheKey = `${stateKey}::${contentType}`;

        if (
          this.sessionCache.has(cacheKey) ||
          this.prefetchCache.has(cacheKey)
        ) {
          alreadyCached++;
          continue;
        }

        const value = this.provider.getContent(stateKey, contentType);
        if (value !== null) {
          this.prefetchCache.set(cacheKey, value);
          prefetched++;
        }
      }
    }

    return { prefetched, alreadyCached };
  }

  /**
   * Predict the user's likely future state_keys for prefetching.
   *
   * Returns:
   *   - Tomorrow's state (same phase, dayInPhase + 1)
   *   - If phase transition imminent: first 2 days of next phase
   *
   * @param current - Current state + day info
   */
  predictFutureStates(current: {
    phase: Phase;
    dayInPhase: number;
    mode: UserMode;
    recentSymptoms?: RecentSymptom[];
    cycleDaysRemaining: number;
  }): string[] {
    const states: string[] = [];

    // Tomorrow's likely state (same phase, next day)
    const tomorrow = buildStateKeyFromInputs({
      phase: current.phase,
      dayInPhase: current.dayInPhase + 1,
      mode: current.mode,
      recentSymptoms: current.recentSymptoms,
    });
    states.push(tomorrow.stateKey);

    // Day after tomorrow
    const dayAfter = buildStateKeyFromInputs({
      phase: current.phase,
      dayInPhase: current.dayInPhase + 2,
      mode: current.mode,
      recentSymptoms: current.recentSymptoms,
    });
    states.push(dayAfter.stateKey);

    // If phase transition is within 2 days, prefetch next phase's first 2 days
    if (current.cycleDaysRemaining <= 2) {
      const nextPhase = getNextPhase(current.phase);
      const nextPhaseDay1 = buildStateKeyFromInputs({
        phase: nextPhase,
        dayInPhase: 1,
        mode: current.mode,
        recentSymptoms: current.recentSymptoms,
      });
      const nextPhaseDay2 = buildStateKeyFromInputs({
        phase: nextPhase,
        dayInPhase: 2,
        mode: current.mode,
        recentSymptoms: current.recentSymptoms,
      });
      states.push(nextPhaseDay1.stateKey, nextPhaseDay2.stateKey);
    }

    // Dedupe
    return Array.from(new Set(states));
  }

  /**
   * Clear the session cache (e.g., on app backgrounding or state change).
   * Prefetch cache is preserved across sessions until midnight.
   */
  clearSession(): void {
    this.sessionCache.clear();
  }

  /**
   * Clear ALL caches (e.g., on logout or mode change).
   */
  clearAll(): void {
    this.sessionCache.clear();
    this.prefetchCache.clear();
  }

  /**
   * Get cache statistics for diagnostics / performance monitoring.
   */
  getStats(): CacheStats {
    const total =
      this.hitStats.session +
      this.hitStats.prefetch +
      this.hitStats.cohort +
      this.hitStats.miss;

    return {
      sessionHits: this.hitStats.session,
      prefetchHits: this.hitStats.prefetch,
      cohortHits: this.hitStats.cohort,
      misses: this.hitStats.miss,
      totalRequests: total,
      hitRate: total > 0 ? (total - this.hitStats.miss) / total : 0,
      sessionCacheSize: this.sessionCache.size,
      prefetchCacheSize: this.prefetchCache.size,
    };
  }

  /**
   * Reset diagnostic counters (does not clear caches).
   */
  resetStats(): void {
    this.hitStats = { session: 0, prefetch: 0, cohort: 0, miss: 0 };
  }
}

// ─── IN-MEMORY PROVIDER (Default Implementation) ──────────────────────

/**
 * Simple in-memory provider for the cohort content table.
 * Loads from a static map at construction — used for bundled content.
 *
 * A SQLite-backed provider will replace this in the database PR.
 */
export class InMemoryCohortProvider implements CohortContentProvider {
  private store = new Map<string, unknown>();

  constructor(initialData: Record<string, Record<string, unknown>> = {}) {
    for (const [stateKey, contentMap] of Object.entries(initialData)) {
      for (const [contentType, value] of Object.entries(contentMap)) {
        this.store.set(`${stateKey}::${contentType}`, value);
      }
    }
  }

  getContent<T = unknown>(
    stateKey: string,
    contentType: CohortContentType
  ): T | null {
    const value = this.store.get(`${stateKey}::${contentType}`);
    return (value ?? null) as T | null;
  }

  listKnownStates(): string[] {
    const states = new Set<string>();
    for (const key of this.store.keys()) {
      const stateKey = key.split('::')[0];
      if (stateKey) states.add(stateKey);
    }
    return Array.from(states);
  }

  /**
   * Register content for a state at runtime.
   * Useful for testing and for OTA content updates.
   */
  register(
    stateKey: string,
    contentType: CohortContentType,
    value: unknown
  ): void {
    this.store.set(`${stateKey}::${contentType}`, value);
  }
}

// ─── HELPER TYPES ─────────────────────────────────────────────────────

export interface CacheStats {
  sessionHits: number;
  prefetchHits: number;
  cohortHits: number;
  misses: number;
  totalRequests: number;
  hitRate: number;        // 0.0 - 1.0
  sessionCacheSize: number;
  prefetchCacheSize: number;
}

// ─── INTERNAL HELPERS ───────────────────���─────────────────────────────

/**
 * Days between two ISO dates (YYYY-MM-DD).
 */
function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(`${dateA}T00:00:00`);
  const b = new Date(`${dateB}T00:00:00`);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs(b.getTime() - a.getTime()) / msPerDay);
}

/**
 * Get the next phase in the cycle order.
 * menstrual → follicular → ovulatory → luteal → menstrual ...
 */
function getNextPhase(phase: Phase): Phase {
  const order: Phase[] = ['menstrual', 'follicular', 'ovulatory', 'luteal'];
  const index = order.indexOf(phase);
  return order[(index + 1) % order.length]!;
}
