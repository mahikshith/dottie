/**
 * Learn Tab — MOOD AURORA THEME (design-v2)
 *
 * Bundled learning paths with real progress tracking, re-skinned onto the
 * aurora world: luminous dark ground, glass stat boxes / path cards / lesson
 * rows, and each path keeping its own brand accent (path.gradient[0]) for
 * identity while the surrounding surfaces re-tint with the mood palette.
 *
 * ─── WHAT CHANGED IN THIS PASS ──────────────────────────────────────
 *
 *  Presentation only. Progress loading, path/mode filtering, sequential
 *  lesson LOCKING, navigation, every store read, and all copy are unchanged.
 *  Colours moved to the palette (inline); the StyleSheet is layout only:
 *   - Screen wrapped in <AuroraBackground>; StatusBar flipped to light.
 *   - Stat boxes, path cards, lesson rows, and the empty state are glass.
 *   - Path accent still comes from path.gradient[0] (brand identity per path);
 *     progress bar + emoji bubble use it. Text is palette ink.
 *   - Lesson status bubble: complete = soft aurora green, in-progress = accent,
 *     locked = faint glass, not-started = accent tint. Glyph ink = ground.
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device).
 */

import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { PressableScale, PopOnChange, AuroraBackground, GlassCard } from '../../src/components/ui';
import { useAurora } from '../../src/theme';
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

// Soft aurora green for a completed lesson (reads as "done" on the dark ground
// without importing the light-theme semantic palette).
const AURORA_SUCCESS = '#6FE6A8';

/** Entrance transition: fade + rise with a soft spring, delayed by `d` ms. */
function rise(d: number): ReturnType<typeof FadeInDown.duration> {
  return FadeInDown.duration(480).delay(d).springify().damping(16);
}
export default function LearnScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useAurora();
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
    <AuroraBackground>
      <StatusBar style="light" />
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
          <Text style={[styles.title, { color: palette.ink }]}>
            Learn & Grow {companion.emoji}
          </Text>
          <Text style={[styles.subtitle, { color: palette.ink2 }]}>
            Tiny lessons, big understanding.{'\n'}
            Earn XP and gems as you learn.
          </Text>
        </Animated.View>

        {/* Stats Row */}
        <Animated.View entering={rise(70)} style={styles.statsRow}>
          <GlassCard style={styles.statBox} padding={Spacing.md}>
            <Text style={styles.statEmoji}>📚</Text>
            <PopOnChange value={`${completedLessons}/${totalLessons}`}>
              <Text style={[styles.statValue, { color: palette.ink }]}>
                {completedLessons}/{totalLessons}
              </Text>
            </PopOnChange>
            <Text style={[styles.statLabel, { color: palette.ink3 }]}>Lessons</Text>
          </GlassCard>
          <GlassCard style={styles.statBox} padding={Spacing.md}>
            <Text style={styles.statEmoji}>⭐</Text>
            <PopOnChange value={xpTotal}>
              <Text style={[styles.statValue, { color: palette.ink }]}>{xpTotal}</Text>
            </PopOnChange>
            <Text style={[styles.statLabel, { color: palette.ink3 }]}>XP</Text>
          </GlassCard>
          <GlassCard style={styles.statBox} padding={Spacing.md}>
            <Text style={styles.statEmoji}>💎</Text>
            <PopOnChange value={gemsBalance}>
              <Text style={[styles.statValue, { color: palette.ink }]}>{gemsBalance}</Text>
            </PopOnChange>
            <Text style={[styles.statLabel, { color: palette.ink3 }]}>Gems</Text>
          </GlassCard>
        </Animated.View>

        {/* Paths */}
        <View style={styles.pathsSection}>
          <Animated.View entering={rise(140)}>
            <Text style={[styles.sectionTitle, { color: palette.ink }]}>
              Your Learning Paths
            </Text>
          </Animated.View>

          {availablePaths.length === 0 && (
            <Animated.View entering={rise(210)}>
              <GlassCard style={styles.emptyCard}>
                <Text style={styles.emptyEmoji}>🌱</Text>
                <Text style={[styles.emptyTitle, { color: palette.ink }]}>
                  More paths coming soon!
                </Text>
                <Text style={[styles.emptyBody, { color: palette.ink2 }]}>
                  I'm cooking up more learning content for your mode. Check back soon!
                </Text>
              </GlassCard>
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
    </AuroraBackground>
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
  const { palette } = useAurora();
  const accent = path.gradient[0];

  return (
    <GlassCard style={styles.pathCard} padding={0}>
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
            <Text style={[styles.pathTitle, { color: palette.ink }]}>{path.title}</Text>
            {path.tier === 'premium' && <Text style={styles.pathBadge}>💎+</Text>}
          </View>
          <Text style={[styles.pathDescription, { color: palette.ink2 }]}>
            {path.description}
          </Text>
          <View style={styles.pathProgressRow}>
            <View style={[styles.pathProgressBarBg, { backgroundColor: palette.glass.edge }]}>
              <View
                style={[
                  styles.pathProgressBarFill,
                  { width: `${Math.max(2, stats.percent)}%`, backgroundColor: accent },
                ]}
              />
            </View>
            <Text style={[styles.pathProgressText, { color: palette.ink3 }]}>
              {stats.completed}/{stats.total}
            </Text>
          </View>
        </View>
        <Text
          style={[
            styles.pathChevron,
            { color: palette.ink3 },
            expanded && styles.pathChevronExpanded,
          ]}
        >
          ›
        </Text>
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
                style={[
                  styles.lessonRow,
                  { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
                  isLocked && styles.lessonRowLocked,
                ]}
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
                        ? AURORA_SUCCESS
                        : isInProgress
                          ? accent
                          : isLocked
                            ? palette.glass.bg
                            : `${accent}33`,
                    },
                  ]}
                >
                  <Text style={[styles.lessonStatusEmoji, { color: palette.ground }]}>
                    {isComplete ? '✓' : isLocked ? '🔒' : lesson.emoji}
                  </Text>
                </View>
                <View style={styles.lessonContent}>
                  <Text
                    style={[
                      styles.lessonTitle,
                      { color: isLocked ? palette.ink3 : palette.ink },
                    ]}
                  >
                    {lesson.title}
                  </Text>
                  <Text style={[styles.lessonMeta, { color: palette.ink3 }]}>
                    {lesson.estimatedMinutes} min · {lesson.xpReward} XP
                    {lesson.quizId ? ' · Quiz' : ''}
                  </Text>
                </View>
                {!isLocked && (
                  <Text style={[styles.lessonChevron, { color: palette.ink3 }]}>›</Text>
                )}
              </PressableScale>
            );
          })}
        </View>
      )}
    </GlassCard>
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

