/**
 * Exercise Screen — plays a lesson's interactive exercises (Learn Quest).
 *
 * Its own aurora-native screen (like the quiz screen), reached after a lesson's
 * "Mark as Complete" when the lesson has exercises. Runs the ExercisePlayer,
 * then awards XP/gems and offers the quiz if the lesson has one — so the flow
 * is: lesson reader → practice exercises → quiz.
 *
 * ─── WHY A SCREEN, NOT INLINE ───────────────────────────────────────
 *  The lesson reader is still cream-themed; exercises are the new aurora world.
 *  Keeping them on a separate route avoids rethemeing a working screen blind and
 *  mirrors how `app/quiz/[id].tsx` is its own screen. The full aurora migration
 *  of the Learn reader happens with the path-map later.
 *
 *  Rewards mirror the existing lesson/quiz pattern: XP via `awardXp` with an
 *  override amount, gems via the `quiz_complete` source (lesson completion reuses
 *  the same source — see the lesson screen's note). Re-playing re-awards, exactly
 *  like retaking a quiz does today.
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device).
 */

import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { AuroraBackground, GlassCard, PressableScale, CompanionLottie } from '../../src/components/ui';
import { useAurora } from '../../src/theme';
import { ExercisePlayer, type ExerciseSummary } from '../../src/components/learn/ExercisePlayer';
import {
  useUserStore,
  useCycleStore,
  useGamificationStore,
  selectCompanionType,
  selectCurrentPhase,
  selectDayInCycle,
  selectStreak,
} from '../../src/stores';
import { getCompanion } from '../../src/content/companions';
import { getLesson } from '../../src/content/learning-paths';
import { getExercisesForLesson } from '../../src/content/exercises';
import { buildContext, wrapInsight } from '../../src/engine/content';
import { nudgeForScore } from '../../src/engine/learn/encouragement';
import { logSilentFailure } from '../../src/diagnostics/silent-failure';

