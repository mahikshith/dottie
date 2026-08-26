import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, type GestureResponderEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { useAurora, PHASE_AURORA } from '../../src/theme';
import {
  AuroraBackground,
  GlassCard,
  ClayButton,
  GlowRing,
  BreathingView,
  PopOnChange,
  PressableScale,
} from '../../src/components/ui';
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
import { todayISO } from '../../src/utils/date.utils';

/**
 * Home Dashboard — The daily ritual screen.
 *
 * ─── MOOD AURORA THEME (design-v2) ──────────────────────────────────
 *
 *  Themed to the mood-driven aurora system:
 *   - The whole screen is wrapped in <AuroraBackground> (dark ground +
 *     drifting blooms). Every colour comes from the active mood palette via
 *     `useAurora()` (inline, since StyleSheet is static and the palette changes
 *     per mood).
 *   - The day sits in a self-drawing <GlowRing>; cards are <GlassCard>s; the
 *     mood keys are <ClayButton>s.
 *   - THE MOOD REVEAL: tapping a mood calls `applyMood(score, {x,y})` with the
 *     tap point, so the new palette RADIATES OUT from the tapped key across the
 *     whole app (see ThemeProvider). This is IN ADDITION to the existing
 *     check-in save/streak/celebration logic — none of which changed.
 *   - On mount, the palette reflects today's already-logged mood.
 *
 *  Child cards (PhaseWeatherCard, DottiePredictsCard) are themed in their own
 *  files — rendered here unchanged.
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device). Verify layout + the reveal on a run.
 *
 * ─── EMOTIONAL TRIO (unchanged) ─────────────────────────────────────
 *    1. Daily Decode · 2. Phase Weather · 3. Dottie Predicts
 *  Companion greeting, phase bar, streak/gems, quick mood, full check-in CTA,
 *  phase-responsive questions, all-caught-up state — all preserved.
 */
