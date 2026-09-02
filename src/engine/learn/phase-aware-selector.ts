/**
 * Dottie — Phase-Aware Lesson Selector (Learn Redesign Phase 1)
 *
 * Given the user's current sub-phase, mode, and completion state, returns
 * 1-3 lessons to feature in the Learn tab's "Today's spotlight" card.
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 * Sub-phase → curriculum-path ranking comes from Gemini Master Spec §2.1
 * (docs/Dottie_Learn_Tab_Redesign__Complete_Master_Specification*.docx),
 * which mapped every one of the 9 sub-phases to primary/secondary/tertiary
 * paths with clinical rationale. We adopt that ranking verbatim.
 *
 * Ranking algorithm (deterministic):
 *   1. Enumerate every path relevant to the sub-phase (primary → tertiary)
 *   2. Enumerate every path relevant to the user's conditions (PCOS, endo,
 *      thyroid, birth-control soft flag)
 *   3. Concatenate + dedupe (phase paths first)
 *   4. Pull every lesson in those paths in path order
 *   5. Filter: strip adultOnly lessons for teen users (Gemini FM-3 P0)
 *   6. Filter: skip lessons the user has already completed, UNLESS
 *      there's nothing else — then surface completed lessons at the end
 *   7. Attach a `why` reason to each returned lesson so the UI can show
 *      "Because your period is likely near…" instead of "here you go"
 *
 * ─── PURE + BACKWARD COMPATIBLE ──────────────────────────────────────
 *
 * No React Native imports, no store reads — the caller passes everything
 * in. Runnable in the Node simulation harness. Backward compat: works
 * even when lesson.difficulty is missing (older lessons); adultOnly
 * defaults to false; missing sub-phase falls back to a foundational
 * ("Cycle Basics") path.
 *
 * ⚠️ design-v2 / UNVERIFIED on device.
 */

import type { Lesson, LessonProgress } from '../../types/content.types';
import type { HealthCondition, UserMode } from '../../types/cycle.types';
import type { SubPhase } from '../calendar/day-suggestions';

// ─── PUBLIC TYPES ────────────────────────────────────────────────────

export interface SpotlightLesson {
  lesson: Lesson;
  /** Short, non-diagnostic phrase for the UI ("Because your period is likely near"). */
  why: string;
  /**
   * When true, the user has already completed this lesson — the UI can
   * show a "review" affordance instead of "start". Only returned when
   * we've run out of never-seen lessons in the relevant paths.
   */
  alreadyCompleted: boolean;
}

export interface PhaseAwareSelectorInput {
  /** Current sub-phase from resolveSubPhase(); null when no cycle data yet. */
  subphase: SubPhase | null;
  /** The user's mode. Teen mode auto-strips adultOnly lessons. */
  mode: UserMode;
  /** Health conditions from onboarding (may be empty). */
  conditions: HealthCondition[];
  /** Every lesson in the app (LESSONS from learning-paths.ts). */
  lessons: readonly Lesson[];
  /** Per-user completion state. Map<lessonId, LessonProgress>. */
  progressById: ReadonlyMap<string, LessonProgress>;
  /** Number of lessons to return (default 3). */
  count?: number;
}

// ─── SUB-PHASE → PATH RANKING (Gemini §2.1) ──────────────────────────

const SUBPHASE_PATH_RANKING: Record<SubPhase, readonly string[]> = {
  menstrual_early:  ['path_pain_management', 'path_menstrual_phase', 'path_period_products'],
  menstrual_late:   ['path_menstrual_phase', 'path_nutrition', 'path_sleep'],
  follicular_early: ['path_follicular_phase', 'path_cycle_basics', 'path_tracking_skills'],
  follicular_mid:   ['path_follicular_phase', 'path_movement', 'path_skin_hair'],
  follicular_late:  ['path_hormones_101', 'path_fertility_awareness', 'path_sexual_health'],
  ovulation_day:    ['path_ovulation', 'path_fertility_awareness', 'path_sexual_health'],
  luteal_early:     ['path_luteal_pms', 'path_hormones_101', 'path_digestive'],
  luteal_mid:       ['path_mood_mental', 'path_sleep', 'path_nutrition'],
  luteal_late_pms:  ['path_luteal_pms', 'path_pain_management', 'path_red_flags'],
};

