/**
 * PhaseWeatherCard
 *
 * A gentle, ambient card on the Home screen that shows the global
 * community pulse: how many Dotties are checking in today, which phase
 * is dominant, top feelings, top cravings, and a warm one-liner.
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  - Visually distinct from action cards: soft phase-tinted background,
 *    subtle gradient feel via layered surfaces (no LinearGradient
 *    needed — keeps deps lean), no big CTAs. Pure ambience.
 *  - Always shows the user "you and X others" line first — that's the
 *    emotional payoff.
 *  - The "Local preview" hint is tiny and tasteful — testers know
 *    they're seeing a sample, no false promises of real-time data.
 *  - Tappable only via the optional collapse/expand chevron; the card
 *    itself is presentational so it never competes with the home
 *    screen's primary actions.
 *
 * ─── DEPENDENCIES (kept minimal on purpose) ─────────────────────────
 *
 *  Imports only from constants, expo-haptics, and the canonical types
 *  in /src/types/phase-weather.types.ts. Does NOT import from the
 *  store directly — the home screen passes the view in as a prop so
 *  this component remains trivially testable and never causes a full
 *  Home re-render when the snapshot rebuilds.
 */

import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { Shadows } from '../../constants/shadows';
import {
  PhaseWeatherView,
} from '../../types/phase-weather.types';

interface PhaseWeatherCardProps {
  view: PhaseWeatherView;
}

