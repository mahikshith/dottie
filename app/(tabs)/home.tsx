import { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { Shadows } from '../../src/constants/shadows';
import {
  useContentStore,
  useCycleStore,
  useGamificationStore,
  useUserStore,
  usePhaseWeatherStore,
  usePredictsStore,
  selectCompanionType,
  selectCurrentPhase,
  selectDayInCycle,
  selectGemsBalance,
  selectStreak,
  selectTodaysCard,
  selectTodaysQuestions,
  selectWeatherSnapshot,
  selectPredictsDeck,
} from '../../src/stores';
import { getCompanion } from '../../src/content/companions';
import { getTimeGreeting } from '../../src/engine/content';
import { buildWeatherView } from '../../src/engine/phase-weather/aggregator';
import { PhaseWeatherCard } from '../../src/components/home/PhaseWeatherCard';
import { DottiePredictsCard } from '../../src/components/home/DottiePredictsCard';
import { PressableScale, BreathingView, PopOnChange } from '../../src/components/ui';
import { todayISO } from '../../src/utils/date.utils';

/**
 * Home Dashboard — The daily ritual screen.
 *
 * ─── PREMIUM POLISH PASS (Phase 2) ──────────────────────────────────
 *
 *  The design system was already rich; this pass activates it:
 *
 *   - Entrance choreography: each card fades + rises in a gentle stagger
 *     (Reanimated `FadeInDown`, UI thread) so the dashboard assembles
 *     with intent on every visit.
 *   - The greeting card is now a soft phase-tinted gradient with the
 *     companion sitting in a breathing gradient "halo" — it reads as a
 *     living companion, not a static emoji. Body text stays on the light
 *     end of the gradient so contrast (dark-brown on cream) is preserved.
 *   - Streak + gem counters "pop" (PopOnChange) when they change, so
 *     logging feels immediately rewarding.
 *   - Mood buttons + the full-check-in CTA use the shared spring-press
 *     primitive (PressableScale) for buttery 60fps tap feedback.
 *   - Real safe-area insets replace a fixed top padding.
 *
 *  All motion honors "Reduce Motion" via the shared primitives.
 *
 * ─── EMOTIONAL TRIO (unchanged) ─────────────────────────────────────
 *
 *    1. Daily Decode   (universal phase insight)
 *    2. Phase Weather  (anonymous community pulse)
 *    3. Dottie Predicts (personal pattern recognition)
 *
 *  Companion greeting, phase bar, streak/gems, quick mood, full check-in
 *  CTA, phase-responsive questions, all-caught-up state — all preserved.
 */
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ─── Live store reads via selectors (efficient re-renders) ────
  const companionType = useUserStore(selectCompanionType);
  const phase = useCycleStore(selectCurrentPhase);
  const dayInCycle = useCycleStore(selectDayInCycle);
  const todayCheckIn = useCycleStore((s) => s.todayCheckIn);
  const streak = useGamificationStore(selectStreak);
  const gemsBalance = useGamificationStore(selectGemsBalance);
  const todaysCard = useContentStore(selectTodaysCard);
  const todaysQuestions = useContentStore(selectTodaysQuestions);
  const weatherSnapshot = usePhaseWeatherStore(selectWeatherSnapshot);
  const predictsDeck = usePredictsStore(selectPredictsDeck);

  const companion = getCompanion(companionType);
  const phaseColors = Colors.phase[phase];

  // ─── Compose greeting (time + companion + phase) ────────────────
  const greeting = useMemo(() => {
    const timePart = getTimeGreeting();
    const phaseGreeting = companion.greetings[phase];
    return `${timePart}, friend!\n${phaseGreeting}`;
  }, [companion, phase]);

  // ─── Build the weather view (snapshot + user's phase) ───────────
  const weatherView = useMemo(() => {
    if (!weatherSnapshot) return null;
    return buildWeatherView(weatherSnapshot, phase);
  }, [weatherSnapshot, phase]);

  // ─── Refresh today's content + ambient cards on phase/day change ─
  useEffect(() => {
    useContentStore.getState().refreshTodaysContent();
    // Safety net: if the user kept the app open across midnight, the
    // cached weather snapshot is invalidated by daily rollover.
    // ensureToday() regenerates lazily on the next read. Cheap.
    usePhaseWeatherStore.getState().ensureToday();
    // Same safety net for Dottie Predicts — also re-runs when the
    // user's cycle position shifts so insights stay relevant.
    void usePredictsStore.getState().ensureToday();
  }, [phase, dayInCycle]);

  // ─── Quick mood tap handler ─────────────────────────────────────
  //
  // Note: This is the *quick* path — we deliberately do NOT route into
  // the recap modal here. The quick tap should feel like saying hi in
  // passing. Milestones and level-ups still earn a celebration moment,
  // because those *are* moments and skipping them would feel cold.
  const onMoodSelect = async (moodScore: number, _emoji: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const today = todayISO();

    try {
      // 1. Save the check-in (mood field)
      await useCycleStore.getState().saveCheckIn({
        date: today,
        moodScore,
      });

      // 2. Process streak / XP / gems
      const result = await useGamificationStore.getState().recordCheckIn(today);

      // 3. Prefetch tomorrow for an instant feel next time
      useContentStore.getState().prefetchTomorrow();

      // 4. Regenerate the Dottie Predicts deck — new check-in could
      //    nudge the consistency_celebration insight into the deck.
      void usePredictsStore.getState().regenerate();

      // 5. Route into the right celebration ONLY if it's a notable moment.
      //    Quick mood taps stay quick by default — no recap modal here.
      if (result.milestone !== null) {
        router.push({
          pathname: '/(modals)/streak-celebration',
          params: {
            streak: String(result.newStreakCount),
            xp: String(result.xpAwarded),
            gems: String(result.gemsAwarded),
            milestone: String(result.milestone),
            message: result.message,
          },
        });
      } else if (result.leveledUp) {
        router.push({
          pathname: '/(modals)/level-up',
          params: {
            newLevel: String(result.newLevel),
            xp: String(result.xpAwarded),
          },
        });
      }
      // No-op for ordinary check-ins: the quick path stays quick.
    } catch (err) {
      if (__DEV__) console.warn('[Home] check-in failed:', err);
    }
  };

  // ─── Open the polished full check-in flow ───────────────────────
  const onOpenFullCheckIn = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push('/(modals)/daily-checkin');
  };

  // ─── Phase-question tap handler (unchanged) ─────────────────────
  const onAnswerQuestion = async (
    questionId: string,
    response: string,
    index: number,
    trackedMetric?: string
  ) => {
    Haptics.selectionAsync().catch(() => {});
    try {
      await useContentStore.getState().answerQuestion(
        questionId,
        { value: response, index },
        { trackedMetric }
      );
    } catch (err) {
      if (__DEV__) console.warn('[Home] answer failed:', err);
    }
  };

  // Has the user already opened the full check-in today (i.e. provided
  // energy / stress / sleep / symptoms beyond just mood)?
  const hasFullCheckIn = Boolean(
    todayCheckIn &&
      (todayCheckIn.energyLevel !== null ||
        todayCheckIn.stressLevel !== null ||
        todayCheckIn.sleepQuality !== null)
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingTop: insets.top + Spacing.lg },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Companion Greeting — soft phase-tinted gradient card with the
          companion sitting in a breathing gradient halo. Two-view
          shadow/clip so the iOS shadow renders alongside the rounded
          gradient clip. */}
      <Animated.View entering={rise(60)} style={styles.greetingShadow}>
        <View style={styles.greetingClip}>
          <LinearGradient
            colors={[Colors.surface.card, phaseColors.light] as const}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.greetingRow}>
            <BreathingView>
              <LinearGradient
                colors={phaseColors.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.companionHalo}
              >
                <Text style={styles.companionEmoji}>{companion.emoji}</Text>
              </LinearGradient>
            </BreathingView>
            <View style={styles.greetingContent}>
              <Text style={styles.greetingText}>{greeting}</Text>
            </View>
          </View>
        </View>
      </Animated.View>

      {/* Phase Indicator */}
      <Animated.View entering={rise(140)} style={styles.phaseBar}>
        <View style={[styles.phaseDot, { backgroundColor: phaseColors.primary }]} />
        <Text style={styles.phaseLabel}>{phaseColors.label} Phase</Text>
        <Text style={styles.phaseDay}>Day {dayInCycle}</Text>
      </Animated.View>

      {/* Phase Weather — the "you're not alone" moment */}
      {weatherView ? (
        <Animated.View entering={rise(220)}>
          <PhaseWeatherCard view={weatherView} />
        </Animated.View>
      ) : null}

      {/* Streak & Gems Row */}
      <Animated.View entering={rise(300)} style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>🔥</Text>
          <PopOnChange value={streak.currentStreak}>
            <Text style={styles.statNumber}>{streak.currentStreak}</Text>
          </PopOnChange>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>💎</Text>
          <PopOnChange value={gemsBalance}>
            <Text style={styles.statNumber}>{gemsBalance}</Text>
          </PopOnChange>
          <Text style={styles.statLabel}>Gems</Text>
        </View>
      </Animated.View>

      {/* Dottie Predicts — the "Dottie *gets* you" moment */}
      <Animated.View entering={rise(380)}>
        <DottiePredictsCard
          deck={predictsDeck}
          companionName={companion.name}
          companionEmoji={companion.emoji}
        />
      </Animated.View>

      {/* Daily Decode Card */}
      {todaysCard && (
        <Animated.View
          entering={rise(460)}
          style={[
            styles.dailyDecodeCard,
            {
              backgroundColor: phaseColors.light,
              borderLeftColor: phaseColors.primary,
            },
          ]}
        >
          <Text style={[styles.dailyDecodeLabel, { color: phaseColors.primary }]}>
            ✨ Daily Decode
          </Text>
          <Text style={styles.dailyDecodeTitle}>{todaysCard.title}</Text>
          <Text style={styles.dailyDecodeBody}>{todaysCard.body}</Text>
          {todaysCard.tip ? (
            <Text style={styles.dailyDecodeTip}>{todaysCard.tip}</Text>
          ) : null}
        </Animated.View>
      )}

      {/* Quick Check-in (Mood) */}
      <Animated.View entering={rise(540)} style={styles.checkInSection}>
        <Text style={styles.sectionTitle}>How are you feeling today?</Text>
        <View style={styles.moodRow}>
          {moodOptions.map((option) => (
            <PressableScale
              key={option.emoji}
              style={styles.moodButton}
              scaleTo={0.88}
              haptic="none"
              onPress={() => onMoodSelect(option.score, option.emoji)}
              accessibilityRole="button"
              accessibilityLabel={`Log mood: ${option.label}`}
            >
              <Text style={styles.moodEmoji}>{option.emoji}</Text>
            </PressableScale>
          ))}
        </View>

        {/* Full check-in CTA — opens the polished modal flow */}
        <PressableScale
          onPress={onOpenFullCheckIn}
          haptic="none"
          style={[styles.fullCheckInButton, { borderColor: phaseColors.primary }]}
          accessibilityRole="button"
          accessibilityLabel={
            hasFullCheckIn
              ? "Update today's check-in"
              : "Open today's full check-in"
          }
        >
          <Text style={[styles.fullCheckInText, { color: phaseColors.primary }]}>
            {hasFullCheckIn ? '✓ ' : '🌸 '}
            {hasFullCheckIn ? "Update today's check-in" : 'Do a full check-in'}
          </Text>
          <Text style={styles.fullCheckInHint}>
            Energy, stress, sleep, symptoms — in one warm sheet.
          </Text>
        </PressableScale>
      </Animated.View>

      {/* Phase-Responsive Questions */}
      {todaysQuestions.length > 0 && (
        <Animated.View entering={rise(620)} style={styles.questionsSection}>
          {todaysQuestions.slice(0, 2).map((q) => (
            <View key={q.id} style={styles.questionsCard}>
              <Text style={[styles.questionLabel, { color: companion.accentColor }]}>
                {companion.name} asks {companion.emoji}
              </Text>
              <Text style={styles.questionText}>{q.text}</Text>
              <View style={styles.questionOptions}>
                {q.options.map((option, idx) => (
                  <PressableScale
                    key={`${q.id}_${idx}`}
                    style={styles.questionChip}
                    scaleTo={0.97}
                    haptic="none"
                    onPress={() => onAnswerQuestion(q.id, option, idx, q.tracksMetric)}
                    accessibilityRole="button"
                    accessibilityLabel={option}
                  >
                    <Text style={styles.questionChipText}>{option}</Text>
                  </PressableScale>
                ))}
              </View>
            </View>
          ))}
        </Animated.View>
      )}

      {/* All caught up message */}
      {todaysQuestions.length === 0 && (
        <Animated.View entering={rise(620)} style={styles.allCaughtUpCard}>
          <Text style={styles.allCaughtUpEmoji}>🌸</Text>
          <Text style={styles.allCaughtUpTitle}>You're all caught up!</Text>
          <Text style={styles.allCaughtUpBody}>
            Come back tomorrow for fresh insights from {companion.name}.
          </Text>
        </Animated.View>
      )}

      {/* Bottom padding for tab bar */}
      <View style={{ height: Spacing.tabBarHeight }} />
    </ScrollView>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────

