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
 *  TWO modes (device-test-6 — the old New/Basics/Deep split asked the user to
 *  make a distinction they never needed):
 *   • 'guided' → start from the beginning; sequential locks stay on.
 *   • 'phase'  → nothing is locked, and the phase-aware selector surfaces a
 *                longer list of lessons matched to the user's CURRENT sub-phase
 *                and health conditions, so "show me what's relevant to me right
 *                now" is one tap rather than a hunt through paths.
 *  Persisted in `Storage.learnLevel`, which migrates the legacy values.
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

// A trail path whose bright dashes FLOW along it (toward the current lesson) —
// the "liquid glowing flow" the owner asked for on the Learn path.
const AnimatedPath = Animated.createAnimatedComponent(Path);
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
  useCycleStore,
  selectUserMode,
  selectCompanionType,
  selectXpTotal,
  selectGemsBalance,
  selectStreak,
  selectCurrentPhase,
  selectDayInCycle,
  selectHasCycleData,
  selectHealthProfile,
} from '../../src/stores';
import {
  LEARNING_PATHS,
  LESSONS,
  getLessonsForPath,
  getPathsForMode,
} from '../../src/content/learning-paths';
import { contentRepository, LessonProgress } from '../../src/database/repositories/content.repo';
import { getCompanion } from '../../src/content/companions';
import { LearningPath, Lesson, CompanionType } from '../../src/types/content.types';
import type { HealthCondition } from '../../src/types/cycle.types';
import { Storage, type LearnLevel } from '../../src/database/storage';
import { resolveSubPhase } from '../../src/engine/calendar/day-suggestions';
import { selectSpotlightLessons } from '../../src/engine/learn/phase-aware-selector';
import { TodaySpotlightCard } from '../../src/components/learn/TodaySpotlightCard';
import { recordVisit as recordRhythmVisit } from '../../src/engine/learn/gentle-rhythm';
import { logSilentFailure } from '../../src/diagnostics/silent-failure';

// Stable empty array so a null healthProfile doesn't churn the selector.
const EMPTY_CONDITIONS: HealthCondition[] = [];

const AURORA_SUCCESS = '#6FE6A8';

/** Entrance transition: fade + rise with a soft spring, delayed by `d` ms. */
function rise(d: number): ReturnType<typeof FadeInDown.duration> {
  return FadeInDown.duration(480).delay(d).springify().damping(16);
}

/**
 * A soft glowing ring that scales up and fades out on a loop — the "you are
 * here" marker the owner asked for, sitting behind the current lesson node.
 * Reduce-Motion aware (renders a still faint ring).
 */
function PulseRing({ color }: { color: string }): JSX.Element {
  const reduce = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    t.value = withRepeat(withTiming(1, { duration: 1700, easing: Easing.out(Easing.ease) }), -1, false);
  }, [reduce, t]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + t.value * 0.55 }],
    opacity: reduce ? 0.25 : 0.55 * (1 - t.value),
  }));
  return <Animated.View pointerEvents="none" style={[styles.pulseRing, { borderColor: color }, style]} />;
}

/**
 * The selected spirit companion perched on the current node, hopping in place
 * (Duolingo-style "you're here" energy). Reduce-Motion → sits still.
 */
function HoppingCompanion({ type }: { type: CompanionType }): JSX.Element {
  const reduce = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    y.value = withRepeat(
      withSequence(
        withTiming(-11, { duration: 360, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 380, easing: Easing.bounce }),
        withDelay(760, withTiming(0, { duration: 1 })),
      ),
      -1,
      false,
    );
  }, [reduce, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View style={style}>
      <CompanionLottie type={type} state="idle" size={48} />
    </Animated.View>
  );
}

/**
 * A bright dash that continuously FLOWS along the lit trail toward the current
 * lesson — the "glowing liquid flow from one lesson to the next" the owner
 * asked for. As the user finishes a lesson the lit path extends, so the flow
 * streams all the way to the newly-current node (which glows). Reduce-Motion →
 * the dash holds still.
 */
