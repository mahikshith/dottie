import { View, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/spacing';

/**
 * WizardStepIndicator
 *
 * A soft progress strip showing where the user is inside a multi-step
 * wizard. Each step is a tiny pill — the current/completed steps are
 * coral, upcoming steps are pale.
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  We deliberately don't show numbers or labels — the pills are pure
 *  spatial progress feedback. The step's title at the top of the
 *  screen is the textual cue.
 *
 *  Pills are wider when there are fewer steps so the bar always feels
 *  generously filled rather than dotted.
 */
export function WizardStepIndicator({
  total,
  currentIndex,
}: {
  total: number;
  currentIndex: number;
}) {
  return (
    <View style={styles.container}>
      {Array.from({ length: total }).map((_, i) => {
        const isFilled = i <= currentIndex;
        return (
          <View
            key={i}
            style={[
              styles.pill,
              isFilled ? styles.pillActive : styles.pillInactive,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  pill: {
    flex: 1,
    maxWidth: 32,
    height: 6,
    borderRadius: 3,
  },
  pillActive: {
    backgroundColor: Colors.primary.coral,
  },
  pillInactive: {
    backgroundColor: Colors.border.light,
  },
});
