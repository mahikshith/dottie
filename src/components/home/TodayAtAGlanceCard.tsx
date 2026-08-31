/**
 * Dottie — TodayAtAGlanceCard (Home tab · design-v2)
 *
 * The Home-tab "reading" of today, using the same day-suggestion engine
 * that powers the calendar day sheet (`src/engine/calendar/day-suggestions`).
 *
 *   sub-phase chip   →   hormone story   →   one personal signal (if any)
 *                    →   one top suggestion (with `why`)   →   see more →
 *
 * ─── WHY IT LIVES ON HOME ───────────────────────────────────────────
 *
 *  The competitor scan (see docs/DAY-SUGGESTIONS.md) found that the strongest
 *  home surface — Clue's Cycle Phase Insights, Flo's daily insight — is a
 *  narrative of TODAY. Ours previously said "Follicular Phase · Day 8" and
 *  jumped to weather/predicts/decode. This card gives the day a MEANING at a
 *  glance before the user opens the calendar.
 *
 * ─── SILENT WHEN EMPTY ──────────────────────────────────────────────
 *
 *  The parent already guards with `hasCycleData`. If somehow this renders
 *  with no phase story, it hides cleanly — no card frame, no empty state.
 *  Personal-signal + suggestion rows only render when the engine returned
 *  something worth showing.
 *
 *  ⚠️ design-v2 / UNVERIFIED on device — pure presentation.
 */

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { GlassCard, PressableScale } from '../ui';
import { useAurora, PHASE_AURORA } from '../../theme';
import {
  buildDaySuggestions,
  type DaySuggestion,
  type DaySuggestionCheckIn,
  type DaySuggestionSymptom,
  type PersonalSignal,
} from '../../engine/calendar/day-suggestions';
import type { Phase, UserMode, HealthCondition } from '../../types/cycle.types';

export interface TodayAtAGlanceCardProps {
  phase: Phase;
  dayInCycle: number;
  daysUntilPredictedPeriod: number | null;
  isPeriodDay: boolean;
  mode: UserMode;
  conditions: HealthCondition[];
  todayCheckIn: DaySuggestionCheckIn | null;
  recentSymptoms: DaySuggestionSymptom[];
  /** Companion emoji for the header — keeps the warm voice on Home. */
  companionEmoji: string;
  /** Tap the card / "see more" → open today's calendar day sheet. */
  onSeeMore: () => void;
  /** Tap a "worth tracking" chip → open the daily check-in. */
  onTrack: () => void;
}