function FlowingPath({ d, color }: { d: string; color: string }): JSX.Element {
  const reduce = useReducedMotion();
  const off = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    // Scroll the dash pattern forward forever (negative = toward the path end).
    off.value = withRepeat(withTiming(-44, { duration: 850, easing: Easing.linear }), -1, false);
  }, [reduce, off]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: off.value }));
  return (
    <AnimatedPath
      d={d}
      stroke={color}
      strokeWidth={3.5}
      fill="none"
      strokeLinecap="round"
      strokeDasharray="9 35"
      strokeOpacity={0.92}
      animatedProps={animatedProps}
    />
  );
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
  const phase = useCycleStore(selectCurrentPhase);
  const dayInCycle = useCycleStore(selectDayInCycle);
  const hasCycleData = useCycleStore(selectHasCycleData);
  const healthProfile = useUserStore(selectHealthProfile);
  const conditions = healthProfile?.conditions ?? EMPTY_CONDITIONS;

  const companion = getCompanion(companionType);

  // ─── Progress + pace ────────────────────────────────────────────
  const [progressMap, setProgressMap] = useState<Map<string, LessonProgress>>(new Map());
  const [level, setLevel] = useState<LearnLevel>(() => Storage.learnLevel.get());
  const guided = level === 'guided';

  // Gentle Rhythm (Phase 4). We hold the rolling visited-days state in local
  // state so the chip can rerender when we record today's visit inside the
  // focus effect below. Persistence lives in `Storage.learnRhythm`.
  const [rhythm, setRhythm] = useState<{ visitedDays: string[] }>(() =>
    Storage.learnRhythm.get()
  );

  // Auto-scroll: bring the current lesson into view on open / after finishing one
  // (owner ask — don't make the user hunt for where they are). `armed` is reset
  // on focus so each visit re-centres; the once-guard stops multiple trails from
  // fighting over the scroll.
  const scrollRef = useRef<ScrollView>(null);
  const autoScrollArmed = useRef(true);
  const scrollToCurrent = useCallback((anchor: View | null) => {
    if (!autoScrollArmed.current) return;
    const sv = scrollRef.current;
    if (!anchor || !sv) return;
    autoScrollArmed.current = false;
    setTimeout(() => {
      try {
        const inner = (sv as unknown as { getInnerViewNode?: () => number }).getInnerViewNode?.();
        if (inner == null) return;
        anchor.measureLayout(
          inner,
          (_x: number, y: number) => sv.scrollTo({ y: Math.max(0, y - 170), animated: true }),
          () => {},
        );
      } catch {
        // best-effort; a failed measure just means no auto-scroll this time
      }
    }, 450);
  }, []);

  // Loader is a stable callback so the focus effect below can re-run it.
  const loadProgress = useCallback(() => {
    if (!userId) return undefined;
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
        logSilentFailure('learn.getAllLessonProgress', err);
      });
    return () => {
      cancelled = true;
    };
    // contentHydrated is a re-trigger key (progress lands in SQLite on hydrate).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, contentHydrated]);

  // Re-read progress EVERY time the tab regains focus. A lesson finished on the
  // reader persists to SQLite and pops the nav stack back here — if we don't
  // re-read, the completed node still looks "current" and the next stays locked
  // (the reported "can't move forward even after completing" bug). Also re-sync
  // the saved pace in case it was changed elsewhere.
  useFocusEffect(
    useCallback(() => {
      const cleanup = loadProgress();
      setLevel(Storage.learnLevel.get());
      autoScrollArmed.current = true; // re-centre on the current lesson each visit
      // Gentle Rhythm — record today's visit. Idempotent (double focus on the
      // same day is a no-op); prunes anything older than 30 days in the same
      // pass. Local state stays in sync so the chip re-renders.
      const todayIso = new Date().toISOString().slice(0, 10);
      const current = Storage.learnRhythm.get();
      const next = recordRhythmVisit(current, todayIso);
      if (next.visitedDays.length !== current.visitedDays.length ||
          next.visitedDays[next.visitedDays.length - 1] !== current.visitedDays[current.visitedDays.length - 1]) {
        Storage.learnRhythm.set(next);
        setRhythm(next);
      }
      return cleanup;
    }, [loadProgress])
  );

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

  // Lessons open as the READER (device-test-16). DT14 routed them into a chat
  // with the companion; on device that was repetitive, gave no sense of whose
  // turn it was, and re-showed the options after a correct answer. Owner:
  // "let's revert back to the phase where we show the detailed description of
  // what the phase is, and what the cautions need to be taken."
  //
  // The conversational experience is not gone — it moved to where it belongs,
  // the QUIZ, where turn-taking and reactions are the whole point.
  const openLesson = (lessonId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push(`/lesson/${lessonId}`);
  };

  // ─── Today's spotlight — phase-aware lesson picks (Gemini §1.2/§2.1) ─
  const subphase = useMemo(
    () =>
      hasCycleData
        ? resolveSubPhase({
            phase,
            dayInCycle,
            daysUntilPredictedPeriod: null,
            isPeriodDay: phase === 'menstrual',
          })
        : null,
    [hasCycleData, phase, dayInCycle]
  );
  const spotlight = useMemo(
    () =>
      selectSpotlightLessons({
        subphase,
        mode,
        conditions,
        lessons: LESSONS,
        progressById: progressMap,
        // In "My phase & conditions" mode this list IS the experience — the
        // user asked to jump straight to what's relevant — so surface more.
        count: level === 'phase' ? 6 : 3,
      }),
    [subphase, mode, conditions, progressMap, level]
  );

  const totalLessons = availablePaths.reduce((sum, p) => sum + (pathStats.get(p.id)?.total ?? 0), 0);
  const completedLessons = availablePaths.reduce((sum, p) => sum + (pathStats.get(p.id)?.completed ?? 0), 0);

  // The one path that still has a current lesson — only it drives auto-scroll.
  const activePathId = useMemo(
    () => availablePaths.find((p) => {
      const s = pathStats.get(p.id);
      return !s || s.completed < s.total;
    })?.id ?? null,
    [availablePaths, pathStats]
  );

  return (
    <AuroraBackground>
      <StatusBar style="light" />
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          {
            paddingTop: insets.top + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.tabBarClearance,
          },
        ]}
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

        {/* The "A visit today. Every one counts." cadence chip was REMOVED
            (device-test-6): it took prime space to tell the user something they
            already know. Visits are still recorded above — that belongs in a
            Duolingo-style push notification, not a permanent banner. */}

        {/* Today's Spotlight — phase-aware lesson picks (Gemini §1.2/§2.1) */}
        {spotlight.length > 0 && (
          <Animated.View entering={rise(140)} style={{ marginBottom: Spacing.sectionGap }}>
            <TodaySpotlightCard
              lessons={spotlight}
              onOpenLesson={openLesson}
              hasCycleData={hasCycleData}
            />
          </Animated.View>
        )}

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
              isActivePath={path.id === activePathId}
              onAutoScroll={scrollToCurrent}
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
  level: LearnLevel;
  guided: boolean;
  onPick: (l: LearnLevel) => void;
}): JSX.Element {
  const { palette } = useAurora();
  // TWO modes only (device-test-6). "New / Basics / Deep" was a distinction the
  // user never needed to make; what they actually want is "teach me from the
  // start" vs "show me what matters for my body right now".
  const options: { key: LearnLevel; emoji: string; label: string }[] = [
    { key: 'guided', emoji: '🌱', label: 'From the start' },
    { key: 'phase', emoji: '🌙', label: 'My phase' },
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
          : 'Straight to what matters for your phase and conditions. Nothing\'s locked.'}
      </Text>
    </View>
  );
}

