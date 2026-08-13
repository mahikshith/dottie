/**
 * Ghost Lock Route — Thin Wrapper
 *
 * This route file exists so Expo Router knows about /(modals)/ghost-lock
 * and so the screen has the right modal presentation options
 * (no swipe-down dismiss, no animation).
 *
 * The actual UI lives in src/components/safety/GhostLockBody.tsx, which
 * is also what AppLockGate renders as the overlay during normal Ghost
 * Mode usage.
 *
 * ─── WHY THE SPLIT ──────────────────────────────────────────────────
 *
 *  AppLockGate runs ABOVE the navigation tree as a regular React
 *  component overlay. It cannot import this route file directly
 *  (route files don't have router context outside their Stack).
 *
 *  So the SCREEN BODY lives in `src/components/safety/` (router-free,
 *  importable from anywhere), and this route file is just a shell
 *  that sets the right Stack.Screen options.
 *
 *  Net result: same UX, correct architecture, no duplicated code.
 */

import { Stack } from 'expo-router';
import { GhostLockBody } from '../../src/components/safety/GhostLockBody';

export default function GhostLockRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          gestureEnabled: false, // never swipe-out of a lock screen
          headerShown: false,
        }}
      />
      <GhostLockBody />
    </>
  );
}
