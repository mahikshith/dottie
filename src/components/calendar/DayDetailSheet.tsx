/**
 * Dottie — DayDetailSheet (Calendar Planner · design-v2)
 *
 * The glass popover that opens when a day is tapped on the calendar. It
 * magnifies from the tapped cell (Apple-style), dims the month behind it, and
 * shows: the day's phase + a soft period heads-up, gentle non-diagnostic
 * suggestions (supplies / comfort / food / movement / mind), the existing
 * period quick-log, and a place to jot a plan/note. Closing returns to the
 * month with a planning dot on days the user noted or flagged.
 *
 * ─── DECISIONS (contradiction-aware) ────────────────────────────────
 *
 *  • PRESERVES the old tap→log-period behavior — it moves INTO the sheet as
 *    "Mark as period" (past/today only), so nothing is lost, and future days
 *    become plannable (the point of a week-ahead planner).
 *  • Rendered as an in-screen overlay (not a Modal) so the calendar shows
 *    through — now frosted via an expo-blur BlurView + a dim scrim.
 *  • Origin-magnify + scrim fade run on the UI thread (Reanimated), Reduce-Motion
 *    aware (instant, centered). Follows `.claude/skills/animate-expo`.
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Dimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { PressableScale } from '../ui';
import { useAurora, PHASE_AURORA } from '../../theme';
import {
  buildDaySuggestions,
  type DaySuggestion,
  type DaySuggestionCheckIn,
  type DaySuggestionSymptom,
  type PersonalSignal,
  type TrackPrompt,
} from '../../engine/calendar/day-suggestions';
import type { Phase, UserMode, HealthCondition } from '../../types/cycle.types';
import type { DayPlan } from '../../database/storage';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export interface DayDetailResult {
  note: string;
  planned: boolean;
  changed: boolean;
}

export interface DayDetailSheetProps {
  dateISO: string;
  /** Friendly date label, e.g. "Wed · Aug 19". */
  dateLabel: string;
  /** Tapped-cell centre in screen coords, for the magnify origin. */
  origin: { x: number; y: number } | null;
  phase: Phase;
  /** Has the user logged any period yet? If not, don't show an assumed phase. */
  hasCycleData: boolean;
  isPeriodDay: boolean;
  isFuture: boolean;
  daysUntilPredictedPeriod: number | null;
  /** Optional day-in-cycle (1-indexed) — feeds sub-phase resolution. */
  dayInCycle?: number | null;
  mode: UserMode;
  conditions: HealthCondition[];
  initialPlan: DayPlan | null;
  /**
   * Today's check-in — powers personal signals ("mood low → be gentle").
   * Optional; when absent the engine skips the check-in signals cleanly.
   */
  todayCheckIn?: DaySuggestionCheckIn | null;
  /**
   * Last ~7d of symptom logs — feeds the dominant-symptom signal ("you've
   * been logging headaches — pack a painkiller"). Optional; empty is fine.
   */
  recentSymptoms?: DaySuggestionSymptom[];
  /**
   * Log this day as a period day (past/today only) at the given flow level
   * (1 spotting … 4 heavy). Parent persists + reloads. Re-calling with a new
   * level updates the same day, so the user can refine after the quick tap.
   */
  onLogPeriod: (flowLevel: number) => void;
  /**
   * When set, taps are being recorded for THIS person (a sister) rather than
   * the primary user — the calendar is shared, so the sheet has to say so.
   */
  logForName?: string | null;
  /**
   * Tap on a "worth tracking" chip. Parent closes the sheet and routes into
   * the daily check-in modal so the prompt is one tap from action. Optional;
   * when absent the chips render as inert visuals (their old behavior).
   */
  onTrackTap?: (chipId: string) => void;
  /** Close — parent saves the note/planned flag and refreshes dots. */
  onClose: (result: DayDetailResult) => void;
}

