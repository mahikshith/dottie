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
 *    through, dimmed. True frosted blur awaits `expo-blur`; a scrim stands in.
 *  • Origin-magnify + scrim fade run on the UI thread (Reanimated), Reduce-Motion
 *    aware (instant, centered). Follows `.claude/skills/animate-expo`.
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device).
 */

import { useEffect, useMemo, useState } from 'react';
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
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { PressableScale } from '../ui';
import { useAurora, PHASE_AURORA } from '../../theme';
import { buildDaySuggestions, type DaySuggestion } from '../../engine/calendar/day-suggestions';
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
  isPeriodDay: boolean;
  isFuture: boolean;
  daysUntilPredictedPeriod: number | null;
  mode: UserMode;
  conditions: HealthCondition[];
  initialPlan: DayPlan | null;
  /** Log this day as a period day (past/today only). Parent persists + reloads. */
  onLogPeriod: () => void;
  /** Close — parent saves the note/planned flag and refreshes dots. */
  onClose: (result: DayDetailResult) => void;
}

export function DayDetailSheet(props: DayDetailSheetProps): JSX.Element {
  const { palette } = useAurora();
  const reduce = useReducedMotion();

  const [note, setNote] = useState<string>(props.initialPlan?.note ?? '');
  const [planned, setPlanned] = useState<boolean>(props.initialPlan?.planned ?? false);
  const [justLogged, setJustLogged] = useState(false);

  const set = useMemo(
    () =>
      buildDaySuggestions({
        phase: props.phase,
        daysUntilPredictedPeriod: props.daysUntilPredictedPeriod,
        isPeriodDay: props.isPeriodDay,
        mode: props.mode,
        conditions: props.conditions,
      }),
    [props.phase, props.daysUntilPredictedPeriod, props.isPeriodDay, props.mode, props.conditions]
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

  const finish = () => {
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
    Haptics.selectionAsync().catch(() => {});
    if (reduce) {
      finish();
      return;
    }
    t.value = withTiming(0, { duration: 180 }, (done) => {
      if (done) runOnJS(finish)();
    });
  };

  const logPeriod = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setJustLogged(true);
    props.onLogPeriod();
  };

  const togglePlanned = () => {
    Haptics.selectionAsync().catch(() => {});
    setPlanned((p) => !p);
  };

  const phaseHue = PHASE_AURORA[props.phase];
  const showLogged = props.isPeriodDay || justLogged;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {/* Scrim — tap to close */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
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
            <View style={[styles.chip, { backgroundColor: `${phaseHue}26`, borderColor: `${phaseHue}80` }]}>
              <View style={[styles.chipDot, { backgroundColor: phaseHue }]} />
              <Text style={[styles.chipText, { color: palette.ink }]}>{set.phaseLabel} · {set.headline}</Text>
            </View>
            {set.prediction && (
              <View style={[styles.chip, { backgroundColor: `${palette.accent2}22`, borderColor: `${palette.accent2}80` }]}>
                <Text style={[styles.chipText, { color: palette.ink }]}>
                  {set.prediction.tone === 'due' ? '🩸' : '🌙'} {predictionShort(set.prediction.text)}
                </Text>
              </View>
            )}
          </View>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Companion line */}
          <Text style={[styles.companion, { color: palette.ink2 }]}>{set.companionLine}</Text>

          {/* Suggestions */}
          {set.suggestions.map((s) => (
            <SuggestionRow key={s.id} s={s} />
          ))}

          <View style={[styles.divide, { backgroundColor: palette.glass.edge }]} />

          {/* Quick actions */}
          <Text style={[styles.sectionLabel, { color: palette.ink3 }]}>YOUR DAY</Text>

          {!props.isFuture && (
            <PressableScale
              onPress={showLogged ? undefined : logPeriod}
              disabled={showLogged}
              haptic="none"
              style={[
                styles.action,
                { borderColor: showLogged ? PHASE_AURORA.menstrual : palette.glass.edge, backgroundColor: showLogged ? `${PHASE_AURORA.menstrual}1F` : palette.glass.bg },
              ]}
              accessibilityRole="button"
              accessibilityLabel={showLogged ? 'Period logged' : 'Mark as period'}
            >
              <Text style={styles.actionEmoji}>🩸</Text>
              <Text style={[styles.actionText, { color: palette.ink }]}>
                {showLogged ? 'Period logged for this day ✓' : 'Mark as period'}
              </Text>
            </PressableScale>
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
      </View>
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