export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette, applyMood } = useAurora();

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

  // Selected mood (presentation only — lights the chosen ClayButton).
  const [selectedMood, setSelectedMood] = useState<number | null>(
    todayCheckIn?.moodScore ?? null
  );

  // ─── On mount, reflect today's logged mood in the palette ───────
  useEffect(() => {
    if (todayCheckIn?.moodScore != null) {
      applyMood(todayCheckIn.moodScore); // no origin = instant swap
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    usePhaseWeatherStore.getState().ensureToday();
    void usePredictsStore.getState().ensureToday();
  }, [phase, dayInCycle]);

  // ─── Quick mood tap handler ─────────────────────────────────────
  //
  // The quick path — saying hi in passing. Milestones/level-ups still earn a
  // celebration. Now it ALSO drives the mood-colour reveal from the tap point.
  const onMoodSelect = async (moodScore: number, e: GestureResponderEvent) => {
    setSelectedMood(moodScore);
    applyMood(moodScore, { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const today = todayISO();

    try {
      // 1. Save the check-in (mood field)
      await useCycleStore.getState().saveCheckIn({ date: today, moodScore });

      // 2. Process streak / XP / gems
      const result = await useGamificationStore.getState().recordCheckIn(today);

      // 3. Prefetch tomorrow for an instant feel next time
      useContentStore.getState().prefetchTomorrow();

      // 4. Regenerate the Dottie Predicts deck
      void usePredictsStore.getState().regenerate();

      // 5. Route into a celebration ONLY if it's a notable moment.
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

  const hasFullCheckIn = Boolean(
    todayCheckIn &&
      (todayCheckIn.energyLevel !== null ||
        todayCheckIn.stressLevel !== null ||
        todayCheckIn.sleepQuality !== null)
  );

  const phaseHue = PHASE_AURORA[phase];
  const cycleProgress = Math.min(1, Math.max(0, dayInCycle / 28));

  return (
    <AuroraBackground>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: insets.top + Spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero — greeting + a breathing companion + the day in a glow ring */}
        <Animated.View entering={rise(60)} style={styles.hero}>
          <View style={styles.heroText}>
            <BreathingView style={styles.companionWrap}>
              <Text style={styles.companionEmoji}>{companion.emoji}</Text>
            </BreathingView>
            <Text style={[styles.greetingText, { color: palette.ink }]}>{greeting}</Text>
          </View>
          <GlowRing progress={cycleProgress} size={92}>
            <Text style={[styles.ringDay, { color: palette.ink }]}>{dayInCycle}</Text>
            <Text style={[styles.ringLabel, { color: palette.ink3 }]}>day</Text>
          </GlowRing>
        </Animated.View>

        {/* Phase Indicator */}
        <Animated.View entering={rise(140)} style={styles.phaseBar}>
          <View style={[styles.phaseDot, { backgroundColor: phaseHue }]} />
          <Text style={[styles.phaseLabel, { color: palette.ink }]}>
            {capitalize(phase)} Phase
          </Text>
          <Text style={[styles.phaseDay, { color: palette.ink3 }]}>Day {dayInCycle}</Text>
        </Animated.View>

        {/* Phase Weather — themed in its own file */}
        {weatherView ? (
          <Animated.View entering={rise(220)}>
            <PhaseWeatherCard view={weatherView} />
          </Animated.View>
        ) : null}

        {/* Streak & Gems Row */}
        <Animated.View entering={rise(300)} style={styles.statsRow}>
          <GlassCard style={styles.statCard} padding={Spacing.cardPadding}>
            <Text style={styles.statEmoji}>🔥</Text>
            <PopOnChange value={streak.currentStreak}>
              <Text style={[styles.statNumber, { color: palette.accent }]}>
                {streak.currentStreak}
              </Text>
            </PopOnChange>
            <Text style={[styles.statLabel, { color: palette.ink3 }]}>Day Streak</Text>
          </GlassCard>
          <GlassCard style={styles.statCard} padding={Spacing.cardPadding}>
            <Text style={styles.statEmoji}>💎</Text>
            <PopOnChange value={gemsBalance}>
              <Text style={[styles.statNumber, { color: palette.accent2 }]}>
                {gemsBalance}
              </Text>
            </PopOnChange>
            <Text style={[styles.statLabel, { color: palette.ink3 }]}>Gems</Text>
          </GlassCard>
        </Animated.View>

        {/* Dottie Predicts — themed in its own file */}
        <Animated.View entering={rise(380)}>
          <DottiePredictsCard
            deck={predictsDeck}
            companionName={companion.name}
            companionEmoji={companion.emoji}
          />
        </Animated.View>

        {/* Daily Decode Card */}
        {todaysCard && (
          <Animated.View entering={rise(460)}>
            <GlassCard style={styles.decodeCard}>
              <Text style={[styles.decodeLabel, { color: palette.accent }]}>
                ✨ Daily Decode
              </Text>
              <Text style={[styles.decodeTitle, { color: palette.ink }]}>
                {todaysCard.title}
              </Text>
              <Text style={[styles.decodeBody, { color: palette.ink2 }]}>
                {todaysCard.body}
              </Text>
              {todaysCard.tip ? (
                <Text style={[styles.decodeTip, { color: palette.ink }]}>
                  {todaysCard.tip}
                </Text>
              ) : null}
            </GlassCard>
          </Animated.View>
        )}

        {/* Quick Check-in (Mood) — the mood colours the world */}
        <Animated.View entering={rise(540)} style={styles.checkInSection}>
          <Text style={[styles.sectionTitle, { color: palette.ink }]}>
            How are you feeling today?
          </Text>
          <View style={styles.moodRow}>
            {moodOptions.map((option) => (
              <ClayButton
                key={option.emoji}
                style={styles.moodButton}
                radius={18}
                haptic="none"
                selected={selectedMood === option.score}
                onPress={(e) => onMoodSelect(option.score, e)}
                accessibilityLabel={`Log mood: ${option.label}`}
              >
                <Text style={styles.moodEmoji}>{option.emoji}</Text>
              </ClayButton>
            ))}
          </View>

          {/* Full check-in CTA */}
          <PressableScale
            onPress={onOpenFullCheckIn}
            haptic="none"
            style={[
              styles.fullCheckInButton,
              { backgroundColor: palette.glass.bg, borderColor: palette.accent },
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              hasFullCheckIn ? "Update today's check-in" : "Open today's full check-in"
            }
          >
            <Text style={[styles.fullCheckInText, { color: palette.accent }]}>
              {hasFullCheckIn ? '✓ ' : '🌸 '}
              {hasFullCheckIn ? "Update today's check-in" : 'Do a full check-in'}
            </Text>
            <Text style={[styles.fullCheckInHint, { color: palette.ink3 }]}>
              Energy, stress, sleep, symptoms — in one warm sheet.
            </Text>
          </PressableScale>
        </Animated.View>

        {/* Phase-Responsive Questions */}
        {todaysQuestions.length > 0 && (
          <Animated.View entering={rise(620)} style={styles.questionsSection}>
            {todaysQuestions.slice(0, 2).map((q) => (
              <GlassCard key={q.id} style={styles.questionsCard}>
                <Text style={[styles.questionLabel, { color: palette.accent }]}>
                  {companion.name} asks {companion.emoji}
                </Text>
                <Text style={[styles.questionText, { color: palette.ink }]}>{q.text}</Text>
                <View style={styles.questionOptions}>
                  {q.options.map((option, idx) => (
                    <PressableScale
                      key={`${q.id}_${idx}`}
                      style={[
                        styles.questionChip,
                        { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
                      ]}
                      scaleTo={0.97}
                      haptic="none"
                      onPress={() => onAnswerQuestion(q.id, option, idx, q.tracksMetric)}
                      accessibilityRole="button"
                      accessibilityLabel={option}
                    >
                      <Text style={[styles.questionChipText, { color: palette.ink }]}>
                        {option}
                      </Text>
                    </PressableScale>
                  ))}
                </View>
              </GlassCard>
            ))}
          </Animated.View>
        )}

        {/* All caught up message */}
        {todaysQuestions.length === 0 && (
          <Animated.View entering={rise(620)}>
            <GlassCard style={styles.allCaughtUpCard}>
              <Text style={styles.allCaughtUpEmoji}>🌸</Text>
              <Text style={[styles.allCaughtUpTitle, { color: palette.ink }]}>
                You're all caught up!
              </Text>
              <Text style={[styles.allCaughtUpBody, { color: palette.ink2 }]}>
                Come back tomorrow for fresh insights from {companion.name}.
              </Text>
            </GlassCard>
          </Animated.View>
        )}

        {/* Bottom padding for tab bar */}
        <View style={{ height: Spacing.tabBarHeight }} />
      </ScrollView>
    </AuroraBackground>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────

function rise(delayMs: number) {
  return FadeInDown.duration(560).delay(delayMs).springify().damping(16);
}

function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const moodOptions: { emoji: string; score: number; label: string }[] = [
  { emoji: '😤', score: 1, label: 'rough' },
  { emoji: '😔', score: 2, label: 'low' },
  { emoji: '😐', score: 3, label: 'okay' },
  { emoji: '🙂', score: 4, label: 'good' },
  { emoji: '😊', score: 5, label: 'great' },
];

// ─── STYLES (layout only — colours are inline, palette-driven) ───────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  contentContainer: {
    paddingHorizontal: Spacing.screenPadding,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.base,
  },
  heroText: {
    flex: 1,
  },
  companionWrap: {
    alignSelf: 'flex-start',
    marginBottom: Spacing.sm,
  },
  companionEmoji: {
    fontSize: 40,
  },
  greetingText: {
    ...Typography.preset.body,
    lineHeight: 22,
  },
  ringDay: {
    ...Typography.preset.number,
    fontSize: 26,
  },
  ringLabel: {
    ...Typography.preset.caption,
    fontSize: 10,
    marginTop: 1,
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
    flex: 1,
  },
  phaseDay: {
    ...Typography.preset.captionBold,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.base,
    marginBottom: Spacing.sectionGap,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statEmoji: {
    fontSize: 24,
    marginBottom: Spacing.xs,
  },
  statNumber: {
    ...Typography.preset.number,
  },
  statLabel: {
    ...Typography.preset.caption,
  },
  decodeCard: {
    marginBottom: Spacing.sectionGap,
  },
  decodeLabel: {
    ...Typography.preset.overline,
    marginBottom: Spacing.sm,
  },
  decodeTitle: {
    ...Typography.preset.h4,
    marginBottom: Spacing.sm,
  },
  decodeBody: {
    ...Typography.preset.body,
    lineHeight: 24,
  },
  decodeTip: {
    ...Typography.preset.bodySemibold,
    marginTop: Spacing.md,
    lineHeight: 22,
  },
  checkInSection: {
    marginBottom: Spacing.sectionGap,
  },
  sectionTitle: {
    ...Typography.preset.h4,
    marginBottom: Spacing.md,
  },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  moodButton: {
    flex: 1,
    aspectRatio: 1,
  },
  moodEmoji: {
    fontSize: 26,
  },
  fullCheckInButton: {
    borderRadius: Spacing.radius['2xl'],
    padding: Spacing.cardPadding,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  fullCheckInText: {
    ...Typography.preset.bodySemibold,
    fontSize: 16,
  },
  fullCheckInHint: {
    ...Typography.preset.caption,
    textAlign: 'center',
  },
  questionsSection: {
    gap: Spacing.base,
    marginBottom: Spacing.sectionGap,
  },
  questionsCard: {},
  questionLabel: {
    ...Typography.preset.captionBold,
    marginBottom: Spacing.sm,
  },
  questionText: {
    ...Typography.preset.bodyLarge,
    marginBottom: Spacing.base,
  },
  questionOptions: {
    gap: Spacing.sm,
  },
  questionChip: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderRadius: Spacing.radius.xl,
    borderWidth: 1,
  },
  questionChipText: {
    ...Typography.preset.body,
  },
  allCaughtUpCard: {
    alignItems: 'center',
    marginBottom: Spacing.sectionGap,
  },
  allCaughtUpEmoji: {
    fontSize: 36,
    marginBottom: Spacing.sm,
  },
  allCaughtUpTitle: {
    ...Typography.preset.h4,
    marginBottom: Spacing.xs,
  },
  allCaughtUpBody: {
    ...Typography.preset.body,
    textAlign: 'center',
  },
});
