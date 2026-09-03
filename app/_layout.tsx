import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { Colors } from '../src/constants/colors';
import { Typography } from '../src/constants/typography';
import { Spacing } from '../src/constants/spacing';
import { Shadows } from '../src/constants/shadows';
import { hydrateAppState } from '../src/stores';
import { initEncryptedStorage } from '../src/database/storage';
import { AuroraProvider } from '../src/theme';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { AppDialogHost } from '../src/components/ui/appDialog';
import { WalkthroughOverlay } from '../src/walkthrough/WalkthroughOverlay';
import { useWalkthroughStore } from '../src/walkthrough/store';
import { useGhostModeStore } from '../src/security/ghost-mode-store';
import { AppLockGate } from '../src/components/safety/AppLockGate';
import { awardBetaPioneerIfNew } from '../src/services/beta-onboarding';

// Prevent splash from auto-hiding until hydration completes.
// We unblock it ourselves inside the hydration effect below.
SplashScreen.preventAutoHideAsync().catch(() => {
  /* preventAutoHideAsync throws if called twice in fast refresh — safe to ignore */
});

/**
 * Root Layout — The entry point that wraps the entire app.
 *
 * ─── RESPONSIBILITIES ───────────────────────────────────────────────
 *
 *  1. Bootstrap the entire app state BEFORE the first screen renders
 *     (open DB, run migrations, hydrate stores, daily rollover)
 *  2. Hold the splash screen until hydration completes
 *  3. Render a tiny in-app loader as a safety net if hydration takes
 *     longer than the splash is willing to wait
 *  4. Define the top-level navigation tree (index / onboarding / tabs /
 *     deep route groups for community + sisterhood + profile / modal flows)
 *  5. Initialize the Ghost Mode lock state from MMKV (chunk 11)
 *  6. Mount the AppLockGate overlay (chunk 11) so the lock / decoy
 *     screens can cover the navigation tree without being routed to
 *  7. Award the Beta Pioneer badge to first-time beta testers (chunk 12)
 *
 * ─── PERFORMANCE NOTES ──────────────────────────────────────────────
 *
 *  Hydration target: <500ms cold start. The splash → first frame
 *  transition should feel instant.
 *
 *  We deliberately DON'T set animations on the stack here for the
 *  first transition — `index.tsx`'s <Redirect> handles routing
 *  synchronously after hydration, so there's no flash-of-onboarding
 *  for returning users.
 *
 * ─── NAVIGATION SHAPE ───────────────────────────────────────────────
 *
 *  /                       → index router (decides onboarding vs tabs)
 *  /(onboarding)/*         → onboarding flow
 *  /(tabs)/*               → bottom-tab main app
 *  /(community)/*          → community deep screens (push)
 *  /(sisterhood)/*         → sisterhood deep screens (push)
 *  /(profile)/*            → profile deep screens (push) — Doctor Report, Ghost Mode etc.
 *  /(modals)/*             → modal flows (slide up from bottom)
 *  /lesson/[id]            → lesson reader
 *  /quiz/[id]              → quiz flow
 *
 * ─── GHOST MODE OVERLAY ─────────────────────────────────────────────
 *
 *  AppLockGate sits OUTSIDE the navigation tree. When the user enables
 *  Ghost Mode, lock state transitions trigger the gate to render the
 *  lock screen (or decoy) full-screen on top of everything. This means:
 *
 *   • The real app stays mounted underneath — unlock is instant.
 *   • Background → foreground always re-locks (handled by the gate).
 *   • There's no route to push to; the overlay is purely state-driven.
 *
 *  We initialize the lock state AFTER hydration so MMKV reads happen
 *  on the main thread once (synchronously). If ghost mode is off,
 *  the gate renders null and adds zero cost.
 *
 * ─── BETA PIONEER AWARD (CHUNK 12) ──────────────────────────────────
 *
 *  After hydration + ghost-mode init, we attempt to award the Beta
 *  Pioneer badge. The service is:
 *    - Idempotent (safe to call every cold start)
 *    - Self-guarding (no-op in production builds)
 *    - Fire-and-forget (doesn't block any UI)
 *
 *  If the award succeeds, the Profile screen will show the badge in
 *  its grid. A toast component (BetaPioneerToast) mounted in the
 *  tabs layout watches for the "just awarded" state and surfaces a
 *  one-time celebration on the user's first tab visit.
 */