export function TodayAtAGlanceCard(props: TodayAtAGlanceCardProps): JSX.Element {
  const { palette } = useAurora();

  const set = useMemo(
    () =>
      buildDaySuggestions({
        phase: props.phase,
        dayInCycle: props.dayInCycle,
        daysUntilPredictedPeriod: props.daysUntilPredictedPeriod,
        isPeriodDay: props.isPeriodDay,
        mode: props.mode,
        conditions: props.conditions,
        todayCheckIn: props.todayCheckIn,
        recentSymptoms: props.recentSymptoms,
        // Day-of-month seed → same rotation as the calendar sheet for today.
        daySeed: new Date().getDate(),
      }),
    [
      props.phase,
      props.dayInCycle,
      props.daysUntilPredictedPeriod,
      props.isPeriodDay,
      props.mode,
      props.conditions,
      props.todayCheckIn,
      props.recentSymptoms,
    ]
  );

  const phaseHue = PHASE_AURORA[props.phase];
  const topSignal: PersonalSignal | undefined = set.personalSignals[0];
  const topSuggestion: DaySuggestion | undefined = set.suggestions[0];

  return (
    <GlassCard style={styles.card}>
      {/* Header — sub-phase chip + prediction chip if we have one */}
      <View style={styles.headerRow}>
        <View style={styles.chips}>
          <View style={[styles.chip, { backgroundColor: `${phaseHue}26`, borderColor: `${phaseHue}80` }]}>
            <View style={[styles.chipDot, { backgroundColor: phaseHue }]} />
            <Text style={[styles.chipText, { color: palette.ink }]}>
              {set.subphaseLabel}
            </Text>
          </View>
          {set.prediction && (
            <View style={[styles.chip, { backgroundColor: `${palette.accent2}22`, borderColor: `${palette.accent2}80` }]}>
              <Text style={[styles.chipText, { color: palette.ink }]}>
                {set.prediction.tone === 'due' ? '🩸' : '🌙'} {shortenPrediction(set.prediction.text)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Hormone story — the "why is today the way it is" line */}
      <Text style={[styles.hormone, { color: palette.ink2 }]}>{set.hormoneStory}</Text>

      {/* One personal signal — only when the engine returned one, so this
          section stays quiet when there's nothing to say */}
      {topSignal ? (
        <View
          style={[
            styles.personal,
            { backgroundColor: `${palette.accent}14`, borderColor: `${palette.accent}55` },
          ]}
        >
          <Text style={styles.personalEmoji}>{topSignal.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.personalTitle, { color: palette.ink }]}>{topSignal.title}</Text>
            <Text style={[styles.personalDetail, { color: palette.ink2 }]}>{topSignal.detail}</Text>
          </View>
        </View>
      ) : null}

      {/* One top phase suggestion — with its `why` tag */}
      {topSuggestion ? (
        <View style={styles.tipRow}>
          <View style={[styles.tipIcon, { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge }]}>
            <Text style={styles.tipEmoji}>{topSuggestion.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.tipTitle, { color: palette.ink }]}>{topSuggestion.title}</Text>
            <Text style={[styles.tipDetail, { color: palette.ink2 }]}>{topSuggestion.detail}</Text>
            {topSuggestion.why ? (
              <Text style={[styles.tipWhy, { color: palette.accent }]}>· {topSuggestion.why}</Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Worth-tracking chips — tap opens the check-in so the prompt is
          one tap from action (was inert before). */}
      {set.trackPrompts.length > 0 ? (
        <View style={styles.trackRow}>
          {set.trackPrompts.slice(0, 4).map((t) => (
            <PressableScale
              key={t.id}
              onPress={props.onTrack}
              haptic="light"
              scaleTo={0.94}
              style={[
                styles.trackChip,
                { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Log ${t.label}`}
            >
              <Text style={styles.trackChipEmoji}>{t.emoji}</Text>
              <Text style={[styles.trackChipText, { color: palette.ink2 }]}>{t.label}</Text>
            </PressableScale>
          ))}
        </View>
      ) : null}

      {/* See more → today's calendar day sheet */}
      <PressableScale
        onPress={props.onSeeMore}
        haptic="none"
        scaleTo={0.98}
        style={styles.seeMore}
        accessibilityRole="button"
        accessibilityLabel="See today in the calendar"
      >
        <Text style={[styles.seeMoreText, { color: palette.accent }]}>See today ›</Text>
      </PressableScale>
    </GlassCard>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────

function shortenPrediction(text: string): string {
  // Drop the parenthetical "(windows can shift…)" softener + trailing dot for
  // the compact chip — the fuller text lives on the day sheet.
  return text.replace(/\s*\([^)]*\)/g, '').replace(/\.$/, '');
}

// ─── STYLES (layout only — colours inline, palette-driven) ───────────

const styles = StyleSheet.create({
  card: {
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    flex: 1,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: Spacing.radius.full,
  },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { ...Typography.preset.caption, fontWeight: '800' },
  hormone: { ...Typography.preset.body, lineHeight: 21 },

  personal: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Spacing.radius.lg,
    padding: Spacing.md,
  },
  personalEmoji: { fontSize: 20 },
  personalTitle: { ...Typography.preset.bodySemibold },
  personalDetail: { ...Typography.preset.caption, lineHeight: 19, marginTop: 1 },

  tipRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipEmoji: { fontSize: 17 },
  tipTitle: { ...Typography.preset.bodySemibold },
  tipDetail: { ...Typography.preset.caption, lineHeight: 19, marginTop: 1 },
  tipWhy: { ...Typography.preset.caption, fontSize: 10, marginTop: 2, letterSpacing: 0.3 },

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

  seeMore: { alignSelf: 'flex-end', paddingVertical: 2 },
  seeMoreText: { ...Typography.preset.bodySemibold },
});
