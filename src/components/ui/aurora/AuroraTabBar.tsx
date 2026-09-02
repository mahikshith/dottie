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
 * ─── MOTION (animate-expo · tab-indicator recipe) ───────────────────
 *
 *   Positions are measured once with `onLayout`; the pill absolutely
 *   positions with no interactive children (the one sanctioned width
 *   animation). Spring form { dampingRatio: 0.78, duration: 340 } with
 *   a hint of overshoot. Reduce Motion snaps. Selection haptic on press.
 *   The screen never re-renders per frame — only the pill's transform.
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
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
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

  const pillX = useSharedValue(0);
  const pillW = useSharedValue(0);

  useEffect(() => {
    const route = state.routes[state.index];
    if (!route) return;
    const pos = positionsRef.current[route.key];
    if (!pos) return;
    if (reduce) {
      pillX.value = pos.x;
      pillW.value = pos.w;
    } else {
      pillX.value = withSpring(pos.x, { dampingRatio: 0.78, duration: 340 });
      pillW.value = withSpring(pos.w, { dampingRatio: 0.78, duration: 340 });
    }
  }, [state.index, state.routes, layoutReady, reduce, pillX, pillW]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: pillW.value,
  }));

  const onPress = (route: TabRoute, index: number) => {
    Haptics.selectionAsync().catch(() => {});
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (state.index !== index && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  const handleTabLayout = (routeKey: string, isFocused: boolean) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    positionsRef.current[routeKey] = { x, w: width };
    if (isFocused && pillW.value === 0) {
      pillX.value = x;
      pillW.value = width;
      setLayoutReady((n) => n + 1);
    }
  };

  return (
    <View
      style={[styles.wrapper, { paddingBottom: insets.bottom + 8 }]}
      pointerEvents="box-none"
    >
      <View
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
            pillStyle,
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
          // Icon + label go BRIGHT on the active pill (palette.ink),
          // dim on inactive tabs (palette.ink2 — one step brighter than
          // ink3 so all five icons read). Reference-image contrast.
          const color = focused ? palette.ink : palette.ink2;
          return (
            <Pressable
              key={route.key}
              onLayout={handleTabLayout(route.key, focused)}
              onPress={() => onPress(route, index)}
              style={styles.tab}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={meta.label}
              hitSlop={4}
            >
              <TabIcon name={meta.icon} color={color} />
              <Text style={[styles.label, { color, fontWeight: focused ? '800' : '600' }]}>
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
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
    left: -3,
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
    gap: 3,
    height: '100%',
  },
  label: {
    fontSize: 10.5,
    letterSpacing: 0.25,
  },
});
