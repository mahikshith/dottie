/**
 * Dottie — curriculum importer
 *
 * Turns docs/curriculum/dottie_curriculum_1.json into bundled TypeScript
 * content (src/content/curriculum.generated.ts).
 *
 * ─── WHY A GENERATOR RATHER THAN HAND-TYPING ────────────────────────
 *
 *  The source file carries 119 lessons, 357 exercises and 714 quiz questions
 *  written and vetted elsewhere. Retyping any of it would introduce errors in
 *  exactly the copy that must not carry them, and would make the next import a
 *  second manual pass. This runs, it is deterministic, and it re-runs when the
 *  curriculum is updated.
 *
 * ─── WHAT IT REFUSES TO DO ──────────────────────────────────────────
 *
 *  It does not invent, paraphrase or "improve" a single sentence of the
 *  content. The one thing it adds is structure the app's schema needs and the
 *  source doesn't carry: path tier/mode/gradient, and the `adultOnly` flag on
 *  lessons about fertility and contraception so the phase-aware selector can
 *  keep them away from teen mode.
 *
 *  It also refuses to import a lesson whose id already exists in
 *  learning-paths.ts. Two lessons with one id is a silent content bug that
 *  surfaces as the wrong lesson opening from the wrong card.
 *
 * Run: npx tsx scripts/import-curriculum.ts
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LESSONS, LEARNING_PATHS } from '../src/content/learning-paths';
import { QUIZZES } from '../src/content/quizzes';

// ─── SELECTION ───────────────────────────────────────────────────────
//
// The owner asked for "say 50 for now", arranged around the two ways the Learn
// tab already lets people choose: the BASICS, and SYNC WITH CYCLE (what's
// relevant to the phase you're in). So the batch is the four phase paths plus
// the foundations, then the day-to-day paths people reach for while they're in
// a phase — pain, mood, breathing, sleep, food, movement.
//
// Deliberately NOT in this batch: contraception, sexual health, and the
// condition paths (PCOS, endo, perimenopause, thyroid). They are the ones that
// most need the adult/teen gate and the condition-mode routing to be designed
// properly rather than bulk-imported, so they come as their own pass.

const PATH_ORDER: string[] = [
  // Foundations
  'path_cycle_basics',
  'path_hormones_101',
  // The four seasons
  'path_menstrual_phase',
  'path_follicular_phase',
  'path_ovulation',
  'path_luteal_pms',
  // Living in the phase you're in
  'path_pain_management',
  'path_mood_mental',
  'path_mood_tools',
  'path_breathing',
  'path_sleep',
  'path_nutrition',
  'path_phase_foods',
  'path_movement',
  'path_tracking_skills',
];

/** Roughly how many lessons to take. The last path is taken whole or not at all. */
const LESSON_BUDGET = 52;

/**
 * Gradients per path, so the Learn tab's cards stay in the phase language the
 * rest of the app speaks rather than picking a colour at random.
 */
const PATH_GRADIENT: Record<string, string> = {
  path_cycle_basics: 'follicular',
  path_hormones_101: 'luteal',
  path_menstrual_phase: 'menstrual',
  path_follicular_phase: 'follicular',
  path_ovulation: 'ovulatory',
  path_luteal_pms: 'luteal',
  path_pain_management: 'menstrual',
  path_mood_mental: 'luteal',
  path_mood_tools: 'ovulatory',
  path_breathing: 'follicular',
  path_sleep: 'luteal',
  path_nutrition: 'follicular',
  path_phase_foods: 'ovulatory',
  path_movement: 'follicular',
  path_tracking_skills: 'menstrual',
};

/**
 * Lessons that must never be surfaced in teen mode. Matched on the lesson id,
 * not on a keyword sweep of the body — a sweep would both miss cases and
 * over-flag ones ("fertile window" appears in ovulation lessons that are
 * perfectly appropriate).
 */
const ADULT_ONLY = new Set<string>([
  'lesson_the_fertile_window',
  'lesson_fertility_basics',
  'lesson_combining_fertility_signs',
  'lesson_age_fertility',
  'lesson_contraception_overview',
  'lesson_emergency_contraception',
  'lesson_the_pill_simply_explained',
  'lesson_barrier_methods_condoms',
  'lesson_long_acting_methods_iuds_implant',
  'lesson_libido_across_your_cycle',
  'lesson_comfort_during_sex',
  'lesson_pcos_fertility',
]);

// ─── SOURCE SHAPE ────────────────────────────────────────────────────

interface SrcPath {
  id: string;
  title: string;
  emoji: string;
  description: string;
  lessons: string[];
}
interface SrcSection {
  type: string;
  content: string;
  emoji?: string;
  highlight?: string;
}
interface SrcLesson {
  id: string;
  pathId: string;
  order: number;
  title: string;
  emoji: string;
  difficulty: string;
  sections: SrcSection[];
  exerciseIds: string[];
  quizId: string;
  xpReward: number;
  gemReward: number;
  estimatedMinutes: number;
}
interface SrcQuiz {
  id: string;
  title: string;
  lessonId: string;
  totalQuestions: number;
  questionsPerAttempt: number;
  passingScore: number;
  questions: {
    id: string;
    text: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    explanationEmoji?: string;
    level: string;
  }[];
}
type SrcExercise = Record<string, unknown> & {
  id: string;
  lessonId: string;
  type: string;
};
interface Source {
  paths: SrcPath[];
  lessons: SrcLesson[];
  exercises: SrcExercise[];
  quizzes: SrcQuiz[];
}