// Shared entrance rhythm — fade + rise with a soft spring settle.
function rise(delayMs: number) {
  return FadeInDown.duration(560).delay(delayMs).springify().damping(16);
}

const moodOptions: { emoji: string; score: number; label: string }[] = [
  { emoji: '😊', score: 5, label: 'great' },
  { emoji: '🙂', score: 4, label: 'good' },
  { emoji: '😐', score: 3, label: 'okay' },
  { emoji: '😔', score: 2, label: 'low' },
  { emoji: '😤', score: 1, label: 'rough' },
];

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface.background,
  },
  contentContainer: {
    paddingHorizontal: Spacing.screenPadding,
  },
  // Greeting card: outer owns shadow + radius + opaque fallback so the
  // iOS shadow casts; inner owns the rounded clip the gradient fills.
  greetingShadow: {
    backgroundColor: Colors.surface.card,
    borderRadius: Spacing.radius['2xl'],
    marginBottom: Spacing.base,
    ...Shadows.card,
  },
  greetingClip: {
    borderRadius: Spacing.radius['2xl'],
    overflow: 'hidden',
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.cardPadding,
  },
  companionHalo: {
    width: 60,
    height: 60,
    borderRadius: Spacing.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  companionEmoji: {
    fontSize: 34,
  },
  greetingContent: {
    flex: 1,
  },
  greetingText: {
    ...Typography.preset.body,
    color: Colors.text.primary,
    lineHeight: 22,
  },
  phaseBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  phaseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.sm,
  },
  phaseLabel: {
    ...Typography.preset.bodySemibold,
    color: Colors.text.primary,
    flex: 1,
  },
  phaseDay: {
    ...Typography.preset.captionBold,
    color: Colors.text.tertiary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.base,
    marginBottom: Spacing.sectionGap,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface.card,
    padding: Spacing.cardPadding,
    borderRadius: Spacing.radius.xl,
    alignItems: 'center',
    ...Shadows.sm,
  },
  statEmoji: {
    fontSize: 24,
    marginBottom: Spacing.xs,
  },
  statNumber: {
    ...Typography.preset.number,
    color: Colors.text.primary,
  },
  statLabel: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
  },
  dailyDecodeCard: {
    padding: Spacing.cardPaddingLarge,
    borderRadius: Spacing.radius['2xl'],
    marginBottom: Spacing.sectionGap,
    borderLeftWidth: 4,
  },
  dailyDecodeLabel: {
    ...Typography.preset.overline,
    marginBottom: Spacing.sm,
  },
  dailyDecodeTitle: {
    ...Typography.preset.h4,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  dailyDecodeBody: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
    lineHeight: 24,
  },
  dailyDecodeTip: {
    ...Typography.preset.bodySemibold,
    color: Colors.text.primary,
    marginTop: Spacing.md,
    lineHeight: 22,
  },
  checkInSection: {
    marginBottom: Spacing.sectionGap,
  },
  sectionTitle: {
    ...Typography.preset.h4,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.base,
  },
  moodButton: {
    width: 56,
    height: 56,
    backgroundColor: Colors.surface.card,
    borderRadius: Spacing.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  moodEmoji: {
    fontSize: 28,
  },
  fullCheckInButton: {
    backgroundColor: Colors.surface.card,
    borderRadius: Spacing.radius['2xl'],
    padding: Spacing.cardPadding,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: Spacing.xs,
    ...Shadows.sm,
  },
  fullCheckInText: {
    ...Typography.preset.bodySemibold,
    fontSize: 16,
  },
  fullCheckInHint: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
  questionsSection: {
    gap: Spacing.base,
    marginBottom: Spacing.sectionGap,
  },
  questionsCard: {
    backgroundColor: Colors.surface.card,
    padding: Spacing.cardPaddingLarge,
    borderRadius: Spacing.radius['2xl'],
    ...Shadows.card,
  },
  questionLabel: {
    ...Typography.preset.captionBold,
    marginBottom: Spacing.sm,
  },
  questionText: {
    ...Typography.preset.bodyLarge,
    color: Colors.text.primary,
    marginBottom: Spacing.base,
  },
  questionOptions: {
    gap: Spacing.sm,
  },
  questionChip: {
    backgroundColor: Colors.surface.background,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderRadius: Spacing.radius.xl,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  questionChipText: {
    ...Typography.preset.body,
    color: Colors.text.primary,
  },
  allCaughtUpCard: {
    backgroundColor: Colors.surface.card,
    padding: Spacing.cardPaddingLarge,
    borderRadius: Spacing.radius['2xl'],
    alignItems: 'center',
    marginBottom: Spacing.sectionGap,
    ...Shadows.sm,
  },
  allCaughtUpEmoji: {
    fontSize: 36,
    marginBottom: Spacing.sm,
  },
  allCaughtUpTitle: {
    ...Typography.preset.h4,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  allCaughtUpBody: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});
