import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { Shadows } from '../../constants/shadows';
import { CareNudgeTemplate } from '../../types/sisterhood.types';
import { A } from '../../theme';

/**
 * CareNudgePicker
 *
 * Renders 2-3 pre-written care nudges the primary can send to a
 * member with a single tap.
 *
 * ─── DESIGN PRINCIPLE ───────────────────────────────────────────────
 *
 *  The primary should NEVER have to think about WHAT to say. The
 *  engine picks the right SITUATION (low mood, in sync, period day,
 *  etc.) based on the member's current state, and the content layer
 *  surfaces warm pre-written messages that fit.
 *
 *  One-tap send. No editing. No customization. That's the whole point:
 *  remove friction from caring.
 *
 * ─── EMPTY STATE ────────────────────────────────────────────────────
 *
 *  If for some reason no templates match, we render nothing — no
 *  awkward "no suggestions" message. The parent screen knows whether
 *  to show this component based on whether suggestions exist.
 */
export function CareNudgePicker({
  templates,
  onSelect,
  disabled = false,
}: {
  templates: CareNudgeTemplate[];
  onSelect: (template: CareNudgeTemplate) => void;
  disabled?: boolean;
}) {
  if (templates.length === 0) return null;

  return (
    <View style={styles.container}>
      {templates.map((template) => (
        <Pressable
          key={template.id}
          onPress={() => onSelect(template)}
          disabled={disabled}
          style={({ pressed }) => [
            styles.nudgeCard,
            disabled && styles.nudgeDisabled,
            pressed && !disabled && styles.nudgePressed,
          ]}
        >
          <Text style={styles.emoji}>{template.emoji}</Text>
          <Text style={styles.message}>{template.message}</Text>
          <View style={styles.sendChip}>
            <Text style={styles.sendChipText}>Send</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  // Aurora glass, not the legacy cream card (device-test-16). Three opaque
  // white slabs stacked under "Send a little warmth" were the brightest thing
  // on the screen and read as a different app bolted on.
  nudgeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: A.glass,
    borderWidth: 1,
    borderColor: A.edge,
    padding: Spacing.md,
    borderRadius: Spacing.radius.xl,
    gap: Spacing.md,
  },
  nudgePressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
    backgroundColor: A.glass2,
  },
  nudgeDisabled: {
    opacity: 0.5,
  },
  emoji: {
    fontSize: 28,
    width: 32,
    textAlign: 'center',
  },
  message: {
    ...Typography.preset.body,
    color: A.ink,
    flex: 1,
    lineHeight: 20,
  },
  sendChip: {
    backgroundColor: A.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Spacing.radius.full,
  },
  sendChipText: {
    ...Typography.preset.captionBold,
    color: A.ground,
    fontSize: 12,
    letterSpacing: 0.3,
  },
});