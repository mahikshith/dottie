import { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
  type LayoutChangeEvent,
  type GestureResponderEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { useAurora } from '../../theme';

/**
 * AuroraSlider — a compact, drag-or-tap scale for the daily check-in.
 *
 * Replaces the old 1–5 row of big number cells (`ScalePicker`). Owner feedback:
 * the number grid ate space and took a tap per value; a single slim track you can
 * drag reads at a glance and is one gesture. It still resolves to the SAME 1..5
 * integer the store/engine expect — the track just SNAPS to `steps` detents, so
 * nothing downstream changes.
 *
 * ─── WHY PanResponder (not Gesture Handler) ─────────────────────────
 *  There's no GestureHandlerRootView wired at the app root, so a `GestureDetector`
 *  wouldn't fire. PanResponder is core RN, needs no provider, and for a 5-detent
 *  snap the value only changes a handful of times — cheap on the JS thread.
 *
 * When `value` is null (optional field, untouched) the track shows empty with a
 * faint centred thumb — honest "not set yet", no faked midpoint.
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device) — feel-check the drag + snap on hardware.
 */

const THUMB = 26;
const TRACK_H = 10;

export function AuroraSlider({
  value,
  onChange,
  lowLabel,
  highLabel,
  accentColor,
  steps = 5,
}: {
  value: number | null;
  onChange: (v: number) => void;
  lowLabel: string;
  highLabel: string;
  /** Phase/mood hue for the fill + thumb. */
  accentColor?: string;
  /** Number of detents (default 5 → values 1..5). */
  steps?: number;
}) {
  const { palette } = useAurora();
  const active = accentColor ?? palette.accent;
  const [width, setWidth] = useState(0);

  // Keep the latest committed value in a ref so the PanResponder (created once)
  // reads fresh state without being re-created on every value change.
  const valueRef = useRef(value);
  valueRef.current = value;
  const widthRef = useRef(0);

  const usable = Math.max(0, width - THUMB); // travel range for the thumb centre

  const commitFromX = (x: number) => {
    const w = widthRef.current;
    if (w <= 0) return;
    const frac = Math.min(1, Math.max(0, (x - THUMB / 2) / Math.max(1, w - THUMB)));
    const next = Math.round(frac * (steps - 1)) + 1;
    if (next !== valueRef.current) {
      Haptics.selectionAsync().catch(() => {});
      onChange(next);
    }
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e: GestureResponderEvent) => commitFromX(e.nativeEvent.locationX),
        onPanResponderMove: (e: GestureResponderEvent) => commitFromX(e.nativeEvent.locationX),
      }),
    // commitFromX closes over stable refs + onChange; recreate only if onChange/steps change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange, steps]
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    widthRef.current = w;
    setWidth(w);
  };

  const isSet = value != null;
  const frac = isSet ? (value - 1) / (steps - 1) : 0.5;
  const thumbLeft = frac * usable;
  const fillW = isSet ? thumbLeft + THUMB / 2 : 0;

  return (
    <View style={styles.wrap}>
      <View
        style={styles.hitArea}
        onLayout={onLayout}
        {...responder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel={`${lowLabel} to ${highLabel}`}
        accessibilityValue={{ min: 1, max: steps, now: value ?? undefined }}
      >
        {/* base track */}
        <View style={[styles.track, { backgroundColor: palette.glass.edge }]}>
          {/* filled portion */}
          {isSet && <View style={[styles.fill, { width: fillW, backgroundColor: active }]} />}
        </View>
        {/* detent ticks */}
        <View style={styles.ticks} pointerEvents="none">
          {Array.from({ length: steps }).map((_, i) => (
            <View key={i} style={[styles.tick, { backgroundColor: palette.glass.edge }]} />
          ))}
        </View>
        {/* thumb */}
        {width > 0 && (
          <View
            pointerEvents="none"
            style={[
              styles.thumb,
              {
                left: thumbLeft,
                backgroundColor: isSet ? active : palette.glass.bg,
                borderColor: isSet ? active : palette.glass.edge,
                opacity: isSet ? 1 : 0.55,
              },
            ]}
          >
            {isSet && <Text style={[styles.thumbText, { color: palette.ground }]}>{value}</Text>}
          </View>
        )}
      </View>
      <View style={styles.labelRow}>
        <Text style={[styles.endLabel, { color: palette.ink3 }]}>{lowLabel}</Text>
        {!isSet && <Text style={[styles.hint, { color: palette.ink3 }]}>Slide to set</Text>}
        <Text style={[styles.endLabel, { color: palette.ink3 }]}>{highLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  hitArea: {
    height: THUMB + 8,
    justifyContent: 'center',
  },
  track: {
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: TRACK_H / 2,
  },
  ticks: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: THUMB / 2 - 1.5,
  },
  tick: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  thumbText: {
    ...Typography.preset.captionBold,
    fontSize: 12,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
  },
  endLabel: {
    ...Typography.preset.caption,
  },
  hint: {
    ...Typography.preset.caption,
    fontStyle: 'italic',
  },
});
