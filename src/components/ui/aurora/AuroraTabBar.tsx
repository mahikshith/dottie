/**
 * Dottie — AuroraTabBar (design-v2, liquid-glass redesign)
 *
 * Rebuild driven by the owner's reference images (Figma glass buttons,
 * Apple Music floating bar, a real device screenshot with a Home/Folders
 * /Clean/Settings pill). Design targets:
 *
 *   1. REAL frost.  A BlurView underlay so the aurora blooms behind the
 *      bar bleed through as diffused light instead of just tinting a
 *      flat colour. On Android where BlurView is unsupported / expensive,
 *      the tinted background still reads as glass — the BlurView falls
 *      back to a translucent solid, and the border + shadow do the rest.
 *   2. LUMINOUS edge.  A double edge — an outer bright border on the
 *      pill and an inner highlight stroke on the moving pill — so the
 *      glass looks lit from within (the Apple-style "liquid" quality).
 *   3. BOLD active pill.  Not a subtle tint. The reference screenshot has
 *      a clear light-coloured pill behind the active tab; we match with
 *      an opaque-ish mint-glass fill + brighter border. The pill moves
 *      via Reanimated springs between measured tab positions.
 *   4. FLOAT.  Bigger warm shadow so the whole bar reads as elevated,
 *      not painted on the ground.
 *
 * ─── MOTION (animate-expo · tab-indicator recipe) — LIQUID FLOW ──────
 *
 *   This is STATE INDICATION (which tab is active), not a screen slide —
 *   the tab SCREENS never slide (animation:'none' in the navigator). Only
 *   the indicator moves, and it's an absolutely-positioned childless
 *   element, so animating width is the one sanctioned width animation.
 *
 *   The "liquid is flowing" effect the owner asked for is a TWO-LAYER trick:
 *     • the crisp mint pill (front) springs fast + tight to the new tab;
 *     • a soft luminous glow (behind) springs SLOWER and looser, so it
 *       LAGS — and its width is drawn to BRIDGE the gap between where it
 *       is and where the pill is going. So during travel the glow visibly
 *       stretches across the icons like a droplet, then contracts on
 *       arrival. Tapping a far tab smears the light the whole way across.
 *   Each tab's icon+label also springs a small "pop" (1→1.08) as it
 *   becomes active, and dips (0.92) on press-in for tactile feedback.
 *
 *   All of it runs on the UI thread (shared values + useAnimatedStyle);
 *   the screen never re-renders per frame. Reduce Motion snaps everything
 *   (no stretch, no pop). Selection haptic fires on press-in (feedback),
 *   navigation commits on press-out. Never animates BlurView intensity.
 *
 *   On the first render the pill snaps to the initially-focused tab's
 *   measured position, so no "starts at 0 and slides to tab 3" flash.
 *
 * ─── SAFE-AREA ──────────────────────────────────────────────────────
 *
 *   Wrapper padding = `insets.bottom + 8` so the pill floats above the
 *   phone's gesture area. `Spacing.tabBarHeight` already accounts for
 *   the taller bar in every screen's ScrollView contentContainer.
 *
 *  ⚠️ design-v2 / UNVERIFIED on device.
 */

import { useEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useAurora } from '../../../theme/ThemeProvider';

// ─── Minimal react-navigation tab-bar props (only what we use) ───────
interface TabRoute {
  key: string;
  name: string;
}
export interface AuroraTabBarProps {
  state: { index: number; routes: TabRoute[] };
  navigation: {
    navigate: (name: string) => void;
    emit: (event: { type: 'tabPress'; target: string; canPreventDefault: true }) => {
      defaultPrevented: boolean;
    };
  };
}

// route name → { label, icon }
const TAB_META: Record<string, { label: string; icon: IconName }> = {
  home: { label: 'Today', icon: 'today' },
  calendar: { label: 'Cycle', icon: 'cycle' },
  learn: { label: 'Learn', icon: 'learn' },
  community: { label: 'Circle', icon: 'circle' },
  profile: { label: 'You', icon: 'you' },
};

type IconName = 'today' | 'cycle' | 'learn' | 'circle' | 'you';

