import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Colors, getPhaseColors, PhaseKey } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { Shadows } from '../../constants/shadows';
import { MemberView } from '../../types/sisterhood.types';

/**
 * MemberCard
 *
 * A compact, privacy-respectful summary card for a Sisterhood member.
 *
 * ─── WHAT IT RENDERS ────────────────────────────────────────────────
 *
 *  - Big emoji + display name + relationship
 *  - Privacy chip (so the primary always knows what they're seeing)
 *  - Phase dot + phase label (only if privacy level allows it)
 *  - Mood signal chip (only if privacy level allows it)
 *  - In-sync indicator when phases match — the magic moment
 *  - "Last active" relative time as a soft footer
 *
 * ─── PRIVACY DISCIPLINE ─────────────────────────────────────────────
 *
 *  This component ONLY consumes a MemberView. It doesn't know what raw
 *  shadow data exists. Every nullable field is a privacy gate — if it's
 *  null, we don't render it. We never make filtering decisions here.
 *
 * ─── PRESS BEHAVIOR ─────────────────────────────────────────────────
 *
 *  Tappable in its entirety. The parent screen wires the press handler
 *  to navigate to `/(sisterhood)/member/[id]`. No tap-targets-within-
 *  tap-targets — keep the card a single, big, easy thing to hit.
 */
export function MemberCard({
  view,
  onPress,
}: {
  view: MemberView;
  onPress: () => void;
}) {
  const phaseKey: PhaseKey | null = view.currentPhase as PhaseKey | null;
  const phaseColors = phaseKey ? getPhaseColors(phaseKey) : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
    >
      {/* Top row: emoji + name + privacy badge */}
      <View style={styles.topRow}>
        <Text style={styles.emoji}>{view.emoji}</Text>
        <View style={styles.nameWrap}>
          <View style={styles.nameLine}>
            <Text style={styles.name} numberOfLines={1}>
              {view.displayName}
            </Text>
            {view.inPhaseSync && view.currentPhase && (
              <View style={styles.syncChip}>
                <Text style={styles.syncChipEmoji}>🤝</Text>
                <Text style={styles.syncChipText}>In sync</Text>
              </View>
            )}
          </View>
          <Text style={styles.relationship} numberOfLines={1}>
            {view.relationship}
          </Text>
        </View>
        <PrivacyChip level={view.privacyLevel} />
      </View>

      {/* Middle row: phase + mood — both gated by privacy level */}
      {(phaseColors || view.moodSignal) && (
        <View style={styles.metaRow}>
          {phaseColors && (
            <View style={[styles.phasePill, { backgroundColor: phaseColors.light }]}>
              <View
                style={[styles.phaseDot, { backgroundColor: phaseColors.primary }]}
              />
              <Text style={styles.phasePillText}>
                {phaseColors.emoji} {phaseColors.label}
                {view.dayInCycle !== null ? ` · D${view.dayInCycle}` : ''}
              </Text>
            </View>
          )}

          {view.moodSignal && (
            <View style={styles.moodPill}>
              <Text style={styles.moodPillEmoji}>{moodEmoji(view.moodSignal)}</Text>
              <Text style={styles.moodPillText}>{moodLabel(view.moodSignal)}</Text>
            </View>
          )}
        </View>
      )}

      {/* Footer: last active OR empty-data hint */}
      <View style={styles.footer}>
        {view.lastActiveAt ? (
          <Text style={styles.footerText}>
            Active {formatRelative(view.lastActiveAt)}
          </Text>
        ) : (
          <Text style={styles.footerHintText}>
            Tap to start tracking together
          </Text>
        )}
        <Text style={styles.footerArrow}>›</Text>
      </View>
    </Pressable>
  );
}

// ─── PRIVACY CHIP ────────────────────────────────────────────────────

function PrivacyChip({ level }: { level: MemberView['privacyLevel'] }) {
  const config: Record<
    MemberView['privacyLevel'],
    { label: string; emoji: string; color: string }
  > = {
    full:      { label: 'Full',     emoji: '🌷', color: Colors.primary.coral },
    summary:   { label: 'Summary',  emoji: '🌼', color: Colors.primary.peach },
    mood:      { label: 'Mood',     emoji: '💛', color: Colors.primary.sunburst },
    connected: { label: 'Linked',   emoji: '🔗', color: Colors.primary.calm },
  };
  const c = config[level];
  return (
    <View style={[styles.privacyChip, { borderColor: c.color }]}>
      <Text style={styles.privacyChipEmoji}>{c.emoji}</Text>
      <Text style={[styles.privacyChipText, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────

function moodEmoji(signal: NonNullable<MemberView['moodSignal']>): string {
  switch (signal) {
    case 'tough_day': return '🌧️';
    case 'ok':        return '🌤️';
    case 'great':     return '🌞';
  }
}

function moodLabel(signal: NonNullable<MemberView['moodSignal']>): string {
  switch (signal) {
    case 'tough_day': return 'Tough day';
    case 'ok':        return 'Okay';
    case 'great':     return 'Great';
  }
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.max(1, Math.floor((now - then) / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface.card,
    padding: Spacing.cardPaddingLarge,
    borderRadius: Spacing.radius['2xl'],
    ...Shadows.card,
  },
  cardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  // Top row
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  emoji: {
    fontSize: 44,
  },
  nameWrap: {
    flex: 1,
    minWidth: 0,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  name: {
    ...Typography.preset.h4,
    color: Colors.text.primary,
    flexShrink: 1,
  },
  relationship: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  // Sync chip
  syncChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.phase.ovulatory.light,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Spacing.radius.full,
    gap: 4,
  },
  syncChipEmoji: {
    fontSize: 11,
  },
  syncChipText: {
    ...Typography.preset.caption,
    fontSize: 11,
    fontWeight: '600',
    color: Colors.phase.ovulatory.primary,
    letterSpacing: 0.3,
  },
  // Privacy chip
  privacyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Spacing.radius.full,
    borderWidth: 1,
    gap: 3,
  },
  privacyChipEmoji: {
    fontSize: 11,
  },
  privacyChipText: {
    ...Typography.preset.caption,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  // Meta row
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  phasePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Spacing.radius.full,
    gap: 6,
  },
  phaseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  phasePillText: {
    ...Typography.preset.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  moodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.cardElevated,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Spacing.radius.full,
    gap: 4,
  },
  moodPillEmoji: {
    fontSize: 12,
  },
  moodPillText: {
    ...Typography.preset.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  footerText: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
  },
  footerHintText: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
  },
  footerArrow: {
    fontSize: 20,
    color: Colors.text.tertiary,
  },
});