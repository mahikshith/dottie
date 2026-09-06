import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { Storage } from '../../src/database/storage';
import { GradientButton, BreathingView, AuroraBackground, CompanionLottie } from '../../src/components/ui';
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

/**
 * The three claims. Short title, one plain line under it — no marketing verbs,
 * because the point is that a sceptical person can verify each one.
 */
const CLAIMS: readonly { glyph: string; title: string; line: string }[] = [
  { glyph: '📱', title: '100% on device', line: 'Your logs live in this phone\u2019s own storage. There is no server.' },
  { glyph: '🙅', title: 'No account, ever', line: 'No email, no sign-up, nothing to leak.' },
  { glyph: '✈️', title: 'Works in airplane mode', line: 'Every screen works with the internet switched off.' },
];

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
          <Animated.View entering={RISE(100)} style={styles.companion}>
            {/* The drawn rig, not an emoji (rule 8). This screen had a 🩷
                glyph — the very first thing anyone saw of Dottie was a
                character we don't draw. */}
            <CompanionLottie type="fox" state="happy" size={128} />
          </Animated.View>
        </BreathingView>

        <Animated.Text entering={RISE(240)} style={styles.title}>
          Hey! I'm Dottie
        </Animated.Text>

        <Animated.Text entering={RISE(360)} style={styles.subtitle}>
          Your cycle companion — and everything you log{'\n'}
          stays on this phone.
        </Animated.Text>

        {/* ─── THE THREE CLAIMS (device-test-27) ───────────────────
            Owner: "why can't we add it to the first screen — hey, this is
            Dottie, fast, secure, 100% on device — right above Let's get
            started?" Better than my first idea, which was to put it on the
            cold-start splash: that flashes past in a second or two and
            nobody reads it. Here it has room, and it is the question every
            person downloading a period tracker in 2026 is actually asking.

            Every line is TRUE and checkable:
              · on-device   SQLite + MMKV on the handset, no backend exists
              · no account  there is no sign-up anywhere in the app
              · offline     nothing on the critical path makes a network call
            If any of that stops being true, this block changes first. */}
        <Animated.View entering={RISE(470)} style={styles.trust}>
          {CLAIMS.map((c) => (
            <View key={c.title} style={styles.claim}>
              <View style={styles.claimIcon}>
                <Text style={styles.claimGlyph}>{c.glyph}</Text>
              </View>
              <View style={styles.claimBody}>
                <Text style={styles.claimTitle}>{c.title}</Text>
                <Text style={styles.claimLine}>{c.line}</Text>
              </View>
            </View>
          ))}
        </Animated.View>
      </View>

      <Animated.View entering={FadeInDown.duration(600).delay(700).springify().damping(16)} style={styles.footer}>
        <GradientButton
          label="Let's Get Started!"
          onPress={handleStart}
          style={styles.button}
          accessibilityHint="Begins setting up your Dottie companion"
        />

        <Animated.Text entering={FadeIn.duration(500).delay(940)} style={styles.privacy}>
          No judgment, no anxiety, no cloud. Just you & me. ✨
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
    paddingTop: Spacing.xl,
    width: '100%',
  },
  companion: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
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
    lineHeight: 26,
    marginBottom: Spacing.xl,
  },
  // The claims are a LIST, not three cards: one glass panel, three rows,
  // aligned glyphs. Three separate cards on a first screen reads as an advert;
  // one quiet panel reads as a fact sheet.
  trust: {
    width: '100%',
    gap: Spacing.base,
    padding: Spacing.base,
    borderRadius: Spacing.radius.xl,
    borderWidth: 1,
    borderColor: A.glass2,
    backgroundColor: A.glass,
  },
  claim: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  claimIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${A.accent}1A`,
    borderWidth: 1,
    borderColor: `${A.accent}33`,
  },
  claimGlyph: { fontSize: 16 },
  claimBody: { flex: 1, gap: 1 },
  claimTitle: { ...Typography.preset.bodySemibold, color: A.ink },
  claimLine: { ...Typography.preset.caption, color: A.ink3, lineHeight: 17 },
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
