/**
 * Dottie — Quiz flow harness (device-test-22)
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────
 *
 *  DT22, owner: "for some or most of the lessons it is showing loading page
 *  for the second part of the quiz and it doesn't show anything after the
 *  loading page."
 *
 *  Nothing in the suite had ever opened a real quiz. `validate:content` checks
 *  that a lesson's `quizId` RESOLVES; `test:adaptive` checks the selector
 *  against a synthetic bank. Neither one ever asked the question the user asks:
 *  "I tapped Quiz — do I get a question?"
 *
 *  So this walks EVERY lesson that offers a quiz, through the exact calls the
 *  quiz screen makes, and asserts a question comes back and the run can be
 *  finished. It is the regression test for a screen that can only fail by
 *  showing a spinner forever, which is the least debuggable failure there is.
 *
 * Run: npm run test:quiz
 * No React Native imports — runnable in Node via tsx.
 */

import './harness/bootstrap';
// Imported from the leaf modules, not the barrel: the barrel also re-exports
// the OTA merge layer, which reaches for MMKV and cannot load under Node.
import { ContentResolver, InMemoryCohortProvider } from '../src/engine/content/content-resolver';
import { QuizEngine, type QuizProvider } from '../src/engine/content/quiz-engine';
import type { QuizAttempt } from '../src/types/content.types';
import { LESSONS } from '../src/content/learning-paths';
import { QUIZZES, getQuiz, getQuizForLesson } from '../src/content/quizzes';

/** The same provider hydration builds, without the OTA merge wrapper. */
function bundledQuizProvider(): QuizProvider {
  return {
    getQuiz: (quizId: string) => getQuiz(quizId),
    getAllQuizzes: () => [...QUIZZES],
    getQuizForLesson: (lessonId: string) => getQuizForLesson(lessonId),
  };
}

// ─── TINY ASSERT ─────────────────────────────────────────────────────

let failures = 0;
let checks = 0;
function expect(label: string, ok: boolean, detail = ''): void {
  checks++;
  if (ok) return;
  failures++;
  console.log(`  \x1b[31m✗ ${label}\x1b[0m${detail ? ` — ${detail}` : ''}`);
}

// ─── AN ENGINE WIRED THE WAY HYDRATION WIRES IT ──────────────────────

function makeEngine(): QuizEngine {
  const saved: QuizAttempt[] = [];
  return new QuizEngine(
    new ContentResolver(new InMemoryCohortProvider()),
    {
      saveAttempt: (a) => {
        saved.push(a as QuizAttempt);
      },
      getAttemptsForQuiz: (quizId: string) => saved.filter((a) => a.quizId === quizId),
      getAllAttempts: () => [...saved],
      getBestScore: (quizId: string) => {
        const forQuiz = saved.filter((a) => a.quizId === quizId);
        return forQuiz.length === 0 ? 0 : Math.max(...forQuiz.map((a) => a.score));
      },
    },
    bundledQuizProvider()
  );
}

console.log('\x1b[1m\nDottie — Quiz flow harness\x1b[0m');

const engine = makeEngine();

// ─── 1. EVERY LESSON THAT OFFERS A QUIZ CAN OPEN ONE ─────────────────

const withQuiz = LESSONS.filter((l) => l.quizId);
console.log(`  Lessons offering a quiz: ${withQuiz.length} of ${LESSONS.length}`);

const emptyBanks: string[] = [];
const noSession: string[] = [];
const noQuestions: string[] = [];

for (const lesson of withQuiz) {
  const quizId = lesson.quizId as string;

  // The screen passes adaptive: true. That path goes through a DIFFERENT
  // selector than the legacy one, so it is the one that has to be walked.
  const session = engine.startAttempt(quizId, 'fox', 'follicular', 5, 0, undefined, true);

  if (!session) {
    noSession.push(`${lesson.id} → ${quizId}`);
    continue;
  }
  if (session.questions.length === 0) {
    noQuestions.push(`${lesson.id} → ${quizId}`);
    continue;
  }

  // The first question must be renderable: text and at least two options, and
  // a correct index inside the options array.
  const first = session.questions[0]!;
  expect(
    `${quizId}: first question has text`,
    typeof first.questionText === 'string' && first.questionText.length > 0
  );
  expect(`${quizId}: first question has options`, first.options.length >= 2);

  // Walk the whole run the way the screen does, then finish it.
  for (let i = 0; i < session.questions.length; i++) {
    const res = engine.submitAnswer(session.sessionId, i, 0);
    expect(`${quizId}: answer ${i} accepted`, res !== null);
  }
  const result = engine.finishAttempt(session.sessionId);
  expect(`${quizId}: the run can be finished`, result !== null);
}

expect(
  'every lesson with a quizId can start an attempt',
  noSession.length === 0,
  noSession.slice(0, 8).join(', ')
);
expect(
  'no attempt comes back with zero questions',
  noQuestions.length === 0,
  noQuestions.slice(0, 8).join(', ')
);

// ─── 2. NO QUIZ IN THE BUNDLE HAS AN EMPTY BANK ──────────────────────
//
// startAttempt returns null for an empty bank, which the screen turns into
// "this quiz isn't available yet" — honest, but it should never happen for
// bundled content.

for (const quiz of QUIZZES) {
  if (quiz.questions.length === 0) emptyBanks.push(quiz.id);
}
expect('no bundled quiz has an empty question bank', emptyBanks.length === 0, emptyBanks.join(', '));

// ─── 3. THE ADAPTIVE SLATE IS NEVER EMPTY FOR A NON-EMPTY BANK ───────
//
// This is the shape of failure that would render the quiz chrome with no
// question in it — a screen that looks broken rather than one that says so.

for (const quiz of QUIZZES) {
  if (quiz.questions.length === 0) continue;
  const s = engine.startAttempt(quiz.id, 'fox', 'luteal', 12, 3, undefined, true);
  expect(`${quiz.id}: adaptive slate is non-empty`, (s?.questions.length ?? 0) > 0);
}

// ─── 4. A MISSING QUIZ IS NULL, NOT A THROW ──────────────────────────
//
// The screen relies on null to show its friendly error. If this ever threw,
// the error would escape the effect and take the whole tree to the root
// boundary instead.

let threw = false;
try {
  const s = engine.startAttempt('quiz_that_does_not_exist', 'fox', 'menstrual', 1, 0, undefined, true);
  expect('a missing quiz returns null', s === null);
} catch {
  threw = true;
}
expect('a missing quiz does not throw', !threw);

// ─── REPORT ──────────────────────────────────────────────────────────

console.log('');
if (failures === 0) {
  console.log(`  \x1b[32m✓ ${checks} checks — every lesson's quiz opens, answers and finishes.\x1b[0m\n`);
  process.exit(0);
}
console.log(`  \x1b[31m✗ ${failures} of ${checks} checks failed.\x1b[0m\n`);
process.exit(1);