export default function ExerciseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useAurora();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();

  const companionType = useUserStore(selectCompanionType);
  const phase = useCycleStore(selectCurrentPhase);
  const dayInCycle = useCycleStore(selectDayInCycle);
  const streak = useGamificationStore(selectStreak);
  const companion = getCompanion(companionType);

  const lesson = useMemo(() => (lessonId ? getLesson(lessonId) : null), [lessonId]);
  const exercises = useMemo(() => (lessonId ? getExercisesForLesson(lessonId) : []), [lessonId]);
  const context = useMemo(
    () =>
      buildContext({
        companionType,
        phase,
        dayInPhase: Math.max(1, dayInCycle),
        dayInCycle,
        streakCount: streak.currentStreak,
      }),
    [companionType, phase, dayInCycle, streak.currentStreak]
  );

  const [result, setResult] = useState<ExerciseSummary | null>(null);

  const onFinish = async (summary: ExerciseSummary) => {
    setResult(summary);
    try {
      if (summary.xpAwarded > 0) {
        await useGamificationStore
          .getState()
          .awardXp('lesson_complete', { overrideAmount: summary.xpAwarded });
        await useGamificationStore.getState().earnGems('quiz_complete');
      }
    } catch (err) {
      logSilentFailure('exercise.reward', err);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const goBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.back();
  };
  const goQuiz = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (lesson?.quizId) router.replace(`/quiz/${lesson.quizId}`);
  };

  // No exercises for this lesson — shouldn't be routed here, but degrade gently.
  if (!lesson || exercises.length === 0) {
    return (
      <AuroraBackground>
        <StatusBar style="light" />
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.center, { paddingTop: insets.top + Spacing['4xl'] }]}>
          <Text style={styles.bigEmoji}>🌱</Text>
          <Text style={[styles.title, { color: palette.ink }]}>No practice here yet</Text>
          <ThemedCTA label="Back" onPress={goBack} palette={palette} />
        </View>
      </AuroraBackground>
    );
  }

  return (
    <AuroraBackground>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      {/* ─── TWO LAYOUTS, ON PURPOSE ───────────────────────────────
          While PRACTISING, the screen is a fixed frame: header at the top, the
          question scrolling in the middle, and the Check/Continue button pinned
          to the bottom where the thumb already is. Wrapping the player in a
          page-level ScrollView (what this used to do) put the action at the end
          of the content instead, so its position drifted with the length of the
          question — halfway up on a short one, off-screen on a long one
          (device-test-10).

          On the RESULT card there is no repeated action to reach for, and the
          content can run long, so that stays a plain scrolling page. */}
      <View style={[styles.frame, { paddingTop: insets.top + Spacing.lg }]}>
        {/* Header */}
        <View style={styles.header}>
          <PressableScale onPress={goBack} haptic="none" hitSlop={10} accessibilityRole="button" accessibilityLabel="Close practice">
            <Text style={[styles.close, { color: palette.ink3 }]}>✕</Text>
          </PressableScale>
          <Text style={[styles.eyebrow, { color: palette.accent }]} numberOfLines={1}>
            {lesson.title}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {!result ? (
          <ExercisePlayer
            exercises={exercises}
            companionType={companionType}
            context={context}
            onFinish={onFinish}
          />
        ) : (
          <ScrollView
            style={styles.container}
            contentContainerStyle={{ paddingBottom: insets.bottom + Spacing['4xl'] }}
            showsVerticalScrollIndicator={false}
          >
            <ResultCard
              summary={result}
              companionType={companionType}
              // The line rotates through a pool rather than being one fixed
              // sentence, and the LOW band actually invites another attempt
              // (device-test-8). Keyed on attempts so it changes between runs but
              // never mid-render. See src/engine/learn/encouragement.ts.
              celebration={wrapInsight(
                companionType,
                nudgeForScore(result.total > 0 ? result.correct / result.total : 0, result.total).text,
                context,
                result.correct === result.total ? 'celebrating' : 'supportive'
              )}
              hasQuiz={!!lesson.quizId}
              onQuiz={goQuiz}
              onDone={goBack}
            />
          </ScrollView>
        )}
      </View>
    </AuroraBackground>
  );
}

// ─── RESULT ──────────────────────────────────────────────────────────

function ResultCard({
  summary,
  companionType,
  celebration,
  hasQuiz,
  onQuiz,
  onDone,
}: {
  summary: ExerciseSummary;
  companionType: ReturnType<typeof getCompanion>['type'];
  celebration: string;
  hasQuiz: boolean;
  onQuiz: () => void;
  onDone: () => void;
}): JSX.Element {
  const { palette } = useAurora();
  const perfect = summary.correct === summary.total;
  const score = summary.total > 0 ? summary.correct / summary.total : 0;

  return (
    <View style={styles.resultWrap}>
      {/* The companion's face is driven by the SCORE. It used to be
          `perfect ? 'celebrate' : 'proud'`, so 1-of-3 got a full grin —
          "even if the user got all the wrong answers ... still a smiley face"
          (device-test-8). `stateForScore` bottoms out at 'caring': supportive,
          visibly not pleased, never disappointed in the user. */}
      <CompanionLottie
        type={companionType}
        state={perfect ? 'celebrate' : score >= 0.5 ? 'proud' : 'cozy'}
        size={120}
        loop={false}
      />
      {/* The score sits in its own block below the character. It used to ride
          on the container's small gap and collided with the companion's feet
          when the rig bobbed. */}
      <View style={styles.resultScore}>
        <Text style={[styles.resultBig, { color: palette.accent }]}>
          {summary.correct}/{summary.total}
        </Text>
        <Text style={[styles.resultSub, { color: palette.ink2 }]}>
          {perfect ? 'Perfect practice!' : score >= 0.5 ? 'Nice work' : 'Worth another go'}
        </Text>
      </View>

      <GlassCard style={styles.rewards}>
        <View style={styles.rewardItem}>
          <Text style={styles.rewardEmoji}>⭐</Text>
          <Text style={[styles.rewardVal, { color: palette.ink }]}>+{summary.xpAwarded}</Text>
          <Text style={[styles.rewardLabel, { color: palette.ink3 }]}>XP</Text>
        </View>
        <View style={[styles.rewardDivider, { backgroundColor: palette.glass.edge }]} />
        <View style={styles.rewardItem}>
          <Text style={styles.rewardEmoji}>💎</Text>
          <Text style={[styles.rewardVal, { color: palette.ink }]}>+{summary.gemsAwarded}</Text>
          <Text style={[styles.rewardLabel, { color: palette.ink3 }]}>Gems</Text>
        </View>
      </GlassCard>

      <Text style={[styles.celebration, { color: palette.ink2 }]}>{celebration}</Text>

      {hasQuiz && <ThemedCTA label="Take the quiz →" onPress={onQuiz} palette={palette} />}
      <PressableScale onPress={onDone} haptic="light" style={styles.doneGhost} accessibilityRole="button" accessibilityLabel="Done">
        <Text style={[styles.doneGhostText, { color: palette.ink3 }]}>{hasQuiz ? 'Maybe later' : 'Done'}</Text>
      </PressableScale>
    </View>
  );
}

