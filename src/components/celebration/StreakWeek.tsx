/**
 * Dottie — the streak week strip
 *
 * Seven day columns under the flame: a letter, a circle, a tick when the day
 * is banked, and a glowing capsule drawn behind the consecutive run.
 *
 * ─── WHY THE CAPSULE MATTERS (device-test-27) ───────────────────────
 *
 *  Ticks alone say "you did these days". The capsule says "these belong to
 *  each other" — it turns four marks into ONE object you would not want to
 *  break, which is the entire psychology Duolingo runs on. It is also why the
 *  capsule is drawn behind the run only, never around the whole week: a ring
 *  around empty days would be a promise the user has not earned yet.
 *
 *  Empty days are drawn, not hidden. The gap ahead is the invitation.
 */

import { View, Text, StyleSheet } from 'react-native';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { useAurora } from '../../theme';
import type { StreakWeek as StreakWeekData } from '../../engine/gamification/streak-week';

const FIRE = '#FF9A3C';
const FIRE_DEEP = '#FF6B4A';

export interface StreakWeekProps {
  week: StreakWeekData;
  /** Overrides the fire colour — the celebration passes the companion accent. */
  accentColor?: string;
}

export function StreakWeekStrip({ week, accentColor }: StreakWeekProps): JSX.Element {
  const { palette } = useAurora();
  const hot = accentColor ?? FIRE;
  const { days, runStart, runEnd } = week;
  const n = days.length;

  return (
    <View style={styles.wrap} accessibilityRole="summary"
      accessibilityLabel={
        week.runLength > 0
          ? `${week.runLength} day${week.runLength === 1 ? '' : 's'} in a row`
          : 'No days logged yet this week'
      }
    >
      {/* Column heads. */}
      <View style={styles.row}>
        {days.map((d, i) => (
          <View key={`h_${d.date}`} style={styles.col}>
            <Text
              style={[
                styles.head,
                { color: d.isToday ? hot : palette.ink3, fontWeight: d.isToday ? '800' : '600' },
              ]}
            >
              {d.label}
            </Text>
          </View>
        ))}
      </View>

      {/* The capsule sits UNDER the circles, spanning only the run. */}
      <View style={styles.trackRow}>
        {runStart !== null && runEnd !== null && (
          <View
            pointerEvents="none"
            style={[
              styles.capsule,
              {
                left: `${(runStart / n) * 100}%`,
                width: `${((runEnd - runStart + 1) / n) * 100}%`,
                backgroundColor: `${hot}2E`,
                borderColor: hot,
              },
            ]}
          />
        )}
        <View style={styles.row}>
          {days.map((d) => (
            <View key={d.date} style={styles.col}>
              <View
                style={[
                  styles.dot,
                  d.done
                    ? { backgroundColor: hot, borderColor: FIRE_DEEP }
                    : { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
                  d.isToday && !d.done && { borderColor: hot, borderStyle: 'dashed' },
                ]}
              >
                {d.done ? <Text style={styles.tick}>✓</Text> : null}
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center' },
  col: { flex: 1, alignItems: 'center' },
  head: { ...Typography.preset.caption, fontSize: 12, letterSpacing: 0.4 },
  trackRow: { justifyContent: 'center' },
  // Inset a little so the capsule hugs the circles rather than the columns.
  capsule: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    borderRadius: Spacing.radius.full,
    borderWidth: 2,
  },
  dot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tick: { fontSize: 15, fontWeight: '900', color: '#2A1206' },
});
