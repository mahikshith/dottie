/**
 * Dottie — Merged Content Providers (OTA · design-v2)
 *
 * Wrap the bundled Lesson/Quiz providers so that any cached OTA content is
 * preferred, falling back to the bundled baseline. With no cached bundle these
 * behave IDENTICALLY to the bundled providers — so wiring them in is a no-op
 * until real content is downloaded (safe to ship now).
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device).
 */

import type { LearningPath, Lesson, Quiz } from '../../types/content.types';
import type { UserMode } from '../../types/cycle.types';
import type { LessonProvider, QuizProvider } from '../../engine/content';
import { remoteContentStore } from './remote-content-store';

/** Cached-first merge by `id` — cached items override bundled ones. */
function mergeById<T extends { id: string }>(bundled: T[], cached: T[]): T[] {
  if (cached.length === 0) return bundled;
  const byId = new Map<string, T>();
  for (const item of bundled) byId.set(item.id, item);
  for (const item of cached) byId.set(item.id, item); // cached wins
  return Array.from(byId.values());
}

export function buildMergedLessonProvider(bundled: LessonProvider): LessonProvider {
  const paths = (): LearningPath[] => mergeById(bundled.getAllPaths(), remoteContentStore.get()?.paths ?? []);

  return {
    getAllPaths: paths,
    getPathsForMode: (mode: UserMode) => paths().filter((p) => p.mode === mode || p.mode === 'all'),
    getPath: (pathId: string) =>
      remoteContentStore.get()?.paths.find((p) => p.id === pathId) ?? bundled.getPath(pathId),
    getLessonsForPath: (pathId: string) => {
      const cached = (remoteContentStore.get()?.lessons ?? []).filter((l) => l.pathId === pathId);
      return mergeById<Lesson>(bundled.getLessonsForPath(pathId), cached).sort((a, b) => a.order - b.order);
    },
    getLesson: (lessonId: string) =>
      remoteContentStore.get()?.lessons.find((l) => l.id === lessonId) ?? bundled.getLesson(lessonId),
  };
}

export function buildMergedQuizProvider(bundled: QuizProvider): QuizProvider {
  return {
    getAllQuizzes: () => mergeById<Quiz>(bundled.getAllQuizzes(), remoteContentStore.get()?.quizzes ?? []),
    getQuiz: (quizId: string) =>
      remoteContentStore.get()?.quizzes.find((q) => q.id === quizId) ?? bundled.getQuiz(quizId),
    getQuizForLesson: (lessonId: string) =>
      remoteContentStore.get()?.quizzes.find((q) => q.lessonId === lessonId) ?? bundled.getQuizForLesson(lessonId),
  };
}
