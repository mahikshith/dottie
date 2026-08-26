/**
 * Dottie — Symptom ↔ Cycle Correlation Analysis (pure)
 *
 * Mines the user's OWN symptom logs for personal patterns:
 *   "you tend to log headaches ~2 days before your period"
 *   "you often log bloating in your luteal phase"
 *
 * This is the analysis behind the `symptom_pattern_learned` insight — the
 * single most-loved feature in competitor apps (Bearable), built here entirely
 * on-device from data the app already collects. No new storage, no network.
 *
 * ─── METHOD (deliberately conservative) ─────────────────────────────
 *
 *  For each symptom type the user logs, we look at WHERE in the cycle it tends
 *  to fall (its phase, and its median day-in-cycle). We only call something a
 *  "pattern" when it's genuinely concentrated:
 *    - at least MIN_OCCURRENCES logged (with a known cycle day + phase), and
 *    - at least MIN_PHASE_SHARE of them fall in one phase.
 *  Everything else yields NOTHING — no filler patterns, no false certainty.
 *  (Same empty-is-valid philosophy as the rest of Dottie Predicts.)
 *
 *  We do NOT diagnose. A pattern is an observation about the user's own logs,
 *  phrased warmly, with a gentle "worth a chat with a doctor if it feels heavy"
 *  — never a medical claim.
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device). Verify counts/median on a Node machine.
 */

import { Phase } from '../../types/cycle.types';

// ─── TUNING ──────────────────────────────────────────────────────────

/** Need at least this many dated occurrences before we call it a pattern. */
const MIN_OCCURRENCES = 3;
/** …and at least this share of them must fall in one phase. */
const MIN_PHASE_SHARE = 0.55;
/** Only frame luteal-phase symptoms as "N days before your period" when N ≤ this. */
const MAX_DAYS_BEFORE_PERIOD = 10;
/** Return at most this many patterns (the deck caps total insights anyway). */
const MAX_PATTERNS = 2;

// ─── TYPES ───────────────────────────────────────────────────────────

/** Minimal per-symptom row this module needs (structurally = PredictsSymptomEntry). */
export interface CorrelationSymptomEntry {
  symptomType: string;
  dayInCycleAtLog: number | null;
  phaseAtLog: Phase | null;
}

export interface SymptomPattern {
  /** lowercased symptom label, e.g. "headaches" */
  symptomType: string;
  /** how many dated occurrences supported this pattern */
  count: number;
  /** the phase it concentrates in */
  dominantPhase: Phase;
  /** fraction (0..1) of occurrences in that phase */
  phaseShare: number;
  /** median day-in-cycle it tends to fall on */
  medianDayInCycle: number;
  /** for luteal symptoms with a cycle-length estimate: ~days before next period */
  daysBeforePeriod: number | null;
  /** 0..1, from count × concentration */
  confidence: number;
}

// ─── ANALYSIS ────────────────────────────────────────────────────────

/**
 * Find the user's most notable symptom→cycle patterns.
 * @param entries recent symptom logs (any window; more is better)
 * @param predictedCycleLength best cycle-length estimate, for "days before period"
 */
export function findSymptomPatterns(
  entries: readonly CorrelationSymptomEntry[],
  predictedCycleLength: number | null
): SymptomPattern[] {
  // A symptom needs a known cycle DAY. Its phase is taken from phaseAtLog when
  // the store provided it, otherwise derived from the day — so this works even
  // if phaseAtLog isn't populated.
  const cycleLen = predictedCycleLength && predictedCycleLength > 0 ? predictedCycleLength : 28;
  const groups = new Map<string, { days: number[]; phases: Phase[] }>();
  for (const e of entries) {
    if (e.dayInCycleAtLog === null) continue;
    const key = e.symptomType.toLowerCase().trim();
    if (!key) continue;
    const phase = e.phaseAtLog ?? phaseFromDay(e.dayInCycleAtLog, cycleLen);
    const g = groups.get(key) ?? { days: [], phases: [] };
    g.days.push(e.dayInCycleAtLog);
    g.phases.push(phase);
    groups.set(key, g);
  }

  const patterns: SymptomPattern[] = [];

  for (const [symptomType, g] of groups.entries()) {
    if (g.days.length < MIN_OCCURRENCES) continue;

    // Dominant phase + its share.
    const phaseCounts = new Map<Phase, number>();
    for (const p of g.phases) phaseCounts.set(p, (phaseCounts.get(p) ?? 0) + 1);

    let dominantPhase: Phase | null = null;
    let dominantCount = 0;
    for (const [phase, n] of phaseCounts.entries()) {
      if (n > dominantCount) {
        dominantCount = n;
        dominantPhase = phase;
      }
    }
    if (dominantPhase === null) continue;

    const total = g.phases.length;
    const phaseShare = dominantCount / total;
    if (phaseShare < MIN_PHASE_SHARE) continue; // not concentrated enough → not a pattern

    const medianDayInCycle = median(g.days);

    // "days before period" framing only makes sense for late-cycle symptoms.
    let daysBeforePeriod: number | null = null;
    if (predictedCycleLength !== null && dominantPhase === 'luteal') {
      const db = Math.round(predictedCycleLength - medianDayInCycle);
      if (db >= 0 && db <= MAX_DAYS_BEFORE_PERIOD) daysBeforePeriod = db;
    }

    const confidence = clamp01(
      0.4 + 0.05 * Math.min(dominantCount, 6) + (phaseShare - MIN_PHASE_SHARE) * 0.6
    );

    patterns.push({
      symptomType,
      count: dominantCount,
      dominantPhase,
      phaseShare,
      medianDayInCycle,
      daysBeforePeriod,
      confidence,
    });
  }

  // Strongest first (support × concentration), capped.
  patterns.sort((a, b) => b.count * b.phaseShare - a.count * a.phaseShare);
  return patterns.slice(0, MAX_PATTERNS);
}

// ─── HELPERS ─────────────────────────────────────────────────────────

/**
 * Coarse phase from a cycle day + length (fallback when phaseAtLog is absent).
 * Simple, standard boundaries: menstrual ≤ day 5, ovulatory around length−14,
 * follicular before it, luteal after. Period length assumed ~5.
 */
function phaseFromDay(day: number, cycleLen: number): Phase {
  const ovulation = Math.max(10, cycleLen - 14);
  if (day <= 5) return 'menstrual';
  if (day >= ovulation - 1 && day <= ovulation + 1) return 'ovulatory';
  if (day < ovulation - 1) return 'follicular';
  return 'luteal';
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
