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
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  PanResponder,
  type GestureResponderEvent,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { findCycleOverlaps } from '../../src/engine/calendar/cycle-overlap';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
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
import type { ShadowContext } from '../../src/types/sisterhood.types';
import {
  buildSisterCycleHistory,
  sisterHistorySummary,
} from '../../src/engine/calendar/sister-cycle';
import { logSilentFailure } from '../../src/diagnostics/silent-failure';
import { analysePeriodPattern, groupPeriodBlocks } from '../../src/engine/calendar/period-blocks';
import { recallSymptoms, recallForDay } from '../../src/engine/symptoms/symptom-recall';
import { checkinRepository } from '../../src/database/repositories/checkin.repo';
import { addDays, daysBetween } from '../../src/utils/civil-date';
import {
  buildFertileWindow,
  NOT_CONTRACEPTION,
  type FertileKind,
} from '../../src/engine/calendar/fertile-window';
import { log, timed } from '../../src/diagnostics/logger';
import {
  calculateCurrentPhase,
  PHASE_DISPLAY_GRACE_DAYS,
} from '../../src/engine/prediction/phase-calculator';
import { predictNextPeriod } from '../../src/engine/prediction/predictor';
import { Phase, type HealthCondition } from '../../src/types/cycle.types';
import { DayDetailSheet, type DayDetailResult } from '../../src/components/calendar/DayDetailSheet';
import { WeekAheadStrip, type WeekAheadItem } from '../../src/components/calendar/WeekAheadStrip';
import { PredictionExplainerCard } from '../../src/components/calendar/PredictionExplainerCard';
import { buildDaySuggestions } from '../../src/engine/calendar/day-suggestions';
import { Storage } from '../../src/database/storage';
import {
  over,
  inkOn,
  PHASE_CELL,
  PHASE_INK,
  LOGGED_PERIOD_CELL,
  FERTILE_CELL,
  OVULATION_CELL,
  OVULATION_MARK,
  PREDICTED_CELL,
} from '../../src/theme/blend';
import {
  dayMark,
  groupDayRanges,
  markDetail,
  isRecorded,
  MARK_LABEL,
  MARK_SPOKEN,
  type DayMark,
  type DayRange,
} from '../../src/engine/calendar/day-marks';

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

/**
 * The flow level a one-tap log writes. Mid-range: the user did not say, and
 * assuming "heavy" or "spotting" from a tap would be inventing data. The sheet
 * is where a specific flow gets chosen (device-test-24).
 */
