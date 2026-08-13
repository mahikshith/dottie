import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { Shadows } from '../../src/constants/shadows';
import { PressableScale } from '../../src/components/ui';
import {
  useCycleStore,
  useUserStore,
  selectCurrentPhase,
  selectDayInCycle,
  selectLastPeriodStart,
  selectPredictionMessage,
} from '../../src/stores';
import { cycleRepository } from '../../src/database/repositories/cycle.repo';
import { calculateCurrentPhase } from '../../src/engine/prediction/phase-calculator';
import { Phase } from '../../src/types/cycle.types';

/**
 * Calendar Tab — Visual cycle calendar.
 *
 * ─── WHAT THIS DELIVERS ─────────────────────────────────────────────
 *
 *  - Month grid with color-coded phase days (live data)
 *  - Period days marked from actual `cycle_entries` rows
 *  - Predicted next period band overlaid in lighter color
 *  - Tap a day → quick action sheet to log it as a period day
 *  - Phase bar showing current position in cycle
 *  - Confidence-aware prediction message (gentle, never alarming)
 *
 * ─── HOW PHASE COLORS WORK ──────────────────────────────────────────
 *
 *  For each day in the visible month, we compute which phase it falls
 *  in by running the pure `calculateCurrentPhase()` function with that
 *  day as "today". This gives the calendar a consistent color story
 *  without needing to store phase per day in the database.
 *
 *  Period days (from `is_period_day = 1` rows) override the computed
 *  phase color with the menstrual gradient.
 *
 * ─── PREMIUM POLISH PASS (Phase 2) ──────────────────────────────────
 *
 *  Presentation/animation only — grid math, phase coloring, tap logging,
 *  month nav, and every store read/handler are byte-for-byte unchanged.
 *
 *  - Safe-area top: fixed paddingTop: Spacing['5xl'] on the scroll
 *    content is replaced with insets.top + Spacing.lg so the month
 *    header clears the notch on every device instead of a magic number.
 *  - Entrance motion: the month header, weekday+grid block, phase
 *    summary, and legend rise + fade in with a gentle staggered spring
 *    (FadeInDown, ~75ms apart) on mount. entering runs on MOUNT only, so
 *    month navigation / period logging re-renders never re-trigger it.
 *  - Tactile press: every month-nav control and every day cell now uses
 *    the shared <PressableScale> so taps spring on the UI thread at
 *    60fps. Existing handlers already fire Haptics.* (selection/impact),
 *    so haptic="none" is passed to avoid a double buzz. The old JS-driven
 *    `pressed` scale style on day cells is retired in favor of the spring.
 */
