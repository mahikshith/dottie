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
import { remoteContentStore } from './remote/remote-content-store';
import { CURRICULUM_EXERCISES } from './curriculum.generated';

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

  // ─── Cycle Basics · Lesson 1 — "What is a menstrual cycle?" ─────
  {
    id: 'ex_cycle_basics_1_fill',
    lessonId: 'lesson_cycle_basics_1',
    type: 'fill_blank',
    prompt: 'Fill in the typical cycle numbers.',
    sentence: 'A typical cycle is about {{0}} days, but anywhere from {{1}} to 35 days is perfectly normal.',
    blanks: [
      { answer: '28', distractors: ['14', '40'] },
      { answer: '21', distractors: ['10', '25'] },
    ],
    explanation: 'Around 28 days is the average, but 21–35 days is a totally normal range.',
    explanationEmoji: '📅',
    xpReward: 12,
  },
  {
    id: 'ex_cycle_basics_1_diagram',
    lessonId: 'lesson_cycle_basics_1',
    type: 'tap_diagram',
    prompt: 'How many phases does the cycle move through?',
    options: [{ label: 'Two' }, { label: 'Three' }, { label: 'Four' }, { label: 'Five' }],
    correctIndex: 2,
    explanation: 'Four — menstrual, follicular, ovulatory, and luteal.',
    explanationEmoji: '🔢',
    xpReward: 12,
  },
  {
    id: 'ex_cycle_basics_1_pairs',
    lessonId: 'lesson_cycle_basics_1',
    type: 'pairs',
    prompt: 'Match each word to what it means.',
    pairs: [
      { left: 'Cycle', right: 'Your monthly rhythm' },
      { left: 'Phase', right: 'A stage of the cycle' },
      { left: 'Period', right: 'The bleeding days' },
    ],
    explanation: 'The cycle is the whole rhythm; phases are its stages; the period is the bleeding part.',
    explanationEmoji: '🌸',
    xpReward: 12,
  },

  // ─── Cycle Basics · Lesson 3 — "Hormones" ──────────────────────
  {
    id: 'ex_cycle_basics_3_pairs',
    lessonId: 'lesson_cycle_basics_3',
    type: 'pairs',
    prompt: 'Match each hormone to how it tends to feel.',
    pairs: [
      { left: 'Estrogen', right: 'Sharp & social' },
      { left: 'Progesterone', right: 'Calm & sleepy' },
    ],
    explanation: 'Estrogen rises before ovulation (sharp, social); progesterone calms things in the luteal phase.',
    explanationEmoji: '✨',
    xpReward: 12,
  },
  {
    id: 'ex_cycle_basics_3_diagram',
    lessonId: 'lesson_cycle_basics_3',
    type: 'tap_diagram',
    prompt: 'Which hormone dominates the luteal phase?',
    options: [
      { label: 'Estrogen', emoji: '🌱' },
      { label: 'Progesterone', emoji: '🌙' },
      { label: 'Testosterone', emoji: '💪' },
    ],
    correctIndex: 1,
    explanation: 'Progesterone takes over in the luteal phase — its calming effect is why rest sounds good.',
    explanationEmoji: '🌙',
    xpReward: 12,
  },
  {
    id: 'ex_cycle_basics_3_fill',
    lessonId: 'lesson_cycle_basics_3',
    type: 'fill_blank',
    prompt: 'Complete the hormone story.',
    sentence: '{{0}} peaks in the late follicular phase, while {{1}} dominates the luteal phase.',
    blanks: [
      { answer: 'Estrogen', distractors: ['Progesterone', 'Insulin'] },
      { answer: 'Progesterone', distractors: ['Estrogen', 'Cortisol'] },
    ],
    explanation: 'Estrogen up before ovulation; progesterone up after.',
    explanationEmoji: '🧠',
    xpReward: 12,
  },

  // ─── Cycle Basics · Lesson 4 — "Why cycles vary" ───────────────
  {
    id: 'ex_cycle_basics_4_word',
    lessonId: 'lesson_cycle_basics_4',
    type: 'tap_word',
    prompt: 'Tap everything that can nudge your cycle by a few days.',
    tokens: ['Stress', 'Travel', 'Sleep changes', 'Your hair colour'],
    correctTokenIndexes: [0, 1, 2],
    explanation: 'Stress, travel, and sleep shifts can all move your cycle — hair colour can\'t!',
    explanationEmoji: '🌀',
    xpReward: 12,
  },
  {
    id: 'ex_cycle_basics_4_fill',
    lessonId: 'lesson_cycle_basics_4',
    type: 'fill_blank',
    prompt: 'When is it worth a chat with a doctor?',
    sentence: 'Consider checking in if cycles are consistently shorter than {{0}} days or longer than {{1}} days.',
    blanks: [
      { answer: '21', distractors: ['14', '18'] },
      { answer: '35', distractors: ['30', '45'] },
    ],
    explanation: 'Consistently under 21 or over 35 days is worth mentioning — not a diagnosis, just a good conversation.',
    explanationEmoji: '💛',
    xpReward: 12,
  },
  {
    id: 'ex_cycle_basics_4_diagram',
    lessonId: 'lesson_cycle_basics_4',
    type: 'tap_diagram',
    prompt: 'Missing for how many+ months (with no pregnancy) is worth checking?',
    options: [{ label: '1' }, { label: '2' }, { label: '3' }, { label: '6' }],
    correctIndex: 2,
    explanation: 'Three or more months without a period (and no pregnancy) is worth raising with a clinician.',
    explanationEmoji: '📆',
    xpReward: 12,
  },

  // ─── Puberty 101 · Lesson 1 — "Your body is changing" ──────────
  {
    id: 'ex_puberty_1_fill',
    lessonId: 'lesson_puberty_1',
    type: 'fill_blank',
    prompt: 'When does puberty usually start?',
    sentence: 'Puberty usually begins somewhere between ages {{0}} and {{1}} — and every timeline is different.',
    blanks: [
      { answer: '8', distractors: ['5', '11'] },
      { answer: '13', distractors: ['16', '18'] },
    ],
    explanation: 'Roughly 8–13, but starting earlier or later is still perfectly normal — you\'re on your own schedule.',
    explanationEmoji: '🦋',
    xpReward: 12,
  },
  {
    id: 'ex_puberty_1_diagram',
    lessonId: 'lesson_puberty_1',
    type: 'tap_diagram',
    prompt: 'Is there one "right" age to start?',
    options: [{ label: 'Yes — exactly 12' }, { label: 'No — everyone\'s timeline differs' }],
    correctIndex: 1,
    explanation: 'There\'s no single right age — whether you start at 9 or 14, that\'s perfect.',
    explanationEmoji: '💛',
    xpReward: 12,
  },

  // ─── Puberty 101 · Lesson 2 — "First period" ───────────────────
  {
    id: 'ex_puberty_2_fill',
    lessonId: 'lesson_puberty_2',
    type: 'fill_blank',
    prompt: 'When does a first period usually arrive?',
    sentence: 'A first period (menarche) usually arrives between ages {{0}} and {{1}}.',
    blanks: [
      { answer: '10', distractors: ['6', '13'] },
      { answer: '15', distractors: ['18', '20'] },
    ],
    explanation: 'Usually 10–15, and it can take 1–2 years to settle into a rhythm.',
    explanationEmoji: '🌸',
    xpReward: 12,
  },
  {
    id: 'ex_puberty_2_diagram',
    lessonId: 'lesson_puberty_2',
    type: 'tap_diagram',
    prompt: 'First periods are often…',
    options: [{ label: 'Heavy & regular' }, { label: 'Light & irregular' }, { label: 'Exactly 28 days' }],
    correctIndex: 1,
    explanation: 'Light and irregular at first is completely normal — your rhythm finds itself over time.',
    explanationEmoji: '💡',
    xpReward: 12,
  },

  // ─── Puberty 101 · Lesson 3 — "Products" ───────────────────────
  {
    id: 'ex_puberty_3_pairs',
    lessonId: 'lesson_puberty_3',
    type: 'pairs',
    prompt: 'Match each product to how it works.',
    pairs: [
      { left: 'Pads', right: 'Stick to your underwear' },
      { left: 'Tampons', right: 'Go inside · good for swimming' },
      { left: 'Cups', right: 'Reusable · worn inside' },
    ],
    explanation: 'There\'s no "right" one — just what feels best for you.',
    explanationEmoji: '🌿',
    xpReward: 12,
  },
  {
    id: 'ex_puberty_3_diagram',
    lessonId: 'lesson_puberty_3',
    type: 'tap_diagram',
    prompt: 'Which is usually easiest to start with?',
    options: [
      { label: 'Pads', emoji: '🩷' },
      { label: 'Tampons', emoji: '💛' },
      { label: 'Cups', emoji: '🌙' },
    ],
    correctIndex: 0,
    explanation: 'Pads are the simplest to begin with — you can always try others later.',
    explanationEmoji: '🩷',
    xpReward: 12,
  },
];

// ─── LOOKUPS ─────────────────────────────────────────────────────────

// 153 exercises from the imported curriculum — three per lesson (a matching
// pair, a fill-in-the-blank, and a tap-the-answer), which is what gives the
// conversational lesson flow something to actually ask about.
EXERCISES.push(...CURRICULUM_EXERCISES);

// OTA-aware lookups: cached downloaded exercises are preferred over bundled
// (cached wins by id), so new practice can ship without an app update. With no
// bundle cached these return exactly the bundled EXERCISES.
export function getExercise(exerciseId: string): Exercise | null {
  const cached = remoteContentStore.get()?.exercises.find((e) => e.id === exerciseId);
  return cached ?? EXERCISES.find((e) => e.id === exerciseId) ?? null;
}

export function getExercisesForLesson(lessonId: string): Exercise[] {
  const cached = (remoteContentStore.get()?.exercises ?? []).filter((e) => e.lessonId === lessonId);
  if (cached.length === 0) return EXERCISES.filter((e) => e.lessonId === lessonId);
  const byId = new Map<string, Exercise>();
  for (const e of EXERCISES) if (e.lessonId === lessonId) byId.set(e.id, e);
  for (const e of cached) byId.set(e.id, e); // cached wins
  return Array.from(byId.values());
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
