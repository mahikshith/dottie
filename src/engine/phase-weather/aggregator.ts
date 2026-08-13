/**
 * Dottie — Phase Weather Aggregator (Pure Engine)
 *
 * Takes a date (and optional user phase) → produces a complete
 * PhaseWeatherSnapshot. No IO. No singletons. No side effects.
 *
 * ─── PURITY CONTRACT ────────────────────────────────────────────────
 *
 *  buildLocalSnapshot(date) is a pure function:
 *    - Same date → same snapshot, deterministically
 *    - No reads from singletons / network / disk
 *    - No writes anywhere
 *
 *  This determinism is critical for tests AND for the daily-stable
 *  feel: a user opening the app three times in one day should see the
 *  SAME weather, because the weather is a shared moment, not a
 *  refresh-driven number.
 *
 * ─── MVP NOTE ───────────────────────────────────────────────────────
 *
 *  Backed by hand-crafted sample distributions in ./sample-data.ts.
 *  The day-seeded perturbation gives each day a slightly different
 *  feel (different top feeling, slightly different counts) without
 *  ever feeling glitchy.
 *
 *  When backend lands, the aggregator gains a parallel path:
 *    if (remoteSnapshot) return adoptRemote(remoteSnapshot)
 *    else return buildLocalSnapshot(date)
 *  ...and the UI stays exactly the same.
 */

import { Phase } from '../../types/cycle.types';
import {
  CravingTally,
  FeelingTally,
  PhasePopulation,
  PhaseWeatherSnapshot,
  PhaseWeatherView,
  SymptomTally,
} from '../../types/phase-weather.types';
import {
  BASE_PHASE_DISTRIBUTION,
  BASE_TOTAL_DOTTIES,
  CRAVINGS_POOL,
  FEELINGS_POOL,
  SampleCraving,
  SampleFeeling,
  SampleSymptom,
  SYMPTOMS_POOL,
  WARM_MESSAGES,
} from './sample-data';

// ─── PUBLIC API ──────────────────────────────────────────────────────

export interface BuildSnapshotOptions {
  /** ISO date (YYYY-MM-DD) the snapshot is for. Defaults to today. */
  date?: string;
  /** Top-N feelings/cravings/symptoms to include. */
  topN?: number;
  /** Now timestamp — injected so tests can pin it. */
  now?: Date;
}

/**
 * Build a complete weather snapshot for a given date. Deterministic:
 * same date → same snapshot, byte-for-byte.
 */
export function buildLocalSnapshot(
  options: BuildSnapshotOptions = {}
): PhaseWeatherSnapshot {
  const date = options.date ?? todayISO();
  const topN = options.topN ?? 3;
  const generatedAt = (options.now ?? new Date()).toISOString();

  const dayHash = hashISODate(date);

  // 1. Population — perturb total slightly per day
  const totalDotties = perturbTotal(BASE_TOTAL_DOTTIES, dayHash);

  // 2. Phase distribution — perturb shares within ±2%
  const byPhase = buildPhaseDistribution(totalDotties, dayHash);

  // 3. Dominant phase = phase with largest count
  const dominantPhase = byPhase.reduce((winner, current) =>
    current.count > winner.count ? current : winner
  ).phase;

  // 4. Top feelings — rank by phase-aware weight × day-seeded variation
  const topFeelings = rankFeelings(byPhase, dayHash, topN);

  // 5. Top cravings — same approach
  const topCravings = rankCravings(byPhase, dayHash, topN);

  // 6. Top symptoms — same approach
  const topSymptoms = rankSymptoms(byPhase, dayHash, topN);

  // 7. Warm message — deterministic per day
  const warmMessage = WARM_MESSAGES[dayHash % WARM_MESSAGES.length]!;

  return {
    generatedAt,
    date,
    totalDotties,
    byPhase,
    dominantPhase,
    topFeelings,
    topCravings,
    topSymptoms,
    warmMessage,
    isLocalPreview: true,
  };
}

/**
 * Enrich a snapshot with the user's own phase, computing the
 * "in same rhythm" view the home card actually renders.
 */
export function buildWeatherView(
  snapshot: PhaseWeatherSnapshot,
  userPhase: Phase
): PhaseWeatherView {
  const population = snapshot.byPhase.find(p => p.phase === userPhase);
  const inSameRhythmCount = population?.count ?? 0;
  return {
    snapshot,
    userPhase,
    inSameRhythmCount,
    inSameRhythmDisplay: formatCount(inSameRhythmCount),
  };
}

// ─── INTERNAL: POPULATION ────────────────────────────────────────────

function perturbTotal(baseTotal: number, dayHash: number): number {
  // Sway the total by ±3% per day so it feels alive, never glitchy.
  const swayPct = ((dayHash % 60) - 30) / 1000; // -0.030 .. +0.030
  const sway = Math.round(baseTotal * swayPct);
  return baseTotal + sway;
}

