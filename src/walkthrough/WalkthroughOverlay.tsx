/**
 * Dottie — WalkthroughOverlay (design-v2 onboarding audit)
 *
 * A step-through coach-mark tour that lives at the app root and reads its
 * state from `useWalkthroughStore`. The overlay:
 *
 *   • Dims the screen (dark scrim, aurora-native — like the day sheet).
 *   • Renders a bottom card with the step's emoji + title + body + Skip
 *     / Next (last step = Done).
 *   • On each step, routes to the associated tab (owner call: step-through
 *     with Next, NOT auto-advance on tab tap — the overlay drives it).
 *   • Tap-outside the card doesn't dismiss (would be too easy to fat-finger
 *     while scrolling); Skip is always visible.
 *
 * ─── WHY NO SPOTLIGHT / MEASURE-LAYOUT ──────────────────────────────
 *
 *  A spotlight cut-out over a specific view means measuring the target's
 *  position at render time — brittle across screen sizes + tab-bar
 *  configurations, and the target may not even be mounted yet on the
 *  step's tab. We keep the copy explicit ("under You → Sisterhood") and
 *  route the user to the right tab, so the target is on-screen when they
 *  land. Cleaner, testable, and honours Reduce-Motion by default.
 *
 *  ⚠️ design-v2 / UNVERIFIED on device.
 */

import { StyleSheet, Text, View } from 'react-native';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { PressableScale } from '../components/ui';
import { A } from '../theme';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';
import { useWalkthroughStore, STEPS, selectWalkthroughStep } from './store';

export function WalkthroughOverlay(): JSX.Element | null {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const step = useWalkthroughStore(selectWalkthroughStep);
  const stepIndex = useWalkthroughStore((s) => s.stepIndex);
  const next = useWalkthroughStore((s) => s.next);
  const skip = useWalkthroughStore((s) => s.skip);

  // Route to the tab this step wants the user to see.
  useEffect(() => {
    if (step?.routeToTab) {
      try {
        router.push(step.routeToTab);
      } catch (err) {
        if (__DEV__) console.warn('[Walkthrough] route push failed:', err);
      }
    }
  }, [step, router]);

  if (!step || stepIndex == null) return null;

  const isLast = stepIndex + 1 >= STEPS.length;
  const stepNumber = stepIndex + 1;
  const totalSteps = STEPS.length;

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      exiting={FadeOut.duration(180)}
      style={styles.root}
      pointerEvents="box-none"
    >
      {/* Scrim — blocks taps on the app below the card, but the app is
          still visible and the tab bar remains tappable at the very
          bottom (the card doesn't cover it). */}
      <View style={styles.scrim} pointerEvents="auto" />

      {/* Coach-mark card — bottom-of-screen, above safe-area + tab bar */}
      <Animated.View
        entering={FadeInDown.duration(320).springify().damping(18)}
        style={[
          styles.card,
          {
            marginBottom: insets.bottom + Spacing['4xl'] + Spacing.md,
            borderColor: A.edge,
            backgroundColor: A.ground2,
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.emoji}>{step.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.meta}>Step {stepNumber} of {totalSteps}</Text>
          </View>
        </View>

        <Text style={styles.body}>{step.body}</Text>

        {/* Progress dots — silent visual of where they are */}
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === stepIndex ? A.accent : A.edge },
                i === stepIndex && { width: 18 },
              ]}
            />
          ))}
        </View>

        <View style={styles.actions}>
          <PressableScale
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              skip();
            }}
            haptic="none"
            scaleTo={0.96}
            style={styles.skipBtn}
            accessibilityRole="button"
            accessibilityLabel="Skip the tour"
          >
            <Text style={styles.skipText}>Skip</Text>
          </PressableScale>
          <PressableScale
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              next();
            }}
            haptic="none"
            scaleTo={0.96}
            style={styles.nextBtn}
            accessibilityRole="button"
            accessibilityLabel={isLast ? 'Finish tour' : 'Next step'}
          >
            <Text style={styles.nextText}>{isLast ? 'Done ✨' : 'Next ›'}</Text>
          </PressableScale>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  card: {
    marginHorizontal: Spacing.screenPadding,
    borderRadius: Spacing.radius['2xl'],
    borderWidth: 1,
    padding: Spacing.cardPaddingLarge,
    gap: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 36,
    elevation: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  emoji: { fontSize: 34 },
  title: { ...Typography.preset.h3, color: A.ink },
  meta: { ...Typography.preset.caption, color: A.ink3, marginTop: 2 },
  body: { ...Typography.preset.body, color: A.ink2, lineHeight: 22 },

  dots: {
    flexDirection: 'row',
    gap: 6,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },

  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skipBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  skipText: { ...Typography.preset.button, color: A.ink3 },
  nextBtn: {
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.xl,
    backgroundColor: A.accent,
    borderRadius: Spacing.radius.full,
  },
  nextText: { ...Typography.preset.button, color: A.ground },
});
