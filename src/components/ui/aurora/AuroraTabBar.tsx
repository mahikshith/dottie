/**
 * Dottie — AuroraTabBar (design-v2)
 *
 * The fluid glass bottom bar: a glowing indicator that springs between tabs
 * with a touch of overshoot (the "ecstasy" the design calls for), custom
 * line icons, honest labels (Today/Cycle/Learn/Circle/You), and a selection
 * haptic on tap. Reads its colours from the active mood palette.
 *
 * ─── HOW TO WIRE (deferred until screens are themed) ────────────────
 *
 *      // app/(tabs)/_layout.tsx
 *      <Tabs tabBar={(props) => <AuroraTabBar {...props} />} .../>
 *
 *  Not plugged into the live layout yet: a dark aurora bar under today's cream
 *  screens would clash. Plug it in once the tab screens read palette tokens.
 *
 * ─── MOTION (animate-expo · tab-indicator recipe) ───────────────────
 *
 *  Tabs are peers, so the SCREEN never slides — only the indicator moves.
 *  Positions are measured once with `onLayout`; the indicator animates
 *  transform+width (it's absolutely positioned with no children, the one
 *  sanctioned width animation). Spring form `{duration, dampingRatio}` with a
 *  little overshoot; Reduce Motion snaps. `Haptics.selectionAsync()` fires on
 *  the press, not when the pill lands. The screen never re-renders per frame.
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device). The BottomTabBarProps shape is typed
 *  locally (minimal) to avoid a fragile transitive import; confirm against the
 *  installed @react-navigation/bottom-tabs when wiring.
 */

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
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
  const p = { stroke: color, strokeWidth: 1.8, fill: 'none' as const, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
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

export function AuroraTabBar({ state, navigation }: AuroraTabBarProps): JSX.Element {
  const { palette } = useAurora();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();

  const [layouts, setLayouts] = useState<Record<number, { x: number; width: number }>>({});

  const px = useSharedValue(0);
  const pw = useSharedValue(0);

  useEffect(() => {
    const l = layouts[state.index];
    if (!l) return;
    const spring = { duration: 440, dampingRatio: 0.72 }; // gentle overshoot
    px.value = reduce ? l.x + 4 : withSpring(l.x + 4, spring);
    pw.value = reduce ? l.width - 8 : withSpring(l.width - 8, spring);
  }, [state.index, layouts, reduce, px, pw]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: px.value }],
    width: pw.value,
  }));

  const onPress = (route: TabRoute, index: number) => {
    Haptics.selectionAsync().catch(() => {});
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (state.index !== index && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  };

  return (
    <View
      style={[
        styles.bar,
        {
          paddingBottom: insets.bottom + 10,
          backgroundColor: palette.ground + 'E6', // ~90% opaque ground (glass w/o blur)
          borderTopColor: palette.glass.edge,
        },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.pill,
          {
            backgroundColor: palette.glass.bg,
            borderColor: palette.glass.edge,
            shadowColor: palette.accent,
          },
          pillStyle,
        ]}
      />
      {state.routes.map((route, index) => {
        const meta = TAB_META[route.name];
        if (!meta) return null;
        const focused = state.index === index;
        const color = focused ? palette.accent : palette.ink3;
        return (
          <Pressable
            key={route.key}
            onPress={() => onPress(route, index)}
            onLayout={(e) => {
              const { x, width } = e.nativeEvent.layout;
              setLayouts((prev) => (prev[index]?.x === x && prev[index]?.width === width ? prev : { ...prev, [index]: { x, width } }));
            }}
            style={styles.tab}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={meta.label}
          >
            <TabIcon name={meta.icon} color={color} />
            <Text style={[styles.label, { color }]}>{meta.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
  },
  pill: {
    position: 'absolute',
    top: 8,
    height: 52,
    borderRadius: 20,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
  },
});
