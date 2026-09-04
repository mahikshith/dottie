/**
 * Lesson, as a conversation — where the companion finally does something.
 *
 * Owner, device-test-14: "It should feel like there is a conversation going on
 * between the user and the mascot ... explaining, informing, correcting, acting
 * like a friend for the user. Rather than simply showing the questions and
 * pointing at the answer."
 *
 * ─── THE SHAPE ──────────────────────────────────────────────────────
 *
 *  A chat. The companion is pinned at the top and its FACE is the status
 *  indicator — thinking while it types, proud when you're right, warm when
 *  you're not. Its lines arrive as bubbles on the left; yours echo on the
 *  right. Facts and tips are handed over as cards rather than said, because a
 *  chat bubble is the wrong container for something you'd want to keep.
 *
 *  Every action lives in the bottom third (device-test-10: "you did not bring
 *  them back where the user holds the phone, right under the thumb"). The
 *  transcript scrolls above it; the hands never leave the bottom of the screen.
 *
 * ─── WHERE THE WORDS COME FROM ──────────────────────────────────────
 *
 *  This screen renders. It does not write. Every sentence is chosen by
 *  src/engine/learn/dialogue.ts, which may only sequence vetted curriculum copy
 *  and add contentless connective tissue — asserted, beat by beat across all 77
 *  bundled lessons, by test:dialogue. Nothing here composes a health claim, and
 *  nothing here should ever start.
 *
 * ─── MOTION ─────────────────────────────────────────────────────────
 *
 *  Bubbles enter with FadeInDown + a spring settle; the typing indicator is
 *  three dots on a staggered opacity loop. All transform/opacity, all on the UI
 *  thread, and all skipped under Reduce Motion — where the pacing collapses to
 *  instant so the conversation still works, just without the theatre.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Typography } from '../../../src/constants/typography';
import { Spacing } from '../../../src/constants/spacing';
import {
  AuroraBackground,
  PressableScale,
  CompanionLottie,
  GradientButton,
} from '../../../src/components/ui';
import { useAurora, PHASE_AURORA, A } from '../../../src/theme';
import {
  useUserStore,
  useGamificationStore,
  selectCompanionType,
} from '../../../src/stores';
import { getCompanion } from '../../../src/content/companions';
import { getLesson, getLearningPath, getLessonsForPath } from '../../../src/content/learning-paths';
import { getExercisesForLesson } from '../../../src/content/exercises';
import { getQuizForLesson } from '../../../src/content/quizzes';
import { contentRepository, type LessonProgress } from '../../../src/database/repositories/content.repo';
import { logSilentFailure } from '../../../src/diagnostics/silent-failure';
import { log } from '../../../src/diagnostics/logger';
import { CelebrationDialog, type DialogAction } from '../../../src/components/ui/CelebrationDialog';
import {
  buildLessonScript,
  reactTo,
  type AskStep,
  type Reaction,
  type ScriptStep,
} from '../../../src/engine/learn/dialogue';
import type { CompanionAnim } from '../../../src/content/companion-lottie';

// How long the companion "types" before a bubble lands. Long enough to read as
// deliberate, short enough that nobody taps ahead out of impatience.
const TYPING_MS = 620;
const TYPING_MS_LONG = 900;

/** One rendered turn in the transcript. */
type Turn =
  | { key: string; who: 'companion'; text: string }
  | { key: string; who: 'user'; text: string; correct: boolean }
  | { key: string; who: 'card'; text: string; emoji?: string; variant: string }
  | { key: string; who: 'explain'; text: string; emoji?: string; correct: boolean };

