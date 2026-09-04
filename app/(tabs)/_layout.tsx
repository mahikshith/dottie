import { Tabs, useRouter } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Spacing } from '../../src/constants/spacing';
import { A } from '../../src/theme';
import { AuroraTabBar } from '../../src/components/ui';
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
          // ─── NO TAB TRANSITION (device-test-16) ────────────────
          //
          //  DT11 added a cross-fade + drift here to answer "the transition is
          //  not smooth". On device it made things worse: fading the outgoing
          //  scene to transparent exposes the layer beneath it for a few
          //  frames, and at the bottom of the screen — where the floating tab
          //  pill sits over a transparent bar — that read as a persistent
          //  white glitch on every Home→Cycle / Home→Learn switch.
          //
          //  Owner, DT16: "let's stick to the basics and remove that kind of
          //  effect. The liquid glass is not really needed... we need a
          //  smoother transition and keep it simple."
          //
          //  So there is no scene animation at all now. Tabs are peers, the
          //  destination is already mounted after its first visit, and the
          //  moving glass pill in AuroraTabBar carries the sense of travel on
          //  its own. Nothing fades, so nothing can show through.
          //
          //  Do NOT reintroduce sceneStyleInterpolator or transitionSpec here
          //  without a device test: any of them that animates opacity will
          //  bring the glitch straight back.
          animation: 'none',
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
