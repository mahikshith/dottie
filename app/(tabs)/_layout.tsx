import { Tabs, useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Spacing } from '../../src/constants/spacing';
import { AuroraTabBar } from '../../src/components/ui';
import { FeedbackBubble } from '../../src/components/beta/FeedbackBubble';
import { VersionBadge } from '../../src/components/beta/VersionBadge';
import { BetaPioneerToast } from '../../src/components/beta/BetaPioneerToast';
import { IS_BETA_BUILD } from '../../src/constants/build-info';

/**
 * Main Tab Layout — Bottom navigation for the core app experience.
 *
 * Tabs: Home | Calendar | Learn | Community | Profile
 *
 * ─── MOOD AURORA (design-v2) ────────────────────────────────────────
 *
 *  The bottom bar is the custom glass <AuroraTabBar> (fluid glowing indicator
 *  that springs between tabs, custom line icons, honest labels
 *  Today/Cycle/Learn/Circle/You, palette-driven). It reads the active mood
 *  palette via useAurora(), so it re-tints with the rest of the app. The old
 *  cream tab bar + per-icon spring (TabIcon) are retired — AuroraTabBar owns
 *  the icons, labels, active tint, and its own selection haptic + indicator
 *  motion (see the component for the animate-expo tab-indicator recipe).
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device). AuroraTabBar's BottomTabBarProps
 *  shape is typed minimally; expo-router passes a superset, so `{...props}`
 *  spreads cleanly (extra props ignored).
 *
 * ─── BETA OVERLAYS (chunk 12) ───────────────────────────────────────
 *
 *  In beta builds (IS_BETA_BUILD), three corner widgets mount on TOP of the
 *  tab tree but BELOW the AppLockGate (root layout):
 *    • VersionBadge       — top-right build tag
 *    • FeedbackBubble     — bottom-right floating feedback action
 *    • BetaPioneerToast   — one-time celebration if just awarded
 *
 *  All wrapped in `pointerEvents="box-none"` so taps outside the widgets pass
 *  through to the tab content. In production (IS_BETA_BUILD=false) all three
 *  return null and cost nothing.
 *
 *  Why inside the tabs (vs root)?
 *    1. Hidden during onboarding (/(onboarding) is a sibling of /(tabs)).
 *    2. Never above modals (they slide up from below).
 *    3. Never above the Ghost Lock (AppLockGate renders above this whole tree).
 */
export default function TabLayout() {
  const router = useRouter();

  const handleFeedbackPress = () => {
    // The bubble's own haptic fires first, then this navigates.
    router.push('/(modals)/beta-feedback');
  };

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <AuroraTabBar {...props} />}
      >
        <Tabs.Screen name="home" options={{ title: 'Today' }} />
        <Tabs.Screen name="calendar" options={{ title: 'Cycle' }} />
        <Tabs.Screen name="learn" options={{ title: 'Learn' }} />
        <Tabs.Screen name="community" options={{ title: 'Circle' }} />
        <Tabs.Screen name="profile" options={{ title: 'You' }} />
      </Tabs>

      {/* ─── Beta overlays (chunk 12) ─────────────────────────────── */}
      {IS_BETA_BUILD ? (
        <View style={styles.overlayLayer} pointerEvents="box-none">
          <VersionBadge position="top-right" />
          <FeedbackBubble
            onPress={handleFeedbackPress}
            bottomOffset={Spacing.tabBarHeight}
          />
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
  // Overlay layer sits ABOVE the Tabs container but BELOW the AppLockGate
  // (root layout). Doesn't intercept taps thanks to pointerEvents="box-none".
  overlayLayer: {
    ...StyleSheet.absoluteFillObject,
  },
});
