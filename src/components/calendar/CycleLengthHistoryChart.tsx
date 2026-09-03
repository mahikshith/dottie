/**
 * Dottie — CycleLengthHistoryChart
 *
 * "Am I regular?" — the user's own logged cycle lengths as dots on a time axis,
 * with their mean as a line and ±1 SD as a band around it.
 *
 * ─── WHY THIS ONE MATTERS MOST ──────────────────────────────────────
 *
 *  The density curve says WHEN. This one says WHY the window is that wide: the
 *  band IS the standard deviation the card quotes, drawn around the user's own
 *  data, so "±2 days" stops being a number and becomes a picture. Every major
 *  tracker ships a version of this because it's the figure people actually read.
 *
 * ─── DATAVIZ RULES APPLIED ──────────────────────────────────────────
 *
 *  One series (dots) + one reference line + one band — no legend box, the
 *  caption names them. Direct labels only on the first, last and most extreme
 *  dot rather than every point. Recessive gridless baseline. Y axis starts at
 *  the data range, NOT at zero: a 21-vs-35-day difference is the whole story
 *  and zero-basing would flatten it to nothing (this is a range comparison, not
 *  a magnitude one, so a non-zero baseline is correct here).
 *
 * ─── NON-DIAGNOSTIC ─────────────────────────────────────────────────
 *
 *  Copy comes from `buildCycleLengthSeries`, which describes spread and never
 *  calls it irregular or abnormal.
 */

import { useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { useAurora } from '../../theme';
import type { CycleLengthSeries } from '../../engine/prediction/chart-data';

export interface CycleLengthHistoryChartProps {
  series: CycleLengthSeries;
}

const H = 126;
const PAD_X = 14;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;

export function CycleLengthHistoryChart({
  series,
}: CycleLengthHistoryChartProps): JSX.Element {
  const { palette } = useAurora();
  const [w, setW] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  if (w <= 0) return <View style={styles.host} onLayout={onLayout} />;

  const { points, mean, sd, minLength, maxLength } = series;
  const plotW = w - PAD_X * 2;
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const span = Math.max(1, maxLength - minLength);

  const toY = (len: number) => PAD_TOP + (1 - (len - minLength) / span) * plotH;
  const toX = (i: number) =>
    points.length <= 1
      ? PAD_X + plotW / 2
      : PAD_X + ((i - 1) / (points.length - 1)) * plotW;

  // Connecting path — thin, so the dots stay the mark and the line is just the
  // reading order.
  let path = '';
  points.forEach((p, i) => {
    path += `${i === 0 ? 'M' : 'L'}${toX(p.index).toFixed(2)},${toY(p.length).toFixed(2)}`;
  });

  const bandTop = toY(mean + sd);
  const bandH = Math.max(1, toY(mean - sd) - bandTop);

  // Selective labels: first, last, and the single most extreme dot.
  const extremeIdx =
    points.length > 0
      ? points.reduce(
          (best, p, i) =>
            Math.abs(p.length - mean) > Math.abs(points[best]!.length - mean) ? i : best,
          0
        )
      : -1;
  const labelled = new Set<number>([0, points.length - 1, extremeIdx]);

  return (
    <View style={styles.host} onLayout={onLayout}>
      <Svg width={w} height={H}>
        {points.length > 1 && (
          <>
            {/* ±1 SD band — the standard deviation, made visible */}
            <Rect
              x={PAD_X}
              y={bandTop}
              width={plotW}
              height={bandH}
              fill={palette.accent}
              fillOpacity={0.14}
              rx={4}
            />
            {/* mean reference line */}
            <Line
              x1={PAD_X}
              y1={toY(mean)}
              x2={w - PAD_X}
              y2={toY(mean)}
              stroke={palette.accent}
              strokeWidth={1}
              strokeDasharray="4,4"
              opacity={0.75}
            />
          </>
        )}

        {points.length > 1 && (
          <Path d={path} stroke={palette.ink3} strokeWidth={1.5} fill="none" strokeLinejoin="round" />
        )}

        {points.map((p, i) => (
          <Circle
            key={p.startDate + p.index}
            cx={toX(p.index)}
            cy={toY(p.length)}
            r={i === points.length - 1 ? 5 : 3.5}
            fill={i === points.length - 1 ? palette.accent : palette.ink2}
          />
        ))}
      </Svg>

      {/* Direct labels under the axis, only where they carry information. */}
      <View style={styles.labelRow}>
        {points.map((p, i) => (
          <View key={`l-${p.startDate}-${p.index}`} style={styles.labelSlot}>
            {labelled.has(i) ? (
              <Text style={[styles.dotLabel, { color: palette.ink3 }]}>{p.length}d</Text>
            ) : null}
          </View>
        ))}
      </View>

      <Text style={[styles.caption, { color: palette.ink3 }]}>{series.caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { width: '100%', minHeight: H },
  labelRow: { flexDirection: 'row', marginTop: -14, paddingHorizontal: PAD_X - 6 },
  labelSlot: { flex: 1, alignItems: 'center' },
  dotLabel: { ...Typography.preset.caption, fontSize: 10 },
  caption: { ...Typography.preset.caption, fontSize: 11, lineHeight: 16, marginTop: Spacing.sm },
});
