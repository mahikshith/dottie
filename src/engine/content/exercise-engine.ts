/**
 * Dottie — Exercise Engine (Learn Quest · design-v2)
 *
 * The grading brain behind the interactive exercise types (pairs / order /
 * fill_blank / tap_diagram / tap_word). It is PURE and stateless: give it an
 * `Exercise` and the user's `ExerciseAnswer`, get back a grade plus a
 * companion-wrapped reaction — the same instant-feedback loop the quiz engine
 * ships, widened to richer interactions.
 *
 * ─── WHY STATELESS (vs. the QuizEngine's session map) ───────────────
 *
 *  A quiz is a multi-question attempt, so QuizEngine holds a session. An
 *  exercise is a single graded interaction inside a lesson — the screen already
 *  owns the flow, so the engine just needs `grade(exercise, answer)`. Less state
 *  = less to get wrong, and trivially unit-testable.
 *
 * ─── ANTI-LEAK ──────────────────────────────────────────────────────
 *
 *  `renderExercise()` returns a DISPLAY model with shuffled option pools and NO
 *  "correct" flags — the answer can't be read off the client, exactly like
 *  `RenderedQuizQuestion` drops `correctIndex`. Grading happens here by VALUE
 *  (chosen strings / indexes), so the shuffle never affects correctness.
 *
 *  ⚠️ design-v2 / UNVERIFIED (no Node here) — reason carefully; pure logic.
 */

import {
  Exercise,
  ExerciseAnswer,
  PairsExercise,
  OrderExercise,
  FillBlankExercise,
  TapDiagramExercise,
  TapWordExercise,
} from '../../types/content.types';
import { CompanionType, CompanionMood, DialogueContext } from '../../types/companion.types';
import { wrapInsight } from './companion-dialogue';

// ─── REWARD CONSTANTS ────────────────────────────────────────────────

const DEFAULT_EXERCISE_XP = 10;
const EXERCISE_GEMS = 2;

// ─── CONTENT PROVIDER ────────────────────────────────────────────────

/**
 * Provides access to the bundled exercise catalog. Companion to
 * `QuizProvider` / `LessonProvider`. The content store builds one from
 * `src/content/exercises.ts`.
 */
export interface ExerciseProvider {
  getExercise(exerciseId: string): Exercise | null;
  getExercisesForLesson(lessonId: string): Exercise[];
  getAllExercises(): Exercise[];
}

// ─── RENDER (DISPLAY) MODEL — answers hidden ─────────────────────────

export type RenderedExercise =
  | { id: string; type: 'pairs'; prompt: string; leftItems: string[]; rightItems: string[] }
  | { id: string; type: 'order'; prompt: string; items: string[] }
  | { id: string; type: 'fill_blank'; prompt: string; sentence: string; blankPools: string[][] }
  | { id: string; type: 'tap_diagram'; prompt: string; options: { label: string; emoji?: string }[] }
  | { id: string; type: 'tap_word'; prompt: string; tokens: string[] };

/**
 * Build the shuffled, answer-free display model the UI renders. Pass a seeded
 * `rng` for deterministic output in tests; defaults to `Math.random`.
 */
export function renderExercise(exercise: Exercise, rng: () => number = Math.random): RenderedExercise {
  switch (exercise.type) {
    case 'pairs':
      return {
        id: exercise.id,
        type: 'pairs',
        prompt: exercise.prompt,
        leftItems: exercise.pairs.map((p) => p.left),
        // right column shuffled so the alignment isn't given away
        rightItems: shuffle(exercise.pairs.map((p) => p.right), rng),
      };
    case 'order':
      return {
        id: exercise.id,
        type: 'order',
        prompt: exercise.prompt,
        items: shuffle(exercise.items, rng),
      };
    case 'fill_blank':
      return {
        id: exercise.id,
        type: 'fill_blank',
        prompt: exercise.prompt,
        sentence: exercise.sentence,
        blankPools: exercise.blanks.map((b) => shuffle([b.answer, ...b.distractors], rng)),
      };
    case 'tap_diagram':
      return {
        id: exercise.id,
        type: 'tap_diagram',
        prompt: exercise.prompt,
        // options keep their authored order (no correctness flag exposed)
        options: exercise.options.map((o) => ({ label: o.label, ...(o.emoji ? { emoji: o.emoji } : {}) })),
      };
    case 'tap_word':
      return {
        id: exercise.id,
        type: 'tap_word',
        prompt: exercise.prompt,
        tokens: exercise.tokens,
      };
  }
}

// ─── GRADING (pure) ──────────────────────────────────────────────────

