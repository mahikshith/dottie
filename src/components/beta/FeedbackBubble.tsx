/**
 * FeedbackBubble
 *
 * A small floating action button that lives in the bottom-right
 * corner of every tabbed screen during the beta period. Tap it →
 * navigate to /(modals)/beta-feedback.
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  - 56pt circular button (matches FAB conventions)
 *  - Gentle warm shadow (Shadows.floating) so it feels like it
 *    hovers above the page
 *  - Emoji-only — no text — keeps it unobtrusive
 *  - Pulses every 8 seconds (subtle, never aggressive) the first time
 *    a user lands on a tab without having ever opened feedback, so it
 *    gets noticed without nagging. Pulses STOP after the first send.
 *
 *  - Tap → soft scale + haptic + navigation
 *  - Long-press → optional "dismiss for today" affordance (future)
 *
 * ─── POSITIONING ────────────────────────────────────────────────────
 *
 *  Renders inside an absolute-positioned wrapper anchored to the
 *  bottom-right with safe-area padding + tab bar offset. The bubble
 *  sits 20pt above the tab bar so it never overlaps a tab label.
 *
 *  Wrapper uses pointerEvents="box-none" so taps outside the bubble
 *  pass through to whatever is underneath (the tab content).
 *
 * ─── WHO MOUNTS THIS ────────────────────────────────────────────────
 *
 *  Mounted by app/(tabs)/_layout.tsx (Batch D) so it appears on
 *  Home, Calendar, Learn, Community, and Profile — but NOT during
 *  onboarding, modals, or the lock screen.
 *
 *  We deliberately keep this component free of routing logic so it
 *  can be tested in isolation. The route push happens via the
 *  router prop's `onPress` handler the wrapper supplies.
 */

import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { Shadows } from '../../constants/shadows';
import {
  useBetaFeedbackStore,
  selectFeedbackHistoryCount,
  useUserStore,
  selectCompanionType,
} from '../../stores';
import { getCompanion } from '../../content/companions';

// ─── PROPS ───────────────────────────────────────────────────────────

interface FeedbackBubbleProps {
  /** Called when the user taps the bubble (navigate, open overlay, etc.). */
  onPress: () => void;
  /**
   * Optional override: hide the bubble entirely. Caller decides this
   * (e.g., hide on the onboarding stack, on the lock screen).
   * Defaults to true (visible).
   */
  visible?: boolean;
  /**
   * Extra bottom offset (pt) above whatever the safe-area bottom
   * inset already provides. Pass tab bar height when mounted inside
   * the tabs layout so the bubble doesn't sit on top of tab labels.
   */
  bottomOffset?: number;
}

// ─── COMPONENT ───────────────────────────────────────────────────────

export function FeedbackBubble({
  onPress,
  visible = true,
  bottomOffset = 0,
}: FeedbackBubbleProps) {
  const insets = useSafeAreaInsets();
  const companionType = useUserStore(selectCompanionType);
  const companion = getCompanion(companionType);
  const historyCount = useBetaFeedbackStore(selectFeedbackHistoryCount);

  // Pulse animation — only when the user has never given feedback yet.
  // This is the gentle "hey, this exists!" nudge. Stops the moment they
  // send their first one.
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (historyCount > 0) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(6000),
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 600,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [historyCount, pulse]);

  if (!visible) return null;

  const handlePress = () => {
    Haptics.selectionAsync().catch(() => {});
    onPress();
  };

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          bottom: insets.bottom + bottomOffset + Spacing.lg,
          right: insets.right + Spacing.base,
        },
      ]}
    >
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <Pressable
          onPress={handlePress}
          style={({ pressed }) => [
            styles.bubble,
            { backgroundColor: companion.accentColor },
            pressed && styles.bubblePressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Send feedback to the Dottie team"
          accessibilityHint="Opens a small form to share what's working and what isn't"
          hitSlop={6}
        >
          <Text style={styles.bubbleEmoji}>💌</Text>
          {historyCount === 0 ? (
            <View style={styles.newDot} />
          ) : null}
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    // bottom + right are set inline above so the safe-area inset can
    // be combined with the caller's bottomOffset.
  },
  bubble: {
    width: 52,
    height: 52,
    borderRadius: Spacing.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.floating,
  },
  bubblePressed: {
    transform: [{ scale: 0.94 }],
    opacity: 0.92,
  },
  bubbleEmoji: {
    fontSize: 24,
  },
  // Tiny "new" indicator dot — only shown for the user's first time
  newDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.semantic.warning,
    borderWidth: 2,
    borderColor: Colors.surface.card,
  },
});

// Typography import kept for parity with other components even though
// the bubble itself uses only emoji. (Future variants may add a label.)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _typographyKeepAliveForLinter = Typography;
