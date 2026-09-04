/**
 * About You — optional height & weight
 *
 * A calm, judgement-free place for the user to (optionally) share their height
 * and weight. This is B1.5 of the prediction-explainer work: the columns
 * (`weight_kg`, `height_cm`) and the explainer's BMI *context* factor already
 * exist — this screen is the missing capture UI.
 *
 * ─── WHY WE ASK (and how we use it) ─────────────────────────────────
 *
 *  Some people's cycles shift at a very low or very high body weight. When
 *  shared, Dottie uses it ONLY as gentle context in the prediction explainer
 *  (and to keep its uncertainty window a touch wider at real extremes) — never
 *  to move the predicted date, never to judge, never to diagnose. It's stored
 *  on-device like everything else and is fully optional.
 *
 * ─── AFTER SAVING ───────────────────────────────────────────────────
 *
 *  We call recomputePrediction() so the "How this prediction is made" card
 *  updates immediately with (or without) the body-context factor.
 */

import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { AuroraBackground, GlassCard, PressableScale } from '../../src/components/ui';
import { useAurora } from '../../src/theme';
import { useUserStore, selectHealthProfile, useCycleStore } from '../../src/stores';

// Plausibility guards — match the explainer's computeBmi bounds.
const H_MIN = 100;
const H_MAX = 250;
const W_MIN = 20;
const W_MAX = 400;

