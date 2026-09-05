/**
 * Reminders — local notification settings (design-v2).
 *
 * Aurora-themed screen to turn Dottie's LOCAL reminders on and off and pick
 * exactly when each one fires. Everything is scheduled on-device via
 * `NotificationScheduler` — nothing leaves the phone, which is the whole point
 * (and a trust win competitors can't easily claim).
 *
 * Permission is only requested the moment the user turns a reminder ON.
 *
 * ─── DT21: WHAT CHANGED AND WHY ─────────────────────────────────────
 *
 *  Owner: "It should be a toggle button, but the buttons are working, the
 *  notifications are coming. Problem is, it's not a toggle button."
 *
 *  The rows used React Native's `<Switch>`, whose Android track was tinted
 *  `glass.edge` — a ~10% white hairline on a near-black card. The track
 *  disappeared and left a lone white dot that reads as a bullet or a status
 *  light. `AuroraSwitch` draws the whole control instead; see its header.
 *  The ROW is also tappable now, so the target is the width of the card
 *  rather than a 50pt control at the far right.
 *
 *  Owner, same round: "we might want to add more notifications with the help
 *  of period… custom toggle where they might want to have a custom
 *  notification at whatever the time they want."
 *
 *  So the screen now has three groups instead of one flat list:
 *
 *   1. EVERY DAY — the check-in and the water nudge, each with an exact time.
 *   2. AROUND YOUR CYCLE — heads-up (with a lead you choose), the
 *      did-it-start check on the predicted day, and phase changes. All three
 *      are disabled until a prediction exists, because a cycle reminder with
 *      no cycle behind it would be the app making something up.
 *   3. YOUR OWN — reminders the user writes, at times they pick.
 *
 *  Custom reminders show the user's own words on the lock screen, so the card
 *  says that out loud rather than letting discreet mode silently fail them.
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device). Needs `expo-notifications` + a dev
 *  build to actually deliver; the toggles/persistence are verifiable by reading.
 */

import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Platform, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { AuroraBackground, AuroraSwitch, GlassCard, PressableScale } from '../../src/components/ui';
import { useAurora } from '../../src/theme';
import { useCycleStore } from '../../src/stores';
import {
  Storage,
  type CustomReminder,
  type ReminderPrefs,
  type ReminderTime,
} from '../../src/database/storage';
import { applyReminderPrefs, requestNotificationPermission } from '../../src/notifications/scheduler';
import { getNotificationCopy } from '../../src/notifications/copy';
import { formatClockTime, PRESET_HOUR } from '../../src/engine/reminders/dedupe';

const TIME_OPTIONS: { key: ReminderTime; label: string; emoji: string }[] = [
  { key: 'morning', label: 'Morning', emoji: '🌅' },
  { key: 'midday', label: 'Midday', emoji: '☀️' },
  { key: 'evening', label: 'Evening', emoji: '🌙' },
];

/** How many days before the predicted period the heads-up can land. */
const LEAD_OPTIONS = [1, 2, 3, 5];