export default function LessonChatScreen(): JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useAurora();
  const reduce = useReducedMotion();
  const { id } = useLocalSearchParams<{ id: string }>();

  const userId = useUserStore((s) => s.userId);
  const displayName = useUserStore((s) => s.user?.displayName ?? null);
  const companionType = useUserStore(selectCompanionType);
  const companion = getCompanion(companionType);

  const lesson = useMemo(() => (id ? getLesson(id) : null), [id]);
  const path = useMemo(() => (lesson ? getLearningPath(lesson.pathId) : null), [lesson]);

  const script = useMemo(() => {
    if (!lesson) return null;
    return buildLessonScript({
      lesson,
      exercises: getExercisesForLesson(lesson.id),
      quiz: getQuizForLesson(lesson.id),
      companionName: companion.name,
      userName: displayName,
    });
  }, [lesson, companion.name, displayName]);

  // ─── Conversation state ─────────────────────────────────────────
  const [turns, setTurns] = useState<Turn[]>([]);
  const [cursor, setCursor] = useState(0);
  const [typing, setTyping] = useState(false);
  const [pendingAsk, setPendingAsk] = useState<AskStep | null>(null);
  const [attempt, setAttempt] = useState(1);
  const [streak, setStreak] = useState(0);
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const [finished, setFinished] = useState(false);
  const [expression, setExpression] = useState<CompanionAnim>('encourage');
  const [dialog, setDialog] = useState<{
    emoji: string;
    title: string;
    body: string;
    actions: DialogAction[];
  } | null>(null);
  const [saving, setSaving] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const askedRef = useRef(0);
  /** The ask the user is currently reacting to — survives the reaction beat. */
  const pendingAskRef = useRef<AskStep | null>(null);
  /**
   * Steps already spoken. "Tap to hurry me along" races the typing timer: if
   * the timer fired first, the tap would otherwise say the same line twice.
   * Cheaper and more honest than trying to win the race.
   */
  const playedRef = useRef<Set<string>>(new Set());

  // Clear any pending typing timer on unmount — a setState after teardown is
  // the classic source of the "screen froze" reports.
  useEffect(
    () => () => {
      for (const t of timers.current) clearTimeout(t);
      timers.current = [];
    },
    []
  );

  /** Speak a step exactly once, whichever path got here first. */
  const emit = useCallback((step: ScriptStep) => {
    if (playedRef.current.has(step.id)) return false;
    playedRef.current.add(step.id);
    setTurns((t) => [...t, stepToTurn(step)]);
    if (step.kind === 'say' || step.kind === 'finish') setExpression(step.expression);
    if (step.kind === 'finish') setFinished(true);
    return true;
  }, []);

  const later = useCallback(
    (fn: () => void, ms: number) => {
      if (reduce) {
        fn();
        return;
      }
      const t = setTimeout(fn, ms);
      timers.current.push(t);
    },
    [reduce]
  );

  // ─── Mark in-progress on mount ──────────────────────────────────
  useEffect(() => {
    if (!userId || !lesson) return;
    contentRepository
      .getLessonProgress(userId, lesson.id)
      .then((existing) => {
        if (existing) return;
        return contentRepository.saveLessonProgress(userId, {
          lessonId: lesson.id,
          pathId: lesson.pathId,
          status: 'in_progress',
          startedAt: new Date().toISOString(),
          completedAt: null,
          quizScore: null,
          xpEarned: 0,
          gemsEarned: 0,
        });
      })
      .catch((err) => logSilentFailure('lessonChat.progress', err));
  }, [userId, lesson]);

  // ─── Advance the script ─────────────────────────────────────────
  //
  // One step at a time. Non-question steps play automatically with a typing
  // beat; a question stops the tape and waits for a tap.
  const play = useCallback(
    (index: number) => {
      if (!script) return;
      const step = script.steps[index];
      if (!step) return;

      if (step.kind === 'ask') {
        setTyping(true);
        setExpression('idle');
        later(() => {
          setTyping(false);
          if (!playedRef.current.has(step.id)) {
            playedRef.current.add(step.id);
            setTurns((t) => [
              ...t,
              { key: `${step.id}_lead`, who: 'companion', text: step.lead },
              { key: `${step.id}_prompt`, who: 'companion', text: step.prompt },
            ]);
          }
          setPendingAsk(step);
          setAttempt(1);
          setExpression('encourage');
        }, TYPING_MS);
        return;
      }

      setTyping(true);
      later(() => {
        setTyping(false);
        emit(step);
        setCursor(index + 1);
      }, step.kind === 'show' ? TYPING_MS_LONG : TYPING_MS);
    },
    [script, later, emit]
  );

  // Kick off, and keep playing while the tape isn't waiting on the user.
  useEffect(() => {
    if (!script || pendingAsk || reaction || finished) return;
    if (cursor >= script.steps.length) return;
    play(cursor);
    // `play` sets the cursor itself for auto-advancing steps; for an `ask` it
    // deliberately does not, so this effect doesn't re-fire under it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, script, pendingAsk, reaction, finished]);

  // Keep the newest turn in view.
  useEffect(() => {
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: !reduce }), 60);
    return () => clearTimeout(t);
  }, [turns.length, typing, pendingAsk, reaction, reduce]);

  // ─── Answering ──────────────────────────────────────────────────
  const onAnswer = (optionIndex: number) => {
    if (!pendingAsk) return;
    pendingAskRef.current = pendingAsk;
    const correct = optionIndex === pendingAsk.correctIndex;
    Haptics.impactAsync(
      correct ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium
    ).catch(() => {});
    log.tap('lessonChat.answer', { correct, source: pendingAsk.source });

    const chosen = pendingAsk.options[optionIndex]!;
    setTurns((t) => [
      ...t,
      { key: `${pendingAsk.id}_a${attempt}`, who: 'user', text: chosen.label, correct },
    ]);

    const r = reactTo({
      correct,
      attempt,
      streak,
      explanation: pendingAsk.explanation,
      explanationEmoji: pendingAsk.explanationEmoji,
      seed: pendingAsk.id,
      index: askedRef.current,
    });
    askedRef.current += 1;
    setStreak(correct ? streak + 1 : 0);
    setPendingAsk(null);
    setTyping(true);

    later(() => {
      setTyping(false);
      setExpression(r.expression);
      setTurns((t) => [
        ...t,
        { key: `${pendingAsk.id}_r${attempt}`, who: 'companion', text: r.opener },
        {
          key: `${pendingAsk.id}_e${attempt}`,
          who: 'explain',
          text: r.explanation,
          emoji: r.explanationEmoji,
          correct,
        },
      ]);
      setReaction(r);
      if (correct) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      // The ask keeps its place in the script; the cursor moves on only when
      // the user is done with it (continue, or a declined retry).
    }, TYPING_MS);
  };

  const onRetry = () => {
    const ask = pendingAskRef.current;
    if (!ask) return;
    Haptics.selectionAsync().catch(() => {});
    setReaction(null);
    setAttempt(2);
    setExpression('encourage');
    setTurns((t) => [
      ...t,
      { key: `${ask.id}_again`, who: 'companion', text: 'Go on then — one more look.' },
    ]);
    setPendingAsk(ask);
  };

  const onContinue = () => {
    Haptics.selectionAsync().catch(() => {});
    setReaction(null);
    pendingAskRef.current = null;
    setCursor((c) => c + 1);
  };

  // ─── Finishing ──────────────────────────────────────────────────
  const onFinish = async () => {
    if (!userId || !lesson || !path || saving) return;
    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try {
      const existing = await contentRepository.getLessonProgress(userId, lesson.id);
      const completed: LessonProgress = {
        lessonId: lesson.id,
        pathId: lesson.pathId,
        status: 'complete',
        startedAt: existing?.startedAt ?? new Date().toISOString(),
        completedAt: new Date().toISOString(),
        quizScore: existing?.quizScore ?? null,
        xpEarned: lesson.xpReward,
        gemsEarned: lesson.gemReward,
      };
      const alreadyDone = existing?.status === 'complete';
      if (!alreadyDone) {
        await contentRepository.saveLessonProgress(userId, completed);
        const xp = await useGamificationStore
          .getState()
          .awardXp('lesson_complete', { overrideAmount: lesson.xpReward });
        const gems = await useGamificationStore.getState().earnGems('quiz_complete');
        setDialog({
          emoji: '✨',
          title: 'That was a good chat',
          body: `+${xp.xpAwarded} XP · +${gems.gemsAwarded}💎`,
          actions: nextActions(),
        });
      } else {
        setDialog({
          emoji: '🌟',
          title: 'Revisited',
          body: 'You already had this one — no double XP, but the words still count.',
          actions: nextActions(),
        });
      }
    } catch (err) {
      logSilentFailure('lessonChat.complete', err);
      setDialog({
        emoji: '😅',
        title: "That didn't save",
        body: "I couldn't save your progress just now. The lesson still happened.",
        actions: [{ label: 'OK', onPress: () => { setDialog(null); router.back(); } }],
      });
    } finally {
      setSaving(false);
    }
  };

  function nextActions(): DialogAction[] {
    const quiz = lesson ? getQuizForLesson(lesson.id) : null;
    const actions: DialogAction[] = [];
    if (quiz) {
      actions.push({
        label: 'Take the quiz →',
        onPress: () => {
          setDialog(null);
          router.replace(`/quiz/${quiz.id}`);
        },
      });
    }
    actions.push({
      label: quiz ? 'Later' : 'Nice',
      variant: quiz ? 'ghost' : undefined,
      onPress: () => {
        setDialog(null);
        router.back();
      },
    });
    return actions;
  }

  // ─── Not found ──────────────────────────────────────────────────
  if (!lesson || !script) {
    return (
      <AuroraBackground>
        <StatusBar style="light" />
        <Stack.Screen options={{ headerShown: true, title: 'Lesson', headerStyle: { backgroundColor: palette.ground }, headerTintColor: palette.ink }} />
        <View style={styles.missing}>
          <Text style={[styles.missingText, { color: palette.ink2 }]}>
            That lesson isn&apos;t here any more.
          </Text>
        </View>
      </AuroraBackground>
    );
  }

  const answered = askedRef.current;
  const progressPct =
    script.questionCount > 0
      ? Math.min(1, answered / script.questionCount)
      : Math.min(1, cursor / Math.max(1, script.steps.length - 1));

  return (
    <AuroraBackground>
      <StatusBar style="light" />
      {/* The root stack runs headerShown:false, so this screen opts in — that
          header is the back affordance, and a chat you cannot leave is a trap. */}
      <Stack.Screen
        options={{
          headerShown: true,
          title: path?.title ?? 'Lesson',
          headerStyle: { backgroundColor: palette.ground },
          headerTintColor: palette.ink,
          headerBackTitle: 'Back',
        }}
      />

      {/* The companion, pinned. Its face IS the status indicator. */}
      <View style={[styles.head, { paddingTop: Spacing.md }]}>
        <CompanionLottie type={companionType} state={expression} size={78} />
        <View style={styles.headText}>
          <Text style={[styles.headName, { color: palette.ink }]}>{companion.name}</Text>
          <Text style={[styles.headLesson, { color: palette.ink3 }]} numberOfLines={1}>
            {lesson.emoji} {lesson.title}
          </Text>
          <View style={[styles.progressTrack, { backgroundColor: palette.glass.bg }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round(progressPct * 100)}%`, backgroundColor: palette.accent },
              ]}
            />
          </View>
        </View>
      </View>

      {/* The transcript. */}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {turns.map((turn) => (
          <TurnBubble key={turn.key} turn={turn} palette={palette} reduce={reduce} />
        ))}
        {typing ? <TypingDots palette={palette} reduce={reduce} /> : null}
      </ScrollView>

      {/* Everything you tap lives down here, under the thumb (device-test-10). */}
      <Animated.View
        layout={reduce ? undefined : LinearTransition.duration(220)}
        style={[styles.dock, { paddingBottom: insets.bottom + Spacing.md }]}
      >
        {pendingAsk ? (
          <View style={styles.options}>
            {pendingAsk.options.map((option, i) => (
              <PressableScale
                key={`${pendingAsk.id}_o${i}`}
                onPress={() => onAnswer(i)}
                haptic="none"
                scaleTo={0.97}
                style={[
                  styles.option,
                  { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
                ]}
                accessibilityRole="button"
                accessibilityLabel={option.label}
              >
                {option.emoji ? <Text style={styles.optionEmoji}>{option.emoji}</Text> : null}
                <Text style={[styles.optionText, { color: palette.ink }]}>{option.label}</Text>
              </PressableScale>
            ))}
          </View>
        ) : reaction ? (
          <View style={styles.reactionRow}>
            {reaction.offerRetry ? (
              <>
                <GradientButton label="Try again" onPress={onRetry} />
                <PressableScale
                  onPress={onContinue}
                  haptic="none"
                  style={styles.ghost}
                  accessibilityRole="button"
                  accessibilityLabel="Move on to the next part"
                >
                  <Text style={[styles.ghostText, { color: palette.ink3 }]}>Move on</Text>
                </PressableScale>
              </>
            ) : (
              <GradientButton
                label={reaction.aside ?? 'Keep going'}
                onPress={onContinue}
              />
            )}
          </View>
        ) : finished ? (
          <View style={styles.reactionRow}>
            <GradientButton
              label={saving ? 'Saving…' : 'Finish'}
              leadingEmoji="✨"
              onPress={onFinish}
              loading={saving}
              disabled={saving}
            />
          </View>
        ) : (
          <View style={styles.readingRow}>
            <PressableScale
              onPress={() => {
                // Tap-ahead: the pacing is a courtesy, not a gate.
                Haptics.selectionAsync().catch(() => {});
                for (const t of timers.current) clearTimeout(t);
                timers.current = [];
                setTyping(false);
                const step = script.steps[cursor];
                if (step && step.kind !== 'ask') {
                  emit(step);
                  setCursor(cursor + 1);
                }
              }}
              haptic="none"
              style={styles.ghost}
              accessibilityRole="button"
              accessibilityLabel="Skip ahead"
            >
              <Text style={[styles.ghostText, { color: palette.ink3 }]}>Tap to hurry me along</Text>
            </PressableScale>
            <PressableScale
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                router.replace(`/lesson/${lesson.id}`);
              }}
              haptic="none"
              style={styles.ghost}
              accessibilityRole="button"
              accessibilityLabel="Read this lesson as an article instead"
            >
              <Text style={[styles.ghostText, { color: palette.accent }]}>Read it instead</Text>
            </PressableScale>
          </View>
        )}
      </Animated.View>

      {dialog ? (
        <CelebrationDialog
          visible
          emoji={dialog.emoji}
          title={dialog.title}
          body={dialog.body}
          actions={dialog.actions}
          onRequestClose={() => setDialog(null)}
        />
      ) : null}
    </AuroraBackground>
  );
}

// ─── SUBCOMPONENTS ───────────────────────────────────────────────────

type Palette = ReturnType<typeof useAurora>['palette'];

function stepToTurn(step: ScriptStep): Turn {
  if (step.kind === 'show') {
    return { key: step.id, who: 'card', text: step.text, emoji: step.emoji, variant: step.variant };
  }
  if (step.kind === 'finish') return { key: step.id, who: 'companion', text: step.text };
  if (step.kind === 'say') return { key: step.id, who: 'companion', text: step.text };
  // An ask never reaches here — it is turned into two bubbles by `play`.
  return { key: step.id, who: 'companion', text: step.prompt };
}

function TurnBubble({
  turn,
  palette,
  reduce,
}: {
  turn: Turn;
  palette: Palette;
  reduce: boolean;
}): JSX.Element {
  const entering = reduce ? FadeIn.duration(120) : FadeInDown.duration(320).springify().damping(17);

  if (turn.who === 'user') {
    return (
      <Animated.View entering={entering} style={styles.userRow}>
        <View
          style={[
            styles.userBubble,
            {
              backgroundColor: turn.correct ? `${A.success}22` : `${A.gold}1F`,
              borderColor: turn.correct ? `${A.success}66` : `${A.gold}66`,
            },
          ]}
        >
          <Text style={[styles.userText, { color: palette.ink }]}>{turn.text}</Text>
        </View>
      </Animated.View>
    );
  }

  if (turn.who === 'card') {
    const hue =
      turn.variant === 'tip' ? A.gold : turn.variant === 'callout' ? A.accent2 : PHASE_AURORA.follicular;
    return (
      <Animated.View entering={entering} style={styles.cardRow}>
        <View style={[styles.card, { borderColor: `${hue}66`, backgroundColor: `${hue}14` }]}>
          {turn.emoji ? <Text style={styles.cardEmoji}>{turn.emoji}</Text> : null}
          <Text style={[styles.cardText, { color: palette.ink }]}>{turn.text}</Text>
        </View>
      </Animated.View>
    );
  }

  if (turn.who === 'explain') {
    // The vetted explanation, given the same visual weight whether the user got
    // there or not — the point is the understanding, not the score.
    const hue = turn.correct ? A.success : A.accent2;
    return (
      <Animated.View entering={entering} style={styles.cardRow}>
        <View style={[styles.explain, { borderColor: `${hue}55`, backgroundColor: `${hue}12` }]}>
          <Text style={styles.cardEmoji}>{turn.emoji ?? '💡'}</Text>
          <Text style={[styles.explainText, { color: palette.ink }]}>{turn.text}</Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={entering} style={styles.companionRow}>
      <View
        style={[
          styles.companionBubble,
          { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
        ]}
      >
        <Text style={[styles.companionText, { color: palette.ink }]}>{turn.text}</Text>
      </View>
    </Animated.View>
  );
}

/** Three dots, staggered. The only thing on screen while the companion thinks. */
function TypingDots({ palette, reduce }: { palette: Palette; reduce: boolean }): JSX.Element {
  return (
    <View style={styles.companionRow}>
      <View
        style={[
          styles.typing,
          { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
        ]}
      >
        {[0, 1, 2].map((i) => (
          <Dot key={i} delay={i * 160} color={palette.ink3} reduce={reduce} />
        ))}
      </View>
    </View>
  );
}

function Dot({
  delay,
  color,
  reduce,
}: {
  delay: number;
  color: string;
  reduce: boolean;
}): JSX.Element {
  const o = useSharedValue(0.35);
  useEffect(() => {
    if (reduce) {
      o.value = 0.6;
      return;
    }
    o.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: delay, easing: Easing.linear }),
        withTiming(1, { duration: 260, easing: Easing.out(Easing.quad) }),
        withTiming(0.35, { duration: 260, easing: Easing.in(Easing.quad) })
      ),
      -1,
      false
    );
  }, [delay, o, reduce]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  missingText: { ...Typography.preset.body },

  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: Spacing.sm,
  },
  headText: { flex: 1, gap: 3 },
  headName: { ...Typography.preset.bodySemibold },
  headLesson: { ...Typography.preset.caption, fontSize: 11 },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 4 },
  progressFill: { height: '100%', borderRadius: 2 },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },

  companionRow: { alignItems: 'flex-start' },
  companionBubble: {
    maxWidth: '88%',
    borderWidth: 1,
    borderRadius: Spacing.radius.xl,
    borderBottomLeftRadius: Spacing.radius.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  companionText: { ...Typography.preset.body, lineHeight: 22 },

  userRow: { alignItems: 'flex-end' },
  userBubble: {
    maxWidth: '84%',
    borderWidth: 1,
    borderRadius: Spacing.radius.xl,
    borderBottomRightRadius: Spacing.radius.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  userText: { ...Typography.preset.bodySemibold },

  cardRow: { alignItems: 'flex-start' },
  card: {
    maxWidth: '92%',
    flexDirection: 'row',
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Spacing.radius.xl,
    padding: Spacing.base,
  },
  cardEmoji: { fontSize: 18 },
  cardText: { ...Typography.preset.body, flex: 1, lineHeight: 22 },
  explain: {
    maxWidth: '92%',
    flexDirection: 'row',
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Spacing.radius.xl,
    padding: Spacing.base,
  },
  explainText: { ...Typography.preset.body, flex: 1, lineHeight: 22 },

  typing: {
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderRadius: Spacing.radius.full,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },

  dock: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  options: { gap: Spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Spacing.radius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.base,
  },
  optionEmoji: { fontSize: 18 },
  optionText: { ...Typography.preset.body, flex: 1 },

  reactionRow: { gap: Spacing.sm },
  readingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ghost: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm },
  ghostText: { ...Typography.preset.caption },
});
