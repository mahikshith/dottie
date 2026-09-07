/**
 * Dottie — Your details
 *
 * ─── WHY THIS SCREEN GREW (device-test-29) ──────────────────────────
 *
 *  Owner: "if they have by mistake selected PCOS or PCOD, we should let the
 *  user find a way to correct their mistakes — height, weight, etcetera — and
 *  based on the correction the prediction engine has to run again and show the
 *  new changes."
 *
 *  That is the whole design. Until now, everything the model reads about a
 *  person was captured ONCE during onboarding and then frozen: the conditions
 *  screen only ever wrote to the onboarding draft, and this screen held height
 *  and weight and nothing else. A mis-tapped PCOS silently widened every
 *  forecast forever, with no way back.
 *
 *  So this is now the one place every model input lives, all of it editable:
 *
 *    · age                 — read by the prior, and NEVER COLLECTED BEFORE.
 *                            The field existed, the model read it, no screen
 *                            ever wrote it (the owner spotted this).
 *    · weight              — stored as DATED READINGS, because the model wants
 *                            a change over time and one snapshot is not one.
 *    · height              — kept for records; the forecast does not read it,
 *                            and the screen says so rather than implying.
 *    · conditions          — with the full explainer on every row, so nobody
 *                            has to guess what PCOD is to answer honestly.
 *    · typical cycle length — the single biggest lever before history exists.
 *
 *  And saving RE-RUNS the prediction and shows the before → after confidence,
 *  which is the part that makes correcting a mistake feel worth doing.
 */

import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { AuroraBackground, GlassCard, PressableScale } from '../../src/components/ui';
import { A, useAurora } from '../../src/theme';
import { useUserStore, useCycleStore, selectHealthProfile } from '../../src/stores';
import { ConditionRow } from '../../src/components/health/ConditionRow';
import { CONDITION_OPTIONS, type ConditionKey } from '../../src/content/conditions';
import type { HealthCondition } from '../../src/types/cycle.types';
import { Storage } from '../../src/database/storage';
import { todayCivil } from '../../src/utils/civil-date';
import { recentWeightChangeKg } from '../../src/engine/prediction/weight-change';
import { logSilentFailure } from '../../src/diagnostics/silent-failure';

const LIMITS = {
  age: { min: 9, max: 60, unit: 'years' },
  height: { min: 100, max: 220, unit: 'cm' },
  weight: { min: 25, max: 250, unit: 'kg' },
  cycle: { min: 18, max: 60, unit: 'days' },
};

/** Only these keys are real `HealthCondition`s the engines act on. */
const ENGINE_KEYS = new Set<string>([
  'pcos', 'pcod', 'thyroid', 'hypothyroid', 'hyperthyroid',
  'endometriosis', 'adenomyosis', 'fibroids',
]);