function TabIcon({ name, color }: { name: IconName; color: string }): JSX.Element {
  const p = {
    stroke: color,
    strokeWidth: 2,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      {name === 'today' && (
        <>
          <Circle cx={12} cy={12} r={4} {...p} />
          <Path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19" {...p} />
        </>
      )}
      {name === 'cycle' && (
        <>
          <Rect x={3.5} y={5} width={17} height={15} rx={3.5} {...p} />
          <Path d="M3.5 9.5h17M8 3v3M16 3v3" {...p} />
        </>
      )}
      {name === 'learn' && (
        <Path d="M4 5.5A2 2 0 0 1 6 4h5v15H6a2 2 0 0 0-2 1.5zM20 5.5A2 2 0 0 0 18 4h-5v15h5a2 2 0 0 1 2 1.5z" {...p} />
      )}
      {name === 'circle' && (
        <>
          <Circle cx={9} cy={9} r={3.2} {...p} />
          <Circle cx={16.5} cy={10.5} r={2.6} {...p} />
          <Path d="M3.5 19a5.5 5.5 0 0 1 11 0M14.5 18.5a4.5 4.5 0 0 1 6 .5" {...p} />
        </>
      )}
      {name === 'you' && (
        <>
          <Circle cx={12} cy={8.5} r={3.6} {...p} />
          <Path d="M5 20a7 7 0 0 1 14 0" {...p} />
        </>
      )}
    </Svg>
  );
}

// ─── COMPONENT ───────────────────────────────────────────────────────