export default function RemindersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useAurora();

  const predictedNextPeriod = useCycleStore((s) => s.latestPrediction?.predictedNextPeriod ?? null);
  const predictedOvulation = useCycleStore((s) => s.latestPrediction?.predictedOvulation ?? null);

  const [prefs, setPrefs] = useState<ReminderPrefs>(() => Storage.reminderPrefs.get());
  const [discrete, setDiscrete] = useState<boolean>(() => Storage.discreteNotifications.get());
  const [permissionDenied, setPermissionDenied] = useState(false);

  // The custom-reminder draft. Seeded at 8am — a time you'd plausibly want,
  // rather than midnight, which nobody wants and everybody has to fix.
  const [draftLabel, setDraftLabel] = useState('');
  const [draftMinutes, setDraftMinutes] = useState(8 * 60);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);

  // Persist + (re)schedule whenever anything changes.
  //
  // ⚠️ device-test-6: this used to go straight to applyReminderPrefs, which only
  // ever calls the SILENT checkNotificationPermission. So flipping a reminder on
  // never showed the Android permission dialog — the toggle appeared to work,
  // no OS prompt appeared, and reminders silently never fired. Every call to
  // sync() originates from an explicit user tap on a switch, which is exactly
  // (and only) where CLAUDE.md rule 7 allows us to PROMPT, so we ask here.
  const sync = async (nextPrefs: ReminderPrefs, nextDiscrete: boolean) => {
    Storage.reminderPrefs.set(nextPrefs);
    Storage.discreteNotifications.set(nextDiscrete);
    const anyOn = anythingOn(nextPrefs);

    let granted = true;
    if (anyOn) {
      // Shows the real Android/iOS dialog the first time; resolves to the
      // existing decision afterwards (the OS only asks once).
      granted = await requestNotificationPermission();
    }

    const res = await applyReminderPrefs(nextPrefs, {
      discrete: nextDiscrete,
      predictedNextPeriod,
      predictedOvulation,
    });
    setPermissionDenied(anyOn && !(granted && res.granted));
  };

  // Once the OS has been asked and refused, the dialog can't be shown again —
  // the only route left is the system settings page, so link straight there
  // instead of telling the user to go find it.
  const openSystemSettings = () => {
    Haptics.selectionAsync().catch(() => {});
    void Linking.openSettings();
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

  /** Nudge an exact time by `delta` minutes, seeded from the current value. */
  const nudge = (current: number, delta: number): number =>
    (((current + delta) % 1440) + 1440) % 1440;

  const checkInMinutes =
    prefs.checkInHour !== undefined
      ? prefs.checkInHour * 60 + (prefs.checkInMinute ?? 0)
      : (PRESET_HOUR[prefs.checkInTime] ?? 20) * 60;
  const hydrationMinutes =
    prefs.hydrationHour !== undefined
      ? prefs.hydrationHour * 60 + (prefs.hydrationMinute ?? 0)
      : (PRESET_HOUR.midday ?? 13) * 60;

  const setCheckInMinutes = (m: number) =>
    update({ checkInHour: Math.floor(m / 60), checkInMinute: m % 60 });
  const setHydrationMinutes = (m: number) =>
    update({ hydrationHour: Math.floor(m / 60), hydrationMinute: m % 60 });

  const addCustom = () => {
    const label = draftLabel.trim().replace(/\s+/g, ' ');
    if (label.length === 0) {
      setDraftNotice('Give it a name first — that name is what you’ll see on your lock screen.');
      return;
    }
    const hour = Math.floor(draftMinutes / 60);
    const minute = draftMinutes % 60;
    // Same de-dupe instinct as the medications screen: adding the same thing
    // at the same moment twice just pings you twice for no reason.
    const clash = prefs.custom.find(
      (c) =>
        c.label.trim().toLowerCase() === label.toLowerCase() &&
        c.hour === hour &&
        c.minute === minute
    );
    if (clash) {
      setDraftNotice(`You already have “${clash.label}” at ${formatClockTime(hour, minute)}.`);
      return;
    }
    const next: CustomReminder = {
      id: `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      label,
      hour,
      minute,
      active: true,
    };
    setDraftLabel('');
    setDraftNotice(null);
    update({ custom: [...prefs.custom, next] });
  };

  const toggleCustom = (id: string, value: boolean) =>
    update({ custom: prefs.custom.map((c) => (c.id === id ? { ...c, active: value } : c)) });
  const removeCustom = (id: string) =>
    update({ custom: prefs.custom.filter((c) => c.id !== id) });

  const previewCopy = getNotificationCopy('check_in_reminder', discrete ? 'discrete' : 'explicit');
  const cycleReady = predictedNextPeriod !== null;

  return (
    <AuroraBackground>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing['3xl'] },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
              Notifications are switched off for Dottie, so these reminders can&apos;t reach
              you. Your phone only asks once — after that it has to be changed in Settings.
            </Text>
            <PressableScale
              onPress={openSystemSettings}
              haptic="none"
              style={[styles.noticeCta, { backgroundColor: palette.accent }]}
              accessibilityRole="button"
              accessibilityLabel="Open Dottie's notification settings"
            >
              <Text style={[styles.noticeCtaText, { color: palette.ground }]}>
                Open notification settings →
              </Text>
            </PressableScale>
          </GlassCard>
        )}

        {/* ─── EVERY DAY ──────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: palette.ink3 }]}>EVERY DAY</Text>

        <GlassCard style={styles.card}>
          <ToggleRow
            emoji="🌸"
            title="Daily check-in"
            subtitle="A gentle nudge to log how you're feeling"
            value={prefs.checkIn}
            onChange={(v) => update({ checkIn: v })}
          />
          {prefs.checkIn && (
            <>
              <View style={styles.timeRow}>
                {TIME_OPTIONS.map((t) => {
                  // A bucket is "selected" only while no exact time overrides it.
                  const on = prefs.checkInHour === undefined && prefs.checkInTime === t.key;
                  return (
                    <PressableScale
                      key={t.key}
                      onPress={() =>
                        update({ checkInTime: t.key, checkInHour: undefined, checkInMinute: undefined })
                      }
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
              <TimeStepper
                label="Exact time"
                minutes={checkInMinutes}
                onChange={(delta) => setCheckInMinutes(nudge(checkInMinutes, delta))}
                accessibilityName="daily check-in"
              />
            </>
          )}
        </GlassCard>

        <GlassCard style={styles.card}>
          <ToggleRow
            emoji="💧"
            title="Hydration nudge"
            subtitle="A reminder to sip some water"
            value={prefs.hydration}
            onChange={(v) => update({ hydration: v })}
          />
          {prefs.hydration && (
            <TimeStepper
              label="Exact time"
              minutes={hydrationMinutes}
              onChange={(delta) => setHydrationMinutes(nudge(hydrationMinutes, delta))}
              accessibilityName="hydration nudge"
            />
          )}
        </GlassCard>

        {/* ─── AROUND YOUR CYCLE ──────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: palette.ink3 }]}>AROUND YOUR CYCLE</Text>
        {!cycleReady && (
          <Text style={[styles.sectionNote, { color: palette.ink3 }]}>
            These wake up once Dottie has learned your pattern — log a period and they&apos;ll
            switch on here.
          </Text>
        )}

        <GlassCard style={styles.card}>
          <ToggleRow
            emoji="🩸"
            title="Period heads-up"
            subtitle="A soft note before your predicted period"
            value={prefs.periodHeadsUp}
            disabled={!cycleReady}
            onChange={(v) => update({ periodHeadsUp: v })}
          />
          {prefs.periodHeadsUp && cycleReady && (
            <>
              <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>HOW MUCH WARNING</Text>
              <View style={styles.timeRow}>
                {LEAD_OPTIONS.map((days) => {
                  const on = prefs.periodHeadsUpLeadDays === days;
                  return (
                    <PressableScale
                      key={days}
                      onPress={() => update({ periodHeadsUpLeadDays: days })}
                      haptic="none"
                      style={[
                        styles.timeChip,
                        { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
                        on && { backgroundColor: palette.accent, borderColor: palette.accent },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${days} day${days === 1 ? '' : 's'} before`}
                    >
                      <Text style={[styles.timeText, { color: on ? palette.ground : palette.ink2 }]}>
                        {days}d
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            </>
          )}
        </GlassCard>

        <GlassCard style={styles.card}>
          <ToggleRow
            emoji="📓"
            title="Did it start?"
            subtitle="On the predicted day — the quiet ask that keeps your next estimate accurate"
            value={prefs.periodArrivedCheck}
            disabled={!cycleReady}
            onChange={(v) => update({ periodArrivedCheck: v })}
          />
        </GlassCard>

        <GlassCard style={styles.card}>
          <ToggleRow
            emoji="🌗"
            title="Phase changes"
            subtitle={
              predictedOvulation
                ? 'A note when your cycle moves into a new phase'
                : 'Needs an ovulation estimate — a few more logged cycles'
            }
            value={prefs.phaseChange}
            disabled={!predictedOvulation}
            onChange={(v) => update({ phaseChange: v })}
          />
        </GlassCard>

        <GlassCard style={styles.card}>
          <ToggleRow
            emoji="📅"
            title="Weekly recap"
            subtitle="Sunday evening — how the week went, in one line"
            value={prefs.weeklyRecap}
            onChange={(v) => update({ weeklyRecap: v })}
          />
        </GlassCard>

        {/* ─── YOUR OWN ───────────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: palette.ink3 }]}>YOUR OWN</Text>

        {prefs.custom.map((c) => (
          <GlassCard key={c.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowEmoji}>⏰</Text>
              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, { color: palette.ink }]} numberOfLines={2}>
                  {c.label}
                </Text>
                <Text style={[styles.rowSubtitle, { color: palette.ink3 }]}>
                  Every day at {formatClockTime(c.hour, c.minute)}
                </Text>
              </View>
              <AuroraSwitch
                value={c.active}
                onValueChange={(v) => toggleCustom(c.id, v)}
                accessibilityLabel={c.label}
                accessibilityHint={`Every day at ${formatClockTime(c.hour, c.minute)}`}
              />
            </View>
            <PressableScale
              onPress={() => removeCustom(c.id)}
              haptic="light"
              hitSlop={8}
              style={styles.removeBtn}
              accessibilityRole="button"
              accessibilityLabel={`Remove the reminder ${c.label}`}
            >
              <Text style={[styles.removeText, { color: palette.ink3 }]}>Remove</Text>
            </PressableScale>
          </GlassCard>
        ))}

        <GlassCard style={styles.card}>
          <Text style={[styles.rowTitle, { color: palette.ink }]}>Add your own reminder</Text>
          <Text style={[styles.rowSubtitle, { color: palette.ink3 }]}>
            Anything you want a daily nudge for, at any time you like.
          </Text>

          <TextInput
            value={draftLabel}
            onChangeText={(t) => {
              setDraftLabel(t);
              setDraftNotice(null);
            }}
            placeholder="e.g. Magnesium, or stretch for five minutes"
            placeholderTextColor={palette.ink3}
            style={[
              styles.input,
              { color: palette.ink, backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
            ]}
            maxLength={48}
            returnKeyType="done"
            onSubmitEditing={addCustom}
            accessibilityLabel="What should this reminder say"
          />

          <TimeStepper
            label="Time"
            minutes={draftMinutes}
            onChange={(delta) => {
              setDraftNotice(null);
              setDraftMinutes(nudge(draftMinutes, delta));
            }}
            accessibilityName="new reminder"
          />

          {draftNotice && (
            <View style={[styles.dupNotice, { borderColor: palette.accent2, backgroundColor: `${palette.accent2}18` }]}>
              <Text style={[styles.dupNoticeText, { color: palette.ink }]}>{draftNotice}</Text>
            </View>
          )}

          <PressableScale
            onPress={addCustom}
            haptic="light"
            style={[styles.addBtn, { backgroundColor: palette.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Add this reminder"
          >
            <Text style={[styles.addBtnText, { color: palette.ground }]}>Add reminder</Text>
          </PressableScale>

          {/* Honesty, not a disclaimer: discreet mode can rewrite Dottie's own
              sentences because Dottie wrote them. It cannot rewrite yours. */}
          <Text style={[styles.rowSubtitle, { color: palette.ink3, marginTop: Spacing.sm }]}>
            Your own wording shows on the lock screen exactly as you type it — discreet mode
            can&apos;t disguise it.
          </Text>
        </GlassCard>

        {/* ─── DISCREET MODE ──────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { color: palette.ink3 }]}>PRIVACY</Text>

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

/** Is anything at all switched on? Decides whether we need permission. */
function anythingOn(p: ReminderPrefs): boolean {
  return (
    p.checkIn ||
    p.hydration ||
    p.periodHeadsUp ||
    p.periodArrivedCheck ||
    p.phaseChange ||
    p.weeklyRecap ||
    p.custom.some((c) => c.active && c.label.trim().length > 0)
  );
}

// ─── TOGGLE ROW ──────────────────────────────────────────────────────

/**
 * The whole row is the target, not just the switch.
 *
 * A 52pt control pinned to the right edge of a card is a small thing to hit
 * one-handed, and it was the second half of DT21's "sometimes it may open, it
 * may not" (the mood map had the same shape of bug). Tapping anywhere on the
 * row flips it; the switch stays tappable in its own right so the gesture you
 * expect to work still works.
 */
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
    <PressableScale
      onPress={() => onChange(!value)}
      disabled={disabled}
      haptic="none"
      scaleTo={0.995}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      style={[styles.row, disabled ? styles.rowDisabled : null]}
    >
      <Text style={styles.rowEmoji}>{emoji}</Text>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: palette.ink }]}>{title}</Text>
        <Text style={[styles.rowSubtitle, { color: palette.ink3 }]}>{subtitle}</Text>
      </View>
      <AuroraSwitch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={title}
        accessibilityHint={subtitle}
      />
    </PressableScale>
  );
}

