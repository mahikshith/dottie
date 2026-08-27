import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { useAurora } from '../../theme';

/**
 * MoodScale
 *
 * A 5-emoji scale picker used for both mood and energy logging.
 * The `kind` prop picks the emoji set:
 *
 *   "mood"   → 😢 😕 😐 🙂 😊  (emotional spectrum)
 *   "energy" → 🌑 🌘 🌗 🌖 🌕  (moon-phase metaphor for energy levels)
 *
 * ─── DESIGN PHILOSOPHY ──────────────────────────────────────────────
 *
 *  Why moon phases for energy? Because cycles + moons are an
 *  established Dottie metaphor (luteal phase has the moon emoji in
 *  our color system), and a 5-step waxing visual reads instantly as
 *  "less to more". Bars or numbers would feel clinical.
 *
 *  Each cell is a full 60x60 touch target — generous for thumbs,
 *  thumb-tip even, on small devices. Selected state combines a soft
 *  coral ring + a tiny dot beneath the emoji so it works for users
 *  who can't perceive color.
 *
 * ─── REUSABILITY ────────────────────────────────────────────────────
 *
 *  Reused in both check-in flows AND eventually in the primary user's
 *  own daily check-in modal (Chunk 9). Component stays pure — value +
 *  onChange + kind, no other state.
 */
export function MoodScale({
  kind,
  value,
  onChange,
}: {
  kind: 'mood' | 'energy';
  value: number; // 1-5
  onChange: (v: number) => void;
}) {
  const { palette } = useAurora();
  const emojis = kind === 'mood' ? MOOD_EMOJIS : ENERGY_EMOJIS;

  return (
    <View style={styles.row}>
      {emojis.map((emoji, i) => {
        const score = i + 1;
        const isActive = value === score;
        return (
          <Pressable
            key={score}
            onPress={() => onChange(score)}
            style={({ pressed }) => [
              styles.cell,
              { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
              isActive && { borderColor: palette.accent, backgroundColor: `${palette.accent}26` },
              pressed && { opacity: 0.85, transform: [{ scale: 0.95 }] },
            ]}
          >
            <Text style={[styles.emoji, isActive && styles.emojiActive]}>
              {emoji}
            </Text>
            <View
              style={[styles.dot, { backgroundColor: isActive ? palette.accent : 'transparent' }]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── EMOJI SETS ──────────────────────────────────────────────────────

const MOOD_EMOJIS = ['😢', '😕', '😐', '🙂', '😊'];
const ENERGY_EMOJIS = ['🌑', '🌘', '🌗', '🌖', '🌕'];

// Touch Typography to keep the import warm for future caption use
void Typography;

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: Spacing.xs,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 60,
    borderRadius: Spacing.radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    gap: 4,
  },
  emoji: {
    fontSize: 30,
    opacity: 0.7,
  },
  emojiActive: {
    opacity: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
