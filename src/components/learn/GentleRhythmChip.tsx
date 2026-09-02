/**
 * Dottie — Gentle Rhythm Chip (Learn Redesign Phase 4)
 *
 * A tiny aurora chip near the top of the Learn tab that surfaces the user's
 * VISITED-DAY cadence in a warm, non-punishing way. Deliberately NOT a streak
 * counter (that's the check-in streak in the header) — this is a soft "kind
 * cadence" signal. Rest days count. Absence is silent.
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *   Glass pill with a soft accent border, an emoji beat (state-driven), and
 *   a short warm label from `summarizeRhythm`. Below the label, a compact
 *   7-dot row shows each of the last 7 days (filled dot = visited, hollow =
 *   quiet — never red, never an X). The dots let a user glance at cadence
 *   without doing the math.
 *
 *  ⚠️ design-v2 / UNVERIFIED on device.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useAurora } from '../../theme';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import type { GentleRhythmSummary } from '../../engine/learn/gentle-rhythm';

export interface GentleRhythmChipProps {
  summary: GentleRhythmSummary;
  /** Sorted YYYY-MM-DD strings, last 7 days ending today; used for the dot row. */
  last7Dots: boolean[];
}

export function GentleRhythmChip(props: GentleRhythmChipProps): JSX.Element {
  const { palette } = useAurora();
  const { summary, last7Dots } = props;

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: palette.glass.bg, borderColor: `${palette.accent}55` },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Gentle rhythm: ${summary.warmLabel}`}
    >
      <View style={styles.row}>
        <Text style={styles.emoji}>{summary.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: palette.ink }]} numberOfLines={2}>
            {summary.warmLabel}
          </Text>
          <View style={styles.dots}>
            {last7Dots.map((filled, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    borderColor: palette.glass.edge,
                    backgroundColor: filled ? palette.accent : 'transparent',
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── STYLES (layout only — colours inline, palette-driven) ──────────

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    borderRadius: Spacing.radius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  emoji: { fontSize: 22 },
  label: { ...Typography.preset.caption, fontWeight: '700', fontSize: 12.5 },
  dots: { flexDirection: 'row', gap: 5, marginTop: 5 },
  dot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1 },
});