// ─── RUN ─────────────────────────────────────────────────────────────

const ROOT = process.cwd();
const src: Source = JSON.parse(
  readFileSync(join(ROOT, 'docs/curriculum/dottie_curriculum_1.json'), 'utf8')
);

const existingLessonIds = new Set(LESSONS.map((l) => l.id));
const existingPathIds = new Set(LEARNING_PATHS.map((p) => p.id));
const existingQuizIds = new Set(QUIZZES.map((q) => q.id));
// exercises.ts reaches the remote content store, which reaches MMKV — importing
// it here would drag React Native into a Node script. The ids are all we need.
const existingExerciseIds = new Set(
  [...readFileSync(join(process.cwd(), 'src/content/exercises.ts'), 'utf8').matchAll(/id: '([^']+)'/g)].map(
    (m) => m[1]!
  )
);

const lessonById = new Map(src.lessons.map((l) => [l.id, l]));
const quizById = new Map(src.quizzes.map((q) => [q.id, q]));
const exerciseById = new Map(src.exercises.map((e) => [e.id, e]));

const takenLessons: SrcLesson[] = [];
const takenPaths: SrcPath[] = [];
const skipped: string[] = [];

for (const pathId of PATH_ORDER) {
  const path = src.paths.find((p) => p.id === pathId);
  if (!path) {
    skipped.push(`path ${pathId} not in source`);
    continue;
  }
  const lessons = path.lessons
    .map((id) => lessonById.get(id))
    .filter((l): l is SrcLesson => l !== undefined)
    // Never import a lesson id the app already ships.
    .filter((l) => {
      if (existingLessonIds.has(l.id)) {
        skipped.push(`lesson ${l.id} already in the app`);
        return false;
      }
      return true;
    });
  if (lessons.length === 0) continue;
  if (takenLessons.length + lessons.length > LESSON_BUDGET) break;
  takenPaths.push(path);
  takenLessons.push(...lessons);
}

// Re-number each path's lessons: dropping an already-imported lesson would
// otherwise leave a gap, and `order` drives the Learn tab's path ladder.
const orderByPath = new Map<string, number>();
const lessonsOut = takenLessons.map((l) => {
  const next = (orderByPath.get(l.pathId) ?? 0) + 1;
  orderByPath.set(l.pathId, next);
  return { ...l, order: next };
});

const quizzesOut = lessonsOut
  .map((l) => quizById.get(l.quizId))
  .filter((q): q is SrcQuiz => q !== undefined && !existingQuizIds.has(q.id));

const exercisesOut = lessonsOut
  .flatMap((l) => l.exerciseIds)
  .map((id) => exerciseById.get(id))
  .filter((e): e is SrcExercise => e !== undefined && !existingExerciseIds.has(e.id));

// ─── SANITY, BEFORE WE WRITE ANYTHING ────────────────────────────────

const problems: string[] = [];
for (const l of lessonsOut) {
  if (!l.difficulty) problems.push(`lesson ${l.id} has no difficulty (validate:content R2)`);
  if (l.sections.length === 0) problems.push(`lesson ${l.id} has no sections`);
  if (existingPathIds.has(l.pathId) && !takenPaths.some((p) => p.id === l.pathId)) {
    problems.push(`lesson ${l.id} points at a path we are not emitting`);
  }
}
for (const q of quizzesOut) {
  for (const question of q.questions) {
    if (!question.level) problems.push(`question ${question.id} has no level (validate:content R1)`);
    if (question.correctIndex < 0 || question.correctIndex >= question.options.length) {
      problems.push(`question ${question.id} has an out-of-range correctIndex`);
    }
  }
}
const lessonIds = new Set(lessonsOut.map((l) => l.id));
if (lessonIds.size !== lessonsOut.length) problems.push('duplicate lesson ids in the output');
if (problems.length > 0) {
  console.error('\x1b[31mRefusing to write — source problems:\x1b[0m');
  for (const p of problems) console.error(`  · ${p}`);
  process.exit(1);
}

// ─── EMIT ────────────────────────────────────────────────────────────

const q = (s: string) => JSON.stringify(s);

function emitPath(p: SrcPath): string {
  const count = lessonsOut.filter((l) => l.pathId === p.id).length;
  const minutes = lessonsOut
    .filter((l) => l.pathId === p.id)
    .reduce((n, l) => n + l.estimatedMinutes, 0);
  const grad = PATH_GRADIENT[p.id] ?? 'follicular';
  return `  {
    id: ${q(p.id)},
    title: ${q(p.title)},
    description: ${q(p.description)},
    emoji: ${q(p.emoji)},
    tier: 'free',
    mode: 'all',
    totalLessons: ${count},
    estimatedMinutes: ${minutes},
    completionBadgeId: ${q(`badge_${p.id}`)},
    completionXP: ${count * 20},
    completionGems: ${count * 5},
    gradient: Colors.phase.${grad}.gradient,
  },`;
}

