import { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useReducedMotion,
} from 'react-native-reanimated';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { FeedbackBubble } from '../../src/components/beta/FeedbackBubble';
import { VersionBadge } from '../../src/components/beta/VersionBadge';
import { BetaPioneerToast } from '../../src/components/beta/BetaPioneerToast';
import { IS_BETA_BUILD } from '../../src/constants/build-info';

/**
 * Main Tab Layout — Bottom navigation for the core app experience.
 *
 * Tabs: Home | Calendar | Learn | Community | Profile
 *
 * Design:
 * - Warm cream background on tab bar
 * - Rounded icons (filled style)
 * - Active tab: coral color, subtle scale
 * - No border-top — uses warm shadow instead
 *
 * ─── BETA OVERLAYS (chunk 12) ───────────────────────────────────────
 *
 *  In beta builds (IS_BETA_BUILD), we mount three corner widgets on
 *  TOP of the tab tree but BELOW the AppLockGate (which lives in
 *  the root layout, outside this tree):
 *
 *    • VersionBadge       — top-right tag showing build info
 *    • FeedbackBubble     — bottom-right floating action for feedback
 *    • BetaPioneerToast   — one-time celebration if just awarded
 *
 *  All three are rendered inside a `pointerEvents="box-none"` View
 *  so taps outside the widgets pass through to the underlying tab
 *  content. The tab navigation is never blocked by these overlays.
 *
 *  In production builds (IS_BETA_BUILD=false), all three return null
 *  and zero cost is incurred.
 *
 *  Why inside the tabs (vs root)?
 *    1. The widgets shouldn't appear during onboarding — onboarding
 *       lives in /(onboarding), which is a sibling of /(tabs).
 *    2. They shouldn't appear above modals — modals slide up from
 *       below, and the FeedbackBubble would awkwardly hover above
 *       a feedback sheet, which would be ironic.
 *    3. They shouldn't appear above the Ghost Lock screen — that's
 *       guaranteed because AppLockGate renders ABOVE this entire tree.
 *
 *  The FeedbackBubble navigates to the modal route directly via
 *  useRouter so the tab tree doesn't have to expose any callbacks.
 */

// Spring config + focus targets for the tab icons. A small lift + scale
// makes the active tab feel like it "rises to meet you". Runs on the UI
// thread (Reanimated) so tab switches stay at 60fps.
const TAB_SPRING = { damping: 14, stiffness: 200, mass: 0.6 } as const;
const FOCUSED_SCALE = 1.18;
const FOCUSED_LIFT = -3;

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  const scale = useSharedValue(focused ? FOCUSED_SCALE : 1);
  const lift = useSharedValue(focused ? FOCUSED_LIFT : 0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const targetScale = focused ? FOCUSED_SCALE : 1;
    const targetLift = focused ? FOCUSED_LIFT : 0;
    if (reduceMotion) {
      scale.value = targetScale;
      lift.value = targetLift;
      return;
    }
    scale.value = withSpring(targetScale, TAB_SPRING);
    lift.value = withSpring(targetLift, TAB_SPRING);
  }, [focused, reduceMotion, scale, lift]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: lift.value }],
  }));

  return (
    <Animated.View style={[styles.tabIcon, animatedStyle]}>
      <Text style={styles.tabEmoji}>{emoji}</Text>
    </Animated.View>
  );
}

export default function TabLayout() {
  const router = useRouter();

  const handleFeedbackPress = () => {
    // The bubble's own haptic fires first, then this navigates.
    router.push('/(modals)/beta-feedback');
  };

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: Colors.primary.coral,
          tabBarInactiveTintColor: Colors.text.tertiary,
          tabBarLabelStyle: styles.tabLabel,
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: 'Home',
            tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="calendar"
          options={{
            title: 'Calendar',
            tabBarIcon: ({ focused }) => <TabIcon emoji="📅" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="learn"
          options={{
            title: 'Learn',
            tabBarIcon: ({ focused }) => <TabIcon emoji="🎓" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="community"
          options={{
            title: 'Circle',
            tabBarIcon: ({ focused }) => <TabIcon emoji="💬" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
          }}
        />
      </Tabs>

      {/* ─── Beta overlays (chunk 12) ───────────────────────────────
          Wrapped in pointerEvents="box-none" so the tab content
          underneath still receives taps everywhere except on the
          widgets themselves. Each widget self-suppresses in
          production builds — zero cost when IS_BETA_BUILD=false. */}
      {IS_BETA_BUILD ? (
        <View style={styles.overlayLayer} pointerEvents="box-none">
          {/* Version badge — top-right corner. Compact pill that
              barely registers visually but is one tap away when
              testers need to report what they're on. */}
          <VersionBadge position="top-right" />

          {/* Feedback bubble — bottom-right, lifted above the tab bar
              so it never overlaps tab labels. Always reachable. */}
          <FeedbackBubble
            onPress={handleFeedbackPress}
            bottomOffset={Spacing.tabBarHeight}
          />

          {/* Pioneer toast — silent unless the user just earned the
              badge this session. Auto-dismisses after a few seconds. */}
          <BetaPioneerToast />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  // Overlay layer sits ABOVE the Tabs container but BELOW the
  // AppLockGate (which lives in root layout). Doesn't intercept
  // taps thanks to pointerEvents="box-none" on the inner View.
  overlayLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  tabBar: {
    backgroundColor: Colors.surface.card,
    borderTopWidth: 0,
    height: Spacing.tabBarHeight,
    paddingTop: Spacing.tabBarPadding,
    shadowColor: '#B48264',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  tabLabel: {
    ...Typography.preset.caption,
    fontSize: 11,
    marginTop: 2,
  },
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
  },
  tabEmoji: {
    fontSize: 22,
  },
});
