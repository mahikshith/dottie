/**
 * GhostLockBody
 *
 * The actual UI of the Ghost Mode lock screen. Decoupled from
 * Expo Router so it can be rendered in TWO contexts:
 *
 *   1. As a full-screen overlay via AppLockGate (default usage —
 *      this is how users actually see it).
 *
 *   2. As a route screen at /(modals)/ghost-lock (for completeness
 *      and future deep-linking; the route file is a thin wrapper
 *      that sets Stack.Screen options and renders this body).
 *
 * ─── WHY THIS SHAPE ─────────────────────────────────────────────────
 *
 *  React Native screens that need router context (useRouter,
 *  Stack.Screen children, etc.) must NOT be imported from outside
 *  the `app/` tree — Expo Router won't give them router context.
 *
 *  This component owns all the LOGIC + UI but uses zero router APIs.
 *  It's a pure React component that takes only what it needs from
 *  the ghost-mode store. That makes it safe to mount anywhere.
 *
 * ─── PRIVACY-FIRST COPY ─────────────────────────────────────────────
 *
 *  When `disguiseAppName` is on (default), this screen poses as
 *  "Garden Notes" — a friendly plant journaling app. A snooper sees
 *  what looks like a generic notes app lock, not a period tracker.
 *
 *  When `disguiseAppName` is off, the user sees "Welcome back, friend"
 *  with Dottie branding. This is for users who DON'T need disguise
 *  but still want PIN protection (e.g., shared work phones).
 *
 * ─── BEHAVIOR ───────────────────────────────────────────────────────
 *
 *  - Auto-submits when 4 digits entered (no submit button)
 *  - Wrong PIN: shake + error message + decoy route (if configured)
 *  - 5 wrong attempts: 30s cooldown with countdown text
 *  - Panic PIN entered: silently wipes (if enabled) + drops to decoy
 *
 *  The user CANNOT escape this screen with a swipe. When mounted by
 *  AppLockGate the gate's pointerEvents='auto' catches everything.
 *  When mounted as a route, the wrapper sets gestureEnabled=false.
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { AuroraBackground } from '../ui';
import { A } from '../../theme';
import { PinPad } from './PinPad';
import {
  useGhostModeStore,
  selectDisguiseAppName,
  selectCooldownEndsAt,
  selectFailedAttempts,
} from '../../security/ghost-mode-store';
import {
  COOLDOWN_MS,
  MIN_PIN_LENGTH,
  VerifyPinResult,
} from '../../types/ghost-mode.types';

// ─── COMPONENT ───────────────────────────────────────────────────────

export function GhostLockBody() {
  // Disguise: is the lock screen pretending to be Garden Notes?
  // Subscribe via the store selector so this refreshes the instant
  // the user flips the toggle in settings.
  const disguise = useGhostModeStore(selectDisguiseAppName);

  // PIN input state
  const [pin, setPin] = useState('');
  const [errorKey, setErrorKey] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState(0);
  const cooldownEndsAt = useGhostModeStore(selectCooldownEndsAt);
  const failedAttempts = useGhostModeStore(selectFailedAttempts);

  // ─── Cooldown countdown ─────────────────────────────────────────
  useEffect(() => {
    if (cooldownEndsAt === null) {
      setCooldownRemainingMs(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, cooldownEndsAt - Date.now());
      setCooldownRemainingMs(remaining);
      if (remaining === 0) {
        // Cooldown done — clear error so the user can try again
        setErrorMessage(null);
      }
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [cooldownEndsAt]);

  // ─── PIN submission ─────────────────────────────────────────────
  const handleSubmit = (typedPin: string) => {
    const result: VerifyPinResult = useGhostModeStore.getState().verifyPin(typedPin);
    if (result.ok) {
      // Either real PIN (lockState → unlocked) or panic PIN (→ decoy).
      // The gate sees the lockState change and dismisses this body.
      // We clear local state for next time.
      setPin('');
      setErrorMessage(null);
      return;
    }

    // Failed — clear PIN, shake, message
    setPin('');
    setErrorKey((k) => k + 1);

    if (result.reason === 'in_cooldown') {
      setErrorMessage(formatCooldownMessage(result.cooldownUntil));
      return;
    }

    // wrong_pin
    if (result.attemptsRemaining > 0) {
      setErrorMessage(
        result.attemptsRemaining === 1
          ? '1 attempt left'
          : `${result.attemptsRemaining} attempts left`
      );
    } else {
      setErrorMessage(`Too many tries — wait ${Math.ceil(COOLDOWN_MS / 1000)}s`);
    }
  };

  // ─── Copy (disguise-aware) ──────────────────────────────────────
  const headerEmoji = disguise ? '🌿' : '🌸';
  const headerTitle = disguise ? 'Garden Notes' : 'Welcome back, friend';
  const headerSubtitle = disguise
    ? 'Your private plant journal'
    : 'Enter your PIN to continue';

  const isInCooldown = cooldownRemainingMs > 0;
  const cooldownSeconds = Math.ceil(cooldownRemainingMs / 1000);

  // Device-test feedback: the non-disguise 'Welcome back, friend' PIN
  // screen was still using the classic cream palette — jarring against
  // the rest of the aurora-themed app. When disguise is OFF we render
  // over an AuroraBackground with dark tokens; when disguise is ON we
  // KEEP the cream Garden Notes look (a snooper must NOT see anything
  // hinting at Dottie's real aesthetic).
  const inner = (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>{headerEmoji}</Text>
        <Text
          style={[
            styles.headerTitle,
            { color: disguise ? Colors.text.primary : A.ink },
          ]}
        >
          {headerTitle}
        </Text>
        <Text
          style={[
            styles.headerSubtitle,
            { color: disguise ? Colors.text.secondary : A.ink2 },
          ]}
        >
          {headerSubtitle}
        </Text>
      </View>

      <View style={styles.pinSection}>
        <PinPad
          value={pin}
          onChange={setPin}
          onSubmit={handleSubmit}
          length={MIN_PIN_LENGTH}
          errorKey={errorKey}
          disabled={isInCooldown}
          theme={disguise ? 'cream' : 'aurora'}
          errorMessage={
            isInCooldown
              ? `Wait ${cooldownSeconds}s before trying again`
              : errorMessage ?? undefined
          }
          helperText={
            failedAttempts > 0 && !errorMessage && !isInCooldown
              ? undefined
              : undefined
          }
        />
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={() => useGhostModeStore.getState().enterDecoy()}
          hitSlop={12}
          style={({ pressed }) => [pressed && styles.footerLinkPressed]}
          accessibilityRole="button"
          accessibilityLabel={
            disguise ? 'Skip and view plant journal' : 'Forgot PIN'
          }
        >
          <Text
            style={[
              styles.footerLink,
              { color: disguise ? Colors.text.tertiary : A.ink3 },
            ]}
          >
            {disguise ? 'Skip · view notes' : 'Forgot PIN?'}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  if (disguise) {
    return <SafeAreaView style={styles.safeArea}>{inner}</SafeAreaView>;
  }
  return (
    <AuroraBackground>
      <SafeAreaView style={[styles.safeArea, { backgroundColor: 'transparent' }]}>
        {inner}
      </SafeAreaView>
    </AuroraBackground>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────

function formatCooldownMessage(cooldownUntilIso: string | null): string {
  if (!cooldownUntilIso) return 'Please wait';
  const ms = Math.max(0, new Date(cooldownUntilIso).getTime() - Date.now());
  return `Wait ${Math.ceil(ms / 1000)}s before trying again`;
}

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface.background,
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing['3xl'],
    paddingBottom: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  headerEmoji: {
    fontSize: 56,
    marginBottom: Spacing.sm,
  },
  headerTitle: {
    ...Typography.preset.h2,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  headerSubtitle: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  pinSection: {
    alignItems: 'center',
    gap: Spacing.lg,
  },
  footer: {
    alignItems: 'center',
  },
  footerLink: {
    ...Typography.preset.bodySemibold,
    color: Colors.text.tertiary,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  footerLinkPressed: {
    opacity: 0.6,
  },
});
