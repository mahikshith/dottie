/**
 * Learn Tab — MOOD AURORA PATH-MAP (design-v2)
 *
 * The Learn tab reimagined as a quest: each path is a glowing trail of lesson
 * nodes (done / current / locked), your companion stands on where you are, and
 * a "pace" chooser sets whether the trail is guided (sequential locks) or open
 * for self-directed learners.
 *
 * ─── WHAT CHANGED / WHAT'S PRESERVED ────────────────────────────────
 *
 *  Presentation is new (list of cards → winding trail). Everything underneath is
 *  the same: live progress from `lesson_progress`, mode-filtered paths, the
 *  sequential LOCK rule, XP/gem stats, and tap-to-open-lesson. The reader +
 *  practice + quiz flow beyond a node is unchanged.
 *
 *  The HYBRID PLACEMENT is a real behavioural switch, not a hollow selector:
 *   • New · Guided     → sequential locks stay on (one step at a time)
 *   • Knows basics /   → the trail UNLOCKS; jump to any lesson (self-directed)
 *     Deep dive
 *  Persisted in `Storage.learnLevel` (null defaults to guided — safest for a
 *  first-timer). Difficulty-tiered CONTENT is future work; this switches the
 *  navigation model over the existing lessons today.
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
import {
  PressableScale,
  PopOnChange,
  AuroraBackground,
  GlassCard,
  CompanionLottie,
} from '../../src/components/ui';
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
import { LearningPath, Lesson, CompanionType } from '../../src/types/content.types';
import { Storage, type LearnLevel } from '../../src/database/storage';

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

  // ─── Progress + pace ────────────────────────────────────────────
  const [progressMap, setProgressMap] = useState<Map<string, LessonProgress>>(new Map());
  const [level, setLevel] = useState<LearnLevel | null>(() => Storage.learnLevel.get());
  const guided = level !== 'basics' && level !== 'deep'; // null/'new' → guided

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
  }, [userId, contentHydrated]);

  const pickLevel = (next: LearnLevel) => {
    Haptics.selectionAsync().catch(() => {});
    Storage.learnLevel.set(next);
    setLevel(next);
  };

  // ─── Paths + stats ──────────────────────────────────────────────
  const availablePaths = useMemo(() => getPathsForMode(mode), [mode]);

  const pathStats = useMemo(() => {
    return new Map(
      availablePaths.map((p) => {
        const lessons = getLessonsForPath(p.id);
        const completed = lessons.filter((l) => progressMap.get(l.id)?.status === 'complete').length;
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

  const openLesson = (lessonId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push(`/lesson/${lessonId}`);
  };

  const totalLessons = availablePaths.reduce((sum, p) => sum + (pathStats.get(p.id)?.total ?? 0), 0);
  const completedLessons = availablePaths.reduce((sum, p) => sum + (pathStats.get(p.id)?.completed ?? 0), 0);

  return (
    <AuroraBackground>
      <StatusBar style="light" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + Spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={rise(0)} style={styles.header}>
          <Text style={[styles.title, { color: palette.ink }]}>Learn &amp; Grow {companion.emoji}</Text>
          <Text style={[styles.subtitle, { color: palette.ink2 }]}>
            A little quest for your body. Earn XP and gems as you go.
          </Text>
        </Animated.View>

        {/* Stats */}
        <Animated.View entering={rise(60)} style={styles.statsRow}>
          <GlassCard style={styles.statBox} padding={Spacing.md}>
            <Text style={styles.statEmoji}>📚</Text>
            <PopOnChange value={`${completedLessons}/${totalLessons}`}>
              <Text style={[styles.statValue, { color: palette.ink }]}>{completedLessons}/{totalLessons}</Text>
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

        {/* Pace chooser (hybrid placement) */}
        <Animated.View entering={rise(110)}>
          <PaceChooser level={level} guided={guided} onPick={pickLevel} />
        </Animated.View>

        {/* Path trails */}
        {availablePaths.length === 0 && (
          <Animated.View entering={rise(170)}>
            <GlassCard style={styles.emptyCard}>
              <Text style={styles.emptyEmoji}>🌱</Text>
              <Text style={[styles.emptyTitle, { color: palette.ink }]}>More paths coming soon!</Text>
              <Text style={[styles.emptyBody, { color: palette.ink2 }]}>
                I'm cooking up more learning content for your mode. Check back soon!
              </Text>
            </GlassCard>
          </Animated.View>
        )}

        {availablePaths.map((path, index) => (
          <Animated.View key={path.id} entering={rise(170 + Math.min(index, 6) * 90)}>
            <PathTrail
              path={path}
              lessons={getLessonsForPath(path.id)}
              stats={pathStats.get(path.id) ?? { total: 0, completed: 0, percent: 0 }}
              progressMap={progressMap}
              guided={guided}
              companionType={companionType}
              onLessonTap={openLesson}
            />
          </Animated.View>
        ))}

        <View style={{ height: Spacing.tabBarHeight + Spacing.xl }} />
      </ScrollView>
    </AuroraBackground>
  );
}

