import { useEffect, useMemo } from 'react';
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
  selectStreak,
} from '../../src/stores';
import { getCompanion } from '../../src/content/companions';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';

/**
 * Daily Check-In Recap Modal
 *
 * ─── WHEN THIS OPENS ────────────────────────────────────────────────
 *
 *  The DEFAULT post-submit destination for the daily check-in flow.
 *  Opens whenever recordCheckIn() finishes and there's no milestone
 *  and no level-up to celebrate.
 *
 *  It also handles the bittersweet case: the streak was just broken.
 *  Same shell, completely different copy — no flame, no streak number,
 *  no "let's go" energy. Just: "you showed up today, and that's the
 *  whole point."
 *
 *  Triggering screens push:
 *      router.push({
 *        pathname: '/(modals)/checkin-recap',
 *        params: {
 *          xp: '10',
 *          gems: '2',
 *          streakBroken: 'true',         ← optional
 *          previousStreak: '23',         ← optional, for "23 days don't disappear"
 *        },
 *      });
 *
 * ─── PARAMS ─────────────────────────────────────────────────────────
 *
 *  • xp              (optional, numeric string) — XP awarded
 *  • gems            (optional, numeric string) — gems awarded
 *  • streakBroken    (optional, 'true' | 'false')
 *  • previousStreak  (optional, numeric string) — old count, for reframe
 *  • message         (optional) — engine-provided message if present
 *
 * ─── WHAT WE PULL FROM STORES ───────────────────────────────────────
 *
 *  • Companion + phase (for shell tint and companion line).
 *  • Current streak via selectStreak (NOT params) — we want the live
 *    post-submit value, which the store has already updated by the
 *    time we navigate here.
 *  • todayCheckIn for the recap summary ("you logged mood + 2 symptoms").
 */

