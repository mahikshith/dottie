import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { Shadows } from '../../src/constants/shadows';
import {
  useUserStore,
  useGamificationStore,
  useContentStore,
  useCycleStore,
  selectCompanionType,
  selectCurrentPhase,
  selectDayInCycle,
  selectStreak,
} from '../../src/stores';
import { getCompanion } from '../../src/content/companions';
import type {
  QuizAttemptSession,
  RenderedQuizQuestion,
  SubmitAnswerResult,
  QuizResult,
} from '../../src/engine/content';

/**
 * Quiz Screen — End-to-end quiz experience.
 *
 * ─── FLOW ───────────────────────────────────────────────────────────
 *
 *  1. Mount → start attempt via QuizEngine (random N questions)
 *  2. Render question N of M with companion encouragement
 *  3. User taps an option → submitAnswer() → show explanation +
 *     companion reaction immediately
 *  4. Tap "Next" → advance index → repeat
 *  5. Last question complete → finishAttempt() → render result screen
 *     with score, XP/Gem awards, companion celebration
 *  6. User taps "Done" → award XP/gems via gamification store → back
 *
 * ─── WHY ANSWER FEEDBACK IS IMMEDIATE ───────────────────────────────
 *
 *  Showing the explanation right after the user answers (rather than
 *  at the end) is core to the Duolingo learning model. The friction
 *  of "wait, was I right?" actively damages learning. We trade a
 *  little suspense for much better retention.
 *
 * ─── ERROR HANDLING ─────────────────────────────────────────────────
 *
 *  If startAttempt() returns null (quiz not found), we show a friendly
 *  error and offer to go back. This shouldn't happen in production —
 *  every quizId comes from a bundled lesson — but it's a safety net.
 */

type Phase = 'starting' | 'asking' | 'reviewing' | 'finishing' | 'finished' | 'error';

