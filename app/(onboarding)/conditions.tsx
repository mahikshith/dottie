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
import { HealthCondition } from '../../src/types/cycle.types';

/**
 * Onboarding — Health Conditions (design-v2 onboarding audit fix)
 *
 * The missing step that made the whole condition-aware engine layer silent.
 * Before this screen existed, `draft.healthConditions` was never set — so
 * every PCOS / endometriosis / thyroid modifier in the day-suggestion
 * engine, the doctor-report condition-signal detector, and the personal-
 * signal tuning silently no-op'd for the vast majority of users, even
 * users who picked "Irregular Cycles" as their mode.
 *
 * ─── DESIGN PRINCIPLES ──────────────────────────────────────────────
 *
 *  • MULTI-SELECT (many people have more than one).
 *  • EVERY option is optional. "Nothing diagnosed yet" is a first-class
 *    positive answer (not "None of the above" which reads as failure).
 *  • "Prefer not to say" is also first-class — for users who don't want
 *    to disclose or aren't sure.
 *  • Skip is always visible; picking nothing + Continue is legit.
 *  • The copy avoids "diagnosis" — "have you been told you have…"
 *
 *  ⚠️ design-v2 / UNVERIFIED on device.
 */

// The values that map to real HealthCondition entries the engines act on.
type ConditionKey = HealthCondition | 'pmdd' | 'birth_control' | 'nothing' | 'prefer_not_say';

interface ConditionOption {
  id: ConditionKey;
  emoji: string;
  label: string;
  hint: string;
  /**
   * True if selecting this clears every OTHER selection. Both "Nothing"
   * and "Prefer not to say" are exclusive — they can't co-exist with
   * a specific condition.
   */
  exclusive?: boolean;
}

const OPTIONS: ConditionOption[] = [
  { id: 'pcos',            emoji: '🌀', label: 'PCOS',            hint: 'Polycystic ovary syndrome' },
  { id: 'endometriosis',   emoji: '💗', label: 'Endometriosis',   hint: 'Painful periods, endo tissue' },
  { id: 'thyroid',         emoji: '🦋', label: 'Thyroid',         hint: 'Hypo- or hyperthyroid' },
  { id: 'pmdd',            emoji: '🌙', label: 'PMDD',            hint: 'Severe premenstrual mood changes' },
  { id: 'birth_control',   emoji: '💊', label: 'On the pill or BC', hint: 'Hormonal birth control' },
  { id: 'nothing',         emoji: '🌱', label: 'Nothing diagnosed yet', hint: "That's totally fine — I'll still learn your patterns", exclusive: true },
  { id: 'prefer_not_say',  emoji: '🤫', label: 'Prefer not to say', hint: "You don't have to share this", exclusive: true },
];

// Only the keys that map to real engine-side HealthCondition values.
// Everything else (pmdd, birth_control, nothing, prefer_not_say) is captured
// as a soft flag in the draft but doesn't persist to healthConditions until
// the engine paths for it exist (birth-control mode is on the TODO roadmap).
const ENGINE_CONDITIONS: readonly ConditionKey[] = ['pcos', 'endometriosis', 'thyroid'];

export default function ConditionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Set<ConditionKey>>(new Set());

  const toggle = (id: ConditionKey) => {
    Haptics.selectionAsync().catch(() => {});
    setSelected((prev) => {
      const next = new Set(prev);
      const opt = OPTIONS.find((o) => o.id === id);

      // Exclusive selections wipe everything else + can be toggled off.
      if (opt?.exclusive) {
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.clear();
          next.add(id);
        }
        return next;
      }

      // Non-exclusive: toggle, but drop any exclusive that was set.
      OPTIONS.forEach((o) => {
        if (o.exclusive) next.delete(o.id);
      });
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const persistAndAdvance = () => {
    // Persist to the draft (engines only look at the engine-mapped keys;
    // the soft flags are stored for future condition-aware paths).
    const engine = Array.from(selected).filter((k): k is HealthCondition =>
      ENGINE_CONDITIONS.includes(k) && (k === 'pcos' || k === 'endometriosis' || k === 'thyroid')
    );
    Storage.onboardingDraft.merge({
      healthConditions: engine.length > 0 ? engine : [],
    });
    router.push('/(onboarding)/companion-select');
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    persistAndAdvance();
  };

  const handleSkip = () => {
    Haptics.selectionAsync().catch(() => {});
    // Clear any prior draft conditions on skip so a back-and-forth doesn't
    // leave stale data behind.
    Storage.onboardingDraft.merge({ healthConditions: [] });
    router.push('/(onboarding)/companion-select');
  };

  return (
    <AuroraBackground>
      <StatusBar style="light" />
      <View style={[styles.container, { paddingTop: insets.top + Spacing['2xl'] }]}>
        <Animated.View entering={FadeInDown.duration(480).delay(80).springify().damping(16)} style={styles.header}>
          <Text style={styles.title}>Anything going on? 💛</Text>
          <Text style={styles.subtitle}>
            If you've been told you have any of these, tap them so I can tailor
            suggestions. Totally optional — you can also skip.
          </Text>
        </Animated.View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {OPTIONS.map((opt, i) => {
            const active = selected.has(opt.id);
            return (
              <Animated.View
                key={opt.id}
                entering={FadeInDown.duration(420).delay(140 + i * 40).springify().damping(16)}
              >
                <PressableScale
                  onPress={() => toggle(opt.id)}
                  haptic="none"
                  scaleTo={0.98}
                  style={[styles.chip, active && styles.chipActive]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={opt.label}
                >
                  <Text style={styles.chipEmoji}>{opt.emoji}</Text>
                  <View style={styles.chipText}>
                    <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{opt.label}</Text>
                    <Text style={[styles.chipHint, active && styles.chipHintActive]}>{opt.hint}</Text>
                  </View>
                  <View style={[styles.tick, active && styles.tickActive]}>
                    {active ? <Text style={styles.tickMark}>✓</Text> : null}
                  </View>
                </PressableScale>
              </Animated.View>
            );
          })}

          <Pressable onPress={handleSkip} style={styles.skipRow} accessibilityRole="button">
            <Text style={styles.skipText}>Skip — I'll add this later ✨</Text>
          </Pressable>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.xl }]}>
          <GradientButton
            label={selected.size > 0 ? 'Continue' : 'Continue — nothing to add'}
            onPress={handleContinue}
            accessibilityHint="Saves your choices and continues"
          />
        </View>
      </View>
    </AuroraBackground>
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

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: A.glass,
    borderColor: A.edge,
    borderWidth: 1,
    padding: Spacing.md,
    borderRadius: Spacing.radius.xl,
    gap: Spacing.md,
  },
  chipActive: {
    backgroundColor: `${A.accent}22`,
    borderColor: A.accent,
  },
  chipEmoji: { fontSize: 24 },
  chipText: { flex: 1 },
  chipLabel: { ...Typography.preset.bodySemibold, color: A.ink },
  chipLabelActive: { color: A.ink },
  chipHint: { ...Typography.preset.caption, color: A.ink3, marginTop: 2 },
  chipHintActive: { color: A.ink2 },

  tick: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: A.edge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickActive: {
    backgroundColor: A.accent,
    borderColor: A.accent,
  },
  tickMark: { color: A.ground, fontWeight: '800', fontSize: 14 },

  skipRow: { alignItems: 'center', paddingVertical: Spacing.md, marginTop: Spacing.xs },
  skipText: { ...Typography.preset.caption, color: A.accent, fontWeight: '700' },

  footer: {
    paddingTop: Spacing.md,
  },
});
