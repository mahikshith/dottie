import { Stack } from 'expo-router';
import { Typography } from '../../src/constants/typography';
import { A } from '../../src/theme';

/**
 * Community Route Group Layout — "The Circle"
 *
 * ─── ROLE ───────────────────────────────────────────────────────────
 *
 *  Wraps the deep community screens (new post, post detail) in a
 *  stack navigator with a warm header. The community FEED itself lives
 *  in `app/(tabs)/community.tsx` because it's a tab. These screens are
 *  pushed on top of the feed when the user creates a post or taps one.
 *
 * ─── NAVIGATION SHAPE ───────────────────────────────────────────────
 *
 *  /community            (tabs route — feed)
 *  /(community)/new-post (modal-style push)
 *  /(community)/post/123 (push with back to feed)
 *
 *  The header uses our warm cream background and rich-brown tint so
 *  the navigation chrome feels native to Dottie, not iOS-generic.
 */
export default function CommunityLayout() {
  return (
    <Stack
      screenOptions={{
        // Aurora-native chrome (was cream Colors.surface.background — that
        // painted a white bar over the notch/status-bar on the aurora
        // new-post / post-detail screens, hiding time + battery).
        headerStyle: {
          backgroundColor: A.ground,
        },
        headerTintColor: A.ink,
        headerTitleStyle: {
          ...Typography.preset.h4,
          color: A.ink,
        },
        headerShadowVisible: false,
        headerBackTitle: 'Back',
        contentStyle: {
          backgroundColor: A.ground,
        },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="new-post"
        options={{
          title: 'Share with The Circle',
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="post/[id]"
        options={{
          title: 'Post',
        }}
      />
    </Stack>
  );
}
