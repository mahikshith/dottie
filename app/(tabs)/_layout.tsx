import { Tabs, useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Spacing } from '../../src/constants/spacing';
import { A } from '../../src/theme';
import { AuroraTabBar } from '../../src/components/ui';
import {
  tabSceneInterpolator,
  tabSceneInterpolatorReduced,
  tabTransitionSpec,
} from '../../src/components/ui/aurora/tabSceneTransition';
import { FeedbackBubble } from '../../src/components/beta/FeedbackBubble';
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
  // Reduced motion keeps the cross-fade (it still explains the change) and
  // drops the drift and settle — the parts that actually cause discomfort.
  const reduceMotion = useReducedMotion();
  const sceneInterpolator = reduceMotion ? tabSceneInterpolatorReduced : tabSceneInterpolator;
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
          // ─── TAB TRANSITION ────────────────────────────────────
          //
          //  This used to be `animation: 'none'`. The reasoning was that the
          //  liquid pill was the only motion needed and a transition would add
          //  latency — but on device the result is that the pill glides while
          //  the screen behind it teleports, and the two read as unrelated
          //  events. The owner reported it as "not smooth at all" across
          //  several builds; a hard cut IS the un-smoothness.
          //
          //  What replaces it is a cross-fade with an 18px directional drift,
          //  NOT a slide — see tabSceneTransition.ts for why peers must not
          //  slide and why the drift is that small. Native-driver, 170ms, so
          //  it stays on the UI thread while the destination mounts.
          //
          //  `animation` is deliberately ABSENT rather than set: the library
          //  reads a named preset only when that key is present, and falls back
          //  to `Boolean(transitionSpec)` to decide whether the outgoing screen
          //  stays mounted during the transition. Setting `animation: 'none'`
          //  here would tear the leaving screen down instantly and there would
          //  be nothing to cross-fade.
          sceneStyleInterpolator: sceneInterpolator,
          transitionSpec: tabTransitionSpec,
          // Freeze blurred tabs (react-native-screens): stops inactive screens
          // re-rendering in the background, so the active tab + the tab-bar
          // scrub stay responsive. Screens still stay mounted after first visit,
          // so returning to a tab is instant (only the FIRST open pays mount
          // cost — deeper first-mount profiling of calendar/learn is a
          // follow-up, see docs/DEVICE-TEST-6.md).
          freezeOnBlur: true,
          // Paint the scene container in the aurora ground so the FIRST open of
          // a heavy tab (Today→Cycle) never flashes WHITE while it mounts — the
          // white glitch the owner saw. The screen's own AuroraBackground paints
          // the same colour a beat later, so the seam is invisible.
          sceneStyle: { backgroundColor: A.ground },
          // AuroraTabBar draws no background of its own on purpose. The
          // default react-navigation tab-bar container is white/cream on
          // Android — that's the "white rectangle at the bottom" the owner
          // asked us to kill. Force the container transparent + strip its
          // top border + Android elevation shadow so the aurora ground
          // shows straight through and only the icons/labels are visible.
          tabBarStyle: {
            backgroundColor: 'transparent',
            borderTopWidth: 0,
            elevation: 0,
          },
        }}
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
          {/* The version badge used to float here, top-right, over the Home
              hero. It read as a cream patch stuck to the corner and it sat
              right where the day ring wants to be (device-test-8). Build
              details now live on their own screen: You → About this build. */}
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
    // Device-test #5: without this, the parent view under the transparent
    // AuroraTabBar defaults to white/cream, painting the "cream rectangle"
    // the owner keeps flagging. Painting the root aurora ground means the
    // safe-area area beneath the floating pill also stays dark, so the bar
    // truly floats on the aurora world instead of an opaque strip.
    backgroundColor: A.ground,
  },
  // Overlay layer sits ABOVE the Tabs container but BELOW the AppLockGate
  // (root layout). Doesn't intercept taps thanks to pointerEvents="box-none".
  overlayLayer: {
    ...StyleSheet.absoluteFillObject,
  },
});
