import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/colors';
import { Spacing } from '../../constants/spacing';
import { Shadows } from '../../constants/shadows';
import { A } from '../../theme';

/**
 * EmojiPicker
 *
 * A grid of 8 warm member emojis the primary can pick to represent
 * their sister/friend on the dashboard.
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  Curated set, not the full emoji keyboard — fewer choices feels
 *  delightful rather than overwhelming. Each emoji here is "sister-
 *  energy" friendly: flowers, hearts, soft creatures. No faces (those
 *  can feel uncanny when representing a real person).
 *
 *  Selected state uses a soft coral ring + light fill so it reads as
 *  "active" without being jarring.
 */

const MEMBER_EMOJIS = ['🌸', '🌷', '🌼', '💛', '🌿', '✨', '🦋', '🌙'];

export function EmojiPicker({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (emoji: string) => void;
}) {
  return (
    <View style={styles.grid}>
      {MEMBER_EMOJIS.map((emoji) => {
        const isActive = emoji === selected;
        return (
          <Pressable
            key={emoji}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onSelect(emoji);
            }}
            style={({ pressed }) => [
              styles.cell,
              isActive && styles.cellActive,
              pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
            ]}
          >
            <Text style={styles.emoji}>{emoji}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  cell: {
    width: 60,
    height: 60,
    borderRadius: Spacing.radius.xl,
    backgroundColor: A.glass,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...Shadows.sm,
  },
  cellActive: {
    borderColor: Colors.primary.coral,
    backgroundColor: Colors.phase.menstrual.light,
  },
  emoji: {
    fontSize: 30,
  },
});
