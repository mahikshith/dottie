/**
 * Reminders — local notification settings (design-v2).
 *
 * Aurora-themed screen to turn on/off Dottie's LOCAL reminders (check-in,
 * hydration, period heads-up) and pick when the daily one fires. Every reminder
 * is scheduled on-device via `NotificationScheduler` — nothing leaves the phone,
 * which is the whole point (and a trust win competitors can't easily claim).
 *
 * Permission is only requested the moment the user turns a reminder ON.
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device). Needs `expo-notifications` + a dev
 *  build to actually deliver; the toggles/persistence are verifiable by reading.
 */

import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { AuroraBackground, GlassCard, PressableScale } from '../../src/components/ui';
import { useAurora } from '../../src/theme';
import { useCycleStore } from '../../src/stores';
import { Storage, type ReminderPrefs, type ReminderTime } from '../../src/database/storage';
import { applyReminderPrefs } from '../../src/notifications/scheduler';
import { getNotificationCopy } from '../../src/notifications/copy';

const TIME_OPTIONS: { key: ReminderTime; label: string; emoji: string }[] = [
  { key: 'morning', label: 'Morning', emoji: '🌅' },
  { key: 'midday', label: 'Midday', emoji: '☀️' },
  { key: 'evening', label: 'Evening', emoji: '🌙' },
];

export default function RemindersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useAurora();

  const predictedNextPeriod = useCycleStore((s) => s.latestPrediction?.predictedNextPeriod ?? null);

  const [prefs, setPrefs] = useState<ReminderPrefs>(() => Storage.reminderPrefs.get());
  const [discrete, setDiscrete] = useState<boolean>(() => Storage.discreteNotifications.get());
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Persist + (re)schedule whenever anything changes.
  const sync = async (nextPrefs: ReminderPrefs, nextDiscrete: boolean) => {
    Storage.reminderPrefs.set(nextPrefs);
    Storage.discreteNotifications.set(nextDiscrete);
    const res = await applyReminderPrefs(nextPrefs, { discrete: nextDiscrete, predictedNextPeriod });
    const anyOn = nextPrefs.checkIn || nextPrefs.hydration || nextPrefs.periodHeadsUp;
    setPermissionDenied(anyOn && !res.granted);
  };

  const update = (patch: Partial<ReminderPrefs>) => {
    Haptics.selectionAsync().catch(() => {});
    const next = { ...prefs, ...patch };
    setPrefs(next);
    void sync(next, discrete);
  };
  const updateDiscrete = (value: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    setDiscrete(value);
    void sync(prefs, value);
  };

  const previewCopy = getNotificationCopy('check_in_reminder', discrete ? 'discrete' : 'explicit');

  return (
    <AuroraBackground>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <PressableScale onPress={() => router.back()} haptic="light" hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
            <Text style={[styles.back, { color: palette.accent }]}>‹ Back</Text>
          </PressableScale>
        </View>
        <Text style={[styles.title, { color: palette.ink }]}>Reminders</Text>
        <Text style={[styles.subtitle, { color: palette.ink2 }]}>
          Gentle, local nudges. Everything is scheduled on your phone — nothing leaves your device. 🔒
        </Text>

        {permissionDenied && (
          <GlassCard style={[styles.notice, { borderColor: palette.accent2 }]} padding={Spacing.md}>
            <Text style={[styles.noticeText, { color: palette.ink }]}>
              Notifications are off for Dottie. Turn them on in your phone's Settings to receive reminders.
            </Text>
          </GlassCard>
        )}

        {/* Daily check-in */}
        <GlassCard style={styles.card}>
          <ToggleRow
            emoji="🌸"
            title="Daily check-in"
            subtitle="A gentle nudge to log how you're feeling"
            value={prefs.checkIn}
            onChange={(v) => update({ checkIn: v })}
          />
          {prefs.checkIn && (
            <View style={styles.timeRow}>
              {TIME_OPTIONS.map((t) => {
                const on = prefs.checkInTime === t.key;
                return (
                  <PressableScale
                    key={t.key}
                    onPress={() => update({ checkInTime: t.key })}
                    haptic="none"
                    style={[
                      styles.timeChip,
                      { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
                      on && { backgroundColor: palette.accent, borderColor: palette.accent },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={t.label}
                  >
                    <Text style={styles.timeEmoji}>{t.emoji}</Text>
                    <Text style={[styles.timeText, { color: on ? palette.ground : palette.ink2 }]}>{t.label}</Text>
                  </PressableScale>
                );
              })}
            </View>
          )}
        </GlassCard>

        {/* Hydration */}
        <GlassCard style={styles.card}>
          <ToggleRow
            emoji="💧"
            title="Hydration nudge"
            subtitle="A midday reminder to sip some water"
            value={prefs.hydration}
            onChange={(v) => update({ hydration: v })}
          />
        </GlassCard>

        {/* Period heads-up */}
        <GlassCard style={styles.card}>
          <ToggleRow
            emoji="🩸"
            title="Period heads-up"
            subtitle={
              predictedNextPeriod
                ? 'A soft note a few days before your predicted period'
                : 'Available once Dottie has learned your pattern'
            }
            value={prefs.periodHeadsUp}
            disabled={!predictedNextPeriod}
            onChange={(v) => update({ periodHeadsUp: v })}
          />
        </GlassCard>

        {/* Discreet mode */}
        <GlassCard style={styles.card}>
          <ToggleRow
            emoji="🕶️"
            title="Discreet notifications"
            subtitle="Hide the topic on your lock screen — reads like a plain wellness app"
            value={discrete}
            onChange={updateDiscrete}
          />
          <View style={[styles.preview, { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge }]}>
            <Text style={[styles.previewLabel, { color: palette.ink3 }]}>LOCK-SCREEN PREVIEW</Text>
            <Text style={[styles.previewTitle, { color: palette.ink }]}>{previewCopy.title}</Text>
            <Text style={[styles.previewBody, { color: palette.ink2 }]}>{previewCopy.body}</Text>
          </View>
        </GlassCard>

        <Text style={[styles.footnote, { color: palette.ink3 }]}>
          {Platform.OS === 'ios'
            ? 'Dottie will ask for notification permission the first time you turn a reminder on.'
            : 'You can fine-tune these in Android Settings → Apps → Dottie → Notifications.'}
        </Text>

        <View style={{ height: Spacing['4xl'] }} />
      </ScrollView>
    </AuroraBackground>
  );
}

// ─── TOGGLE ROW ──────────────────────────────────────────────────────

function ToggleRow({
  emoji,
  title,
  subtitle,
  value,
  disabled,
  onChange,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  value: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}): JSX.Element {
  const { palette } = useAurora();
  return (
    <View style={[styles.row, disabled && { opacity: 0.5 }]}>
      <Text style={styles.rowEmoji}>{emoji}</Text>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: palette.ink }]}>{title}</Text>
        <Text style={[styles.rowSubtitle, { color: palette.ink3 }]}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: palette.glass.edge, true: palette.accent }}
        thumbColor={'#FFFFFF'}
        ios_backgroundColor={palette.glass.edge}
      />
    </View>
  );
}

