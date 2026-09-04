/**
 * Dottie — Lesson Conversation Harness
 *
 * The companion now TALKS. That is a bigger change than it looks: the app has
 * just started putting sentences in a character's mouth, in a menstrual-health
 * app, for an audience that includes thirteen-year-olds. So the boundary that
 * makes it safe has to be a test, not an intention.
 *
 *  D1 THE BOUNDARY   — every factual sentence a companion speaks must appear
 *                      VERBATIM in the curriculum. The engine may sequence
 *                      vetted content and add tone; it may never state a fact
 *                      of its own. Checked against the real bundled content,
 *                      lesson by lesson, across the whole corpus.
 *  D2 TONE IS EMPTY  — the lines the engine DOES own must contain no health
 *                      claim, no diagnosis, no imperative about a body, and no
 *                      invented statistic.
 *  D3 SHAPE          — teach before you test; a question never opens a lesson;
 *                      every question has a valid answer and a real explanation.
 *  D4 REACTIONS      — a right answer still gets explained; a wrong answer is
 *                      never called wrong; there is no third attempt; the
 *                      explanation is identical whichever way the user went.
 *  D5 ROTATION       — openers never repeat back to back, and the same lesson
 *                      always replays identically.
 *  D6 THE CORPUS     — every bundled lesson can build a script without
 *                      throwing, and none of them produce an empty one.
 *
 * Run: npm run test:dialogue
 */

import {
  buildLessonScript,
  reactTo,
  pick,
  hash,
  ALL_TONAL_LINES,
  type AskStep,
  type LessonScript,
} from '../src/engine/learn/dialogue';
import { LESSONS } from '../src/content/learning-paths';
import { QUIZZES } from '../src/content/quizzes';
import { CURRICULUM_EXERCISES } from '../src/content/curriculum.generated';

let failures = 0;
let current = '';

function scenario(name: string, fn: () => void): void {
  current = name;
  console.log(`\n\x1b[1m${name}\x1b[0m`);
  try {
    fn();
  } catch (err) {
    failures++;
    console.log(`  \x1b[31m✗ threw: ${(err as Error).message}\x1b[0m`);
  }
}

function ok(label: string, cond: boolean, detail?: string): void {
  if (cond) {
    console.log(`  \x1b[32m✓\x1b[0m ${label}`);
    return;
  }
  failures++;
  console.log(`  \x1b[31m✗ ${label}\x1b[0m${detail ? ` — ${detail}` : ''} (in "${current}")`);
}

const quizByLesson = new Map(QUIZZES.map((q) => [q.lessonId, q]));
const exercisesByLesson = new Map<string, typeof CURRICULUM_EXERCISES>();
for (const ex of CURRICULUM_EXERCISES) {
  const list = exercisesByLesson.get(ex.lessonId) ?? [];
  list.push(ex);
  exercisesByLesson.set(ex.lessonId, list);
}

function scriptFor(lessonId: string): LessonScript {
  const lesson = LESSONS.find((l) => l.id === lessonId);
  if (!lesson) throw new Error(`no lesson ${lessonId}`);
  return buildLessonScript({
    lesson,
    exercises: exercisesByLesson.get(lessonId) ?? [],
    quiz: quizByLesson.get(lessonId) ?? null,
    companionName: 'Nyx',
    userName: 'Sam',
  });
}

const SAMPLE = 'lesson_what_is_the_menstrual_cycle';

// ─── D1 — the boundary ───────────────────────────────────────────────

scenario('D1 · every factual thing the companion says is verbatim from the curriculum', () => {
  // The corpus of sentences the content is allowed to contain.
  const sourceText = new Set<string>();
  for (const lesson of LESSONS) for (const s of lesson.sections) sourceText.add(s.content);
  for (const quiz of QUIZZES) {
    for (const q of quiz.questions) {
      sourceText.add(q.text);
      sourceText.add(q.explanation);
      for (const o of q.options) sourceText.add(o);
    }
  }
  for (const ex of CURRICULUM_EXERCISES) {
    sourceText.add(ex.prompt);
    sourceText.add(ex.explanation);
    if (ex.type === 'tap_diagram') for (const o of ex.options) sourceText.add(o.label);
  }

  let strays: string[] = [];
  let contentBeats = 0;
  for (const lesson of LESSONS) {
    const script = scriptFor(lesson.id);
    for (const step of script.steps) {
      if (step.kind === 'say' && step.fromContent) {
        contentBeats++;
        if (!sourceText.has(step.text)) strays.push(`say: ${step.text.slice(0, 60)}`);
      }
      if (step.kind === 'show') {
        contentBeats++;
        if (!sourceText.has(step.text)) strays.push(`show: ${step.text.slice(0, 60)}`);
      }
      if (step.kind === 'ask') {
        contentBeats++;
        if (!sourceText.has(step.prompt)) strays.push(`prompt: ${step.prompt.slice(0, 60)}`);
        if (!sourceText.has(step.explanation)) strays.push(`explanation: ${step.explanation.slice(0, 60)}`);
        for (const o of step.options) {
          if (!sourceText.has(o.label)) strays.push(`option: ${o.label.slice(0, 40)}`);
        }
      }
    }
  }
  ok(`checked ${contentBeats} content beats across ${LESSONS.length} lessons`, contentBeats > 500, String(contentBeats));
  ok('not one of them was written by the engine', strays.length === 0, strays.slice(0, 4).join(' | '));
});

