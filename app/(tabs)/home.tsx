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
  CompanionWave,
  CompanionLottie,
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
  selectHasCycleData,
  selectGemsBalance,
  selectStreak,
  selectRecentSymptoms,
  selectTodaysCard,
  selectTodaysQuestions,
  selectUserMode,
  selectWeatherSnapshot,
  selectPredictsDeck,
} from '../../src/stores';
import { getCompanion } from '../../src/content/companions';
import { animForMood } from '../../src/content/companion-lottie';
import { getTimeGreeting, getTimeOfDay } from '../../src/engine/content';
import { buildWeatherView } from '../../src/engine/phase-weather/aggregator';
import { PhaseWeatherCard } from '../../src/components/home/PhaseWeatherCard';
import { MoodMap } from '../../src/components/mood/MoodMap';
import { buildMoodMap } from '../../src/engine/mood/mood-map';
import { checkinRepository } from '../../src/database/repositories/checkin.repo';
import { addDays, todayCivil } from '../../src/utils/civil-date';
import { DottiePredictsCard } from '../../src/components/home/DottiePredictsCard';
import { TodayAtAGlanceCard } from '../../src/components/home/TodayAtAGlanceCard';
import { todayISO } from '../../src/utils/date.utils';
import type { HealthCondition } from '../../src/types/cycle.types';

