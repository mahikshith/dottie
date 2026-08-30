/**
 * Dottie — Content Bundle (OTA updatable content · design-v2)
 *
 * A ContentBundle is a versioned, self-contained package of learning content
 * (paths, lessons, quizzes, exercises) that can be downloaded from the network
 * AFTER launch and merged on top of the app's bundled baseline — so new lessons
 * ship without an app-store update, and the app stays fully usable offline.
 *
 * ─── HARD RULES ─────────────────────────────────────────────────────
 *
 *  • Offline-first: bundled content is ALWAYS the baseline; a bundle is additive.
 *  • Validated before it's ever applied — a malformed download is rejected, never
 *    shown (reuses the same validators the bundled content passes).
 *  • Privacy: a bundle is generic cohort content — it must NEVER be personalized
 *    per user, so fetching one sends NO cycle/health data (see content-updater).
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device). Pure types + validation.
 */

import { LearningPath, Lesson, Quiz, Exercise } from '../../types/content.types';
// Import validators from their specific engine modules (not the barrel) to keep
// this file out of the content-engine ↔ bundled-content import cycle.
import { validateLearningPath } from '../../engine/content/lesson-engine';
import { validateQuiz } from '../../engine/content/quiz-engine';
import { validateExercise } from '../../engine/content/exercise-engine';

/** A downloadable, versioned package of learning content. */
export interface ContentBundle {
  /** Monotonic version — higher is newer. Applied only when > the cached one. */
  version: number;
  /** ISO timestamp the bundle was published. */
  updatedAt: string;
  paths: LearningPath[];
  lessons: Lesson[];
  quizzes: Quiz[];
  exercises: Exercise[];
  /**
   * Optional minimum app version (semver) required to apply this bundle — lets
   * the server ship content that needs a newer client without breaking old ones.
   */
  minAppVersion?: string;
}

export interface BundleValidation {
  ok: boolean;
  errors: string[];
  counts: { paths: number; lessons: number; quizzes: number; exercises: number };
}

/**
 * Validate a downloaded bundle before applying it. Conservative on purpose: any
 * malformed item fails the whole bundle so we never render half-broken content.
 */
export function validateContentBundle(bundle: unknown): BundleValidation {
  const errors: string[] = [];
  const counts = { paths: 0, lessons: 0, quizzes: 0, exercises: 0 };

  if (!bundle || typeof bundle !== 'object') {
    return { ok: false, errors: ['Bundle is not an object'], counts };
  }
  const b = bundle as Partial<ContentBundle>;

  if (typeof b.version !== 'number' || !Number.isFinite(b.version) || b.version <= 0) {
    errors.push('Bundle missing a positive numeric `version`');
  }
  if (!Array.isArray(b.paths) || !Array.isArray(b.lessons) || !Array.isArray(b.quizzes) || !Array.isArray(b.exercises)) {
    errors.push('Bundle must have array fields: paths, lessons, quizzes, exercises');
    return { ok: false, errors, counts };
  }

  counts.paths = b.paths.length;
  counts.lessons = b.lessons.length;
  counts.quizzes = b.quizzes.length;
  counts.exercises = b.exercises.length;

  for (const p of b.paths) {
    const r = validateLearningPath(p as LearningPath, b.lessons as Lesson[]);
    if (!r.ok) errors.push(...r.errors);
  }
  for (const l of b.lessons as Lesson[]) {
    if (!l.id) errors.push('Lesson missing id');
    if (!l.pathId) errors.push(`Lesson ${l.id || '(no id)'} missing pathId`);
    if (!l.title) errors.push(`Lesson ${l.id} missing title`);
    if (!Array.isArray(l.sections) || l.sections.length === 0) errors.push(`Lesson ${l.id} has no sections`);
    if (typeof l.order !== 'number') errors.push(`Lesson ${l.id} missing numeric order`);
  }
  for (const q of b.quizzes) {
    const r = validateQuiz(q as Quiz);
    if (!r.ok) errors.push(...r.errors);
  }
  for (const ex of b.exercises) {
    const r = validateExercise(ex as Exercise);
    if (!r.ok) errors.push(...r.errors);
  }

  // Referential sanity: every lesson's path should exist somewhere (bundle OR
  // the app's baseline — we can't see the baseline here, so only warn within-bundle
  // when a path is referenced but the bundle also ships zero baseline overlap).
  // Kept lenient on purpose: a bundle may add lessons to an existing bundled path.

  return { ok: errors.length === 0, errors, counts };
}
