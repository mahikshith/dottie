import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors, getPhaseColors, PhaseKey } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { Shadows } from '../../constants/shadows';
import { Phase } from '../../types/cycle.types';

/**
 * PhaseSyncBanner
 *
 * The magic moment of the Sisterhood Circle — when you and a member
 * are in the same cycle phase on the same day. We surface this as a
 * warm, celebratory banner at the top of the dashboard.
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  - Color-shifts to match the shared phase (ovulatory glows golden,
 *    luteal sits in soft lavender, etc.)
 *  - Tappable dismiss to acknowledge — once acknowledged, the event
 *    disappears from the pending list (handled upstream by the store)
 *  - Microcopy is genuinely sweet, not corporate-cheery
 *
 * ─── WHY THIS MATTERS ───────────────────────────────────────────────
 *
 *  This feature was a key insight in the original product vision —
 *  shared phase context costs nothing to compute (it's just an ==
 *  comparison) but feels enormously magical to users. It's our
 *  "Spotify Wrapped" moment for sisterhood: a small, free, deeply
 *  human delight.
 */
export function PhaseSyncBanner({
  memberName,
  memberEmoji,
  phase,
  onAcknowledge,
}: {
  memberName: string;
  memberEmoji: string;
  phase: Phase;
  onAcknowledge: () => void;
}) {
  const phaseColors = getPhaseColors(phase as PhaseKey);
  const message = composeSyncMessage(memberName, phase);

  return (
    <Pressable
      onPress={onAcknowledge}
      style={({ pressed }) => [
        styles.banner,
        { backgroundColor: phaseColors.light, borderLeftColor: phaseColors.primary },
        pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] },
      ]}
    >
      <View style={styles.iconStack}>
        <Text style={styles.bigEmoji}>🤝</Text>
        <Text style={styles.smallEmoji}>{memberEmoji}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>
          You and {memberName} are in sync!
        </Text>
        <Text style={styles.body}>{message}</Text>
      </View>

      <Text style={[styles.dismissArrow, { color: phaseColors.primary }]}>
        ›
      </Text>
    </Pressable>
  );
}

// ─── COPY ────────────────────────────────────────────────────────────

/**
 * Compose a warm sync message keyed by phase. Each variant feels true
 * to what that phase actually feels like — not generic positivity.
 */
function composeSyncMessage(name: string, phase: Phase): string {
  switch (phase) {
    case 'menstrual':
      return `${name} is also in their menstrual phase today. Hot tea + soft blanket energy for both of you 🌊`;
    case 'follicular':
      return `Both of you are in the follicular wave — rising energy, fresh focus. Get something done together 🌱`;
    case 'ovulatory':
      return `Peak phase together — you're both glowing today. Solidarity through the spark ☀️`;
    case 'luteal':
      return `Luteal sync. Be extra patient with each other today — your bodies are asking for softness 🌙`;
  }
}

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.cardPaddingLarge,
    borderRadius: Spacing.radius['2xl'],
    borderLeftWidth: 4,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  iconStack: {
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  bigEmoji: {
    fontSize: 38,
  },
  smallEmoji: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    fontSize: 22,
    backgroundColor: Colors.surface.card,
    borderRadius: 14,
    width: 28,
    height: 28,
    textAlign: 'center',
    lineHeight: 28,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  title: {
    ...Typography.preset.bodySemibold,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  body: {
    ...Typography.preset.caption,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  dismissArrow: {
    fontSize: 28,
    fontWeight: '300',
  },
});