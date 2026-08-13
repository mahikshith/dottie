import { Redirect } from 'expo-router';
import { Storage } from '../src/database/storage';
import { useUserStore, selectIsOnboarded } from '../src/stores';

/**
 * App Entry Point — synchronous redirect logic.
 *
 * ─── HOW IT DECIDES ─────────────────────────────────────────────────
 *
 *  1. PRIMARY: Check MMKV's `hasOnboarded` flag (fast, doesn't await)
 *     — true  → main app (tabs/home)
 *     — false → onboarding flow
 *
 *  2. SAFETY NET: Confirm via the store's `selectIsOnboarded` selector
 *     (validates that hydration actually loaded a user). If MMKV says
 *     "onboarded" but no user got hydrated (e.g., DB was wiped manually),
 *     fall back to onboarding so we don't crash the home screen.
 *
 *  The redirect happens BEFORE any screen mounts, so returning users
 *  never see a flash of welcome before being sent to home.
 *
 *  Note: This component runs AFTER `_layout.tsx` finishes hydration,
 *  so both MMKV and the store are reliable sources of truth here.
 */
export default function Index() {
  const hasOnboardedFlag = Storage.hasOnboarded.get();
  const isOnboardedInStore = useUserStore(selectIsOnboarded);

  // Both must be true to enter the main app. Either being false →
  // onboarding (it's idempotent; re-running for an already-onboarded
  // user is just an extra few taps).
  const goToTabs = hasOnboardedFlag && isOnboardedInStore;

  if (goToTabs) {
    return <Redirect href="/(tabs)/home" />;
  }

  return <Redirect href="/(onboarding)/welcome" />;
}