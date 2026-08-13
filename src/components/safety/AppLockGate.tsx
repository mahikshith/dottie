/**
 * AppLockGate
 *
 * Full-screen overlay that hides the real app behind the lock screen
 * (or the decoy) whenever the ghost-mode store says we're not in the
 * 'unlocked' / 'disabled' state.
 *
 * ─── WHY A SEPARATE COMPONENT ───────────────────────────────────────
 *
 *  The root layout already has plenty of responsibilities (hydration,
 *  splash, navigation tree). Pulling the lock overlay into its own
 *  component keeps the root layout small, makes the gate trivially
 *  testable in isolation, and gives us one obvious place to wire
 *  background → foreground transitions in the future.
 *
 * ─── HOW IT WORKS ───────────────────────────────────────────────────
 *
 *  - Subscribes to `useGhostModeStore.lockState`
 *  - When state === 'locked' → renders <GhostLockBody /> fullscreen
 *  - When state === 'decoy'  → renders <DecoyHomeBody /> fullscreen
 *  - When state === 'unlocked' or 'disabled' → renders nothing
 *
 *  This component sits ABOVE the navigation stack inside the root
 *  layout. When mounted, it grabs all touches in the overlay area,
 *  so the real app underneath is fully shielded from interaction —
 *  even though it's still mounted in memory and ready to instantly
 *  reveal on unlock (zero flash).
 *
 * ─── IMPORTANT: BODY COMPONENTS, NOT ROUTE FILES ────────────────────
 *
 *  We deliberately import GhostLockBody + DecoyHomeBody from sibling
 *  files in `src/components/safety/`, NOT the route files at
 *  `app/(modals)/ghost-lock.tsx`. Importing route files from outside
 *  the `app/` tree is unsupported by Expo Router — the screens would
 *  lose their router context and the Stack.Screen options inside
 *  would silently no-op (which would break gestureEnabled=false on
 *  the lock screen, defeating the safety guarantee).
 *
 *  The route files at app/(modals)/ghost-lock.tsx and decoy-home.tsx
 *  are kept as thin wrappers around the same body components, so
 *  they still work if you ever do navigate to them via router.push().
 *
 * ─── APP LIFECYCLE INTEGRATION ──────────────────────────────────────
 *
 *  We listen to AppState changes:
 *    - Going to background → if ghost mode is ON, lock immediately
 *    - Coming to foreground → if locked, keep locked (already enforced)
 *
 *  The background → lock transition is the key safety guarantee:
 *  if the user backgrounds the app to switch to messages (revealing
 *  Dottie in the app switcher preview), the preview shows the lock
 *  screen, not the cycle calendar.
 *
 *  We deliberately DON'T grab a screenshot-blocker native module for
 *  MVP — that's a chunk 13+ refinement. The immediate-lock-on-bg
 *  approach catches 95% of the snooping vectors today.
 */

import { useEffect, useRef } from 'react';
import { View, StyleSheet, AppState, AppStateStatus } from 'react-native';
import { useGhostModeStore, selectLockState } from '../../security/ghost-mode-store';
import { GhostLockBody } from './GhostLockBody';
import { DecoyHomeBody } from './DecoyHomeBody';

// ─── COMPONENT ───────────────────────────────────────────────────────

export function AppLockGate() {
  const lockState = useGhostModeStore(selectLockState);
  const previousAppState = useRef<AppStateStatus>(AppState.currentState);

  // ─── App background → auto-lock ─────────────────────────────────
  useEffect(() => {
    const handleChange = (next: AppStateStatus) => {
      const prev = previousAppState.current;
      previousAppState.current = next;

      // We trigger lock when going FROM active TO background/inactive.
      // The current lock state at that moment determines if we need to
      // do anything: if ghost mode is disabled or already locked,
      // nothing changes.
      const goingToBackground =
        (prev === 'active') && (next === 'background' || next === 'inactive');

      if (!goingToBackground) return;

      const current = useGhostModeStore.getState().lockState;
      if (current.kind === 'unlocked') {
        // The user was using the real app — re-lock so the next
        // foreground (or app switcher preview) shows the lock screen.
        useGhostModeStore.getState().lockNow('foreground');
      }
    };

    const sub = AppState.addEventListener('change', handleChange);
    return () => sub.remove();
  }, []);

  // ─── Render based on lock state ─────────────────────────────────
  if (lockState.kind === 'unlocked' || lockState.kind === 'disabled') {
    return null;
  }

  return (
    <View
      style={StyleSheet.absoluteFillObject}
      pointerEvents="auto"
      // Render above everything else in the layout
    >
      {lockState.kind === 'locked' && <GhostLockBody />}
      {lockState.kind === 'decoy' && <DecoyHomeBody />}
    </View>
  );
}
