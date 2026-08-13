/**
 * ReportSection
 *
 * Primitive that wraps one block of the Doctor Report (Cycle Summary,
 * Symptoms, Wellbeing, etc.) with consistent warm styling.
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  Each section is a warm-shadowed card with:
 *    - A small emoji marker
 *    - A bold section title in the primary text color
 *    - An optional subtitle (e.g., "6 cycles tracked")
 *    - A flexible content slot
 *
 *  Stays purely presentational so the same component renders the
 *  cycle summary, symptom rows, wellbeing averages, and future
 *  sections without modification.
 */

import { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { Shadows } from '../../constants/shadows';

interface ReportSectionProps {
  emoji: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function ReportSection({ emoji, title, subtitle, children }: ReportSectionProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.emoji}>{emoji}</Text>
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface.card,
    borderRadius: Spacing.radius['2xl'],
    padding: Spacing.cardPaddingLarge,
    marginBottom: Spacing.itemGap,
    ...Shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  emoji: {
    fontSize: 24,
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
    marginTop: 2,
  },
  body: {
    gap: Spacing.sm,
  },
});