const DEFAULT_QUICK_FLOW = 3;

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { palette } = useAurora();
  // Sister count drives the copy on the loved-ones bridge card below.
  const sisterCount = useSisterhoodStore(selectMemberCount);
  const sisterViews = useSisterhoodStore(selectMemberViewsOrdered);
  const rawMembersById = useSisterhoodStore((st) => st.membersById);

  // ─── Live state ─────────────────────────────────────────────────
  const phase = useCycleStore(selectCurrentPhase);
  const dayInCycle = useCycleStore(selectDayInCycle);
  const lastPeriodStart = useCycleStore(selectLastPeriodStart);
  const predictionMessage = useCycleStore(selectPredictionMessage);
  const latestPrediction = useCycleStore((s) => s.latestPrediction);
  // Number of full cycles observed — drives the "backfill recent months" nudge
  // (predictions stay coarse until a couple of real cycles are logged).
  const cycleCount = useCycleStore((s) => s.cycleCount);
  // Raw records (stable array reference from the store — do NOT map inside the
  // selector, a fresh array there trips useSyncExternalStore).
  const cycleHistory = useCycleStore((s) => s.cycleHistory);
  const userHealth = useUserStore((s) => s.user?.healthProfile);
  const userId = useUserStore((s) => s.userId);
  const mode = useUserStore(selectUserMode);
  const conditions = useUserStore((s) => s.user?.healthProfile.conditions) ?? EMPTY_CONDITIONS;
  // Personalisation inputs for the day-suggestion engine v2 — today's
  // check-in surfaces mood/energy/sleep/stress signals, and the recent
  // symptoms feed the dominant-symptom pattern nudge. Both are safe if empty.
  const todayCheckIn = useCycleStore((s) => s.todayCheckIn);
  const recentSymptoms = useCycleStore(selectRecentSymptoms);

  // ─── "Where's the science?" ─────────────────────────────────────
  // The explainer card and its three graphs are the last thing in a long
  // scroll — grid, fertile window, heads-up, nudges, phase summary, week
  // strip, legend, sisterhood bridge, overlaps, symptom recall, THEN the
  // science. The owner's report that "the scientific information is completely
  // invisible and the graphs are not visible at all" was not a render bug:
  // the charts self-measure and draw fine (they're asserted by test:charts).
  // They were simply below the fold, several screens down, with no sign they
  // existed. So the card gets an anchor and the grid gets a one-tap jump to it.
  const scrollRef = useRef<ScrollView>(null);
  const explainerY = useRef<number>(0);
  const jumpToScience = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // -Spacing.lg so the card's title isn't flush against the status veil.
    scrollRef.current?.scrollTo({ y: Math.max(0, explainerY.current - Spacing.lg), animated: true });
  };

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

  /**
   * ─── BELOW THE FOLD WAITS FOR THE FIRST PAINT (device-test-19) ────
   *
   *  Today → Cycle showed WHITE for ~2s while Cycle → Learn merely took ~2s
   *  with no white, and that asymmetry is the whole diagnosis.
   *
   *  This screen renders a cheap FIRST pass (empty state, no data yet) and
   *  commits it immediately — so the tab attaches and the old screen is torn
   *  down — and only THEN do its effects run and its engines compute, blocking
   *  the JS thread for a second or two with an all-but-empty view on screen.
   *  Whatever the window is painted with shows through that gap; it used to be
   *  the Android default, which is white. Learn has no early commit, so the
   *  user simply waits on the previous tab and never sees a gap.
   *
   *  `app.json` now paints the window in the aurora ground, so the gap can no
   *  longer be white. This closes the other half: the grid, the legend and the
   *  week-ahead strip — everything actually on screen — mount in the first
   *  pass, and the explainer, the charts, the insights and the science panels
   *  wait until after the first frame. Nothing below the fold is visible
   *  during that wait, so deferring it costs the user nothing and gives back
   *  the two seconds.
   */
  const [belowFold, setBelowFold] = useState(false);
  useEffect(() => {
    // TWO FRAMES, NOT `runAfterInteractions`.
    //
    //  The first version waited on InteractionManager, which clears only once
    //  EVERY registered interaction has finished — including the tab bar's
    //  pill spring, which runs on every single tab switch. So the panels did
    //  not arrive a frame after the grid, they arrived after the whole tab
    //  animation settled, and the owner saw the science "loading a bit late".
    //
    //  One frame lets the grid paint; the second mounts the rest. That is
    //  ~32ms rather than ~500ms, which is below the threshold where a person
    //  reads it as loading at all.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => setBelowFold(true));
    });
    return () => {
      cancelAnimationFrame(outer);
      if (inner) cancelAnimationFrame(inner);
    };
  }, []);

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
        logSilentFailure('calendar.getPeriodDaysInRange', err);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, viewedMonth]);

  // Newest first — the fertile window weighs recent regularity.
  const cycleLengths = useMemo(
    () => cycleHistory.map((c) => c.cycleLength).reverse(),
    [cycleHistory]
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
      logSilentFailure('calendar.getPeriodDaysInRange', err);
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
    // Quick-log mode: a past day toggles in place. A FUTURE day still opens
    // the sheet — you cannot have bled tomorrow, and silently doing nothing
    // would read as a broken tap.
    if (quickLog && !cell.isFuture) {
      void onQuickToggleDay(iso, cell);
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    setSelected(buildSelected(iso, cell.isFuture, e));
  };

  const onWeekDayPress = (iso: string, e: GestureResponderEvent) => {
    setSelected(buildSelected(iso, iso > todayIso, e));
  };

  /**
   * Log ONE day as a period day, for whoever the calendar is currently
   * showing. Takes the date explicitly so both the sheet and the one-tap
   * quick-log path (device-test-24) use exactly the same write.
   */
  const logPeriodFor = async (iso: string, flowLevel: number) => {
    const selected = { iso };
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
      logSilentFailure('calendar.logPeriodDay', err);
    }
  };

  /** The undo half. Same shape, same routing, same single write. */
  const unlogPeriodFor = async (iso: string) => {
    const selected = { iso };
    try {
      log.action('unlogPeriodDay:start', { forSister: logTargetId !== null, date: selected.iso });
      if (logTargetId) {
        await useSisterhoodStore
          .getState()
          .unlogShadowPeriod(phase, { memberId: logTargetId, date: selected.iso });
        setSisterVersion((v) => v + 1);
      } else {
        await timed('store.unlogPeriodDay', () =>
          useCycleStore.getState().unlogPeriodDay(selected.iso)
        );
        await timed('calendar.reloadPeriodDays', () => reloadPeriodDays());
      }
      log.action('unlogPeriodDay:done');
    } catch (err) {
      log.error('unlogPeriodDay failed', { message: String(err) });
      logSilentFailure('calendar.unlogPeriodDay', err);
    }
  };

  // The sheet's two handlers, now thin wrappers over the shared writes.
  const onLogSelectedPeriod = async (flowLevel: number) => {
    if (!selected) return;
    await logPeriodFor(selected.iso, flowLevel);
  };
  const onUnlogSelectedPeriod = async () => {
    if (!selected) return;
    await unlogPeriodFor(selected.iso);
  };

  // ─── ONE TAP, NO SHEET (device-test-24) ─────────────────────────
  //
  //  Owner: "we should provide an option where they can log the period with a
  //  single click from the calendar itself. They don't have to click on it
  //  and enter the pane and click done."
  //
  //  Right: marking five consecutive days cost five taps, five sheets, five
  //  buttons and five Dones — the owner's own diagnostic log shows exactly
  //  that sequence, over and over. But the sheet is not useless either; it
  //  carries flow, notes, plans and the phase explanation. So this is a MODE,
  //  not a replacement: Details is the default and unchanged, Quick log turns
  //  every past day into a toggle. The mode is remembered, because someone
  //  back-filling three months should not have to re-choose it each visit.
  const [quickLog, setQuickLog] = useState<boolean>(() => Storage.quickLogMode.get());
  const toggleQuickLog = () => {
    const next = !quickLog;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setQuickLog(next);
    Storage.quickLogMode.set(next);
    log.action('calendar.quickLogMode', { on: next });
  };

  /** One tap marks or unmarks — no sheet, no confirmation, instantly undoable. */
  const onQuickToggleDay = async (iso: string, cell: MonthCell) => {
    if (!cell.inMonth || cell.isFuture) return;
    const wasLogged = periodDays.has(iso);
    // Haptics differ per direction so the hand knows which way it went
    // without looking — you are usually tapping a run of days in sequence.
    Haptics.impactAsync(
      wasLogged ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium
    ).catch(() => {});
    if (wasLogged) await unlogPeriodFor(iso);
    else await logPeriodFor(iso, DEFAULT_QUICK_FLOW);
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

  // ─── The selected sister's FULL history ─────────────────────────
  //
  //  The month-range fetch below is enough to PAINT her days, but a cycle is
  //  measured between two period blocks, so modelling her needs everything she
  //  has. Loaded only for the one sister currently selected — six sisters'
  //  full histories on every month swipe would be wasteful and pointless.
  const [sisterAllDays, setSisterAllDays] = useState<string[]>([]);
  useEffect(() => {
    if (!logTargetId) {
      setSisterAllDays([]);
      return;
    }
    let cancelled = false;
    sisterhoodRepository
      .getShadowPeriodDaysInRange(logTargetId, '1900-01-01', '2999-12-31')
      .then((days) => {
        if (!cancelled) setSisterAllDays(days);
      })
      .catch((err) => logSilentFailure('calendar:sisterHistory', err));
    return () => {
      cancelled = true;
    };
  }, [logTargetId, sisterVersion]);

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
        logSilentFailure('calendar.sisterPeriodDays', err);
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

  /*
   * `coincidingDays` lived here: it expanded each overlap range into a set so
   * the GRID could glow on a shared day. The grid draws one person now, so
   * there is nothing to glow — the overlap survives as the sentence
   * `cycleOverlaps` already writes, which is what it always really was.
   */

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
  // ─── WHAT HAPPENED LAST TIME ────────────────────────────────────
  //
  //  Every symptom the user logs is aligned to the day of the period it fell
  //  in, so the calendar can say "on day 2 you've logged nausea in 2 of your
  //  last 3 periods". Before this, those logs were written to the database and
  //  never read back for anything the user could see (device-test-12).
  //
  //  It speaks ONLY about her own history, always with the sample size, and
  //  stays silent on a single occurrence — see symptom-recall.ts for why it
  //  will not claim what "people" experience.
  const [symptomHistory, setSymptomHistory] = useState<
    { date: string; symptomType: string; severity: number }[]
  >([]);

  useEffect(() => {
    const uid = useUserStore.getState().userId;
    if (!uid) return;
    let cancelled = false;
    const today = formatISO(new Date());
    checkinRepository
      .getSymptomsInRange(uid, addDays(today, -200), today)
      .then((rows) => {
        if (cancelled) return;
        setSymptomHistory(
          rows.map((r) => ({ date: r.date, symptomType: r.symptomType, severity: r.severity }))
        );
      })
      .catch(() => {
        // Non-fatal — the recall card simply doesn't render.
      });
    return () => {
      cancelled = true;
    };
  }, [periodDays]);

  const symptomRecall = useMemo(
    () =>
      recallSymptoms({
        symptoms: symptomHistory,
        periodStarts: groupPeriodBlocks(Array.from(periodDays)).map((b) => b.start).reverse(),
      }),
    [symptomHistory, periodDays]
  );

  const periodPattern = useMemo(
    () => analysePeriodPattern(Array.from(periodDays)),
    [periodDays]
  );

  const logTarget = logTargetId ? loggableSisters.find((v) => v.memberId === logTargetId) ?? null : null;

  /**
   * Her own model, from the days you marked for her — the same pure explainer
   * and the same three charts the user gets, not a simplified stand-in.
   */
  const sisterSubject = useMemo(() => {
    if (!logTarget) return null;
    const history = buildSisterCycleHistory(sisterAllDays);
    // MemberView is the privacy-filtered projection and deliberately carries
    // no shadow context, so the raw member is read for age/conditions.
    const ctx = (rawMembersById[logTarget.memberId]?.shadowContext ?? null) as ShadowContext | null;
    return {
      name: logTarget.displayName,
      cycleHistory: history.records,
      lastPeriodStart: history.lastPeriodStart,
      dataNote: sisterHistorySummary(history, logTarget.displayName),
      healthProfile: {
        age: ctx?.age ?? null,
        mode: ctx?.mode ?? 'adult',
        conditions: ctx?.conditions ?? EMPTY_CONDITIONS,
        weightKg: null,
        heightCm: null,
        activityLevel: null,
        averageCycleLength: ctx?.averageCycleLength ?? null,
        averagePeriodLength: null,
        onMedications: false,
      },
    };
  }, [logTarget, sisterAllDays, rawMembersById]);

  // ─── ONE PERSON PER CALENDAR (device-test-20) ───────────────────
  //
  //  The grid used to draw the user AND every sister at once: her days as gold
  //  arcs under your cells, shared days with a gold halo. The owner's verdict
  //  after living with it: "no matter how good we make the UI, how
  //  differentiating the colours, the user is still going to get confused."
  //
  //  That is the right call, and it is not a colour problem. Two people's
  //  cycles on one grid asks the reader to hold two models at once on the one
  //  screen whose whole job is to answer "where am I". Adding a third mark for
  //  the overlap makes it worse, not clearer.
  //
  //  So the chips at the top choose WHOSE calendar this is, and the answer is
  //  always exactly one person. Selecting a sister swaps the subject of the
  //  grid, the fertile window, the week ahead and every panel below it — the
  //  same model, run on her data — and nothing of yours is drawn beside it.
  //
  //  The overlap is not lost. It was never really a colour: it is a sentence,
  //  and it still appears as one (the "same days" insight below), where it
  //  cannot be misread as a state of a day.
  const gridSubject = useMemo(() => {
    if (!sisterSubject || !logTarget) {
      return {
        isSister: false,
        name: 'You',
        periodDays,
        lastPeriodStart,
        avgCycleLength: userHealth?.averageCycleLength ?? 28,
        avgPeriodLength: userHealth?.averagePeriodLength ?? 5,
        predictedNextPeriod: latestPrediction?.predictedNextPeriod ?? null,
        predictionWindowDays: latestPrediction?.windowDays ?? 3,
        cycleLengths,
      };
    }

    //  Her prediction comes from the SAME predictor, not a simplified
    //  stand-in — one definition of correct, or the two calendars would
    //  disagree about the same maths.
    let predicted: string | null = null;
    let windowDays = 3;
    if (sisterSubject.lastPeriodStart) {
      try {
        const out = predictNextPeriod({
          cycleHistory: sisterSubject.cycleHistory,
          healthProfile: sisterSubject.healthProfile,
          lastPeriodStart: new Date(sisterSubject.lastPeriodStart),
        });
        predicted = formatISO(out.predictedDate);
        windowDays = out.windowDays;
      } catch (err) {
        logSilentFailure('calendar.sisterPrediction', err);
      }
    }

    return {
      isSister: true,
      name: logTarget.displayName,
      periodDays: new Set(sisterAllDays),
      lastPeriodStart: sisterSubject.lastPeriodStart,
      avgCycleLength: sisterSubject.healthProfile.averageCycleLength ?? 28,
      avgPeriodLength: 5,
      predictedNextPeriod: predicted,
      predictionWindowDays: windowDays,
      // Newest first, to match the user branch — the fertile window weighs
      // recent regularity and would read the history backwards otherwise.
      cycleLengths: sisterSubject.cycleHistory.map((c) => c.cycleLength).reverse(),
    };
  }, [
    sisterSubject,
    logTarget,
    sisterAllDays,
    periodDays,
    lastPeriodStart,
    userHealth?.averageCycleLength,
    userHealth?.averagePeriodLength,
    latestPrediction?.predictedNextPeriod,
    latestPrediction?.windowDays,
    cycleLengths,
  ]);

  // ─── Fertile window ─────────────────────────────────────────────
  // Dottie already computed `predictedOvulation` inside the predictor and then
  // drew nothing with it. This turns it into the thing every other tracker
  // shows — with the confidence and the not-contraception wording attached,
  // because a crisp six-day band drawn from two cycles would be the most
  // misleading pixels in the app. Pure + deterministic: same inputs, same days.
  const fertileWindow = useMemo(
    () =>
      buildFertileWindow({
        predictedNextPeriod: gridSubject.predictedNextPeriod,
        cycleLengths: gridSubject.cycleLengths,
      }),
    [gridSubject]
  );

  // ─── Compute calendar grid ──────────────────────────────────────
  const monthGrid = useMemo(
    () =>
      buildMonthGrid({
        viewedMonth,
        lastPeriodStart: gridSubject.lastPeriodStart,
        avgCycleLength: gridSubject.avgCycleLength,
        avgPeriodLength: gridSubject.avgPeriodLength,
        periodDays: gridSubject.periodDays,
        predictedNextPeriod: gridSubject.predictedNextPeriod,
        predictionWindowDays: gridSubject.predictionWindowDays,
        fertileDays: fertileWindow.days,
      }),
    [viewedMonth, gridSubject, fertileWindow]
  );

  // ─── Week-ahead model: next 7 days from today ───────────────────

  /**
   * Colours or dates (device-test-25). The key is the default; the dated list
   * is the same information written out. Remembered, because someone who
   * prefers reading it prefers reading it every time.
   */
  const [datesView, setDatesView] = useState<boolean>(() => Storage.calendarDatesView.get());
  const toggleLegendMode = () => {
    const next = !datesView;
    Haptics.selectionAsync().catch(() => {});
    setDatesView(next);
    Storage.calendarDatesView.set(next);
  };

  /**
   * The month's days, grouped into runs of the same mark.
   *
   * Built from `monthGrid` — the very array the cells above were rendered
   * from — so the list cannot describe a month the grid did not draw. That is
   * the owner's one hard condition on this feature.
   */
  const dayRanges = useMemo(() => groupDayRanges(monthGrid), [monthGrid]);

  /**
   * How many days in the visible month we deliberately left uncoloured
   * because they are more than a week past the expected cycle
   * (device-test-24). Drives the honest note under the grid — a blank with no
   * explanation reads as a broken calendar.
   */
  const beyondCycleDays = useMemo(
    () => monthGrid.filter((c) => c.inMonth && c.beyondCycle).length,
    [monthGrid]
  );
  const weekAhead = useMemo<WeekAheadItem[]>(() => {
    // Same subject as the grid above it. A strip that still described YOUR
    // week under HER calendar would be the exact confusion this change exists
    // to remove (device-test-20).
    const predicted = gridSubject.predictedNextPeriod;
    const windowDays = gridSubject.predictionWindowDays;
    const avgPeriodLength = gridSubject.avgPeriodLength;
    const base = new Date(`${todayIso}T00:00:00`);
    const items: WeekAheadItem[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      const iso = formatISO(d);
      const p = phaseForDate(iso, gridSubject.lastPeriodStart, userHealth) ?? phase;
      const isPeriodDay = gridSubject.periodDays.has(iso);
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
  }, [todayIso, gridSubject, userHealth, phase, mode, conditions, plannedDays]);




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
        ref={scrollRef}
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
              {/* The chip no longer just redirects logging — it changes whose
                  calendar this IS, so the banner has to say that. Calling it
                  "marking days for" while the grid, the window and every panel
                  below had quietly become hers would be the label disagreeing
                  with the screen. */}
              {logTarget.emoji} You’re looking at {logTarget.displayName}’s cycle — her days, her
              window, her science. Tap “You” to come back.
            </Text>
          </View>
        )}

        {/* ─── HOW A TAP BEHAVES (device-test-24) ──────────────────
            Owner: "we should provide an option where they can log the period
            with a single click from the calendar itself. They don't have to
            click on it and enter the pane and click done."

            A MODE rather than a replacement: the sheet still carries flow,
            notes, plans and the phase explanation, and losing it to save one
            tap would be a bad trade. In its own row above the grid, so it can
            never overlap the cells or the legend — it is part of the normal
            column flow with its own bottom margin. */}
        <Animated.View entering={rise(90)} style={styles.modeRow}>
          <PressableScale
            onPress={toggleQuickLog}
            haptic="none"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[
              styles.modeChip,
              {
                backgroundColor: quickLog ? palette.accent : palette.glass.bg,
                borderColor: quickLog ? palette.accent : palette.glass.edge,
              },
            ]}
            accessibilityRole="switch"
            accessibilityState={{ checked: quickLog }}
            accessibilityLabel="Quick log"
            accessibilityHint="One tap marks or unmarks a day, without opening the day sheet"
          >
            <Text style={styles.modeChipEmoji}>⚡</Text>
            <Text
              style={[styles.modeChipText, { color: quickLog ? palette.ground : palette.ink2 }]}
            >
              Quick log
            </Text>
          </PressableScale>
          <Text style={[styles.modeHint, { color: palette.ink3 }]} numberOfLines={2}>
            {quickLog
              ? 'One tap marks a day. Tap it again to remove it.'
              : 'Tap a day for flow, notes and what the phase means.'}
          </Text>
        </Animated.View>

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
              /* No sister arcs, no coinciding halo — the grid draws exactly
                 one person, whoever the chips above selected. See
                 `gridSubject`. */
              <DayCell
                key={cell.iso}
                cell={cell}
                onPress={(e) => onDayTap(cell.iso, cell, e)}
              />
            ))}
          </View>
        </Animated.View>

        {/* ─── WHERE THE ESTIMATE RUNS OUT (device-test-24) ─────────
            The phase calculator extends the last phase forever past the
            expected cycle length, so one old period start used to paint every
            following month solid luteal. The grid now stops colouring past a
            week overdue — and says so here rather than leaving an unexplained
            blank, which would read as a broken calendar. Its own block in the
            column with a full sectionGap below, so it cannot crowd the
            legend. */}
        {beyondCycleDays > 0 && (
          <Animated.View entering={rise(120)} style={styles.unknownNote}>
            <Text style={[styles.unknownTitle, { color: palette.ink }]}>
              Past what we can estimate
            </Text>
            <Text style={[styles.unknownBody, { color: palette.ink2 }]}>
              {beyondCycleDays} day{beyondCycleDays === 1 ? '' : 's'} here {beyondCycleDays === 1 ? 'is' : 'are'} more
              than a week past the cycle we expected, so {beyondCycleDays === 1 ? 'it is' : 'they are'} left
              uncoloured. Guessing a phase that far out would be making something up. Log the day
              your period started and the colours pick straight back up.
            </Text>
          </Animated.View>
        )}

        {/* ─── WHAT THE COLOURS MEAN, RIGHT UNDER THE GRID ──────────
            Device-test-16. The legend and the week-ahead strip used to sit
            near the BOTTOM of this screen, so to find out what "Luteal" or the
            gold sister mark meant you had to scroll away from the very thing
            you were trying to read. A key belongs beside the map. Both now sit
            immediately under the month grid, in reading order: the grid, then
            what its colours mean, then the days coming up. */}
        {/* ─── COLOURS OR DATES (device-test-25) ────────────────────
            Owner: "if the user wants to see it in a descriptive way they can
            do that, or else they can stick to the visual information.
            Obviously the visual information is the first thing."

            So: one block, two readings, a toggle between them. The key stays
            the default; the dated list is one tap away and REPLACES it rather
            than stacking under it — the column keeps exactly one block here,
            which is what stops this from crowding the week-ahead strip below.

            Both readings come from `dayMark()` on the same cells the grid
            drew, so they cannot say different things. */}
        <Animated.View entering={rise(116)} style={styles.legendModeRow}>
          <PressableScale
            onPress={toggleLegendMode}
            haptic="none"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[
              styles.legendModeChip,
              {
                backgroundColor: datesView ? palette.accent : palette.glass.bg,
                borderColor: datesView ? palette.accent : palette.glass.edge,
              },
            ]}
            accessibilityRole="switch"
            accessibilityState={{ checked: datesView }}
            accessibilityLabel="Show the dates in words"
            accessibilityHint="Lists each phase with the days it covers this month"
          >
            <Text style={styles.legendModeEmoji}>{datesView ? '📅' : '🎨'}</Text>
            <Text
              style={[styles.legendModeText, { color: datesView ? palette.ground : palette.ink2 }]}
            >
              {datesView ? 'Dates' : 'Colours'}
            </Text>
          </PressableScale>
          <Text style={[styles.legendModeHint, { color: palette.ink3 }]} numberOfLines={2}>
            {datesView
              ? `Every run of days in ${monthLabel}, from the grid above.`
              : 'Tap for the same thing written out, with dates.'}
          </Text>
        </Animated.View>

        {datesView ? (
          <Animated.View entering={FadeIn.duration(200)} style={styles.rangeList}>
            {dayRanges.length === 0 ? (
              <Text style={[styles.rangeEmpty, { color: palette.ink3 }]}>
                Nothing to describe yet — log a period day and this fills in.
              </Text>
            ) : (
              dayRanges.map((r) => (
                <RangeRow key={`${r.mark}_${r.start}`} range={r} palette={palette} />
              ))
            )}
          </Animated.View>
        ) : (
        <Animated.View entering={rise(118)} style={styles.legend}>
          {/* The swatch is the GRID's colour, not the token's (DT23) — and
              the key now separates what you LOGGED from what we ESTIMATED
              (DT24). They used to share a fill, so one tap looked like it had
              claimed five days. */}
          <LegendChip color={LOGGED_PERIOD_CELL} label="Period · you logged" kind="fill" />
          <LegendChip color={PHASE_CELL.menstrual} label="Menstrual (est.)" kind="fill" />
          <LegendChip color={PHASE_CELL.follicular} label="Follicular" kind="fill" />
          <LegendChip color={PHASE_CELL.ovulatory} label="Ovulatory" kind="fill" />
          <LegendChip color={PHASE_CELL.luteal} label="Luteal" kind="fill" />
          <LegendChip color={PHASE_AURORA.menstrual} label="Predicted period" kind="dashed" />
          {fertileWindow.ovulation ? (
            <>
              <LegendChip color={PHASE_AURORA.ovulatory} label="Fertile (est.)" kind="tint" />
              <LegendChip color={OVULATION_MARK} label="Ovulation (est.)" kind="ring" />
            </>
          ) : null}
          {/* "Sister" and "Same days" are gone with the overlay they described.
              A key may only name marks the grid actually draws. */}
        </Animated.View>
        )}

        {/* ─── REMINDERS, FROM WHERE YOU NOTICE YOU WANT ONE ─────────
            device-test-22, owner: "put a toggle in the cycle screen section
            right below the calendar to add reminders which redirects the users
            to the reminder section under YOU tab — that would make their life
            easier since we have added more options under reminders."

            Right instinct: the moment you want a heads-up is the moment you
            are looking at the date it would fire for. It is a LINK, not a
            second set of switches — one place owns reminders, and a duplicate
            control here would be a second place for the same setting to
            disagree with itself (the same reasoning as one calendar, rule 17). */}
        <Animated.View entering={rise(122)} style={styles.remindersCta}>
          <PressableScale
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              router.push('/(profile)/reminders');
            }}
            haptic="none"
            style={[styles.remindersRow, { borderColor: palette.glass.edge }]}
            accessibilityRole="button"
            accessibilityLabel="Set up reminders"
            accessibilityHint="Opens your reminder settings"
          >
            <Text style={styles.remindersEmoji}>🔔</Text>
            <View style={styles.remindersText}>
              <Text style={[styles.remindersTitle, { color: palette.ink }]}>
                Want a heads-up for these days?
              </Text>
              <Text style={[styles.remindersSub, { color: palette.ink3 }]}>
                Period, phase changes, or your own — all set on your phone
              </Text>
            </View>
            <Text style={[styles.remindersChevron, { color: palette.accent }]}>›</Text>
          </PressableScale>
        </Animated.View>

        {/* Week-ahead strip — only once there's real cycle data, else every day
            would show the same assumed phase (the repeated-placeholder feel). */}
        {lastPeriodStart != null && weekAhead.length > 0 && (
          <Animated.View entering={rise(126)} style={styles.weekAhead}>
            <WeekAheadStrip items={weekAhead} onDayPress={onWeekDayPress} />
          </Animated.View>
        )}


        {/* Everything from here down is BELOW THE FOLD and waits for the
            first paint — see `belowFold` above. */}
        {!belowFold ? null : (
        <>
        {/* One tap to the maths. Sits directly under the grid because that is
            where the question gets asked — "why is my period drawn there?" —
            and the answer used to be ten screens away with nothing pointing at
            it. Measured scroll, not a guess at an offset, so it lands on the
            card whatever is or isn't rendered above it. */}
        <Animated.View entering={rise(122)}>
          <PressableScale
            onPress={jumpToScience}
            haptic="none"
            scaleTo={0.98}
            style={[
              styles.scienceJump,
              { backgroundColor: palette.glass.bg, borderColor: `${palette.accent}55` },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Jump to how this prediction is made, with the graphs"
          >
            <Text style={styles.scienceJumpEmoji}>📈</Text>
            <View style={styles.scienceJumpText}>
              <Text style={[styles.scienceJumpTitle, { color: palette.ink }]}>
                Why these dates?
              </Text>
              <Text style={[styles.scienceJumpBody, { color: palette.ink3 }]}>
                The window, the spread, and three graphs of your own data.
              </Text>
            </View>
            <Text style={[styles.scienceJumpArrow, { color: palette.accent }]}>↓</Text>
          </PressableScale>
        </Animated.View>

        {/* ─── FERTILE WINDOW ────────────────────────────────────────
            The marks on the grid, explained in words, immediately under the
            grid they belong to. Three things are non-negotiable here and all
            three are asserted by test:fertile:

              · it says ESTIMATED, every time, in the title;
              · it shows how much history it is standing on, so a six-day band
                drawn from two cycles can't look like knowledge;
              · it carries the shared not-contraception wording verbatim.

            Rendered only when there IS a prediction to count back from. With
            nothing logged there is no window — and an empty fertile card would
            be exactly the chart-shaped skeleton we don't ship. */}
        {fertileWindow.ovulation && fertileWindow.start && fertileWindow.end ? (
          <Animated.View entering={rise(130)}>
            <View
              style={[
                styles.fertileCard,
                {
                  borderColor: `${PHASE_AURORA.ovulatory}55`,
                  backgroundColor: `${PHASE_AURORA.ovulatory}12`,
                },
              ]}
            >
              <Text style={[styles.fertileTitle, { color: palette.ink }]}>
                🌱 Estimated fertile window
              </Text>
              <Text style={[styles.fertileDates, { color: palette.ink }]}>
                {formatFriendlyDate(fertileWindow.start)} – {formatFriendlyDate(fertileWindow.end)}
                {'  ·  '}
                <Text style={{ color: PHASE_AURORA.ovulatory }}>
                  ovulation around {formatFriendlyDate(fertileWindow.ovulation)}
                </Text>
              </Text>

              {/* Confidence as a bar, not just a number — the width IS the
                  claim, so a thin bar can't be misread as a confident one. */}
              <View style={styles.fertileConfRow}>
                <View style={[styles.fertileConfTrack, { backgroundColor: palette.glass.bg }]}>
                  <View
                    style={[
                      styles.fertileConfFill,
                      {
                        width: `${Math.round(fertileWindow.confidence * 100)}%`,
                        backgroundColor: PHASE_AURORA.ovulatory,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.fertileConfText, { color: palette.ink3 }]}>
                  {Math.round(fertileWindow.confidence * 100)}% confidence
                </Text>
              </View>

              <Text style={[styles.fertileBody, { color: palette.ink2 }]}>
                {fertileWindow.summary}
              </Text>
              <Text style={[styles.fertileWarning, { color: palette.ink3 }]}>
                {NOT_CONTRACEPTION}
              </Text>
            </View>
          </Animated.View>
        ) : null}

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
              Everything below is hers too — the window, the spread and the
              graphs are all built from the days you&apos;ve marked for her.
              Tap &ldquo;You&rdquo; above to switch back to your own.
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

        {/* ─── WHAT YOUR LAST PERIODS FELT LIKE ──────────────────────
            The symptoms already being logged every day, replayed against the
            period that is coming. Only rendered when something actually
            repeated — a single occurrence is a coincidence, and presenting it
            as a forecast is how an app loses trust. Every line carries its own
            sample size. */}
        {symptomRecall.items.some((i) => i.repeated) && (
          <Animated.View
            entering={rise(90)}
            style={[
              styles.recallCard,
              { borderColor: `${PHASE_AURORA.menstrual}44`, backgroundColor: `${PHASE_AURORA.menstrual}12` },
            ]}
          >
            <Text style={[styles.recallTitle, { color: palette.ink }]}>
              🔁 What your last periods felt like
            </Text>
            <Text style={[styles.recallSummary, { color: palette.ink3 }]}>
              {symptomRecall.summary}
            </Text>
            {symptomRecall.items
              .filter((i) => i.repeated)
              .slice(0, 4)
              .map((i) => (
                <View key={i.symptomType} style={styles.recallRow}>
                  <View style={[styles.recallDay, { borderColor: `${PHASE_AURORA.menstrual}88` }]}>
                    <Text style={[styles.recallDayText, { color: palette.ink }]}>
                      D{i.typicalDay}
                    </Text>
                  </View>
                  <Text style={[styles.recallBody, { color: palette.ink2 }]}>
                    {i.label} — {i.occurrences} of your last {i.cycles} periods
                  </Text>
                </View>
              ))}
            {/* The line for day 1 of the period that's coming, when there is
                one worth showing. */}
            {recallForDay(symptomRecall, 1) ? (
              <Text style={[styles.recallLead, { color: palette.ink2 }]}>
                {recallForDay(symptomRecall, 1)}
              </Text>
            ) : null}
          </Animated.View>
        )}

        {/* How this prediction is made — the dynamic explainer card. ALWAYS
            renders: with a period logged it explains the live prediction; with
            none it explains what will be used and still draws the figures.
            Bottom clearance now comes from contentContainerStyle (it has to
            include insets.bottom), so no spacer view here. */}
        <View onLayout={(e) => { explainerY.current = e.nativeEvent.layout.y; }}>
          <PredictionExplainerCard subject={sisterSubject} />
        </View>
        </>
        )}
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
          /* Same precedence the grid uses — a day you're bleeding on is never
             also drawn as fertile, so the sheet can't contradict the cell. */
          fertile={
            selected.isPeriodDay ? null : (fertileWindow.days.get(selected.iso) ?? null)
          }
          isFuture={selected.isFuture}
          daysUntilPredictedPeriod={selected.daysUntilPredictedPeriod}
          dayInCycle={selected.dayInCycle}
          mode={mode}
          conditions={conditions}
          initialPlan={Storage.dayPlans.get(selected.iso)}
          todayCheckIn={selected.iso === todayIso ? todayCheckIn : null}
          recentSymptoms={recentSymptoms}
          onLogPeriod={onLogSelectedPeriod}
          onUnlogPeriod={onUnlogSelectedPeriod}
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

/**
 * Entrance helper — a FADE, with no vertical travel (device-test-21).
 *
 *  This was `FadeInDown...springify()`: every block slid up into place on a
 *  spring, staggered by up to 360ms. On Today and Learn that is applied to two
 *  or three blocks and reads as a nice settle. This screen has FIFTEEN, so the
 *  whole page visibly assembled itself from the bottom — the owner's "the
 *  screen goes up and comes down for a split second", and the reason it happens
 *  on Today→Cycle and nowhere else.
 *
 *  The below-fold split made it worse: the grid springs in, then a frame later
 *  the panels spring in behind it, so the page moved twice.
 *
 *  Opacity only now. Content appears where it will stay, which is the one thing
 *  a calendar has to do — you are looking for a specific date, and a date that
 *  is still travelling is a date you cannot read. The stagger is cut to a
 *  fifth so the fade reads as one screen arriving rather than a queue.
 */
function rise(delay: number) {
  return FadeIn.duration(220).delay(Math.min(delay, 360) / 5);
}

// ─── SUBCOMPONENTS ───────────────────────────────────────────────────

function DayCell({
  cell,
  sisterMark,
  coincides,
  onPress,
}: {
  cell: MonthCell;
  /** A sister's period on this day — drawn in her own colour, never a phase hue. */
  sisterMark?: 'logged' | 'predicted';
  /**
   * This day is BOTH yours and hers. Device-test-16: "if the predicted period
   * coincides ... we should show it in a glowing format." Overlap is the single
   * most interesting thing this grid can tell two people who care about each
   * other, and it was previously indistinguishable from any other sister mark.
   */
  coincides?: boolean;
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
  let ovulationRing: string | undefined;

  //
  // ─── OPAQUE, ALWAYS (device-test-23) ─────────────────────────────
  //
  //  Every fill below used to be an 8-hex ALPHA over whatever the aurora
  //  blooms were doing behind the grid — a phase day was `…24`, i.e. 14% of
  //  the phase colour and 86% background. So the colour of a follicular day
  //  drifted with the blooms, and on a bright screen (when the blooms are
  //  strongest) it stopped being distinguishable from them at all. That is
  //  DT23's "couldn't tell the difference between the aurora colour and the
  //  phase colour" — and it is why the DT22 colour audit could pass while the
  //  screen still looked wrong: the audit measured the token, the eye saw the
  //  composite.
  //
  //  These are composited against the ground in `theme/blend.ts` and drawn
  //  opaque, so a day's colour is the same colour on any background, at any
  //  brightness, whatever the blooms are doing. Ink is chosen by contrast
  //  rather than assumed.
  //
  // ─── ONE FUNCTION DECIDES (device-test-25) ───────────────────────
  //
  //  The precedence used to live in this chain of `else if`s, which meant the
  //  dated list under the grid would have had to re-derive it — and the owner
  //  was explicit: "never, ever add contradictory information from the visual
  //  calendar and what we are showing in the information below." Two
  //  independent derivations is exactly how a key starts lying about its map.
  //
  //  `dayMark()` now answers "what is this day" for BOTH renderers. This
  //  switch only chooses paint.
  const mark = dayMark(cell);

  if (!cell.inMonth) {
    textColor = palette.ink3;
  } else if (mark === 'logged') {
    // The ONLY solid fill on the grid. A logged day is the one thing here
    // that is a fact rather than an estimate (device-test-24).
    bgColor = LOGGED_PERIOD_CELL;
    textColor = inkOn(LOGGED_PERIOD_CELL);
  } else if (mark === 'predicted') {
    bgColor = PREDICTED_CELL;
    textColor = inkOn(PREDICTED_CELL);
    borderStyle = 'dashed';
    borderColor = PHASE_AURORA.menstrual;
  } else if (mark === 'ovulation') {
    // ─── A DAY THAT IS TWO THINGS SHOWS BOTH (device-test-24) ─────
    //
    //  Owner: "since ovulatory is much more opaque it is overshadowing the
    //  fertile window option." Right — ovulation used to REPLACE the fertile
    //  fill with a brighter one of the same hue, so the most informative day
    //  on the grid quietly deleted the span it belongs to.
    //
    //  It keeps the fertile fill now (an ovulation day IS a fertile day) and
    //  earns its identity from SHAPE: a bright ring plus a mark in the
    //  corner. Colour for the span, shape for the single day.
    bgColor = OVULATION_CELL;
    textColor = inkOn(OVULATION_CELL);
    ovulationRing = OVULATION_MARK;
  } else if (mark === 'fertile') {
    // Deliberately quieter than any phase. This is the least certain thing on
    // the grid and it must not look like the most confident. Still opaque.
    bgColor = FERTILE_CELL;
    textColor = inkOn(FERTILE_CELL);
  } else if (mark === 'menstrual' || mark === 'follicular' || mark === 'ovulatory' || mark === 'luteal') {
    bgColor = PHASE_CELL[mark];
    textColor = PHASE_INK[mark];
  }

  return (
    <PressableScale
      style={[
        styles.dayCell,
        bgColor ? { backgroundColor: bgColor } : null,
        borderStyle === 'dashed' && borderColor
          ? { borderWidth: 1.5, borderStyle: 'dashed', borderColor }
          : null,
        ovulationRing ? { borderWidth: 1.5, borderColor: ovulationRing } : null,
        // The glow: a warm halo around a day you and she share.
        coincides
          ? {
              borderWidth: 2,
              borderColor: A.gold,
              shadowColor: A.gold,
              shadowOpacity: 0.9,
              shadowRadius: 7,
              shadowOffset: { width: 0, height: 0 },
              elevation: 6,
            }
          : null,
        isToday ? { borderWidth: 2, borderColor: palette.accent } : null,
      ]}
      scaleTo={0.9}
      haptic="none"
      onPress={onPress}
      disabled={!cell.inMonth}
      accessibilityRole="button"
      accessibilityLabel={dayCellLabel(cell)}
    >
      <Text style={[styles.dayCellText, { color: textColor }, !cell.inMonth && { opacity: 0.5 }]}>
        {cell.dayOfMonth}
      </Text>
      {/* The ovulation mark: a filled pip in the corner, in the bright hue.
          The ring says "this day is special", the pip says WHICH special —
          and both survive the fertile fill staying underneath, which is the
          point (device-test-24). Identity is never colour alone (rule: the
          legend carries a shape per mark), and here the shape is the whole
          identity. */}
      {cell.inMonth && cell.fertile === 'ovulation' ? (
        <View
          style={[styles.dayOvulationPip, { backgroundColor: OVULATION_MARK }]}
          pointerEvents="none"
        />
      ) : null}
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
            strokeWidth={coincides ? 2.6 : 2}
            strokeLinecap="round"
            fill="none"
            /* A coinciding day is drawn "on" — solid and full strength — even
               when her mark is only predicted. An overlap you can barely see is
               an overlap you won't notice (device-test-16). */
            opacity={coincides || sisterMark === 'logged' ? 1 : 0.5}
            strokeDasharray={!coincides && sisterMark === 'predicted' ? '3,3' : undefined}
          />
        </Svg>
      ) : null}
    </PressableScale>
  );
}

/**
 * What a screen reader hears when it lands on a day. Without this every cell
 * announces a bare number and the whole grid is meaningless — the period days,
 * the prediction, the fertile estimate all vanish for anyone not looking at the
 * colours.
 *
 * It used to carry its own copy of the precedence chain, which made it a THIRD
 * renderer free to disagree with the other two: a sighted user could see a
 * fertile day where a blind user was told a luteal one. It asks `dayMark()`
 * now, like the cell and the dated list, and only the wording is its own.
 */
function dayCellLabel(cell: MonthCell): string {
  const parts: string[] = [formatFriendlyDate(cell.iso)];
  const mark = dayMark(cell);
  if (mark !== 'unknown') parts.push(MARK_SPOKEN[mark]);
  if (cell.coincides) parts.push('also a predicted day for your sister');
  return parts.join(', ');
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

/**
 * ─── THE SWATCH IS THE MARK (device-test-19) ────────────────────────
 *
 *  The legend used a coloured dot for almost everything, so "Ovulatory",
 *  "Fertile (est.)" and "Sister" were three IDENTICAL gold dots, and
 *  "Ovulation (est.)" and "Same days" were two identical rings. The grid above
 *  distinguishes all five perfectly well; the key underneath it did not — which
 *  makes the key worse than useless, because it states that different things
 *  are the same.
 *
 *  Each swatch now draws exactly what a DayCell draws for that state:
 *
 *    fill    solid colour               — Period and the phase bands
 *    tint    faint wash, no border      — Fertile (est.), deliberately the
 *                                         faintest thing here because it is
 *                                         the least certain thing on the grid
 *    dashed  dashed ring                — Predicted
 *    ring    solid ring over a tint     — Ovulation (est.)
 *    arc     a gold arc under the day   — Sister
 *    glow    ring plus a warm halo      — Same days
 */
type LegendKind = 'fill' | 'tint' | 'dashed' | 'ring' | 'arc' | 'glow';

/**
 * One run of days, in words (device-test-25).
 *
 *  Owner: "along with the date, we may want to add the phase information."
 *  Right — a date and a label answer WHEN and WHAT, and the reason anyone
 *  opens a cycle app is SO WHAT. Every row carries all three:
 *
 *      ● Luteal          29–31 Aug · 3 days
 *        Winding down. Be gentle with yourself.
 *
 *  The swatch is the exact colour the grid painted, the label is the same
 *  string the legend chip uses, and the detail line is vetted copy the app
 *  already shows elsewhere (`getPhaseDescription`, `NOT_CONTRACEPTION`) — so
 *  a phase is never described two ways in one app.
 *
 *  A logged run is badged RECORDED. It is the only row here that is a fact,
 *  and in a list where everything reads with equal confidence, the difference
 *  has to be said rather than shaded (device-test-24).
 */
function RangeRow({
  range,
  palette,
}: {
  range: DayRange;
  palette: ReturnType<typeof useAurora>['palette'];
}): JSX.Element {
  const recorded = isRecorded(range.mark);
  const swatch = MARK_SWATCH[range.mark];
  const ring = MARK_RING[range.mark];
  return (
    <View
      style={[
        styles.rangeRow,
        {
          borderColor: palette.glass.edge,
          backgroundColor: palette.glass.bg,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`${MARK_LABEL[range.mark]}, ${rangeDatesLabel(range)}, ${range.days} day${
        range.days === 1 ? '' : 's'
      }. ${markDetail(range.mark)}`}
    >
      <View
        style={[
          styles.rangeSwatch,
          {
            backgroundColor: swatch,
            borderColor: ring ?? (range.mark === 'unknown' ? palette.glass.edge : swatch),
            borderWidth: ring ? 2 : 1,
          },
        ]}
      />
      <View style={styles.rangeBody}>
        <View style={styles.rangeHead}>
          <Text style={[styles.rangeLabel, { color: palette.ink }]}>
            {MARK_LABEL[range.mark]}
          </Text>
          <Text style={[styles.rangeDates, { color: palette.ink2 }]}>
            {rangeDatesLabel(range)} · {range.days} day{range.days === 1 ? '' : 's'}
          </Text>
        </View>
        {/* Every row here reads with the same confidence, so the difference
            between a fact and an estimate has to be SAID (device-test-24).
            An 'unknown' run gets neither badge — it is the absence of both. */}
        {recorded ? (
          <Text style={[styles.rangeRecorded, { color: palette.accent }]}>RECORDED BY YOU</Text>
        ) : range.mark === 'unknown' ? null : (
          <Text style={[styles.rangeRecorded, { color: palette.ink3 }]}>ESTIMATED</Text>
        )}
        <Text style={[styles.rangeDetail, { color: palette.ink3 }]}>
          {markDetail(range.mark)}
        </Text>
      </View>
    </View>
  );
}

/** "29–31 Aug", or "31 Aug" for a single day. */
function rangeDatesLabel(range: DayRange): string {
  const from = new Date(`${range.start}T00:00:00`);
  const to = new Date(`${range.end}T00:00:00`);
  const day = (d: Date) => d.getDate();
  const month = (d: Date) => d.toLocaleDateString(undefined, { month: 'short' });
  if (range.start === range.end) return `${day(from)} ${month(from)}`;
  // `groupDayRanges` only groups days IN the month, so a run never crosses a
  // month edge today. The two-month spelling stays as the honest fallback if
  // that ever changes — a range labelled "29–3 Aug" would be nonsense.
  if (month(from) === month(to)) return `${day(from)}–${day(to)} ${month(to)}`;
  return `${day(from)} ${month(from)} – ${day(to)} ${month(to)}`;
}

/**
 * The swatch each mark gets — the SAME opaque colours the grid paints, from
 * theme/blend.ts. Not a parallel palette: a key drawn in different paint from
 * its map is the contradiction this whole feature was conditioned on avoiding.
 */
const MARK_SWATCH: Record<DayMark, string> = {
  logged: LOGGED_PERIOD_CELL,
  predicted: PREDICTED_CELL,
  // The ovulation day keeps the fertile FILL on the grid and is identified by
  // its ring (device-test-24). The swatch does the same thing rather than
  // showing the ring colour as a fill — a key that paints a mark in a colour
  // the map never uses is the contradiction, in miniature.
  ovulation: OVULATION_CELL,
  fertile: FERTILE_CELL,
  menstrual: PHASE_CELL.menstrual,
  follicular: PHASE_CELL.follicular,
  ovulatory: PHASE_CELL.ovulatory,
  luteal: PHASE_CELL.luteal,
  unknown: 'transparent',
};

/** The marks whose identity is a SHAPE. Same ring, same colour, as the cell. */
const MARK_RING: Partial<Record<DayMark, string>> = {
  ovulation: OVULATION_MARK,
};

function LegendChip({
  color,
  label,
  kind = 'fill',
}: {
  color: string;
  label: string;
  kind?: LegendKind;
}) {
  const { palette } = useAurora();
  return (
    <View
      style={[
        styles.legendChip,
        { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
      ]}
    >
      <View style={styles.legendSwatchBox}>
        <View
          style={[
            styles.legendSwatch,
            kind === 'fill' ? { backgroundColor: color } : null,
            // Opaque, like the grid (DT23) — a key drawn in a translucent
            // wash over a drifting bloom is not showing you the grid's colour.
            kind === 'tint' ? { backgroundColor: over(color, A.ground, 0.34) } : null,
            kind === 'dashed'
              ? { borderWidth: 1.5, borderStyle: 'dashed', borderColor: color }
              : null,
            kind === 'ring'
              ? { borderWidth: 1.5, borderColor: color, backgroundColor: over(color, A.ground, 0.54) }
              : null,
            kind === 'glow'
              ? {
                  borderWidth: 2,
                  borderColor: color,
                  shadowColor: color,
                  shadowOpacity: 0.9,
                  shadowRadius: 5,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: 5,
                }
              : null,
            kind === 'arc' ? { backgroundColor: over(color, A.ground, 0.16) } : null,
          ]}
        />
        {/* The sister mark is an arc UNDER the day, not a fill — so the key
            shows an arc under a day too. */}
        {kind === 'arc' ? (
          <Svg width={12} height={4} style={styles.legendArc} pointerEvents="none">
            <Path d="M1 3 Q6 0.5 11 3" stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" />
          </Svg>
        ) : null}
      </View>
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
  /**
   * The computed phase, or null when we genuinely do not know — before the
   * anchor, in the future, or more than PHASE_DISPLAY_GRACE_DAYS past the
   * expected end of the cycle (device-test-24).
   */
  phase: Phase | null;
  /**
   * True when this day is past the expected cycle with no new period logged.
   * The grid draws nothing rather than extending luteal into next year.
   */
  beyondCycle: boolean;
  /** Estimated fertile day / ovulation day, or null. Never overrides a period. */
  fertile: FertileKind | null;
  /** Set by the renderer, not the grid builder — see DayCell. */
  coincides?: boolean;
}

interface BuildGridInput {
  viewedMonth: Date;
  lastPeriodStart: string | null;
  avgCycleLength: number;
  avgPeriodLength: number;
  periodDays: Set<string>;
  predictedNextPeriod: string | null;
  predictionWindowDays: number;
  /** Pre-built fertile-window lookup — O(1) per cell, computed once per month. */
  fertileDays: ReadonlyMap<string, FertileKind>;
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

    // Compute phase for this day (only if user has cycle data).
    //
    // ─── AND STOP WHEN WE STOP KNOWING (device-test-24) ────────────
    //
    //  The phase calculator extends the last phase forever past the expected
    //  cycle length, which is right for the predictor and wrong for a grid:
    //  one period logged in early August painted every following month solid
    //  luteal. A few days late is ordinary and still coloured; beyond the
    //  grace period the honest mark is NO mark, and the panel under the grid
    //  says why.
    let phase: Phase | null = null;
    let beyondCycle = false;
    if (lastPeriodDate && cellDate >= lastPeriodDate && !isFuture) {
      const result = calculateCurrentPhase(
        lastPeriodDate,
        cellDate,
        input.avgCycleLength,
        input.avgPeriodLength
      );
      if (result.daysPastExpected > PHASE_DISPLAY_GRACE_DAYS) {
        beyondCycle = true;
      } else {
        phase = result.phase;
      }
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

    // Fertile marking never competes with a logged or predicted period — a
    // day you are bleeding on is not drawn as a fertile day, whatever the
    // arithmetic says. Precedence is resolved here, once, so DayCell can't
    // drift from the legend.
    const fertile =
      isPeriodDay || isPredictedPeriod ? null : (input.fertileDays.get(iso) ?? null);

    cells.push({
      iso,
      dayOfMonth: cellDate.getDate(),
      inMonth,
      isFuture,
      isPeriodDay,
      isPredictedPeriod,
      phase,
      beyondCycle,
      fertile,
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
  const result = calculateCurrentPhase(
    last,
    target,
    health?.averageCycleLength ?? 28,
    health?.averagePeriodLength ?? 5
  );
  // Same bound as the grid (device-test-24): past the expected cycle the
  // sheet must not announce "Luteal phase" for a day nobody can place. The
  // owner's log shows exactly that — "Monday, 3 August, Luteal phase" on a
  // day forty-odd days past the anchor.
  if (result.daysPastExpected > PHASE_DISPLAY_GRACE_DAYS) return null;
  return result.phase;
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
  // ─── "Why these dates?" jump to the explainer ──────────────────
  scienceJump: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Spacing.radius.xl,
    paddingHorizontal: Spacing.cardPadding,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.base,
  },
  scienceJumpEmoji: { fontSize: 20 },
  scienceJumpText: { flex: 1 },
  scienceJumpTitle: { ...Typography.preset.bodySemibold },
  scienceJumpBody: { ...Typography.preset.caption, fontSize: 11, lineHeight: 15 },
  scienceJumpArrow: { fontSize: 20, fontWeight: '700' },

  // ─── Fertile window card ───────────────────────────────────────
  fertileCard: {
    borderWidth: 1,
    borderRadius: Spacing.radius.xl,
    padding: Spacing.cardPadding,
    gap: 8,
    marginBottom: Spacing.base,
  },
  fertileTitle: { ...Typography.preset.h4 },
  fertileDates: { ...Typography.preset.bodySemibold },
  fertileConfRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  fertileConfTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fertileConfFill: {
    height: '100%',
    borderRadius: 3,
  },
  fertileConfText: { ...Typography.preset.caption, fontSize: 11 },
  fertileBody: { ...Typography.preset.caption, lineHeight: 19 },
  fertileWarning: { ...Typography.preset.caption, fontSize: 11, lineHeight: 16, fontStyle: 'italic' },
  overlapCard: {
    borderWidth: 1,
    borderRadius: Spacing.radius.xl,
    padding: Spacing.cardPadding,
    gap: 6,
    marginBottom: Spacing.base,
  },
  overlapTitle: { ...Typography.preset.bodySemibold },
  // "What your last periods felt like" — symptom recall.
  recallCard: {
    borderWidth: 1,
    borderRadius: Spacing.radius.xl,
    padding: Spacing.cardPadding,
    gap: 6,
    marginBottom: Spacing.base,
  },
  recallTitle: { ...Typography.preset.bodySemibold },
  recallSummary: { ...Typography.preset.caption, fontSize: 11, lineHeight: 16 },
  recallRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  recallDay: {
    borderWidth: 1,
    borderRadius: Spacing.radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 30,
    alignItems: 'center',
  },
  recallDayText: { ...Typography.preset.captionBold, fontSize: 11 },
  recallBody: { ...Typography.preset.caption, flex: 1, lineHeight: 17 },
  recallLead: { ...Typography.preset.caption, lineHeight: 17, marginTop: 2 },
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

  dayOvulationPip: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dayCellText: {
    ...Typography.preset.bodySemibold,
    fontSize: 15,
  },
  weekAhead: {
    marginBottom: Spacing.sectionGap,
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
  // Its own row above the grid. Never absolutely positioned — it takes part
  // in the column so the cells below can't be crowded (device-test-24).
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.base,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 36,
    paddingHorizontal: Spacing.md,
    borderRadius: Spacing.radius.full,
    borderWidth: 1.5,
  },
  modeChipEmoji: { fontSize: 13 },
  modeChipText: { ...Typography.preset.caption, fontWeight: '800' },
  modeHint: { flex: 1, ...Typography.preset.caption, fontSize: 11, lineHeight: 15 },
  unknownNote: {
    borderWidth: 1,
    borderColor: A.edge,
    borderRadius: Spacing.radius.xl,
    padding: Spacing.base,
    marginBottom: Spacing.sectionGap,
    gap: 4,
  },
  unknownTitle: { ...Typography.preset.bodySemibold },
  unknownBody: { ...Typography.preset.caption, fontSize: 12, lineHeight: 17 },
  // The toggle sits in its own row above whichever reading is showing, and
  // the two readings SWAP — the column never holds both, so this cannot push
  // the week-ahead strip down (device-test-25).
  legendModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.base,
    marginBottom: Spacing.sm,
  },
  legendModeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 36,
    paddingHorizontal: Spacing.md,
    borderRadius: Spacing.radius.full,
    borderWidth: 1.5,
  },
  legendModeEmoji: { fontSize: 13 },
  legendModeText: { ...Typography.preset.caption, fontWeight: '800' },
  legendModeHint: { flex: 1, ...Typography.preset.caption, fontSize: 11, lineHeight: 15 },
  rangeList: { gap: Spacing.sm, marginBottom: Spacing.sectionGap },
  rangeEmpty: { ...Typography.preset.caption, fontSize: 12, lineHeight: 17 },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Spacing.radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
  },
  rangeSwatch: { width: 14, height: 14, borderRadius: 7, marginTop: 2, borderWidth: 1 },
  rangeBody: { flex: 1, gap: 2 },
  rangeHead: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  rangeLabel: { ...Typography.preset.captionBold, flexShrink: 1 },
  rangeDates: { ...Typography.preset.caption, fontSize: 11 },
  rangeDetail: { ...Typography.preset.caption, fontSize: 11, lineHeight: 16 },
  rangeRecorded: {
    ...Typography.preset.overline,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  remindersCta: { marginBottom: Spacing.sectionGap },
  remindersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 56,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderRadius: Spacing.radius.xl,
  },
  remindersEmoji: { fontSize: 20 },
  remindersText: { flex: 1 },
  remindersTitle: { ...Typography.preset.bodySemibold },
  remindersSub: { ...Typography.preset.caption, fontSize: 11, marginTop: 2, lineHeight: 15 },
  remindersChevron: { ...Typography.preset.h3 },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
    marginTop: Spacing.base,
    // The legend had NO bottom margin, so its last chip row sat flush against
    // "The week ahead" and the two blocks' edges touched (device-test-19).
    // Sections on this screen are separated by `sectionGap`, not by whatever
    // margin the previous block happened to leave behind.
    marginBottom: Spacing.sectionGap,
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Spacing.radius.full,
  },
  legendSwatchBox: {
    width: 14,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs,
  },
  legendSwatch: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
  },
  legendArc: {
    position: 'absolute',
    bottom: 0,
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