export default function AboutYouScreen(): JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { palette } = useAurora();
  const profile = useUserStore(selectHealthProfile);
  const prediction = useCycleStore((s) => s.latestPrediction);

  const [age, setAge] = useState(profile?.age != null ? String(profile.age) : '');
  const [height, setHeight] = useState(profile?.heightCm != null ? String(profile.heightCm) : '');
  const [weight, setWeight] = useState(profile?.weightKg != null ? String(profile.weightKg) : '');
  const [cycleLen, setCycleLen] = useState(
    profile?.averageCycleLength != null ? String(profile.averageCycleLength) : ''
  );
  const [conditions, setConditions] = useState<Set<string>>(
    () => new Set<string>(profile?.conditions ?? [])
  );
  const [open, setOpen] = useState<ConditionKey | null>(null);
  const [saving, setSaving] = useState(false);
  /** Before → after, shown once a save has actually moved the number. */
  const [delta, setDelta] = useState<{ before: number; after: number } | null>(null);

  const num = (raw: string): number | null => {
    const t = raw.trim();
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : null;
  };
  const ok = (n: number | null, k: keyof typeof LIMITS): boolean =>
    n === null || (n >= LIMITS[k].min && n <= LIMITS[k].max);

  const ageN = num(age);
  const heightN = num(height);
  const weightN = num(weight);
  const cycleN = num(cycleLen);
  const valid = ok(ageN, 'age') && ok(heightN, 'height') && ok(weightN, 'weight') && ok(cycleN, 'cycle');

  const weightLog = useMemo(() => Storage.weightLog.get(), [delta]);
  const weightChange = useMemo(
    () => recentWeightChangeKg(weightLog, todayCivil()),
    [weightLog]
  );

  const toggle = (id: string) => {
    Haptics.selectionAsync().catch(() => {});
    setConditions((prev) => {
      const next = new Set(prev);
      if (id === 'nothing' || id === 'prefer_not_say') return next.has(id) ? new Set() : new Set([id]);
      next.delete('nothing');
      next.delete('prefer_not_say');
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (!valid || !profile || saving) return;
    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const before = prediction?.confidence ?? 0;
    try {
      if (weightN !== null) Storage.weightLog.add(todayCivil(), weightN);
      await useUserStore.getState().updateHealthProfile({
        ...profile,
        age: ageN,
        heightCm: heightN,
        weightKg: weightN,
        averageCycleLength: cycleN,
        conditions: [...conditions].filter((c): c is HealthCondition => ENGINE_KEYS.has(c)),
      });
      // ─── THE CORRECTION HAS TO TAKE EFFECT ───────────────────────
      //  Editing a condition that widens the prior and leaving the old
      //  forecast on screen would be worse than not offering the edit.
      const after = await useCycleStore.getState().recomputePrediction();
      setDelta({ before, after: after?.confidence ?? before });
    } catch (err) {
      logSilentFailure('aboutYou.save', err);
    } finally {
      setSaving(false);
    }
  };

  const pct = (n: number): number => Math.round(n * 100);

  return (
    <AuroraBackground>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing['3xl'] },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <PressableScale onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={styles.backText}>‹ Back</Text>
        </PressableScale>

        <Text style={styles.title}>Your details</Text>
        <Text style={styles.sub}>
          Everything the forecast knows about you, and all of it changeable. Ticked
          something by mistake? Untick it and the prediction is recalculated on the spot.
        </Text>

        {/* ─── WHAT CHANGED, AFTER A SAVE ───────────────────────── */}
        {delta && (
          <GlassCard style={styles.deltaCard} padding={Spacing.base}>
            <Text style={styles.deltaTitle}>Forecast updated</Text>
            <Text style={styles.deltaBody}>
              {delta.after === delta.before
                ? `Confidence stayed at ${pct(delta.after)}% — what you changed does not feed the date.`
                : `Confidence moved from ${pct(delta.before)}% to ${pct(delta.after)}%.`}
            </Text>
          </GlassCard>
        )}

        <Field
          label="Age" unitLabel="years" value={age} onChange={setAge} feeds
          note="Read by the forecast. Cycles vary more in the teens and again around the forties, so this lets the model hold an honest range from the first prediction."
          bad={!ok(ageN, 'age')} badNote={`Between ${LIMITS.age.min} and ${LIMITS.age.max}.`}
          palette={palette}
        />

        <Field
          label="Typical cycle length" unitLabel="days" value={cycleLen} onChange={setCycleLen} feeds
          note="The starting assumption, and the single biggest lever before you have logged much. Once your own cycles take over it quietly stops mattering."
          bad={!ok(cycleN, 'cycle')} badNote={`Between ${LIMITS.cycle.min} and ${LIMITS.cycle.max} days.`}
          palette={palette}
        />

        <Field
          label="Weight" unitLabel="kg" value={weight} onChange={setWeight} feeds
          note="Read as a CHANGE over time, never as a number about you. A swing over about 5 kg in a few months widens the window. Add it again in a few weeks and the model starts using it."
          bad={!ok(weightN, 'weight')} badNote={`Between ${LIMITS.weight.min} and ${LIMITS.weight.max} kg.`}
          palette={palette}
        />

        {weightLog.length > 0 && (
          <GlassCard style={styles.card} padding={Spacing.base}>
            <Text style={styles.cardTitle}>Weight readings</Text>
            {weightLog.slice(-4).reverse().map((r) => (
              <View key={r.date} style={styles.readingRow}>
                <Text style={styles.readingDate}>{r.date}</Text>
                <Text style={styles.readingKg}>{r.kg} kg</Text>
              </View>
            ))}
            <Text style={styles.note}>
              {weightChange === undefined
                ? 'Not a trend yet — two readings at least two weeks apart and the model starts reading it.'
                : `The model is using a change of ${weightChange > 0 ? '+' : ''}${weightChange} kg.${
                    Math.abs(weightChange) > 5 ? ' Over 5 kg, so the window is wider on purpose.' : ''
                  }`}
            </Text>
          </GlassCard>
        )}

        <Field
          label="Height" unitLabel="cm" value={height} onChange={setHeight} feeds={false}
          note="Kept for your own records and your doctor report. The forecast never reads it — we would rather say that than imply it matters."
          bad={!ok(heightN, 'height')} badNote={`Between ${LIMITS.height.min} and ${LIMITS.height.max} cm.`}
          palette={palette}
        />

        {/* ─── CONDITIONS, CORRECTABLE ───────────────────────────── */}
        <Text style={styles.h2}>Conditions</Text>
        <Text style={styles.sub}>
          Tap the <Text style={styles.q}>?</Text> on any row to read what it is before you
          decide. Only the first eight change the forecast; the rest are kept for your
          records.
        </Text>
        {CONDITION_OPTIONS.map((opt) => (
          <ConditionRow
            key={opt.id}
            option={opt}
            selected={conditions.has(opt.id)}
            expanded={open === opt.id}
            onToggle={() => toggle(opt.id)}
            onExpand={() => setOpen(open === opt.id ? null : opt.id)}
          />
        ))}

        <PressableScale
          onPress={save}
          disabled={!valid || saving}
          style={[styles.save, (!valid || saving) && styles.saveOff]}
          accessibilityRole="button"
          accessibilityLabel="Save and recalculate"
          accessibilityState={{ disabled: !valid || saving }}
        >
          <Text style={styles.saveText}>
            {saving ? 'Recalculating…' : 'Save & recalculate'}
          </Text>
        </PressableScale>
      </ScrollView>
    </AuroraBackground>
  );
}