// ─── PATH TRAIL ──────────────────────────────────────────────────────

// Trail geometry (px).
const NODE = 62;
// Device-test #5: bumped 104 → 140 so a node's 2-line label doesn't run into
// the next node's icon (the owner's "lesson head overwrites the icon" ask).
const ROW_H = 140;
const TOP = 52;
const BOTTOM = 72;

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
  isActivePath,
  onAutoScroll,
}: {
  path: LearningPath;
  lessons: Lesson[];
  stats: { total: number; completed: number; percent: number };
  progressMap: Map<string, LessonProgress>;
  guided: boolean;
  companionType: CompanionType;
  onLessonTap: (lessonId: string) => void;
  isActivePath: boolean;
  onAutoScroll: (anchor: View | null) => void;
}): JSX.Element {
  const { palette } = useAurora();
  const accent = path.gradient[0];
  const [width, setWidth] = useState(0);
  const anchorRef = useRef<View>(null);

  const currentId = useMemo(
    () => lessons.find((l) => progressMap.get(l.id)?.status !== 'complete')?.id ?? null,
    [lessons, progressMap]
  );
  const allComplete = stats.total > 0 && stats.completed === stats.total;

  // Build the ordered node model (lessons + a final reward node).
  const nodes: TrailNode[] = lessons.map((lesson) => {
    const isComplete = progressMap.get(lesson.id)?.status === 'complete';
    // Only the ONE active path (the one the user is actually progressing) gets a
    // "current" node. `currentId` is per-path (each path's first-incomplete
    // lesson), so WITHOUT this gate every path flagged its first lesson as
    // current — lighting the "YOU'RE HERE" tag, pulse ring and hopping companion
    // on every path's first lesson at once (device-test-6 #P1). On non-active
    // paths the next lesson is simply 'available'.
    const isCurrent = isActivePath && lesson.id === currentId;
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
      // Locked shows the DIMMED lesson emoji (+ a tiny lock badge in render) —
      // friendlier than a gloomy padlock glyph. Done = check.
      glyph: isComplete ? '✓' : lesson.emoji,
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
  // Stays -1 when this path has no current node (i.e. it isn't the active path)
  // — every downstream use guards on `> 0` / `>= 0` / `anchorPoint &&`, so the
  // lit trail, auto-scroll anchor and companion all correctly stay off. (Was
  // `Math.max(0, …)`, which silently pinned them to node 0 on every path.)
  const currentIndex = allComplete
    ? nodes.length - 1
    : nodes.findIndex((n) => n.state === 'current');

  // Geometry: a wide meander so the trail actually USES the empty side space
  // (owner feedback) and reads as a winding journey, not a centred list.
  // Amplitude slightly reduced (device-test #5) so adjacent-node labels have
  // horizontal breathing room and don't overlap when the meander goes tight.
  const amp = width > 0 ? Math.min(width / 2 - 76, Math.max(36, width * 0.22)) : 0;
  const cx = width / 2;
  const points = nodes.map((_, i) => ({
    x: cx + amp * Math.sin(i * 0.9),
    y: TOP + i * ROW_H + NODE / 2,
  }));
  const height = TOP + (nodes.length - 1) * ROW_H + NODE + BOTTOM;

  // Once laid out, ask the parent to scroll the current node into view. Re-fires
  // when currentIndex advances (a lesson was just completed) — the parent's
  // once-guard/arming decides whether it actually scrolls.
  useEffect(() => {
    if (width > 0 && isActivePath && currentIndex >= 0) {
      onAutoScroll(anchorRef.current);
    }
  }, [width, isActivePath, currentIndex, onAutoScroll]);

  const anchorPoint = points[currentIndex];

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
            {/* Invisible auto-scroll anchor pinned to the current node. */}
            {isActivePath && anchorPoint && (
              <View
                ref={anchorRef}
                style={{ position: 'absolute', left: anchorPoint.x, top: anchorPoint.y, width: 1, height: 1 }}
                pointerEvents="none"
              />
            )}
            {/* aurora stream behind the nodes */}
            <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Defs>
                <SvgLinearGradient id={`stream_${path.id}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={palette.accent} />
                  <Stop offset="1" stopColor={palette.accent2} />
                </SvgLinearGradient>
              </Defs>
              {/* dim base TUBE (the whole journey): a wide muted casing with a
                  thin lighter core, so the unlit trail reads as a rounded pipe. */}
              <Path d={buildTrailPath(points)} stroke={palette.glass.edge} strokeWidth={12} fill="none" strokeLinecap="round" />
              <Path d={buildTrailPath(points)} stroke={palette.glass.bg} strokeWidth={5} fill="none" strokeLinecap="round" strokeOpacity={0.6} />
              {/* lit portion up to where you are — soft glow, bright core, gloss. */}
              {currentIndex > 0 && (
                <>
                  <Path d={buildTrailPath(points.slice(0, currentIndex + 1))} stroke={palette.accent} strokeOpacity={0.22} strokeWidth={20} fill="none" strokeLinecap="round" />
                  <Path d={buildTrailPath(points.slice(0, currentIndex + 1))} stroke={`url(#stream_${path.id})`} strokeWidth={9} fill="none" strokeLinecap="round" />
                  <Path d={buildTrailPath(points.slice(0, currentIndex + 1))} stroke="#FFFFFF" strokeOpacity={0.32} strokeWidth={2.5} fill="none" strokeLinecap="round" />
                  {/* the glowing liquid flow streaming toward the current node */}
                  <FlowingPath d={buildTrailPath(points.slice(0, currentIndex + 1))} color="#FFFFFF" />
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
                  {/* Pulsing "you are here" glow ring behind the current node. */}
                  {isCurrent && (
                    <View style={[styles.glowHost, { left: p.x - NODE / 2, top: p.y - NODE / 2 }]} pointerEvents="none">
                      <PulseRing color={accent} />
                    </View>
                  )}
                  {isCurrent && (
                    <View style={[styles.companionPerch, { left: p.x - 24, top: p.y - NODE / 2 - 46 }]} pointerEvents="none">
                      <HoppingCompanion type={companionType} />
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
                      // Locked = soft dashed accent ring (NOT glass, NOT gloomy).
                      locked && { backgroundColor: `${accent}12`, borderColor: `${accent}66`, borderStyle: 'dashed', opacity: 0.9 },
                      n.state === 'reward-off' && { opacity: 0.5 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${n.title}${locked ? ' (locked)' : n.state === 'done' ? ' (complete)' : ''}`}
                    accessibilityState={{ disabled: !tappable }}
                  >
                    <Text style={[styles.nodeGlyph, locked && styles.nodeGlyphLocked]}>{n.glyph}</Text>
                  </PressableScale>
                  {/* Small friendly lock badge instead of a full padlock node. */}
                  {locked && (
                    <View style={[styles.lockBadge, { left: p.x + NODE / 2 - 20, top: p.y - NODE / 2 - 4, backgroundColor: palette.ground, borderColor: `${accent}66` }]} pointerEvents="none">
                      <Text style={styles.lockBadgeText}>🔒</Text>
                    </View>
                  )}

                  {/* Title sits BESIDE the node (in the empty side gutter),
                      never on top of the icon. It goes on the INNER side —
                      toward centre, where there's the most room — so labels
                      never overlap the meandering trail or each other. */}
                  {(() => {
                    const GUT = 12;
                    const EDGE = 10;
                    const labelRight = p.x <= cx; // left/centre node → label to the right
                    const labelWidth = labelRight
                      ? Math.min(176, width - (p.x + NODE / 2 + GUT) - EDGE)
                      : Math.min(176, p.x - NODE / 2 - GUT - EDGE);
                    const labelLeft = labelRight
                      ? p.x + NODE / 2 + GUT
                      : p.x - NODE / 2 - GUT - labelWidth;
                    const align = labelRight ? 'left' : 'right';
                    return (
                      <View
                        style={[
                          styles.nodeLabel,
                          {
                            left: labelLeft,
                            width: labelWidth,
                            top: p.y - 24,
                            alignItems: labelRight ? 'flex-start' : 'flex-end',
                          },
                        ]}
                        pointerEvents="none"
                      >
                        {isCurrent && (
                          <Text style={[styles.currentTag, { color: accent, textAlign: align }]}>
                            YOU'RE HERE
                          </Text>
                        )}
                        <Text
                          style={[
                            styles.nodeTitle,
                            { color: locked || n.state === 'reward-off' ? palette.ink3 : palette.ink, textAlign: align },
                          ]}
                          numberOfLines={2}
                        >
                          {n.title}
                        </Text>
                        <Text style={[styles.nodeMeta, { color: palette.ink3, textAlign: align }]} numberOfLines={1}>
                          {n.meta}
                        </Text>
                      </View>
                    );
                  })()}
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
  companionPerch: { position: 'absolute', width: 48, alignItems: 'center', zIndex: 4 },
  glowHost: { position: 'absolute', width: NODE, height: NODE, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  pulseRing: { position: 'absolute', width: NODE, height: NODE, borderRadius: 22, borderWidth: 2.5 },
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
  nodeGlyphLocked: { opacity: 0.55 },
  lockBadge: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  lockBadgeText: { fontSize: 11 },
  // width + alignItems are set inline per node (label sits beside the icon on
  // whichever side has room — see the trail render).
  nodeLabel: { position: 'absolute' },
  currentTag: { ...Typography.preset.overline, fontSize: 9, letterSpacing: 1, marginBottom: 2 },
  nodeTitle: { ...Typography.preset.bodySemibold, fontSize: 13 },
  nodeMeta: { ...Typography.preset.caption, fontSize: 10.5, marginTop: 1 },
});
