import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { Shadows } from '../../src/constants/shadows';
import { PressableScale, PopOnChange } from '../../src/components/ui';
import {
  useUserStore,
  useGamificationStore,
  useContentStore,
  selectUserMode,
  selectCompanionType,
  selectXpTotal,
  selectGemsBalance,
} from '../../src/stores';
import {
  LEARNING_PATHS,
  getLessonsForPath,
  getPathsForMode,
} from '../../src/content/learning-paths';
import { contentRepository, LessonProgress } from '../../src/database/repositories/content.repo';
import { getCompanion } from '../../src/content/companions';
import { LearningPath, Lesson } from '../../src/types/content.types';

/**
 * Learn Tab — Bundled learning paths with real progress tracking.
 *
 * ─── HOW THIS WIRES UP ──────────────────────────────────────────────
 *
 *  Paths and lessons are STATIC content from `src/content/learning-paths.ts`
 *  (no server fetch — bundled with the app for offline-first).
 *
 *  Progress is LIVE from `lesson_progress` table:
 *    1. On mount, load all progress rows for this user via the repo
 *    2. For each path, count complete vs total → percentage
 *    3. Render with progress overlay
 *
 *  Tapping a path expands it inline to show its lessons with their
 *  individual progress + unlock state.
 *
 *  Tapping a lesson navigates to `/lesson/[id]` (see lesson screen file).
 *
 * ─── LOCKING ────────────────────────────────────────────────────────
 *
 *  Lessons within a path are sequential — lesson N is locked until
 *  lesson N-1 is complete. First lesson is always unlocked.
 *
 *  This is computed in `lessonsWithProgress` below using the lesson's
 *  `order` field and the loaded progress map.
 *
 * ─── PREMIUM POLISH PASS (Phase 2) ──────────────────────────────────
 *
 *  Presentation-only pass — zero logic, wiring, or copy changed:
 *
 *   - Entrance choreography: the header, stat row, section, and each
 *     path card fade + rise in a gentle stagger (Reanimated `FadeInDown`,
 *     UI thread) via the local `rise()` helper so the screen assembles
 *     with intent on every visit. `entering` runs on mount only, so it
 *     never refires on progress-map updates.
 *   - Every tappable surface (path headers, lesson rows) now uses the
 *     shared spring-press primitive (`PressableScale`) for buttery 60fps
 *     tap feedback. Both tap handlers already fire their own haptic, so
 *     `PressableScale` is passed `haptic="none"` to avoid a double buzz;
 *     the old pressed-state style callbacks are dropped in its favor.
 *   - The stat counters (lessons / XP / gems) "pop" (`PopOnChange`) when
 *     they change, so finishing a lesson feels immediately rewarding.
 *   - Real safe-area insets replace the fixed top padding on the scroll
 *     content so the header clears the notch on every device.
 *
 *  All motion honors "Reduce Motion" via the shared primitives.
 */

