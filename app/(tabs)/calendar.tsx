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

import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, type GestureResponderEvent } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { PressableScale, AuroraBackground, GlassCard } from '../../src/components/ui';
import { useAurora, PHASE_AURORA } from '../../src/theme';
import {
  useCycleStore,
  useUserStore,
  selectCurrentPhase,
  selectDayInCycle,
  selectLastPeriodStart,
  selectPredictionMessage,
  selectUserMode,
} from '../../src/stores';
import { cycleRepository } from '../../src/database/repositories/cycle.repo';
import { calculateCurrentPhase } from '../../src/engine/prediction/phase-calculator';
import { Phase, type HealthCondition } from '../../src/types/cycle.types';
import { DayDetailSheet, type DayDetailResult } from '../../src/components/calendar/DayDetailSheet';
import { Storage } from '../../src/database/storage';

// Shared empty array so the conditions selector stays referentially stable
// (returning a fresh `[]` from a selector thrashes re-renders / warns).
const EMPTY_CONDITIONS: HealthCondition[] = [];

/** A day the user tapped open in the detail sheet. */
interface SelectedDay {
  iso: string;
  phase: Phase;
  isPeriodDay: boolean;
  isFuture: boolean;
  daysUntilPredictedPeriod: number | null;
  origin: { x: number; y: number };
}

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const { palette } = useAurora();

  // ─── Live state ─────────────────────────────────────────────────
  const phase = useCycleStore(selectCurrentPhase);
  const dayInCycle = useCycleStore(selectDayInCycle);
  const lastPeriodStart = useCycleStore(selectLastPeriodStart);
  const predictionMessage = useCycleStore(selectPredictionMessage);
  const latestPrediction = useCycleStore((s) => s.latestPrediction);
  const userHealth = useUserStore((s) => s.user?.healthProfile);
  const userId = useUserStore((s) => s.userId);
  const mode = useUserStore(selectUserMode);
  const conditions = useUserStore((s) => s.user?.healthProfile.conditions) ?? EMPTY_CONDITIONS;

  // ─── Month navigation state ─────────────────────────────────────
  const [viewedMonth, setViewedMonth] = useState<Date>(startOfMonth(new Date()));
  const [periodDays, setPeriodDays] = useState<Set<string>>(new Set());

  // ─── Planner popover state ──────────────────────────────────────
  const [selected, setSelected] = useState<SelectedDay | null>(null);
  // Days with a saved plan/note (drives the planning dot). Reloaded when the
  // sheet closes via the bump counter.
  const [plannedDays, setPlannedDays] = useState<Set<string>>(new Set());
  const [plansVersion, setPlansVersion] = useState(0);

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

  // ─── Day tap → open the planner popover ─────────────────────────
  // Future days ARE tappable now (that's the point of a week-ahead planner);
  // period-logging inside the sheet is still gated to past/today.
  const onDayTap = (iso: string, cell: MonthCell, e: GestureResponderEvent) => {
    if (!cell.inMonth) return;
    Haptics.selectionAsync().catch(() => {});

    setSelected({
      iso,
      phase: phaseForDate(iso, lastPeriodStart, userHealth) ?? phase,
      isPeriodDay: periodDays.has(iso),
      isFuture: cell.isFuture,
      daysUntilPredictedPeriod: daysUntil(iso, latestPrediction?.predictedNextPeriod ?? null),
      origin: { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY },
    });
  };

  // Log the currently-selected day as a period day (from inside the sheet).
  const onLogSelectedPeriod = async () => {
    if (!selected) return;
    try {
      await useCycleStore.getState().logPeriodDay({ date: selected.iso, flowLevel: 3 });
      await reloadPeriodDays();
    } catch (err) {
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
  const goPrevMonth = () => {
    Haptics.selectionAsync().catch(() => {});
    setViewedMonth(shiftMonth(viewedMonth, -1));
  };
  const goNextMonth = () => {
    Haptics.selectionAsync().catch(() => {});
    setViewedMonth(shiftMonth(viewedMonth, 1));
  };
  const goToday = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setViewedMonth(startOfMonth(new Date()));
  };

  const phaseHue = PHASE_AURORA[phase];

  return (
    <AuroraBackground>
      <StatusBar style="light" />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingTop: insets.top + Spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Month navigation */}
        <Animated.View entering={rise(40)} style={styles.monthHeader}>
          <PressableScale
            onPress={goPrevMonth}
            haptic="none"
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Previous month"
          >
            <Text style={[styles.monthNavArrow, { color: palette.accent }]}>‹</Text>
          </PressableScale>
          <PressableScale
            onPress={goToday}
            haptic="none"
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Jump to current month"
          >
            <Text style={[styles.monthLabel, { color: palette.ink }]}>{monthLabel}</Text>
          </PressableScale>
          <PressableScale
            onPress={goNextMonth}
            haptic="none"
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Next month"
          >
            <Text style={[styles.monthNavArrow, { color: palette.accent }]}>›</Text>
          </PressableScale>
        </Animated.View>

        {/* Weekday header + calendar grid */}
        <Animated.View entering={rise(115)}>
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
                planned={plannedDays.has(cell.iso)}
                onPress={(e) => onDayTap(cell.iso, cell, e)}
              />
            ))}
          </View>
        </Animated.View>

        {/* Current phase summary */}
        <Animated.View entering={rise(190)}>
          <GlassCard style={styles.phaseSummary} padding={Spacing.cardPadding}>
            <View style={[styles.phaseSummaryDot, { backgroundColor: phaseHue }]} />
            <View style={styles.phaseSummaryText}>
              <Text style={[styles.phaseSummaryTitle, { color: palette.ink }]}>
                {phaseLabel(phase)} Phase · Day {dayInCycle}
              </Text>
              {predictionMessage ? (
                <Text style={[styles.phaseSummaryBody, { color: palette.ink2 }]}>
                  {predictionMessage}
                </Text>
              ) : (
                <Text style={[styles.phaseSummaryBody, { color: palette.ink2 }]}>
                  Tap any day to see gentle suggestions, plan ahead, or log a period.
                </Text>
              )}
            </View>
          </GlassCard>
        </Animated.View>

        {/* Legend */}
        <Animated.View entering={rise(265)} style={styles.legend}>
          <LegendChip color={PHASE_AURORA.menstrual} label="Period" />
          <LegendChip color={PHASE_AURORA.follicular} label="Follicular" />
          <LegendChip color={PHASE_AURORA.ovulatory} label="Ovulatory" />
          <LegendChip color={PHASE_AURORA.luteal} label="Luteal" />
          <LegendChip color={PHASE_AURORA.menstrual} label="Predicted" dashed />
        </Animated.View>

        {/* Bottom padding */}
        <View style={{ height: Spacing.tabBarHeight }} />
      </ScrollView>

      {/* Day detail popover — magnifies from the tapped cell over a scrim */}
      {selected && (
        <DayDetailSheet
          dateISO={selected.iso}
          dateLabel={formatFriendlyDate(selected.iso)}
          origin={selected.origin}
          phase={selected.phase}
          isPeriodDay={selected.isPeriodDay}
          isFuture={selected.isFuture}
          daysUntilPredictedPeriod={selected.daysUntilPredictedPeriod}
          mode={mode}
          conditions={conditions}
          initialPlan={Storage.dayPlans.get(selected.iso)}
          onLogPeriod={onLogSelectedPeriod}
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
  planned,
  onPress,
}: {
  cell: MonthCell;
  planned?: boolean;
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
      {/* A planning dot takes precedence over the subtle future dot. */}
      {cell.inMonth && planned ? (
        <View style={[styles.dayCellPlanDot, { backgroundColor: PLAN_DOT }]} />
      ) : cell.inMonth && cell.isFuture && !isPredicted ? (
        <View style={[styles.dayCellFutureDot, { backgroundColor: palette.ink3 }]} />
      ) : null}
    </PressableScale>
  );
}

/** Warm, high-contrast dot marking days the user has planned/noted. */
const PLAN_DOT = '#FF7A8A';

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

function phaseLabel(phase: Phase): string {
  return PHASE_LABELS[phase] ?? 'Cycle';
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
  health: { averageCycleLength: number; averagePeriodLength: number } | null | undefined
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.base,
  },
  monthNavArrow: {
    fontSize: 32,
    width: 32,
    textAlign: 'center',
  },
  monthLabel: {
    ...Typography.preset.h3,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.sm,
  },
  weekdayLabel: {
    ...Typography.preset.captionBold,
    width: 40,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    marginBottom: Spacing.sectionGap,
  },
  dayCell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
  },
  dayCellText: {
    ...Typography.preset.bodySemibold,
  },
  dayCellFutureDot: {
    position: 'absolute',
    bottom: 4,
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  dayCellPlanDot: {
    position: 'absolute',
    bottom: 4,
    width: 5,
    height: 5,
    borderRadius: 2.5,
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
});
