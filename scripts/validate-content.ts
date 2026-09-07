/**
 * Dottie — Content Schema Validator (Learn Redesign Phase 0)
 *
 * Fails loudly if any imported curriculum content is missing the fields
 * the new engines rely on. Prevents a repeat of the "we stripped
 * difficulty tags on import so the adaptive quiz can't tier" bug (Gemini
 * Master Spec FM-1 P0).
 *
 * Run: npm run validate:content
 * Called: manually + in CI (add step whenever a Gemini import lands).
 *
 * Rules today (kept small on purpose — expand as new engines land):
 *
 *   RULE 1  Every lesson in a curriculum-imported path must have `difficulty`.
 *   RULE 2  Every quiz question with an id starting `q_` (curriculum-import
 *           convention) must have `level`.
 *   RULE 3  Every lesson referenced by a quiz's `lessonId` must exist.
 *   RULE 4  Every quiz referenced by a lesson's `quizId` must exist.
 *
 * Rules deliberately DO NOT enforce difficulty on legacy hand-authored
 * cycle_basics / puberty_101 lessons — those predate the schema and
 * still work; only NEW imports must comply.
 */

import { LESSONS } from '../src/content/learning-paths';
import { QUIZZES } from '../src/content/quizzes';
import { CONDITION_OPTIONS } from '../src/content/conditions';

const CURRICULUM_IMPORT_PATH_PREFIXES = ['path_'];

interface Violation {
  rule: string;
  target: string;
  detail: string;
}

const violations: Violation[] = [];

// RULE 1 — imported lessons must carry `difficulty`.
for (const l of LESSONS) {
  const isImported = CURRICULUM_IMPORT_PATH_PREFIXES.some((p) => l.pathId.startsWith(p));
  if (isImported && l.difficulty == null) {
    violations.push({
      rule: 'R1',
      target: l.id,
      detail: `imported lesson (pathId=${l.pathId}) missing difficulty`,
    });
  }
}

// RULE 2 — imported quiz questions must carry `level`.
for (const q of QUIZZES) {
  for (const qq of q.questions) {
    if (qq.id.startsWith('q_') && qq.level == null) {
      violations.push({
        rule: 'R2',
        target: qq.id,
        detail: `imported question (quiz=${q.id}) missing level`,
      });
    }
  }
}

// RULE 3 — every quiz.lessonId points at a real lesson.
const lessonIds = new Set(LESSONS.map((l) => l.id));
for (const q of QUIZZES) {
  if (!lessonIds.has(q.lessonId)) {
    violations.push({
      rule: 'R3',
      target: q.id,
      detail: `quiz points at nonexistent lessonId=${q.lessonId}`,
    });
  }
}

// RULE 4 — every lesson.quizId points at a real quiz (when set).
const quizIds = new Set(QUIZZES.map((q) => q.id));
for (const l of LESSONS) {
  if (l.quizId && !quizIds.has(l.quizId)) {
    violations.push({
      rule: 'R4',
      target: l.id,
      detail: `lesson points at nonexistent quizId=${l.quizId}`,
    });
  }
}

// ─── RULE 5 — every condition is visually its own row (device-test-23) ──
//
//  The list was written by prediction FAMILY, so PCOS and PCOD shared 🌀, all
//  three thyroids shared ⚙️ and endo/adeno/fibroids shared 💗. That is how the
//  model groups them and exactly the wrong thing to show a person scanning for
//  the one line that is about them. Owner: "we need to have different logos,
//  not the same logos."

const seenEmoji = new Map<string, string>();
const seenLabel = new Map<string, string>();
for (const c of CONDITION_OPTIONS) {
  const clashEmoji = seenEmoji.get(c.emoji);
  if (clashEmoji) {
    violations.push({
      rule: 'R5',
      target: c.id,
      detail: `shares the icon ${c.emoji} with "${clashEmoji}" — every condition needs its own`,
    });
  }
  seenEmoji.set(c.emoji, c.label);

  const clashLabel = seenLabel.get(c.label.toLowerCase());
  if (clashLabel) {
    violations.push({ rule: 'R5', target: c.id, detail: `duplicate label "${c.label}"` });
  }
  seenLabel.set(c.label.toLowerCase(), c.id);

  // ─── R5b — every condition explains itself (device-test-29) ──────
  //
  //  Owner: "some users may not know what PCOD or hyperthyroid even is, so
  //  they could select something random and the prediction confidence goes
  //  off." A ticked ovulatory condition widens the model's prior for every
  //  forecast afterwards, so an unexplained row is an invitation to guess.
  //  Each one now opens into what it is, why we ask, and what it does to the
  //  maths — and none of the three may be missing or a stub.
  for (const [field, text] of [
    ['what', c.what],
    ['why', c.why],
    ['predictionEffect', c.predictionEffect],
  ] as const) {
    if (!text || text.trim().length < 30) {
      violations.push({
        rule: 'R5b',
        target: c.id,
        detail: `${field} is missing or too short to be a real explanation`,
      });
    }
  }

  // The explainer must not tell anyone what they have (rule 1). It describes
  // the condition; a clinician diagnoses the reader.
  if (/\byou (have|are likely|probably have)\b/i.test(`${c.what} ${c.why}`)) {
    violations.push({
      rule: 'R5b',
      target: c.id,
      detail: 'the explainer diagnoses the reader — describe the condition, never the person',
    });
  }

  // And it must not promise an effect the flag says does not exist.
  if (!c.affectsPrediction && /widen|lowers the confidence|changes the forecast/i.test(c.predictionEffect)) {
    violations.push({
      rule: 'R5b',
      target: c.id,
      detail: 'claims a prediction effect while affectsPrediction is false',
    });
  }
}

// ─── REPORT ─────────────────────────────────────────────────────────

const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;

console.log('');
console.log(bold('Dottie content validator'));
console.log(`  Lessons scanned : ${LESSONS.length}`);
console.log(`  Quizzes scanned : ${QUIZZES.length}`);
console.log(`  Questions       : ${QUIZZES.reduce((n, q) => n + q.questions.length, 0)}`);
console.log(`  Conditions      : ${CONDITION_OPTIONS.length} (each with its own icon)`);
console.log('');

if (violations.length === 0) {
  console.log('  \x1b[32m✓ All content valid.\x1b[0m');
  process.exit(0);
}

console.log(`  \x1b[31m✗ ${violations.length} violations:\x1b[0m`);
for (const v of violations) {
  console.log(`    [${v.rule}] ${v.target} — ${v.detail}`);
}
console.log('');
process.exit(1);