// Stable empty fallback so a null health profile doesn't return a fresh []
// each render (would ping-pong the memo below).
const EMPTY_CONDITIONS: HealthCondition[] = [];

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

  // The day ring, the "see more" link and the phase card all mean the same
  // thing — "show me my cycle" — so they share one handler.
  const goToCalendar = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push('/(tabs)/calendar');
  };
  const insets = useSafeAreaInsets();
  const { palette, applyMood } = useAurora();

  // ─── Live store reads via selectors (efficient re-renders) ────
  const companionType = useUserStore(selectCompanionType);
  const phase = useCycleStore(selectCurrentPhase);
  const dayInCycle = useCycleStore(selectDayInCycle);
  const hasCycleData = useCycleStore(selectHasCycleData);
  const todayCheckIn = useCycleStore((s) => s.todayCheckIn);
  // streak + gems moved to the Learn tab (gamification lives there now)
  const todaysCard = useContentStore(selectTodaysCard);
  const todaysQuestions = useContentStore(selectTodaysQuestions);
  const weatherSnapshot = usePhaseWeatherStore(selectWeatherSnapshot);
  const predictsDeck = usePredictsStore(selectPredictsDeck);
  // Inputs for the Today-at-a-glance narrative (day-suggestion engine v2).
  const recentSymptoms = useCycleStore(selectRecentSymptoms);
  const latestPrediction = useCycleStore((s) => s.latestPrediction);
  const userMode = useUserStore(selectUserMode);
  const conditions = useUserStore((s) => s.user?.healthProfile.conditions) ?? EMPTY_CONDITIONS;

  // ─── MOOD MAP DATA ──────────────────────────────────────────────
  //
  //  Loaded here rather than in the component so the card stays a pure
  //  renderer, and re-loaded whenever today's check-in changes — logging a
  //  mood should fill in today's square immediately, not after a restart.
  const [moodEntries, setMoodEntries] = useState<{ date: string; moodScore: number | null }[]>([]);
  const [mapWidth, setMapWidth] = useState(0);
  const MOOD_MAP_DAYS = 91;

  useEffect(() => {
    const uid = useUserStore.getState().userId;
    if (!uid) return;
    let cancelled = false;
    const today = todayCivil();
    checkinRepository
      .getCheckInsInRange(uid, addDays(today, -MOOD_MAP_DAYS), today)
      .then((rows) => {
        if (cancelled) return;
        setMoodEntries(rows.map((r) => ({ date: r.date, moodScore: r.moodScore })));
      })
      .catch(() => {
        // Non-fatal: the map just stays empty. Home must still render.
      });
    return () => {
      cancelled = true;
    };
  }, [todayCheckIn?.moodScore, todayCheckIn?.date]);

  const moodMap = useMemo(
    () => buildMoodMap(moodEntries, todayCivil(), MOOD_MAP_DAYS),
    [moodEntries]
  );
  // Today is treated as a period day when the current phase is menstrual —
  // good enough for the Home summary (the calendar day sheet uses the
  // actual period_days set for the precise per-day marker).

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

  // ─── First-run walkthrough auto-launch: DISABLED ────────────────
  // Device-test #4: owner reported the walkthrough was surfacing an
  // artifact (a persistent white circle top-left) even when supposedly
  // skipped, and hanging the interaction. Rather than chase the ghost
  // in the overlay, we take the safer path: the tour is now opt-in only
  // via Profile → "Show me around again" (which calls
  // useWalkthroughStore.getState().restart()). No user is auto-nagged
  // and no crashed-mid-tour state can re-surface silently.

  // ─── Compose greeting (time + MOOD + phase) ─────────────────────
  //
  // device-test-6: this was a fixed per-phase string with a hardcoded newline —
  // it burned two lines of prime space and said the same cheerful thing whether
  // the user felt great or awful. Someone who just logged "rough" and gets
  // bounced at is gone in three seconds. So: no forced line break (let it wrap
  // naturally), and when we know today's mood we LEAD with it, rotating the
  // wording daily so it never reads like a canned banner.
  const greeting = useMemo(() => {
    const timePart = getTimeGreeting(getTimeOfDay());
    const mood = todayCheckIn?.moodScore ?? null;
    // Deterministic daily rotation — same all day, different tomorrow.
    const seed = new Date().getDate();

    if (mood != null) {
      return `${timePart} — ${moodAwareLine(mood, seed)}`;
    }
    if (!hasCycleData) {
      // No period logged yet — stay honest, don't imply a phase.
      return `${timePart}! Let's learn your rhythm together 🌱`;
    }
    return `${timePart}! ${companion.greetings[phase]}`;
  }, [companion, phase, hasCycleData, todayCheckIn?.moodScore]);

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
          {
            paddingTop: insets.top + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.tabBarClearance,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── HERO ──────────────────────────────────────────────────
            Companion on the left, day ring on the right, and they now sit on
            the SAME baseline. Before, the companion was pinned to the top of a
            text column that also held the greeting, so its height depended on
            how long the greeting wrapped — the two never lined up, and the
            version badge used to sit over the ring as well (device-test-8).
            The badge is gone (You → About this build) and the row is a real
            two-column layout: companion + greeting share the left column, the
            ring is its own column, both vertically centred. */}
        <Animated.View entering={rise(60)} style={styles.hero}>
          <View style={styles.heroLeft}>
            {/* The DRAWN companion, reacting to how the user said they feel.
                Always the creature the user chose — see CompanionLottie. */}
            <CompanionWave>
              <CompanionLottie
                type={companionType}
                state={animForMood(todayCheckIn?.moodScore ?? null)}
                size={64}
              />
            </CompanionWave>
            <Text style={[styles.greetingText, { color: palette.ink }]}>{greeting}</Text>
          </View>
          {hasCycleData && (
            // The ring answers "where am I in my cycle?", so tapping it should
            // take you to the cycle — the owner kept tapping it expecting that.
            <PressableScale
              onPress={goToCalendar}
              haptic="none"
              scaleTo={0.94}
              accessibilityRole="button"
              accessibilityLabel={`Day ${dayInCycle} of your cycle. Open the calendar.`}
            >
              <GlowRing progress={cycleProgress} size={96}>
                <Text style={[styles.ringDay, { color: palette.ink }]}>{dayInCycle}</Text>
                <Text style={[styles.ringLabel, { color: palette.ink3 }]}>day</Text>
              </GlowRing>
            </PressableScale>
          )}
        </Animated.View>

        {/* No period logged yet → honest get-started, no phase guessing */}
        {!hasCycleData && (
          <Animated.View entering={rise(140)}>
            <GlassCard style={styles.getStartedCard}>
              <Text style={styles.getStartedEmoji}>🌙</Text>
              <Text style={[styles.getStartedTitle, { color: palette.ink }]}>Let&apos;s learn your rhythm</Text>
              <Text style={[styles.getStartedBody, { color: palette.ink2 }]}>
                Log your last period and I&apos;ll personalize your phases, predictions, and daily
                decode. Until then, I won&apos;t guess.
              </Text>
              <PressableScale
                onPress={() => router.push('/(tabs)/calendar')}
                haptic="light"
                style={[styles.getStartedCta, { backgroundColor: palette.accent }]}
                accessibilityRole="button"
                accessibilityLabel="Log your last period"
              >
                <Text style={[styles.getStartedCtaText, { color: palette.ground }]}>🩸 Log your last period</Text>
              </PressableScale>
            </GlassCard>
          </Animated.View>
        )}

        {hasCycleData && (
          <>
        {/* Phase Indicator */}
        <Animated.View entering={rise(140)} style={styles.phaseBar}>
          <View style={[styles.phaseDot, { backgroundColor: phaseHue }]} />
          <Text style={[styles.phaseLabel, { color: palette.ink }]}>
            {capitalize(phase)} Phase
          </Text>
          <Text style={[styles.phaseDay, { color: palette.ink3 }]}>Day {dayInCycle}</Text>
        </Animated.View>

        {/* What this day actually means — a plain, warm one-liner so the day
            number isn't a bare figure. Owner ask: "when they see day 0/1/2 we
            should show what it actually means." Non-diagnostic. */}
        <Animated.View entering={rise(150)}>
          <Text style={[styles.dayMeaning, { color: palette.ink2 }]}>
            {dayMeaning(phase, dayInCycle)}
          </Text>
        </Animated.View>

        {/* TODAY AT A GLANCE — Clue-style narrative for today (sub-phase +
            hormone story + personal signal + one tip + track chips). Uses
            the same engine as the calendar day sheet — see
            docs/DAY-SUGGESTIONS.md. */}
        <Animated.View entering={rise(180)}>
          <TodayAtAGlanceCard
            phase={phase}
            dayInCycle={dayInCycle}
            daysUntilPredictedPeriod={
              latestPrediction
                ? Math.max(
                    -30,
                    Math.min(
                      30,
                      Math.round(
                        (new Date(latestPrediction.predictedNextPeriod).getTime() -
                          new Date(todayISO() + 'T00:00:00').getTime()) /
                          86400000
                      )
                    )
                  )
                : null
            }
            isPeriodDay={phase === 'menstrual'}
            mode={userMode}
            conditions={conditions}
            todayCheckIn={todayCheckIn}
            recentSymptoms={recentSymptoms}
            companionEmoji={companion.emoji}
            onSeeMore={() => {
              Haptics.selectionAsync().catch(() => {});
              router.push('/(tabs)/calendar');
            }}
            onTrack={() => {
              Haptics.selectionAsync().catch(() => {});
              router.push('/(modals)/daily-checkin');
            }}
          />
        </Animated.View>

        {/* Phase Weather — themed in its own file */}
        {weatherView ? (
          <Animated.View entering={rise(220)}>
            <PhaseWeatherCard view={weatherView} />
          </Animated.View>
        ) : null}


        {/* ─── MOOD MAP ──────────────────────────────────────────────
            The last three months of check-ins as a contribution-style grid,
            with the distribution underneath. Always rendered: with nothing
            logged it shows an empty grid and an invitation, which is a truer
            first impression than hiding the feature until it has data — you
            can see the shape of what you're about to fill in. */}
        <Animated.View entering={rise(250)}>
          <GlassCard style={styles.moodMapCard}>
            <View onLayout={(e) => setMapWidth(e.nativeEvent.layout.width)}>
              {mapWidth > 0 ? <MoodMap map={moodMap} width={mapWidth} /> : null}
            </View>
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
          </>
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

        {/* Phase-Responsive Questions (only once we know the phase) */}
        {hasCycleData && todaysQuestions.length > 0 && (
          <Animated.View entering={rise(620)} style={styles.questionsSection}>
            {todaysQuestions.slice(0, 2).map((q) => (
              <GlassCard key={q.id} style={styles.questionsCard}>
                <Text style={[styles.questionLabel, { color: palette.accent }]}>
                  {companion.name} asks {companion.emoji}
                </Text>
                <Text style={[styles.questionText, { color: palette.ink }]}>{q.rawText}</Text>
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
        {hasCycleData && todaysQuestions.length === 0 && (
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

/**
 * Mood-led greeting lines. Three bands x several variants, rotated by the day of
 * the month so the home screen never greets the user with the same sentence two
 * days running. Non-diagnostic and never bouncy at someone having a hard day.
 */
const MOOD_LINES: Record<'low' | 'mid' | 'high', readonly string[]> = {
  low: [
    'rough one today. Nothing here needs you at your best. 🤍',
    'a heavy day. Go gently — logging one thing is plenty.',
    'not your day, huh. Rest counts as looking after yourself.',
    'tough going. I\'ll keep things short today.',
  ],
  mid: [
    'a steady sort of day. That\'s a good place to be.',
    'ticking along. Anything you log today helps future you.',
    'an ordinary day — those are underrated.',
    'holding steady. I\'m here if you want to note anything.',
  ],
  high: [
    'you\'re feeling good today — love that. ✨',
    'good energy today. Worth remembering this one.',
    'a bright day. Let\'s make the most of it.',
    'you\'re on form today. 🌞',
  ],
};

function moodAwareLine(moodScore: number, seed: number): string {
  const band = moodScore <= 2 ? 'low' : moodScore >= 4 ? 'high' : 'mid';
  const pool = MOOD_LINES[band];
  return pool[seed % pool.length]!;
}

/**
 * A warm, plain-language meaning for the current cycle day, shown under the day
 * ring so the day number carries significance instead of standing alone.
 *
 * Owner ask (device-test-6): the day number must explicitly tell the user what
 * it counts — "days since you last logged your period" — not just a phase mood.
 * So we lead with the concrete anchor (Day N == N-1 days since the period
 * started, and it RESETS every time a newer period start is logged), then add
 * the non-diagnostic phase tendency. Never "your body is doing X."
 */
function dayMeaning(phase: string, dayInCycle: number): string {
  const since =
    dayInCycle <= 1
      ? 'Your period started today — this is Day 1 of your new cycle.'
      : `Day ${dayInCycle} — it's been ${dayInCycle - 1} ${
          dayInCycle - 1 === 1 ? 'day' : 'days'
        } since your last period started.`;
  const tendency = phaseTendency(phase);
  return `${since} ${tendency}`;
}

/** Non-diagnostic phase tendency, appended after the concrete day anchor. */
function phaseTendency(phase: string): string {
  switch (phase) {
    case 'menstrual':
      return 'Your body is resetting — rest is completely valid right now.';
    case 'follicular':
      return 'Energy tends to build back up as this phase goes on.';
    case 'ovulatory':
      return 'Energy and mood often peak around now for many people.';
    case 'luteal':
      return 'A winding-down stretch — be gentle with yourself.';
    default:
      return 'Every body has its own rhythm.';
  }
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
  moodMapCard: { padding: Spacing.cardPadding, marginBottom: Spacing.base },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.base,
  },
  // Companion and greeting stacked, centred against the ring beside them.
  heroLeft: {
    flex: 1,
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  companionEmoji: {
    fontSize: 40,
  },
  greetingText: {
    ...Typography.preset.body,
    lineHeight: 22,
  },
  // Font consistency (device-test-6): these used to override the type ramp with
  // arbitrary sizes (26 / 10 / 16). Emoji below are deliberately sized as
  // GRAPHICS, but text must stay on the ramp or the screen reads as three
  // different apps stacked together.
  ringDay: {
    ...Typography.preset.number,
  },
  ringLabel: {
    ...Typography.preset.caption,
    fontSize: Typography.size.xs,
    marginTop: 1,
  },
  phaseBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  dayMeaning: {
    ...Typography.preset.caption,
    lineHeight: 18,
    marginBottom: Spacing.base,
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
  getStartedCard: {
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sectionGap,
  },
  getStartedEmoji: { fontSize: 44 },
  getStartedTitle: {
    ...Typography.preset.h3,
    textAlign: 'center',
  },
  getStartedBody: {
    ...Typography.preset.body,
    textAlign: 'center',
    lineHeight: 22,
  },
  getStartedCta: {
    alignSelf: 'stretch',
    height: Spacing.buttonHeight.md,
    borderRadius: Spacing.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  getStartedCtaText: {
    ...Typography.preset.button,
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
