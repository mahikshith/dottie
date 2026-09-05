/**
 * Dottie — WeekAheadStrip (Calendar Planner · design-v2)
 *
 * A forward look at the next 7 days so nothing sneaks up on you: each day shows
 * its phase, a one-line suggestion, and any planning dot — and tapping one opens
 * the same day-detail popover the month grid uses. Purely presentational; the
 * calendar computes the model and owns the tap.
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device).
 */

import { View, Text, StyleSheet, ScrollView, type GestureResponderEvent } from 'react-native';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { PressableScale } from '../ui';
import { useAurora, PHASE_AURORA } from '../../theme';
import type { Phase } from '../../types/cycle.types';

export interface WeekAheadItem {
  iso: string;
  /** Short weekday label, e.g. "WED". */
  dayLabel: string;
  dayNum: number;
  phase: Phase;
  /** One-line hint, e.g. "Restock supplies" / "Winding down". */
  mini: string;
  /** In the predicted period window. */
  isWindow: boolean;
  /** Already logged as a period day. */
  isPeriodDay: boolean;
  /** Has a saved plan/note. */
  planned: boolean;
  isToday: boolean;
}

export interface WeekAheadStripProps {
  items: WeekAheadItem[];
  onDayPress: (iso: string, e: GestureResponderEvent) => void;
}

const PLAN_DOT = '#FF7A8A';

export function WeekAheadStrip({ items, onDayPress }: WeekAheadStripProps): JSX.Element {
  const { palette } = useAurora();

  return (
    <View>
      <Text style={[styles.heading, { color: palette.ink }]}>The week ahead</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {items.map((it) => {
          const hue = it.isPeriodDay ? PHASE_AURORA.menstrual : PHASE_AURORA[it.phase];
          return (
            <PressableScale
              key={it.iso}
              onPress={(e) => onDayPress(it.iso, e)}
              haptic="selection"
              scaleTo={0.95}
              style={[
                styles.card,
                { backgroundColor: palette.glass.bg, borderColor: it.isToday ? palette.accent : palette.glass.edge },
                it.isWindow && { borderColor: PHASE_AURORA.menstrual, borderStyle: 'dashed' },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${it.dayLabel} ${it.dayNum}: ${it.mini}`}
            >
              {it.planned && <View style={[styles.dot, { backgroundColor: PLAN_DOT }]} />}
              <Text style={[styles.day, { color: palette.ink3 }]}>{it.dayLabel}</Text>
              <Text style={[styles.num, { color: palette.ink }]}>{it.dayNum}</Text>
              <View style={[styles.phasePill, { backgroundColor: `${hue}26` }]}>
                <Text style={[styles.phaseText, { color: hue }]} numberOfLines={1}>
                  {it.isWindow ? 'Window' : it.isPeriodDay ? 'Period' : phaseShort(it.phase)}
                </Text>
              </View>
              <Text style={[styles.mini, { color: palette.ink2 }]} numberOfLines={2}>
                {it.mini}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

function phaseShort(p: Phase): string {
  switch (p) {
    case 'menstrual': return 'Menstrual';
    case 'follicular': return 'Follicular';
    case 'ovulatory': return 'Ovulatory';
    case 'luteal': return 'Luteal';
  }
}

const styles = StyleSheet.create({
  heading: { ...Typography.preset.h4, marginBottom: Spacing.sm },
  // A floating action button sits over the right-hand end of this strip, so
  // the last card could never be scrolled clear of it — it was permanently
  // half-covered (device-test-19). The trailing pad is FAB-sized so the strip
  // can always be scrolled to a position where every day is readable.
  row: { gap: Spacing.sm, paddingRight: Spacing['4xl'], paddingBottom: 2 },
  card: {
    width: 96,
    borderWidth: 1.5,
    borderRadius: Spacing.radius.lg,
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 4,
    position: 'relative',
  },
  dot: { position: 'absolute', top: 7, right: 7, width: 6, height: 6, borderRadius: 3 },
  day: { ...Typography.preset.caption, fontWeight: '800', fontSize: 10, letterSpacing: 0.5 },
  num: { ...Typography.preset.h4, fontSize: 20 },
  phasePill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Spacing.radius.full, marginTop: 2 },
  phaseText: { fontSize: 10, fontWeight: '800' },
  mini: { ...Typography.preset.caption, fontSize: 11, textAlign: 'center', lineHeight: 15, minHeight: 30 },
});
