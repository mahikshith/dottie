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
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
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
  selectStreak,
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
  const streak = useGamificationStore(selectStreak);
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
        {/* Header — title left, minimal streak/gems (no words) top-right */}
        <Animated.View entering={rise(0)} style={styles.header}>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: palette.ink }]}>Learn &amp; Grow {companion.emoji}</Text>
            <Text style={[styles.subtitle, { color: palette.ink2 }]}>
              A little quest for your body. Earn XP and gems as you go.
            </Text>
          </View>
          <View style={styles.topStats}>
            <View style={[styles.topStat, { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge }]}>
              <Text style={styles.topStatEmoji}>🔥</Text>
              <PopOnChange value={streak.currentStreak}>
                <Text style={[styles.topStatValue, { color: palette.ink }]}>{streak.currentStreak}</Text>
              </PopOnChange>
            </View>
            <View style={[styles.topStat, { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge }]}>
              <Text style={styles.topStatEmoji}>💎</Text>
              <PopOnChange value={gemsBalance}>
                <Text style={[styles.topStatValue, { color: palette.ink }]}>{gemsBalance}</Text>
              </PopOnChange>
            </View>
          </View>
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

// Trail geometry (px).
const NODE = 62;
const ROW_H = 104;
const TOP = 48;
const BOTTOM = 64;