function ThemedCTA({
  label,
  onPress,
  palette,
}: {
  label: string;
  onPress: () => void;
  palette: ReturnType<typeof useAurora>['palette'];
}): JSX.Element {
  return (
    <PressableScale
      onPress={onPress}
      haptic="light"
      scaleTo={0.97}
      style={[styles.cta, { backgroundColor: palette.accent }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={[styles.ctaText, { color: palette.ground }]}>{label}</Text>
    </PressableScale>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.screenPadding },
  // Fixed frame: the player fills it and pins its own action to the bottom.
  frame: { flex: 1, paddingHorizontal: Spacing.screenPadding },
  center: { alignItems: 'center', gap: Spacing.lg, paddingHorizontal: Spacing.screenPadding },
  bigEmoji: { fontSize: 56 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  close: { fontSize: 20, fontWeight: '700', width: 24 },
  eyebrow: { ...Typography.preset.captionBold, flex: 1, textAlign: 'center' },
  title: { ...Typography.preset.h3, textAlign: 'center' },

  resultWrap: { alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.lg },
  // The rig BOBS. Its shadow sits at the very bottom of its box and the bounce
  // carries it a few px lower still, so a score pressed up against it got
  // clipped by the companion's feet (device-test-19, "1/3 pulled under the
  // companion"). This margin is clearance, not decoration.
  // Clear air under the character so the big numeral can never sit on it.
  resultScore: { alignItems: 'center', gap: 2, marginTop: Spacing.xl },
  resultBig: { ...Typography.preset.h1, fontSize: 52 },
  resultSub: { ...Typography.preset.body },
  rewards: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md, alignSelf: 'stretch' },
  rewardItem: { flex: 1, alignItems: 'center' },
  rewardEmoji: { fontSize: 28, marginBottom: 4 },
  rewardVal: { ...Typography.preset.number, fontSize: 22 },
  rewardLabel: { ...Typography.preset.caption },
  rewardDivider: { width: 1, height: 52 },
  celebration: { ...Typography.preset.body, fontStyle: 'italic', textAlign: 'center', marginVertical: Spacing.md, paddingHorizontal: Spacing.md },

  cta: {
    height: Spacing.buttonHeight.lg,
    borderRadius: Spacing.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.xl,
  },
  ctaText: { ...Typography.preset.button },
  doneGhost: { paddingVertical: Spacing.md, marginTop: Spacing.xs },
  doneGhostText: { ...Typography.preset.bodySemibold },
});
