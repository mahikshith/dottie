/**
 * Dottie — ExercisePlayer (Learn Quest · design-v2)
 *
 * The interactive UI for the 5 exercise types, driving the pure exercise-engine
 * (`renderExercise` / `checkExerciseAnswer`). One player sequences a lesson's
 * exercises with the Duolingo loop: build an answer → Check → instant grade +
 * companion reaction + explanation → Next. Aurora-themed; the companion is a
 * `<CompanionLottie>` (emoji today, illustrated Lottie when art lands).
 *
 * ─── ENGINEERING NOTES (decisions made in-flight) ───────────────────
 *
 *  • This is an aurora-native component. The existing lesson READER + quiz
 *    screens are still on the cream theme; rather than retheme a working screen
 *    blind, exercises live on their own aurora screen (app/exercise/[lessonId]),
 *    mirroring how the quiz is its own screen. No regression to the reader.
 *  • `order` is tap-to-sequence (tap items in order, tap to undo), not
 *    drag-reorder — far more robust to ship unverified; drag is a later upgrade.
 *  • Grading runs on-device via the engine (this app has no server; the quiz
 *    engine grades on-device too). The rendered model is still shuffled so
 *    options never appear in answer order.
 *  • Reduce-Motion + haptics come from the shared primitives / expo-haptics.
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device). Feel-check the loop on a Node machine.
 */

import { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { PressableScale, CompanionLottie } from '../ui';
import { useAurora } from '../../theme';
import {
  renderExercise,
  checkExerciseAnswer,
  type RenderedExercise,
  type ExerciseFeedback,
} from '../../engine/content';
import type { Exercise, ExerciseAnswer, CompanionType } from '../../types/content.types';
import type { DialogueContext } from '../../types/companion.types';

// ─── PUBLIC PROPS ────────────────────────────────────────────────────

export interface ExerciseSummary {
  total: number;
  correct: number;
  xpAwarded: number;
  gemsAwarded: number;
}

export interface ExercisePlayerProps {
  exercises: Exercise[];
  companionType: CompanionType;
  /** Built by the screen via `buildContext(...)` — carries phase/streak voice. */
  context: DialogueContext;
  /** Called once when the last exercise's feedback is dismissed. */
  onFinish: (summary: ExerciseSummary) => void;
}

// ─── PLAYER ──────────────────────────────────────────────────────────

export function ExercisePlayer({
  exercises,
  companionType,
  context,
  onFinish,
}: ExercisePlayerProps): JSX.Element {
  const { palette } = useAurora();
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<ExerciseAnswer | null>(null);
  const [feedback, setFeedback] = useState<ExerciseFeedback | null>(null);
  const [summary, setSummary] = useState<ExerciseSummary>({
    total: exercises.length,
    correct: 0,
    xpAwarded: 0,
    gemsAwarded: 0,
  });

  const exercise = exercises[index];
  // Shuffle once per exercise (stable across re-renders of the same one).
  const rendered = useMemo(
    () => (exercise ? renderExercise(exercise) : null),
    [exercise?.id] // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (!exercise || !rendered) {
    return <View />;
  }

  const isReviewing = feedback !== null;
  const isLast = index >= exercises.length - 1;
  const progress = (index + (isReviewing ? 1 : 0)) / exercises.length;

  const onCheck = () => {
    if (!answer || isReviewing) return;
    const fb = checkExerciseAnswer(exercise, answer, companionType, context);
    Haptics.notificationAsync(
      fb.correct
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning
    ).catch(() => {});
    setFeedback(fb);
    setSummary((s) => ({
      total: s.total,
      correct: s.correct + (fb.correct ? 1 : 0),
      xpAwarded: s.xpAwarded + fb.xpAwarded,
      gemsAwarded: s.gemsAwarded + fb.gemsAwarded,
    }));
  };

  const onNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (isLast) {
      onFinish(summary);
      return;
    }
    setIndex((i) => i + 1);
    setAnswer(null);
    setFeedback(null);
  };

  const companionState = !feedback ? 'encourage' : feedback.correct ? 'celebrate' : 'cozy';

  return (
    <View style={styles.root}>
      {/* Progress */}
      <View style={styles.progressRow}>
        <View style={[styles.progressTrack, { backgroundColor: palette.glass.edge }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.max(6, Math.round(progress * 100))}%`, backgroundColor: palette.accent },
            ]}
          />
        </View>
        <Text style={[styles.progressText, { color: palette.ink3 }]}>
          {index + 1}/{exercises.length}
        </Text>
      </View>

      {/* Prompt */}
      <Animated.Text
        key={`prompt_${exercise.id}`}
        entering={FadeInDown.duration(360)}
        style={[styles.prompt, { color: palette.ink }]}
      >
        {rendered.prompt}
      </Animated.Text>

      {/* The interactive body — one renderer per type */}
      <Animated.View key={`body_${exercise.id}`} entering={FadeIn.duration(300)} style={styles.body}>
        <ExerciseBody rendered={rendered} disabled={isReviewing} onAnswer={setAnswer} />
      </Animated.View>

      {/* Feedback card */}
      {feedback && (
        <Animated.View
          entering={FadeInDown.duration(320)}
          style={[
            styles.feedback,
            {
              backgroundColor: palette.glass.bg,
              borderColor: feedback.correct ? '#6FE6A8' : palette.accent2,
            },
          ]}
        >
          <View style={styles.feedbackHead}>
            <CompanionLottie type={companionType} state={companionState} size={44} loop={false} />
            <Text style={[styles.feedbackVerdict, { color: feedback.correct ? '#6FE6A8' : palette.ink }]}>
              {feedback.correct
                ? 'Correct!'
                : feedback.correctParts > 0
                  ? `Almost — ${feedback.correctParts}/${feedback.totalParts}`
                  : 'Not quite'}
            </Text>
          </View>
          <Text style={[styles.feedbackExplain, { color: palette.ink2 }]}>
            {feedback.explanationEmoji} {feedback.explanation}
          </Text>
        </Animated.View>
      )}

      {/* CTA */}
      <View style={styles.ctaRow}>
        {!feedback ? (
          <ThemedCTA
            label="Check"
            disabled={answer === null}
            onPress={onCheck}
            fill={palette.accent}
            ink={palette.ground}
            mutedInk={palette.ink3}
            mutedBg={palette.glass.bg}
          />
        ) : (
          <ThemedCTA
            label={isLast ? 'Finish' : 'Continue'}
            disabled={false}
            onPress={onNext}
            fill={feedback.correct ? '#6FE6A8' : palette.accent}
            ink={palette.ground}
            mutedInk={palette.ink3}
            mutedBg={palette.glass.bg}
          />
        )}
      </View>
    </View>
  );
}

// ─── CTA ─────────────────────────────────────────────────────────────

function ThemedCTA({
  label,
  disabled,
  onPress,
  fill,
  ink,
  mutedInk,
  mutedBg,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  fill: string;
  ink: string;
  mutedInk: string;
  mutedBg: string;
}): JSX.Element {
  return (
    <PressableScale
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      haptic={disabled ? 'none' : 'light'}
      scaleTo={0.97}
      style={[
        styles.cta,
        { backgroundColor: disabled ? mutedBg : fill },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Text style={[styles.ctaText, { color: disabled ? mutedInk : ink }]}>{label}</Text>
    </PressableScale>
  );
}

// ─── BODY DISPATCH ───────────────────────────────────────────────────

function ExerciseBody({
  rendered,
  disabled,
  onAnswer,
}: {
  rendered: RenderedExercise;
  disabled: boolean;
  onAnswer: (a: ExerciseAnswer | null) => void;
}): JSX.Element {
  switch (rendered.type) {
    case 'pairs':
      return <PairsBody rendered={rendered} disabled={disabled} onAnswer={onAnswer} />;
    case 'order':
      return <OrderBody rendered={rendered} disabled={disabled} onAnswer={onAnswer} />;
    case 'fill_blank':
      return <FillBlankBody rendered={rendered} disabled={disabled} onAnswer={onAnswer} />;
    case 'tap_diagram':
      return <TapDiagramBody rendered={rendered} disabled={disabled} onAnswer={onAnswer} />;
    case 'tap_word':
      return <TapWordBody rendered={rendered} disabled={disabled} onAnswer={onAnswer} />;
  }
}

// ─── PAIRS ───────────────────────────────────────────────────────────

function PairsBody({
  rendered,
  disabled,
  onAnswer,
}: {
  rendered: Extract<RenderedExercise, { type: 'pairs' }>;
  disabled: boolean;
  onAnswer: (a: ExerciseAnswer | null) => void;
}): JSX.Element {
  const { palette } = useAurora();
  const [assign, setAssign] = useState<(string | null)[]>(() => rendered.leftItems.map(() => null));
  const [sel, setSel] = useState<number | null>(null);

  const commit = (next: (string | null)[]) => {
    setAssign(next);
    onAnswer(next.every((v) => v !== null) ? { type: 'pairs', matched: next as string[] } : null);
  };

  const tapLeft = (i: number) => {
    if (disabled) return;
    if (assign[i] !== null) {
      const next = [...assign];
      next[i] = null;
      commit(next);
      setSel(i);
    } else {
      setSel(sel === i ? null : i);
    }
  };
  const tapRight = (right: string) => {
    if (disabled || sel === null) return;
    const next = [...assign];
    next[sel] = right;
    commit(next);
    setSel(null);
  };

  const usedRights = new Set(assign.filter((v): v is string => v !== null));

  return (
    <View style={styles.pairsRow}>
      <View style={styles.pairsCol}>
        {rendered.leftItems.map((left, i) => {
          const active = sel === i;
          const done = assign[i] !== null;
          return (
            <PressableScale
              key={`l_${i}`}
              onPress={() => tapLeft(i)}
              haptic="selection"
              disabled={disabled}
              style={[
                styles.pairChip,
                { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
                active && { borderColor: palette.accent, backgroundColor: `${palette.accent}22` },
                done && { borderColor: '#6FE6A8' },
              ]}
              accessibilityRole="button"
              accessibilityLabel={left}
            >
              <Text style={[styles.pairText, { color: palette.ink }]}>{left}</Text>
              {done && <Text style={[styles.pairAssigned, { color: palette.ink3 }]}>{assign[i]}</Text>}
            </PressableScale>
          );
        })}
      </View>
      <View style={styles.pairsCol}>
        {rendered.rightItems.map((right, i) => {
          const used = usedRights.has(right);
          return (
            <PressableScale
              key={`r_${i}`}
              onPress={() => tapRight(right)}
              haptic="selection"
              disabled={disabled || used || sel === null}
              style={[
                styles.pairChip,
                { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
                used && { opacity: 0.4 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={right}
            >
              <Text style={[styles.pairText, { color: palette.ink }]}>{right}</Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

// ─── ORDER (tap-to-sequence) ─────────────────────────────────────────

function OrderBody({
  rendered,
  disabled,
  onAnswer,
}: {
  rendered: Extract<RenderedExercise, { type: 'order' }>;
  disabled: boolean;
  onAnswer: (a: ExerciseAnswer | null) => void;
}): JSX.Element {
  const { palette } = useAurora();
  const [seq, setSeq] = useState<string[]>([]);

  const commit = (next: string[]) => {
    setSeq(next);
    onAnswer(next.length === rendered.items.length ? { type: 'order', order: next } : null);
  };
  const add = (item: string) => {
    if (disabled || seq.includes(item)) return;
    commit([...seq, item]);
  };
  const removeAt = (i: number) => {
    if (disabled) return;
    commit(seq.filter((_, idx) => idx !== i));
  };

  const remaining = rendered.items.filter((it) => !seq.includes(it));

  return (
    <View>
      <Text style={[styles.subtle, { color: palette.ink3 }]}>Tap in order · tap a step to remove</Text>
      <View style={styles.seqList}>
        {seq.map((item, i) => (
          <PressableScale
            key={`s_${item}`}
            onPress={() => removeAt(i)}
            haptic="selection"
            disabled={disabled}
            style={[styles.seqItem, { backgroundColor: `${palette.accent}1F`, borderColor: palette.accent }]}
            accessibilityRole="button"
            accessibilityLabel={`Step ${i + 1}: ${item}`}
          >
            <View style={[styles.seqNum, { backgroundColor: palette.accent }]}>
              <Text style={[styles.seqNumText, { color: palette.ground }]}>{i + 1}</Text>
            </View>
            <Text style={[styles.pairText, { color: palette.ink }]}>{item}</Text>
          </PressableScale>
        ))}
        {seq.length === 0 && (
          <Text style={[styles.subtle, { color: palette.ink3 }]}>Your order will appear here…</Text>
        )}
      </View>
      <View style={styles.poolRow}>
        {remaining.map((item) => (
          <PressableScale
            key={`p_${item}`}
            onPress={() => add(item)}
            haptic="selection"
            disabled={disabled}
            style={[styles.poolChip, { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge }]}
            accessibilityRole="button"
            accessibilityLabel={item}
          >
            <Text style={[styles.pairText, { color: palette.ink }]}>{item}</Text>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}

// ─── FILL BLANK ──────────────────────────────────────────────────────

function FillBlankBody({
  rendered,
  disabled,
  onAnswer,
}: {
  rendered: Extract<RenderedExercise, { type: 'fill_blank' }>;
  disabled: boolean;
  onAnswer: (a: ExerciseAnswer | null) => void;
}): JSX.Element {
  const { palette } = useAurora();
  const [choices, setChoices] = useState<(string | null)[]>(() => rendered.blankPools.map(() => null));
  const [active, setActive] = useState(0);

  const commit = (next: (string | null)[]) => {
    setChoices(next);
    onAnswer(next.every((v) => v !== null) ? { type: 'fill_blank', choices: next as string[] } : null);
  };
  const pick = (word: string) => {
    if (disabled) return;
    const next = [...choices];
    next[active] = word;
    commit(next);
    const nextEmpty = next.findIndex((v) => v === null);
    if (nextEmpty >= 0) setActive(nextEmpty);
  };

  // Render the sentence, splitting on {{i}} placeholders into text + blank slots.
  const parts = rendered.sentence.split(/(\{\{\d+\}\})/g).filter((p) => p.length > 0);

  return (
    <View>
      <View style={styles.sentenceWrap}>
        {parts.map((part, i) => {
          const m = /^\{\{(\d+)\}\}$/.exec(part);
          if (m) {
            const bi = Number(m[1]);
            const val = choices[bi] ?? null;
            const isActive = active === bi;
            return (
              <PressableScale
                key={`b_${i}`}
                onPress={() => !disabled && setActive(bi)}
                haptic="selection"
                disabled={disabled}
                style={[
                  styles.blank,
                  { borderColor: isActive ? palette.accent : palette.glass.edge },
                  val ? { backgroundColor: `${palette.accent}1F` } : null,
                ]}
                accessibilityRole="button"
                accessibilityLabel={val ?? `Blank ${bi + 1}`}
              >
                <Text style={[styles.blankText, { color: val ? palette.accent : palette.ink3 }]}>
                  {val ?? '＿＿'}
                </Text>
              </PressableScale>
            );
          }
          return (
            <Text key={`t_${i}`} style={[styles.sentenceText, { color: palette.ink }]}>
              {part}
            </Text>
          );
        })}
      </View>

      <Text style={[styles.subtle, { color: palette.ink3 }]}>
        Tap a blank, then choose a word
      </Text>
      <View style={styles.poolRow}>
        {(rendered.blankPools[active] ?? []).map((word) => {
          const chosenHere = choices[active] === word;
          return (
            <PressableScale
              key={`w_${word}`}
              onPress={() => pick(word)}
              haptic="selection"
              disabled={disabled}
              style={[
                styles.poolChip,
                { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
                chosenHere && { borderColor: palette.accent, backgroundColor: `${palette.accent}22` },
              ]}
              accessibilityRole="button"
              accessibilityLabel={word}
            >
              <Text style={[styles.pairText, { color: palette.ink }]}>{word}</Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

// ─── TAP DIAGRAM ─────────────────────────────────────────────────────

function TapDiagramBody({
  rendered,
  disabled,
  onAnswer,
}: {
  rendered: Extract<RenderedExercise, { type: 'tap_diagram' }>;
  disabled: boolean;
  onAnswer: (a: ExerciseAnswer | null) => void;
}): JSX.Element {
  const { palette } = useAurora();
  const [picked, setPicked] = useState<number | null>(null);

  const pick = (i: number) => {
    if (disabled) return;
    setPicked(i);
    onAnswer({ type: 'tap_diagram', index: i });
  };

  return (
    <View style={styles.diagramRow}>
      {rendered.options.map((opt, i) => {
        const on = picked === i;
        return (
          <PressableScale
            key={`d_${i}`}
            onPress={() => pick(i)}
            haptic="selection"
            disabled={disabled}
            style={[
              styles.diagramCell,
              { backgroundColor: palette.glass.bg, borderColor: on ? palette.accent : palette.glass.edge },
              on && { backgroundColor: `${palette.accent}22` },
            ]}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
            accessibilityState={{ selected: on }}
          >
            {opt.emoji && <Text style={styles.diagramEmoji}>{opt.emoji}</Text>}
            <Text style={[styles.diagramLabel, { color: palette.ink }]}>{opt.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

// ─── TAP WORD ────────────────────────────────────────────────────────

function TapWordBody({
  rendered,
  disabled,
  onAnswer,
}: {
  rendered: Extract<RenderedExercise, { type: 'tap_word' }>;
  disabled: boolean;
  onAnswer: (a: ExerciseAnswer | null) => void;
}): JSX.Element {
  const { palette } = useAurora();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setSelected(next);
    onAnswer(next.size > 0 ? { type: 'tap_word', tokenIndexes: [...next] } : null);
  };

  return (
    <View style={styles.sentenceWrap}>
      {rendered.tokens.map((tok, i) => {
        const on = selected.has(i);
        return (
          <PressableScale
            key={`tk_${i}`}
            onPress={() => toggle(i)}
            haptic="selection"
            disabled={disabled}
            style={[
              styles.wordChip,
              on && { backgroundColor: `${palette.accent}22`, borderColor: palette.accent },
              !on && { borderColor: 'transparent' },
            ]}
            accessibilityRole="button"
            accessibilityLabel={tok}
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.wordText, { color: on ? palette.accent : palette.ink }]}>{tok}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

// ─── STYLES (layout only — colours inline, palette-driven) ───────────

const styles = StyleSheet.create({
  root: { gap: Spacing.lg },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  progressTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressText: { ...Typography.preset.captionBold, minWidth: 34, textAlign: 'right' },
  prompt: { ...Typography.preset.h4, lineHeight: 28 },
  body: { gap: Spacing.md },
  subtle: { ...Typography.preset.caption, marginBottom: Spacing.sm },

  pairsRow: { flexDirection: 'row', gap: Spacing.md },
  pairsCol: { flex: 1, gap: Spacing.sm },
  pairChip: {
    borderWidth: 1.5,
    borderRadius: Spacing.radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  pairText: { ...Typography.preset.bodySemibold, textAlign: 'center' },
  pairAssigned: { ...Typography.preset.caption, marginTop: 2 },

  seqList: { gap: Spacing.sm, marginBottom: Spacing.md, minHeight: 44 },
  seqItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderRadius: Spacing.radius.lg,
    padding: Spacing.md,
  },
  seqNum: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  seqNumText: { ...Typography.preset.captionBold, fontSize: 12 },
  poolRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  poolChip: {
    borderWidth: 1.5,
    borderRadius: Spacing.radius.full,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
  },

  sentenceWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  sentenceText: { ...Typography.preset.body, lineHeight: 34 },
  blank: {
    borderWidth: 1.5,
    borderRadius: Spacing.radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    minWidth: 64,
    alignItems: 'center',
  },
  blankText: { ...Typography.preset.bodySemibold },

  diagramRow: { flexDirection: 'row', gap: Spacing.sm },
  diagramCell: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: Spacing.radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  diagramEmoji: { fontSize: 26 },
  diagramLabel: { ...Typography.preset.caption, fontWeight: '800', textAlign: 'center' },

  wordChip: {
    borderWidth: 1.5,
    borderRadius: Spacing.radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  wordText: { ...Typography.preset.body },

  feedback: { borderWidth: 1, borderRadius: Spacing.radius['2xl'], padding: Spacing.cardPadding, gap: Spacing.sm },
  feedbackHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  feedbackVerdict: { ...Typography.preset.h4 },
  feedbackExplain: { ...Typography.preset.body, lineHeight: 22 },
  feedbackReaction: { ...Typography.preset.caption, fontStyle: 'italic' },

  ctaRow: { marginTop: Spacing.xs },
  cta: {
    height: Spacing.buttonHeight.lg,
    borderRadius: Spacing.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { ...Typography.preset.button },
});
