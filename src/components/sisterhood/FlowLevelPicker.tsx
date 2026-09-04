import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { Shadows } from '../../constants/shadows';
import { A } from '../../theme';

/**
 * FlowLevelPicker
 *
 * A 5-step flow-level picker using a graduated drop emoji metaphor:
 *
 *   1: 💧        (Spotting)
 *   2: 💧💧      (Light)
 *   3: 💧💧💧    (Medium)
 *   4: 💧💧💧💧  (Heavy)
 *   5: 💧💧💧💧💧 (Very heavy)
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  Bars-of-drops give an instant visual sense of "more". Each row is
 *  a full-width tap target with the level label on the right, so the
 *  picker doesn't depend on counting drops to decide which to tap.
 *
 *  Selected state combines a coral background ring + a check mark, so
 *  the choice is clear even with the emoji metaphor disabled (some
 *  accessibility modes render emojis differently).
 *
 * ─── COPY ───────────────────────────────────────────────────────────
 *
 *  Labels follow clinical convention (spotting / light / medium / heavy /
 *  very heavy) but the visual softens any medicalization. The default
 *  in the period-log flow is 3 (medium) — the safe middle pick.
 */
export function FlowLevelPicker({
  value,
  onChange,
}: {
  value: number; // 1-5
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.container}>
      {FLOW_LEVELS.map((level) => {
        const isActive = value === level.value;
        return (
          <Pressable
            key={level.value}
            onPress={() => onChange(level.value)}
            style={({ pressed }) => [
              styles.row,
              isActive && styles.rowActive,
              pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
            ]}
          >
            <Text style={styles.drops}>{level.drops}</Text>
            <Text
              style={[styles.label, isActive && styles.labelActive]}
            >
              {level.label}
            </Text>
            <View
              style={[styles.checkOuter, isActive && styles.checkOuterActive]}
            >
              {isActive && <Text style={styles.checkMark}>✓</Text>}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── LEVELS ──────────────────────────────────────────────────────────

const FLOW_LEVELS = [
  { value: 1, drops: '💧', label: 'Spotting' },
  { value: 2, drops: '💧💧', label: 'Light' },
  { value: 3, drops: '💧💧💧', label: 'Medium' },
  { value: 4, drops: '💧💧💧💧', label: 'Heavy' },
  { value: 5, drops: '💧💧💧💧💧', label: 'Very heavy' },
];

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: A.glass,
    padding: Spacing.md,
    borderRadius: Spacing.radius.xl,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: Spacing.md,
    ...Shadows.sm,
  },
  rowActive: {
    borderColor: Colors.phase.menstrual.primary,
    backgroundColor: Colors.phase.menstrual.light,
  },
  drops: {
    fontSize: 18,
    minWidth: 110,
  },
  label: {
    ...Typography.preset.body,
    color: A.ink2,
    flex: 1,
  },
  labelActive: {
    color: A.ink,
    fontWeight: '600',
  },
  checkOuter: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: A.edge,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkOuterActive: {
    borderColor: Colors.phase.menstrual.primary,
    backgroundColor: Colors.phase.menstrual.primary,
  },
  checkMark: {
    fontSize: 14,
    color: A.ground,
    fontWeight: '700',
  },
});
