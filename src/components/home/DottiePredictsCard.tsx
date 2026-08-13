/**
 * DottiePredictsCard
 *
 * The third leg of the home emotional trio:
 *    1. Daily Decode      → "here's what your body is doing"
 *    2. Phase Weather     → "you're not alone in this rhythm"
 *    3. Dottie Predicts   → "Dottie *gets* you"  ← this card
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  - Presentational only — receives a deck via props, never reads the
 *    store directly. Trivially testable in isolation.
 *  - One card per deck. Up to MAX_INSIGHTS_PER_DAY insights show as
 *    soft sub-cards stacked vertically.
 *  - Each insight uses its own warm tone color (encouraging / gentle /
 *    heads_up / curious / cozy) for the accent + left border.
 *  - Empty / learning states are first-class — never a blank card.
 *  - Companion-voiced eyebrow: "Dottie noticed for you" — keeps the
 *    insight feeling personal, not algorithmic.
 *
 * ─── ACCESSIBILITY ──────────────────────────────────────────────────
 *
 *  Each insight is its own semantic "header + body + tip" group with
 *  a clear accessibilityLabel that reads as one warm sentence.
 */

import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { Shadows } from '../../constants/shadows';
import {
  DottieInsight,
  DottiePredictsDeck,
  InsightTone,
} from '../../types/dottie-predicts.types';

interface DottiePredictsCardProps {
  deck: DottiePredictsDeck | null;
  /** Companion name to personalize the eyebrow ("Luna noticed for you"). */
  companionName?: string;
  /** Companion emoji used in the eyebrow. */
  companionEmoji?: string;
}

export function DottiePredictsCard({
  deck,
  companionName = 'Dottie',
  companionEmoji = '🌸',
}: DottiePredictsCardProps) {
  // ─── Decide which state to render ───────────────────────────────
  const state: 'loading' | 'learning' | 'empty' | 'insights' = useMemo(() => {
    if (!deck) return 'loading';
    if (deck.insights.length > 0) return 'insights';
    if (deck.isLearning) return 'learning';
    return 'empty';
  }, [deck]);

  return (
    <View style={styles.card}>
      {/* Eyebrow header */}
      <View style={styles.eyebrowRow}>
        <Text style={styles.eyebrowEmoji}>{companionEmoji}</Text>
        <Text style={styles.eyebrow}>
          {companionName} noticed for you
        </Text>
      </View>

      {/* Body — switches by state */}
      {state === 'loading' && <LoadingState />}
      {state === 'learning' && (
        <LearningState
          cyclesAvailable={deck?.cyclesAvailable ?? 0}
        />
      )}
      {state === 'empty' && <EmptyState />}
      {state === 'insights' && deck && (
        <View style={styles.insightsStack}>
          {deck.insights.map((insight) => (
            <InsightBlock key={insight.id} insight={insight} />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────

function InsightBlock({ insight }: { insight: DottieInsight }) {
  const accent = toneAccent(insight.tone);
  const surface = toneSurface(insight.tone);

  // Compose a single warm accessibility sentence
  const a11y = [
    insight.title,
    insight.body,
    insight.tip,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <View
      style={[
        styles.insight,
        {
          backgroundColor: surface,
          borderLeftColor: accent,
        },
      ]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={a11y}
    >
      <View style={styles.insightHeader}>
        <Text style={styles.insightEmoji}>{insight.emoji}</Text>
        <Text style={[styles.insightTitle, { color: Colors.text.primary }]}>
          {insight.title}
        </Text>
      </View>

      <Text style={styles.insightBody}>{insight.body}</Text>

      {insight.tip ? (
        <Text style={[styles.insightTip, { color: accent }]}>
          💡 {insight.tip}
        </Text>
      ) : null}

      {insight.highlights.length > 0 ? (
        <View style={styles.chipRow}>
          {insight.highlights.map((h, idx) => (
            <View
              key={`${insight.id}_h_${idx}`}
              style={[styles.chip, { borderColor: `${accent}55` }]}
            >
              <Text style={styles.chipLabel}>{h.label}</Text>
              <Text style={[styles.chipValue, { color: accent }]}>
                {h.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function LoadingState() {
  return (
    <View style={styles.placeholderState}>
      <Text style={styles.placeholderTitle}>Listening to your rhythm…</Text>
      <Text style={styles.placeholderBody}>
        Dottie's pulling together what your body has been telling her lately.
      </Text>
    </View>
  );
}

function LearningState({ cyclesAvailable }: { cyclesAvailable: number }) {
  const subline =
    cyclesAvailable === 0
      ? 'Once you log a period or two, gentle predictions will appear here.'
      : cyclesAvailable === 1
      ? 'One more cycle of data and Dottie can start spotting your patterns.'
      : 'A few more days of logs and personal insights will start appearing here.';

  return (
    <View style={styles.placeholderState}>
      <Text style={styles.placeholderTitle}>
        Dottie is still learning your rhythm 🌱
      </Text>
      <Text style={styles.placeholderBody}>{subline}</Text>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.placeholderState}>
      <Text style={styles.placeholderTitle}>
        Nothing new from Dottie today 💛
      </Text>
      <Text style={styles.placeholderBody}>
        That's a good thing — your rhythm looks steady. Check back tomorrow.
      </Text>
    </View>
  );
}

// ─── TONE → COLOR MAPPING ────────────────────────────────────────────

function toneAccent(tone: InsightTone): string {
  switch (tone) {
    case 'encouraging':  return Colors.primary.sunshine;
    case 'gentle':       return Colors.primary.rose;
    case 'heads_up':     return Colors.primary.peach;
    case 'curious':      return Colors.phase.follicular.primary;
    case 'cozy':         return Colors.phase.luteal.primary;
  }
}

function toneSurface(tone: InsightTone): string {
  // Pulled from existing phase / surface tokens so we don't introduce
  // new colors — keeps the design language consistent.
  switch (tone) {
    case 'encouraging':  return Colors.surface.warmIvory;
    case 'gentle':       return Colors.phase.menstrual.light;
    case 'heads_up':     return Colors.phase.ovulatory.light;
    case 'curious':      return Colors.phase.follicular.light;
    case 'cozy':         return Colors.phase.luteal.light;
  }
}

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    padding: Spacing.cardPaddingLarge,
    borderRadius: Spacing.radius['2xl'],
    backgroundColor: Colors.surface.card,
    marginBottom: Spacing.sectionGap,
    gap: Spacing.md,
    ...Shadows.card,
  },

  // Eyebrow
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  eyebrowEmoji: {
    fontSize: 14,
  },
  eyebrow: {
    ...Typography.preset.captionBold,
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Insights stack
  insightsStack: {
    gap: Spacing.md,
  },

  // Single insight
  insight: {
    padding: Spacing.md,
    borderRadius: Spacing.radius.xl,
    borderLeftWidth: 3,
    gap: Spacing.sm,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  insightEmoji: {
    fontSize: 20,
  },
  insightTitle: {
    ...Typography.preset.bodySemibold,
    flex: 1,
  },
  insightBody: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  insightTip: {
    ...Typography.preset.captionBold,
    lineHeight: 18,
  },

  // Highlight chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.card,
    borderRadius: Spacing.radius.full,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm + 2,
    borderWidth: 1,
    gap: 6,
  },
  chipLabel: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
    fontSize: 11,
  },
  chipValue: {
    ...Typography.preset.captionBold,
    fontSize: 11,
  },

  // Placeholder states (loading / learning / empty)
  placeholderState: {
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  placeholderTitle: {
    ...Typography.preset.bodySemibold,
    color: Colors.text.primary,
  },
  placeholderBody: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
});
