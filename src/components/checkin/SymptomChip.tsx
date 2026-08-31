import { Pressable, Text, StyleSheet } from 'react-native';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { useAurora } from '../../theme';

/**
 * SymptomChip
 *
 * A single tappable symptom pill used inside SymptomPicker. It is now a plain
 * TOGGLE — tap to add, tap to remove.
 *
 * ─── WHY THIS CHANGED ───────────────────────────────────────────────
 *
 *  It used to cycle severity on repeated taps (tap = moderate, tap again =
 *  mild, again = strong, again = off) shown only as three tiny dots. On device
 *  that was undiscoverable — you couldn't tell you were meant to tap again, or
 *  what a tap would do (owner feedback). Severity now lives in an explicit
 *  labelled control that appears in SymptomPicker once a symptom is selected, so
 *  the chip only has one job: in or out.
 */
export type SymptomSeverity = 'mild' | 'moderate' | 'strong';

export function SymptomChip({
  label,
  emoji,
  selected,
  onToggle,
}: {
  label: string;
  emoji: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const { palette } = useAurora();
  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
        selected && { backgroundColor: `${palette.accent}26`, borderColor: palette.accent },
        pressed && { transform: [{ scale: 0.96 }] },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.label, { color: selected ? palette.ink : palette.ink2 }]}>
        {label}
      </Text>
      {selected && <Text style={[styles.check, { color: palette.accent }]}>✓</Text>}
    </Pressable>
  );
}

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
  check: {
    ...Typography.preset.bodySemibold,
    fontSize: 13,
    marginLeft: 2,
  },
});
