import { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { useUserStore, useCycleStore } from '../../src/stores';
import { awardBetaPioneerIfNew } from '../../src/services/beta-onboarding';
import { GradientButton, BreathingView, AuroraBackground } from '../../src/components/ui';
import { A } from '../../src/theme';

/**
 * Ready Screen — Onboarding complete celebration!
 *
 * ─── PREMIUM POLISH PASS (Phase 2) ──────────────────────────────────
 *
 *  - Staggered entrance choreography for the celebration mark, headline,
 *    subtitle and feature card (Reanimated `FadeInDown`, UI thread).
 *  - The 🎉 mark breathes gently (BreathingView) while the CTA is a
 *    gradient pill with spring press + loading state (GradientButton).
 *  - Safe-area insets replace fixed top/bottom padding.
 *
 * ─── BEHAVIOR (unchanged) ───────────────────────────────────────────
 *
 *  Tapping "Let's Go!":
 *    1. `completeOnboarding()` — reads the MMKV draft, creates the
 *       SQLite user row, companion_state, gamification_state, seeds the
 *       first period entry (if provided).
 *    2. Triggers an initial prediction via the cycle store.
 *    2.5 Awards the Beta Pioneer badge (idempotent) so the badge + toast
 *        fire on the very first Home landing, not a launch later.
 *    3. Navigates to /(tabs)/home via `replace` so back can't return
 *       to onboarding.
 *
 *  Pending-state (disabled + spinner) prevents double-tap; errors
 *  surface as a gentle alert and let the user retry without losing
 *  their draft.
 */
export default function ReadyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isCreating, setIsCreating] = useState(false);

  const handleStart = async () => {
    if (isCreating) return;
    setIsCreating(true);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    try {
      // 1. Create user, companion, gamification state — this also
      //    sets MMKV's hasOnboarded flag and currentUserId.
      await useUserStore.getState().completeOnboarding();

      // 2. Kick off the first prediction (will no-op if no period
      //    date was provided — prediction will run once one is logged).
      await useCycleStore.getState().refresh();
      await useCycleStore.getState().recomputePrediction();

      // 2.5 Award the Beta Pioneer badge NOW — right after the user row
      // exists — so the badge + celebration toast fire on the very first
      // Home landing. Previously this only ran during cold-start
      // hydration in _layout.tsx, where a brand-new user has no userId
      // yet, so the award silently no-op'd until the tester force-quit
      // and relaunched. The service is idempotent and self-guarding
      // (bails in non-beta builds / when already awarded), so calling it
      // here as well as in _layout is safe.
      try {
        await awardBetaPioneerIfNew();
      } catch (err) {
        // Non-fatal — the cold-start path in _layout.tsx will retry.
        if (__DEV__) console.warn('[Ready] beta pioneer award failed:', err);
      }

      // 3. Navigate to home (replace so back can't return to onboarding)
      router.replace('/(tabs)/home');
    } catch (err) {
      if (__DEV__) console.warn('[Ready] completeOnboarding failed:', err);

      Alert.alert(
        'Something went wrong',
        "I couldn't finish setting things up — but your answers are still saved. Want to try again?",
        [
          {
            text: 'Try Again',
            onPress: () => setIsCreating(false),
          },
        ]
      );
    }
  };

  return (
    <AuroraBackground>
      <StatusBar style="light" />
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + Spacing['2xl'],
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
      >
      <View style={styles.content}>
        <BreathingView maxScale={1.06}>
          <Animated.Text entering={rise(80)} style={styles.celebration}>
            🎉
          </Animated.Text>
        </BreathingView>

        <Animated.Text entering={rise(220)} style={styles.title}>
          You're all set!
        </Animated.Text>

        <Animated.Text entering={rise(340)} style={styles.subtitle}>
          Your companion is ready and waiting.{'\n'}
          Let's start this journey together!
        </Animated.Text>

        <Animated.View entering={rise(460)} style={styles.features}>
          <FeatureItem emoji="📊" text="Track your cycle & symptoms" />
          <FeatureItem emoji="🧠" text="Learn about your body" />
          <FeatureItem emoji="🔥" text="Build streaks & earn gems" />
          <FeatureItem emoji="🤝" text="Join a supportive community" />
        </Animated.View>
      </View>

      <Animated.View entering={rise(640)} style={styles.footer}>
        <GradientButton
          label="Let's Go! 🩷"
          onPress={handleStart}
          loading={isCreating}
          style={styles.button}
          accessibilityHint="Finishes setup and opens your home screen"
        />
      </Animated.View>
      </View>
    </AuroraBackground>
  );
}

// Shared stagger rhythm for the entrance choreography.
function rise(delayMs: number) {
  return FadeInDown.duration(600).delay(delayMs).springify().damping(16);
}

function FeatureItem({ emoji, text }: { emoji: string; text: string }) {
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureEmoji}>{emoji}</Text>
      <Text style={styles.featureText}>{text}</Text>
    </View>
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
    paddingTop: Spacing['3xl'],
  },
  celebration: {
    fontSize: 80,
    marginBottom: Spacing.xl,
    textAlign: 'center',
  },
  title: {
    ...Typography.preset.h1,
    color: A.ink,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  subtitle: {
    ...Typography.preset.bodyLarge,
    color: A.ink2,
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: Spacing['2xl'],
  },
  features: {
    alignSelf: 'stretch',
    gap: Spacing.md,
    backgroundColor: A.glass, borderColor: A.edge, borderWidth: 1,
    padding: Spacing.cardPaddingLarge,
    borderRadius: Spacing.radius['2xl'],
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 22, elevation: 6,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  featureEmoji: {
    fontSize: 24,
  },
  featureText: {
    ...Typography.preset.body,
    color: A.ink,
  },
  footer: {
    alignItems: 'center',
  },
  button: {
    width: '100%',
  },
});