export default function RootLayout() {
  const [hydrated, setHydrated] = useState(false);
  const [hydrationError, setHydrationError] = useState<string | null>(null);
  // Bumping this re-runs the bootstrap effect. Used by the error
  // screen's "Try again" button to retry a failed cold start without a
  // full app kill (hydrateAppState() resets its internal promise on
  // failure, so a fresh call genuinely retries).
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Unlock encrypted storage FIRST — fetches the hardware-backed MMKV
        // key from the secure enclave and, on the first boot after the B2
        // upgrade, re-encrypts the existing store from the old hardcoded key.
        // Must complete before hydrateAppState() (the first Storage reader).
        await initEncryptedStorage();

        const result = await hydrateAppState();
        if (__DEV__) {
          console.log('[Hydration] complete', result);
        }

        // After hydration, initialize the Ghost Mode store's lock state.
        // - If ghost mode is enabled, this flips lockState to 'locked',
        //   which triggers AppLockGate to render the lock screen on top
        //   of the navigation tree before anything else paints.
        // - If ghost mode is disabled (default), lockState stays
        //   'disabled' and AppLockGate renders nothing.
        try {
          useGhostModeStore.getState().computeInitialLockState('cold_start');
        } catch (err) {
          // Never block app open on lock-state init failure
          if (__DEV__) console.warn('[Hydration] ghost lock init failed:', err);
        }

        // ─── Walkthrough cold-start reset (device-test #4) ──────────
        // Defensive: ensure no crashed-mid-tour state survives a
        // relaunch. Without this, if the app was killed while a
        // walkthrough step was active, the overlay could re-render on
        // cold start and appear "stuck" until the user tapped through
        // it. The store defaults to stepIndex=null on module init, so
        // this is only meaningful if a hot-reload / stale process left
        // it non-null — cheap belt-and-braces.
        try {
          const s = useWalkthroughStore.getState();
          if (s.stepIndex != null) s.skip();
        } catch (err) {
          if (__DEV__) console.warn('[Hydration] walkthrough reset failed:', err);
        }

        // ─── Beta Pioneer award (chunk 12) ────────────────────────
        //
        // Runs AFTER ghost-mode init so a panic-wipe sequence completes
        // before we try to award (post-wipe there's no user, the call
        // safely returns { awarded: false, reason: 'no_user' }).
        //
        // Fire-and-forget — never block first paint. The toast that
        // surfaces this lives in the tabs layout and reads from MMKV
        // independently, so it can show the celebration on the next
        // frame even though this awaits a few ms behind the scenes.
        try {
          const pioneerResult = await awardBetaPioneerIfNew();
          if (__DEV__) {
            if (pioneerResult.awarded) {
              console.log(
                '[Hydration] 🌱 Beta Pioneer badge newly awarded',
                pioneerResult
              );
            } else if (pioneerResult.reason) {
              console.log(
                `[Hydration] Beta Pioneer skipped (${pioneerResult.reason})`
              );
            }
          }
        } catch (err) {
          // Award failure is non-fatal — the badge can be awarded
          // on the next cold start. Don't block app open.
          if (__DEV__) console.warn('[Hydration] beta pioneer award failed:', err);
        }
      } catch (err) {
        // Hydration should NEVER block app open — log + continue.
        // Onboarding will rebuild state from scratch if needed.
        const message = err instanceof Error ? err.message : String(err);
        if (__DEV__) console.warn('[Hydration] failed:', message);
        if (!cancelled) setHydrationError(message);
      } finally {
        if (!cancelled) {
          setHydrated(true);
          // Always hide splash, even on error — better to show a screen
          // than to leave the user staring at the splash forever.
          try {
            await SplashScreen.hideAsync();
          } catch {
            /* hideAsync is a no-op if splash is already hidden */
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retryHydration = () => {
    setHydrationError(null);
    setHydrated(false);
    setAttempt((n) => n + 1);
  };

  // If the cold-start bootstrap hard-failed, show a warm, friendly
  // recovery screen instead of falling through to the navigation tree.
  // The old behavior hid the error (dev-only, opacity:0) and still
  // routed to /(tabs)/home on top of empty stores, which could crash
  // deep inside a screen that assumes a hydrated user. A calm "try
  // again" is a far better first impression than a red box.
  if (hydrationError && hydrated) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar style="dark" />
        <Text style={styles.errorEmoji}>🌸</Text>
        <Text style={styles.errorTitle}>Dottie hit a little snag</Text>
        <Text style={styles.errorBody}>
          Something didn't load quite right, but your data is safe. Let's
          try that again.
        </Text>
        <Pressable
          onPress={retryHydration}
          style={({ pressed }) => [
            styles.errorButton,
            pressed && styles.errorButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Try loading Dottie again"
        >
          <Text style={styles.errorButtonText}>Try again</Text>
        </Pressable>
        {__DEV__ && (
          <Text style={styles.errorDebug} selectable>
            {hydrationError}
          </Text>
        )}
      </View>
    );
  }

  // Hydration placeholder — sits BEHIND the splash. Device-test #5
  // owner ask: no cream flash on launch. Paint the aurora ground so the
  // seam between splash and app is invisible.
  if (!hydrated) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#0C0A16',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#54E6C8" />
      </View>
    );
  }

  return (
    // AuroraProvider (design-v2) holds the mood-driven palette + renders the
    // mood-reveal overlay app-wide. It only PROVIDES context — screens that
    // don't call useAurora() are unaffected, so this is safe to wrap now while
    // screens are themed one by one.
    <AuroraProvider>
      {/* Force a SOLID dark strip under the OS status bar on Android.
          Device-test #3 kept reporting the time/battery icons + the
          punch-hole camera cutout showing through the aurora bloom.
          `translucent={false}` + a solid `backgroundColor` gives the
          status bar its own opaque region that camera holes hide
          against and per-screen `<StatusBar style="light" />` overrides
          can only tweak the icon TINT — not the background. iOS
          ignores backgroundColor/translucent gracefully. */}
      <StatusBar style="light" backgroundColor="#0C0A16" translucent={false} />
      <ErrorBoundary>
      <Stack
        screenOptions={{
          headerShown: false,
          // Device-test #5: prevents cream flash between route transitions.
          contentStyle: { backgroundColor: '#0C0A16' },
          animation: 'slide_from_right',
        }}
      >
        {/* Index handles routing — no animation, no flash */}
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="(onboarding)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        {/* Deep route groups — each has its own warm-themed sub-stack */}
        <Stack.Screen name="(community)" />
        <Stack.Screen name="(sisterhood)" />
        <Stack.Screen name="(profile)" />
        {/* Modal flows — slide up from bottom, presented modally */}
        <Stack.Screen
          name="(modals)"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
      </ErrorBoundary>

      {/* Ghost Mode overlay — renders the lock screen or decoy app
          above the navigation tree when ghost mode is engaged.
          Renders nothing (zero cost) when ghost mode is disabled or
          the user is unlocked. */}
      <AppLockGate />
      <AppDialogHost />
      {/* First-run coach-mark tour. Renders null unless the walkthrough
          store has an active step, so it costs nothing for returning users.
          Auto-launch is triggered from the Home tab's mount effect, gated
          on Storage.walkthroughSeen; users can replay it any time from
          Profile → "Show me around again". */}
      <WalkthroughOverlay />
    </AuroraProvider>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: Colors.surface.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.screenPadding,
  },
  errorEmoji: {
    fontSize: 56,
    marginBottom: Spacing.lg,
  },
  errorTitle: {
    ...Typography.preset.h2,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  errorBody: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing['2xl'],
  },
  errorButton: {
    backgroundColor: Colors.primary.coral,
    paddingHorizontal: Spacing['3xl'],
    height: Spacing.buttonHeight.lg,
    borderRadius: Spacing.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.button,
  },
  errorButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  errorButtonText: {
    ...Typography.preset.button,
    color: Colors.text.inverse,
  },
  errorDebug: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
});