// ─── STYLES (layout only — colours inline, palette-driven) ───────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.screenPadding },
  header: { marginBottom: Spacing.sm },
  back: { ...Typography.preset.bodySemibold },
  title: { ...Typography.preset.h2, marginBottom: Spacing.xs },
  subtitle: { ...Typography.preset.body, lineHeight: 22, marginBottom: Spacing.lg },
  notice: { borderWidth: 1, marginBottom: Spacing.base },
  noticeText: { ...Typography.preset.caption, lineHeight: 18 },
  card: { marginBottom: Spacing.base },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rowEmoji: { fontSize: 22 },
  rowBody: { flex: 1 },
  rowTitle: { ...Typography.preset.bodySemibold },
  rowSubtitle: { ...Typography.preset.caption, marginTop: 2, lineHeight: 16 },
  timeRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  timeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderRadius: Spacing.radius.full,
    paddingVertical: Spacing.sm,
  },
  timeEmoji: { fontSize: 13 },
  timeText: { ...Typography.preset.caption, fontWeight: '800' },
  preview: {
    marginTop: Spacing.md,
    borderWidth: 1,
    borderRadius: Spacing.radius.lg,
    padding: Spacing.md,
  },
  previewLabel: { ...Typography.preset.overline, fontSize: 9, letterSpacing: 1, marginBottom: 4 },
  previewTitle: { ...Typography.preset.bodySemibold },
  previewBody: { ...Typography.preset.caption, marginTop: 2, lineHeight: 16 },
  footnote: { ...Typography.preset.caption, fontStyle: 'italic', marginTop: Spacing.sm, textAlign: 'center' },
});
