/**
 * Dottie — Today's Spotlight Card (Learn Redesign Phase 1)
 *
 * Aurora hero card at the top of the Learn tab. Surfaces 1-3 lessons
 * matched to the user's current sub-phase via `selectSpotlightLessons`
 * (Gemini Master Spec §1.2 "Aurora Hero Card" applied to our 6-companion
 * system, not just Blossom).
 *
 * ─── SILENT WHEN EMPTY ──────────────────────────────────────────────
 *
 * If the selector returns nothing (impossible given the fallback paths,
 * but defensively handled) or the user has no cycle data AND no
 * foundational lessons remain unfinished, the card falls back to a
 * warm "explore the library" prompt rather than showing an empty state.
 *
 * ─── NON-DIAGNOSTIC COPY ────────────────────────────────────────────
 *
 * The `why` line comes from the selector and matches Gemini §4.2
 * discipline: "Right now you might" / "Many people report" wording.
 * NEVER "your brain is better today."
 *
 *  ⚠️ design-v2 / UNVERIFIED on device.
 */

import { StyleSheet, Text, View } from 'react-native';
import { PressableScale } from '../ui';
import { useAurora } from '../../theme';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import type { SpotlightLesson } from '../../engine/learn/phase-aware-selector';

export interface TodaySpotlightCardProps {
  lessons: SpotlightLesson[];
  /** Tap the primary CTA / a lesson row → open that lesson. */
  onOpenLesson: (lessonId: string) => void;
  /** If the user has no cycle data yet, we hint at logging first. */
  hasCycleData: boolean;
}

export function TodaySpotlightCard(props: TodaySpotlightCardProps): JSX.Element {
  const { palette } = useAurora();
  const top = props.lessons[0];

  // Empty-state fallback — should be rare given the selector's fallback
  // paths, but if the library is empty we still render a warm card.
  if (!top) {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
        ]}
      >
        <Text style={styles.emoji}>🌱</Text>
        <Text style={[styles.title, { color: palette.ink }]}>Your library awaits</Text>
        <Text style={[styles.body, { color: palette.ink2 }]}>
          Scroll down for every path, or check back once you've logged a period —
          I'll then spotlight lessons matched to your phase.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.chip, { backgroundColor: `${palette.accent}22`, borderColor: `${palette.accent}80` }]}>
          <Text style={[styles.chipText, { color: palette.ink }]}>
            {hasCycleDataChipLabel(props.hasCycleData)}
          </Text>
        </View>
      </View>

      {/* Primary lesson — the headline */}
      <PressableScale
        onPress={() => props.onOpenLesson(top.lesson.id)}
        haptic="light"
        scaleTo={0.98}
        style={styles.primary}
        accessibilityRole="button"
        accessibilityLabel={`Open lesson: ${top.lesson.title}`}
      >
        <Text style={[styles.primaryTitle, { color: palette.ink }]}>
          {top.lesson.emoji}  {top.lesson.title}
        </Text>
        <Text style={[styles.why, { color: palette.accent }]}>
          Why today: {top.why}
        </Text>
        <View style={styles.meta}>
          {top.lesson.difficulty ? (
            <View style={[styles.tier, { borderColor: palette.glass.edge }]}>
              <Text style={[styles.tierText, { color: palette.ink3 }]}>
                {top.lesson.difficulty}
              </Text>
            </View>
          ) : null}
          <Text style={[styles.metaText, { color: palette.ink3 }]}>
            {top.lesson.estimatedMinutes} min
            {top.alreadyCompleted ? '  ·  already done' : ''}
          </Text>
        </View>
      </PressableScale>

      {/* Runners-up — compact rows */}
      {props.lessons.slice(1).map((s) => (
        <PressableScale
          key={s.lesson.id}
          onPress={() => props.onOpenLesson(s.lesson.id)}
          haptic="none"
          scaleTo={0.98}
          style={[styles.runner, { borderTopColor: palette.glass.edge }]}
          accessibilityRole="button"
          accessibilityLabel={`Open lesson: ${s.lesson.title}`}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.runnerTitle, { color: palette.ink }]} numberOfLines={1}>
              {s.lesson.emoji}  {s.lesson.title}
            </Text>
            <Text style={[styles.runnerMeta, { color: palette.ink3 }]}>
              {s.lesson.difficulty ? `${s.lesson.difficulty} · ` : ''}
              {s.lesson.estimatedMinutes} min
              {s.alreadyCompleted ? '  ·  already done' : ''}
            </Text>
          </View>
          <Text style={[styles.chevron, { color: palette.accent }]}>›</Text>
        </PressableScale>
      ))}
    </View>
  );
}

function hasCycleDataChipLabel(hasData: boolean): string {
  return hasData ? '✨ For today' : '🌱 A great place to start';
}

// ─── STYLES (layout only — colours inline, palette-driven) ──────────

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Spacing.radius['2xl'],
    padding: Spacing.cardPaddingLarge,
    gap: Spacing.md,
  },
  headerRow: { flexDirection: 'row' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: Spacing.radius.full,
  },
  chipText: { ...Typography.preset.caption, fontWeight: '800' },

  primary: { gap: Spacing.xs },
  primaryTitle: { ...Typography.preset.h4 },
  why: { ...Typography.preset.caption, fontStyle: 'italic' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs },
  tier: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tierText: { ...Typography.preset.caption, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaText: { ...Typography.preset.caption },

  runner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  runnerTitle: { ...Typography.preset.bodySemibold },
  runnerMeta: { ...Typography.preset.caption, marginTop: 2 },
  chevron: { fontSize: 22, fontWeight: '600' },

  emoji: { fontSize: 32 },
  title: { ...Typography.preset.h4 },
  body: { ...Typography.preset.body, lineHeight: 20 },
});

// Silence unused-import warning until the empty-state uses hasCycleData.
void hasCycleDataChipLabel;