// ─── TIME STEPPER ────────────────────────────────────────────────────

/**
 * A ±15-minute stepper, matching the medications screen. Deliberately not a
 * gesture control: precise, and it can't be fumbled on a small screen.
 */
function TimeStepper({
  label,
  minutes,
  onChange,
  accessibilityName,
}: {
  label: string;
  minutes: number;
  onChange: (delta: number) => void;
  accessibilityName: string;
}): JSX.Element {
  const { palette } = useAurora();
  return (
    <>
      <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>{label.toUpperCase()}</Text>
      <View style={styles.stepperRow}>
        <PressableScale
          onPress={() => onChange(-15)}
          haptic="none"
          style={[styles.timeStep, { borderColor: palette.glass.edge, backgroundColor: palette.glass.bg }]}
          accessibilityRole="button"
          accessibilityLabel={`${accessibilityName}: 15 minutes earlier`}
        >
          <Text style={[styles.timeStepText, { color: palette.ink }]}>−</Text>
        </PressableScale>
        <Text style={[styles.timeValue, { color: palette.ink }]}>
          {formatClockTime(Math.floor(minutes / 60), minutes % 60)}
        </Text>
        <PressableScale
          onPress={() => onChange(15)}
          haptic="none"
          style={[styles.timeStep, { borderColor: palette.glass.edge, backgroundColor: palette.glass.bg }]}
          accessibilityRole="button"
          accessibilityLabel={`${accessibilityName}: 15 minutes later`}
        >
          <Text style={[styles.timeStepText, { color: palette.ink }]}>+</Text>
        </PressableScale>
      </View>
    </>
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
  sectionLabel: {
    ...Typography.preset.overline,
    fontSize: 10,
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
  },
  sectionNote: {
    ...Typography.preset.caption,
    lineHeight: 17,
    marginBottom: Spacing.sm,
    marginTop: -Spacing.xs,
  },
  notice: { borderWidth: 1, marginBottom: Spacing.base },
  noticeCta: {
    marginTop: Spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Spacing.radius.full,
  },
  noticeCtaText: {
    ...Typography.preset.captionBold,
  },
  noticeText: { ...Typography.preset.caption, lineHeight: 18 },
  card: { marginBottom: Spacing.base },
  // minHeight 48 is Android's minimum touch target, and the row IS the toggle.
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 48 },
  rowDisabled: { opacity: 0.5 },
  rowEmoji: { fontSize: 22 },
  rowBody: { flex: 1 },
  rowTitle: { ...Typography.preset.bodySemibold },
  rowSubtitle: { ...Typography.preset.caption, marginTop: 2, lineHeight: 16 },
  timeRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  timeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderRadius: Spacing.radius.full,
    paddingVertical: Spacing.sm,
    minHeight: 40,
  },
  timeEmoji: { fontSize: 13 },
  timeText: { ...Typography.preset.caption, fontWeight: '800' },
  fieldLabel: {
    ...Typography.preset.overline,
    fontSize: 9,
    letterSpacing: 1,
    marginTop: Spacing.md,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  timeStep: {
    width: 48,
    height: 44,
    borderWidth: 1.5,
    borderRadius: Spacing.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeStepText: { ...Typography.preset.h3 },
  timeValue: { ...Typography.preset.bodySemibold },
  input: {
    borderWidth: 1.5,
    borderRadius: Spacing.radius.lg,
    paddingHorizontal: Spacing.md,
    minHeight: 48,
    marginTop: Spacing.md,
    ...Typography.preset.body,
  },
  addBtn: {
    marginTop: Spacing.md,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.radius.full,
  },
  addBtnText: { ...Typography.preset.bodySemibold },
  removeBtn: { alignSelf: 'flex-start', marginTop: Spacing.sm, paddingVertical: Spacing.xs },
  removeText: { ...Typography.preset.caption, textDecorationLine: 'underline' },
  dupNotice: {
    marginTop: Spacing.md,
    borderWidth: 1,
    borderRadius: Spacing.radius.lg,
    padding: Spacing.md,
  },
  dupNoticeText: { ...Typography.preset.caption, lineHeight: 18 },
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
