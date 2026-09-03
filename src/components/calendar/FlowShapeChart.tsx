/**
 * Dottie — FlowShapeChart
 *
 * "Which days will be the hard ones?" — predicted heaviness across the days of
 * the NEXT period, as a small bar figure. This is the owner's explicit ask:
 * don't just say when it starts, say which days are likely to be heaviest.
 *
 * ─── DATAVIZ RULES APPLIED ──────────────────────────────────────────
 *
 *  Bars (a per-day quantity, so a zero baseline IS correct here — unlike the
 *  cycle-length figure). One series, no legend: the heavier days carry the
 *  accent, the rest recede, and each bar is directly labelled with its day
 *  number and word. No axis furniture beyond the baseline.
 *
 * ─── NON-DIAGNOSTIC ─────────────────────────────────────────────────
 *
 *  The shape is "what most people report", scaled by the user's own logged
 *  flow when it exists. `buildFlowShape` says which of the two it is and the
 *  caption repeats it, so this never reads as a measurement of this body.
 */

import { useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Svg, { Rect, Line } from 'react-native-svg';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { useAurora } from '../../theme';
import { PHASE_AURORA } from '../../theme';
import type { FlowShapeSeries } from '../../engine/prediction/chart-data';

export interface FlowShapeChartProps {
  series: FlowShapeSeries;
}

const H = 104;
const PAD_X = 8;
const PAD_TOP = 10;
const AXIS_Y = H - 18;

export function FlowShapeChart({ series }: FlowShapeChartProps): JSX.Element {
  const { palette } = useAurora();
  const [w, setW] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  if (w <= 0) return <View style={styles.host} onLayout={onLayout} />;

  const n = Math.max(1, series.points.length);
  const slot = (w - PAD_X * 2) / n;
  const barW = Math.max(10, slot * 0.56);
  const hue = PHASE_AURORA.menstrual;

  return (
    <View style={styles.host} onLayout={onLayout}>
      <Svg width={w} height={H}>
        {series.points.map((p, i) => {
          const h = Math.max(3, (AXIS_Y - PAD_TOP) * p.level);
          const x = PAD_X + slot * i + (slot - barW) / 2;
          return (
            <Rect
              key={p.day}
              x={x}
              y={AXIS_Y - h}
              width={barW}
              height={h}
              rx={4}
              fill={hue}
              fillOpacity={p.heavy ? 0.92 : 0.4}
            />
          );
        })}
        <Line
          x1={PAD_X}
          y1={AXIS_Y}
          x2={w - PAD_X}
          y2={AXIS_Y}
          stroke={palette.glass.edge}
          strokeWidth={1}
        />
      </Svg>

      {/* Direct labels — day number on every bar (there are at most 8). */}
      <View style={styles.labelRow}>
        {series.points.map((p) => (
          <View key={`fl-${p.day}`} style={styles.labelSlot}>
            <Text
              style={[
                styles.dayLabel,
                { color: p.heavy ? palette.ink : palette.ink3 },
              ]}
            >
              {p.day}
            </Text>
            <Text style={[styles.wordLabel, { color: palette.ink3 }]}>{p.label}</Text>
          </View>
        ))}
      </View>

      <Text style={[styles.caption, { color: palette.ink3 }]}>{series.caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { width: '100%', minHeight: H },
  labelRow: { flexDirection: 'row', marginTop: -14, paddingHorizontal: PAD_X },
  labelSlot: { flex: 1, alignItems: 'center' },
  dayLabel: { ...Typography.preset.captionBold, fontSize: 11 },
  wordLabel: { ...Typography.preset.caption, fontSize: 9 },
  caption: { ...Typography.preset.caption, fontSize: 11, lineHeight: 16, marginTop: Spacing.sm },
});