export default function CheckInRecapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    xp?: string | string[];
    gems?: string | string[];
    streakBroken?: string | string[];
    previousStreak?: string | string[];
    message?: string | string[];
  }>();

  const companionType = useUserStore(selectCompanionType);
  const phase = useCycleStore(selectCurrentPhase);
  const todayCheckIn = useCycleStore((s) => s.todayCheckIn);
  const recentSymptoms = useCycleStore((s) => s.recentSymptoms);
  const streak = useGamificationStore(selectStreak);
  const companion = getCompanion(companionType);

  const xpAwarded = paramToInt(params.xp, 0);
  const gemsAwarded = paramToInt(params.gems, 0);
  const streakBroken = paramToStr(params.streakBroken, 'false') === 'true';
  const previousStreak = paramToInt(params.previousStreak, 0);
  const engineMessage = paramToStr(params.message, '');

  // Soft, gentle haptic — not the strong success notification.
  useEffect(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const handleDismiss = () => {
    Haptics.selectionAsync().catch(() => {});
    router.back();
  };

  // Count symptoms logged today (the recent list is sorted by date desc)
  const today = new Date().toISOString().split('T')[0];
  const symptomsToday = useMemo(
    () => recentSymptoms.filter((s) => s.date === today).length,
    [recentSymptoms, today]
  );

  // ─── COPY BRANCHES ──────────────────────────────────────────────

  let companionLine: string;
  let message: string;

  if (streakBroken) {
    // Streak-break path — gentlest possible reframe.
    companionLine = `${companion.name} is glad you came back ${companion.emoji}`;
    message =
      engineMessage ||
      (previousStreak > 0
        ? `${previousStreak} days don't disappear. Your body remembers every single check-in. Welcome back 🩷`
        : "What matters isn't the streak — it's that you showed up today.");
  } else if (streak.currentStreak > 0) {
    // Normal continuation — soft acknowledgement, no fanfare.
    companionLine = `${companion.name} is right here with you ${companion.emoji}`;
    message =
      engineMessage ||
      `Day ${streak.currentStreak} of showing up. Quiet, daily power.`;
  } else {
    // First check-in or post-reset
    companionLine = `${companion.name} is so glad you're here ${companion.emoji}`;
    message =
      engineMessage ||
      'Your journey starts the moment you show up. And here you are 🌱';
  }

  // ─── REWARDS ────────────────────────────────────────────────────

  const hasRewards = xpAwarded > 0 || gemsAwarded > 0;
  const rewards = hasRewards ? (
    <>
      {xpAwarded > 0 && <RewardChip kind="xp" amount={xpAwarded} />}
      {gemsAwarded > 0 && <RewardChip kind="gem" amount={gemsAwarded} />}
    </>
  ) : null;

  return (
    <CelebrationSheet
      phase={phase}
      companionEmoji={companion.emoji}
      companionName={companion.name}
      companionLine={companionLine}
      message={message}
      rewards={rewards}
      ctaLabel="Thanks, friend"
      ctaColor={companion.accentColor}
      onCtaPress={handleDismiss}
      onDismiss={handleDismiss}
    >
      {/* Hero — a quiet recap of what was logged today.
          We deliberately do NOT show a giant streak number on this screen.
          That moment belongs to streak-celebration. This screen is the
          warm "thank you for showing up" version. */}
      <View style={styles.recapCard}>
        <Text style={styles.recapHeader}>Today's check-in</Text>

        {todayCheckIn?.moodScore !== undefined &&
          todayCheckIn?.moodScore !== null && (
            <RecapRow emoji="💛" label="Mood" value={moodLabel(todayCheckIn.moodScore)} />
          )}
        {todayCheckIn?.energyLevel !== undefined &&
          todayCheckIn?.energyLevel !== null && (
            <RecapRow
              emoji="✨"
              label="Energy"
              value={`${todayCheckIn.energyLevel} / 5`}
            />
          )}
        {todayCheckIn?.stressLevel !== undefined &&
          todayCheckIn?.stressLevel !== null && (
            <RecapRow
              emoji="🌿"
              label="Stress"
              value={`${todayCheckIn.stressLevel} / 5`}
            />
          )}
        {todayCheckIn?.sleepQuality !== undefined &&
          todayCheckIn?.sleepQuality !== null && (
            <RecapRow
              emoji="🌙"
              label="Sleep"
              value={`${todayCheckIn.sleepQuality} / 5`}
            />
          )}
        {symptomsToday > 0 && (
          <RecapRow
            emoji="🌸"
            label="Symptoms"
            value={`${symptomsToday} noted`}
          />
        )}

        {/* If absolutely nothing was logged (defensive), give it warmth */}
        {!todayCheckIn?.moodScore &&
          !todayCheckIn?.energyLevel &&
          symptomsToday === 0 && (
            <Text style={styles.emptyText}>
              You opened the door today — that counts.
            </Text>
          )}
      </View>
    </CelebrationSheet>
  );
}

// ─── SUBCOMPONENTS ──────────────────────────────────────────────────

function RecapRow({
  emoji,
  label,
  value,
}: {
  emoji: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.recapRow}>
      <Text style={styles.recapEmoji}>{emoji}</Text>
      <Text style={styles.recapLabel}>{label}</Text>
      <Text style={styles.recapValue}>{value}</Text>
    </View>
  );
}

// ─── PARAM / MOOD HELPERS ───────────────────────────────────────────

function paramToInt(
  raw: string | string[] | undefined,
  fallback: number
): number {
  if (raw === undefined) return fallback;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function paramToStr(
  raw: string | string[] | undefined,
  fallback: string
): string {
  if (raw === undefined) return fallback;
  return Array.isArray(raw) ? raw[0] ?? fallback : raw;
}

function moodLabel(score: number): string {
  switch (score) {
    case 5:
      return 'Joyful';
    case 4:
      return 'Steady';
    case 3:
      return 'Neutral';
    case 2:
      return 'Tender';
    case 1:
      return 'Heavy';
    default:
      return `${score} / 5`;
  }
}

// ─── STYLES ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  recapCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: Spacing.radius['2xl'],
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    minWidth: 280,
    gap: Spacing.md,
  },
  recapHeader: {
    ...Typography.preset.captionBold,
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  recapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  recapEmoji: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  recapLabel: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
    flex: 1,
  },
  recapValue: {
    ...Typography.preset.bodySemibold,
    color: Colors.text.primary,
  },
  emptyText: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
