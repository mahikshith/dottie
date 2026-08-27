/**
 * Medications & Birth Control — daily reminders (design-v2).
 *
 * Aurora-themed screen to add local daily reminders for the pill, a ring change,
 * etc. Universally-requested, and built on the notification scheduler — all
 * on-device, and the lock-screen copy stays discreet (the med name only appears
 * in the explicit variant). Time is a preset (morning/midday/evening) for v1.
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device). Needs expo-notifications + a dev build
 *  to deliver; the list/persistence/scheduling wiring is verifiable by reading.
 */

import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { AuroraBackground, GlassCard, PressableScale } from '../../src/components/ui';
import { useAurora } from '../../src/theme';
import { useCycleStore } from '../../src/stores';
import {
  Storage,
  type MedicationPlan,
  type MedicationKind,
  type ReminderTime,
} from '../../src/database/storage';
import { syncAllReminders } from '../../src/notifications/scheduler';

const KINDS: { key: MedicationKind; emoji: string; label: string }[] = [
  { key: 'pill', emoji: '💊', label: 'Pill' },
  { key: 'ring', emoji: '⭕', label: 'Ring' },
  { key: 'patch', emoji: '🩹', label: 'Patch' },
  { key: 'injection', emoji: '💉', label: 'Injection' },
  { key: 'iud', emoji: '⚕️', label: 'IUD' },
  { key: 'implant', emoji: '🌱', label: 'Implant' },
  { key: 'other', emoji: '✨', label: 'Other' },
];

const TIMES: { key: ReminderTime; emoji: string; label: string }[] = [
  { key: 'morning', emoji: '🌅', label: 'Morning' },
  { key: 'midday', emoji: '☀️', label: 'Midday' },
  { key: 'evening', emoji: '🌙', label: 'Evening' },
];

function kindMeta(kind: MedicationKind) {
  return KINDS.find((k) => k.key === kind) ?? KINDS[KINDS.length - 1]!;
}

