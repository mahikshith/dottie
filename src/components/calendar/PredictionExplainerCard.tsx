/**
 * PredictionExplainerCard
 *
 * "How this prediction is made" — the owner-requested card that shows, in the
 * empty space under the Sisterhood bridge on the Calendar tab, HOW Dottie
 * predicts the next period: the ± window, the standard deviation behind it, a
 * confidence read, and a plain-language list of the factors that tightened or
 * widened the estimate. A "Show the science" toggle reveals the Bayesian
 * detail for users who want it.
 *
 * ─── DYNAMIC ────────────────────────────────────────────────────────
 *
 *  Subscribes to `selectPredictionExplanation`, which the cycle store
 *  recomputes on EVERY log/edit. So the moment the user logs a period, edits
 *  the calendar, or changes an input, this card re-renders with the new dates,
 *  window, and reasoning — never a stale snapshot.
 *
 * ─── NON-DIAGNOSTIC ─────────────────────────────────────────────────
 *
 *  Copy comes straight from the pure explainer (explain-prediction.ts), which
 *  is written entirely in "likely / tends to / for some people" language.
 */

import { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { PressableScale, PopOnChange, CompanionBuddy } from '../ui';
import { useAurora } from '../../theme';
import {
  useCycleStore,
  useUserStore,
  selectPredictionExplanation,
  selectCompanionType,
} from '../../stores';
import { PredictionDistributionChart } from './PredictionDistributionChart';
import { CycleLengthHistoryChart } from './CycleLengthHistoryChart';
import { FlowShapeChart } from './FlowShapeChart';
import { explainPrediction } from '../../engine/prediction/explain-prediction';
import {
  buildCycleLengthSeries,
  buildFlowShape,
} from '../../engine/prediction/chart-data';
import type {
  FactorEffect,
  PredictionExplanation,
} from '../../engine/prediction/explain-prediction';
import type { CycleRecord, HealthProfile } from '../../types/cycle.types';

// ─── COMPONENT ───────────────────────────────────────────────────────

export interface PredictionExplainerCardProps {
  /**
   * Whose model this is. Omit for the user.
   *
   * Device-test-16: selecting a sister switched the calendar GRID to her days
   * while every panel underneath stayed the user's, and the screen admitted it
   * in small print. Reading someone else's calendar above your own statistics
   * makes both numbers less trustworthy. When a subject is passed, the card
   * runs the SAME pure explainer and the SAME three charts on her history
   * instead — one component, one set of figures, one definition of correct.
   */
  subject?: {
    name: string;
    cycleHistory: CycleRecord[];
    healthProfile: HealthProfile;
    lastPeriodStart: string | null;
    /** One honest line about how much data her model stands on. */
    dataNote: string;
  } | null;
}

export function PredictionExplainerCard({
  subject = null,
}: PredictionExplainerCardProps = {}): JSX.Element | null {
  const { palette } = useAurora();
  const storeExplanationRaw = useCycleStore(selectPredictionExplanation);
  const userLastPeriodStart = useCycleStore((s) => s.lastPeriodStart);
  const userCycleHistory = useCycleStore((s) => s.cycleHistory);
  // A subject overrides every input; there is no blending of two people's data.
  const storeExplanation = subject ? null : storeExplanationRaw;
  const lastPeriodStart = subject ? subject.lastPeriodStart : userLastPeriodStart;
  const cycleHistory = subject ? subject.cycleHistory : userCycleHistory;
  const predictionErrors = useCycleStore((s) => s.predictionErrors);
  const todayCheckIn = useCycleStore((s) => s.todayCheckIn);
  const user = useUserStore((s) => s.user);
  const companionType = useUserStore(selectCompanionType);
  const [showScience, setShowScience] = useState(false);

  // ─── THE EXPLANATION IS MANDATORY ─────────────────────────────────
  //
  //  Owner, device-test-7: "even after entering the period the explanation is
  //  not showing up and the graphs are not showing up and shows a default
  //  message ... make sure these graph and scientific explanation are
  //  mandatory no matter what and should show up at any cost."
  //
  //  `latestExplanation` is written by the store, so ANY path that leaves it
  //  null — a log that landed on a sister rather than the user, a refresh that
  //  hadn't finished when this mounted, an early return in recomputePrediction
  //  — showed the empty card even though the data to explain was right there.
  //  So the card no longer trusts a single store field: if the store has no
  //  explanation but there IS an anchor period date, it computes one itself
  //  from the same pure function the store uses. Same numbers, no stale gap.
  const explanation = useMemo<PredictionExplanation | null>(() => {
    if (storeExplanation) return storeExplanation;
    if (!user) return null;

    // Anchor = the most recent period start we can find anywhere in the store.
    const anchor = lastPeriodStart ?? latestHistoryStart(cycleHistory);
    if (!anchor) return null;

    try {
      return explainPrediction({
        cycleHistory,
        healthProfile: subject ? subject.healthProfile : user.healthProfile,
        lastPeriodStart: new Date(anchor),
        recentStressLevel: todayCheckIn?.stressLevel ?? undefined,
        recentSleepQuality: todayCheckIn?.sleepQuality ?? undefined,
        predictionErrors,
      });
    } catch (err) {
      if (__DEV__) console.warn('[Explainer] local recompute failed:', err);
      return null;
    }
  }, [storeExplanation, user, lastPeriodStart, cycleHistory, predictionErrors, todayCheckIn, subject]);

  // The two figures that don't need a prediction to be meaningful. They are
  // built for BOTH states, so the empty card carries graphs too — the owner
  // asked for the science to be unconditional, not "once you have data".
  const lengthSeries = useMemo(() => buildCycleLengthSeries(cycleHistory), [cycleHistory]);
  const flowSeries = useMemo(
    () =>
      buildFlowShape(
        explanation?.periodLengthDays ?? user?.healthProfile.averagePeriodLength ?? 5,
        cycleHistory
      ),
    [explanation, user, cycleHistory]
  );

  // NEVER render nothing. Owner feedback (device-test-6): the science card
  // "sometimes shows and sometimes doesn't", which reads as broken and wastes
  // the space. With no period logged there IS no prediction to explain — but we
  // can still be transparent about exactly what the model will use once there
  // is, which is the confidence-building part.
  if (!explanation) {
    return (
      <Animated.View
        entering={FadeInDown.duration(320)}
        style={[styles.card, { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge }]}
      >
        <View style={styles.header}>
          <CompanionBuddy type={companionType} size={40} accessibilityLabel="Your companion" />
          <Text style={[styles.title, { color: palette.ink }]}>
            {subject ? `How ${subject.name}'s prediction will work` : 'How your prediction will work'}
          </Text>
        </View>
        <Text style={[styles.summary, { color: palette.ink2 }]}>
          Log your first period and Dottie starts modelling your rhythm. Nothing is
          guessed before then — that&apos;s deliberate.
        </Text>
        <Text style={[styles.factorPlain, { color: palette.ink3 }]}>
          Once you log, this card shows the most likely date, the ± window and how
          much of the probability it covers, the distribution curve behind it, which
          days are likely heaviest, and every input that shaped the estimate — your
          logged cycle lengths and their regularity, period length, age, and any
          conditions you told us about (PCOS, thyroid). All computed on this phone.
        </Text>

        {/* Graphs are unconditional. With nothing logged these show the shape
            the model starts from — the population pattern — clearly labelled as
            such. Better an honest starting figure than a blank space that reads
            as a broken card (device-test-7). */}
        <Text style={[styles.sectionLabel, { color: palette.ink3 }]}>
          YOUR CYCLE LENGTHS
        </Text>
        <CycleLengthHistoryChart series={lengthSeries} />

        <Text style={[styles.sectionLabel, { color: palette.ink3 }]}>
          WHICH DAYS TEND TO BE HEAVIEST
        </Text>
        <FlowShapeChart series={flowSeries} />
      </Animated.View>
    );
  }

  const confidencePct = Math.round(explanation.confidence * 100);

  const toggleScience = () => {
    Haptics.selectionAsync().catch(() => {});
    setShowScience((v) => !v);
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(320)}
      style={[
        styles.card,
        { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
      ]}
    >
      {/* Header — the companion GUIDES the explanation (taps to peek). */}
      <View style={styles.header}>
        <CompanionBuddy
          type={companionType}
          size={40}
          accessibilityLabel="Your companion explains your prediction"
        />
        <Text style={[styles.title, { color: palette.ink }]}>
          {subject ? `How ${subject.name}'s prediction is made` : 'How this prediction is made'}
        </Text>
      </View>

      {/* Plain summary */}
      <Text style={[styles.summary, { color: palette.ink2 }]}>{explanation.plainSummary}</Text>
      {subject ? (
        <Text style={[styles.factorPlain, { color: palette.ink3 }]}>{subject.dataNote}</Text>
      ) : null}

      {/* Window visual: start —●— end */}
      <WindowBar explanation={explanation} palette={palette} />

      {/* The period itself — how long, and which days tend to be hardest.
          Owner ask: don't just say WHEN it starts, brace me for the heavy days. */}
      <View style={[styles.periodBox, { borderColor: `${palette.accent}44`, backgroundColor: `${palette.accent}10` }]}>
        <Text style={[styles.periodTitle, { color: palette.ink }]}>
          🩸 Likely {pretty(explanation.pointDate)} – {pretty(explanation.periodEndDate)} · about {explanation.periodLengthDays} days
        </Text>
        <Text style={[styles.periodBody, { color: palette.ink2 }]}>{explanation.heavyDaysSummary}</Text>
      </View>

      {/* Confidence chip */}
      <View style={styles.chipRow}>
        <View style={[styles.chip, { borderColor: palette.accent }]}>
          <Text style={[styles.chipText, { color: palette.accent }]}>
            {labelForConfidence(explanation.confidenceLabel)} · {confidencePct}%
          </Text>
        </View>
        <Text style={[styles.chipHint, { color: palette.ink3 }]}>
          ~{Math.round(explanation.approxWindowProbability * 100)}% chance it lands in this range
        </Text>
      </View>

      {/* ─── THE THREE FIGURES ────────────────────────────────────────
          Each answers a different question, which is why one curve wasn't
          enough (owner: "you are only showing one graph of normal distribution
          ... which is not really useful"):
            WHEN will it start?     → the posterior density
            Am I regular?           → my own lengths vs. my mean ±1 SD
            Which days will be bad? → predicted heaviness per period day     */}
      <Text style={[styles.sectionLabel, { color: palette.ink3 }]}>
        WHEN IT&apos;S LIKELY TO START
      </Text>
      <PredictionDistributionChart
        predictedCycleLength={explanation.predictedCycleLength}
        stdDevDays={explanation.stdDevDays}
        windowDays={explanation.windowDays}
        pointDate={explanation.pointDate}
        intervalStartDate={explanation.intervalStartDate}
        intervalEndDate={explanation.intervalEndDate}
      />

      <Text style={[styles.sectionLabel, { color: palette.ink3 }]}>
        YOUR CYCLE LENGTHS · MEAN ±1 SD
      </Text>
      <CycleLengthHistoryChart series={lengthSeries} />

      <Text style={[styles.sectionLabel, { color: palette.ink3 }]}>
        WHICH DAYS TEND TO BE HEAVIEST
      </Text>
      <FlowShapeChart series={flowSeries} />

      {/* Factors — what the model actually used. */}
      <Text style={[styles.sectionLabel, { color: palette.ink3 }]}>WHAT SHAPED THIS PREDICTION</Text>
      <View style={styles.factors}>
        {explanation.factors.map((f) => (
          <View key={f.key} style={styles.factorRow}>
            <Text style={styles.factorIcon} accessibilityElementsHidden importantForAccessibility="no">
              {f.icon}
            </Text>
            <View style={styles.factorText}>
              <View style={styles.factorLabelRow}>
                <Text style={[styles.factorLabel, { color: palette.ink }]}>{f.label}</Text>
                <EffectTag effect={f.effect} palette={palette} />
              </View>
              <Text style={[styles.factorPlain, { color: palette.ink3 }]}>{f.plain}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Science toggle */}
      <PressableScale
        onPress={toggleScience}
        haptic="none"
        accessibilityRole="button"
        accessibilityLabel={showScience ? 'Hide the science' : 'Show the science'}
        style={styles.scienceToggle}
      >
        <Text style={[styles.scienceToggleText, { color: palette.accent }]}>
          {showScience ? 'Hide the science ↑' : 'Show the science ↓'}
        </Text>
      </PressableScale>

      {showScience && (
        <Animated.View entering={FadeIn.duration(220)}>
          <Text style={[styles.science, { color: palette.ink2 }]}>{explanation.scienceSummary}</Text>
          <Text style={[styles.science, { color: palette.ink2 }]}>
            {explanation.periodLengthTypicalText}
          </Text>
          <View style={[styles.statsRow, { borderTopColor: palette.glass.edge }]}>
            <Stat label="Typical length" value={`${explanation.predictedCycleLength}d`} palette={palette} />
            <Stat label="Std deviation" value={`±${explanation.stdDevDays.toFixed(1)}d`} palette={palette} />
            <Stat label="Cycles used" value={`${explanation.cyclesObserved}`} palette={palette} />
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

// ─── SUBCOMPONENTS ───────────────────────────────────────────────────

type Palette = ReturnType<typeof useAurora>['palette'];

function WindowBar({
  explanation,
  palette,
}: {
  explanation: PredictionExplanation;
  palette: Palette;
}): JSX.Element {
  return (
    <View style={styles.windowBar}>
      <View style={styles.windowEndcap}>
        <Text style={[styles.windowDate, { color: palette.ink3 }]}>{pretty(explanation.intervalStartDate)}</Text>
      </View>
      <View style={styles.windowTrackWrap}>
        <View style={[styles.windowTrack, { backgroundColor: palette.glass.edge }]} />
        <View style={[styles.windowDot, { backgroundColor: palette.accent, borderColor: palette.ground }]} />
        {/* Pops when a new log recomputes the prediction — the date visibly
            reacts so the user sees their input changed the answer. */}
        <PopOnChange value={explanation.pointDate}>
          <Text style={[styles.windowPoint, { color: palette.ink }]}>{pretty(explanation.pointDate)}</Text>
        </PopOnChange>
      </View>
      <View style={styles.windowEndcap}>
        <Text style={[styles.windowDate, { color: palette.ink3 }]}>{pretty(explanation.intervalEndDate)}</Text>
      </View>
    </View>
  );
}

function EffectTag({ effect, palette }: { effect: FactorEffect; palette: Palette }): JSX.Element | null {
  const meta = EFFECT_META[effect];
  if (!meta) return null;
  const color = meta.positive ? palette.accent : palette.ink3;
  return (
    <View style={[styles.effectTag, { borderColor: color }]}>
      <Text style={[styles.effectTagText, { color }]}>{meta.label}</Text>
    </View>
  );
}

function Stat({ label, value, palette }: { label: string; value: string; palette: Palette }): JSX.Element {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: palette.ink }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: palette.ink3 }]}>{label}</Text>
    </View>
  );
}

// ─── MAPS / HELPERS ──────────────────────────────────────────────────

const EFFECT_META: Record<FactorEffect, { label: string; positive: boolean }> = {
  tightens: { label: 'narrows', positive: true },
  widens: { label: 'widens', positive: false },
  'shifts-later': { label: 'later', positive: false },
  'shifts-earlier': { label: 'earlier', positive: false },
  neutral: { label: 'context', positive: false },
};

function labelForConfidence(label: PredictionExplanation['confidenceLabel']): string {
  switch (label) {
    case 'high':
      return 'High confidence';
    case 'good':
      return 'Good confidence';
    case 'moderate':
      return 'Moderate confidence';
    case 'learning':
    default:
      return 'Still learning';
  }
}

/** ISO YYYY-MM-DD → "Sep 24". */
function pretty(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.radius.xl,
    borderWidth: 1,
    padding: Spacing.cardPadding,
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerIcon: {
    fontSize: 20,
  },
  title: {
    ...Typography.preset.h3,
    flexShrink: 1,
  },
  summary: {
    ...Typography.preset.body,
    lineHeight: 22,
  },

  // Window bar
  windowBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xs,
  },
  windowEndcap: {
    minWidth: 44,
  },
  windowDate: {
    ...Typography.preset.caption,
  },
  windowTrackWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.base,
  },
  windowTrack: {
    position: 'absolute',
    height: 2,
    left: 0,
    right: 0,
    borderRadius: 1,
  },
  windowDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
  },
  windowPoint: {
    ...Typography.preset.captionBold,
    marginTop: 6,
  },

  // Confidence
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  chip: {
    borderWidth: 1,
    borderRadius: Spacing.radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  chipText: {
    ...Typography.preset.captionBold,
  },
  chipHint: {
    ...Typography.preset.caption,
    flexShrink: 1,
  },

  sectionLabel: {
    ...Typography.preset.overline,
    letterSpacing: 1,
    marginTop: Spacing.xs,
  },
  periodBox: {
    borderWidth: 1,
    borderRadius: Spacing.radius.lg,
    padding: Spacing.md,
    gap: 4,
  },
  periodTitle: {
    ...Typography.preset.bodySemibold,
  },
  periodBody: {
    ...Typography.preset.caption,
    lineHeight: 18,
  },

  // Factors
  factors: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  factorRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  factorIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  factorText: {
    flex: 1,
    gap: 2,
  },
  factorLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flexWrap: 'wrap',
  },
  factorLabel: {
    ...Typography.preset.bodySemibold,
  },
  factorPlain: {
    ...Typography.preset.caption,
    lineHeight: 18,
  },
  effectTag: {
    borderWidth: 1,
    borderRadius: Spacing.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 1,
  },
  effectTagText: {
    ...Typography.preset.caption,
    fontSize: 11,
    fontWeight: '700',
  },

  // Science toggle + panel
  scienceToggle: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.xs,
    marginTop: Spacing.xs,
  },
  scienceToggleText: {
    ...Typography.preset.captionBold,
  },
  science: {
    ...Typography.preset.body,
    lineHeight: 22,
    marginTop: Spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  statValue: {
    ...Typography.preset.h3,
  },
  statLabel: {
    ...Typography.preset.caption,
    textAlign: 'center',
  },
});

/**
 * Most recent period start found in the cycle history — the fallback anchor
 * when `lastPeriodStart` hasn't landed in the store yet. History is stored
 * newest-first by the repository, but we sort rather than assume.
 */
function latestHistoryStart(history: { startDate: string }[]): string | null {
  if (history.length === 0) return null;
  let latest = history[0]!.startDate;
  for (const c of history) if (c.startDate > latest) latest = c.startDate;
  return latest;
}
