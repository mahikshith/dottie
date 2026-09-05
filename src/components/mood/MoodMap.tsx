/**
 * Dottie — MoodMap
 *
 * The contribution-graph-style grid of how the last three months felt, with a
 * distribution bar underneath.
 *
 * ─── DESIGN NOTES ───────────────────────────────────────────────────
 *
 *  • The grid is SVG rects, not Views: ~100 cells as separate RN views is a lot
 *    of layout work for something purely decorative in structure. One Svg with
 *    100 <Rect>s is a single native view.
 *  • Colour comes from the validated diverging ramp in the engine — see
 *    mood-map.ts for why mood is diverging and not a green sequential ramp.
 *  • The legend is present because the grid uses more than one colour and
 *    identity must never be colour-alone; it carries the emoji, which is where
 *    they are legible (a 12px cell is not).
 *  • The distribution bar has a 2px gap between segments so adjacent fills read
 *    as separate quantities rather than one smear, and each visible segment is
 *    directly labelled — no legend box needed for it.
 *  • Non-interactive by design. There is no hover on a phone, and a tooltip on
 *    a 12px target would be a frustration; the summary line carries the
 *    reading instead.
 */

import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { useAurora } from '../../theme';
import {
  buildMoodDynamics,
  colorForScore,
  MOOD_SCALE,
  MOOD_EMPTY_COLOR,
  type MoodMap as MoodMapData,
} from '../../engine/mood/mood-map';

export interface MoodMapProps {
  map: MoodMapData;
  /** Available width, so the cell size can fill it exactly. */
  width: number;
}

const ROWS = 7;
const GAP = 3;
const RADIUS = 2.5;
/** 2px of surface between stacked segments — the dataviz spacer rule. */
const BAR_GAP = 2;
const BAR_H = 10;

export function MoodMap({ map, width }: MoodMapProps): JSX.Element {
  const { palette } = useAurora();
  const dynamics = buildMoodDynamics(map);

  const cols = map.weeks.length;
  const cell = Math.max(6, Math.min(16, (width - (cols - 1) * GAP) / cols));
  const gridH = ROWS * cell + (ROWS - 1) * GAP;
  const gridW = cols * cell + (cols - 1) * GAP;

  return (
    <View style={styles.wrap}>
      {/* No title here. The card header above this panel already says
          "Your mood map" and carries the streak — DT21 photographed the two
          of them stacked, which read as the section having rendered twice. */}

      {/* ─── THE GRID ─────────────────────────────────────────────── */}
      <Svg width={gridW} height={gridH}>
        {map.weeks.map((week, wi) =>
          week.map((day, di) => {
            // Days after today are drawn as nothing at all — an empty cell
            // would imply "you missed this", which you cannot miss yet.
            if (day.future) return null;
            return (
              <Rect
                key={day.date}
                x={wi * (cell + GAP)}
                y={di * (cell + GAP)}
                width={cell}
                height={cell}
                rx={RADIUS}
                fill={colorForScore(day.score)}
                opacity={day.score === null ? 0.9 : 1}
              />
            );
          })
        )}
      </Svg>

      {/* Legend — identity is never colour-alone, and this is where the emoji
          are big enough to read. */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: MOOD_EMPTY_COLOR }]} />
          <Text style={[styles.legendText, { color: palette.ink3 }]}>No check-in</Text>
        </View>
        {MOOD_SCALE.map((step) => (
          <View key={step.score} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: step.color }]} />
            <Text style={[styles.legendText, { color: palette.ink3 }]}>{step.emoji}</Text>
          </View>
        ))}
      </View>

      {/* ─── THE DISTRIBUTION ─────────────────────────────────────── */}
      {dynamics.shares.length > 0 ? (
        <View style={styles.dynamics}>
          <Text style={[styles.sectionLabel, { color: palette.ink3 }]}>
            HOW THE DAYS BROKE DOWN
          </Text>
          <View style={styles.bar}>
            {dynamics.shares.map((s, i) => (
              <View
                key={s.step.score}
                style={{
                  flex: s.share,
                  height: BAR_H,
                  backgroundColor: s.step.color,
                  borderRadius: RADIUS,
                  marginRight: i === dynamics.shares.length - 1 ? 0 : BAR_GAP,
                }}
                accessibilityLabel={`${s.step.label}: ${s.days} days`}
              />
            ))}
          </View>
          {/* Direct labels — no legend box for a single stacked bar. Segments
              under 8% are dropped rather than overlapping into mush. */}
          <View style={styles.barLabels}>
            {dynamics.shares
              .filter((s) => s.share >= 0.08)
              .map((s) => (
                <Text key={s.step.score} style={[styles.barLabel, { color: palette.ink2 }]}>
                  {s.step.emoji} {s.days}
                </Text>
              ))}
          </View>
        </View>
      ) : null}

      <Text style={[styles.summary, { color: palette.ink3 }]}>{dynamics.summary}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  legend: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatch: { width: 10, height: 10, borderRadius: 2.5 },
  legendText: { ...Typography.preset.caption, fontSize: 10 },
  dynamics: { gap: 5, marginTop: Spacing.xs },
  sectionLabel: { ...Typography.preset.caption, fontSize: 10, letterSpacing: 0.6 },
  bar: { flexDirection: 'row', alignItems: 'center' },
  barLabels: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
  barLabel: { ...Typography.preset.caption, fontSize: 11 },
  summary: { ...Typography.preset.caption, fontSize: 11, lineHeight: 16 },
});
