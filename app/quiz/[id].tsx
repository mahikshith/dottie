import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { AuroraBackground } from '../../src/components/ui';
import { QuizAnswerReaction } from '../../src/components/learn/QuizAnswerReaction';
import { showCelebration, celebrationTierForMood } from '../../src/components/ui/celebration/celebration';
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
import { CompanionCreature } from '../../src/components/ui/creature/CompanionCreature';
import { nudgeForScore } from '../../src/engine/learn/encouragement';
import { CompanionScoreReaction } from '../../src/components/learn/CompanionScoreReaction';
import type {
  QuizAttemptSession,
  RenderedQuizQuestion,
  SubmitAnswerResult,
  QuizResult,
} from '../../src/engine/content';

// Fixed aurora (Nocturne) tokens for this focused task screen. The live-palette
// ground still comes from <AuroraBackground>; the cards are glass (which reads
// the same on any aurora ground), so fixed literals keep this big screen simple.
const A = {
  ground: '#0C0A16',
  ink: '#F3EEFF',
  ink2: '#B8AED6',
  ink3: '#8B82A8',
  glass: 'rgba(255,255,255,0.06)',
  edge: 'rgba(255,255,255,0.14)',
  accent: '#54E6C8',
  success: '#6FE6A8',
  error: '#FF7A8A',
  gold: '#FFC24D',
} as const;

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
  const insets = useSafeAreaInsets();
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [lastAnswer, setLastAnswer] = useState<SubmitAnswerResult | null>(null);
  const [finalResult, setFinalResult] = useState<QuizResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Running tally of correct answers, shown in the feedback panel to motivate.
  const [correctSoFar, setCorrectSoFar] = useState(0);

  // ─── Start the attempt on mount ─────────────────────────────────
  // Device-test #3 finding: this used to have `[id]` deps only, so if
  // `quizEngine` was still null when the effect first ran (hydration
  // still in flight), it would set phase='error' and never re-fire when
  // the engine became ready — the user was stuck on the loading spinner
  // (the "white circle at top-left" reported in test #3). Adding
  // quizEngine to the deps means the effect re-runs when hydration
  // finishes. Also: don't flip to error while the engine is missing —
  // keep the spinner and try again once it lands, so a race no longer
  // shows a scary error.
  useEffect(() => {
    if (!id) {
      setPhase('error');
      setErrorMessage('No quiz ID provided');
      return;
    }
    if (!quizEngine) {
      // Stay in 'starting' — spinner is fine, engine hydration is fast.
      return;
    }

    // Adaptive: true enables Phase 3's tier-aware selection so a new user's
    // first question is always beginner-tier and difficulty climbs on correct
    // answers (promote-only, never demote). Deterministic per session id.
    const attempt = quizEngine.startAttempt(
      id,
      companionType,
      cyclePhase,
      dayInCycle,
      streak.currentStreak,
      undefined,
      true
    );

    if (!attempt) {
      setPhase('error');
      setErrorMessage("This quiz isn't available yet. Check back soon!");
      return;
    }

    setSession(attempt);
    setCorrectSoFar(0);
    setPhase('asking');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, quizEngine]);

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

    if (result.correct) setCorrectSoFar((n) => n + 1);
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
        .awardXp('quiz_pass', { overrideAmount: result.xpAwarded });
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

    // Celebrate a win across the whole screen — but tuned to today's mood. A
    // low/frustrated mood gets the gentle, soothing tier (never a loud burst);
    // a strong pass on a good day gets the full aurora bloom.
    if (result.passed) {
      const moodScore = useCycleStore.getState().todayCheckIn?.moodScore ?? null;
      const magnitude = result.score >= 0.8 ? 'big' : 'small';
      showCelebration(celebrationTierForMood(moodScore, magnitude));
    }

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
      <AuroraBackground>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <Stack.Screen options={{ headerShown: false }} />
          <ActivityIndicator size="large" color={A.accent} />
          <Text style={styles.loadingText}>
            {phase === 'starting' ? 'Loading quiz...' : 'Tallying your score...'}
          </Text>
        </View>
      </AuroraBackground>
    );
  }

  if (phase === 'error') {
    return (
      <AuroraBackground>
        <StatusBar style="light" />
        <View style={styles.notFoundContainer}>
          <Stack.Screen options={{ title: '' }} />
          <Text style={styles.notFoundEmoji}>🤔</Text>
          <Text style={styles.notFoundTitle}>{errorMessage}</Text>
          <Pressable style={styles.notFoundButton} onPress={() => router.back()}>
            <Text style={styles.notFoundButtonText}>Go back</Text>
          </Pressable>
        </View>
      </AuroraBackground>
    );
  }

  if (phase === 'finished' && finalResult) {
    return <QuizResultScreen result={finalResult} companion={companion} onDone={handleDone} />;
  }

  // 'asking' or 'reviewing'
  const totalQuestions = session?.questions.length ?? 0;
  const progress = totalQuestions === 0 ? 0 : (questionIndex + 1) / totalQuestions;

  return (
    <AuroraBackground>
      <StatusBar style="light" />
      <Stack.Screen
        options={{
          headerShown: true,
          title: session?.quizTitle ?? 'Quiz',
          headerStyle: { backgroundColor: A.ground },
          headerTintColor: A.ink,
          headerBackTitle: 'Exit',
          headerLeft: () => (
            // Icon-only so the long quiz title next to it never truncates
            // the label (device-test #5 saw "Clos"). hitSlop keeps the tap
            // target at 44+pt without stealing header width.
            <Pressable
              onPress={handleAbandon}
              hitSlop={16}
              style={{ paddingHorizontal: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Close quiz"
            >
              <Text style={{ color: A.accent, fontSize: 22, fontWeight: '700' }}>×</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          // Bottom room for the PINNED footer + the gesture bar. Without this
          // the "N of M correct so far" pill and the last option sat under the
          // Next button and the Android nav bar (device-test-7, image 1/3).
          { paddingBottom: insets.bottom + Spacing.buttonHeight.lg + Spacing['3xl'] },
        ]}
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

        {/* Answer feedback — the expressive Duolingo-style panel that fills the
            space under the question when reviewing. The companion REACTS
            (celebrates a win, warmly encourages a miss), then the explanation
            ("the why"), the companion's line, and a running progress pill. */}
        {phase === 'reviewing' && lastAnswer && (
          <Animated.View
            entering={FadeInDown.duration(360).springify().damping(16)}
            style={[
              styles.feedbackPanel,
              lastAnswer.correct ? styles.feedbackCorrect : styles.feedbackWrong,
            ]}
          >
            <QuizAnswerReaction
              companionType={companionType}
              correct={lastAnswer.correct}
              seed={questionIndex}
              headlineColor={lastAnswer.correct ? A.success : A.gold}
              />

            {/* The learning payload — why this answer is what it is. */}
            <View style={styles.feedbackExplainRow}>
              <Text style={styles.explanationEmoji}>{lastAnswer.explanationEmoji}</Text>
              <Text style={styles.feedbackExplainText}>{lastAnswer.explanation}</Text>
            </View>

            {/* Companion's own encouraging line. */}
            <View style={styles.companionReactionRow}>
              <Text style={styles.companionReactionEmoji}>{companion.emoji}</Text>
              <Text style={styles.companionReactionText}>{lastAnswer.companionReaction}</Text>
            </View>

            {/* Running progress — motivating, and it uses the empty space. */}
            <Animated.View
              entering={FadeIn.delay(200).duration(260)}
              style={[
                styles.progressPill,
                { borderColor: lastAnswer.correct ? A.success : A.gold },
              ]}
            >
              <Text
                style={[
                  styles.progressPillText,
                  { color: lastAnswer.correct ? A.success : A.gold },
                ]}
              >
                {correctSoFar} of {questionIndex + 1} correct so far
              </Text>
            </Animated.View>
          </Animated.View>
        )}

        {/* Footer clearance lives in contentContainerStyle above (it also has
            to account for insets.bottom), so no extra spacer view here. */}
      </ScrollView>

      {/* Next / Finish — PINNED to the bottom of the screen (device-test-6).
          It used to sit at the end of the scroll content, so on a long question
          the user had to scroll down to continue and the primary action drifted
          out of thumb reach. Now it's always exactly where the thumb already
          is. Only rendered while reviewing, so it can't be tapped early. */}
      {phase === 'reviewing' && (
        <View
          style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}
          pointerEvents="box-none"
        >
          <Pressable
            style={({ pressed }) => [
              styles.nextButton,
              pressed && styles.nextButtonPressed,
            ]}
            onPress={handleNext}
            accessibilityRole="button"
            accessibilityLabel={
              questionIndex >= (session?.questions.length ?? 0) - 1 ? 'Finish quiz' : 'Next question'
            }
          >
            <Text style={styles.nextButtonText}>
              {questionIndex >= (session?.questions.length ?? 0) - 1
                ? 'Finish Quiz'
                : 'Next Question'}
            </Text>
          </Pressable>
        </View>
      )}
    </AuroraBackground>
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
  const accent = result.passed ? A.success : A.accent;
  // Rotates by attempt so a repeat run doesn't replay the same sentence.
  const nudge = nudgeForScore(result.score, result.totalCount);

  return (
    <AuroraBackground>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.resultContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.resultHero, { backgroundColor: `${accent}11` }]}>
          {/* The companion reacts to the score (mind-blown at 100 → warm hug on
              a low landing) instead of a generic leaf/star. Headline
              ("Amazing!", "Nice progress!", ...) rendered inside the reaction. */}
          <CompanionScoreReaction
            companionType={companion.type}
            score={result.score}
            size={124}
            headlineColor={accent}
          />
          {/* Percentage sits BELOW the headline with a comfortable gap
              (device-test #5: the 56pt digits used to visually crowd the
              headline). Reduced to 44pt + explicit marginTop clears it. */}
          <Text style={[styles.resultPct, { color: accent }]}>{pct}%</Text>
          <Text style={styles.resultScoreText}>
            {result.correctCount} of {result.totalCount} correct
          </Text>
          {result.isNewBestScore && (
            <View style={styles.newBestPill}>
              <Text style={styles.newBestPillText}>🏆  New best score!</Text>
            </View>
          )}
        </View>

        {/* The companion's LINE. It used to sit next to a raw 🐱 emoji, so the
            screen showed three different faces at once — the drawn creature,
            the reaction badge, and this emoji — which is what read as "an
            altogether different companion" (device-test-8). One character per
            screen; the small rig here is the same creature as the hero above.
            The line itself now rotates through the encouragement pool instead
            of repeating one stored sentence. */}
        <View style={styles.companionCelebrationCard}>
          <CompanionCreature
            type={companion.type}
            state={result.score >= 0.5 ? 'happy' : 'caring'}
            size={36}
          />
          <Text style={styles.companionCelebrationText}>{nudge.text}</Text>
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
    </AuroraBackground>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  contentContainer: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.base,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  loadingText: {
    ...Typography.preset.body,
    color: A.ink2,
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
    backgroundColor: A.glass,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: A.accent,
    borderRadius: 4,
  },
  progressText: {
    ...Typography.preset.captionBold,
    color: A.ink2,
    minWidth: 40,
    textAlign: 'right',
  },
  companionEncouragement: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: A.glass,
    padding: Spacing.md,
    borderRadius: Spacing.radius.xl,
    marginBottom: Spacing.base,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  companionEncouragementText: {
    ...Typography.preset.body,
    color: A.ink2,
    flex: 1,
    marginLeft: Spacing.md,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  companionEmoji: {
    fontSize: 32,
  },
  questionCard: {
    backgroundColor: A.glass,
    padding: Spacing.cardPaddingLarge,
    borderRadius: Spacing.radius['2xl'],
    marginBottom: Spacing.base,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 22,
    elevation: 6,
  },
  questionText: {
    ...Typography.preset.h4,
    color: A.ink,
    marginBottom: Spacing.lg,
    lineHeight: 28,
  },
  optionsContainer: {
    gap: Spacing.sm,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: A.glass,
    padding: Spacing.cardPadding,
    borderRadius: Spacing.radius.xl,
    borderWidth: 2,
    borderColor: A.edge,
  },
  optionPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  optionCorrect: {
    backgroundColor: 'rgba(111,230,168,0.16)',
    borderColor: A.success,
  },
  optionWrong: {
    backgroundColor: 'rgba(255,122,138,0.16)',
    borderColor: A.error,
  },
  optionText: {
    ...Typography.preset.body,
    color: A.ink,
    flex: 1,
  },
  optionTextCorrect: {
    ...Typography.preset.bodySemibold,
    color: A.success,
  },
  optionTextWrong: {
    color: A.error,
  },
  optionCheckmark: {
    ...Typography.preset.h4,
    color: A.success,
    marginLeft: Spacing.md,
  },
  optionWrongmark: {
    ...Typography.preset.h4,
    color: A.error,
    marginLeft: Spacing.md,
  },
  explanationCard: {
    padding: Spacing.cardPadding,
    borderRadius: Spacing.radius.xl,
    marginBottom: Spacing.base,
    borderLeftWidth: 4,
  },
  explanationCorrect: {
    backgroundColor: 'rgba(111,230,168,0.10)',
    borderLeftColor: A.success,
  },
  explanationWrong: {
    backgroundColor: 'rgba(255,122,138,0.10)',
    borderLeftColor: A.error,
  },
  explanationEmoji: {
    fontSize: 32,
    marginBottom: Spacing.sm,
  },
  explanationText: {
    ...Typography.preset.body,
    color: A.ink,
    lineHeight: 24,
    marginBottom: Spacing.md,
  },
  companionReactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: A.edge,
  },
  companionReactionEmoji: {
    fontSize: 20,
    marginRight: Spacing.sm,
  },
  companionReactionText: {
    ...Typography.preset.caption,
    color: A.ink2,
    flex: 1,
    fontStyle: 'italic',
  },
  // ─── Rich answer feedback panel (fills the empty space) ─────────
  feedbackPanel: {
    alignItems: 'center',
    padding: Spacing.cardPaddingLarge,
    borderRadius: Spacing.radius['2xl'],
    borderWidth: 1,
    marginBottom: Spacing.base,
    gap: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 6,
  },
  feedbackCorrect: {
    backgroundColor: 'rgba(111,230,168,0.10)',
    borderColor: 'rgba(111,230,168,0.35)',
  },
  feedbackWrong: {
    // Warm gold, never alarming red — a miss stays encouraging.
    backgroundColor: 'rgba(255,194,77,0.09)',
    borderColor: 'rgba(255,194,77,0.32)',
  },
  feedbackExplainRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  feedbackExplainText: {
    ...Typography.preset.body,
    color: A.ink,
    flex: 1,
    lineHeight: 24,
  },
  progressPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Spacing.radius.full,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  progressPillText: {
    ...Typography.preset.captionBold,
    letterSpacing: 0.3,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.sm,
  },
  nextButton: {
    backgroundColor: A.accent,
    height: Spacing.buttonHeight.lg,
    borderRadius: Spacing.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 6,
  },
  nextButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  nextButtonText: {
    ...Typography.preset.button,
    color: A.ground,
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
    fontSize: 44,
    marginTop: Spacing.lg,
    lineHeight: 48,
    fontWeight: '800',
  },
  resultScoreText: {
    ...Typography.preset.body,
    color: A.ink2,
    marginTop: Spacing.xs,
  },
  resultNewBest: {
    ...Typography.preset.bodySemibold,
    color: A.gold,
    marginTop: Spacing.md,
  },
  // Owner ask (device-test #5): make the "new best score" moment feel
  // like a celebration. Gold pill on a warm background reads as a small
  // trophy chip rather than plain text.
  newBestPill: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Spacing.radius.full,
    backgroundColor: `${A.gold}22`,
    borderWidth: 1,
    borderColor: `${A.gold}88`,
  },
  newBestPillText: {
    ...Typography.preset.captionBold,
    color: A.gold,
    letterSpacing: 0.3,
  },
  companionCelebrationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: A.glass,
    padding: Spacing.cardPadding,
    borderRadius: Spacing.radius.xl,
    marginBottom: Spacing.base,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  companionCelebrationText: {
    ...Typography.preset.body,
    color: A.ink,
    flex: 1,
    marginLeft: Spacing.md,
    lineHeight: 24,
  },
  rewardsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: A.glass,
    padding: Spacing.cardPadding,
    borderRadius: Spacing.radius.xl,
    marginBottom: Spacing.sectionGap,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
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
    color: A.ink,
  },
  rewardLabel: {
    ...Typography.preset.caption,
    color: A.ink3,
  },
  rewardDivider: {
    width: 1,
    height: 60,
    backgroundColor: A.edge,
  },
  doneButton: {
    height: Spacing.buttonHeight.lg,
    borderRadius: Spacing.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 6,
  },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    padding: Spacing.xl,
  },
  notFoundEmoji: {
    fontSize: 64,
    marginBottom: Spacing.lg,
  },
  notFoundTitle: {
    ...Typography.preset.h4,
    color: A.ink,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  notFoundButton: {
    backgroundColor: A.accent,
    paddingHorizontal: Spacing['3xl'],
    height: Spacing.buttonHeight.md,
    borderRadius: Spacing.radius.full,
    justifyContent: 'center',
  },
  notFoundButtonText: {
    ...Typography.preset.button,
    color: A.ground,
  },
});