export function AuroraTabBar({ state, navigation }: AuroraTabBarProps): JSX.Element {
  const { palette } = useAurora();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();

  const positionsRef = useRef<Record<string, { x: number; w: number }>>({});
  const [layoutReady, setLayoutReady] = useState(0);

  // Crisp pill (front): position + width. Springs fast + tight.
  const pillX = useSharedValue(0);
  const pillW = useSharedValue(0);
  // Glow (behind): a SEPARATE x that springs slower/looser so it LAGS behind
  // the pill. The gap between glowX and pillX is what the glow stretches to
  // bridge → the liquid "flow" across the icons.
  const glowX = useSharedValue(0);

  // ─── FINGER-FOLLOW SCRUB (owner ask: "liquid flow following the finger") ──
  //  A PanResponder layered over the tap buttons lets the user DRAG a finger
  //  across the bar and have the liquid pill flow under it in real time, then
  //  spring + commit to whichever tab they release on. We use core-RN
  //  PanResponder (not Gesture Handler) because there's no GestureHandlerRootView
  //  at the app root — same reason AuroraSlider does. Taps still go straight to
  //  the child <Pressable>s (the responder only captures once the finger has
  //  moved >8px horizontally), so navigation + a11y can never break: the scrub
  //  is purely additive. Live refs keep the once-created responder from reading
  //  stale state.
  const barRef = useRef<View>(null);
  const barLeftRef = useRef(0); // bar's window-left, for absolute→local finger x
  const hoveredRef = useRef(state.index);
  const stateRef = useRef(state);
  stateRef.current = state;
  const navRef = useRef(navigation);
  navRef.current = navigation;
  const reduceRef = useRef(reduce);
  reduceRef.current = reduce;

  const measureBar = () => {
    barRef.current?.measureInWindow((x) => {
      if (typeof x === 'number' && !Number.isNaN(x)) barLeftRef.current = x;
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      // Let simple taps reach the child buttons; only capture a real drag.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: measureBar,
      onPanResponderMove: (_e, g) => {
        const bounds = stateRef.current.routes.map((r) => positionsRef.current[r.key]);
        const first = bounds[0];
        const last = bounds[bounds.length - 1];
        if (!first || !last) return;
        const fingerX = g.moveX - barLeftRef.current; // → bar-local coords
        // Nearest tab center = the tab the finger is over.
        let idx = 0;
        let bestD = Infinity;
        bounds.forEach((b, i) => {
          if (!b) return;
          const d = Math.abs(b.x + b.w / 2 - fingerX);
          if (d < bestD) {
            bestD = d;
            idx = i;
          }
        });
        const b = bounds[idx];
        if (!b) return;
        hoveredRef.current = idx;
        // Pill follows the finger 1:1 (centred on it), clamped inside the bar.
        const w = b.w;
        const left = Math.max(first.x, Math.min(fingerX - w / 2, last.x + last.w - w));
        glowX.value = pillX.value; // one-frame trail → the glow bridges/smears
        pillX.value = left;
        pillW.value = w;
      },
      onPanResponderRelease: commitScrub,
      onPanResponderTerminate: commitScrub,
    })
  ).current;

  // Snap the pill to the released-on tab and commit navigation. Declared as a
  // hoisted function so the once-created PanResponder above can reference it.
  function commitScrub() {
    const bounds = stateRef.current.routes.map((r) => positionsRef.current[r.key]);
    const idx = hoveredRef.current;
    const b = bounds[idx];
    if (!b) return;
    if (reduceRef.current) {
      pillX.value = b.x;
      pillW.value = b.w;
      glowX.value = b.x;
    } else {
      pillX.value = withSpring(b.x, { dampingRatio: 0.82, duration: 300 });
      pillW.value = withSpring(b.w, { dampingRatio: 0.9, duration: 300 });
      glowX.value = withSpring(b.x, { dampingRatio: 0.6, duration: 520 });
    }
    const routes = stateRef.current.routes;
    const target = routes[idx];
    if (target && idx !== stateRef.current.index) {
      const event = navRef.current.emit({
        type: 'tabPress',
        target: target.key,
        canPreventDefault: true,
      });
      if (!event.defaultPrevented) {
        Haptics.selectionAsync().catch(() => {});
        navRef.current.navigate(target.name);
      }
    }
  }

  useEffect(() => {
    hoveredRef.current = state.index;
    const route = state.routes[state.index];
    if (!route) return;
    const pos = positionsRef.current[route.key];
    if (!pos) return;
    if (reduce) {
      pillX.value = pos.x;
      pillW.value = pos.w;
      glowX.value = pos.x;
    } else {
      // Front pill: quick + tight (lands first).
      pillX.value = withSpring(pos.x, { dampingRatio: 0.82, duration: 300 });
      pillW.value = withSpring(pos.w, { dampingRatio: 0.9, duration: 300 });
      // Glow: slower + looser (a little overshoot) so it trails and catches up.
      glowX.value = withSpring(pos.x, { dampingRatio: 0.6, duration: 520 });
    }
  }, [state.index, state.routes, layoutReady, reduce, pillX, pillW, glowX]);

  // Crisp pill — just moves + keeps its width.
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: pillW.value,
  }));

  // Glow — spans from wherever it is to wherever the pill is, so it stretches
  // to bridge the two positions during travel and contracts on arrival.
  const glowStyle = useAnimatedStyle(() => {
    const left = Math.min(pillX.value, glowX.value);
    const span = Math.abs(pillX.value - glowX.value);
    return {
      transform: [{ translateX: left - 3 }],
      width: pillW.value + span + 6,
    };
  });

  const handleTabLayout = (routeKey: string, isFocused: boolean) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    positionsRef.current[routeKey] = { x, w: width };
    if (isFocused && pillW.value === 0) {
      pillX.value = x;
      pillW.value = width;
      glowX.value = x;
      setLayoutReady((n) => n + 1);
    }
  };

  return (
    <View
      style={[styles.wrapper, { paddingBottom: insets.bottom + 8 }]}
      pointerEvents="box-none"
    >
      <View
        ref={barRef}
        onLayout={measureBar}
        {...panResponder.panHandlers}
        style={[
          styles.bar,
          {
            borderColor: 'rgba(255,255,255,0.22)',
            shadowColor: palette.accent,
          },
        ]}
      >
        {/* REAL FROST — BlurView underlay. iOS renders true backdrop
            blur; Android falls back to a translucent tint (still reads
            as glass because of the border + shadow + luminous pill). */}
        <BlurView
          intensity={40}
          tint="dark"
          style={StyleSheet.absoluteFillObject}
        />
        {/* Warm tint layer over the blur so the aurora ground shows
            through as diffused colour instead of grey. */}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: 'rgba(20,14,44,0.42)', borderRadius: RADIUS },
          ]}
        />

        {/* MOVING LIQUID PILL — the highlight that springs between tabs.
            Two layers: a slightly larger soft glow behind + the crisp
            pill on top with a bright inner border. Reads as lit glass. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pillGlow,
            glowStyle,
            { backgroundColor: `${palette.accent}22` },
          ]}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pill,
            pillStyle,
            {
              backgroundColor: `${palette.accent}3D`,
              borderColor: 'rgba(255,255,255,0.55)',
            },
          ]}
        />
        {state.routes.map((route, index) => {
          const meta = TAB_META[route.name];
          if (!meta) return null;
          const focused = state.index === index;
          return (
            <TabButton
              key={route.key}
              meta={meta}
              focused={focused}
              reduce={reduce}
              activeColor={palette.ink}
              inactiveColor={palette.ink2}
              onLayout={handleTabLayout(route.key, focused)}
              onActivate={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (state.index !== index && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

// ─── TAB BUTTON (owns its press-dip + focus-pop) ────────────────────

// Strong ease-out for UI micro-motion (animate-expo).
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

interface TabButtonProps {
  meta: { label: string; icon: IconName };
  focused: boolean;
  reduce: boolean;
  activeColor: string;
  inactiveColor: string;
  onLayout: (e: LayoutChangeEvent) => void;
  onActivate: () => void;
}

function TabButton({
  meta,
  focused,
  reduce,
  activeColor,
  inactiveColor,
  onLayout,
  onActivate,
}: TabButtonProps): JSX.Element {
  const pressed = useSharedValue(0);
  const focus = useSharedValue(focused ? 1 : 0);

  // Pop to 1.08 as this tab becomes active (spring), snap under Reduce Motion.
  useEffect(() => {
    if (reduce) {
      focus.value = focused ? 1 : 0;
    } else {
      focus.value = withSpring(focused ? 1 : 0, { dampingRatio: 0.6, duration: 380 });
    }
  }, [focused, reduce, focus]);

  const contentStyle = useAnimatedStyle(() => {
    const base = 1 + focus.value * 0.08; // focus pop
    const scale = base * (1 - pressed.value * 0.08); // press dip
    return { transform: [{ scale }] };
  });

  const color = focused ? activeColor : inactiveColor;

  return (
    <Pressable
      onLayout={onLayout}
      onPressIn={() => {
        // Feedback on press-IN (immediate): haptic + a small dip.
        pressed.value = reduce ? 0 : withTiming(1, { duration: 90, easing: EASE_OUT });
        Haptics.selectionAsync().catch(() => {});
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: 130, easing: EASE_OUT });
      }}
      onPress={onActivate}
      style={styles.tab}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={meta.label}
      hitSlop={4}
    >
      <Animated.View style={[styles.tabContent, contentStyle]}>
        <TabIcon name={meta.icon} color={color} />
        <Text style={[styles.label, { color, fontWeight: focused ? '800' : '600' }]}>
          {meta.label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ─── STYLES (layout only — colours inline, palette-driven) ──────────

const BAR_H = 64;
const BAR_PAD = 7;
const RADIUS = 34;

const styles = StyleSheet.create({
  wrapper: {
    // Side margins so the pill truly floats.
    paddingHorizontal: 14,
  },
  bar: {
    height: BAR_H,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS,
    borderWidth: 1,
    padding: BAR_PAD,
    overflow: 'hidden',
    // Warm accent-tinted glow so the pill reads as elevated liquid glass.
    shadowOpacity: 0.32,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  // Soft outer glow that sits BEHIND the crisp pill so the highlight
  // reads as light bleeding out of the glass (the "liquid" quality).
  pillGlow: {
    position: 'absolute',
    top: BAR_PAD - 3,
    left: 0, // horizontal position is driven by glowStyle's translateX
    height: BAR_H - BAR_PAD * 2 + 6,
    borderRadius: RADIUS - BAR_PAD + 3,
  },
  pill: {
    position: 'absolute',
    top: BAR_PAD,
    left: 0,
    height: BAR_H - BAR_PAD * 2,
    borderRadius: RADIUS - BAR_PAD,
    borderWidth: 1.5,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  tabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: {
    fontSize: 10.5,
    letterSpacing: 0.25,
  },
});
