/**
 * Dottie — AuroraTabBar (design-v2, device-test #4 redesign)
 *
 * Owner-driven redesign: the bottom nav is now a CURVY GLASS PILL sitting
 * above the phone's gesture bar, with a moving GLASS HIGHLIGHT that springs
 * from tab to tab on tap. That's the "real glassmorphism" the owner asked
 * for — a glass surface that moves, not a static rectangle.
 *
 * ─── ANATOMY ────────────────────────────────────────────────────────
 *
 *   +──────────────────────────────────────────+
 *   │  ⏱   📅   📖   👯   👤                      │  ← glass container
 *   │       ▓▓ ← moving pill (springs)           │
 *   +──────────────────────────────────────────+
 *
 *   • Container   — big rounded pill (radius 32), semi-transparent white
 *     glass (rgba 6%), 1px light border. The aurora ground shows through.
 *   • Highlight   — separate pill absolutely-positioned INSIDE the
 *     container, tinted with palette.accent at ~28% opacity, animated
 *     translateX + width via Reanimated shared values. Springs between
 *     tab positions measured at layout time.
 *   • Icons       — active gets palette.ink (bright, high-contrast on the
 *     mint-tinted pill); inactive gets palette.ink2 (brighter than the old
 *     ink3 so they read on the dim glass, not "off").
 *   • Labels      — same colour rule. "Today / Cycle / Learn / Circle / You"
 *     stay so users see what each tab means.
 *
 * ─── MOTION (animate-expo · tab-indicator recipe) ───────────────────
 *
 *   Tabs are peers, so the SCREEN never slides — only the highlight moves.
 *   Positions are measured once per tab with `onLayout`; the pill animates
 *   transform+width (it's absolutely positioned with no interactive
 *   children, the one sanctioned width animation). Spring form
 *   `{ dampingRatio: 0.78, duration: 340 }` for a hint of overshoot without
 *   feeling loose. Reduce Motion snaps instantly. Haptic on press, not on
 *   land. The screen never re-renders per frame — only the pill's transform.
 *
 * ─── SAFE-AREA ──────────────────────────────────────────────────────
 *
 *   The bar sits above the phone's gesture / navigation area via
 *   `insets.bottom + 8`. The bar itself is 60pt tall; the parent's
 *   `Spacing.tabBarHeight` already accounts for that in every screen's
 *   ScrollView contentContainer.
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device here). BottomTabBarProps shape is
 *  typed locally (minimal) to avoid a fragile transitive import.
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
    strokeWidth: 1.9,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
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

  // Measured tab positions by route key. Populated as each tab's onLayout
  // fires (once per mount, unless the bar resizes). We keep it in a ref
  // so measurements don't trigger extra renders.
  const positionsRef = useRef<Record<string, { x: number; w: number }>>({});
  // Bump this to re-run the pill-position effect once the first layout lands.
  const [layoutReady, setLayoutReady] = useState(0);

  // Reanimated shared values driving the moving pill.
  const pillX = useSharedValue(0);
  const pillW = useSharedValue(0);

  // Slide the pill whenever the active index changes (or the first layout
  // lands). Spring form has a little overshoot; Reduce Motion snaps.
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
    // For the currently-focused tab on the first layout, snap the pill
    // there directly so it renders in the right place on the first paint
    // (no "pill starts at 0 and springs to position 3" flash).
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
            backgroundColor: palette.glass.bg,
            borderColor: palette.glass.edge,
            shadowColor: palette.accent,
          },
        ]}
      >
        {/* Moving glass highlight — the "glass that moves" the owner asked for. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pill,
            pillStyle,
            {
              backgroundColor: `${palette.accent}33`,
              borderColor: `${palette.accent}88`,
            },
          ]}
        />

        {state.routes.map((route, index) => {
          const meta = TAB_META[route.name];
          if (!meta) return null;
          const focused = state.index === index;
          // Active icon/label are BRIGHT (palette.ink) on the mint-tinted
          // glass pill — highest contrast. Inactive stays a soft ink2 —
          // clearly visible, but recessed. Answers owner's "opposite,
          // contrasting colour" ask.
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

const BAR_H = 62;
const BAR_PAD = 6;
const RADIUS = 32;

const styles = StyleSheet.create({
  wrapper: {
    // Room for the phone's gesture / nav area beneath, and side-margins so
    // the pill floats rather than butting the screen edges.
    paddingHorizontal: 14,
  },
  bar: {
    height: BAR_H,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS,
    borderWidth: 1,
    padding: BAR_PAD,
    // A soft warm glow using the palette accent — matches the aurora
    // vibe without becoming a hard shadow rectangle.
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    // The container is a glass pill; the aurora ground shows through
    // its 6% white fill, which is why we set only opacity + border.
  },
  pill: {
    position: 'absolute',
    top: BAR_PAD,
    left: 0,
    height: BAR_H - BAR_PAD * 2,
    borderRadius: RADIUS - BAR_PAD,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    height: '100%',
  },
  label: {
    fontSize: 10.5,
    letterSpacing: 0.2,
  },
});