// ─── D2 — the engine's own lines say nothing about a body ────────────

scenario('D2 · the lines the engine owns carry tone and nothing else', () => {
  ok('there are some', ALL_TONAL_LINES.length >= 20, String(ALL_TONAL_LINES.length));

  // Words that would make a tonal line into a health claim.
  const CLINICAL = /\b(hormone|estrogen|progesterone|ovulat|uterus|uterine|cramp|period|cycle day|pms|pmdd|symptom|diagnos|pregnan|fertil|bleed|flow|discharge|medication|treat)\w*/i;
  const clinical = ALL_TONAL_LINES.filter((l) => CLINICAL.test(l));
  ok('no clinical vocabulary anywhere in them', clinical.length === 0, clinical.join(' | '));

  // No claim about the reader's own body, and no invented cohort.
  const BODY_CLAIM = /\byour body (is|will|does|has)\b|\byou (are|will be) (feeling|experiencing)\b/i;
  ok('none of them makes a claim about the reader\'s body', !ALL_TONAL_LINES.some((l) => BODY_CLAIM.test(l)));
  ok('no invented statistic', !ALL_TONAL_LINES.some((l) => /\d+\s*%/.test(l)));
  ok('no population claim', !ALL_TONAL_LINES.some((l) => /most (people|women|users)|studies show/i.test(l)));

  // And none of them is a buzzer.
  ok('never says "wrong"', !ALL_TONAL_LINES.some((l) => /\bwrong\b/i.test(l)));
  ok('never says "incorrect"', !ALL_TONAL_LINES.some((l) => /\bincorrect\b/i.test(l)));
  ok('never says "failed"', !ALL_TONAL_LINES.some((l) => /\bfail(ed)?\b/i.test(l)));
});

// ─── D3 — the shape of the conversation ──────────────────────────────

scenario('D3 · it teaches before it tests', () => {
  const script = scriptFor(SAMPLE);
  ok('the script has steps', script.steps.length > 0, String(script.steps.length));
  ok('the companion speaks first', script.steps[0]!.kind === 'say');
  ok('the opener is the engine\'s, not the content\'s', script.steps[0]!.kind === 'say' && !script.steps[0]!.fromContent);

  const firstAsk = script.steps.findIndex((s) => s.kind === 'ask');
  ok('there is at least one question', firstAsk > 0, String(firstAsk));
  const taughtFirst = script.steps.slice(0, firstAsk).filter((s) => s.kind === 'say' || s.kind === 'show').length;
  ok('at least two teaching beats land before the first question', taughtFirst >= 2, String(taughtFirst));

  ok('it ends on a closing beat', script.steps[script.steps.length - 1]!.kind === 'finish');
  ok('exactly one closing beat', script.steps.filter((s) => s.kind === 'finish').length === 1);
  ok('questionCount matches the steps', script.questionCount === script.steps.filter((s) => s.kind === 'ask').length);
  ok('a lesson is not an exam', script.questionCount <= 5, String(script.questionCount));

  const asks = script.steps.filter((s): s is AskStep => s.kind === 'ask');
  ok('every question has at least two options', asks.every((a) => a.options.length >= 2));
  ok('every correct index is in range', asks.every((a) => a.correctIndex >= 0 && a.correctIndex < a.options.length));
  ok('every question carries an explanation', asks.every((a) => a.explanation.trim().length > 0));
  ok('every question carries a lead-in', asks.every((a) => a.lead.trim().length > 0));
  ok('no duplicate step ids', new Set(script.steps.map((s) => s.id)).size === script.steps.length);
});

// ─── D4 — how it reacts ──────────────────────────────────────────────

