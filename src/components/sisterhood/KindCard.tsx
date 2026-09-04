import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { Shadows } from '../../constants/shadows';
import { MemberKind } from '../../types/sisterhood.types';
import { A } from '../../theme';

/**
 * KindCard
 *
 * A large selectable card explaining one of the two member kinds:
 *
 *   SHADOW  — "I'll track for them" (they don't have a phone yet)
 *   LINKED  — "They have Dottie" (cross-device, ships with social plane)
 *
 * ─── COPY DECISIONS ─────────────────────────────────────────────────
 *
 *  We say "I'll track for them" rather than "Shadow profile" because
 *  the latter sounds technical and slightly suspicious. The internal
 *  type name `shadow` stays — it's accurate engineering shorthand —
 *  but the user-facing copy is warm and clear.
 *
 *  Linked mode is honest that the full sync ships later. Better to be
 *  truthful than to fake it and disappoint.
 */
export function KindCard({
  kind,
  selected,
  onSelect,
}: {
  kind: MemberKind;
  selected: boolean;
  onSelect: () => void;
}) {
  const config = KIND_CONFIG[kind];

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
        <Text style={styles.emoji}>{config.emoji}</Text>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{config.title}</Text>
          <Text style={styles.subtitle}>{config.subtitle}</Text>
        </View>
        <View style={[styles.checkOuter, selected && styles.checkOuterActive]}>
          {selected && <Text style={styles.checkMark}>✓</Text>}
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.bodyText}>{config.body}</Text>

        {config.tag && (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{config.tag}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const KIND_CONFIG: Record<
  MemberKind,
  { emoji: string; title: string; subtitle: string; body: string; tag?: string }
> = {
  shadow: {
    emoji: '🌷',
    title: "I'll track for them",
    subtitle: 'Perfect for younger sisters & loved ones without phones',
    body: 'You log period days, moods, and check-ins on their behalf. When they get their own phone, you can hand off everything with a one-time code.',
  },
  linked: {
    emoji: '🔗',
    title: 'They have Dottie',
    subtitle: 'Send them an invite to connect',
    body: "They keep their own data on their own device. You'll see what they choose to share. Care nudges you send will reach them gently.",
    tag: 'Invite code coming soon',
  },
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: A.glass,
    padding: Spacing.cardPaddingLarge,
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
  emoji: {
    fontSize: 40,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    ...Typography.preset.h4,
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
  body: {
    marginTop: Spacing.md,
  },
  bodyText: {
    ...Typography.preset.body,
    color: A.ink2,
    lineHeight: 22,
  },
  tag: {
    marginTop: Spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: A.glass2,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Spacing.radius.full,
  },
  tagText: {
    ...Typography.preset.caption,
    fontSize: 11,
    color: A.ink3,
    fontStyle: 'italic',
  },
});
