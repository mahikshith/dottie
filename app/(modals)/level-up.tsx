import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  CelebrationSheet,
  RewardChip,
} from '../../src/components/celebration';
import {
  useUserStore,
  useCycleStore,
  useGamificationStore,
  selectCompanionType,
  selectCurrentPhase,
  selectLevelProgress,
} from '../../src/stores';
import { getCompanion } from '../../src/content/companions';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { Shadows } from '../../src/constants/shadows';

/**
 * Level Up Modal
 *
 * ─── WHEN THIS OPENS ────────────────────────────────────────────────
 *
 *  When a check-in / quiz / lesson awarded enough XP to cross a level
 *  boundary. The triggering action returns `leveledUp: true, newLevel`.
 *
 *  Triggering screens push:
 *      router.push({
 *        pathname: '/(modals)/level-up',
 *        params: { newLevel: '5', xp: '25' },
 *      });
 *
 * ─── PARAMS ─────────────────────────────────────────────────────────
 *
 *  • newLevel  (required, numeric string) — the level just reached
 *  • xp        (optional, numeric string) — XP that triggered the up
 *
 * ─── WHAT WE PULL FROM STORES ───────────────────────────────────────
 *
 *  Companion, current phase, and the level-progress selector — the
 *  selector gives us the NEW level's name + emoji + next level for the
 *  "next: X" teaser.
 *
 *  We rely on selectLevelProgress for canonical level metadata so we
 *  never duplicate the level table in this UI file. If the engine adds
 *  a new level later, this screen reflects it without changes.
 */

export default function LevelUpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    newLevel?: string | string[];
    xp?: string | string[];
  }>();

  const companionType = useUserStore(selectCompanionType);
  const phase = useCycleStore(selectCurrentPhase);
  const levelProgress = useGamificationStore(selectLevelProgress);
  const companion = getCompanion(companionType);

  const newLevelNumber = paramToInt(params.newLevel, 1);
  const xpAwarded = paramToInt(params.xp, 0);

  // Stronger success haptic for the level-up moment.
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {}
    );
  }, []);

  const handleDismiss = () => {
    Haptics.selectionAsync().catch(() => {});
    router.back();
  };

  // The selector returns the CURRENT level info — which after a level-up
  // is the level the user just reached. If the param disagrees (shouldn't
  // happen, but defensive), we prefer the live selector.
  const reachedLevel = levelProgress.currentLevel;
  const nextLevel = levelProgress.nextLevel;

  const companionLine = `${companion.name} is beaming for you ${companion.emoji}`;
  const message = `You're now ${reachedLevel.emoji} ${reachedLevel.name} — Level ${reachedLevel.level}.`;

  const rewards = xpAwarded > 0 ? <RewardChip kind="xp" amount={xpAwarded} /> : null;

  return (
    <CelebrationSheet
      phase={phase}
      companionEmoji={companion.emoji}
      companionName={companion.name}
      companionLine={companionLine}
      message={message}
      rewards={rewards}
      ctaLabel="Beautiful"
      ctaColor={companion.accentColor}
      onCtaPress={handleDismiss}
      onDismiss={handleDismiss}
    >
      {/* Hero — a soft level badge */}
      <View
        style={[
          styles.badge,
          {
            backgroundColor: hexToRgba(companion.accentColor, 0.12),
            borderColor: hexToRgba(companion.accentColor, 0.4),
          },
        ]}
        accessibilityRole="text"
        accessibilityLabel={`Level ${reachedLevel.level}: ${reachedLevel.name}`}
      >
        <Text style={styles.levelEmoji}>{reachedLevel.emoji}</Text>
        <Text style={[styles.levelLabel, { color: companion.accentColor }]}>
          Level {reachedLevel.level}
        </Text>
        <Text style={styles.levelName}>{reachedLevel.name}</Text>
      </View>

      {/* Next-level teaser — gentle, never pushy */}
      {nextLevel ? (
        <Text style={styles.nextTeaser}>
          Next: {nextLevel.emoji} {nextLevel.name} · {nextLevel.xpRequired} XP
        </Text>
      ) : (
        <Text style={styles.nextTeaser}>
          You've reached the top of the path. Endless gratitude 🩷
        </Text>
      )}

      {/* Defensive fallback so test data displaying the wrong level
          number doesn't silently swallow the moment */}
      {newLevelNumber > 0 && newLevelNumber !== reachedLevel.level ? (
        <Text style={styles.devNote}>
          (was awarded for reaching level {newLevelNumber})
        </Text>
      ) : null}
    </CelebrationSheet>
  );
}

// ─── PARAM HELPERS ──────────────────────────────────────────────────

function paramToInt(
  raw: string | string[] | undefined,
  fallback: number
): number {
  if (raw === undefined) return fallback;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── STYLES ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing.xl,
    borderRadius: Spacing.radius['3xl'],
    borderWidth: 2,
    gap: Spacing.xs,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  levelEmoji: {
    fontSize: 72,
    marginBottom: Spacing.sm,
  },
  levelLabel: {
    ...Typography.preset.overline,
    fontSize: 12,
  },
  levelName: {
    ...Typography.preset.h2,
    color: Colors.text.primary,
  },
  nextTeaser: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  devNote: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    opacity: 0.5,
  },
});
