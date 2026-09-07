/**
 * Dottie — one condition, with its explainer
 *
 * ─── WHY THIS IS SHARED (device-test-29) ────────────────────────────
 *
 *  The conditions list already lives once (`src/content/conditions.ts`, rule
 *  30). The ROW did not: onboarding drew its own, add-to-circle drew its own,
 *  and now the profile editor needs a third. Three copies of a control whose
 *  whole job is to stop people guessing is how the explainer ends up on one
 *  screen and not the others.
 *
 *  The explainer is the point. Owner: "some users may not know what PCOD or
 *  hyperthyroid even is, so they could select something random and the
 *  prediction confidence goes off. Until they are completely sure, they
 *  shouldn't tick it."
 *
 *  A ticked ovulatory condition widens the model's prior for every forecast
 *  afterwards, so the CHEAP action — finding out what it is — gets its own
 *  target, separate from the expensive one.
 */

import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { A } from '../../theme';
import { PressableScale } from '../ui';
import type { ConditionOption } from '../../content/conditions';

export interface ConditionRowProps {
  option: ConditionOption;
  selected: boolean;
  expanded: boolean;
  onToggle: () => void;
  onExpand: () => void;
}

export function ConditionRow({
  option,
  selected,
  expanded,
  onToggle,
  onExpand,
}: ConditionRowProps): JSX.Element {
  return (
    <View>
      <PressableScale
        onPress={onToggle}
        haptic="none"
        scaleTo={0.98}
        style={[styles.row, selected && styles.rowActive]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={option.label}
      >
        <Text style={styles.emoji}>{option.emoji}</Text>
        <View style={styles.text}>
          <Text style={[styles.label, selected && styles.labelActive]}>{option.label}</Text>
          <Text style={styles.hint}>{option.hint}</Text>
        </View>
        <PressableScale
          onPress={onExpand}
          haptic="none"
          scaleTo={0.9}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.info}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`What is ${option.label}?`}
        >
          <Text style={styles.infoGlyph}>{expanded ? '×' : '?'}</Text>
        </PressableScale>
        <View style={[styles.tick, selected && styles.tickActive]}>
          {selected ? <Text style={styles.tickMark}>✓</Text> : null}
        </View>
      </PressableScale>

      {expanded && (
        <Animated.View entering={FadeInDown.duration(220)} style={styles.explain}>
          <Text style={styles.body}>{option.what}</Text>
          <Text style={styles.eyebrow}>WHY WE ASK</Text>
          <Text style={styles.body}>{option.why}</Text>
          <Text style={styles.eyebrow}>
            {option.affectsPrediction ? 'WHAT IT DOES TO THE FORECAST' : 'EFFECT ON THE FORECAST'}
          </Text>
          <Text style={styles.body}>{option.predictionEffect}</Text>
          {option.affectsPrediction && (
            <Text style={styles.warn}>
              Only tick this if a clinician has told you. A guess here changes the maths for
              every forecast afterwards — and you can always come back and untick it.
            </Text>
          )}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 60,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderRadius: Spacing.radius.lg,
    borderWidth: 1,
    borderColor: A.glass2,
    backgroundColor: A.glass,
    marginBottom: Spacing.sm,
  },
  rowActive: { borderColor: A.accent, backgroundColor: `${A.accent}18` },
  emoji: { fontSize: 22 },
  text: { flex: 1, gap: 1 },
  label: { ...Typography.preset.bodySemibold, color: A.ink },
  labelActive: { color: A.ink },
  hint: { ...Typography.preset.caption, fontSize: 11.5, color: A.ink3 },
  info: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${A.accent}55`,
    backgroundColor: `${A.accent}12`,
  },
  infoGlyph: { color: A.accent, fontSize: 13, fontWeight: '800', lineHeight: 16 },
  tick: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: A.glass2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickActive: { borderColor: A.accent, backgroundColor: A.accent },
  tickMark: { color: A.ground, fontSize: 13, fontWeight: '900' },
  // Near-white body text on a lifted panel with a lit edge — the owner's note
  // was that a "cement colour" disappears on the deep aurora ground, so the
  // separation comes from the panel, not from dimming the words.
  explain: {
    marginTop: -2,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.base,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    gap: 6,
    borderLeftWidth: 2,
    borderLeftColor: `${A.accent}88`,
    borderRadius: Spacing.radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  eyebrow: {
    ...Typography.preset.caption,
    fontSize: 10,
    letterSpacing: 0.9,
    fontWeight: '800',
    color: A.accent,
    marginTop: 4,
  },
  body: { ...Typography.preset.caption, fontSize: 12.5, lineHeight: 18, color: A.ink },
  warn: { ...Typography.preset.caption, fontSize: 12, lineHeight: 17, color: A.gold, marginTop: 6 },
});
