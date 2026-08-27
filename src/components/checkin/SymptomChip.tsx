import { Pressable, Text, StyleSheet, View } from 'react-native';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { useAurora, PHASE_AURORA } from '../../theme';

/**
 * SymptomChip
 *
 * A single tappable symptom pill used inside SymptomPicker. Tap once to
 * select (default severity = 5), tap again to cycle severity levels,
 * long-press handled by parent if needed. We deliberately keep severity
 * tied to a simple "mild → moderate → strong" three-stop visual so the
 * user never feels they need to dial in a precise 1-10 number for a
 * daily check-in.
 *
 * ─── WHY THIS DESIGN ────────────────────────────────────────────────
 *
 *  Daily check-ins must be FAST. Forcing a slider per symptom would
 *  destroy the ritual. Instead:
 *    - First tap   → selected at "moderate" (severity 5)
 *    - Second tap  → "mild" (severity 3)
 *    - Third tap   → "strong" (severity 8)
 *    - Fourth tap  → unselected
 *
 *  Three meaningful intensity levels covers 95% of journaling needs
 *  without overwhelming the user. The 1-10 scale lives in the engine
 *  layer for future medication/PMDD analytics — UI stays cheerful.
 */
export type SymptomSeverity = 'mild' | 'moderate' | 'strong';

export function SymptomChip({
  label,
  emoji,
  selected,
  severity,
  onToggle,
}: {
  label: string;
  emoji: string;
  selected: boolean;
  severity: SymptomSeverity | null;
  onToggle: () => void;
}) {
  const { palette } = useAurora();
  const dotOn = { backgroundColor: palette.ink };
  const dotOff = { backgroundColor: palette.glass.edge };
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
        selected && { borderColor: palette.accent },
        selected && severity && severityStyles[severity],
        pressed && { transform: [{ scale: 0.96 }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${label}${selected ? `, selected, ${severity}` : ''}`}
    >
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.label, { color: selected ? palette.ink : palette.ink2 }]}>
        {label}
      </Text>
      {selected && severity && (
        <View style={styles.severityRow}>
          <View style={[styles.severityDot, dotOn]} />
          <View style={[styles.severityDot, severity === 'moderate' || severity === 'strong' ? dotOn : dotOff]} />
          <View style={[styles.severityDot, severity === 'strong' ? dotOn : dotOff]} />
        </View>
      )}
    </Pressable>
  );
}

// Severity uses the constant aurora phase hues (mild→teal, moderate→amber,
// strong→rose), tinted; these are palette-independent so they can stay static.
const severityStyles = StyleSheet.create({
  mild: { backgroundColor: `${PHASE_AURORA.follicular}22`, borderColor: PHASE_AURORA.follicular },
  moderate: { backgroundColor: `${PHASE_AURORA.ovulatory}22`, borderColor: PHASE_AURORA.ovulatory },
  strong: { backgroundColor: `${PHASE_AURORA.menstrual}22`, borderColor: PHASE_AURORA.menstrual },
});

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Spacing.radius.full,
    borderWidth: 1.5,
    gap: Spacing.xs,
  },
  emoji: {
    fontSize: 16,
  },
  label: {
    ...Typography.preset.bodySemibold,
    fontSize: 14,
  },
  severityRow: {
    flexDirection: 'row',
    gap: 3,
    marginLeft: Spacing.xs,
  },
  severityDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
