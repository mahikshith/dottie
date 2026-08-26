/**
 * Dottie — GlassCard (design-v2)
 *
 * A floating glass panel that reads its tint from the active mood palette.
 *
 * ─── REAL FROST NEEDS ONE DEP (not added yet) ───────────────────────
 *
 *  True frosted glass = a blur of whatever is behind the panel, which RN
 *  can't do without `expo-blur` (a native module — must be added on a Node
 *  machine with `npx expo install expo-blur`, then a dev build). Until then
 *  this renders a translucent TINTED panel: over the aurora it still reads
 *  as a light material catching colour, just without the blur.
 *
 *  To upgrade once expo-blur is installed, drop a
 *  `<BlurView tint="dark" intensity={24} style={StyleSheet.absoluteFill}/>`
 *  as the first child inside `inner` (see the commented block below). Do NOT
 *  animate its `intensity` (re-renders the blur every frame on Android —
 *  crossfade a static BlurView instead; per animate-expo).
 *
 * ─── SHADOW/RADIUS ──────────────────────────────────────────────────
 *
 *  iOS can't both clip (overflow:hidden) AND cast a shadow on one view, so
 *  the panel keeps its shadow and does NOT clip. That's fine here — nothing
 *  inside needs clipping to the corner. (When the BlurView is added it must
 *  be clipped, so wrap it in an inner overflow:hidden view then.)
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device).
 */

import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAurora } from '../../../theme/ThemeProvider';

export interface GlassCardProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Corner radius. Default 24. */
  radius?: number;
  /** Inner padding. Default 18. */
  padding?: number;
}

export function GlassCard({
  children,
  style,
  radius = 24,
  padding = 18,
}: GlassCardProps): JSX.Element {
  const { palette } = useAurora();

  return (
    <View
      style={[
        styles.card,
        {
          borderRadius: radius,
          padding,
          backgroundColor: palette.glass.bg,
          borderColor: palette.glass.edge,
        },
        style,
      ]}
    >
      {/*
        Upgrade to real frost once expo-blur is installed:
        <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
          <BlurView tint="dark" intensity={24} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: palette.glass.bg }]} />
        </View>
      */}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    // Warm-neutral premium lift; the dark grounds make a soft dark shadow read best.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 10,
  },
});
