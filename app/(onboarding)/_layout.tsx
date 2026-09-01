import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { A } from '../../src/theme';
import { Storage } from '../../src/database/storage';

/**
 * Onboarding Layout — wraps all five onboarding screens.
 *
 * ─── DRAFT INITIALIZATION ───────────────────────────────────────────
 *
 *  On mount we initialize an EMPTY onboarding draft in MMKV (if one
 *  doesn't already exist from a previous incomplete onboarding). Each
 *  screen will merge its slice of data into this draft, and the final
 *  `ready.tsx` reads the complete draft via `completeOnboarding()`.
 *
 *  Storing the draft in MMKV (not React state) means:
 *    - Surviving accidental app backgrounding mid-onboarding
 *    - Fast access from any screen without prop drilling
 *    - Hot reload doesn't wipe progress during development
 *
 *  The draft is auto-cleared by `useUserStore.completeOnboarding()`
 *  after successful user creation.
 */
export default function OnboardingLayout() {
  useEffect(() => {
    // Initialize draft on first mount (idempotent — won't clobber
    // existing draft if user re-entered onboarding partway through).
    const existing = Storage.onboardingDraft.get();
    if (!existing) {
      Storage.onboardingDraft.set({
        startedAt: new Date().toISOString(),
      });
    }
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: A.ground },
        animation: 'slide_from_right',
        // Disable back gesture on welcome (no going back from first screen)
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
      <Stack.Screen name="mode-select" />
      {/* Multi-select conditions (design-v2 audit fix — was missing entirely). */}
      <Stack.Screen name="conditions" />
      <Stack.Screen name="companion-select" />
      <Stack.Screen name="cycle-setup" />
      {/* Optional reminders opt-in — Flo does this up front, we do too. */}
      <Stack.Screen name="reminders" />
      <Stack.Screen name="ready" options={{ gestureEnabled: false }} />
    </Stack>
  );
}