/**
 * Dottie — Interactive Exercise Seed Content (Learn Quest · design-v2)
 *
 * The first bundled interactive exercises, attached to existing lessons. These
 * prove the exercise engine end-to-end and give the reimagined Learn tab
 * something playful to render beyond multiple-choice.
 *
 * Authoring notes:
 *  - Keep prompts short and warm; the companion carries the tone.
 *  - `pairs`: author `left[i]` aligned with its correct `right[i]`; the UI
 *    shuffles the right column.
 *  - `order`: author `items` in the CORRECT order; the UI shuffles for display.
 *  - `fill_blank`: put `{{0}}`, `{{1}}` … in `sentence`, one per blank.
 *  - Grading is case/space-insensitive (see exercise-engine `norm`).
 *
 * Add more by appending to `EXERCISES` — no engine changes needed.
 */

import { Exercise } from '../types/content.types';
import type { ExerciseProvider } from '../engine/content/exercise-engine';

// ─── EXERCISES ───────────────────────────────────────────────────────

export const EXERCISES: Exercise[] = [
  // ─── Cycle Basics · Lesson 2 — "The four phases" ────────────────
  {
    id: 'ex_cycle_basics_2_order',
    lessonId: 'lesson_cycle_basics_2',
    type: 'order',
    prompt: 'Put the four phases in the order they happen.',
    items: ['Menstrual', 'Follicular', 'Ovulatory', 'Luteal'],
    explanation:
      'The cycle flows menstrual → follicular → ovulatory → luteal, then begins again. Each has its own energy.',
    explanationEmoji: '🔄',
    xpReward: 12,
  },
  {
    id: 'ex_cycle_basics_2_pairs',
    lessonId: 'lesson_cycle_basics_2',
    type: 'pairs',
    prompt: 'Match each phase to how it often feels.',
    pairs: [
      { left: 'Follicular', right: 'Rising energy' },
      { left: 'Ovulatory', right: 'Social & glowy' },
      { left: 'Luteal', right: 'Winding down' },
      { left: 'Menstrual', right: 'Rest & reset' },
    ],
    explanation:
      "These are tendencies, not rules — your body writes its own version. Tracking shows you yours over time.",
    explanationEmoji: '💛',
    xpReward: 12,
  },
  {
    id: 'ex_cycle_basics_2_fill',
    lessonId: 'lesson_cycle_basics_2',
    type: 'fill_blank',
    prompt: 'Complete the sentence.',
    sentence: 'Energy tends to rise in the {{0}} phase, and you often wind down in the {{1}} phase.',
    blanks: [
      { answer: 'follicular', distractors: ['luteal', 'menstrual'] },
      { answer: 'luteal', distractors: ['ovulatory', 'follicular'] },
    ],
    explanation:
      'Estrogen climbing in the follicular phase lifts energy; progesterone in the luteal phase invites rest.',
    explanationEmoji: '🌿',
    xpReward: 12,
  },
  {
    id: 'ex_cycle_basics_2_diagram',
    lessonId: 'lesson_cycle_basics_2',
    type: 'tap_diagram',
    prompt: 'The fertile window is closest to which phase?',
    options: [
      { label: 'Menstrual', emoji: '🌑' },
      { label: 'Follicular', emoji: '🌱' },
      { label: 'Ovulatory', emoji: '☀️' },
      { label: 'Luteal', emoji: '🌙' },
    ],
    correctIndex: 2,
    explanation: 'Ovulation is when an egg is released — the fertile window centers right around it.',
    explanationEmoji: '☀️',
    xpReward: 12,
  },
];

// ─── LOOKUPS ─────────────────────────────────────────────────────────

export function getExercise(exerciseId: string): Exercise | null {
  return EXERCISES.find((e) => e.id === exerciseId) ?? null;
}

export function getExercisesForLesson(lessonId: string): Exercise[] {
  return EXERCISES.filter((e) => e.lessonId === lessonId);
}

/**
 * Build an ExerciseProvider backed by the bundled catalog above — the shape
 * the content store / exercise flow injects (mirrors the quiz/lesson providers).
 */
export function buildBundledExerciseProvider(): ExerciseProvider {
  return {
    getExercise,
    getExercisesForLesson,
    getAllExercises: () => [...EXERCISES],
  };
}
