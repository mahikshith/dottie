import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { Shadows } from '../../constants/shadows';
import type { PhaseKey } from '../../constants/colors';

/**
 * CelebrationSheet — The shared shell for every celebration moment.
 *
 * ─── WHY A SHARED PRIMITIVE ─────────────────────────────────────────
 *
 *  Streak milestones, level-ups, and daily recap moments all share the
 *  same visual grammar:
 *
 *      ┌──────────────────────────────────────┐
 *      │  (close)                             │
 *      │                                      │
 *      │   🦊 Luna is celebrating with you    │  ← companion line
 *      │                                      │
 *      │   ┌────────────────────────────┐    │
 *      │   │       (hero content)        │    │  ← children slot
 *      │   │   e.g. 🔥 7 day streak       │    │
 *      │   └────────────────────────────┘    │
 *      │                                      │
 *      │   "First week of showing up 💛"      │  ← optional message
 *      │                                      │
 *      │   [+10 XP] [+5 💎]                   │  ← optional reward row
 *      │                                      │
 *      │              [   Sweet   ]           │  ← primary CTA
 *      └──────────────────────────────────────┘
 *
 *  By owning all this chrome here, each route screen only declares its
 *  unique parts: which companion line to use, which hero element to
 *  render, what reward chips to show, what the CTA does.
 *
 * ─── PHASE-RESPONSIVE TINT ──────────────────────────────────────────
 *
 *  Background uses `Colors.phase[phase].light` so the sheet always
 *  feels coherent with the rest of the app (the streak modal opened
 *  during the menstrual phase glows soft rose; during the follicular
 *  phase it glows pale green). This is one of those tiny cohesions
 *  that makes the app feel alive.
 *
 * ─── ANIMATION ──────────────────────────────────────────────────────
 *
 *  The whole sheet fades + drifts up 16px on mount over 320ms. Children
 *  animate themselves (StreakFlame springs, MilestoneBanner is static)
 *  so we don't double-animate the same element.
 */

export interface CelebrationSheetProps {
  /** Phase to tint the sheet with — drives the soft background color. */
  phase: PhaseKey;
  /** The companion's display emoji (🦊, 🐰, etc). */
  companionEmoji: string;
  /** The companion's name (Luna, Pip, Dottie, etc). */
  companionName: string;
  /** Optional companion line — defaults to a warm generic celebration line. */
  companionLine?: string;
  /** The hero content (StreakFlame, MilestoneBanner, level badge, recap, etc). */
  children: React.ReactNode;
  /** Optional supporting message under the hero. */
  message?: string;
  /** Optional row of reward chips (XP / gems / etc) under the message. */
  rewards?: React.ReactNode;
  /** Primary CTA label. */
  ctaLabel: string;
  /** Primary CTA color (usually phaseColors.primary). */
  ctaColor?: string;
  /** Primary CTA handler. */
  onCtaPress: () => void;
  /** Close button handler (also called on backdrop tap in future polish). */
  onDismiss: () => void;
  /** Optional secondary text-button under the primary CTA. */
  secondaryAction?: {
    label: string;
    onPress: () => void;
  };
}

// ─── COMPONENT ──────────────────────────────────────────────────────

export function CelebrationSheet({
  phase,
  companionEmoji,
  companionName,
  companionLine,
  children,
  message,
  rewards,
  ctaLabel,
  ctaColor,
  onCtaPress,
  onDismiss,
  secondaryAction,
}: CelebrationSheetProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  const phaseColors = Colors.phase[phase];
  const accent = ctaColor ?? phaseColors.primary;

  const defaultCompanionLine = `${companionName} is celebrating with you ${companionEmoji}`;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: phaseColors.light }]}
      edges={['top', 'bottom']}
    >
      {/* Close affordance */}
      <View style={styles.header}>
        <Pressable
          onPress={onDismiss}
          style={({ pressed }) => [
            styles.closeButton,
            pressed && { opacity: 0.7 },
          ]}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={{
            opacity,
            transform: [{ translateY }],
          }}
        >
          {/* Companion line */}
          <Text style={styles.companionLine}>
            {companionLine ?? defaultCompanionLine}
          </Text>

          {/* Hero slot — owned by the caller */}
          <View style={styles.heroSlot}>{children}</View>

          {/* Optional message */}
          {message ? (
            <Text style={styles.message}>{message}</Text>
          ) : null}

          {/* Optional reward chip row */}
          {rewards ? (
            <View style={styles.rewardRow}>{rewards}</View>
          ) : null}
        </Animated.View>
      </ScrollView>

      {/* Sticky footer with CTA */}
      <View style={styles.footer}>
        <Pressable
          onPress={onCtaPress}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: accent },
            pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
          ]}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
        >
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </Pressable>

        {secondaryAction ? (
          <Pressable
            onPress={secondaryAction.onPress}
            style={({ pressed }) => [
              styles.secondaryAction,
              pressed && { opacity: 0.6 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={secondaryAction.label}
          >
            <Text style={[styles.secondaryText, { color: accent }]}>
              {secondaryAction.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

// ─── STYLES ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.sm,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  closeText: {
    fontSize: 16,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing['3xl'],
    alignItems: 'center',
  },
  companionLine: {
    ...Typography.preset.bodySemibold,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  heroSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  message: {
    ...Typography.preset.bodyLarge,
    color: Colors.text.primary,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  rewardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  footer: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  cta: {
    height: Spacing.buttonHeight.lg,
    borderRadius: Spacing.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md ?? Shadows.card,
  },
  ctaText: {
    ...Typography.preset.button,
    color: Colors.text.inverse,
  },
  secondaryAction: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  secondaryText: {
    ...Typography.preset.bodySemibold,
  },
});