function emitSection(s: SrcSection): string {
  const bits = [`type: ${q(s.type)}`, `content: ${q(s.content)}`];
  if (s.emoji) bits.push(`emoji: ${q(s.emoji)}`);
  if (s.highlight) bits.push(`highlight: ${q(s.highlight)}`);
  return `      { ${bits.join(', ')} },`;
}

function emitLesson(l: SrcLesson & { order: number }): string {
  const adult = ADULT_ONLY.has(l.id) ? '\n    adultOnly: true,' : '';
  return `  {
    id: ${q(l.id)},
    pathId: ${q(l.pathId)},
    order: ${l.order},
    title: ${q(l.title)},
    emoji: ${q(l.emoji)},
    difficulty: ${q(l.difficulty)},${adult}
    sections: [
${l.sections.map(emitSection).join('\n')}
    ],
    xpReward: ${l.xpReward},
    gemReward: ${l.gemReward},
    estimatedMinutes: ${l.estimatedMinutes},
    quizId: ${q(l.quizId)},
  },`;
}

function emitQuiz(z: SrcQuiz): string {
  const questions = z.questions
    .map(
      (question) => `      {
        id: ${q(question.id)},
        text: ${q(question.text)},
        options: [${question.options.map(q).join(', ')}],
        correctIndex: ${question.correctIndex},
        explanation: ${q(question.explanation)},${
          question.explanationEmoji ? `\n        explanationEmoji: ${q(question.explanationEmoji)},` : ''
        }
        level: ${q(question.level)},
      },`
    )
    .join('\n');
  return `  {
    id: ${q(z.id)},
    title: ${q(z.title)},
    lessonId: ${q(z.lessonId)},
    totalQuestions: ${z.questions.length},
    questionsPerAttempt: ${z.questionsPerAttempt},
    passingScore: ${z.passingScore},
    questions: [
${questions}
    ],
  },`;
}

/** Exercises are emitted structurally — the shapes already match the app's. */
function emitExercise(e: SrcExercise): string {
  const body = Object.entries(e)
    .filter(([k]) => k !== 'lessonId')
    .map(([k, v]) => `    ${k}: ${JSON.stringify(v)},`)
    .join('\n');
  return `  {
    lessonId: ${q(e.lessonId)},
${body}
  },`;
}

const header = `/**
 * Dottie — bundled curriculum (GENERATED — do not edit by hand)
 *
 * Emitted by \`npx tsx scripts/import-curriculum.ts\` from
 * docs/curriculum/dottie_curriculum_1.json. Edit the JSON or the importer,
 * never this file: the next import overwrites it.
 *
 * ─── WHAT'S IN HERE ─────────────────────────────────────────────────
 *
 *  ${takenPaths.length} paths · ${lessonsOut.length} lessons · ${quizzesOut.length} quizzes · ${exercisesOut.length} exercises
 *
 *  The paths are ordered foundations → the four phases → living in the phase
 *  you're in, which is the order the Learn tab reads them in and the order the
 *  phase-aware selector falls back through.
 *
 *  Every lesson carries \`difficulty\` and every question carries \`level\`,
 *  because validate:content (R1–R4) rejects the build otherwise — and because
 *  the adaptive quiz engine has nothing to tier on without them.
 *
 *  Copy is verbatim from the source curriculum. Nothing here was written,
 *  paraphrased or "improved" by the importer.
 */

import type { LearningPath, Lesson, Quiz, Exercise } from '../types/content.types';
import { Colors } from '../constants/colors';

// ─── PATHS ───────────────────────────────────────────────────────────

export const CURRICULUM_PATHS: LearningPath[] = [
${takenPaths.map(emitPath).join('\n')}
];

// ─── LESSONS ─────────────────────────────────────────────────────────

export const CURRICULUM_LESSONS: Lesson[] = [
${lessonsOut.map(emitLesson).join('\n')}
];

// ─── QUIZZES ─────────────────────────────────────────────────────────

export const CURRICULUM_QUIZZES: Quiz[] = [
${quizzesOut.map(emitQuiz).join('\n')}
];

// ─── EXERCISES ───────────────────────────────────────────────────────

export const CURRICULUM_EXERCISES: Exercise[] = [
${exercisesOut.map(emitExercise).join('\n')}
];
`;

writeFileSync(join(ROOT, 'src/content/curriculum.generated.ts'), header);

console.log(`\x1b[32m✓ wrote src/content/curriculum.generated.ts\x1b[0m`);
console.log(`  paths     ${takenPaths.length}`);
console.log(`  lessons   ${lessonsOut.length}`);
console.log(`  quizzes   ${quizzesOut.length}  (${quizzesOut.reduce((n, z) => n + z.questions.length, 0)} questions)`);
console.log(`  exercises ${exercisesOut.length}`);
if (skipped.length > 0) {
  console.log(`\n  skipped ${skipped.length}:`);
  for (const s of skipped.slice(0, 12)) console.log(`    · ${s}`);
}
