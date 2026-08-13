/**
 * BetaPioneerToast
 *
 * One-time celebration that appears at the top of the tabs the FIRST
 * time the user lands after the Beta Pioneer badge was awarded.
 *
 * ─── DETECTION ──────────────────────────────────────────────────────
 *
 *  We read `Storage.betaPioneerAwardedAt` (set by the beta-onboarding
 *  service after a successful award) and compare against a session-
 *  scoped "have we shown this yet?" flag in a tiny module-local set.
 *
 *  The flag in MMKV says "the badge HAS BEEN AWARDED in this install".
 *  The set in memory says "we've ALREADY SHOWN the toast this session".
 *
 *  Together they give us: "celebrate once per install on the very
 *  first tab landing post-award."
 *
 * ─── WHY NOT A STORE ────────────────────────────────────────────────
 *
 *  This is one-shot UI state, not app state. A Zustand store would be
 *  overkill — the module-local set is sufficient and survives the
 *  component being unmounted+remounted (e.g., on tab navigation).
 *
 *  The set resets on app cold start, which is what we want: a fresh
 *  session can show the toast once (but only if MMKV's flag is still
 *  fresh enough — see freshness check below).
 *
 * ─── FRESHNESS ──────────────────────────────────────────────────────
 *
 *  We only show the toast within ~10 MINUTES of the award. If the
 *  user closed the app right after the award and reopened the next
 *  day, we don't surprise them with stale confetti.
 *
 *  After 10 min, the badge stays visible in Profile (forever) but the
 *  toast stays silent.
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  Slides down from the top of the screen, sits for ~4 seconds, then
 *  slides back up. Tap → dismisses early. Tap-and-hold → no-op (we
 *  don't want long-press accidents to do anything destructive).
 *
 *  Background is the user's companion accent color so it feels
 *  personal. Foreground text + emoji are white for contrast.
 */

import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { Shadows } from '../../constants/shadows';
import { Storage } from '../../database/storage';
import {
  IS_BETA_BUILD,
  BETA_PIONEER_BADGE_DISPLAY,
} from '../../constants/build-info';
import { useUserStore, selectCompanionType } from '../../stores';
import { getCompanion } from '../../content/companions';

// ─── MODULE-LOCAL "ALREADY SHOWN" FLAG ───────────────────────────────
//
// Survives component remounts within the same session but resets on
// cold start. That's exactly what we want.
let shownThisSession = false;

// ─── FRESHNESS WINDOW ────────────────────────────────────────────────
//
// How long after the award we're still willing to surface the toast.
// Long enough to cover "user got it, backgrounded the app, came back
// the same minute" — short enough that yesterday's award doesn't
// surprise them today.
const TOAST_FRESH_MS = 10 * 60 * 1000; // 10 minutes
const TOAST_VISIBLE_MS = 4500;          // how long the toast stays up

// ─── COMPONENT ───────────────────────────────────────────────────────

export function BetaPioneerToast() {
  const insets = useSafeAreaInsets();
  const companionType = useUserStore(selectCompanionType);
  const companion = getCompanion(companionType);

  // Whether the toast is currently visible (controls render + animation)
  const [visible, setVisible] = useState(false);

  // Animated values for slide + opacity
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // ─── Decide whether to show on mount ────────────────────────────
  useEffect(() => {
    if (!IS_BETA_BUILD) return;
    if (shownThisSession) return;

    const awardedAtIso = Storage.betaPioneerAwardedAt.get();
    if (!awardedAtIso) return;

    const awardedAt = new Date(awardedAtIso).getTime();
    if (Number.isNaN(awardedAt)) return;

    const ageMs = Date.now() - awardedAt;
    if (ageMs > TOAST_FRESH_MS) return;
    if (ageMs < 0) return; // Clock skew — be conservative

    // Eligible! Mark shown and bring it on screen.
    shownThisSession = true;
    setVisible(true);
  }, []);

  // ─── Animation lifecycle ────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;

    // Slide in
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Soft success haptic the instant the toast is fully on screen.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    });

    // Auto-dismiss after the visible window
    const dismissTimer = setTimeout(() => {
      dismiss();
    }, TOAST_VISIBLE_MS);

    return () => clearTimeout(dismissTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 280,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
    });
  };

  if (!visible) return null;

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        { paddingTop: insets.top + Spacing.sm },
      ]}
    >
      <Animated.View
        style={[
          styles.toastShell,
          {
            transform: [{ translateY }],
            opacity,
          },
        ]}
      >
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            dismiss();
          }}
          style={({ pressed }) => [
            styles.toast,
            { backgroundColor: companion.accentColor },
            pressed && { opacity: 0.92 },
          ]}
          accessibilityRole="alert"
          accessibilityLabel={`Beta Pioneer badge unlocked. ${BETA_PIONEER_BADGE_DISPLAY.description}`}
          accessibilityHint="Tap to dismiss"
        >
          <Text style={styles.emoji}>{BETA_PIONEER_BADGE_DISPLAY.emoji}</Text>
          <View style={styles.textWrap}>
            <Text style={styles.title} numberOfLines={1}>
              {`${BETA_PIONEER_BADGE_DISPLAY.name} unlocked!`}
            </Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              {BETA_PIONEER_BADGE_DISPLAY.description}
            </Text>
          </View>
          <Text style={styles.rewards}>
            {`+${BETA_PIONEER_BADGE_DISPLAY.bonusXp} ⭐ +${BETA_PIONEER_BADGE_DISPLAY.bonusGems} 💎`}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.base,
  },
  toastShell: {
    // Wrapper around the Pressable so we can animate transform +
    // opacity together without fighting Pressable's pressed style.
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderRadius: Spacing.radius['2xl'],
    gap: Spacing.md,
    ...Shadows.floating,
  },
  emoji: {
    fontSize: 30,
  },
  textWrap: {
    flex: 1,
    minWidth: 0, // allow ellipsis on long companion names
  },
  title: {
    ...Typography.preset.bodySemibold,
    color: Colors.text.inverse,
  },
  subtitle: {
    ...Typography.preset.caption,
    color: 'rgba(255, 255, 255, 0.88)',
    marginTop: 2,
  },
  rewards: {
    ...Typography.preset.captionBold,
    color: Colors.text.inverse,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Spacing.radius.full,
    overflow: 'hidden',
    fontVariant: ['tabular-nums'],
  },
});