function Field({
  label, unitLabel, value, onChange, note, feeds, bad, badNote, palette,
}: {
  label: string;
  unitLabel: string;
  value: string;
  onChange: (s: string) => void;
  note: string;
  feeds: boolean;
  bad: boolean;
  badNote: string;
  palette: ReturnType<typeof useAurora>['palette'];
}): JSX.Element {
  return (
    <GlassCard style={styles.card} padding={Spacing.base}>
      <View style={styles.fieldHead}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <View style={[styles.tag, feeds ? styles.tagFeeds : styles.tagKept]}>
          <Text style={[styles.tagText, { color: feeds ? A.accent : A.ink3 }]}>
            {feeds ? 'FEEDS THE FORECAST' : 'RECORDS ONLY'}
          </Text>
        </View>
      </View>
      <View style={[styles.inputWrap, { borderColor: bad ? A.error : palette.glass.edge }]}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          inputMode="numeric"
          maxLength={5}
          placeholder="—"
          placeholderTextColor={A.ink3}
          style={styles.input}
          accessibilityLabel={`${label} in ${unitLabel}`}
        />
        <Text style={styles.unit}>{unitLabel}</Text>
      </View>
      <Text style={styles.note}>{note}</Text>
      {bad ? <Text style={styles.bad}>{badNote}</Text> : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.screenPadding, gap: Spacing.md },
  back: { alignSelf: 'flex-start', paddingVertical: Spacing.sm },
  backText: { ...Typography.preset.body, color: A.accent },
  title: { ...Typography.preset.h1, color: A.ink },
  h2: { ...Typography.preset.h2, color: A.ink, marginTop: Spacing.lg },
  sub: { ...Typography.preset.body, color: A.ink2, lineHeight: 22 },
  q: { color: A.accent, fontWeight: '800' },
  card: { gap: Spacing.sm },
  cardTitle: { ...Typography.preset.bodySemibold, color: A.ink },
  deltaCard: { gap: 4, borderWidth: 1, borderColor: `${A.accent}55` },
  deltaTitle: { ...Typography.preset.bodySemibold, color: A.accent },
  deltaBody: { ...Typography.preset.caption, color: A.ink, lineHeight: 18 },
  fieldHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  fieldLabel: { ...Typography.preset.bodySemibold, color: A.ink },
  tag: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Spacing.radius.full, borderWidth: 1 },
  tagFeeds: { borderColor: `${A.accent}55`, backgroundColor: `${A.accent}14` },
  tagKept: { borderColor: A.glass2, backgroundColor: A.glass },
  tagText: { ...Typography.preset.caption, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Spacing.radius.md,
    paddingHorizontal: Spacing.base,
    backgroundColor: A.glass,
  },
  input: { flex: 1, ...Typography.preset.h2, color: A.ink, paddingVertical: Spacing.sm },
  unit: { ...Typography.preset.body, color: A.ink3 },
  note: { ...Typography.preset.caption, fontSize: 12.5, lineHeight: 18, color: A.ink2 },
  bad: { ...Typography.preset.caption, color: A.error },
  readingRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  readingDate: { ...Typography.preset.caption, color: A.ink3 },
  readingKg: { ...Typography.preset.caption, color: A.ink, fontWeight: '600' },
  save: {
    marginTop: Spacing.lg,
    minHeight: 54,
    borderRadius: Spacing.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: A.accent,
  },
  saveOff: { opacity: 0.45 },
  saveText: { ...Typography.preset.bodySemibold, color: A.ground },
});