// Fallback when the user has no cycle data — start at foundations.
const FALLBACK_PATHS: readonly string[] = [
  'path_cycle_basics',
  'cycle_basics',
  'path_hormones_101',
];

// Condition-tuned bonus paths — appended AFTER phase paths when the user
// has the condition, so a PCOS luteal user sees luteal_pms first + PCOS
// content second, rather than PCOS drowning the phase relevance.
const CONDITION_PATHS: Partial<Record<HealthCondition, readonly string[]>> = {
  pcos: ['path_pcos'],
  endometriosis: ['path_endometriosis'],
  thyroid: ['path_thyroid_endocrine'],
};

// Copy for the `why` line — short, non-diagnostic ("here's why we picked
// this for you today").
const SUBPHASE_WHY: Record<SubPhase, string> = {
  menstrual_early:  'Comfort ideas for the heaviest days',
  menstrual_late:   'Recovery + energy as flow tapers',
  follicular_early: 'Fresh baseline as estrogen begins to climb',
  follicular_mid:   'Focus + capacity for the middle of your cycle',
  follicular_late:  'The window approaching ovulation',
  ovulation_day:    'The peak day — signs to notice',
  luteal_early:     'The wind-down begins',
  luteal_mid:       'Mood + sleep as progesterone peaks',
  luteal_late_pms:  'The PMS window — care ideas for now',
};

// ─── PUBLIC API ──────────────────────────────────────────────────────

export function selectSpotlightLessons(input: PhaseAwareSelectorInput): SpotlightLesson[] {
  const count = input.count ?? 3;

  // 1. Ranked path list (phase + condition + fallback).
  const rankedPaths = buildPathRanking(input);

  // 2. All lessons for those paths in path-then-order sequence.
  const orderedLessons: Lesson[] = [];
  const seen = new Set<string>();
  for (const pathId of rankedPaths) {
    const pathLessons = input.lessons
      .filter((l) => l.pathId === pathId)
      .sort((a, b) => a.order - b.order);
    for (const l of pathLessons) {
      if (seen.has(l.id)) continue;
      seen.add(l.id);
      orderedLessons.push(l);
    }
  }

  // 3. Teen-mode adultOnly filter (Gemini FM-3 P0).
  const modeFiltered =
    input.mode === 'teen'
      ? orderedLessons.filter((l) => l.adultOnly !== true)
      : orderedLessons;

  // 4. Split by completion so we surface never-seen first.
  const notCompleted: Lesson[] = [];
  const completed: Lesson[] = [];
  for (const l of modeFiltered) {
    const p = input.progressById.get(l.id);
    if (p?.status === 'complete') completed.push(l);
    else notCompleted.push(l);
  }

  const primary = notCompleted.slice(0, count);
  const filler = completed.slice(0, Math.max(0, count - primary.length));

  const why = whyLine(input.subphase);
  return [
    ...primary.map((lesson) => ({ lesson, why, alreadyCompleted: false as const })),
    ...filler.map((lesson) => ({ lesson, why, alreadyCompleted: true as const })),
  ];
}

// ─── INTERNAL ────────────────────────────────────────────────────────

function buildPathRanking(input: PhaseAwareSelectorInput): string[] {
  const out: string[] = [];
  const push = (id: string) => {
    if (!out.includes(id)) out.push(id);
  };

  if (input.subphase) {
    for (const p of SUBPHASE_PATH_RANKING[input.subphase]) push(p);
  }

  for (const c of input.conditions) {
    const extras = CONDITION_PATHS[c];
    if (extras) for (const p of extras) push(p);
  }

  for (const p of FALLBACK_PATHS) push(p);

  return out;
}

function whyLine(subphase: SubPhase | null): string {
  if (subphase == null) return 'A great place to start';
  return SUBPHASE_WHY[subphase];
}