export function DayDetailSheet(props: DayDetailSheetProps): JSX.Element {
  const { palette } = useAurora();
  const reduce = useReducedMotion();

  const [note, setNote] = useState<string>(props.initialPlan?.note ?? '');
  const [planned, setPlanned] = useState<boolean>(props.initialPlan?.planned ?? false);
  const [justLogged, setJustLogged] = useState(false);
  // Flow intensity for this day. The quick tap logs MEDIUM so one tap is still
  // enough (Flo's bar), then the "how heavy?" chips let the user refine — which
  // is what eventually makes the heavy-day forecast personal instead of
  // population-average.
  const [flow, setFlow] = useState<number | null>(null);

  const set = useMemo(
    () =>
      buildDaySuggestions({
        phase: props.phase,
        daysUntilPredictedPeriod: props.daysUntilPredictedPeriod,
        isPeriodDay: props.isPeriodDay,
        mode: props.mode,
        conditions: props.conditions,
        // day-of-month seed → suggestions rotate day to day, deterministically.
        daySeed: parseInt(props.dateISO.slice(8, 10), 10) || 0,
        dayInCycle: props.dayInCycle ?? null,
        todayCheckIn: props.todayCheckIn ?? null,
        recentSymptoms: props.recentSymptoms ?? [],
      }),
    [
      props.dateISO,
      props.phase,
      props.daysUntilPredictedPeriod,
      props.isPeriodDay,
      props.mode,
      props.conditions,
      props.dayInCycle,
      props.todayCheckIn,
      props.recentSymptoms,
    ]
  );

  // ── Enter / exit animation ──────────────────────────────────────
  const t = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) t.value = withSpring(1, { damping: 18, stiffness: 200, mass: 0.7 });
  }, [reduce, t]);

  const originDX = props.origin ? props.origin.x - SCREEN_W / 2 : 0;
  const originDY = props.origin ? props.origin.y - SCREEN_H / 2 : 0;

  const scrimStyle = useAnimatedStyle(() => ({ opacity: t.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, t.value * 1.4),
    transform: [
      { translateX: originDX * (1 - t.value) },
      { translateY: originDY * (1 - t.value) },
      { scale: 0.4 + 0.6 * t.value },
    ],
  }));

  // ── Teardown (crash-proofed) ────────────────────────────────────
  // The sheet's dismissal used to be gated on Reanimated's withTiming
  // COMPLETION CALLBACK (`runOnJS(finish)`). On Android, when the JS thread is
  // busy (right after logging a period recomputes the prediction), that worklet
  // callback can be dropped or fire with `done=false` — so `finish()` never
  // ran, `onClose` never fired, and this full-screen scrim (zIndex 50,
  // absoluteFill) stayed mounted swallowing every touch. That is the "screen
  // freezes after logging, must force-close the app" bug that survived ~20
  // builds. The fix: NEVER gate unmount on the animation callback. We play the
  // exit visual for looks, but the actual teardown is driven from the JS thread
  // by a plain timer that always fires. Two refs make close()/finish() each
  // run at most once. (device-test-6 #P0)
  const closingRef = useRef(false); // close() has started the exit
  const teardownRef = useRef(false); // onClose() has fired

  const finish = () => {
    if (teardownRef.current) return;
    teardownRef.current = true;
    props.onClose({
      note: note.trim(),
      planned,
      changed:
        (note.trim() !== (props.initialPlan?.note ?? '')) ||
        planned !== (props.initialPlan?.planned ?? false) ||
        justLogged,
    });
  };

  const close = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    Haptics.selectionAsync().catch(() => {});
    if (reduce) {
      finish();
      return;
    }
    t.value = withTiming(0, { duration: 180 });
    setTimeout(finish, 200); // JS thread — guaranteed to fire, unlike the worklet cb
  };

  const logPeriod = (level: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setJustLogged(true);
    setFlow(level);
    props.onLogPeriod(level);
  };

  const togglePlanned = () => {
    Haptics.selectionAsync().catch(() => {});
    setPlanned((p) => !p);
  };

  const phaseHue = PHASE_AURORA[props.phase];
  const showLogged = props.isPeriodDay || justLogged;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {/* Dimmed backdrop — tap to close.
          ⚠️ CRITICAL (device-test-6): the Android `experimentalBlurMethod=
          "dimezisBlurView"` was REMOVED here. That method snapshots the ENTIRE
          screen behind the overlay every frame; after the first period log the
          calendar fills with content (week-ahead, explainer, rich phase card),
          so the SECOND time the sheet opened it snapshotted a heavy tree and
          ANR-froze the app — the "log a 2nd day, screen freezes, must force-
          close" bug. iOS still gets a real blur; Android now uses expo-blur's
          cheap translucent fallback + the solid scrim below, which reads the
          same but never blocks the JS thread. */}
      <Animated.View style={[StyleSheet.absoluteFill, scrimStyle]}>
        <BlurView
          intensity={40}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, styles.scrim]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" accessibilityRole="button" />
      </Animated.View>

      {/* Card */}
      <Animated.View
        style={[
          styles.card,
          { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
          cardStyle,
        ]}
        accessibilityViewIsModal
        accessibilityRole="none"
      >
        {/* Header */}
        <View style={[styles.top, { borderBottomColor: palette.glass.edge }]}>
          <View style={styles.topRow}>
            <Text style={[styles.date, { color: palette.ink }]}>{props.dateLabel}</Text>
            <PressableScale onPress={close} haptic="none" hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={[styles.close, { color: palette.ink3 }]}>✕</Text>
            </PressableScale>
          </View>
          <View style={styles.chips}>
            {props.hasCycleData ? (
              <>
                {/* Chip now shows the fine SUB-PHASE (e.g. "Late luteal · PMS
                    window") — same phase for 12+ days would otherwise say the
                    same thing every day. */}
                <View style={[styles.chip, { backgroundColor: `${phaseHue}26`, borderColor: `${phaseHue}80` }]}>
                  <View style={[styles.chipDot, { backgroundColor: phaseHue }]} />
                  <Text style={[styles.chipText, { color: palette.ink }]}>{set.subphaseLabel} · {set.headline}</Text>
                </View>
                {set.prediction && (
                  <View style={[styles.chip, { backgroundColor: `${palette.accent2}22`, borderColor: `${palette.accent2}80` }]}>
                    <Text style={[styles.chipText, { color: palette.ink }]}>
                      {set.prediction.tone === 'due' ? '🩸' : '🌙'} {predictionShort(set.prediction.text)}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View style={[styles.chip, { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge }]}>
                <Text style={[styles.chipText, { color: palette.ink2 }]}>🌱 Log your period to see your phase</Text>
              </View>
            )}
          </View>
          {/* Sub-phase hormone story — a single non-diagnostic "what's
              happening" line ("Progesterone tends to peak — sleep helps"),
              the piece Clue leans on that gives the day meaning. */}
          {props.hasCycleData && set.hormoneStory ? (
            <Text style={[styles.hormone, { color: palette.ink2 }]}>{set.hormoneStory}</Text>
          ) : null}
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* YOUR DAY FIRST — most people open a day to log a period fast; that
              shouldn't sit under a wall of suggestions (owner feedback). The
              phase context + gentle tips are pushed below. */}
          <Text style={[styles.sectionLabel, { color: palette.ink3 }]}>YOUR DAY</Text>

          {!props.isFuture && (
            <>
              <PressableScale
                onPress={showLogged ? undefined : () => logPeriod(3)}
                disabled={showLogged}
                haptic="none"
                style={[
                  styles.action,
                  styles.actionPrimary,
                  { borderColor: PHASE_AURORA.menstrual, backgroundColor: showLogged ? `${PHASE_AURORA.menstrual}2E` : `${PHASE_AURORA.menstrual}18` },
                ]}
                accessibilityRole="button"
                accessibilityLabel={showLogged ? 'Period logged' : 'Mark as period'}
              >
                <Text style={styles.actionEmoji}>🩸</Text>
                <Text style={[styles.actionText, { color: palette.ink }]}>
                  {showLogged
                    ? `Period logged${props.logForName ? ` for ${props.logForName}` : ''} ✓`
                    : `Mark as period${props.logForName ? ` for ${props.logForName}` : ''}`}
                </Text>
              </PressableScale>

              {/* How heavy? — appears once the day is marked, so the fast path
                  stays one tap and intensity is an optional refinement. */}
              {showLogged ? (
                <View style={styles.flowWrap}>
                  <Text style={[styles.trackLabel, { color: palette.ink3 }]}>HOW HEAVY WAS IT?</Text>
                  <View style={styles.flowRow}>
                    {FLOW_OPTIONS.map((o) => {
                      const active = flow === o.level;
                      return (
                        <PressableScale
                          key={o.level}
                          onPress={() => logPeriod(o.level)}
                          haptic="none"
                          scaleTo={0.94}
                          style={[
                            styles.flowChip,
                            {
                              backgroundColor: active ? `${PHASE_AURORA.menstrual}33` : palette.glass.bg,
                              borderColor: active ? PHASE_AURORA.menstrual : palette.glass.edge,
                            },
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Flow: ${o.label}`}
                          accessibilityState={{ selected: active }}
                        >
                          <Text style={styles.flowDrops}>{o.drops}</Text>
                          <Text style={[styles.flowText, { color: active ? palette.ink : palette.ink2 }]}>
                            {o.label}
                          </Text>
                        </PressableScale>
                      );
                    })}
                  </View>
                </View>
              ) : null}
            </>
          )}

          <PressableScale
            onPress={togglePlanned}
            haptic="none"
            style={[
              styles.action,
              { borderColor: planned ? palette.accent : palette.glass.edge, backgroundColor: planned ? `${palette.accent}1F` : palette.glass.bg },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Plan this day"
            accessibilityState={{ selected: planned }}
          >
            <Text style={styles.actionEmoji}>📌</Text>
            <Text style={[styles.actionText, { color: palette.ink }]}>
              {planned ? 'Planned — a dot marks it on the month' : 'Plan this day'}
            </Text>
          </PressableScale>

          {/* Note */}
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Add a note or to-do for this day…"
            placeholderTextColor={palette.ink3}
            multiline
            style={[styles.note, { color: palette.ink, backgroundColor: palette.glass.bg, borderColor: palette.glass.edge }]}
            accessibilityLabel="Day note"
          />

          {/* Personal signals — "For you today". Skipped if none. This is
              the layer Flo/Clue lean on: patterns from the user's OWN logs,
              framed non-diagnostically. Shown BEFORE the phase content so
              the user sees themselves before the general narrative. */}
          {props.hasCycleData && set.personalSignals.length > 0 ? (
            <>
              <View style={[styles.divide, { backgroundColor: palette.glass.edge }]} />
              <Text style={[styles.sectionLabel, { color: palette.ink3 }]}>FOR YOU TODAY</Text>
              {set.personalSignals.map((sig) => (
                <PersonalSignalRow key={sig.id} sig={sig} />
              ))}
            </>
          ) : null}

          {/* Phase context + gentle suggestions — BELOW the actions now. */}
          {props.hasCycleData ? (
            <>
              <View style={[styles.divide, { backgroundColor: palette.glass.edge }]} />
              <Text style={[styles.sectionLabel, { color: palette.ink3 }]}>FOR THIS PHASE</Text>
              <Text style={[styles.companion, { color: palette.ink2 }]}>{set.companionLine}</Text>
              {set.cultureLine ? (
                <Text style={[styles.culture, { color: palette.ink3 }]}>{set.cultureLine}</Text>
              ) : null}
              {set.suggestions.map((s) => (
                <SuggestionRow key={s.id} s={s} />
              ))}

              {/* Track-today chips — mirrors Clue's "here's what others in
                  this sub-phase are tracking" prompt. Tap → parent closes
                  the sheet + opens the daily check-in modal so the prompt
                  is one tap from action. */}
              {set.trackPrompts.length > 0 ? (
                <View style={styles.trackWrap}>
                  <Text style={[styles.trackLabel, { color: palette.ink3 }]}>WORTH TRACKING</Text>
                  <View style={styles.trackRow}>
                    {set.trackPrompts.map((t) => (
                      <TrackChip
                        key={t.id}
                        t={t}
                        onPress={props.onTrackTap ? () => props.onTrackTap!(t.id) : undefined}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          ) : (
            <Text style={[styles.companion, { color: palette.ink2 }]}>
              Once you log your period, this is where your phase, gentle suggestions, and
              predictions appear — personalized, never guessed. 🌙
            </Text>
          )}

          {/* Google Calendar — later */}
          <View style={[styles.gcal, { borderColor: palette.glass.edge }]}>
            <Text style={styles.actionEmoji}>🔗</Text>
            <Text style={[styles.gcalText, { color: palette.ink2 }]}>Sync plans with Google Calendar</Text>
            <Text style={[styles.later, { color: palette.ink3, borderColor: palette.glass.edge }]}>LATER</Text>
          </View>

          <Text style={[styles.disclaimer, { color: palette.ink3 }]}>{set.disclaimer}</Text>
        </ScrollView>

        {/* Done */}
        <PressableScale
          onPress={close}
          haptic="light"
          scaleTo={0.97}
          style={[styles.done, { backgroundColor: palette.accent }]}
          accessibilityRole="button"
          accessibilityLabel="Done"
        >
          <Text style={[styles.doneText, { color: palette.ground }]}>Done</Text>
        </PressableScale>
      </Animated.View>
    </View>
  );
}

// Flow levels mirror the sisterhood log so both paths speak the same language.
const FLOW_OPTIONS = [
  { level: 1, label: 'Spotting', drops: '💧' },
  { level: 2, label: 'Light', drops: '💧💧' },
  { level: 3, label: 'Medium', drops: '💧💧💧' },
  { level: 4, label: 'Heavy', drops: '💧💧💧💧' },
] as const;

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────

function SuggestionRow({ s }: { s: DaySuggestion }): JSX.Element {
  const { palette } = useAurora();
  return (
    <View style={styles.sug}>
      <View style={[styles.sugIcon, { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge }]}>
        <Text style={styles.sugEmoji}>{s.emoji}</Text>
      </View>
      <View style={styles.sugBody}>
        <Text style={[styles.sugTitle, { color: palette.ink }]}>{s.title}</Text>
        <Text style={[styles.sugDetail, { color: palette.ink2 }]}>{s.detail}</Text>
        {/* Why-tag — the "reasoning receipt" competitors add so a suggestion
            doesn't read as arbitrary. Rendered as a tiny caption. */}
        {s.why ? (
          <Text style={[styles.sugWhy, { color: palette.accent }]}>· {s.why}</Text>
        ) : null}
      </View>
    </View>
  );
}

function PersonalSignalRow({ sig }: { sig: PersonalSignal }): JSX.Element {
  const { palette } = useAurora();
  return (
    <View
      style={[
        styles.personal,
        { backgroundColor: `${palette.accent}12`, borderColor: `${palette.accent}55` },
      ]}
    >
      <Text style={styles.personalEmoji}>{sig.emoji}</Text>
      <View style={styles.personalBody}>
        <Text style={[styles.personalTitle, { color: palette.ink }]}>{sig.title}</Text>
        <Text style={[styles.personalDetail, { color: palette.ink2 }]}>{sig.detail}</Text>
      </View>
    </View>
  );
}

function TrackChip({ t, onPress }: { t: TrackPrompt; onPress?: () => void }): JSX.Element {
  const { palette } = useAurora();
  const style = [
    styles.trackChip,
    { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
  ];
  if (onPress) {
    return (
      <PressableScale
        onPress={onPress}
        haptic="light"
        scaleTo={0.94}
        style={style}
        accessibilityRole="button"
        accessibilityLabel={`Log ${t.label}`}
      >
        <Text style={styles.trackChipEmoji}>{t.emoji}</Text>
        <Text style={[styles.trackChipText, { color: palette.ink2 }]}>{t.label}</Text>
      </PressableScale>
    );
  }
  return (
    <View style={style}>
      <Text style={styles.trackChipEmoji}>{t.emoji}</Text>
      <Text style={[styles.trackChipText, { color: palette.ink2 }]}>{t.label}</Text>
    </View>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────

// Trim the parenthetical softener for the compact chip; the full text lives in
// the companion line / suggestions.
function predictionShort(text: string): string {
  return text.replace(/\s*\([^)]*\)/g, '').replace(/\.$/, '');
}

// ─── STYLES (layout only — colours inline, palette-driven) ───────────

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, zIndex: 50 },
  scrim: { backgroundColor: 'rgba(0,0,0,0.55)' },
  card: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '86%',
    borderWidth: 1,
    borderRadius: Spacing.radius['2xl'],
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 36,
    elevation: 16,
  },
  top: { padding: Spacing.cardPadding, borderBottomWidth: 1 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: { ...Typography.preset.h4 },
  close: { fontSize: 18, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, paddingHorizontal: Spacing.sm + 2, paddingVertical: 5, borderRadius: Spacing.radius.full },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { ...Typography.preset.caption, fontWeight: '800' },

  body: { paddingHorizontal: Spacing.cardPadding },
  bodyContent: { paddingTop: Spacing.md, paddingBottom: Spacing.md, gap: Spacing.md },
  companion: { ...Typography.preset.body, fontStyle: 'italic' },

  sug: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  sugIcon: { width: 36, height: 36, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sugEmoji: { fontSize: 17 },
  sugBody: { flex: 1 },
  sugTitle: { ...Typography.preset.bodySemibold },
  sugDetail: { ...Typography.preset.caption, lineHeight: 19, marginTop: 1 },
  sugWhy: { ...Typography.preset.caption, fontSize: 10, marginTop: 2, letterSpacing: 0.3 },

  // "For you today" personal-signal card — highlighted (accent tint) so it
  // stands out from the general phase suggestions below.
  personal: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Spacing.radius.lg,
    padding: Spacing.md,
  },
  personalEmoji: { fontSize: 20 },
  personalBody: { flex: 1 },
  personalTitle: { ...Typography.preset.bodySemibold },
  personalDetail: { ...Typography.preset.caption, lineHeight: 19, marginTop: 1 },

  // "Worth tracking" hint chips — inert visuals for now (log flows can be
  // wired to onPress later so tapping a chip jumps into that log form).
  flowWrap: { gap: Spacing.xs, marginTop: -Spacing.xs },
  flowRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  flowChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: Spacing.radius.full,
  },
  flowDrops: { fontSize: 10 },
  flowText: { ...Typography.preset.caption, fontSize: 11, fontWeight: '700' },

  trackWrap: { gap: Spacing.xs, marginTop: Spacing.xs },
  trackLabel: { ...Typography.preset.overline, letterSpacing: 1 },
  trackRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  trackChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: Spacing.radius.full,
  },
  trackChipEmoji: { fontSize: 11 },
  trackChipText: { ...Typography.preset.caption, fontSize: 11, fontWeight: '700' },

  // Culture line under the companion — the soft "many report…" normalising
  // signal.
  culture: { ...Typography.preset.caption, fontStyle: 'italic', lineHeight: 18, marginTop: -Spacing.xs },

  // Hormone story — one line under the sub-phase chip.
  hormone: { ...Typography.preset.caption, lineHeight: 19, marginTop: Spacing.sm },

  divide: { height: 1, marginVertical: Spacing.xs },
  sectionLabel: { ...Typography.preset.overline, letterSpacing: 1 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderRadius: Spacing.radius.lg,
    padding: Spacing.md,
  },
  actionPrimary: { borderWidth: 2 },
  actionEmoji: { fontSize: 18 },
  actionText: { ...Typography.preset.bodySemibold, flex: 1 },
  note: {
    minHeight: 64,
    borderWidth: 1,
    borderRadius: Spacing.radius.lg,
    padding: Spacing.md,
    ...Typography.preset.body,
    textAlignVertical: 'top',
  },
  gcal: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderWidth: 1, borderStyle: 'dashed', borderRadius: Spacing.radius.lg, padding: Spacing.md },
  gcalText: { ...Typography.preset.caption, fontWeight: '700', flex: 1 },
  later: { ...Typography.preset.overline, fontSize: 9, borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  disclaimer: { ...Typography.preset.caption, fontStyle: 'italic', textAlign: 'center', marginTop: Spacing.xs },

  done: { height: Spacing.buttonHeight.md, alignItems: 'center', justifyContent: 'center', margin: Spacing.cardPadding, borderRadius: Spacing.radius.full },
  doneText: { ...Typography.preset.button },
});