export function PhaseWeatherCard({ view }: PhaseWeatherCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { snapshot, inSameRhythmDisplay, userPhase } = view;
  const phaseColors = Colors.phase[userPhase];
  const dominantPhaseColors = Colors.phase[snapshot.dominantPhase];

  // Pretty total Dotties count
  const totalDisplay = useMemo(
    () => snapshot.totalDotties.toLocaleString(),
    [snapshot.totalDotties]
  );

  // Pretty date label ("Today · Mon, Jun 17")
  const dateLabel = useMemo(() => formatDateLabel(snapshot.date), [snapshot.date]);

  const handleToggle = () => {
    Haptics.selectionAsync().catch(() => {});
    setExpanded((prev) => !prev);
  };

  // Top entry for collapsed view
  const topFeeling = snapshot.topFeelings[0];
  const topCraving = snapshot.topCravings[0];

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: phaseColors.light },
      ]}
    >
      {/* Header strip */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerEmoji}>🌤️</Text>
          <View style={styles.headerText}>
            <Text style={styles.title}>Phase Weather</Text>
            <Text style={styles.subtitle}>{dateLabel}</Text>
          </View>
        </View>
        {snapshot.isLocalPreview ? (
          <View style={styles.previewBadge}>
            <Text style={styles.previewBadgeText}>Local preview</Text>
          </View>
        ) : null}
      </View>

      {/* The emotional payoff line — uses the USER's phase color */}
      <View style={[styles.rhythmCard, { borderLeftColor: phaseColors.primary }]}>
        <View style={[styles.rhythmDot, { backgroundColor: phaseColors.primary }]} />
        <View style={styles.rhythmContent}>
          <Text style={styles.rhythmTitle}>
            You & {inSameRhythmDisplay} others
          </Text>
          <Text style={styles.rhythmSubtitle}>
            in the same rhythm right now
          </Text>
        </View>
      </View>

      {/* At-a-glance stats (always visible) */}
      <View style={styles.glanceRow}>
        <GlanceStat
          accent={dominantPhaseColors.primary}
          label="Most are"
          value={dominantPhaseColors.label.toLowerCase()}
        />
        {topFeeling ? (
          <GlanceStat
            emoji={topFeeling.emoji}
            label="Top feeling"
            value={topFeeling.label}
          />
        ) : null}
        {topCraving ? (
          <GlanceStat
            emoji={topCraving.emoji}
            label="Top craving"
            value={topCraving.label}
          />
        ) : null}
      </View>

      {/* Expanded details */}
      {expanded ? (
        <View style={styles.expanded}>
          {/* Top feelings list */}
          {snapshot.topFeelings.length > 0 ? (
            <View style={styles.expandSection}>
              <Text style={styles.expandLabel}>Top feelings</Text>
              <View style={styles.chipRow}>
                {snapshot.topFeelings.map((f) => (
                  <Chip key={`feel_${f.label}`} emoji={f.emoji} label={f.label} />
                ))}
              </View>
            </View>
          ) : null}

          {/* Top cravings list */}
          {snapshot.topCravings.length > 0 ? (
            <View style={styles.expandSection}>
              <Text style={styles.expandLabel}>Top cravings</Text>
              <View style={styles.chipRow}>
                {snapshot.topCravings.map((c) => (
                  <Chip key={`crave_${c.label}`} emoji={c.emoji} label={c.label} />
                ))}
              </View>
            </View>
          ) : null}

          {/* Top symptoms list */}
          {snapshot.topSymptoms.length > 0 ? (
            <View style={styles.expandSection}>
              <Text style={styles.expandLabel}>Showing up today</Text>
              <View style={styles.chipRow}>
                {snapshot.topSymptoms.map((s) => (
                  <Chip key={`sym_${s.label}`} emoji={s.emoji} label={s.label} />
                ))}
              </View>
            </View>
          ) : null}

          {/* Total scale hint */}
          <Text style={styles.totalHint}>
            Drawing from {totalDisplay} Dotties checking in this day
          </Text>
        </View>
      ) : null}

      {/* Warm one-liner — always shown, italicized */}
      <Text style={styles.warmMessage}>{snapshot.warmMessage}</Text>

      {/* Expand/collapse toggle */}
      <Pressable
        onPress={handleToggle}
        style={({ pressed }) => [
          styles.toggle,
          pressed && styles.togglePressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          expanded ? 'Hide weather details' : 'See more weather details'
        }
      >
        <Text style={[styles.toggleText, { color: phaseColors.primary }]}>
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
  /** Optional emoji marker. If absent, a colored dot is rendered. */
  emoji?: string;
  /** Optional accent color for the dot (used when no emoji). */
  accent?: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.glanceStat}>
      {emoji ? (
        <Text style={styles.glanceEmoji}>{emoji}</Text>
      ) : (
        <View
          style={[
            styles.glanceDot,
            { backgroundColor: accent ?? Colors.primary.coral },
          ]}
        />
      )}
      <Text style={styles.glanceLabel}>{label}</Text>
      <Text style={styles.glanceValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Chip({ emoji, label }: { emoji: string; label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipEmoji}>{emoji}</Text>
      <Text style={styles.chipText}>{label}</Text>
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

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    padding: Spacing.cardPaddingLarge,
    borderRadius: Spacing.radius['2xl'],
    marginBottom: Spacing.sectionGap,
    gap: Spacing.md,
    ...Shadows.sm,
  },

  // Header
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
    color: Colors.text.primary,
  },
  subtitle: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
    marginTop: 1,
  },
  previewBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Spacing.radius.full,
    backgroundColor: Colors.surface.cardElevated,
  },
  previewBadgeText: {
    ...Typography.preset.overline,
    color: Colors.text.tertiary,
    fontSize: 9,
    letterSpacing: 0.6,
  },

  // Rhythm hero card
  rhythmCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.card,
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
    color: Colors.text.primary,
  },
  rhythmSubtitle: {
    ...Typography.preset.caption,
    color: Colors.text.secondary,
    marginTop: 2,
  },

  // Glance stats
  glanceRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  glanceStat: {
    flex: 1,
    backgroundColor: Colors.surface.card,
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
    color: Colors.text.tertiary,
    fontSize: 11,
  },
  glanceValue: {
    ...Typography.preset.bodySemibold,
    color: Colors.text.primary,
    fontSize: 13,
    textTransform: 'capitalize',
    marginTop: 2,
  },

  // Expanded section
  expanded: {
    gap: Spacing.md,
    paddingTop: Spacing.sm,
  },
  expandSection: {
    gap: Spacing.xs,
  },
  expandLabel: {
    ...Typography.preset.overline,
    color: Colors.text.tertiary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.card,
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
    color: Colors.text.primary,
    textTransform: 'capitalize',
  },
  totalHint: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
    fontStyle: 'italic',
  },

  // Warm message
  warmMessage: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: Spacing.xs,
  },

  // Toggle
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