export default function QuizScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  // ─── Live state for the engine ──────────────────────────────────
  const companionType = useUserStore(selectCompanionType);
  const cyclePhase = useCycleStore(selectCurrentPhase);
  const dayInCycle = useCycleStore(selectDayInCycle);
  const streak = useGamificationStore(selectStreak);
  const quizEngine = useContentStore((s) => s.quizEngine);

  const companion = getCompanion(companionType);

  // ─── Screen state machine ───────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('starting');
  const [session, setSession] = useState<QuizAttemptSession | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [lastAnswer, setLastAnswer] = useState<SubmitAnswerResult | null>(null);
  const [finalResult, setFinalResult] = useState<QuizResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ─── Start the attempt on mount ─────────────────────────────────
  useEffect(() => {
    if (!id || !quizEngine) {
      setPhase('error');
      setErrorMessage(
        !id ? 'No quiz ID provided' : 'Quiz engine not ready — try again in a moment.'
      );
      return;
    }

    const attempt = quizEngine.startAttempt(
      id,
      companionType,
      cyclePhase,
      dayInCycle,
      streak.currentStreak
    );

    if (!attempt) {
      setPhase('error');
      setErrorMessage("This quiz isn't available yet. Check back soon!");
      return;
    }

    setSession(attempt);
    setPhase('asking');
    // We intentionally only run this on mount — the engine session is
    // stable for the lifetime of the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ─── Current question ───────────────────────────────────────────
  const currentQuestion: RenderedQuizQuestion | null = useMemo(() => {
    if (!session) return null;
    return session.questions[questionIndex] ?? null;
  }, [session, questionIndex]);

  // ─── Handlers ───────────────────────────────────────────────────
  const handleOptionTap = (optionIndex: number) => {
    if (phase !== 'asking' || !quizEngine || !session) return;

    Haptics.selectionAsync().catch(() => {});
    setSelectedOption(optionIndex);

    const result = quizEngine.submitAnswer(
      session.sessionId,
      questionIndex,
      optionIndex
    );
    if (!result) return;

    Haptics.notificationAsync(
      result.correct
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning
    ).catch(() => {});

    setLastAnswer(result);
    setPhase('reviewing');
  };

  const handleNext = () => {
    if (!session) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const isLast = questionIndex >= session.questions.length - 1;
    if (isLast) {
      finishAttempt();
    } else {
      setQuestionIndex((idx) => idx + 1);
      setSelectedOption(null);
      setLastAnswer(null);
      setPhase('asking');
    }
  };

  const finishAttempt = async () => {
    if (!session || !quizEngine) return;

    setPhase('finishing');
    const result = quizEngine.finishAttempt(session.sessionId);

    if (!result) {
      setPhase('error');
      setErrorMessage("Couldn't finish the quiz — but your lesson is still done.");
      return;
    }

    setFinalResult(result);

    // Award XP and gems via gamification store
    try {
      // Quiz completion XP via dedicated source; override to use engine's amount
      await useGamificationStore
        .getState()
        .awardXp('quiz_complete', { overrideAmount: result.xpAwarded });
      // Drip gems through the standard quiz_complete source
      await useGamificationStore.getState().earnGems('quiz_complete');

      // Perfect-score badge handled separately
      if (result.score === 1.0) {
        await useGamificationStore.getState().unlockBadge('perfect_quiz_score', {
          quizId: result.quizId,
          completedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      if (__DEV__) console.warn('[Quiz] reward award failed:', err);
    }

    Haptics.notificationAsync(
      result.passed
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning
    ).catch(() => {});

    setPhase('finished');
  };

  const handleDone = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.back();
  };

  const handleAbandon = () => {
    if (session && quizEngine) {
      quizEngine.abandonSession(session.sessionId);
    }
    router.back();
  };

  // ─── RENDER PHASES ──────────────────────────────────────────────

  if (phase === 'starting' || phase === 'finishing') {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={Colors.primary.coral} />
        <Text style={styles.loadingText}>
          {phase === 'starting' ? 'Loading quiz...' : 'Tallying your score...'}
        </Text>
      </View>
    );
  }

  if (phase === 'error') {
    return (
      <View style={styles.notFoundContainer}>
        <Stack.Screen options={{ title: '' }} />
        <Text style={styles.notFoundEmoji}>🤔</Text>
        <Text style={styles.notFoundTitle}>{errorMessage}</Text>
        <Pressable style={styles.notFoundButton} onPress={() => router.back()}>
          <Text style={styles.notFoundButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'finished' && finalResult) {
    return <QuizResultScreen result={finalResult} companion={companion} onDone={handleDone} />;
  }

  // 'asking' or 'reviewing'
  const totalQuestions = session?.questions.length ?? 0;
  const progress = totalQuestions === 0 ? 0 : (questionIndex + 1) / totalQuestions;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: session?.quizTitle ?? 'Quiz',
          headerStyle: { backgroundColor: Colors.surface.background },
          headerTintColor: Colors.text.primary,
          headerBackTitle: 'Exit',
          headerLeft: () => (
            <Pressable onPress={handleAbandon} hitSlop={12} style={{ paddingHorizontal: 4 }}>
              <Text style={{ color: Colors.primary.coral, fontSize: 16 }}>Close</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.max(5, Math.round(progress * 100))}%` },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {questionIndex + 1} / {totalQuestions}
          </Text>
        </View>

        {/* Companion encouragement (only on first question) */}
        {questionIndex === 0 && session?.companionEncouragement && phase === 'asking' && (
          <View style={styles.companionEncouragement}>
            <Text style={styles.companionEmoji}>{companion.emoji}</Text>
            <Text style={styles.companionEncouragementText}>
              {session.companionEncouragement}
            </Text>
          </View>
        )}

        {/* Question */}
        {currentQuestion && (
          <View style={styles.questionCard}>
            <Text style={styles.questionText}>{currentQuestion.questionText}</Text>

            <View style={styles.optionsContainer}>
              {currentQuestion.options.map((option, idx) => {
                const isSelected = selectedOption === idx;
                const isCorrect = lastAnswer?.correctOptionIndex === idx;
                const isWrongPick = isSelected && lastAnswer && !lastAnswer.correct;

                return (
                  <Pressable
                    key={idx}
                    style={({ pressed }) => [
                      styles.optionButton,
                      phase === 'reviewing' && isCorrect && styles.optionCorrect,
                      phase === 'reviewing' && isWrongPick && styles.optionWrong,
                      pressed && phase === 'asking' && styles.optionPressed,
                    ]}
                    onPress={() => handleOptionTap(idx)}
                    disabled={phase !== 'asking'}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        phase === 'reviewing' && isCorrect && styles.optionTextCorrect,
                        phase === 'reviewing' && isWrongPick && styles.optionTextWrong,
                      ]}
                    >
                      {option}
                    </Text>
                    {phase === 'reviewing' && isCorrect && (
                      <Text style={styles.optionCheckmark}>✓</Text>
                    )}
                    {phase === 'reviewing' && isWrongPick && (
                      <Text style={styles.optionWrongmark}>✗</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Explanation + companion reaction (only while reviewing) */}
        {phase === 'reviewing' && lastAnswer && (
          <View
            style={[
              styles.explanationCard,
              lastAnswer.correct ? styles.explanationCorrect : styles.explanationWrong,
            ]}
          >
            <Text style={styles.explanationEmoji}>{lastAnswer.explanationEmoji}</Text>
            <Text style={styles.explanationText}>{lastAnswer.explanation}</Text>
            <View style={styles.companionReactionRow}>
              <Text style={styles.companionReactionEmoji}>{companion.emoji}</Text>
              <Text style={styles.companionReactionText}>
                {lastAnswer.companionReaction}
              </Text>
            </View>
          </View>
        )}

        {/* Next / Finish button (only while reviewing) */}
        {phase === 'reviewing' && (
          <Pressable
            style={({ pressed }) => [
              styles.nextButton,
              pressed && styles.nextButtonPressed,
            ]}
            onPress={handleNext}
          >
            <Text style={styles.nextButtonText}>
              {questionIndex >= (session?.questions.length ?? 0) - 1
                ? 'Finish Quiz'
                : 'Next Question'}
            </Text>
          </Pressable>
        )}

        <View style={{ height: Spacing['3xl'] }} />
      </ScrollView>
    </>
  );
}

// ─── RESULT SCREEN ───────────────────────────────────────────────────

function QuizResultScreen({
  result,
  companion,
  onDone,
}: {
  result: QuizResult;
  companion: ReturnType<typeof getCompanion>;
  onDone: () => void;
}) {
  const pct = Math.round(result.score * 100);
  const accent = result.passed ? Colors.semantic.success : Colors.primary.coral;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.resultContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.resultHero, { backgroundColor: `${accent}11` }]}>
          <Text style={styles.resultEmoji}>
            {result.score === 1.0 ? '🌟' : result.passed ? '✨' : '🌱'}
          </Text>
          <Text style={[styles.resultPct, { color: accent }]}>{pct}%</Text>
          <Text style={styles.resultScoreText}>
            {result.correctCount} of {result.totalCount} correct
          </Text>
          {result.isNewBestScore && (
            <Text style={styles.resultNewBest}>🏆 New best score!</Text>
          )}
        </View>

        <View style={styles.companionCelebrationCard}>
          <Text style={styles.companionEmoji}>{companion.emoji}</Text>
          <Text style={styles.companionCelebrationText}>{result.companionCelebration}</Text>
        </View>

        <View style={styles.rewardsCard}>
          <View style={styles.rewardItem}>
            <Text style={styles.rewardEmoji}>⭐</Text>
            <Text style={styles.rewardValue}>+{result.xpAwarded}</Text>
            <Text style={styles.rewardLabel}>XP</Text>
          </View>
          <View style={styles.rewardDivider} />
          <View style={styles.rewardItem}>
            <Text style={styles.rewardEmoji}>💎</Text>
            <Text style={styles.rewardValue}>+{result.gemsAwarded}</Text>
            <Text style={styles.rewardLabel}>Gems</Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.doneButton,
            { backgroundColor: accent },
            pressed && styles.nextButtonPressed,
          ]}
          onPress={onDone}
        >
          <Text style={styles.nextButtonText}>Done</Text>
        </Pressable>

        <View style={{ height: Spacing['3xl'] }} />
      </ScrollView>
    </>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface.background,
  },
  contentContainer: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.base,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface.background,
  },
  loadingText: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
    marginTop: Spacing.md,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.surface.card,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary.coral,
    borderRadius: 4,
  },
  progressText: {
    ...Typography.preset.captionBold,
    color: Colors.text.secondary,
    minWidth: 40,
    textAlign: 'right',
  },
  companionEncouragement: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.card,
    padding: Spacing.md,
    borderRadius: Spacing.radius.xl,
    marginBottom: Spacing.base,
    ...Shadows.sm,
  },
  companionEncouragementText: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
    flex: 1,
    marginLeft: Spacing.md,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  companionEmoji: {
    fontSize: 32,
  },
  questionCard: {
    backgroundColor: Colors.surface.card,
    padding: Spacing.cardPaddingLarge,
    borderRadius: Spacing.radius['2xl'],
    marginBottom: Spacing.base,
    ...Shadows.card,
  },
  questionText: {
    ...Typography.preset.h4,
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
    lineHeight: 28,
  },
  optionsContainer: {
    gap: Spacing.sm,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.background,
    padding: Spacing.cardPadding,
    borderRadius: Spacing.radius.xl,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  optionCorrect: {
    backgroundColor: '#E8F5E9',
    borderColor: Colors.semantic.success,
  },
  optionWrong: {
    backgroundColor: '#FFEBEE',
    borderColor: Colors.semantic.error,
  },
  optionText: {
    ...Typography.preset.body,
    color: Colors.text.primary,
    flex: 1,
  },
  optionTextCorrect: {
    ...Typography.preset.bodySemibold,
    color: Colors.semantic.success,
  },
  optionTextWrong: {
    color: Colors.semantic.error,
  },
  optionCheckmark: {
    ...Typography.preset.h4,
    color: Colors.semantic.success,
    marginLeft: Spacing.md,
  },
  optionWrongmark: {
    ...Typography.preset.h4,
    color: Colors.semantic.error,
    marginLeft: Spacing.md,
  },
  explanationCard: {
    padding: Spacing.cardPadding,
    borderRadius: Spacing.radius.xl,
    marginBottom: Spacing.base,
    borderLeftWidth: 4,
  },
  explanationCorrect: {
    backgroundColor: '#F1F8F4',
    borderLeftColor: Colors.semantic.success,
  },
  explanationWrong: {
    backgroundColor: '#FFF5F5',
    borderLeftColor: Colors.semantic.error,
  },
  explanationEmoji: {
    fontSize: 32,
    marginBottom: Spacing.sm,
  },
  explanationText: {
    ...Typography.preset.body,
    color: Colors.text.primary,
    lineHeight: 24,
    marginBottom: Spacing.md,
  },
  companionReactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  companionReactionEmoji: {
    fontSize: 20,
    marginRight: Spacing.sm,
  },
  companionReactionText: {
    ...Typography.preset.caption,
    color: Colors.text.secondary,
    flex: 1,
    fontStyle: 'italic',
  },
  nextButton: {
    backgroundColor: Colors.primary.coral,
    height: Spacing.buttonHeight.lg,
    borderRadius: Spacing.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.button,
  },
  nextButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  nextButtonText: {
    ...Typography.preset.button,
    color: Colors.text.inverse,
  },
  // ─── Result screen styles ──────────────────────────────────────
  resultContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing['5xl'],
  },
  resultHero: {
    padding: Spacing.cardPaddingLarge,
    borderRadius: Spacing.radius['2xl'],
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  resultEmoji: {
    fontSize: 80,
    marginBottom: Spacing.md,
  },
  resultPct: {
    ...Typography.preset.h1,
    fontSize: 56,
  },
  resultScoreText: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
    marginTop: Spacing.sm,
  },
  resultNewBest: {
    ...Typography.preset.bodySemibold,
    color: Colors.gamification.badge,
    marginTop: Spacing.md,
  },
  companionCelebrationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.card,
    padding: Spacing.cardPadding,
    borderRadius: Spacing.radius.xl,
    marginBottom: Spacing.base,
    ...Shadows.sm,
  },
  companionCelebrationText: {
    ...Typography.preset.body,
    color: Colors.text.primary,
    flex: 1,
    marginLeft: Spacing.md,
    lineHeight: 24,
  },
  rewardsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.card,
    padding: Spacing.cardPadding,
    borderRadius: Spacing.radius.xl,
    marginBottom: Spacing.sectionGap,
    ...Shadows.sm,
  },
  rewardItem: {
    flex: 1,
    alignItems: 'center',
  },
  rewardEmoji: {
    fontSize: 32,
    marginBottom: Spacing.xs,
  },
  rewardValue: {
    ...Typography.preset.number,
    color: Colors.text.primary,
  },
  rewardLabel: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
  },
  rewardDivider: {
    width: 1,
    height: 60,
    backgroundColor: Colors.border.light,
  },
  doneButton: {
    height: Spacing.buttonHeight.lg,
    borderRadius: Spacing.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.button,
  },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface.background,
    padding: Spacing.xl,
  },
  notFoundEmoji: {
    fontSize: 64,
    marginBottom: Spacing.lg,
  },
  notFoundTitle: {
    ...Typography.preset.h4,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  notFoundButton: {
    backgroundColor: Colors.primary.coral,
    paddingHorizontal: Spacing['3xl'],
    height: Spacing.buttonHeight.md,
    borderRadius: Spacing.radius.full,
    justifyContent: 'center',
  },
  notFoundButtonText: {
    ...Typography.preset.button,
    color: Colors.text.inverse,
  },
});