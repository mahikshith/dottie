import { useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  CelebrationSheet,
  StreakFlame,
  MilestoneBanner,
  RewardChip,
} from '../../src/components/celebration';
import {
  useUserStore,
  useCycleStore,
  selectCompanionType,
  selectCurrentPhase,
} from '../../src/stores';
import { getCompanion } from '../../src/content/companions';
import { showCelebration, celebrationTierForMood } from '../../src/components/ui/celebration/celebration';

/**
 * Streak Celebration Modal
 *
 * ─── WHEN THIS OPENS ────────────────────────────────────────────────
 *
 *  Whenever a daily check-in (full or quick-mood) returns a streak that
 *  is either:
 *    • A milestone hit (3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365)
 *    • A regular increment we want to celebrate (currently milestones only)
 *
 *  Triggering screens push:
 *      router.push({
 *        pathname: '/(modals)/streak-celebration',
 *        params: { streak: '7', xp: '30', gems: '15', milestone: '7' },
 *      });
 *
 * ─── PARAMS ─────────────────────────────────────────────────────────
 *
 *  • streak    (required, numeric string) — the current streak count
 *  • xp        (optional, numeric string) — XP awarded this check-in
 *  • gems      (optional, numeric string) — gems awarded this check-in
 *  • milestone (optional, numeric string) — if present, render the banner
 *  • message   (optional)                 — engine-provided message to show
 *
 *  We parse defensively because Expo Router params come in as strings or
 *  arrays-of-strings depending on shape — see paramToInt() / paramToStr().
 *
 * ─── WHAT WE PULL FROM STORES ───────────────────────────────────────
 *
 *  Companion (for the line + emoji) and current phase (for the warm
 *  tint). Both via selectors — no full-store subscriptions.
 *
 *  We intentionally do NOT re-derive streak/xp/gems from the store: by
 *  the time we navigate here, the store has already been mutated and
 *  we want to show the snapshot AT THE MOMENT of the celebration.
 *  Params carry that snapshot.
 */

export default function StreakCelebrationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    streak?: string | string[];
    xp?: string | string[];
    gems?: string | string[];
    milestone?: string | string[];
    message?: string | string[];
  }>();

  const companionType = useUserStore(selectCompanionType);
  const phase = useCycleStore(selectCurrentPhase);
  const companion = getCompanion(companionType);

  const streakCount = paramToInt(params.streak, 1);
  const xpAwarded = paramToInt(params.xp, 0);
  const gemsAwarded = paramToInt(params.gems, 0);
  const milestone = paramToInt(params.milestone, 0);
  const engineMessage = paramToStr(params.message, '');

  // Soft success haptic + a mood-aware Aurora celebration on mount. A milestone
  // is a big win (full bloom unless they're low today); a plain increment is
  // smaller. Low/frustrated mood always gets the gentle, soothing tier.
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {}
    );
    const mood = useCycleStore.getState().todayCheckIn?.moodScore ?? null;
    showCelebration(celebrationTierForMood(mood, milestone > 0 ? 'big' : 'small'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDismiss = () => {
    Haptics.selectionAsync().catch(() => {});
    router.back();
  };

  // The CTA copy adapts to milestone vs. non-milestone celebrations.
  const ctaLabel = milestone > 0 ? 'Keep going' : 'Sweet';

  // The companion line gets a milestone-specific touch when applicable.
  const companionLine =
    milestone > 0
      ? `${companion.name} is so proud of you ${companion.emoji}`
      : `${companion.name} sees this streak ${companion.emoji}`;

  // Engine already gives us a beautifully crafted message — prefer it.
  const message =
    engineMessage ||
    (milestone > 0
      ? "This streak isn't a trophy. It's proof you kept showing up for yourself."
      : 'Another day, gently held.');

  // Reward row — only render chips for non-zero values.
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
      ctaLabel={ctaLabel}
      onCtaPress={handleDismiss}
      onDismiss={handleDismiss}
    >
      {/* Milestone banner appears ONLY when a milestone is hit */}
      {milestone > 0 && (
        <MilestoneBanner
          milestone={milestone}
          accentColor={companion.accentColor}
        />
      )}

      {/* The hero — always the streak flame */}
      <StreakFlame
        count={streakCount}
        accentColor={companion.accentColor}
        size={milestone > 0 ? 'large' : 'standard'}
      />
    </CelebrationSheet>
  );
}

// ─── PARAM HELPERS ──────────────────────────────────────────────────

/**
 * Expo Router params can be string | string[] | undefined.
 * Coerce safely into an integer, with a fallback.
 */
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