function buildPhaseDistribution(
  total: number,
  dayHash: number
): PhasePopulation[] {
  // Perturb each phase share by ±0.02, then normalize so shares sum to 1.0
  const perturbed = BASE_PHASE_DISTRIBUTION.map((entry, idx) => {
    const drift = (((dayHash >> (idx * 3)) & 0x0f) - 8) / 400; // ±0.02
    return {
      phase: entry.phase,
      share: clamp01(entry.share + drift),
    };
  });

  const sum = perturbed.reduce((acc, e) => acc + e.share, 0);
  const normalized = perturbed.map(e => ({
    ...e,
    share: e.share / sum,
  }));

  // Convert to counts, then fix rounding so they sum exactly to total
  const populations: PhasePopulation[] = normalized.map(e => ({
    phase: e.phase,
    share: roundShare(e.share),
    count: Math.round(e.share * total),
  }));

  // Adjust the last entry to absorb rounding drift so totals reconcile
  const countedSum = populations.reduce((acc, p) => acc + p.count, 0);
  const diff = total - countedSum;
  if (diff !== 0 && populations.length > 0) {
    populations[populations.length - 1]!.count += diff;
  }

  return populations;
}

// ─── INTERNAL: TOP-N RANKERS ─────────────────────────────────────────

function rankFeelings(
  byPhase: PhasePopulation[],
  dayHash: number,
  topN: number
): FeelingTally[] {
  return rankTallies(FEELINGS_POOL, byPhase, dayHash, topN, 'feeling');
}

function rankCravings(
  byPhase: PhasePopulation[],
  dayHash: number,
  topN: number
): CravingTally[] {
  return rankTallies(CRAVINGS_POOL, byPhase, dayHash, topN, 'craving');
}

function rankSymptoms(
  byPhase: PhasePopulation[],
  dayHash: number,
  topN: number
): SymptomTally[] {
  return rankTallies(SYMPTOMS_POOL, byPhase, dayHash, topN, 'symptom');
}

/** Generic ranker shared by feelings / cravings / symptoms. */
function rankTallies<T extends SampleFeeling | SampleCraving | SampleSymptom>(
  pool: T[],
  byPhase: PhasePopulation[],
  dayHash: number,
  topN: number,
  saltType: 'feeling' | 'craving' | 'symptom'
): { label: string; emoji: string; count: number }[] {
  // Build phase → count lookup for fast weighting
  const phaseCount = new Map<Phase, number>();
  for (const p of byPhase) phaseCount.set(p.phase, p.count);

  // Salt the day hash differently per tally type so feelings + cravings
  // + symptoms don't rank in lockstep with each other.
  const saltedHash = dayHash + saltOffset(saltType);

  // Score each pool entry: sum of (phase population × base weight × variation)
  const scored = pool.map((entry, idx) => {
    const phaseAlignment = entry.associatedPhases.reduce((acc, ph) => {
      return acc + (phaseCount.get(ph) ?? 0);
    }, 0);

    // Per-entry day-seeded variation: ±15%
    const variation = 1 + (((saltedHash + idx * 7) % 31) - 15) / 100;

    const score = phaseAlignment * entry.baseWeight * variation;

    // Translate score into a count proportional to a slice of the community
    const count = Math.max(1, Math.round(score / 1000));

    return {
      label: entry.label,
      emoji: entry.emoji,
      score,
      count,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topN).map(({ label, emoji, count }) => ({
    label,
    emoji,
    count,
  }));
}

function saltOffset(kind: 'feeling' | 'craving' | 'symptom'): number {
  switch (kind) {
    case 'feeling':  return 13;
    case 'craving':  return 113;
    case 'symptom':  return 251;
  }
}

// ─── INTERNAL: HASHING & FORMATTING ──────────────────────────────────

/**
 * Deterministic, lightweight string hash. Same date → same number.
 * Range comfortably fits in 32-bit positive int.
 */
function hashISODate(date: string): number {
  let h = 5381;
  for (let i = 0; i < date.length; i++) {
    h = ((h << 5) + h + date.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function clamp01(n: number): number {
  if (n < 0.02) return 0.02;
  if (n > 0.98) return 0.98;
  return n;
}

function roundShare(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]!;
}

/**
 * Human-friendly count display:
 *   42,108   → "42,108"
 *   1,234    → "1,234"
 *   850      → "850"
 *
 * For the warm "you and ___ others" line we prefer the full number
 * because precision communicates community more than abbreviation.
 */
function formatCount(n: number): string {
  if (n < 1000) return String(n);
  // Use locale-aware grouping (commas in en-US, spaces in fr-FR, etc.)
  return n.toLocaleString();
}