/** Entrance transition: fade + rise with a soft spring, delayed by `d` ms. */
function rise(d: number): ReturnType<typeof FadeInDown.duration> {
  return FadeInDown.duration(480).delay(d).springify().damping(16);
}
export default function LearnScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mode = useUserStore(selectUserMode);
  const companionType = useUserStore(selectCompanionType);
  const xpTotal = useGamificationStore(selectXpTotal);
  const gemsBalance = useGamificationStore(selectGemsBalance);
  const userId = useUserStore((s) => s.userId);
  const contentHydrated = useContentStore((s) => s.hydrated);

  const companion = getCompanion(companionType);

  // ─── Load progress ──────────────────────────────────────────────
  const [progressMap, setProgressMap] = useState<Map<string, LessonProgress>>(new Map());
  const [expandedPathId, setExpandedPathId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    contentRepository
      .getAllLessonProgress(userId)
      .then((rows) => {
        if (cancelled) return;
        const map = new Map<string, LessonProgress>();
        for (const r of rows) map.set(r.lessonId, r);
        setProgressMap(map);
      })
      .catch((err) => {
        if (__DEV__) console.warn('[Learn] getAllLessonProgress failed:', err);
      });
    return () => {
      cancelled = true;
    };
    // Reload when the content store finishes hydrating (covers cold start)
    // or when user changes (mode switch, etc.)
  }, [userId, contentHydrated]);

  // ─── Available paths for this mode ──────────────────────────────
  const availablePaths = useMemo(() => getPathsForMode(mode), [mode]);

  // ─── Path-level stats ───────────────────────────────────────────
  const pathStats = useMemo(() => {
    return new Map(
      availablePaths.map((p) => {
        const lessons = getLessonsForPath(p.id);
        const completed = lessons.filter(
          (l) => progressMap.get(l.id)?.status === 'complete'
        ).length;
        return [
          p.id,
          {
            total: lessons.length,
            completed,
            percent: lessons.length === 0 ? 0 : Math.round((completed / lessons.length) * 100),
          },
        ];
      })
    );
  }, [availablePaths, progressMap]);

  // ─── Handlers ───────────────────────────────────────────────────
  const togglePath = (pathId: string) => {
    Haptics.selectionAsync().catch(() => {});
    setExpandedPathId((prev) => (prev === pathId ? null : pathId));
  };

  const openLesson = (lessonId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push(`/lesson/${lessonId}`);
  };

  // ─── Total completion summary ───────────────────────────────────
  const totalLessons = availablePaths.reduce(
    (sum, p) => sum + (pathStats.get(p.id)?.total ?? 0),
    0
  );
  const completedLessons = availablePaths.reduce(
    (sum, p) => sum + (pathStats.get(p.id)?.completed ?? 0),
    0
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingTop: insets.top + Spacing.lg },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Animated.View entering={rise(0)} style={styles.header}>
        <Text style={styles.title}>Learn & Grow {companion.emoji}</Text>
        <Text style={styles.subtitle}>
          Tiny lessons, big understanding.{'\n'}
          Earn XP and gems as you learn.
        </Text>
      </Animated.View>

      {/* Stats Row */}
      <Animated.View entering={rise(70)} style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statEmoji}>📚</Text>
          <PopOnChange value={`${completedLessons}/${totalLessons}`}>
            <Text style={styles.statValue}>
              {completedLessons}/{totalLessons}
            </Text>
          </PopOnChange>
          <Text style={styles.statLabel}>Lessons</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statEmoji}>⭐</Text>
          <PopOnChange value={xpTotal}>
            <Text style={styles.statValue}>{xpTotal}</Text>
          </PopOnChange>
          <Text style={styles.statLabel}>XP</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statEmoji}>💎</Text>
          <PopOnChange value={gemsBalance}>
            <Text style={styles.statValue}>{gemsBalance}</Text>
          </PopOnChange>
          <Text style={styles.statLabel}>Gems</Text>
        </View>
      </Animated.View>

      {/* Paths */}
      <View style={styles.pathsSection}>
        <Animated.View entering={rise(140)}>
          <Text style={styles.sectionTitle}>Your Learning Paths</Text>
        </Animated.View>

        {availablePaths.length === 0 && (
          <Animated.View entering={rise(210)} style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={styles.emptyTitle}>More paths coming soon!</Text>
            <Text style={styles.emptyBody}>
              I'm cooking up more learning content for your mode. Check back soon!
            </Text>
          </Animated.View>
        )}

        {availablePaths.map((path, index) => (
          <Animated.View key={path.id} entering={rise(210 + Math.min(index, 8) * 80)}>
            <PathCard
              path={path}
              stats={pathStats.get(path.id) ?? { total: 0, completed: 0, percent: 0 }}
              expanded={expandedPathId === path.id}
              onToggle={() => togglePath(path.id)}
              lessons={getLessonsForPath(path.id)}
              progressMap={progressMap}
              onLessonTap={openLesson}
            />
          </Animated.View>
        ))}
      </View>

      <View style={{ height: Spacing.tabBarHeight }} />
    </ScrollView>
  );
}

// ─── SUBCOMPONENTS ───────────────────────────────────────────────────