// ─── PACE CHOOSER ────────────────────────────────────────────────────

function PaceChooser({
  level,
  guided,
  onPick,
}: {
  level: LearnLevel | null;
  guided: boolean;
  onPick: (l: LearnLevel) => void;
}): JSX.Element {
  const { palette } = useAurora();
  const options: { key: LearnLevel; emoji: string; label: string }[] = [
    { key: 'new', emoji: '🌱', label: 'New here' },
    { key: 'basics', emoji: '🙂', label: 'Knows basics' },
    { key: 'deep', emoji: '🦉', label: 'Deep dive' },
  ];
  return (
    <View style={styles.pace}>
      <Text style={[styles.paceLabel, { color: palette.ink3 }]}>YOUR PACE</Text>
      <View style={styles.paceRow}>
        {options.map((o) => {
          const on = level === o.key;
          return (
            <PressableScale
              key={o.key}
              onPress={() => onPick(o.key)}
              haptic="none"
              scaleTo={0.96}
              style={[
                styles.paceChip,
                { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
                on && { backgroundColor: palette.accent, borderColor: palette.accent },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={o.label}
            >
              <Text style={styles.paceEmoji}>{o.emoji}</Text>
              <Text style={[styles.paceChipText, { color: on ? palette.ground : palette.ink2 }]} numberOfLines={1}>
                {o.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>
      <Text style={[styles.paceHint, { color: palette.ink3 }]}>
        {guided
          ? 'Guided — one step at a time. We\'ll unlock as you go.'
          : 'Explore — jump to any lesson you like. Nothing\'s locked.'}
      </Text>
    </View>
  );
}

// ─── PATH TRAIL ──────────────────────────────────────────────────────

function PathTrail({
  path,
  lessons,
  stats,
  progressMap,
  guided,
  companionType,
  onLessonTap,
}: {
  path: LearningPath;
  lessons: Lesson[];
  stats: { total: number; completed: number; percent: number };
  progressMap: Map<string, LessonProgress>;
  guided: boolean;
  companionType: CompanionType;
  onLessonTap: (lessonId: string) => void;
}): JSX.Element {
  const { palette } = useAurora();
  const accent = path.gradient[0];

  // First incomplete lesson = where the companion stands ("current").
  const currentId = useMemo(
    () => lessons.find((l) => progressMap.get(l.id)?.status !== 'complete')?.id ?? null,
    [lessons, progressMap]
  );
  const allComplete = stats.total > 0 && stats.completed === stats.total;

  return (
    <View style={styles.trailWrap}>
      {/* Path header */}
      <GlassCard style={styles.pathHeader} padding={Spacing.cardPadding}>
        <View style={[styles.pathEmojiBubble, { backgroundColor: `${accent}22` }]}>
          <Text style={styles.pathEmoji}>{path.emoji}</Text>
        </View>
        <View style={styles.pathInfo}>
          <View style={styles.pathTitleRow}>
            <Text style={[styles.pathTitle, { color: palette.ink }]}>{path.title}</Text>
            {path.tier === 'premium' && <Text style={styles.pathBadge}>💎+</Text>}
          </View>
          <View style={styles.pathProgressRow}>
            <View style={[styles.pathProgressBarBg, { backgroundColor: palette.glass.edge }]}>
              <View style={[styles.pathProgressBarFill, { width: `${Math.max(2, stats.percent)}%`, backgroundColor: accent }]} />
            </View>
            <Text style={[styles.pathProgressText, { color: palette.ink3 }]}>
              {stats.completed}/{stats.total}
            </Text>
          </View>
        </View>
      </GlassCard>

      {/* The trail */}
      <View style={styles.trail}>
        {/* connector line down the centre, behind the nodes */}
        <View style={[styles.connector, { backgroundColor: palette.glass.edge }]} />

        {lessons.map((lesson, i) => {
          const status = progressMap.get(lesson.id)?.status;
          const isComplete = status === 'complete';
          const isCurrent = lesson.id === currentId;
          const locked = guided && isLessonLocked(lesson, lessons, progressMap);
          const labelLeft = i % 2 === 0;

          return (
            <View key={lesson.id} style={styles.nodeRow}>
              {/* left label slot */}
              <View style={styles.labelSlot}>
                {labelLeft && (
                  <NodeLabel lesson={lesson} align="right" locked={locked} isCurrent={isCurrent} />
                )}
              </View>

              {/* node */}
              <View style={styles.nodeCol}>
                {isCurrent && !locked && (
                  <View style={styles.companionPerch} pointerEvents="none">
                    <CompanionLottie type={companionType} state="idle" size={46} />
                  </View>
                )}
                <PressableScale
                  onPress={() => !locked && onLessonTap(lesson.id)}
                  disabled={locked}
                  haptic={locked ? 'none' : 'light'}
                  scaleTo={0.9}
                  style={[
                    styles.node,
                    { borderColor: palette.glass.edge, backgroundColor: palette.glass.bg },
                    isComplete && { backgroundColor: `${AURORA_SUCCESS}22`, borderColor: AURORA_SUCCESS },
                    isCurrent && !locked && { borderColor: accent, backgroundColor: `${accent}22`, shadowColor: accent, shadowOpacity: 0.6, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
                    locked && { opacity: 0.55 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${lesson.title}${locked ? ' (locked)' : isComplete ? ' (complete)' : ''}`}
                  accessibilityState={{ disabled: locked }}
                >
                  <Text style={styles.nodeGlyph}>
                    {isComplete ? '✓' : locked ? '🔒' : lesson.emoji}
                  </Text>
                </PressableScale>
              </View>

              {/* right label slot */}
              <View style={styles.labelSlot}>
                {!labelLeft && (
                  <NodeLabel lesson={lesson} align="left" locked={locked} isCurrent={isCurrent} />
                )}
              </View>
            </View>
          );
        })}

        {/* Reward node */}
        <View style={styles.nodeRow}>
          <View style={styles.labelSlot} />
          <View style={styles.nodeCol}>
            <View
              style={[
                styles.node,
                styles.rewardNode,
                { borderColor: allComplete ? palette.accent : palette.glass.edge, backgroundColor: allComplete ? `${palette.accent}22` : palette.glass.bg },
                !allComplete && { opacity: 0.6 },
              ]}
            >
              <Text style={styles.nodeGlyph}>{allComplete ? '🏆' : '🎁'}</Text>
            </View>
          </View>
          <View style={styles.labelSlot}>
            <View style={styles.labelCardLeft}>
              <Text style={[styles.nodeTitle, { color: palette.ink }]} numberOfLines={2}>
                {allComplete ? `${path.title} complete!` : 'Path reward'}
              </Text>
              <Text style={[styles.nodeMeta, { color: palette.ink3 }]}>
                +{path.completionXP} XP · +{path.completionGems}💎
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function NodeLabel({
  lesson,
  align,
  locked,
  isCurrent,
}: {
  lesson: Lesson;
  align: 'left' | 'right';
  locked: boolean;
  isCurrent: boolean;
}): JSX.Element {
  const { palette } = useAurora();
  return (
    <View style={align === 'left' ? styles.labelCardLeft : styles.labelCardRight}>
      {isCurrent && !locked && (
        <Text style={[styles.currentTag, { color: palette.accent, textAlign: align === 'left' ? 'left' : 'right' }]}>
          YOU'RE HERE
        </Text>
      )}
      <Text
        style={[styles.nodeTitle, { color: locked ? palette.ink3 : palette.ink, textAlign: align === 'left' ? 'left' : 'right' }]}
        numberOfLines={2}
      >
        {lesson.title}
      </Text>
      <Text style={[styles.nodeMeta, { color: palette.ink3, textAlign: align === 'left' ? 'left' : 'right' }]}>
        {lesson.estimatedMinutes} min · {lesson.xpReward} XP{lesson.quizId ? ' · Quiz' : ''}
      </Text>
    </View>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────

/** A lesson is locked if ANY prior lesson (by `order`) is not yet complete. */
function isLessonLocked(
  lesson: Lesson,
  allLessons: Lesson[],
  progressMap: Map<string, LessonProgress>
): boolean {
  if (lesson.order === 1) return false;
  const prior = allLessons.filter((l) => l.order < lesson.order);
  return prior.some((l) => progressMap.get(l.id)?.status !== 'complete');
}

// Touch path constant so it's not flagged unused (canonical list in learning-paths.ts).
void LEARNING_PATHS;

// ─── STYLES (layout only — colours inline, palette-driven) ───────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { paddingHorizontal: Spacing.screenPadding },
  header: { marginBottom: Spacing.lg },
  title: { ...Typography.preset.h2, marginBottom: Spacing.sm },
  subtitle: { ...Typography.preset.body, lineHeight: 24 },

  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.base },
  statBox: { flex: 1, alignItems: 'center' },
  statEmoji: { fontSize: 20, marginBottom: Spacing.xs },
  statValue: { ...Typography.preset.number, fontSize: 18 },
  statLabel: { ...Typography.preset.caption },

  pace: { marginBottom: Spacing.sectionGap },
  paceLabel: { ...Typography.preset.overline, letterSpacing: 1, marginBottom: Spacing.sm },
  paceRow: { flexDirection: 'row', gap: Spacing.sm },
  paceChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderRadius: Spacing.radius.full,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  paceEmoji: { fontSize: 14 },
  paceChipText: { ...Typography.preset.caption, fontWeight: '800', fontSize: 12 },
  paceHint: { ...Typography.preset.caption, marginTop: Spacing.sm, fontStyle: 'italic' },

  emptyCard: { alignItems: 'center', marginBottom: Spacing.base },
  emptyEmoji: { fontSize: 36, marginBottom: Spacing.sm },
  emptyTitle: { ...Typography.preset.h4, marginBottom: Spacing.xs },
  emptyBody: { ...Typography.preset.body, textAlign: 'center' },

  trailWrap: { marginBottom: Spacing.sectionGap },
  pathHeader: { flexDirection: 'row', alignItems: 'center' },
  pathEmojiBubble: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  pathEmoji: { fontSize: 26 },
  pathInfo: { flex: 1 },
  pathTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  pathTitle: { ...Typography.preset.h4, flexShrink: 1 },
  pathBadge: { ...Typography.preset.captionBold, color: '#FFC24D' },
  pathProgressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm },
  pathProgressBarBg: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  pathProgressBarFill: { height: '100%', borderRadius: 3 },
  pathProgressText: { ...Typography.preset.captionBold, minWidth: 40, textAlign: 'right' },

  trail: { position: 'relative', marginTop: Spacing.md },
  connector: { position: 'absolute', left: '50%', width: 3, marginLeft: -1.5, top: 44, bottom: 44, borderRadius: 2 },
  nodeRow: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.sm },
  labelSlot: { flex: 1, justifyContent: 'center' },
  nodeCol: { width: 76, alignItems: 'center', justifyContent: 'center' },
  companionPerch: { position: 'absolute', top: -34, zIndex: 3 },
  node: {
    width: 64,
    height: 64,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardNode: { width: 66, height: 66, borderRadius: 24 },
  nodeGlyph: { fontSize: 28 },
  labelCardLeft: { alignItems: 'flex-start', paddingLeft: Spacing.sm },
  labelCardRight: { alignItems: 'flex-end', paddingRight: Spacing.sm },
  currentTag: { ...Typography.preset.overline, fontSize: 9, letterSpacing: 1, marginBottom: 2 },
  nodeTitle: { ...Typography.preset.bodySemibold, fontSize: 14 },
  nodeMeta: { ...Typography.preset.caption, fontSize: 11, marginTop: 2 },
});
