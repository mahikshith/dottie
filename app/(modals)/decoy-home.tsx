/**
 * Decoy Home Route — Thin Wrapper
 *
 * The actual UI of the "Garden Notes" decoy lives in
 * src/components/safety/DecoyHomeBody.tsx so AppLockGate can render
 * it as an overlay (where the user actually sees it).
 *
 * This route file exists for completeness — Expo Router knows about
 * /(modals)/decoy-home and applies the right modal options (no swipe
 * dismiss, no animation).
 *
 * See GhostLockBody / ghost-lock for the same pattern + rationale.
 */

import { Stack } from 'expo-router';
import { DecoyHomeBody } from '../../src/components/safety/DecoyHomeBody';

export default function DecoyHomeRoute() {
  return (
    <>
      <Stack.Screen
        options={{
          gestureEnabled: false, // cannot swipe out of the decoy
          headerShown: false,
        }}
      />
      <DecoyHomeBody />
    </>
  );
}