interface TrailNode {
  key: string;
  kind: 'lesson' | 'reward';
  lesson: Lesson | null;
  glyph: string;
  title: string;
  meta: string;
  state: 'done' | 'current' | 'locked' | 'available' | 'reward-on' | 'reward-off';
}

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
  const [width, setWidth] = useState(0);

  const currentId = useMemo(
    () => lessons.find((l) => progressMap.get(l.id)?.status !== 'complete')?.id ?? null,
    [lessons, progressMap]
  );
  const allComplete = stats.total > 0 && stats.completed === stats.total;

  // Build the ordered node model (lessons + a final reward node).
  const nodes: TrailNode[] = lessons.map((lesson) => {
    const isComplete = progressMap.get(lesson.id)?.status === 'complete';
    const isCurrent = lesson.id === currentId;
    const locked = guided && isLessonLocked(lesson, lessons, progressMap);
    const state: TrailNode['state'] = isComplete
      ? 'done'
      : locked
        ? 'locked'
        : isCurrent
          ? 'current'
          : 'available';
    return {
      key: lesson.id,
      kind: 'lesson',
      lesson,
      glyph: isComplete ? '✓' : locked ? '🔒' : lesson.emoji,
      title: lesson.title,
      meta: `${lesson.estimatedMinutes} min · ${lesson.xpReward} XP${lesson.quizId ? ' · Quiz' : ''}`,
      state,
    };
  });
  nodes.push({
    key: `${path.id}_reward`,
    kind: 'reward',
    lesson: null,
    glyph: allComplete ? '🏆' : '🎁',
    title: allComplete ? `${path.title} complete!` : 'Path reward',
    meta: `+${path.completionXP} XP · +${path.completionGems}💎`,
    state: allComplete ? 'reward-on' : 'reward-off',
  });

  // The "you are here" index = current lesson (or the reward when all done).
  const currentIndex = allComplete
    ? nodes.length - 1
    : Math.max(0, nodes.findIndex((n) => n.state === 'current'));

  // Geometry: gentle meander so the path reads as a journey, not a list.
  const amp = width > 0 ? Math.min(72, Math.max(28, width * 0.2)) : 0;
  const cx = width / 2;
  const points = nodes.map((_, i) => ({
    x: cx + amp * Math.sin(i * 0.9),
    y: TOP + i * ROW_H + NODE / 2,
  }));
  const height = TOP + (nodes.length - 1) * ROW_H + NODE + BOTTOM;

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

      {/* The trail — measured, then drawn as a glowing aurora stream */}
      <View style={{ height: width > 0 ? height : ROW_H }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <>
            {/* aurora stream behind the nodes */}
            <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Defs>
                <SvgLinearGradient id={`stream_${path.id}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={palette.accent} />
                  <Stop offset="1" stopColor={palette.accent2} />
                </SvgLinearGradient>
              </Defs>
              {/* dim base ribbon (the whole journey) */}
              <Path d={buildTrailPath(points)} stroke={palette.glass.edge} strokeWidth={6} fill="none" strokeLinecap="round" />
              {/* lit portion up to where you are — a soft glow + a bright core */}
              {currentIndex > 0 && (
                <>
                  <Path d={buildTrailPath(points.slice(0, currentIndex + 1))} stroke={palette.accent} strokeOpacity={0.22} strokeWidth={16} fill="none" strokeLinecap="round" />
                  <Path d={buildTrailPath(points.slice(0, currentIndex + 1))} stroke={`url(#stream_${path.id})`} strokeWidth={6} fill="none" strokeLinecap="round" />
                </>
              )}
            </Svg>

            {/* nodes + titles on top */}
            {nodes.map((n, i) => {
              const p = points[i]!;
              const locked = n.state === 'locked';
              const isCurrent = n.state === 'current';
              const tappable = n.kind === 'lesson' && !locked;
              return (
                <View key={n.key}>
                  {isCurrent && (
                    <View style={[styles.companionPerch, { left: p.x - 24, top: p.y - NODE / 2 - 40 }]} pointerEvents="none">
                      <CompanionLottie type={companionType} state="idle" size={48} />
                    </View>
                  )}
                  <PressableScale
                    onPress={() => tappable && n.lesson && onLessonTap(n.lesson.id)}
                    disabled={!tappable}
                    haptic={tappable ? 'light' : 'none'}
                    scaleTo={0.9}
                    style={[
                      styles.node,
                      { left: p.x - NODE / 2, top: p.y - NODE / 2, borderColor: palette.glass.edge, backgroundColor: palette.glass.bg },
                      n.state === 'done' && { backgroundColor: `${AURORA_SUCCESS}22`, borderColor: AURORA_SUCCESS },
                      (isCurrent || n.state === 'reward-on') && {
                        borderColor: accent,
                        backgroundColor: `${accent}22`,
                        shadowColor: accent,
                        shadowOpacity: 0.6,
                        shadowRadius: 16,
                        shadowOffset: { width: 0, height: 0 },
                        elevation: 8,
                      },
                      (locked || n.state === 'reward-off') && { opacity: 0.5 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${n.title}${locked ? ' (locked)' : n.state === 'done' ? ' (complete)' : ''}`}
                    accessibilityState={{ disabled: !tappable }}
                  >
                    <Text style={styles.nodeGlyph}>{n.glyph}</Text>
                  </PressableScale>

                  {/* centered title under the node */}
                  <View style={[styles.nodeLabel, { left: p.x - 62, top: p.y + NODE / 2 + 6 }]} pointerEvents="none">
                    {isCurrent && <Text style={[styles.currentTag, { color: accent }]}>YOU'RE HERE</Text>}
                    <Text style={[styles.nodeTitle, { color: locked || n.state === 'reward-off' ? palette.ink3 : palette.ink }]} numberOfLines={2}>
                      {n.title}
                    </Text>
                    <Text style={[styles.nodeMeta, { color: palette.ink3 }]} numberOfLines={1}>
                      {n.meta}
                    </Text>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </View>
    </View>
  );
}

/** Smooth vertical S-curve through the node centres (control points at the mid-Y). */
function buildTrailPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  const first = pts[0]!;
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < pts.length; i++) {
    const p0 = pts[i - 1]!;
    const p1 = pts[i]!;
    const my = (p0.y + p1.y) / 2;
    d += ` C ${p0.x} ${my}, ${p1.x} ${my}, ${p1.x} ${p1.y}`;
  }
  return d;
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
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.md, marginBottom: Spacing.lg },
  headerText: { flex: 1 },
  topStats: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.xs },
  topStat: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: Spacing.radius.full, paddingHorizontal: Spacing.sm, paddingVertical: 5 },
  topStatEmoji: { fontSize: 14 },
  topStatValue: { ...Typography.preset.captionBold, fontSize: 14 },
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

  // Trail nodes + labels are absolutely positioned over the SVG stream.
  companionPerch: { position: 'absolute', width: 48, alignItems: 'center', zIndex: 3 },
  node: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  nodeGlyph: { fontSize: 27 },
  nodeLabel: { position: 'absolute', width: 124, alignItems: 'center' },
  currentTag: { ...Typography.preset.overline, fontSize: 9, letterSpacing: 1, marginBottom: 2 },
  nodeTitle: { ...Typography.preset.bodySemibold, fontSize: 13, textAlign: 'center' },
  nodeMeta: { ...Typography.preset.caption, fontSize: 10.5, marginTop: 1, textAlign: 'center' },
});