export interface ExerciseGrade {
  correct: boolean;
  /** Number of sub-parts right (pairs/blanks/words). 1 for all-or-nothing types. */
  correctParts: number;
  /** Total sub-parts. */
  totalParts: number;
}

/**
 * Grade an answer against its exercise. The answer's `type` must match the
 * exercise's `type`; a mismatch grades as incorrect (defensive).
 */
export function gradeExercise(exercise: Exercise, answer: ExerciseAnswer): ExerciseGrade {
  if (exercise.type !== answer.type) {
    return { correct: false, correctParts: 0, totalParts: 1 };
  }

  switch (exercise.type) {
    case 'pairs':
      return gradePairs(exercise, answer as Extract<ExerciseAnswer, { type: 'pairs' }>);
    case 'order':
      return gradeOrder(exercise, answer as Extract<ExerciseAnswer, { type: 'order' }>);
    case 'fill_blank':
      return gradeFillBlank(exercise, answer as Extract<ExerciseAnswer, { type: 'fill_blank' }>);
    case 'tap_diagram':
      return gradeTapDiagram(exercise, answer as Extract<ExerciseAnswer, { type: 'tap_diagram' }>);
    case 'tap_word':
      return gradeTapWord(exercise, answer as Extract<ExerciseAnswer, { type: 'tap_word' }>);
  }
}

function gradePairs(ex: PairsExercise, ans: { matched: string[] }): ExerciseGrade {
  const total = ex.pairs.length;
  let right = 0;
  for (let i = 0; i < total; i++) {
    if (norm(ans.matched[i]) === norm(ex.pairs[i]?.right)) right++;
  }
  return { correct: right === total && total > 0, correctParts: right, totalParts: total };
}

function gradeOrder(ex: OrderExercise, ans: { order: string[] }): ExerciseGrade {
  const total = ex.items.length;
  const ok = ans.order.length === total && ex.items.every((item, i) => norm(item) === norm(ans.order[i]));
  return { correct: ok, correctParts: ok ? total : 0, totalParts: total };
}

function gradeFillBlank(ex: FillBlankExercise, ans: { choices: string[] }): ExerciseGrade {
  const total = ex.blanks.length;
  let right = 0;
  for (let i = 0; i < total; i++) {
    if (norm(ans.choices[i]) === norm(ex.blanks[i]?.answer)) right++;
  }
  return { correct: right === total && total > 0, correctParts: right, totalParts: total };
}

function gradeTapDiagram(ex: TapDiagramExercise, ans: { index: number }): ExerciseGrade {
  const ok = ans.index === ex.correctIndex;
  return { correct: ok, correctParts: ok ? 1 : 0, totalParts: 1 };
}

function gradeTapWord(ex: TapWordExercise, ans: { tokenIndexes: number[] }): ExerciseGrade {
  const want = new Set(ex.correctTokenIndexes);
  const got = new Set(ans.tokenIndexes);
  const ok = want.size === got.size && [...want].every((i) => got.has(i));
  return { correct: ok, correctParts: ok ? want.size : 0, totalParts: Math.max(1, want.size) };
}

// ─── FEEDBACK (grade + companion reaction) ───────────────────────────

/** Mirrors the quiz engine's `SubmitAnswerResult` shape for a single exercise. */
export interface ExerciseFeedback {
  correct: boolean;
  correctParts: number;
  totalParts: number;
  explanation: string;
  explanationEmoji: string;
  companionReaction: string;
  /**
   * A human-readable rendering of the CORRECT answer — shown on a wrong/partial
   * attempt so the learner sees the right answer, not just a score (owner ask).
   * Safe to compute here: it's only surfaced AFTER the user has answered.
   */
  solution: string;
  xpAwarded: number;
  gemsAwarded: number;
}

/** The correct answer as a short display string (post-answer reveal). */
export function describeSolution(exercise: Exercise): string {
  switch (exercise.type) {
    case 'pairs':
      return exercise.pairs.map((p) => `${p.left} → ${p.right}`).join(' · ');
    case 'order':
      return exercise.items.map((it, i) => `${i + 1}. ${it}`).join('   ');
    case 'fill_blank':
      return exercise.sentence.replace(/\{\{(\d+)\}\}/g, (_m, d: string) => {
        const ans = exercise.blanks[Number(d)]?.answer;
        return ans ? `[${ans}]` : '[…]';
      });
    case 'tap_diagram': {
      const o = exercise.options[exercise.correctIndex];
      return o ? `${o.emoji ? o.emoji + ' ' : ''}${o.label}` : '';
    }
    case 'tap_word':
      return exercise.correctTokenIndexes
        .map((i) => exercise.tokens[i])
        .filter(Boolean)
        .join(' ');
  }
}

