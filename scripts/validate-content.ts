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

// ─── REPORT ─────────────────────────────────────────────────────────

const bold = (s: string) => `\x1b[1m${s}\x1b[22m`;

console.log('');
console.log(bold('Dottie content validator'));
console.log(`  Lessons scanned : ${LESSONS.length}`);
console.log(`  Quizzes scanned : ${QUIZZES.length}`);
console.log(`  Questions       : ${QUIZZES.reduce((n, q) => n + q.questions.length, 0)}`);
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