scenario('D4 · a friend, not a scorekeeper', () => {
  const base = { explanation: 'Day 1 is the first bleeding day.', explanationEmoji: '🩸', seed: 'q1', index: 0 };

  const right = reactTo({ ...base, correct: true, attempt: 1, streak: 0 });
  const wrong = reactTo({ ...base, correct: false, attempt: 1, streak: 0 });
  const wrongAgain = reactTo({ ...base, correct: false, attempt: 2, streak: 0 });

  ok('a right answer still gets the explanation', right.explanation === base.explanation);
  ok('a wrong answer gets the same explanation, word for word', wrong.explanation === base.explanation);
  ok('and so does the second miss', wrongAgain.explanation === base.explanation);
  ok('the explanation is never softened or rewritten', right.explanation === wrong.explanation);

  ok('a miss is never called wrong', !/wrong|incorrect|nope\b/i.test(wrong.opener), wrong.opener);
  ok('a first miss offers another go', wrong.offerRetry);
  ok('a second miss does not — no trap loop', !wrongAgain.offerRetry);
  ok('a correct answer never offers a retry', !right.offerRetry);

  ok('getting it right looks proud', right.expression === 'proud');
  ok('a miss stays warm rather than sad', wrong.expression === 'encourage');
  ok('a second miss softens further', wrongAgain.expression === 'cozy');

  const streaking = reactTo({ ...base, correct: true, attempt: 1, streak: 3 });
  ok('a streak changes the tone', streaking.opener !== right.opener || streaking.aside !== right.aside);
  ok('a streak celebrates', streaking.expression === 'celebrate');
  ok('and says how long it is', streaking.aside === '4 in a row.');
  ok('but the facts are untouched by the streak', streaking.explanation === base.explanation);
  ok('no streak note when there is no streak', right.aside === null);
});

// ─── D5 — rotation and determinism ───────────────────────────────────

scenario('D5 · the companion does not repeat itself, and replays identically', () => {
  // Consecutive reactions must not open with the same line — the "Nice! Nice!
  // Nice!" failure that turns a character into a sound effect.
  let repeats = 0;
  let last = '';
  for (let i = 0; i < 40; i++) {
    const r = reactTo({
      correct: true,
      attempt: 1,
      streak: 0,
      explanation: 'x',
      seed: 'q',
      index: i,
    });
    if (r.opener === last) repeats++;
    last = r.opener;
  }
  ok('40 consecutive correct answers never repeat an opener back to back', repeats === 0, `${repeats} repeats`);

  let missRepeats = 0;
  last = '';
  for (let i = 0; i < 40; i++) {
    const r = reactTo({ correct: false, attempt: 1, streak: 0, explanation: 'x', seed: 'q', index: i });
    if (r.opener === last) missRepeats++;
    last = r.opener;
  }
  ok('and nor do misses', missRepeats === 0, `${missRepeats} repeats`);

  // But it does vary — a pool that always returns entry 0 would also pass the
  // no-repeat check above.
  const seen = new Set<string>();
  for (let i = 0; i < 20; i++) {
    seen.add(reactTo({ correct: true, attempt: 1, streak: 0, explanation: 'x', seed: 'q', index: i }).opener);
  }
  ok('it actually uses the whole pool', seen.size >= 4, String(seen.size));

  const a = scriptFor(SAMPLE);
  const b = scriptFor(SAMPLE);
  ok('the same lesson builds the same script', JSON.stringify(a) === JSON.stringify(b));
  const other = scriptFor('lesson_the_four_phases_your_inner_seasons');
  ok('a different lesson gets a different opener', a.steps[0]!.kind === 'say' && other.steps[0]!.kind === 'say' && (a.steps[0] as { text: string }).text !== (other.steps[0] as { text: string }).text);

  ok('pick is stable', pick(['a', 'b', 'c'], 5, 1) === pick(['a', 'b', 'c'], 5, 1));
  ok('hash is stable', hash('dottie') === hash('dottie'));
  ok('hash separates different strings', hash('dottie') !== hash('dottio'));
  let thrown = false;
  try {
    pick([], 0, 0);
  } catch {
    thrown = true;
  }
  ok('an empty pool throws rather than returning undefined', thrown);
});

// ─── D6 — the whole corpus ───────────────────────────────────────────

scenario('D6 · every bundled lesson can hold a conversation', () => {
  let built = 0;
  let questionless = 0;
  let shortest = Infinity;
  const broken: string[] = [];
  for (const lesson of LESSONS) {
    try {
      const script = scriptFor(lesson.id);
      built++;
      shortest = Math.min(shortest, script.steps.length);
      if (script.questionCount === 0) questionless++;
      if (script.steps.length < 3) broken.push(`${lesson.id} has ${script.steps.length} steps`);
    } catch (err) {
      broken.push(`${lesson.id}: ${(err as Error).message}`);
    }
  }
  ok(`all ${LESSONS.length} lessons build a script`, built === LESSONS.length, broken.slice(0, 3).join(' | '));
  ok('none of them is a stub', broken.length === 0, broken.slice(0, 3).join(' | '));
  ok('the shortest is still a conversation', shortest >= 3, String(shortest));
  // Some hand-written seed lessons predate the quizzes; the imported 51 all
  // have one, so the bulk of the corpus must be able to ask something.
  ok('most lessons have something to ask', questionless < LESSONS.length / 2, `${questionless} without questions`);
});

console.log(
  failures === 0
    ? '\n\x1b[32m✓ lesson conversation: the companion speaks, and never makes anything up\x1b[0m\n'
    : `\n\x1b[31m✗ ${failures} failure(s)\x1b[0m\n`
);
process.exit(failures === 0 ? 0 : 1);
