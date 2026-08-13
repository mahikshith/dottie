/**
 * Beta Feedback Route — Thin Wrapper
 *
 * Registers /(modals)/beta-feedback with Expo Router and sets the
 * right modal presentation options. The real UI lives in
 * src/components/beta/FeedbackSheet.tsx so it can be reused outside
 * a router context (e.g., a future floating sheet variant).
 *
 * Same pattern as Chunk 11's ghost-lock and decoy-home routes.
 *
 * ─── BEHAVIOR ───────────────────────────────────────────────────────
 *
 *  - Swipe-down dismiss is ENABLED (this is a normal modal, not a
 *    safety lock screen). The sheet's own close button also works.
 *  - No header — the sheet provides its own header with the close X.
 *  - presentation='modal' so it slides up from the bottom on iOS and
 *    appears as a card on Android (standard expo-router modal style).
 *
 *  We use router.back() as the close handler so the sheet can dismiss
 *  itself without knowing about expo-router internals.
 */

import { Stack, useRouter } from 'expo-router';
import { FeedbackSheet } from '../../src/components/beta/FeedbackSheet';

export default function BetaFeedbackRoute() {
  const router = useRouter();

  const handleClose = () => {
    if (router.canGoBack()) {
      router.back();
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: 'modal',
          // Swipe-down works for casual dismissal — feedback is opt-in,
          // never something the user must complete.
          gestureEnabled: true,
        }}
      />
      <FeedbackSheet onClose={handleClose} />
    </>
  );
}
