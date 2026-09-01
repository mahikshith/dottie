import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { AuroraBackground, GradientButton, PressableScale } from '../../src/components/ui';
import { A } from '../../src/theme';
import { Storage } from '../../src/database/storage';
import { DEFAULT_REMINDER_PREFS, type ReminderTime } from '../../src/database/storage';

/**
 * Onboarding — Reminders Opt-In (design-v2 onboarding audit)
 *
 * Owner call: Flo asks up-front, we do too — notifications are the
 * retention lever. Every toggle is off by default; the permission
 * prompt only fires when `completeOnboarding` runs the scheduler
 * (see useUserStore.ts). Skip is a first-class action — reminders
 * stay off and the user can enable any time from Profile → Reminders.
 *
 *  ⚠️ design-v2 / UNVERIFIED on device — expo-notifications needs a
 *  dev build to actually deliver, but the persistence + scheduler
 *  call are safe on any build.
 */

const TIME_LABELS: Record<ReminderTime, { emoji: string; label: string; hint: string }> = {
  morning: { emoji: '🌅', label: 'Morning', hint: '9 am' },
  midday:  { emoji: '☀️', label: 'Midday',  hint: '1 pm' },
  evening: { emoji: '🌙', label: 'Evening', hint: '8 pm' },
};

export default function OnboardingRemindersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [checkIn, setCheckIn] = useState<boolean>(DEFAULT_REMINDER_PREFS.checkIn);
  const [checkInTime, setCheckInTime] = useState<ReminderTime>(DEFAULT_REMINDER_PREFS.checkInTime);
  const [periodHeadsUp, setPeriodHeadsUp] = useState<boolean>(DEFAULT_REMINDER_PREFS.periodHeadsUp);
  const [hydration, setHydration] = useState<boolean>(DEFAULT_REMINDER_PREFS.hydration);

  const persistAndAdvance = (opts: { anyOn: boolean }) => {
    if (opts.anyOn) {
      Storage.onboardingDraft.merge({
        reminderPrefs: { checkIn, checkInTime, periodHeadsUp, hydration },
      });
    } else {
      Storage.onboardingDraft.merge({ reminderPrefs: undefined });
    }
    router.push('/(onboarding)/ready');
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    persistAndAdvance({ anyOn: checkIn || periodHeadsUp || hydration });
  };

  const handleSkip = () => {
    Haptics.selectionAsync().catch(() => {});
    persistAndAdvance({ anyOn: false });
  };

  return (
    <AuroraBackground>
      <StatusBar style="light" />
      <View style={[styles.container, { paddingTop: insets.top + Spacing['2xl'] }]}>
        <Animated.View entering={FadeInDown.duration(480).delay(80).springify().damping(16)} style={styles.header}>
          <Text style={styles.title}>Nudges from me? 🔔</Text>
          <Text style={styles.subtitle}>
            Optional and gentle. All private — reminders live on your device.
          </Text>
        </Animated.View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(420).delay(140).springify().damping(16)}>
            <ToggleRow
              emoji="💛"
              label="Nudge me to check in"
              hint="A soft tap once a day so patterns start to emerge"
              value={checkIn}
              onToggle={() => {
                Haptics.selectionAsync().catch(() => {});
                setCheckIn((v) => !v);
              }}
            />
          </Animated.View>

          {checkIn && (
            <Animated.View entering={FadeInDown.duration(360).springify().damping(18)}>
              <Text style={styles.subLabel}>When?</Text>
              <View style={styles.timeRow}>
                {(Object.keys(TIME_LABELS) as ReminderTime[]).map((t) => {
                  const active = checkInTime === t;
                  const { emoji, label, hint } = TIME_LABELS[t];
                  return (
                    <PressableScale
                      key={t}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setCheckInTime(t);
                      }}
                      haptic="none"
                      scaleTo={0.94}
                      style={[styles.timeChip, active && styles.timeChipActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${label}, ${hint}`}
                    >
                      <Text style={styles.timeEmoji}>{emoji}</Text>
                      <Text style={[styles.timeLabel, active && styles.timeLabelActive]}>{label}</Text>
                      <Text style={[styles.timeHint, active && styles.timeHintActive]}>{hint}</Text>
                    </PressableScale>
                  );
                })}
              </View>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.duration(420).delay(220).springify().damping(16)}>
            <ToggleRow
              emoji="🩸"
              label="Heads-up before my period"
              hint="A gentle reminder about 2 days before"
              value={periodHeadsUp}
              onToggle={() => {
                Haptics.selectionAsync().catch(() => {});
                setPeriodHeadsUp((v) => !v);
              }}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(420).delay(300).springify().damping(16)}>
            <ToggleRow
              emoji="💧"
              label="Sip some water"
              hint="A midday hydration nudge"
              value={hydration}
              onToggle={() => {
                Haptics.selectionAsync().catch(() => {});
                setHydration((v) => !v);
              }}
            />
          </Animated.View>

          <Pressable onPress={handleSkip} style={styles.skipRow} accessibilityRole="button">
            <Text style={styles.skipText}>Skip — I'll turn these on later ✨</Text>
          </Pressable>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.xl }]}>
          <GradientButton
            label="Continue"
            onPress={handleContinue}
            accessibilityHint="Saves your reminder choices"
          />
        </View>
      </View>
    </AuroraBackground>
  );
}

function ToggleRow({
  emoji,
  label,
  hint,
  value,
  onToggle,
}: {
  emoji: string;
  label: string;
  hint: string;
  value: boolean;
  onToggle: () => void;
}): JSX.Element {
  return (
    <PressableScale
      onPress={onToggle}
      haptic="none"
      scaleTo={0.98}
      style={[styles.row, value && styles.rowActive]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
    >
      <Text style={styles.rowEmoji}>{emoji}</Text>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowHint}>{hint}</Text>
      </View>
      <View style={[styles.track, value && styles.trackOn]}>
        <View style={[styles.thumb, value && styles.thumbOn]} />
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: Spacing.screenPadding,
  },
  header: { marginBottom: Spacing.lg },
  title: { ...Typography.preset.h2, color: A.ink, marginBottom: Spacing.sm },
  subtitle: { ...Typography.preset.body, color: A.ink2, lineHeight: 22 },

  scroll: { flex: 1 },
  scrollContent: { paddingTop: Spacing.sm, paddingBottom: Spacing.lg, gap: Spacing.sm },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: A.glass,
    borderColor: A.edge,
    borderWidth: 1,
    padding: Spacing.md,
    borderRadius: Spacing.radius.xl,
    gap: Spacing.md,
  },
  rowActive: {
    backgroundColor: `${A.accent}18`,
    borderColor: `${A.accent}70`,
  },
  rowEmoji: { fontSize: 24 },
  rowText: { flex: 1 },
  rowLabel: { ...Typography.preset.bodySemibold, color: A.ink },
  rowHint: { ...Typography.preset.caption, color: A.ink3, marginTop: 2, lineHeight: 16 },

  track: {
    width: 44, height: 26, borderRadius: 13,
    backgroundColor: A.edge, padding: 2, justifyContent: 'center',
  },
  trackOn: { backgroundColor: A.accent },
  thumb: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: A.glass, borderColor: A.edge, borderWidth: 1,
  },
  thumbOn: { transform: [{ translateX: 18 }] },

  subLabel: { ...Typography.preset.overline, color: A.ink3, marginTop: Spacing.sm, marginBottom: Spacing.xs },
  timeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xs },
  timeChip: {
    flex: 1,
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: Spacing.radius.lg,
    borderWidth: 1,
    borderColor: A.edge,
    backgroundColor: A.glass,
  },
  timeChipActive: { backgroundColor: A.accent, borderColor: A.accent },
  timeEmoji: { fontSize: 18 },
  timeLabel: { ...Typography.preset.captionBold, color: A.ink, marginTop: 2 },
  timeLabelActive: { color: A.ground },
  timeHint: { ...Typography.preset.caption, fontSize: 10, color: A.ink3, marginTop: 1 },
  timeHintActive: { color: A.ground, opacity: 0.85 },

  skipRow: { alignItems: 'center', paddingVertical: Spacing.md, marginTop: Spacing.xs },
  skipText: { ...Typography.preset.caption, color: A.accent, fontWeight: '700' },

  footer: { paddingTop: Spacing.md },
});