/**
 * Grade an answer AND wrap the reaction in the user's companion voice — the
 * one call a lesson screen makes on submit. Rewards are granted on a fully
 * correct answer (partials still teach, but don't pay — mirrors the quiz
 * "XP per correct" spirit without gaming partial credit).
 */
export function checkExerciseAnswer(
  exercise: Exercise,
  answer: ExerciseAnswer,
  companionType: CompanionType,
  context: DialogueContext
): ExerciseFeedback {
  const grade = gradeExercise(exercise, answer);

  const mood: CompanionMood = grade.correct ? 'celebrating' : 'supportive';
  const seed = grade.correct
    ? 'Yes — nailed it!'
    : grade.correctParts > 0
      ? "So close — you had part of it. Give it another look."
      : "No worries — this is how it sticks. Let's see why.";
  const companionReaction = wrapInsight(companionType, seed, context, mood);

  const { xpAwarded, gemsAwarded } = computeExerciseReward(grade.correct, exercise);

  return {
    correct: grade.correct,
    correctParts: grade.correctParts,
    totalParts: grade.totalParts,
    explanation: exercise.explanation,
    explanationEmoji: exercise.explanationEmoji ?? (grade.correct ? '✨' : '💡'),
    companionReaction,
    solution: describeSolution(exercise),
    xpAwarded,
    gemsAwarded,
  };
}

export function computeExerciseReward(
  correct: boolean,
  exercise: Exercise
): { xpAwarded: number; gemsAwarded: number } {
  if (!correct) return { xpAwarded: 0, gemsAwarded: 0 };
  return { xpAwarded: exercise.xpReward ?? DEFAULT_EXERCISE_XP, gemsAwarded: EXERCISE_GEMS };
}

// ─── VALIDATION (for tests / content tooling) ────────────────────────

export function validateExercise(ex: Exercise): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!ex.id) errors.push('Exercise missing id');
  if (!ex.lessonId) errors.push(`Exercise ${ex.id || '(no id)'} missing lessonId`);
  if (!ex.prompt) errors.push(`Exercise ${ex.id} missing prompt`);
  if (!ex.explanation) errors.push(`Exercise ${ex.id} missing explanation`);

  switch (ex.type) {
    case 'pairs':
      if (ex.pairs.length < 2) errors.push(`Exercise ${ex.id} (pairs) needs ≥2 pairs`);
      if (ex.pairs.some((p) => !p.left || !p.right)) errors.push(`Exercise ${ex.id} (pairs) has an empty side`);
      break;
    case 'order':
      if (ex.items.length < 2) errors.push(`Exercise ${ex.id} (order) needs ≥2 items`);
      break;
    case 'fill_blank':
      if (ex.blanks.length < 1) errors.push(`Exercise ${ex.id} (fill_blank) needs ≥1 blank`);
      ex.blanks.forEach((b, i) => {
        if (!b.answer) errors.push(`Exercise ${ex.id} blank ${i} missing answer`);
        if (b.distractors.length < 1) errors.push(`Exercise ${ex.id} blank ${i} needs ≥1 distractor`);
      });
      if (ex.blanks.some((_, i) => !ex.sentence.includes(`{{${i}}}`)))
        errors.push(`Exercise ${ex.id} sentence is missing a {{n}} placeholder`);
      break;
    case 'tap_diagram':
      if (ex.options.length < 2) errors.push(`Exercise ${ex.id} (tap_diagram) needs ≥2 options`);
      if (ex.correctIndex < 0 || ex.correctIndex >= ex.options.length)
        errors.push(`Exercise ${ex.id} (tap_diagram) has an invalid correctIndex`);
      break;
    case 'tap_word':
      if (ex.tokens.length < 2) errors.push(`Exercise ${ex.id} (tap_word) needs ≥2 tokens`);
      if (ex.correctTokenIndexes.length < 1) errors.push(`Exercise ${ex.id} (tap_word) needs ≥1 correct token`);
      if (ex.correctTokenIndexes.some((i) => i < 0 || i >= ex.tokens.length))
        errors.push(`Exercise ${ex.id} (tap_word) has an out-of-range token index`);
      break;
  }

  return { ok: errors.length === 0, errors };
}

// ─── UTILITIES ───────────────────────────────────────────────────────

/** Case/space-insensitive compare so authored content isn't brittle. */
function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

/** Fisher-Yates clone-and-shuffle (accepts an injectable rng for tests). */
function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
