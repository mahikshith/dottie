import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';

/**
 * SectionHeader
 *
 * Small repeating header inside the daily check-in modal. Each section
 * gets a friendly title + an optional warm one-line hint to make the
 * sheet feel like a conversation, not a form.
 *
 * Lives in the checkin/ folder rather than ui/ because the visual
 * treatment (compact, slightly muted hint copy, no separators) is
 * specifically tuned for the check-in modal. Other screens that need a
 * generic section header still use the `sectionTitle` style directly.
 */
export function SectionHeader({
  emoji,
  title,
  hint,
}: {
  emoji?: string;
  title: string;
  hint?: string;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        {emoji ? <Text style={styles.emoji}>{emoji}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emoji: {
    fontSize: 22,
  },
  title: {
    ...Typography.preset.h4,
    color: Colors.text.primary,
  },
  hint: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
});
