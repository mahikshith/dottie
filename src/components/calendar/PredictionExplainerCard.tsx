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

import { useState } from 'react';
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
import type {
  FactorEffect,
  PredictionExplanation,
} from '../../engine/prediction/explain-prediction';

// ─── COMPONENT ───────────────────────────────────────────────────────

export function PredictionExplainerCard(): JSX.Element | null {
  const { palette } = useAurora();
  const explanation = useCycleStore(selectPredictionExplanation);
  const companionType = useUserStore(selectCompanionType);
  const [showScience, setShowScience] = useState(false);

  // No prediction yet (no period ever logged) → don't render; the calendar's
  // own empty states already invite the first log.
  if (!explanation) return null;

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
        <Text style={[styles.title, { color: palette.ink }]}>How this prediction is made</Text>
      </View>

      {/* Plain summary */}
      <Text style={[styles.summary, { color: palette.ink2 }]}>{explanation.plainSummary}</Text>

      {/* Window visual: start —●— end */}
      <WindowBar explanation={explanation} palette={palette} />

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

      {/* Factors */}
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
