import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { Shadows } from '../../constants/shadows';
import { PrivacyLevel } from '../../types/sisterhood.types';
import { A } from '../../theme';

/**
 * PrivacyLevelCard
 *
 * A selectable card that explains one privacy level in plain English:
 * what the primary WILL see, and what they WON'T see. This makes the
 * privacy contract auditable for the user, not just for the engine.
 *
 * ─── DESIGN PHILOSOPHY ──────────────────────────────────────────────
 *
 *  Privacy UX is usually a wall of legal jargon. We do the opposite —
 *  use bullet points with literal language:
 *
 *    "You'll see: phase, mood, energy"
 *    "Stays private: flow level, symptoms, notes"
 *
 *  This is also reusable later in the member detail edit screen so
 *  the primary can change a privacy level without re-learning what
 *  each one means.
 */
export function PrivacyLevelCard({
  level,
  selected,
  onSelect,
}: {
  level: PrivacyLevel;
  selected: boolean;
  onSelect: () => void;
}) {
  const config = PRIVACY_CONFIG[level];

  return (
    <Pressable
      onPress={onSelect}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconBadge, { backgroundColor: config.bgColor }]}>
          <Text style={styles.iconEmoji}>{config.emoji}</Text>
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{config.title}</Text>
          <Text style={styles.subtitle}>{config.subtitle}</Text>
        </View>
        <View style={[styles.checkOuter, selected && styles.checkOuterActive]}>
          {selected && <Text style={styles.checkMark}>✓</Text>}
        </View>
      </View>

      {/* You'll see list */}
      {config.seen.length > 0 && (
        <View style={[styles.list, styles.listSeen]}>
          <Text style={styles.listLabel}>You'll see</Text>
          {config.seen.map((item) => (
            <View key={item} style={styles.listItem}>
              <Text style={styles.bulletSeen}>✓</Text>
              <Text style={styles.listItemText}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Stays private list */}
      {config.hidden.length > 0 && (
        <View style={[styles.list, styles.listHidden]}>
          <Text style={styles.listLabel}>Stays private</Text>
          {config.hidden.map((item) => (
            <View key={item} style={styles.listItem}>
              <Text style={styles.bulletHidden}>·</Text>
              <Text style={styles.listItemTextDim}>{item}</Text>
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

const PRIVACY_CONFIG: Record<
  PrivacyLevel,
  {
    emoji: string;
    title: string;
    subtitle: string;
    bgColor: string;
    seen: string[];
    hidden: string[];
  }
> = {
  full: {
    emoji: '🌷',
    title: 'Full view',
    subtitle: 'Everything they track is visible to you',
    bgColor: Colors.phase.menstrual.light,
    seen: ['Phase + day in cycle', 'Mood + energy', 'Flow level', 'Symptoms + notes'],
    hidden: [],
  },
  summary: {
    emoji: '🌼',
    title: 'Summary',
    subtitle: 'A respectful overview, no fine details',
    bgColor: Colors.phase.follicular.light,
    seen: ['Phase + day in cycle', 'Mood + energy', 'Predicted next period'],
    hidden: ['Flow level', 'Symptom details', 'Notes'],
  },
  mood: {
    emoji: '💛',
    title: 'Mood only',
    subtitle: 'Just a gentle signal when they need warmth',
    bgColor: Colors.phase.ovulatory.light,
    seen: ['Tough day / okay / great signal'],
    hidden: ['Cycle phase', 'Period dates', 'Symptoms', 'Anything else'],
  },
  connected: {
    emoji: '🔗',
    title: 'Connected, opaque',
    subtitle: 'You\'re in their circle — no data flows either way',
    bgColor: Colors.phase.luteal.light,
    seen: ['That they\'re active', 'Last check-in date'],
    hidden: ['Phase', 'Mood', 'Symptoms', 'Everything'],
  },
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: A.glass,
    padding: Spacing.cardPadding,
    borderRadius: Spacing.radius['2xl'],
    borderWidth: 2,
    borderColor: 'transparent',
    ...Shadows.card,
  },
  cardSelected: {
    borderColor: Colors.primary.coral,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconEmoji: {
    fontSize: 22,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    ...Typography.preset.bodySemibold,
    fontSize: 17,
    color: A.ink,
  },
  subtitle: {
    ...Typography.preset.caption,
    color: A.ink3,
    marginTop: 2,
  },
  checkOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: A.edge,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkOuterActive: {
    borderColor: Colors.primary.coral,
    backgroundColor: Colors.primary.coral,
  },
  checkMark: {
    fontSize: 14,
    color: A.ground,
    fontWeight: '700',
  },
  // Lists
  list: {
    marginTop: Spacing.md,
  },
  listSeen: {},
  listHidden: {},
  listLabel: {
    ...Typography.preset.caption,
    fontSize: 11,
    fontWeight: '700',
    color: A.ink3,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: Spacing.xs,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  bulletSeen: {
    width: 14,
    color: Colors.primary.sage,
    fontWeight: '700',
    textAlign: 'center',
  },
  bulletHidden: {
    width: 14,
    color: A.ink3,
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 18,
    lineHeight: 18,
  },
  listItemText: {
    ...Typography.preset.caption,
    color: A.ink2,
    flex: 1,
  },
  listItemTextDim: {
    ...Typography.preset.caption,
    color: A.ink3,
    flex: 1,
    fontStyle: 'italic',
  },
});
