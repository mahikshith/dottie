/**
 * PhaseWeatherCard — MOOD AURORA THEME (design-v2)
 *
 * Ambient card showing the global community pulse. Presentational (view via
 * props). Themed to the aurora palette: glass surfaces, the user's phase hue
 * from PHASE_AURORA, all text from the active palette. Expand/collapse state,
 * the toggle haptic, and every copy string are unchanged.
 *
 * ⚠️ design-v2 / UNVERIFIED (no device).
 */

import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { useAurora, PHASE_AURORA } from '../../theme';
import { PhaseWeatherView } from '../../types/phase-weather.types';

interface PhaseWeatherCardProps {
  view: PhaseWeatherView;
}

export function PhaseWeatherCard({ view }: PhaseWeatherCardProps) {
  const { palette } = useAurora();
  const [expanded, setExpanded] = useState(false);
  const { snapshot, inSameRhythmDisplay, userPhase } = view;
  const phaseHue = PHASE_AURORA[userPhase];
  const dominantHue = PHASE_AURORA[snapshot.dominantPhase];

  const totalDisplay = useMemo(
    () => snapshot.totalDotties.toLocaleString(),
    [snapshot.totalDotties]
  );
  const dateLabel = useMemo(() => formatDateLabel(snapshot.date), [snapshot.date]);

  const handleToggle = () => {
    Haptics.selectionAsync().catch(() => {});
    setExpanded((prev) => !prev);
  };

  const topFeeling = snapshot.topFeelings[0];
  const topCraving = snapshot.topCravings[0];

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
      ]}
    >
      {/* Header strip */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerEmoji}>🌤️</Text>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: palette.ink }]}>Phase Weather</Text>
            <Text style={[styles.subtitle, { color: palette.ink3 }]}>{dateLabel}</Text>
          </View>
        </View>
        {snapshot.isLocalPreview ? (
          <View style={[styles.previewBadge, { backgroundColor: palette.glass.bg }]}>
            <Text style={[styles.previewBadgeText, { color: palette.ink3 }]}>Local preview</Text>
          </View>
        ) : null}
      </View>

      {/* The emotional payoff line — uses the USER's phase hue */}
      <View
        style={[
          styles.rhythmCard,
          { backgroundColor: palette.glass.bg, borderLeftColor: phaseHue },
        ]}
      >
        <View style={[styles.rhythmDot, { backgroundColor: phaseHue }]} />
        <View style={styles.rhythmContent}>
          <Text style={[styles.rhythmTitle, { color: palette.ink }]}>
            You & {inSameRhythmDisplay} others
          </Text>
          <Text style={[styles.rhythmSubtitle, { color: palette.ink2 }]}>
            in the same rhythm right now
          </Text>
        </View>
      </View>

      {/* At-a-glance stats */}
      <View style={styles.glanceRow}>
        <GlanceStat accent={dominantHue} label="Most are" value={snapshot.dominantPhase} />
        {topFeeling ? (
          <GlanceStat emoji={topFeeling.emoji} label="Top feeling" value={topFeeling.label} />
        ) : null}
        {topCraving ? (
          <GlanceStat emoji={topCraving.emoji} label="Top craving" value={topCraving.label} />
        ) : null}
      </View>

      {/* Expanded details */}
      {expanded ? (
        <View style={styles.expanded}>
          {snapshot.topFeelings.length > 0 ? (
            <View style={styles.expandSection}>
              <Text style={[styles.expandLabel, { color: palette.ink3 }]}>Top feelings</Text>
              <View style={styles.chipRow}>
                {snapshot.topFeelings.map((f) => (
                  <Chip key={`feel_${f.label}`} emoji={f.emoji} label={f.label} />
                ))}
              </View>
            </View>
          ) : null}

          {snapshot.topCravings.length > 0 ? (
            <View style={styles.expandSection}>
              <Text style={[styles.expandLabel, { color: palette.ink3 }]}>Top cravings</Text>
              <View style={styles.chipRow}>
                {snapshot.topCravings.map((c) => (
                  <Chip key={`crave_${c.label}`} emoji={c.emoji} label={c.label} />
                ))}
              </View>
            </View>
          ) : null}

          {snapshot.topSymptoms.length > 0 ? (
            <View style={styles.expandSection}>
              <Text style={[styles.expandLabel, { color: palette.ink3 }]}>Showing up today</Text>
              <View style={styles.chipRow}>
                {snapshot.topSymptoms.map((s) => (
                  <Chip key={`sym_${s.label}`} emoji={s.emoji} label={s.label} />
                ))}
              </View>
            </View>
          ) : null}

          <Text style={[styles.totalHint, { color: palette.ink3 }]}>
            Drawing from {totalDisplay} Dotties checking in this day
          </Text>
        </View>
      ) : null}

      {/* Warm one-liner */}
      <Text style={[styles.warmMessage, { color: palette.ink2 }]}>{snapshot.warmMessage}</Text>

      {/* Expand/collapse toggle */}
      <Pressable
        onPress={handleToggle}
        style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Hide weather details' : 'See more weather details'}
      >
        <Text style={[styles.toggleText, { color: phaseHue }]}>
          {expanded ? 'Show less' : 'See more'}
        </Text>
      </Pressable>
    </View>
  );
}