export default function AboutYouScreen(): JSX.Element {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { palette } = useAurora();
  const profile = useUserStore(selectHealthProfile);

  const [height, setHeight] = useState<string>(
    profile?.heightCm != null ? String(profile.heightCm) : ''
  );
  const [weight, setWeight] = useState<string>(
    profile?.weightKg != null ? String(profile.weightKg) : ''
  );
  const [saved, setSaved] = useState(false);

  const heightNum = parseNum(height);
  const weightNum = parseNum(weight);
  const heightValid = heightNum === null || (heightNum >= H_MIN && heightNum <= H_MAX);
  const weightValid = weightNum === null || (weightNum >= W_MIN && weightNum <= W_MAX);
  const canSave = heightValid && weightValid;

  const bmi =
    heightNum && weightNum && heightValid && weightValid
      ? weightNum / Math.pow(heightNum / 100, 2)
      : null;

  const handleSave = async () => {
    if (!canSave) return;
    Haptics.selectionAsync().catch(() => {});
    await useUserStore.getState().updateHealthProfile({
      heightCm: heightNum,
      weightKg: weightNum,
    });
    // Refresh the prediction so the explainer's body-context factor updates.
    await useCycleStore.getState().recomputePrediction();
    setSaved(true);
    setTimeout(() => router.back(), 650);
  };

  const handleClear = async () => {
    Haptics.selectionAsync().catch(() => {});
    setHeight('');
    setWeight('');
    await useUserStore.getState().updateHealthProfile({ heightCm: null, weightKg: null });
    await useCycleStore.getState().recomputePrediction();
  };

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
        <View style={styles.header}>
          <PressableScale onPress={() => router.back()} haptic="light" hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
            <Text style={[styles.back, { color: palette.accent }]}>‹ Back</Text>
          </PressableScale>
        </View>

        <Text style={[styles.title, { color: palette.ink }]}>You &amp; your body</Text>
        <Text style={[styles.subtitle, { color: palette.ink2 }]}>
          Optional. Sharing your height and weight lets Dottie explain your prediction a little
          better — some people&apos;s cycles shift at a very low or very high body weight. We never
          judge, diagnose, or share this. It stays on your phone. 🔒
        </Text>

        <GlassCard style={styles.card}>
          <Field
            label="Height"
            unit="cm"
            value={height}
            onChange={(t) => { setHeight(t); setSaved(false); }}
            invalid={!heightValid}
            invalidHint={`Enter a height between ${H_MIN} and ${H_MAX} cm`}
            palette={palette}
          />
          <View style={[styles.divider, { backgroundColor: palette.glass.edge }]} />
          <Field
            label="Weight"
            unit="kg"
            value={weight}
            onChange={(t) => { setWeight(t); setSaved(false); }}
            invalid={!weightValid}
            invalidHint={`Enter a weight between ${W_MIN} and ${W_MAX} kg`}
            palette={palette}
          />
        </GlassCard>

        {/* Gentle context — only a soft note, only at real extremes. */}
        {bmi !== null && (
          <GlassCard style={styles.card} padding={Spacing.md}>
            <Text style={[styles.bmiNote, { color: palette.ink2 }]}>{bmiNote(bmi)}</Text>
          </GlassCard>
        )}

        <PressableScale
          onPress={handleSave}
          haptic="none"
          disabled={!canSave}
          style={[
            styles.saveBtn,
            { backgroundColor: canSave ? palette.accent : palette.glass.bg, borderColor: palette.glass.edge },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Save"
          accessibilityState={{ disabled: !canSave }}
        >
          <Text style={[styles.saveText, { color: canSave ? palette.ground : palette.ink3 }]}>
            {saved ? 'Saved ✓' : 'Save'}
          </Text>
        </PressableScale>

        {(profile?.heightCm != null || profile?.weightKg != null) && (
          <PressableScale
            onPress={handleClear}
            haptic="none"
            style={styles.clearBtn}
            accessibilityRole="button"
            accessibilityLabel="Remove height and weight"
          >
            <Text style={[styles.clearText, { color: palette.ink3 }]}>Remove this info</Text>
          </PressableScale>
        )}

        <View style={{ height: Spacing['3xl'] }} />
      </ScrollView>
    </AuroraBackground>
  );
}

// ─── FIELD ───────────────────────────────────────────────────────────

type Palette = ReturnType<typeof useAurora>['palette'];

function Field({
  label,
  unit,
  value,
  onChange,
  invalid,
  invalidHint,
  palette,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (t: string) => void;
  invalid: boolean;
  invalidHint: string;
  palette: Palette;
}): JSX.Element {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: palette.ink }]}>{label}</Text>
      <View
        style={[
          styles.inputWrap,
          { backgroundColor: palette.glass.bg, borderColor: invalid ? palette.accent2 : palette.glass.edge },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          inputMode="numeric"
          maxLength={5}
          placeholder="—"
          placeholderTextColor={palette.ink3}
          style={[styles.input, { color: palette.ink }]}
          accessibilityLabel={`${label} in ${unit}`}
        />
        <Text style={[styles.unit, { color: palette.ink3 }]}>{unit}</Text>
      </View>
      {invalid && <Text style={[styles.invalidHint, { color: palette.accent2 }]}>{invalidHint}</Text>}
    </View>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────

function parseNum(s: string): number | null {
  const t = s.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** A single, kind, non-diagnostic line — only shown when height+weight are set. */
function bmiNote(bmi: number): string {
  if (bmi < 18.5) {
    return 'At a lower body weight, cycles can sometimes lengthen or pause. Dottie will keep its prediction window a little wider — that’s all.';
  }
  if (bmi > 30) {
    return 'At a higher body weight, cycles can sometimes run longer or be less regular. Dottie will keep its prediction window a little wider — that’s all.';
  }
  return 'Thanks — in this range, body weight has little effect on cycle timing for most people, so it won’t change your prediction much.';
}

// ─── STYLES (layout only — colours inline, palette-driven) ───────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.screenPadding, gap: Spacing.md },
  header: { marginBottom: Spacing.xs },
  back: { ...Typography.preset.bodySemibold },
  title: { ...Typography.preset.h1 },
  subtitle: { ...Typography.preset.body, lineHeight: 22 },
  card: { gap: Spacing.sm },
  field: { gap: Spacing.xs },
  fieldLabel: { ...Typography.preset.bodySemibold },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Spacing.radius.lg,
    paddingHorizontal: Spacing.md,
  },
  input: {
    flex: 1,
    ...Typography.preset.h3,
    paddingVertical: Spacing.md,
  },
  unit: { ...Typography.preset.body },
  invalidHint: { ...Typography.preset.caption },
  divider: { height: 1, marginVertical: Spacing.xs },
  bmiNote: { ...Typography.preset.caption, lineHeight: 18 },
  saveBtn: {
    borderWidth: 1,
    borderRadius: Spacing.radius.full,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  saveText: { ...Typography.preset.button },
  clearBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  clearText: { ...Typography.preset.captionBold },
});
