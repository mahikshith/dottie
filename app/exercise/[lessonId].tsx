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
      if (__DEV__) console.warn('[Exercise] reward failed:', err);
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
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.lg,
            // Room for the gesture bar — the last block was sitting under the
            // Android nav bar (device-test-7).
            paddingBottom: insets.bottom + Spacing['4xl'],
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
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
          <ResultCard
            summary={result}
            companionType={companionType}
            celebration={wrapInsight(
              companionType,
              result.correct === result.total
                ? 'Flawless practice — you really know this!'
                : `You got ${result.correct} of ${result.total}. Practice is how it sticks.`,
              context,
              result.correct === result.total ? 'celebrating' : 'supportive'
            )}
            hasQuiz={!!lesson.quizId}
            onQuiz={goQuiz}
            onDone={goBack}
          />
        )}

        <View style={{ height: Spacing['4xl'] }} />
      </ScrollView>
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
  return (
    <View style={styles.resultWrap}>
      <CompanionLottie type={companionType} state={perfect ? 'celebrate' : 'proud'} size={120} loop={false} />
      <Text style={[styles.resultBig, { color: palette.accent }]}>
        {summary.correct}/{summary.total}
      </Text>
      <Text style={[styles.resultSub, { color: palette.ink2 }]}>{perfect ? 'Perfect practice!' : 'Nice work'}</Text>

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
