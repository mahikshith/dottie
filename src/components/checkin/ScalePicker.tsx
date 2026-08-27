import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { useAurora } from '../../theme';

/**
 * ScalePicker
 *
 * A 1-5 horizontal segmented picker used for stress and sleep quality.
 * Each segment has a number, a soft fill on selection, and an end-cap
 * label pair below ("Low" / "High" or "Poor" / "Great") so the meaning
 * of the scale is always visible without reading the screen title.
 *
 * Reused twice in the daily check-in:
 *   - Stress today  (1 = chill, 5 = overwhelmed)
 *   - Sleep last night (1 = poor, 5 = restful)
 *
 * ─── WHY NOT A SLIDER ───────────────────────────────────────────────
 *
 *  Sliders are imprecise on touch and feel clinical. Segmented controls
 *  match Dottie's "cheerful + intentional" tone. Each tap is a clear
 *  declaration, not a drag-and-guess.
 */
export function ScalePicker({
  value,
  onChange,
  lowLabel,
  highLabel,
  accentColor,
}: {
  value: number | null;
  onChange: (v: number) => void;
  lowLabel: string;
  highLabel: string;
  /** Optional phase color override for the active fill */
  accentColor?: string;
}) {
  const { palette } = useAurora();
  const active = accentColor ?? palette.accent;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {[1, 2, 3, 4, 5].map((n) => {
          const isActive = value === n;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(n)}
              style={({ pressed }) => [
                styles.cell,
                { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
                isActive && { backgroundColor: active, borderColor: active },
                pressed && { transform: [{ scale: 0.95 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${n} out of 5`}
            >
              <Text
                style={[
                  styles.cellText,
                  { color: isActive ? palette.ground : palette.ink2 },
                ]}
              >
                {n}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.labelRow}>
        <Text style={[styles.endLabel, { color: palette.ink3 }]}>{lowLabel}</Text>
        <Text style={[styles.endLabel, { color: palette.ink3 }]}>{highLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  cell: {
    flex: 1,
    height: 48,
    borderRadius: Spacing.radius.lg,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellText: {
    ...Typography.preset.bodySemibold,
    fontSize: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
  },
  endLabel: {
    ...Typography.preset.caption,
  },
});