export default function MedicationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useAurora();
  const predictedNextPeriod = useCycleStore((s) => s.latestPrediction?.predictedNextPeriod ?? null);

  const [meds, setMeds] = useState<MedicationPlan[]>(() => Storage.medications.get());
  const [name, setName] = useState('');
  const [kind, setKind] = useState<MedicationKind>('pill');
  const [time, setTime] = useState<ReminderTime>('morning');
  const [permissionDenied, setPermissionDenied] = useState(false);

  const persist = async (next: MedicationPlan[]) => {
    Storage.medications.set(next);
    setMeds(next);
    const res = await syncAllReminders({ discrete: Storage.discreteNotifications.get(), predictedNextPeriod });
    setPermissionDenied(next.some((m) => m.active) && !res.granted);
  };

  const addMed = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const plan: MedicationPlan = {
      id: `med_${Date.now().toString(36)}_${Math.floor(Math.random() * 0xffff).toString(36)}`,
      name: trimmed,
      kind,
      time,
      active: true,
    };
    void persist([...meds, plan]);
    setName('');
    setKind('pill');
    setTime('morning');
  };

  const toggleMed = (id: string, value: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    void persist(meds.map((m) => (m.id === id ? { ...m, active: value } : m)));
  };

  const removeMed = (id: string) => {
    Haptics.selectionAsync().catch(() => {});
    void persist(meds.filter((m) => m.id !== id));
  };

  return (
    <AuroraBackground>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <PressableScale onPress={() => router.back()} haptic="light" hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
            <Text style={[styles.back, { color: palette.accent }]}>‹ Back</Text>
          </PressableScale>
        </View>
        <Text style={[styles.title, { color: palette.ink }]}>Medications & birth control</Text>
        <Text style={[styles.subtitle, { color: palette.ink2 }]}>
          Local daily reminders — the pill, a ring change, anything. Discreet on your lock screen. 🔒
        </Text>

        {permissionDenied && (
          <GlassCard style={[styles.notice, { borderColor: palette.accent2 }]} padding={Spacing.md}>
            <Text style={[styles.noticeText, { color: palette.ink }]}>
              Notifications are off for Dottie. Turn them on in your phone's Settings to receive reminders.
            </Text>
          </GlassCard>
        )}

        {/* Existing */}
        {meds.map((m) => {
          const meta = kindMeta(m.kind);
          const t = TIMES.find((x) => x.key === m.time);
          return (
            <GlassCard key={m.id} style={styles.medCard}>
              <View style={styles.medRow}>
                <Text style={styles.medEmoji}>{meta.emoji}</Text>
                <View style={styles.medBody}>
                  <Text style={[styles.medName, { color: palette.ink }]} numberOfLines={1}>{m.name}</Text>
                  <Text style={[styles.medMeta, { color: palette.ink3 }]}>
                    {meta.label} · {t?.emoji} {t?.label}
                  </Text>
                </View>
                <Switch
                  value={m.active}
                  onValueChange={(v) => toggleMed(m.id, v)}
                  trackColor={{ false: palette.glass.edge, true: palette.accent }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={palette.glass.edge}
                />
              </View>
              <PressableScale onPress={() => removeMed(m.id)} haptic="none" hitSlop={8} style={styles.removeBtn} accessibilityRole="button" accessibilityLabel={`Remove ${m.name}`}>
                <Text style={[styles.removeText, { color: '#FF7A8A' }]}>Remove</Text>
              </PressableScale>
            </GlassCard>
          );
        })}

        {meds.length === 0 && (
          <Text style={[styles.emptyHint, { color: palette.ink3 }]}>No reminders yet — add one below.</Text>
        )}

        {/* Add form */}
        <GlassCard style={styles.addCard}>
          <Text style={[styles.addLabel, { color: palette.ink3 }]}>ADD A REMINDER</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Name (e.g. The pill)"
            placeholderTextColor={palette.ink3}
            style={[styles.input, { color: palette.ink, backgroundColor: palette.glass.bg, borderColor: palette.glass.edge }]}
            accessibilityLabel="Medication name"
          />

          <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>Type</Text>
          <View style={styles.chipWrap}>
            {KINDS.map((k) => {
              const on = kind === k.key;
              return (
                <PressableScale
                  key={k.key}
                  onPress={() => { Haptics.selectionAsync().catch(() => {}); setKind(k.key); }}
                  haptic="none"
                  style={[styles.chip, { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge }, on && { backgroundColor: palette.accent, borderColor: palette.accent }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={k.label}
                >
                  <Text style={styles.chipEmoji}>{k.emoji}</Text>
                  <Text style={[styles.chipText, { color: on ? palette.ground : palette.ink2 }]}>{k.label}</Text>
                </PressableScale>
              );
            })}
          </View>

          <Text style={[styles.fieldLabel, { color: palette.ink3 }]}>Time</Text>
          <View style={styles.chipWrap}>
            {TIMES.map((t) => {
              const on = time === t.key;
              return (
                <PressableScale
                  key={t.key}
                  onPress={() => { Haptics.selectionAsync().catch(() => {}); setTime(t.key); }}
                  haptic="none"
                  style={[styles.chip, { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge }, on && { backgroundColor: palette.accent, borderColor: palette.accent }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={t.label}
                >
                  <Text style={styles.chipEmoji}>{t.emoji}</Text>
                  <Text style={[styles.chipText, { color: on ? palette.ground : palette.ink2 }]}>{t.label}</Text>
                </PressableScale>
              );
            })}
          </View>

          <PressableScale
            onPress={addMed}
            disabled={!name.trim()}
            haptic={name.trim() ? 'light' : 'none'}
            scaleTo={0.97}
            style={[styles.addBtn, { backgroundColor: name.trim() ? palette.accent : palette.glass.bg }]}
            accessibilityRole="button"
            accessibilityLabel="Add reminder"
            accessibilityState={{ disabled: !name.trim() }}
          >
            <Text style={[styles.addBtnText, { color: name.trim() ? palette.ground : palette.ink3 }]}>Add reminder</Text>
          </PressableScale>
        </GlassCard>

        <Text style={[styles.footnote, { color: palette.ink3 }]}>
          Reminders repeat daily. This isn't medical advice — Dottie just helps you remember. 💛
        </Text>

        <View style={{ height: Spacing['4xl'] }} />
      </ScrollView>
    </AuroraBackground>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.screenPadding },
  header: { marginBottom: Spacing.sm },
  back: { ...Typography.preset.bodySemibold },
  title: { ...Typography.preset.h2, marginBottom: Spacing.xs },
  subtitle: { ...Typography.preset.body, lineHeight: 22, marginBottom: Spacing.lg },
  notice: { borderWidth: 1, marginBottom: Spacing.base },
  noticeText: { ...Typography.preset.caption, lineHeight: 18 },

  medCard: { marginBottom: Spacing.base },
  medRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  medEmoji: { fontSize: 24 },
  medBody: { flex: 1 },
  medName: { ...Typography.preset.bodySemibold },
  medMeta: { ...Typography.preset.caption, marginTop: 2 },
  removeBtn: { alignSelf: 'flex-start', marginTop: Spacing.sm },
  removeText: { ...Typography.preset.captionBold },

  emptyHint: { ...Typography.preset.caption, textAlign: 'center', marginBottom: Spacing.base, fontStyle: 'italic' },

  addCard: { marginTop: Spacing.xs },
  addLabel: { ...Typography.preset.overline, letterSpacing: 1, marginBottom: Spacing.sm },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.radius.lg,
    padding: Spacing.md,
    ...Typography.preset.body,
    marginBottom: Spacing.md,
  },
  fieldLabel: { ...Typography.preset.caption, fontWeight: '800', marginBottom: Spacing.sm, marginTop: Spacing.xs },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderRadius: Spacing.radius.full,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  chipEmoji: { fontSize: 13 },
  chipText: { ...Typography.preset.caption, fontWeight: '800' },
  addBtn: {
    height: Spacing.buttonHeight.md,
    borderRadius: Spacing.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  addBtnText: { ...Typography.preset.button },
  footnote: { ...Typography.preset.caption, fontStyle: 'italic', textAlign: 'center', marginTop: Spacing.base },
});