// ─── STYLES (layout only — colours are inline, palette-driven) ───────

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.preset.body,
    lineHeight: 24,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sectionGap,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statEmoji: {
    fontSize: 20,
    marginBottom: Spacing.xs,
  },
  statValue: {
    ...Typography.preset.number,
    fontSize: 18,
  },
  statLabel: {
    ...Typography.preset.caption,
  },
  pathsSection: {
    gap: Spacing.base,
  },
  sectionTitle: {
    ...Typography.preset.h4,
    marginBottom: Spacing.sm,
  },
  pathCard: {
    // Glass surface; padding handled per-section (header + lesson list).
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
    flexShrink: 1,
  },
  pathBadge: {
    ...Typography.preset.captionBold,
    color: '#FFC24D',
  },
  pathDescription: {
    ...Typography.preset.caption,
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
    borderRadius: 3,
    overflow: 'hidden',
  },
  pathProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  pathProgressText: {
    ...Typography.preset.captionBold,
    minWidth: 40,
    textAlign: 'right',
  },
  pathChevron: {
    fontSize: 24,
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
    borderWidth: 1,
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
  },
  lessonContent: {
    flex: 1,
  },
  lessonTitle: {
    ...Typography.preset.bodySemibold,
  },
  lessonMeta: {
    ...Typography.preset.caption,
    marginTop: 2,
  },
  lessonChevron: {
    fontSize: 24,
  },
  emptyCard: {
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    ...Typography.preset.h4,
    marginBottom: Spacing.xs,
  },
  emptyBody: {
    ...Typography.preset.body,
    textAlign: 'center',
  },
});
