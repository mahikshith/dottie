/**
 * Calendar Tab — MOOD AURORA THEME (design-v2)
 *
 * Visual cycle calendar, re-skinned onto the aurora world: a luminous dark
 * ground (AuroraBackground), glass surfaces (phase summary + legend), and day
 * cells that glow in their PHASE_AURORA hue. The whole screen re-tints with the
 * active mood palette via `useAurora()` — colours are inline; the StyleSheet is
 * layout only.
 *
 * ─── WHAT THIS DELIVERS (unchanged) ─────────────────────────────────
 *
 *  - Month grid with color-coded phase days (live data)
 *  - Period days marked from actual `cycle_entries` rows
 *  - Predicted next period band overlaid in a lighter/dashed treatment
 *  - Tap a day → quick action sheet to log it as a period day
 *  - Phase summary showing current position in cycle
 *  - Confidence-aware prediction message (gentle, never alarming)
 *
 * ─── WHAT CHANGED IN THIS PASS ──────────────────────────────────────
 *
 *  Presentation only. The grid math (`buildMonthGrid`), phase computation,
 *  tap-to-log handler, month navigation, every store read, and all date
 *  helpers are byte-for-byte unchanged from the polished version. Only the
 *  colours + surfaces moved to the palette:
 *   - Screen wrapped in <AuroraBackground>; StatusBar flipped to light so it
 *     reads on the dark ground.
 *   - Phase colours now come from PHASE_AURORA (constant across moods — phase
 *     identity must not shift with mood), tinted via 8-digit-hex alpha.
 *   - Phase summary + legend chips are GlassCards / glass pills.
 *   - Day cells: period = filled phase hue with ground-dark ink; predicted =
 *     dashed hue on glass; phase day = soft hue tint; today = accent ring.
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, PanResponder, type GestureResponderEvent } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { findCycleOverlaps } from '../../src/engine/calendar/cycle-overlap';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { PressableScale, AuroraBackground, GlassCard } from '../../src/components/ui';
import { useAurora, PHASE_AURORA, A } from '../../src/theme';
import {
  useCycleStore,
  useUserStore,
  useSisterhoodStore,
  selectCurrentPhase,
  selectDayInCycle,
  selectLastPeriodStart,
  selectPredictionMessage,
  selectRecentSymptoms,
  selectUserMode,
  selectMemberCount,
  selectMemberViewsOrdered,
} from '../../src/stores';
import { cycleRepository } from '../../src/database/repositories/cycle.repo';
import { sisterhoodRepository } from '../../src/database/repositories/sisterhood.repo';
import { buildSisterOverlay, type SisterDayMark } from '../../src/engine/calendar/sister-overlay';
import { analysePeriodPattern } from '../../src/engine/calendar/period-blocks';
import { log, timed } from '../../src/diagnostics/logger';
import { calculateCurrentPhase } from '../../src/engine/prediction/phase-calculator';
import { Phase, type HealthCondition } from '../../src/types/cycle.types';
import { DayDetailSheet, type DayDetailResult } from '../../src/components/calendar/DayDetailSheet';
import { WeekAheadStrip, type WeekAheadItem } from '../../src/components/calendar/WeekAheadStrip';
import { PredictionExplainerCard } from '../../src/components/calendar/PredictionExplainerCard';
import { buildDaySuggestions } from '../../src/engine/calendar/day-suggestions';
import { Storage } from '../../src/database/storage';

// Shared empty array so the conditions selector stays referentially stable
// (returning a fresh `[]` from a selector thrashes re-renders / warns).
const EMPTY_CONDITIONS: HealthCondition[] = [];

/** A day the user tapped open in the detail sheet. */
interface SelectedDay {
  iso: string;
  phase: Phase;
  /** 1-indexed day within the cycle for THIS date; null when no cycle data. */
  dayInCycle: number | null;
  isPeriodDay: boolean;
  isFuture: boolean;
  daysUntilPredictedPeriod: number | null;
  origin: { x: number; y: number };
}

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { palette } = useAurora();
  // Sister count drives the copy on the loved-ones bridge card below.
  const sisterCount = useSisterhoodStore(selectMemberCount);
  const sisterViews = useSisterhoodStore(selectMemberViewsOrdered);

  // ─── Live state ─────────────────────────────────────────────────
  const phase = useCycleStore(selectCurrentPhase);
  const dayInCycle = useCycleStore(selectDayInCycle);
  const lastPeriodStart = useCycleStore(selectLastPeriodStart);
  const predictionMessage = useCycleStore(selectPredictionMessage);
  const latestPrediction = useCycleStore((s) => s.latestPrediction);
  // Number of full cycles observed — drives the "backfill recent months" nudge
  // (predictions stay coarse until a couple of real cycles are logged).
  const cycleCount = useCycleStore((s) => s.cycleCount);
  const userHealth = useUserStore((s) => s.user?.healthProfile);
  const userId = useUserStore((s) => s.userId);
  const mode = useUserStore(selectUserMode);
  const conditions = useUserStore((s) => s.user?.healthProfile.conditions) ?? EMPTY_CONDITIONS;
  // Personalisation inputs for the day-suggestion engine v2 — today's
  // check-in surfaces mood/energy/sleep/stress signals, and the recent
  // symptoms feed the dominant-symptom pattern nudge. Both are safe if empty.
  const todayCheckIn = useCycleStore((s) => s.todayCheckIn);
  const recentSymptoms = useCycleStore(selectRecentSymptoms);

  // ─── Month navigation state ─────────────────────────────────────
  const [viewedMonth, setViewedMonth] = useState<Date>(startOfMonth(new Date()));
  const [periodDays, setPeriodDays] = useState<Set<string>>(new Set());

  // ─── Planner popover state ──────────────────────────────────────
  const [selected, setSelected] = useState<SelectedDay | null>(null);
  // Days with a saved plan/note (drives the planning dot). Reloaded when the
  // sheet closes via the bump counter.
  const [plannedDays, setPlannedDays] = useState<Set<string>>(new Set());
  const [plansVersion, setPlansVersion] = useState(0);

  // ─── Sister overlay state (device-test-6) ───────────────────────
  // The owner asked to stop maintaining a SECOND calendar for Sisterhood: one
  // grid, everyone on it, sisters painted in their own colour, and a heads-up
  // when someone's period is coming. `logTargetId === null` means "logging for
  // me"; otherwise it's the shadow member the taps are being recorded against.
  const [sisterDaysByMember, setSisterDaysByMember] = useState<Record<string, string[]>>({});
  const [sisterVersion, setSisterVersion] = useState(0);
  const [logTargetId, setLogTargetId] = useState<string | null>(null);

  // Deep link from a sister's profile: /(tabs)/calendar?logFor=<memberId>.
  // The sisterhood screens no longer own a date picker — "Log a period day"
  // brings you HERE with that sister already selected, so there is exactly one
  // calendar in the app (device-test-8).
  const { logFor } = useLocalSearchParams<{ logFor?: string }>();
  useEffect(() => {
    if (typeof logFor === 'string' && logFor.length > 0) setLogTargetId(logFor);
  }, [logFor]);

  useEffect(() => {
    const all = Storage.dayPlans.getAll();
    const set = new Set<string>();
    for (const [iso, plan] of Object.entries(all)) {
      if (plan.planned || plan.note?.trim()) set.add(iso);
    }
    setPlannedDays(set);
  }, [plansVersion]);

  // ─── Load period days for the visible month range ───────────────
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    const start = formatISO(startOfMonth(viewedMonth));
    const end = formatISO(endOfMonth(viewedMonth));

    cycleRepository
      .getPeriodDaysInRange(userId, start, end)
      .then((days) => {
        if (!cancelled) setPeriodDays(new Set(days));
      })
      .catch((err) => {
        if (__DEV__) console.warn('[Calendar] getPeriodDaysInRange failed:', err);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, viewedMonth]);

  // ─── Compute calendar grid ──────────────────────────────────────
  const monthGrid = useMemo(
    () =>
      buildMonthGrid({
        viewedMonth,
        lastPeriodStart,
        avgCycleLength: userHealth?.averageCycleLength ?? 28,
        avgPeriodLength: userHealth?.averagePeriodLength ?? 5,
        periodDays,
        predictedNextPeriod: latestPrediction?.predictedNextPeriod ?? null,
        predictionWindowDays: latestPrediction?.windowDays ?? 3,
      }),
    [
      viewedMonth,
      lastPeriodStart,
      userHealth?.averageCycleLength,
      userHealth?.averagePeriodLength,
      periodDays,
      latestPrediction?.predictedNextPeriod,
      latestPrediction?.windowDays,
    ]
  );

  const monthLabel = useMemo(
    () =>
      viewedMonth.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      }),
    [viewedMonth]
  );

  // ─── Reload the visible month's period days (after a log) ───────
  const reloadPeriodDays = async () => {
    if (!userId) return;
    try {
      const days = await cycleRepository.getPeriodDaysInRange(
        userId,
        formatISO(startOfMonth(viewedMonth)),
        formatISO(endOfMonth(viewedMonth))
      );
      setPeriodDays(new Set(days));
    } catch (err) {
      if (__DEV__) console.warn('[Calendar] getPeriodDaysInRange failed:', err);
    }
  };

  // ─── Open the planner popover for a date (shared by grid + week strip) ──
  const todayIso = formatISO(new Date());
  const buildSelected = (iso: string, isFuture: boolean, e: GestureResponderEvent): SelectedDay => ({
    iso,
    phase: phaseForDate(iso, lastPeriodStart, userHealth) ?? phase,
    dayInCycle: dayInCycleForDate(iso, lastPeriodStart, userHealth),
    isPeriodDay: periodDays.has(iso),
    isFuture,
    daysUntilPredictedPeriod: daysUntil(iso, latestPrediction?.predictedNextPeriod ?? null),
    origin: { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY },
  });

  // Day tap on the month grid → open the popover. Future days ARE tappable now
  // (the point of a planner); period-logging inside the sheet stays past/today.
  const onDayTap = (iso: string, cell: MonthCell, e: GestureResponderEvent) => {
    if (!cell.inMonth) return;
    Haptics.selectionAsync().catch(() => {});
    setSelected(buildSelected(iso, cell.isFuture, e));
  };

  const onWeekDayPress = (iso: string, e: GestureResponderEvent) => {
    setSelected(buildSelected(iso, iso > todayIso, e));
  };

  // ─── Week-ahead model: next 7 days from today ───────────────────
  const weekAhead = useMemo<WeekAheadItem[]>(() => {
    const predicted = latestPrediction?.predictedNextPeriod ?? null;
    const windowDays = latestPrediction?.windowDays ?? 3;
    const avgPeriodLength = userHealth?.averagePeriodLength ?? 5;
    const base = new Date(`${todayIso}T00:00:00`);
    const items: WeekAheadItem[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      const iso = formatISO(d);
      const p = phaseForDate(iso, lastPeriodStart, userHealth) ?? phase;
      const isPeriodDay = periodDays.has(iso);
      const du = daysUntil(iso, predicted);
      const set = buildDaySuggestions({
        phase: p,
        daysUntilPredictedPeriod: du,
        isPeriodDay,
        mode,
        conditions,
      });
      items.push({
        iso,
        dayLabel: d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase(),
        dayNum: d.getDate(),
        phase: p,
        mini: miniLabel(set.headline, du),
        isWindow: inPredictedWindow(iso, predicted, windowDays, avgPeriodLength),
        isPeriodDay,
        planned: plannedDays.has(iso),
        isToday: iso === todayIso,
      });
    }
    return items;
  }, [
    todayIso,
    lastPeriodStart,
    userHealth,
    phase,
    periodDays,
    latestPrediction?.predictedNextPeriod,
    latestPrediction?.windowDays,
    mode,
    conditions,
    plannedDays,
  ]);

  // Log the currently-selected day as a period day (from inside the sheet).
  const onLogSelectedPeriod = async (flowLevel: number) => {
    if (!selected) return;
    try {
      // Diagnostics: this is the exact path that used to wedge, so it's
      // bracketed. If a stall follows, the log shows whether it happened during
      // the write or after it.
      log.action('logPeriodDay:start', { forSister: logTargetId !== null, date: selected.iso });
      if (logTargetId) {
        // Logging on behalf of a sister — same calendar, same sheet, different
        // person. The store action also rebuilds her member view so her
        // predicted date (and the heads-up) update straight away.
        await useSisterhoodStore
          .getState()
          .logShadowPeriod(phase, { memberId: logTargetId, date: selected.iso, flowLevel });
        setSisterVersion((v) => v + 1);
      } else {
        await timed('store.logPeriodDay', () =>
          useCycleStore.getState().logPeriodDay({ date: selected.iso, flowLevel })
        );
        await timed('calendar.reloadPeriodDays', () => reloadPeriodDays());
      }
      log.action('logPeriodDay:done');
    } catch (err) {
      log.error('logPeriodDay failed', { message: String(err) });
      if (__DEV__) console.warn('[Calendar] logPeriodDay failed:', err);
    }
  };

  // Close the sheet — persist the note/planned flag, refresh dots + periods.
  const onSheetClose = (result: DayDetailResult) => {
    if (selected) {
      Storage.dayPlans.set(selected.iso, { note: result.note, planned: result.planned });
    }
    setSelected(null);
    setPlansVersion((v) => v + 1);
    void reloadPeriodDays();
  };

  // ─── Month nav handlers ─────────────────────────────────────────
  const goToday = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setViewedMonth(startOfMonth(new Date()));
  };

  // ─── Month paging by SWIPE (owner ask: drop the arrows) ─────────
  //  A horizontal fling on the grid pages the month: swipe LEFT → next month,
  //  swipe RIGHT → previous. Core-RN PanResponder (no GestureHandlerRootView at
  //  the root — same reason AuroraSlider/AuroraTabBar use it). It only claims a
  //  clearly-horizontal drag (>18px, and more horizontal than vertical), so day
  //  taps and the outer vertical ScrollView both keep working. Functional
  //  setState avoids any stale-closure month value.
  const monthSwipe = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
      onPanResponderRelease: (_e, g) => {
        if (g.dx <= -40) {
          Haptics.selectionAsync().catch(() => {});
          setViewedMonth((m) => shiftMonth(m, 1));
        } else if (g.dx >= 40) {
          Haptics.selectionAsync().catch(() => {});
          setViewedMonth((m) => shiftMonth(m, -1));
        }
      },
    })
  ).current;

  // ─── Sister overlay: who else is on this calendar ───────────────
  // Only members whose privacy level actually exposes cycle data are drawn.
  // That decision lives HERE (where the privacy level is), never in the pure
  // engine — the engine trusts whatever it's handed.
  const overlaySisters = useMemo(
    () => sisterViews.filter((v) => v.privacyLevel === 'full' || v.privacyLevel === 'summary'),
    [sisterViews]
  );
  // You can only LOG on behalf of shadow members — a linked sister records her
  // own days on her own phone.
  const loggableSisters = useMemo(
    () => sisterViews.filter((v) => v.kind === 'shadow'),
    [sisterViews]
  );

  useEffect(() => {
    if (overlaySisters.length === 0) {
      setSisterDaysByMember({});
      return;
    }
    let cancelled = false;
    const start = formatISO(startOfMonth(viewedMonth));
    const end = formatISO(endOfMonth(viewedMonth));
    Promise.all(
      overlaySisters.map(
        async (v) =>
          [v.memberId, await sisterhoodRepository.getShadowPeriodDaysInRange(v.memberId, start, end)] as const
      )
    )
      .then((pairs) => {
        if (!cancelled) setSisterDaysByMember(Object.fromEntries(pairs));
      })
      .catch((err) => {
        if (__DEV__) console.warn('[Calendar] sister period days failed:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [overlaySisters, viewedMonth, sisterVersion]);

  // Where your predicted days and a sister's could land together. Pure engine
  // (findCycleOverlaps), tested by npm run test:overlap. Reports a scheduling
  // fact about two predictions — never a claim that cycles "sync".
  const cycleOverlaps = useMemo(
    () =>
      findCycleOverlaps({
        userPredictedStart: latestPrediction?.predictedNextPeriod ?? null,
        userPeriodLengthDays: userHealth?.averagePeriodLength ?? null,
        userWindowDays: latestPrediction?.windowDays ?? 2,
        sisters: overlaySisters.map((v) => ({
          memberId: v.memberId,
          displayName: v.displayName,
          emoji: v.emoji,
          predictedNextPeriod: v.predictedNextPeriod,
        })),
        today: formatISO(new Date()),
      }),
    [latestPrediction, userHealth, overlaySisters]
  );

  const sisterOverlay = useMemo(
    () =>
      buildSisterOverlay({
        sisters: overlaySisters.map((v) => ({
          memberId: v.memberId,
          displayName: v.displayName,
          emoji: v.emoji,
          periodDays: sisterDaysByMember[v.memberId] ?? [],
          predictedNextPeriod: v.predictedNextPeriod,
        })),
        rangeStart: formatISO(startOfMonth(viewedMonth)),
        rangeEnd: formatISO(endOfMonth(viewedMonth)),
        today: todayIso,
      }),
    [overlaySisters, sisterDaysByMember, viewedMonth, todayIso]
  );

  // Sanity-check what's been logged this month. Clipping at the month edge can
  // only make gaps look BIGGER, so this under-reports rather than crying wolf.
  const periodPattern = useMemo(
    () => analysePeriodPattern(Array.from(periodDays)),
    [periodDays]
  );

  const logTarget = logTargetId ? loggableSisters.find((v) => v.memberId === logTargetId) ?? null : null;

  // Today's suggestion set — powers the richer phase card (why you're in this
  // phase + a tip). Only meaningful once there's cycle data; cheap to compute.
  const todaySet = useMemo(
    () =>
      buildDaySuggestions({
        phase,
        daysUntilPredictedPeriod: daysUntil(todayIso, latestPrediction?.predictedNextPeriod ?? null),
        isPeriodDay: periodDays.has(todayIso),
        mode,
        conditions,
        daySeed: parseInt(todayIso.slice(8, 10), 10) || 0,
        dayInCycle,
        todayCheckIn,
        recentSymptoms,
      }),
    [phase, todayIso, latestPrediction?.predictedNextPeriod, periodDays, mode, conditions, dayInCycle, todayCheckIn, recentSymptoms]
  );

  const phaseHue = PHASE_AURORA[phase];
  const hasCycleData = lastPeriodStart != null;

  return (
    <AuroraBackground>
      <StatusBar style="light" />
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
        {/* Month header — no arrows (owner ask). Swipe the grid left/right to
            change month; tap the label to jump back to today. */}
        <Animated.View entering={rise(40)} style={styles.monthHeader}>
          <PressableScale
            onPress={goToday}
            haptic="none"
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${monthLabel}. Tap to jump to the current month`}
          >
            <Text style={[styles.monthLabel, { color: palette.ink }]}>{monthLabel}</Text>
          </PressableScale>
          <Text style={[styles.monthHint, { color: palette.ink3 }]}>‹ swipe to change month ›</Text>
        </Animated.View>

        {/* Whose day am I marking? Only shown once there's someone to care for.
            Tapping a sister makes every "Mark as period" tap record against HER
            — one calendar instead of a second sisterhood one. */}
        {loggableSisters.length > 0 && (
          <Animated.View entering={rise(70)} style={styles.whoRow}>
            <PressableScale
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setLogTargetId(null);
              }}
              haptic="none"
              scaleTo={0.95}
              style={[
                styles.whoChip,
                {
                  backgroundColor: logTargetId === null ? palette.accent : palette.glass.bg,
                  borderColor: logTargetId === null ? palette.accent : palette.glass.edge,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: logTargetId === null }}
              accessibilityLabel="Log for yourself"
            >
              <Text style={[styles.whoChipText, { color: logTargetId === null ? palette.ground : palette.ink2 }]}>
                You
              </Text>
            </PressableScale>
            {loggableSisters.map((v) => {
              const on = logTargetId === v.memberId;
              return (
                <PressableScale
                  key={v.memberId}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setLogTargetId(on ? null : v.memberId);
                  }}
                  haptic="none"
                  scaleTo={0.95}
                  style={[
                    styles.whoChip,
                    {
                      backgroundColor: on ? A.gold : palette.glass.bg,
                      borderColor: on ? A.gold : palette.glass.edge,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`Log for ${v.displayName}`}
                >
                  <Text style={styles.whoChipEmoji}>{v.emoji}</Text>
                  <Text style={[styles.whoChipText, { color: on ? A.ground : palette.ink2 }]}>
                    {v.displayName}
                  </Text>
                </PressableScale>
              );
            })}
          </Animated.View>
        )}

        {logTarget && (
          <View style={[styles.whoBanner, { borderColor: A.gold, backgroundColor: `${A.gold}18` }]}>
            <Text style={[styles.whoBannerText, { color: palette.ink }]}>
              {logTarget.emoji} Marking days for {logTarget.displayName}. Tap “You” to switch back.
            </Text>
          </View>
        )}

        {/* Weekday header + calendar grid — a horizontal swipe here pages the
            month (monthSwipe PanResponder); day taps still open the sheet. */}
        <Animated.View entering={rise(115)} {...monthSwipe.panHandlers}>
          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((d, i) => (
              <Text key={`${d}_${i}`} style={[styles.weekdayLabel, { color: palette.ink3 }]}>
                {d}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {monthGrid.map((cell) => (
              <DayCell
                key={cell.iso}
                cell={cell}
                sisterMark={sisterMarkFor(sisterOverlay.marksByDate.get(cell.iso))}
                onPress={(e) => onDayTap(cell.iso, cell, e)}
              />
            ))}
          </View>
        </Animated.View>

        {/* Sister heads-up — the thing the Cycle tab said nothing about before:
            whose period is coming, and when. */}
        {sisterOverlay.headsUp.length > 0 && (
          <Animated.View entering={rise(150)}>
            <View style={[styles.sisterHeadsUp, { borderColor: `${A.gold}66`, backgroundColor: `${A.gold}12` }]}>
              {sisterOverlay.headsUp.map((h) => (
                <Text key={h.memberId} style={[styles.sisterHeadsUpText, { color: palette.ink2 }]}>
                  {h.emoji} {h.message}
                </Text>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Logging sanity nudges — "that looks like a slipped tap", never a
            medical opinion. See engine/calendar/period-blocks.ts. */}
        {periodPattern.warnings.length > 0 && (
          <Animated.View entering={rise(155)}>
            <View style={[styles.nudge, { backgroundColor: palette.glass.bg, borderColor: `${A.gold}66` }]}>
              <Text style={styles.nudgeEmoji}>🤔</Text>
              <Text style={[styles.nudgeText, { color: palette.ink2 }]}>
                {periodPattern.warnings[0]!.message}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Backfill nudge — once there's cycle data but only a cycle or two,
            invite the user to log earlier months so predictions sharpen. */}
        {hasCycleData && cycleCount < 2 && (
          <Animated.View entering={rise(160)}>
            <View style={[styles.nudge, { backgroundColor: palette.glass.bg, borderColor: `${palette.accent}55` }]}>
              <Text style={styles.nudgeEmoji}>🗓️</Text>
              <Text style={[styles.nudgeText, { color: palette.ink2 }]}>
                Remember when earlier periods started? Swipe back a month and tap those
                days — even rough dates help Dottie learn your rhythm faster.
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Current phase summary — WHY you're in this phase, what's NEXT, a tip.
            Owner ask (device-test-6): the calendar should explain the phase, not
            just name it. Rich content only once there's real cycle data. */}
        <Animated.View entering={rise(190)}>
          <GlassCard style={styles.phaseSummary} padding={Spacing.cardPadding}>
            <View style={[styles.phaseSummaryDot, { backgroundColor: phaseHue }]} />
            <View style={styles.phaseSummaryText}>
              {hasCycleData ? (
                <>
                  <Text style={[styles.phaseSummaryTitle, { color: palette.ink }]}>
                    {todaySet.subphaseLabel
                      ? `${todaySet.subphaseLabel} · Day ${dayInCycle}`
                      : `${phaseLabel(phase)} Phase · Day ${dayInCycle}`}
                  </Text>
                  {todaySet.hormoneStory ? (
                    <Text style={[styles.phaseWhy, { color: palette.ink2 }]}>{todaySet.hormoneStory}</Text>
                  ) : null}
                  {predictionMessage ? (
                    <Text style={[styles.phaseSummaryBody, { color: palette.ink2 }]}>{predictionMessage}</Text>
                  ) : null}
                  <Text style={[styles.phaseNext, { color: palette.ink3 }]}>{nextPhaseHint(phase)}</Text>
                  {todaySet.suggestions[0] ? (
                    <Text style={[styles.phaseTip, { color: palette.accent }]}>
                      💡 {todaySet.suggestions[0].title} — {todaySet.suggestions[0].detail}
                    </Text>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={[styles.phaseSummaryTitle, { color: palette.ink }]}>Your cycle, decoded</Text>
                  <Text style={[styles.phaseSummaryBody, { color: palette.ink2 }]}>
                    Tap any day to log a period. Once Dottie knows your last start, this
                    card explains what phase you&apos;re in, why, and what&apos;s coming next.
                  </Text>
                </>
              )}
            </View>
          </GlassCard>
        </Animated.View>

        {/* Week-ahead strip — only once there's real cycle data, else every day
            would show the same assumed phase (the repeated-placeholder feel). */}
        {lastPeriodStart != null && weekAhead.length > 0 && (
          <Animated.View entering={rise(230)} style={styles.weekAhead}>
            <WeekAheadStrip items={weekAhead} onDayPress={onWeekDayPress} />
          </Animated.View>
        )}

        {/* Legend */}
        <Animated.View entering={rise(300)} style={styles.legend}>
          <LegendChip color={PHASE_AURORA.menstrual} label="Period" />
          <LegendChip color={PHASE_AURORA.follicular} label="Follicular" />
          <LegendChip color={PHASE_AURORA.ovulatory} label="Ovulatory" />
          <LegendChip color={PHASE_AURORA.luteal} label="Luteal" />
          <LegendChip color={PHASE_AURORA.menstrual} label="Predicted" dashed />
          {overlaySisters.length > 0 && <LegendChip color={A.gold} label="Sister" />}
        </Animated.View>

        {/* Loved-ones bridge — a non-clunky calendar → Sisterhood entry point.
            Kept SEPARATE from the primary user's grid on purpose: user feedback
            was to link the two without collapsing a sister's cycle into the
            same month view. Tapping opens the Sisterhood tab, where each
            sister has her own calendar. */}
        <Animated.View entering={rise(360)}>
          <PressableScale
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              router.push('/(sisterhood)/circle');
            }}
            haptic="none"
            scaleTo={0.98}
            style={[
              styles.sisterBridge,
              { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              sisterCount > 0
                ? `Open your Sisterhood circle — ${sisterCount} ${sisterCount === 1 ? 'sister' : 'sisters'}`
                : 'Open your Sisterhood circle — track a loved one'
            }
          >
            <Text style={styles.sisterBridgeEmoji}>👯</Text>
            <View style={styles.sisterBridgeText}>
              <Text style={[styles.sisterBridgeTitle, { color: palette.ink }]}>
                {sisterCount > 0
                  ? `Care for your ${sisterCount === 1 ? 'sister' : `${sisterCount} sisters`} →`
                  : 'Care for a loved one →'}
              </Text>
              <Text style={[styles.sisterBridgeSubtitle, { color: palette.ink2 }]}>
                {sisterCount > 0
                  ? 'Mark their days right here on this calendar — pick who you\'re logging for above. Mood and check-ins live in their profile.'
                  : 'Sisterhood lets you track periods & health for a little sister, a friend, or someone who doesn\'t have a phone yet.'}
              </Text>
            </View>
            <Text style={[styles.sisterBridgeArrow, { color: palette.accent }]}>›</Text>
          </PressableScale>
        </Animated.View>

        {/* WHOSE SCIENCE AM I LOOKING AT? When a sister is selected for
            logging, the panel below describes HER — otherwise the whole screen
            switches to her days while the explanation underneath still talks
            about you, which is the inconsistency the owner flagged
            (device-test-8). We show what her data actually supports (next
            predicted days, where she is in her cycle) rather than dressing up a
            distribution we don't have the history to compute. */}
        {logTarget && (
          <Animated.View
            entering={rise(60)}
            style={[styles.sisterPanel, { borderColor: `${A.gold}55`, backgroundColor: `${A.gold}12` }]}
          >
            <Text style={[styles.sisterPanelTitle, { color: palette.ink }]}>
              {logTarget.emoji} {logTarget.displayName}&apos;s cycle
            </Text>
            <Text style={[styles.sisterPanelBody, { color: palette.ink2 }]}>
              {sisterCycleLine(logTarget)}
            </Text>
            <Text style={[styles.sisterPanelNote, { color: palette.ink3 }]}>
              Her prediction uses the days you&apos;ve marked for her here. The
              full model below — the window, the spread, the graphs — is yours.
            </Text>
          </Animated.View>
        )}

        {/* Overlapping windows. Only rendered when there IS an overlap: a
            "nothing coincides" message is not news. */}
        {cycleOverlaps.length > 0 && (
          <Animated.View
            entering={rise(80)}
            style={[styles.overlapCard, { borderColor: `${palette.accent2}55`, backgroundColor: `${palette.accent2}12` }]}
          >
            <Text style={[styles.overlapTitle, { color: palette.ink }]}>
              🗓️ Same days coming up
            </Text>
            {cycleOverlaps.slice(0, 3).map((o) => (
              <Text key={o.memberId} style={[styles.overlapBody, { color: palette.ink2 }]}>
                {o.summary}
              </Text>
            ))}
          </Animated.View>
        )}

        {/* How this prediction is made — the dynamic explainer card. ALWAYS
            renders: with a period logged it explains the live prediction; with
            none it explains what will be used and still draws the figures.
            Bottom clearance now comes from contentContainerStyle (it has to
            include insets.bottom), so no spacer view here. */}
        <PredictionExplainerCard />
      </ScrollView>

      {/* Day detail popover — magnifies from the tapped cell over a scrim */}
      {selected && (
        <DayDetailSheet
          dateISO={selected.iso}
          dateLabel={formatFriendlyDate(selected.iso)}
          origin={selected.origin}
          phase={selected.phase}
          hasCycleData={lastPeriodStart != null}
          isPeriodDay={selected.isPeriodDay}
          isFuture={selected.isFuture}
          daysUntilPredictedPeriod={selected.daysUntilPredictedPeriod}
          dayInCycle={selected.dayInCycle}
          mode={mode}
          conditions={conditions}
          initialPlan={Storage.dayPlans.get(selected.iso)}
          todayCheckIn={selected.iso === todayIso ? todayCheckIn : null}
          recentSymptoms={recentSymptoms}
          onLogPeriod={onLogSelectedPeriod}
          logForName={logTarget?.displayName ?? null}
          onTrackTap={() => {
            // Open the daily check-in on top of the sheet — the user comes
            // back to the sheet with their note intact. Was inert before.
            router.push('/(modals)/daily-checkin');
          }}
          onClose={onSheetClose}
        />
      )}
    </AuroraBackground>
  );
}

// Staggered entrance helper — gentle rise + fade, springy settle.
function rise(delay: number) {
  return FadeInDown.duration(480).delay(delay).springify().damping(16);
}

// ─── SUBCOMPONENTS ───────────────────────────────────────────────────

function DayCell({
  cell,
  sisterMark,
  onPress,
}: {
  cell: MonthCell;
  /** A sister's period on this day — drawn in her own colour, never a phase hue. */
  sisterMark?: 'logged' | 'predicted';
  onPress: (e: GestureResponderEvent) => void;
}) {
  const { palette } = useAurora();
  const isToday = cell.iso === formatISO(new Date());
  const isPeriod = cell.isPeriodDay;
  const isPredicted = cell.isPredictedPeriod;

  // Resolve background based on state precedence:
  // period (filled) > predicted (dashed) > phase color (soft tint) > muted.
  // Phase hues come from PHASE_AURORA (constant across moods); alpha via 8-hex.
  let bgColor: string | undefined;
  let textColor = palette.ink2;
  let borderStyle: 'dashed' | undefined;
  let borderColor: string | undefined;

  if (!cell.inMonth) {
    textColor = palette.ink3;
  } else if (isPeriod) {
    bgColor = PHASE_AURORA.menstrual;
    textColor = palette.ground; // dark ink on the bright fill
  } else if (isPredicted) {
    bgColor = `${PHASE_AURORA.menstrual}1F`;
    textColor = PHASE_AURORA.menstrual;
    borderStyle = 'dashed';
    borderColor = PHASE_AURORA.menstrual;
  } else if (cell.phase) {
    bgColor = `${PHASE_AURORA[cell.phase]}24`;
    textColor = palette.ink;
  }

  return (
    <PressableScale
      style={[
        styles.dayCell,
        bgColor ? { backgroundColor: bgColor } : null,
        borderStyle === 'dashed' && borderColor
          ? { borderWidth: 1.5, borderStyle: 'dashed', borderColor }
          : null,
        isToday ? { borderWidth: 2, borderColor: palette.accent } : null,
      ]}
      scaleTo={0.9}
      haptic="none"
      onPress={onPress}
      disabled={!cell.inMonth}
      accessibilityRole="button"
    >
      <Text style={[styles.dayCellText, { color: textColor }, !cell.inMonth && { opacity: 0.5 }]}>
        {cell.dayOfMonth}
      </Text>
      {/* Sister marker — a slim gold bar, deliberately NOT one of the phase
          hues so "someone I care for" never reads as one of my own phases.
          Solid = she logged it, faded = it's her predicted window. */}
      {/* A sister's day is marked with a CURVE cradling the date, not the flat
          underscore it used to be (device-test-8: "instead of adding a white
          underscore thing, we could add a simply curvy thing"). A straight bar
          under a number reads as an underline — a typographic mark, i.e. part
          of the text. An arc reads as an object placed around the day, so it
          separates from the numeral instead of competing with it, and it echoes
          the rounded language of the tab pill and the cells themselves.
          Logged days get a solid stroke, predicted ones a dashed, lighter one —
          the same solid/dashed grammar the user's own days use. */}
      {cell.inMonth && sisterMark ? (
        <Svg
          width={SISTER_ARC_W}
          height={SISTER_ARC_H}
          style={styles.daySisterArc}
          pointerEvents="none"
        >
          <Path
            d={SISTER_ARC_PATH}
            stroke={A.gold}
            strokeWidth={2}
            strokeLinecap="round"
            fill="none"
            opacity={sisterMark === 'logged' ? 1 : 0.5}
            strokeDasharray={sisterMark === 'predicted' ? '3,3' : undefined}
          />
        </Svg>
      ) : null}
    </PressableScale>
  );
}

/**
 * One line describing where a sister is, from the fields her privacy level
 * actually exposes. Deliberately narrow: we say what we know and nothing more.
 */
function sisterCycleLine(v: {
  displayName: string;
  currentPhase: string | null;
  dayInCycle: number | null;
  predictedNextPeriod: string | null;
}): string {
  const bits: string[] = [];
  if (v.dayInCycle !== null) bits.push(`Day ${v.dayInCycle} of her cycle`);
  if (v.currentPhase) bits.push(`${v.currentPhase} phase`);
  if (v.predictedNextPeriod) {
    bits.push(`next period likely around ${formatFriendlyDate(v.predictedNextPeriod)}`);
  }
  if (bits.length === 0) {
    return `Mark a few of ${v.displayName}'s days on this calendar and her rhythm starts to show here.`;
  }
  return `${bits.join(' · ')}.`;
}

// The sister-day arc: a shallow smile under the date. Drawn once as a constant
// path so every cell shares it rather than re-deriving a string per render.
const SISTER_ARC_W = 20;
const SISTER_ARC_H = 7;
const SISTER_ARC_PATH = `M1,1 Q${SISTER_ARC_W / 2},${SISTER_ARC_H} ${SISTER_ARC_W - 1},1`;

function LegendChip({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  const { palette } = useAurora();
  return (
    <View
      style={[
        styles.legendChip,
        { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
      ]}
    >
      <View
        style={[
          styles.legendSwatch,
          { backgroundColor: dashed ? 'transparent' : color },
          dashed && {
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: color,
          },
        ]}
      />
      <Text style={[styles.legendLabel, { color: palette.ink2 }]}>{label}</Text>
    </View>
  );
}

// ─── DATE / GRID HELPERS ─────────────────────────────────────────────

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const PHASE_LABELS: Record<Phase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulatory: 'Ovulatory',
  luteal: 'Luteal',
};

/**
 * Collapse every sister marker on a date to the single treatment the cell
 * draws. A real logged day outranks a predicted one — if anyone actually bled
 * that day, that's the honest thing to show.
 */
function sisterMarkFor(marks: SisterDayMark[] | undefined): 'logged' | 'predicted' | undefined {
  if (!marks || marks.length === 0) return undefined;
  return marks.some((m) => m.kind === 'logged') ? 'logged' : 'predicted';
}

function phaseLabel(phase: Phase): string {
  return PHASE_LABELS[phase] ?? 'Cycle';
}

/**
 * A soft, non-diagnostic "what's coming next" line for the phase card. Uses
 * "usually / many people / tends to" language — a hint, never a promise.
 */
function nextPhaseHint(phase: Phase): string {
  switch (phase) {
    case 'menstrual':
      return 'Next up: your follicular phase — energy usually starts to climb.';
    case 'follicular':
      return 'Next up: ovulation — many people feel their most energetic then.';
    case 'ovulatory':
      return 'Next up: the luteal phase — a slower, winding-down stretch for many.';
    case 'luteal':
      return 'Next up: your period — resting and restocking supplies tends to help.';
    default:
      return '';
  }
}

interface MonthCell {
  iso: string;
  dayOfMonth: number;
  inMonth: boolean;
  isFuture: boolean;
  isPeriodDay: boolean;
  isPredictedPeriod: boolean;
  phase: Phase | null;
}

interface BuildGridInput {
  viewedMonth: Date;
  lastPeriodStart: string | null;
  avgCycleLength: number;
  avgPeriodLength: number;
  periodDays: Set<string>;
  predictedNextPeriod: string | null;
  predictionWindowDays: number;
}

/**
 * Build a 6-week (42-cell) grid spanning the visible month.
 * Each cell gets its computed phase color and period/prediction flags.
 */
function buildMonthGrid(input: BuildGridInput): MonthCell[] {
  const cells: MonthCell[] = [];
  const monthStart = startOfMonth(input.viewedMonth);
  const monthYear = input.viewedMonth.getFullYear();
  const monthIdx = input.viewedMonth.getMonth();
  const todayIso = formatISO(new Date());
  const lastPeriodDate = input.lastPeriodStart
    ? new Date(input.lastPeriodStart + 'T00:00:00')
    : null;

  // Calendar cells start on Sunday — figure out leading offset
  const leading = monthStart.getDay();

  // Build 42 cells (6 weeks of 7)
  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(monthYear, monthIdx, 1 + (i - leading));
    const iso = formatISO(cellDate);
    const inMonth = cellDate.getMonth() === monthIdx;
    const isFuture = iso > todayIso;
    const isPeriodDay = input.periodDays.has(iso);

    // Compute phase for this day (only if user has cycle data)
    let phase: Phase | null = null;
    if (lastPeriodDate && cellDate >= lastPeriodDate && !isFuture) {
      const result = calculateCurrentPhase(
        lastPeriodDate,
        cellDate,
        input.avgCycleLength,
        input.avgPeriodLength
      );
      phase = result.phase;
    }

    // Is this in the predicted-period window?
    let isPredictedPeriod = false;
    if (input.predictedNextPeriod && isFuture) {
      const predicted = new Date(input.predictedNextPeriod + 'T00:00:00');
      const cellTime = cellDate.getTime();
      const predictedTime = predicted.getTime();
      const windowMs = input.predictionWindowDays * 24 * 60 * 60 * 1000;
      const periodLengthMs = input.avgPeriodLength * 24 * 60 * 60 * 1000;
      if (
        cellTime >= predictedTime - windowMs &&
        cellTime <= predictedTime + periodLengthMs
      ) {
        isPredictedPeriod = true;
      }
    }

    cells.push({
      iso,
      dayOfMonth: cellDate.getDate(),
      inMonth,
      isFuture,
      isPeriodDay,
      isPredictedPeriod,
      phase,
    });
  }

  return cells;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function shiftMonth(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function formatISO(d: Date): string {
  // Local-timezone-safe YYYY-MM-DD formatting
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatFriendlyDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Project the cycle phase for any date (past OR future) from the last period
 * start + averages, so the planner popover can suggest for days ahead too.
 * Returns null when there's no cycle data yet.
 */
function phaseForDate(
  iso: string,
  lastPeriodStart: string | null,
  health: { averageCycleLength: number | null; averagePeriodLength: number | null } | null | undefined
): Phase | null {
  if (!lastPeriodStart) return null;
  const last = new Date(lastPeriodStart + 'T00:00:00');
  const target = new Date(iso + 'T00:00:00');
  return calculateCurrentPhase(
    last,
    target,
    health?.averageCycleLength ?? 28,
    health?.averagePeriodLength ?? 5
  ).phase;
}

/**
 * Day-in-cycle projection for any date. Powers the sub-phase resolution in
 * the day-suggestion engine so that (for example) day-25 shows "Late luteal ·
 * PMS window" instead of the generic "Luteal". Returns null when there is no
 * cycle data yet.
 */
function dayInCycleForDate(
  iso: string,
  lastPeriodStart: string | null,
  health: { averageCycleLength: number | null; averagePeriodLength: number | null } | null | undefined
): number | null {
  if (!lastPeriodStart) return null;
  const last = new Date(lastPeriodStart + 'T00:00:00');
  const target = new Date(iso + 'T00:00:00');
  return calculateCurrentPhase(
    last,
    target,
    health?.averageCycleLength ?? 28,
    health?.averagePeriodLength ?? 5
  ).dayInCycle;
}

/**
 * Whole days from `iso` until the predicted next period. Null when unknown or
 * clearly outside the useful window (avoids a stale "due" far past the date).
 */
function daysUntil(iso: string, predictedNextPeriod: string | null): number | null {
  if (!predictedNextPeriod) return null;
  const DAY = 24 * 60 * 60 * 1000;
  const target = new Date(iso + 'T00:00:00').getTime();
  const predicted = new Date(predictedNextPeriod + 'T00:00:00').getTime();
  const diff = Math.round((predicted - target) / DAY);
  if (diff < -2 || diff > 30) return null;
  return diff;
}

/** One-line label for a week-strip day, derived from proximity + phase headline. */
function miniLabel(headline: string, daysUntilPeriod: number | null): string {
  if (daysUntilPeriod !== null) {
    if (daysUntilPeriod <= 0) return 'Likely start';
    if (daysUntilPeriod <= 3) return 'Restock supplies';
    if (daysUntilPeriod <= 6) return 'Window soon';
  }
  return headline;
}

/** Whether a date falls in the predicted period band (same rule as the grid). */
function inPredictedWindow(
  iso: string,
  predictedNextPeriod: string | null,
  windowDays: number,
  avgPeriodLength: number
): boolean {
  if (!predictedNextPeriod) return false;
  const DAY = 24 * 60 * 60 * 1000;
  const t = new Date(iso + 'T00:00:00').getTime();
  const p = new Date(predictedNextPeriod + 'T00:00:00').getTime();
  return t >= p - windowDays * DAY && t <= p + avgPeriodLength * DAY;
}

// ─── STYLES (layout only — colours are inline, palette-driven) ───────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.screenPadding,
    // Top padding applied inline via safe-area insets (insets.top + Spacing.lg).
  },
  monthHeader: {
    alignItems: 'center',
    marginBottom: Spacing.base,
    gap: 2,
  },
  monthLabel: {
    ...Typography.preset.h3,
    textAlign: 'center',
  },
  monthHint: {
    ...Typography.preset.caption,
    letterSpacing: 0.5,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.sm,
  },
  weekdayLabel: {
    ...Typography.preset.captionBold,
    width: 44,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: Spacing.sectionGap,
  },
  // Bigger, cleaner cells (owner ask). 44×7 = 308 ≤ a 360dp content row, so the
  // grid still lays out 7-per-week without wrapping on narrow phones.
  dayCell: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 3,
  },
  daySisterArc: {
    position: 'absolute',
    bottom: 3,
  },
  // "Whose cycle is this?" panel, shown while logging for a sister.
  sisterPanel: {
    borderWidth: 1,
    borderRadius: Spacing.radius.xl,
    padding: Spacing.cardPadding,
    gap: 6,
    marginBottom: Spacing.base,
  },
  sisterPanelTitle: { ...Typography.preset.bodySemibold },
  sisterPanelBody: { ...Typography.preset.caption, lineHeight: 18 },
  sisterPanelNote: { ...Typography.preset.caption, fontSize: 11, lineHeight: 16 },
  // Overlapping predicted windows.
  overlapCard: {
    borderWidth: 1,
    borderRadius: Spacing.radius.xl,
    padding: Spacing.cardPadding,
    gap: 6,
    marginBottom: Spacing.base,
  },
  overlapTitle: { ...Typography.preset.bodySemibold },
  overlapBody: { ...Typography.preset.caption, lineHeight: 18 },
  // "Who am I logging for" chips + banner.
  whoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  whoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: Spacing.radius.full,
  },
  whoChipEmoji: { fontSize: 13 },
  whoChipText: { ...Typography.preset.caption, fontWeight: '800' },
  whoBanner: {
    borderWidth: 1,
    borderRadius: Spacing.radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  whoBannerText: { ...Typography.preset.caption, fontWeight: '700' },
  // Sister heads-up card.
  sisterHeadsUp: {
    borderWidth: 1,
    borderRadius: Spacing.radius.lg,
    padding: Spacing.md,
    gap: 4,
    marginBottom: Spacing.base,
  },
  sisterHeadsUpText: { ...Typography.preset.caption, lineHeight: 18 },

  dayCellText: {
    ...Typography.preset.bodySemibold,
    fontSize: 15,
  },
  weekAhead: {
    marginBottom: Spacing.base,
  },
  phaseSummary: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.base,
  },
  phaseSummaryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 6,
    marginRight: Spacing.md,
  },
  phaseSummaryText: {
    flex: 1,
  },
  phaseSummaryTitle: {
    ...Typography.preset.bodySemibold,
    marginBottom: Spacing.xs,
  },
  phaseSummaryBody: {
    ...Typography.preset.body,
    lineHeight: 22,
  },
  phaseWhy: {
    ...Typography.preset.caption,
    lineHeight: 19,
    marginBottom: Spacing.xs,
  },
  phaseNext: {
    ...Typography.preset.caption,
    lineHeight: 18,
    marginTop: Spacing.xs,
  },
  phaseTip: {
    ...Typography.preset.caption,
    lineHeight: 18,
    marginTop: Spacing.xs,
    fontWeight: '700',
  },
  // Backfill nudge card (shown when only a cycle or two is logged).
  nudge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Spacing.radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.base,
  },
  nudgeEmoji: { fontSize: 18 },
  nudgeText: {
    ...Typography.preset.caption,
    lineHeight: 18,
    flex: 1,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
    marginTop: Spacing.base,
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Spacing.radius.full,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.xs,
  },
  legendLabel: {
    ...Typography.preset.caption,
  },
  // Sisterhood bridge card — sits below the legend, links to Sisterhood.
  sisterBridge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.cardPadding,
    borderRadius: Spacing.radius.xl,
    borderWidth: 1,
    marginTop: Spacing.lg,
  },
  sisterBridgeEmoji: {
    fontSize: 30,
  },
  sisterBridgeText: {
    flex: 1,
  },
  sisterBridgeTitle: {
    ...Typography.preset.bodySemibold,
    marginBottom: 2,
  },
  sisterBridgeSubtitle: {
    ...Typography.preset.caption,
    lineHeight: 17,
  },
  sisterBridgeArrow: {
    fontSize: 26,
    fontWeight: '600',
    marginLeft: Spacing.xs,
  },
});
