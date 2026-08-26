/**
 * DottiePredictsCard  — MOOD AURORA THEME (design-v2)
 *
 * The third leg of the home emotional trio ("Dottie *gets* you"). Presentational
 * only (deck via props). Themed to the aurora palette: the card is a glass
 * surface, insight sub-cards keep their tone DISTINCTION via the accent border,
 * and all colour comes from `useAurora()` (inline, since the palette re-tints
 * per mood). Logic, states, a11y, and copy are unchanged.
 *
 * ⚠️ design-v2 / UNVERIFIED (no device).
 */

import { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { useAurora } from '../../theme';
import type { AuroraPalette } from '../../theme';
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
  const { palette } = useAurora();

  // ─── Decide which state to render ───────────────────────────────
  const state: 'loading' | 'learning' | 'empty' | 'insights' = useMemo(() => {
    if (!deck) return 'loading';
    if (deck.insights.length > 0) return 'insights';
    if (deck.isLearning) return 'learning';
    return 'empty';
  }, [deck]);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.glass.bg,
          borderColor: palette.glass.edge,
        },
      ]}
    >
      {/* Eyebrow header */}
      <View style={styles.eyebrowRow}>
        <Text style={styles.eyebrowEmoji}>{companionEmoji}</Text>
        <Text style={[styles.eyebrow, { color: palette.ink3 }]}>
          {companionName} noticed for you
        </Text>
      </View>

      {/* Body — switches by state */}
      {state === 'loading' && <LoadingState />}
      {state === 'learning' && <LearningState cyclesAvailable={deck?.cyclesAvailable ?? 0} />}
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
  const { palette } = useAurora();
  const accent = toneAccent(insight.tone, palette);

  const a11y = [insight.title, insight.body, insight.tip].filter(Boolean).join('. ');

  return (
    <View
      style={[
        styles.insight,
        { backgroundColor: palette.glass.bg, borderLeftColor: accent },
      ]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={a11y}
    >
      <View style={styles.insightHeader}>
        <Text style={styles.insightEmoji}>{insight.emoji}</Text>
        <Text style={[styles.insightTitle, { color: palette.ink }]}>{insight.title}</Text>
      </View>

      <Text style={[styles.insightBody, { color: palette.ink2 }]}>{insight.body}</Text>

      {insight.tip ? (
        <Text style={[styles.insightTip, { color: accent }]}>💡 {insight.tip}</Text>
      ) : null}

      {insight.highlights.length > 0 ? (
        <View style={styles.chipRow}>
          {insight.highlights.map((h, idx) => (
            <View
              key={`${insight.id}_h_${idx}`}
              style={[
                styles.chip,
                { backgroundColor: palette.glass.bg, borderColor: `${accent}55` },
              ]}
            >
              <Text style={[styles.chipLabel, { color: palette.ink3 }]}>{h.label}</Text>
              <Text style={[styles.chipValue, { color: accent }]}>{h.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function LoadingState() {
  const { palette } = useAurora();
  return (
    <View style={styles.placeholderState}>
      <Text style={[styles.placeholderTitle, { color: palette.ink }]}>
        Listening to your rhythm…
      </Text>
      <Text style={[styles.placeholderBody, { color: palette.ink2 }]}>
        Dottie's pulling together what your body has been telling her lately.
      </Text>
    </View>
  );
}

function LearningState({ cyclesAvailable }: { cyclesAvailable: number }) {
  const { palette } = useAurora();
  const subline =
    cyclesAvailable === 0
      ? 'Once you log a period or two, gentle predictions will appear here.'
      : cyclesAvailable === 1
      ? 'One more cycle of data and Dottie can start spotting your patterns.'
      : 'A few more days of logs and personal insights will start appearing here.';

  return (
    <View style={styles.placeholderState}>
      <Text style={[styles.placeholderTitle, { color: palette.ink }]}>
        Dottie is still learning your rhythm 🌱
      </Text>
      <Text style={[styles.placeholderBody, { color: palette.ink2 }]}>{subline}</Text>
    </View>
  );
}

function EmptyState() {
  const { palette } = useAurora();
  return (
    <View style={styles.placeholderState}>
      <Text style={[styles.placeholderTitle, { color: palette.ink }]}>
        Nothing new from Dottie today 💛
      </Text>
      <Text style={[styles.placeholderBody, { color: palette.ink2 }]}>
        That's a good thing — your rhythm looks steady. Check back tomorrow.
      </Text>
    </View>
  );
}

// ─── TONE → PALETTE ACCENT ───────────────────────────────────────────

function toneAccent(tone: InsightTone, palette: AuroraPalette): string {
  // With a mood-driven palette we don't have 5 fixed tone hues — we keep a
  // 2-way distinction (bright accent vs secondary) and let the left border +
  // emoji carry the rest. The mood owns the atmosphere, not the tone.
  switch (tone) {
    case 'encouraging':
    case 'heads_up':
      return palette.accent;
    case 'gentle':
    case 'curious':
    case 'cozy':
    default:
      return palette.accent2;
  }
}

// ─── STYLES (layout only — colours are inline, palette-driven) ───────

const styles = StyleSheet.create({
  card: {
    padding: Spacing.cardPaddingLarge,
    borderRadius: Spacing.radius['2xl'],
    borderWidth: 1,
    marginBottom: Spacing.sectionGap,
    gap: Spacing.md,
    // aurora glass sits on the dark ground — a soft dark lift shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 8,
  },
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
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  insightsStack: {
    gap: Spacing.md,
  },
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
    lineHeight: 22,
  },
  insightTip: {
    ...Typography.preset.captionBold,
    lineHeight: 18,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.radius.full,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm + 2,
    borderWidth: 1,
    gap: 6,
  },
  chipLabel: {
    ...Typography.preset.caption,
    fontSize: 11,
  },
  chipValue: {
    ...Typography.preset.captionBold,
    fontSize: 11,
  },
  placeholderState: {
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  placeholderTitle: {
    ...Typography.preset.bodySemibold,
  },
  placeholderBody: {
    ...Typography.preset.body,
    lineHeight: 22,
  },
});
