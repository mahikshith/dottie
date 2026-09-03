/**
 * Dottie — PredictionDistributionChart
 *
 * The picture behind the prediction: the actual probability distribution of
 * WHEN the next period starts, drawn from the live posterior — not a decoration.
 *
 * ─── WHY THIS SHAPE (and why it leans right) ────────────────────────
 *
 *  The predictor models log(cycleLength) as Normal, i.e. cycle length itself is
 *  LOG-NORMAL. That distribution is RIGHT-SKEWED: cycles stretch long (a late
 *  or anovulatory cycle) far more easily than they run short, because they
 *  essentially never drop below ~21 days. So the curve here has a longer tail
 *  to the right, and that asymmetry is real information — "late" is more likely
 *  than "equally early". We reconstruct it from the two numbers the explainer
 *  already exposes:
 *
 *      median m = predictedCycleLength      SD s = stdDevDays   (day space)
 *      sigma = sqrt(ln(1 + (s/m)^2))        mu = ln(m)
 *      f(x)  = 1/(x·sigma·sqrt(2pi)) · exp(-(ln x - mu)^2 / (2·sigma^2))
 *
 *  The shaded band is the ± window the app actually shows the user, so they can
 *  SEE how much of the probability mass that window covers.
 *
 * ─── DATAVIZ RULES APPLIED ──────────────────────────────────────────
 *
 *  One series, so no legend box — the card's heading names it. Thin 2px curve,
 *  recessive baseline, selective direct labels (only the three dates that
 *  matter: window start, most-likely day, window end) rather than a number on
 *  every point. All text uses ink tokens; the accent is carried by the mark
 *  alone. Single x-axis (never dual). Non-interactive by design: on a small
 *  touch figure the direct labels do the job a hover tooltip would.
 */

import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Svg, { Path, Line, Circle } from 'react-native-svg';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { useAurora } from '../../theme';

export interface PredictionDistributionChartProps {
  /** Median cycle length in days (the point estimate). */
  predictedCycleLength: number;
  /** Day-space standard deviation of the predictive distribution. */
  stdDevDays: number;
  /** ± window (days) the app shows the user. */
  windowDays: number;
  /** ISO dates for the three labelled points. */
  pointDate: string;
  intervalStartDate: string;
  intervalEndDate: string;
}

const H = 132;          // plot height
const PAD_X = 10;
const PAD_TOP = 14;
const AXIS_Y = H - 30;  // baseline y (leaves room for date labels)

export function PredictionDistributionChart({
  predictedCycleLength,
  stdDevDays,
  windowDays,
  pointDate,
  intervalStartDate,
  intervalEndDate,
}: PredictionDistributionChartProps): JSX.Element {
  const { palette } = useAurora();
  const [w, setW] = useState(0);

  const geom = useMemo(() => {
    const m = Math.max(1, predictedCycleLength);
    const s = Math.max(0.5, stdDevDays);
    // Log-normal params matched to the day-space median + SD.
    const sigma = Math.sqrt(Math.log(1 + (s / m) * (s / m)));
    const mu = Math.log(m);

    // Domain: a little tighter on the left, longer on the right so the real
    // right skew is visible rather than cropped.
    const xMin = Math.max(1, m - 3.2 * s);
    const xMax = m + 4.2 * s;

    const N = 72;
    const xs: number[] = [];
    const ys: number[] = [];
    let peak = 0;
    for (let i = 0; i <= N; i++) {
      const x = xMin + ((xMax - xMin) * i) / N;
      const lx = Math.log(x);
      const d =
        (1 / (x * sigma * Math.sqrt(2 * Math.PI))) *
        Math.exp(-((lx - mu) * (lx - mu)) / (2 * sigma * sigma));
      xs.push(x);
      ys.push(d);
      if (d > peak) peak = d;
    }
    return { m, s, sigma, xMin, xMax, xs, ys, peak: peak || 1 };
  }, [predictedCycleLength, stdDevDays]);

  if (w <= 0) {
    // Measure pass — reserve the height so the card doesn't jump.
    return <View style={styles.host} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} />;
  }

  const plotW = w - PAD_X * 2;
  const toX = (x: number) => PAD_X + ((x - geom.xMin) / (geom.xMax - geom.xMin)) * plotW;
  const toY = (d: number) => AXIS_Y - (d / geom.peak) * (AXIS_Y - PAD_TOP);

  // Full density curve.
  let curve = '';
  geom.xs.forEach((x, i) => {
    const px = toX(x);
    const py = toY(geom.ys[i]!);
    curve += `${i === 0 ? 'M' : 'L'}${px.toFixed(2)},${py.toFixed(2)}`;
  });

  // Shaded band = the ± window actually shown to the user.
  const bandLo = geom.m - windowDays;
  const bandHi = geom.m + windowDays;
  let band = `M${toX(Math.max(bandLo, geom.xMin)).toFixed(2)},${AXIS_Y}`;
  geom.xs.forEach((x, i) => {
    if (x >= bandLo && x <= bandHi) {
      band += `L${toX(x).toFixed(2)},${toY(geom.ys[i]!).toFixed(2)}`;
    }
  });
  band += `L${toX(Math.min(bandHi, geom.xMax)).toFixed(2)},${AXIS_Y}Z`;

  const peakX = toX(geom.m);

  return (
    <View style={styles.host} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      <Svg width={w} height={H}>
        {/* window band — the range the app quotes */}
        <Path d={band} fill={palette.accent} fillOpacity={0.22} />
        {/* density curve (thin, 2px) */}
        <Path d={curve} stroke={palette.accent} strokeWidth={2} fill="none" strokeLinejoin="round" />
        {/* recessive baseline */}
        <Line x1={PAD_X} y1={AXIS_Y} x2={w - PAD_X} y2={AXIS_Y} stroke={palette.glass.edge} strokeWidth={1} />
        {/* most-likely day marker */}
        <Line x1={peakX} y1={toY(geom.peak)} x2={peakX} y2={AXIS_Y} stroke={palette.accent} strokeWidth={2} strokeDasharray="3,3" />
        <Circle cx={peakX} cy={toY(geom.peak)} r={4} fill={palette.accent} />
      </Svg>

      {/* Selective direct labels — only the three dates that matter. */}
      <View style={styles.labels}>
        <Text style={[styles.edgeLabel, { color: palette.ink3 }]}>{pretty(intervalStartDate)}</Text>
        <Text style={[styles.peakLabel, { color: palette.ink }]}>{pretty(pointDate)}</Text>
        <Text style={[styles.edgeLabel, { color: palette.ink3, textAlign: 'right' }]}>{pretty(intervalEndDate)}</Text>
      </View>
      <Text style={[styles.caption, { color: palette.ink3 }]}>
        Most likely day, with the shaded ±{windowDays}-day window Dottie quotes. The tail
        leans right because cycles run long more easily than short.
      </Text>
    </View>
  );
}

function pretty(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

const styles = StyleSheet.create({
  host: { width: '100%', minHeight: H },
  labels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: -6 },
  edgeLabel: { ...Typography.preset.caption, fontSize: 11, flex: 1 },
  peakLabel: { ...Typography.preset.captionBold, flex: 1, textAlign: 'center' },
  caption: { ...Typography.preset.caption, fontSize: 11, lineHeight: 16, marginTop: Spacing.xs },
});
