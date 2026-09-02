/**
 * Dottie — Adaptive Quiz Selector (Learn Redesign Phase 3)
 *
 * Picks quiz questions with tier awareness so difficulty rises WITH the user,
 * not against them. Pure module — no React Native imports, no store reads,
 * runnable in the Node harness (`scripts/adaptive-quiz-harness.ts`).
 *
 * ─── RULES (Gemini Master Spec §3, with three fixes) ────────────────
 *
 *  RULE 1  Start at `beginner`. First-time users never see a `hard` question
 *          out of the gate.
 *  RULE 2  Correct answer → PROMOTE one tier (beginner → moderate → hard,
 *          hard → hard). The staircase caps at `hard`.
 *  RULE 3  Wrong answer → HOLD the current tier. NEVER demote. Kindness
 *          first: this is a warm learning quest, not a placement exam, and
 *          one miss is not a skill signal (bad afternoon, misread option,
 *          new terminology). Gemini's original spec demoted on a miss; we
 *          deliberately reject that.
 *  RULE 4  When the current tier's pool is empty, fall back to the NEAREST
 *          tier (beg → mod → hard, hard → mod → beg), NOT "any question at
 *          random". Preserves the learning arc when a bank is small or
 *          skewed. This is the second Gemini-spec fix.
 *  RULE 5  Shuffle is SESSION-SEEDED (deterministic mulberry32). The same
 *          session id, replayed with the same answers, picks the same
 *          questions. Makes retakes stable within a session and makes the
 *          harness reproducible. Third Gemini-spec fix (their v1 re-shuffled
 *          per pick, so a "retry the same question" flow was impossible).
 *
 * ─── DELIBERATE OMISSIONS ───────────────────────────────────────────
 *
 *  Legacy questions with no `level` field are treated as `beginner` (matches
 *  Phase 0's decision that `level?` is optional and missing = safest). A
 *  legacy bank never leaks a random hard question to a first-timer.
 *
 *  There is no across-session skill tracking. The adaptive tier is per-attempt
 *  only. This is intentional: a persistent skill model would let a bad day
 *  compound into weeks of remedial questions.
 *
 *  ⚠️ design-v2 / UNVERIFIED on device.
 */

import type { DifficultyTier, QuizQuestion } from '../../types/content.types';

// ─── TIER ORDERING ───────────────────────────────────────────────────

/** Ordered easiest → hardest. Used for promotion and nearest-tier fallback. */
export const TIER_ORDER: readonly DifficultyTier[] = ['beginner', 'moderate', 'hard'];

/** RULE 2 + RULE 3 in one place. Correct promotes; wrong holds. */
export function promoteTier(current: DifficultyTier, wasCorrect: boolean): DifficultyTier {
  if (!wasCorrect) return current;
  const i = TIER_ORDER.indexOf(current);
  return TIER_ORDER[Math.min(i + 1, TIER_ORDER.length - 1)]!;
}

/** Effective tier of a question. Missing `level` → 'beginner' (safest). */
export function questionTier(q: QuizQuestion): DifficultyTier {
  return q.level ?? 'beginner';
}

// ─── NEAREST-TIER POOL (RULE 4) ──────────────────────────────────────

/**
 * Return questions matching `tier`, else fall back to the NEAREST tier in
 * the TIER_ORDER (beg ↔ mod ↔ hard, one step at a time). Returns [] only
 * when the entire bank is empty. Symmetric radius walk so the fallback is
 * predictable regardless of where in the tier ladder we're standing.
 */
export function nearestTierPool(
  bank: readonly QuizQuestion[],
  tier: DifficultyTier
): QuizQuestion[] {
  const primary = bank.filter((q) => questionTier(q) === tier);
  if (primary.length > 0) return primary;

  const centre = TIER_ORDER.indexOf(tier);
  for (let radius = 1; radius < TIER_ORDER.length; radius++) {
    for (const dir of [-1, 1]) {
      const idx = centre + dir * radius;
      if (idx < 0 || idx >= TIER_ORDER.length) continue;
      const alt = bank.filter((q) => questionTier(q) === TIER_ORDER[idx]);
      if (alt.length > 0) return alt;
    }
  }
  return [];
}

// ─── QUESTION PICKING ────────────────────────────────────────────────

export interface PickNextInput {
  bank: readonly QuizQuestion[];
  currentTier: DifficultyTier;
  alreadyAsked: ReadonlySet<string>;
  /** Session seed — same value across a session means reproducible picks. */
  seed: number;
}

/**
 * Pick a single next question. Deterministic given (seed, alreadyAsked size,
 * tier). Returns null when nothing unasked survives the nearest-tier walk.
 */
export function pickNextQuestion(input: PickNextInput): QuizQuestion | null {
  const unasked = input.bank.filter((q) => !input.alreadyAsked.has(q.id));
  const pool = nearestTierPool(unasked, input.currentTier);
  if (pool.length === 0) return null;
  const stepSeed =
    (input.seed ^ (input.alreadyAsked.size * 0x9e3779b1) ^ tierWeight(input.currentTier)) >>> 0;
  const idx = Math.floor(mulberry32(stepSeed)() * pool.length);
  return pool[idx] ?? null;
}

export interface AdaptiveSlateInput {
  bank: readonly QuizQuestion[];
  count: number;
  seed: number;
  /** Starting tier. Defaults to 'beginner' per RULE 1. */
  startTier?: DifficultyTier;
}

/**
 * Pre-compute a slate of `count` questions assuming OPTIMISTIC promotion on
 * each step. Used when the UI wants a slate upfront rather than one at a
 * time. Real answers can trigger a rewrite later; a Phase-3.5 refinement.
 */
export function pickAdaptiveSlate(input: AdaptiveSlateInput): QuizQuestion[] {
  let tier: DifficultyTier = input.startTier ?? 'beginner';
  const asked = new Set<string>();
  const out: QuizQuestion[] = [];

  for (let i = 0; i < input.count; i++) {
    const q = pickNextQuestion({
      bank: input.bank,
      currentTier: tier,
      alreadyAsked: asked,
      seed: input.seed,
    });
    if (!q) break;
    out.push(q);
    asked.add(q.id);
    tier = promoteTier(tier, true);
  }
  return out;
}

// ─── SEED UTILITIES ──────────────────────────────────────────────────

/** FNV-1a 32-bit — cheap, stable, string → seed. */
export function seedFromSessionId(sessionId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < sessionId.length; i++) {
    h ^= sessionId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * mulberry32 — a small deterministic PRNG. Plenty for a 5-question quiz;
 * we're not doing crypto or Monte Carlo.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tierWeight(tier: DifficultyTier): number {
  return TIER_ORDER.indexOf(tier) * 0x51_29 + 7;
}