export default function CalendarScreen() {
  const insets = useSafeAreaInsets();

  // ─── Live state ─────────────────────────────────────────────────
  const phase = useCycleStore(selectCurrentPhase);
  const dayInCycle = useCycleStore(selectDayInCycle);
  const lastPeriodStart = useCycleStore(selectLastPeriodStart);
  const predictionMessage = useCycleStore(selectPredictionMessage);
  const latestPrediction = useCycleStore((s) => s.latestPrediction);
  const userHealth = useUserStore((s) => s.user?.healthProfile);
  const userId = useUserStore((s) => s.userId);

  // ─── Month navigation state ─────────────────────────────────────
  const [viewedMonth, setViewedMonth] = useState<Date>(startOfMonth(new Date()));
  const [periodDays, setPeriodDays] = useState<Set<string>>(new Set());

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

  // ─── Day tap → quick log action ─────────────────────────────────
  const onDayTap = (iso: string, cell: MonthCell) => {
    if (!cell.inMonth) return;
    if (cell.isFuture) return;

    Haptics.selectionAsync().catch(() => {});

    const already = periodDays.has(iso);
    Alert.alert(
      already ? 'Update this day' : 'Log this day',
      formatFriendlyDate(iso),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: already ? 'Period (logged)' : 'Mark as Period',
          onPress: async () => {
            try {
              await useCycleStore.getState().logPeriodDay({
                date: iso,
                flowLevel: 3,
              });
              // Reload the visible month
              if (userId) {
                const days = await cycleRepository.getPeriodDaysInRange(
                  userId,
                  formatISO(startOfMonth(viewedMonth)),
                  formatISO(endOfMonth(viewedMonth))
                );
                setPeriodDays(new Set(days));
              }
            } catch (err) {
              if (__DEV__) console.warn('[Calendar] logPeriodDay failed:', err);
            }
          },
        },
      ]
    );
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

  return (
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
          <Text style={styles.monthNavArrow}>‹</Text>
        </PressableScale>
        <PressableScale
          onPress={goToday}
          haptic="none"
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Jump to current month"
        >
          <Text style={styles.monthLabel}>{monthLabel}</Text>
        </PressableScale>
        <PressableScale
          onPress={goNextMonth}
          haptic="none"
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Next month"
        >
          <Text style={styles.monthNavArrow}>›</Text>
        </PressableScale>
      </Animated.View>

      {/* Weekday header + calendar grid */}
      <Animated.View entering={rise(115)}>
        <View style={styles.weekdayRow}>
          {WEEKDAY_LABELS.map((d) => (
            <Text key={d} style={styles.weekdayLabel}>
              {d}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {monthGrid.map((cell) => (
            <DayCell key={cell.iso} cell={cell} onPress={() => onDayTap(cell.iso, cell)} />
          ))}
        </View>
      </Animated.View>

      {/* Current phase summary */}
      <Animated.View
        entering={rise(190)}
        style={[styles.phaseSummary, { backgroundColor: Colors.phase[phase].light }]}
      >
        <View
          style={[
            styles.phaseSummaryDot,
            { backgroundColor: Colors.phase[phase].primary },
          ]}
        />
        <View style={styles.phaseSummaryText}>
          <Text style={styles.phaseSummaryTitle}>
            {Colors.phase[phase].label} Phase · Day {dayInCycle}
          </Text>
          {predictionMessage && (
            <Text style={styles.phaseSummaryBody}>{predictionMessage}</Text>
          )}
          {!predictionMessage && (
            <Text style={styles.phaseSummaryBody}>
              Tap any day to log a period. I'll learn your pattern over time.
            </Text>
          )}
        </View>
      </Animated.View>

      {/* Legend */}
      <Animated.View entering={rise(265)} style={styles.legend}>
        <LegendChip color={Colors.phase.menstrual.primary} label="Period" />
        <LegendChip color={Colors.phase.follicular.primary} label="Follicular" />
        <LegendChip color={Colors.phase.ovulatory.primary} label="Ovulatory" />
        <LegendChip color={Colors.phase.luteal.primary} label="Luteal" />
        <LegendChip
          color={Colors.phase.menstrual.primary}
          label="Predicted"
          dashed
        />
      </Animated.View>

      {/* Bottom padding */}
      <View style={{ height: Spacing.tabBarHeight }} />
    </ScrollView>
  );
}

// Staggered entrance helper — gentle rise + fade, springy settle.
function rise(delay: number) {
  return FadeInDown.duration(480).delay(delay).springify().damping(16);
}

// ─── SUBCOMPONENTS ───────────────────────────────────────────────────

function DayCell({ cell, onPress }: { cell: MonthCell; onPress: () => void }) {
  const isToday = cell.iso === formatISO(new Date());
  const isPeriod = cell.isPeriodDay;
  const isPredicted = cell.isPredictedPeriod;

  // Resolve background based on state precedence:
  // period (filled) > today highlight > predicted (dashed) > phase color > muted
  let bgColor: string | undefined;
  let textColor = Colors.text.secondary;
  let borderStyle: 'solid' | 'dashed' | undefined;
  let borderColor: string | undefined;

  if (!cell.inMonth) {
    textColor = Colors.text.tertiary;
  } else if (isPeriod) {
    bgColor = Colors.phase.menstrual.primary;
    textColor = Colors.text.inverse;
  } else if (isPredicted) {
    bgColor = Colors.phase.menstrual.light;
    textColor = Colors.phase.menstrual.primary;
    borderStyle = 'dashed';
    borderColor = Colors.phase.menstrual.primary;
  } else if (cell.phase) {
    bgColor = Colors.phase[cell.phase].light;
    textColor = Colors.text.primary;
  }

  return (
    <PressableScale
      style={[
        styles.dayCell,
        bgColor ? { backgroundColor: bgColor } : null,
        borderStyle === 'dashed' && borderColor
          ? { borderWidth: 1.5, borderStyle: 'dashed', borderColor }
          : null,
        isToday && styles.dayCellToday,
      ]}
      scaleTo={0.9}
      haptic="none"
      onPress={onPress}
      disabled={!cell.inMonth || cell.isFuture}
      accessibilityRole="button"
    >
      <Text style={[styles.dayCellText, { color: textColor }, !cell.inMonth && { opacity: 0.4 }]}>
        {cell.dayOfMonth}
      </Text>
      {cell.inMonth && cell.isFuture && !isPredicted && (
        <View style={styles.dayCellFutureDot} />
      )}
    </PressableScale>
  );
}

function LegendChip({
  color,
  label,
  dashed,
}: {
  color: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <View style={styles.legendChip}>
      <View
        style={[
          styles.legendSwatch,
          { backgroundColor: dashed ? Colors.surface.card : color },
          dashed && {
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: color,
          },
        ]}
      />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

// ─── DATE / GRID HELPERS ─────────────────────────────────────────────

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface.background,
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
    color: Colors.primary.coral,
    width: 32,
    textAlign: 'center',
  },
  monthLabel: {
    ...Typography.preset.h3,
    color: Colors.text.primary,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: Spacing.sm,
  },
  weekdayLabel: {
    ...Typography.preset.captionBold,
    color: Colors.text.tertiary,
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
  dayCellToday: {
    borderWidth: 2,
    borderColor: Colors.primary.coral,
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
    backgroundColor: Colors.text.tertiary,
  },
  phaseSummary: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.cardPadding,
    borderRadius: Spacing.radius['2xl'],
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
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  phaseSummaryBody: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
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
    backgroundColor: Colors.surface.card,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Spacing.radius.full,
    ...Shadows.sm,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.xs,
  },
  legendLabel: {
    ...Typography.preset.caption,
    color: Colors.text.secondary,
  },
});