// ─── SUBCOMPONENTS ───────────────────────────────────────────────────

function GlanceStat({
  emoji,
  accent,
  label,
  value,
}: {
  emoji?: string;
  accent?: string;
  label: string;
  value: string;
}) {
  const { palette } = useAurora();
  return (
    <View style={[styles.glanceStat, { backgroundColor: palette.glass.bg }]}>
      {emoji ? (
        <Text style={styles.glanceEmoji}>{emoji}</Text>
      ) : (
        <View style={[styles.glanceDot, { backgroundColor: accent ?? palette.accent }]} />
      )}
      <Text style={[styles.glanceLabel, { color: palette.ink3 }]}>{label}</Text>
      <Text style={[styles.glanceValue, { color: palette.ink }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Chip({ emoji, label }: { emoji: string; label: string }) {
  const { palette } = useAurora();
  return (
    <View style={[styles.chip, { backgroundColor: palette.glass.bg }]}>
      <Text style={styles.chipEmoji}>{emoji}</Text>
      <Text style={[styles.chipText, { color: palette.ink }]}>{label}</Text>
    </View>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────

function formatDateLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const formatted = d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return isToday ? `Today · ${formatted}` : formatted;
}

// ─── STYLES (layout only — colours are inline, palette-driven) ───────

const styles = StyleSheet.create({
  card: {
    padding: Spacing.cardPaddingLarge,
    borderRadius: Spacing.radius['2xl'],
    borderWidth: 1,
    marginBottom: Spacing.sectionGap,
    gap: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 26,
    elevation: 6,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerEmoji: {
    fontSize: 22,
    marginRight: Spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...Typography.preset.h4,
  },
  subtitle: {
    ...Typography.preset.caption,
    marginTop: 1,
  },
  previewBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Spacing.radius.full,
  },
  previewBadgeText: {
    ...Typography.preset.overline,
    fontSize: 9,
    letterSpacing: 0.6,
  },
  rhythmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.radius.xl,
    padding: Spacing.md,
    borderLeftWidth: 3,
  },
  rhythmDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: Spacing.md,
  },
  rhythmContent: {
    flex: 1,
  },
  rhythmTitle: {
    ...Typography.preset.bodySemibold,
  },
  rhythmSubtitle: {
    ...Typography.preset.caption,
    marginTop: 2,
  },
  glanceRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  glanceStat: {
    flex: 1,
    borderRadius: Spacing.radius.lg,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  glanceEmoji: {
    fontSize: 20,
    marginBottom: 2,
    height: 24,
  },
  glanceDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 8,
    marginTop: 6,
  },
  glanceLabel: {
    ...Typography.preset.caption,
    fontSize: 11,
  },
  glanceValue: {
    ...Typography.preset.bodySemibold,
    fontSize: 13,
    textTransform: 'capitalize',
    marginTop: 2,
  },
  expanded: {
    gap: Spacing.md,
    paddingTop: Spacing.sm,
  },
  expandSection: {
    gap: Spacing.xs,
  },
  expandLabel: {
    ...Typography.preset.overline,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: Spacing.radius.full,
    gap: 4,
  },
  chipEmoji: {
    fontSize: 13,
  },
  chipText: {
    ...Typography.preset.caption,
    textTransform: 'capitalize',
  },
  totalHint: {
    ...Typography.preset.caption,
    fontStyle: 'italic',
  },
  warmMessage: {
    ...Typography.preset.body,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  toggle: {
    alignSelf: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  togglePressed: {
    opacity: 0.7,
  },
  toggleText: {
    ...Typography.preset.captionBold,
  },
});
