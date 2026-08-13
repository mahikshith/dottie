import { Pressable, Text, StyleSheet, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';

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
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        selected && severity && severityStyles[severity],
        pressed && { transform: [{ scale: 0.96 }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${label}${selected ? `, selected, ${severity}` : ''}`}
    >
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.label, selected && styles.labelSelected]}>
        {label}
      </Text>
      {selected && severity && (
        <View style={styles.severityRow}>
          <View
            style={[
              styles.severityDot,
              styles.severityDotActive,
            ]}
          />
          <View
            style={[
              styles.severityDot,
              (severity === 'moderate' || severity === 'strong') &&
                styles.severityDotActive,
            ]}
          />
          <View
            style={[
              styles.severityDot,
              severity === 'strong' && styles.severityDotActive,
            ]}
          />
        </View>
      )}
    </Pressable>
  );
}

const severityStyles = StyleSheet.create({
  mild: {
    backgroundColor: Colors.phase.follicular.light,
    borderColor: Colors.phase.follicular.primary,
  },
  moderate: {
    backgroundColor: Colors.phase.ovulatory.light,
    borderColor: Colors.phase.ovulatory.primary,
  },
  strong: {
    backgroundColor: Colors.phase.menstrual.light,
    borderColor: Colors.phase.menstrual.primary,
  },
});

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Spacing.radius.full,
    backgroundColor: Colors.surface.cardElevated,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: Spacing.xs,
  },
  chipSelected: {
    borderColor: Colors.primary.coral,
  },
  emoji: {
    fontSize: 16,
  },
  label: {
    ...Typography.preset.bodySemibold,
    color: Colors.text.secondary,
    fontSize: 14,
  },
  labelSelected: {
    color: Colors.text.primary,
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
    backgroundColor: Colors.border.medium,
  },
  severityDotActive: {
    backgroundColor: Colors.text.primary,
  },
});
