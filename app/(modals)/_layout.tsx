import { Stack } from 'expo-router';
import { Colors } from '../../src/constants/colors';

/**
 * Modal Stack Layout
 *
 * Hosts full-screen modal flows that should slide up from the bottom
 * (iOS-native bottom-sheet feel) rather than push from the side.
 *
 * ─── REGISTERED MODALS ──────────────────────────────────────────────
 *
 *   /(modals)/daily-checkin         → polished daily check-in flow
 *   /(modals)/streak-celebration    → milestone & streak success moments
 *   /(modals)/level-up              → XP threshold crossed → new level
 *   /(modals)/checkin-recap         → default post-checkin "thank you"
 *
 * ─── SAFETY MODALS (chunk 11) ───────────────────────────────────────
 *
 *   /(modals)/ghost-lock            → PIN entry surface (lock screen)
 *   /(modals)/decoy-home            → "Garden Notes" decoy app
 *
 *   Note: ghost-lock + decoy-home are RENDERED by AppLockGate (an
 *   overlay component), NOT navigated to. They're registered here so
 *   Expo Router knows about the routes — but the gate component
 *   imports them directly so we can render them above the whole
 *   navigation tree without a router push.
 *
 *   When ghost mode is on and the user backgrounds the app, the gate
 *   overlay flips to <GhostLockScreen /> — bypassing the normal
 *   modal presentation entirely. This keeps the auto-lock instant
 *   (no transition animation) and means the lock screen can never
 *   be dismissed by swipe (which would defeat the purpose).
 *
 * ─── FUTURE MODALS (planned, not yet built) ─────────────────────────
 *
 *   /(modals)/badge-earned
 *   /(modals)/cramp-freeze
 *
 * Each modal owns its own dismiss UX (close button + swipe-down) — the
 * stack layout just gives them a consistent presentation style.
 */
export default function ModalsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: 'modal',
        animation: 'slide_from_bottom',
        contentStyle: { backgroundColor: Colors.surface.background },
      }}
    >
      <Stack.Screen name="daily-checkin" />
      <Stack.Screen name="streak-celebration" />
      <Stack.Screen name="level-up" />
      <Stack.Screen name="checkin-recap" />

      {/* Safety overlays — see header note above. Registered here for
          route awareness; rendered by AppLockGate in the root layout. */}
      <Stack.Screen
        name="ghost-lock"
        options={{
          gestureEnabled: false, // cannot swipe to dismiss the lock
          animation: 'none',     // overlay-style, no transition
        }}
      />
      <Stack.Screen
        name="decoy-home"
        options={{
          gestureEnabled: false, // cannot swipe out of the decoy
          animation: 'none',
        }}
      />
    </Stack>
  );
}
