import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { Storage } from '../../src/database/storage';
import { GradientButton, BreathingView, AuroraBackground } from '../../src/components/ui';
import { A } from '../../src/theme';

/**
 * Welcome Screen — First thing users see.
 *
 * ─── PREMIUM POLISH PASS (Phase 2) ──────────────────────────────────
 *
 *  This is the app's first frame after the splash, so it carries the
 *  most weight for "does this feel premium?". Changes:
 *
 *   - Staggered entrance: the mascot, headline, subtitle, tagline and
 *     CTA fade+rise in sequence (Reanimated `FadeInDown`, UI thread) so
 *     the screen assembles itself with intent instead of snapping in.
 *   - The companion mascot gently "breathes" (BreathingView) so it
 *     reads as a living companion from second one.
 *   - The CTA is now a gradient pill with a lift shadow + spring press
 *     (GradientButton) instead of a flat coral rectangle.
 *   - Real safe-area insets replace a fixed top padding so the layout
 *     sits correctly under the notch / Dynamic Island on every device.
 *
 *  All motion honors "Reduce Motion" via the shared primitives.
 *
 * ─── BEHAVIOR (unchanged) ───────────────────────────────────────────
 *
 *  Tapping the CTA ensures the MMKV onboarding draft exists (idempotent;
 *  the layout also does this) and pushes to mode-select. No store
 *  mutation here — this screen just sets the tone and hands off.
 */

// Small helper to keep the stagger rhythm readable + consistent.
const RISE = (delayMs: number) =>
  FadeInDown.duration(600).delay(delayMs).springify().damping(16);

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleStart = () => {
    // Soft buttery tap feedback — sets the "joyful" tone immediately.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    // Ensure draft exists (idempotent — layout also does this).
    if (!Storage.onboardingDraft.get()) {
      Storage.onboardingDraft.set({
        startedAt: new Date().toISOString(),
      });
    }

    router.push('/(onboarding)/mode-select');
  };

  return (
    <AuroraBackground>
      <StatusBar style="light" />
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + Spacing['3xl'],
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
      <View style={styles.content}>
        <BreathingView>
          <Animated.Text entering={RISE(100)} style={styles.companionEmoji}>
            🩷
          </Animated.Text>
        </BreathingView>

        <Animated.Text entering={RISE(240)} style={styles.title}>
          Hey! I'm Dottie
        </Animated.Text>

        <Animated.Text entering={RISE(360)} style={styles.subtitle}>
          Your cheerful cycle companion.{'\n'}
          I'll help you understand your body,{'\n'}
          track your health, and celebrate every day.
        </Animated.Text>

        <Animated.Text entering={RISE(480)} style={styles.tagline}>
          No judgment. No anxiety. Just you & me. ✨
        </Animated.Text>
      </View>

      <Animated.View entering={FadeInDown.duration(600).delay(640).springify().damping(16)} style={styles.footer}>
        <GradientButton
          label="Let's Get Started!"
          onPress={handleStart}
          style={styles.button}
          accessibilityHint="Begins setting up your Dottie companion"
        />

        <Animated.Text entering={FadeIn.duration(500).delay(900)} style={styles.privacy}>
          100% private. Your data stays on your device. 🔒
        </Animated.Text>
      </Animated.View>
      </View>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: Spacing.screenPadding,
    justifyContent: 'space-between',
  },
  content: {
    alignItems: 'center',
    paddingTop: Spacing['4xl'],
  },
  companionEmoji: {
    fontSize: 80,
    marginBottom: Spacing['2xl'],
    textAlign: 'center',
  },
  title: {
    ...Typography.preset.h1,
    color: A.ink,
    textAlign: 'center',
    marginBottom: Spacing.base,
  },
  subtitle: {
    ...Typography.preset.bodyLarge,
    color: A.ink2,
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: Spacing.xl,
  },
  tagline: {
    ...Typography.preset.bodySemibold,
    color: A.accent,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
  },
  button: {
    width: '100%',
  },
  privacy: {
    ...Typography.preset.caption,
    color: A.ink3,
    textAlign: 'center',
    marginTop: Spacing.base,
  },
});