function PathCard({
  path,
  stats,
  expanded,
  onToggle,
  lessons,
  progressMap,
  onLessonTap,
}: {
  path: LearningPath;
  stats: { total: number; completed: number; percent: number };
  expanded: boolean;
  onToggle: () => void;
  lessons: Lesson[];
  progressMap: Map<string, LessonProgress>;
  onLessonTap: (lessonId: string) => void;
}) {
  const accent = path.gradient[0];

  return (
    <View style={styles.pathCard}>
      <PressableScale
        style={styles.pathHeader}
        onPress={onToggle}
        haptic="none"
        scaleTo={0.99}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View style={[styles.pathEmojiBubble, { backgroundColor: `${accent}22` }]}>
          <Text style={styles.pathEmoji}>{path.emoji}</Text>
        </View>
        <View style={styles.pathInfo}>
          <View style={styles.pathTitleRow}>
            <Text style={styles.pathTitle}>{path.title}</Text>
            {path.tier === 'premium' && <Text style={styles.pathBadge}>💎+</Text>}
          </View>
          <Text style={styles.pathDescription}>{path.description}</Text>
          <View style={styles.pathProgressRow}>
            <View style={styles.pathProgressBarBg}>
              <View
                style={[
                  styles.pathProgressBarFill,
                  { width: `${Math.max(2, stats.percent)}%`, backgroundColor: accent },
                ]}
              />
            </View>
            <Text style={styles.pathProgressText}>
              {stats.completed}/{stats.total}
            </Text>
          </View>
        </View>
        <Text style={[styles.pathChevron, expanded && styles.pathChevronExpanded]}>›</Text>
      </PressableScale>

      {expanded && (
        <View style={styles.lessonList}>
          {lessons.map((lesson) => {
            const progress = progressMap.get(lesson.id);
            const isComplete = progress?.status === 'complete';
            const isInProgress = progress?.status === 'in_progress';
            const isLocked = isLessonLocked(lesson, lessons, progressMap);

            return (
              <PressableScale
                key={lesson.id}
                style={[styles.lessonRow, isLocked && styles.lessonRowLocked]}
                onPress={() => !isLocked && onLessonTap(lesson.id)}
                disabled={isLocked}
                haptic="none"
                scaleTo={0.98}
                accessibilityRole="button"
                accessibilityState={{ disabled: isLocked }}
              >
                <View
                  style={[
                    styles.lessonStatus,
                    {
                      backgroundColor: isComplete
                        ? Colors.semantic.success
                        : isInProgress
                          ? accent
                          : isLocked
                            ? Colors.surface.background
                            : `${accent}33`,
                    },
                  ]}
                >
                  <Text style={styles.lessonStatusEmoji}>
                    {isComplete ? '✓' : isLocked ? '🔒' : lesson.emoji}
                  </Text>
                </View>
                <View style={styles.lessonContent}>
                  <Text
                    style={[
                      styles.lessonTitle,
                      isLocked && { color: Colors.text.tertiary },
                    ]}
                  >
                    {lesson.title}
                  </Text>
                  <Text style={styles.lessonMeta}>
                    {lesson.estimatedMinutes} min · {lesson.xpReward} XP
                    {lesson.quizId ? ' · Quiz' : ''}
                  </Text>
                </View>
                {!isLocked && <Text style={styles.lessonChevron}>›</Text>}
              </PressableScale>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────

/**
 * A lesson is locked if ANY prior lesson (by `order`) is not yet complete.
 * The first lesson (order === 1) is always unlocked.
 */
function isLessonLocked(
  lesson: Lesson,
  allLessons: Lesson[],
  progressMap: Map<string, LessonProgress>
): boolean {
  if (lesson.order === 1) return false;
  const prior = allLessons.filter((l) => l.order < lesson.order);
  return prior.some((l) => progressMap.get(l.id)?.status !== 'complete');
}

// Touch path constant so it's not flagged as unused when this file is
// imported in dev — the canonical list lives in learning-paths.ts.
void LEARNING_PATHS;

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface.background,
  },
  contentContainer: {
    paddingHorizontal: Spacing.screenPadding,
    // paddingTop is applied inline from safe-area insets (see render).
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.preset.h2,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
    lineHeight: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sectionGap,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.surface.card,
    padding: Spacing.md,
    borderRadius: Spacing.radius.xl,
    alignItems: 'center',
    ...Shadows.sm,
  },
  statEmoji: {
    fontSize: 20,
    marginBottom: Spacing.xs,
  },
  statValue: {
    ...Typography.preset.number,
    fontSize: 18,
    color: Colors.text.primary,
  },
  statLabel: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
  },
  pathsSection: {
    gap: Spacing.base,
  },
  sectionTitle: {
    ...Typography.preset.h4,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  pathCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: Spacing.radius['2xl'],
    // No `overflow: 'hidden'` here: on iOS it would clip the warm drop
    // shadow. The card's own rounded background provides the corners, and
    // all children (header + expanded lesson list) sit inside padding, so
    // nothing needs clipping to the corner radius.
    ...Shadows.card,
  },
  pathHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.cardPadding,
  },
  pathEmojiBubble: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  pathEmoji: {
    fontSize: 28,
  },
  pathInfo: {
    flex: 1,
  },
  pathTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  pathTitle: {
    ...Typography.preset.h4,
    color: Colors.text.primary,
    flexShrink: 1,
  },
  pathBadge: {
    ...Typography.preset.captionBold,
    color: Colors.gamification.gems,
  },
  pathDescription: {
    ...Typography.preset.caption,
    color: Colors.text.secondary,
    marginVertical: Spacing.xs,
  },
  pathProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  pathProgressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.surface.background,
    borderRadius: 3,
    overflow: 'hidden',
  },
  pathProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  pathProgressText: {
    ...Typography.preset.captionBold,
    color: Colors.text.tertiary,
    minWidth: 40,
    textAlign: 'right',
  },
  pathChevron: {
    fontSize: 24,
    color: Colors.text.tertiary,
    marginLeft: Spacing.sm,
  },
  pathChevronExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  lessonList: {
    paddingHorizontal: Spacing.cardPadding,
    paddingBottom: Spacing.cardPadding,
    gap: Spacing.sm,
  },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.background,
    padding: Spacing.md,
    borderRadius: Spacing.radius.xl,
  },
  lessonRowLocked: {
    opacity: 0.55,
  },
  lessonStatus: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  lessonStatusEmoji: {
    fontSize: 18,
    color: Colors.text.inverse,
  },
  lessonContent: {
    flex: 1,
  },
  lessonTitle: {
    ...Typography.preset.bodySemibold,
    color: Colors.text.primary,
  },
  lessonMeta: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  lessonChevron: {
    fontSize: 24,
    color: Colors.text.tertiary,
  },
  emptyCard: {
    backgroundColor: Colors.surface.card,
    padding: Spacing.cardPaddingLarge,
    borderRadius: Spacing.radius['2xl'],
    alignItems: 'center',
    ...Shadows.sm,
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.preset.h4,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  emptyBody: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});