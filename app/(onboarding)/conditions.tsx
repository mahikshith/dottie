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
import {
  CONDITION_OPTIONS as OPTIONS,
  ENGINE_CONDITIONS,
  type ConditionKey,
} from '../../src/content/conditions';

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
// The list, the icons and the "does this change the forecast?" flag all live
// in src/content/conditions.ts now — one source, shared with add-to-circle and
// read by the transparency panel and the export (device-test-23).

export default function ConditionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<Set<ConditionKey>>(new Set());

  /** Which row is showing its explainer. One at a time — this is a list to
   *  scan, not a wall of text to read. */
  const [open, setOpen] = useState<ConditionKey | null>(null);

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
    // Narrow on the LIST, not on a hardcoded triple. The old version repeated
    // the three original ids inline, so every condition added after it would
    // have been ticked, saved to the draft, and then silently dropped here
    // before it ever reached the engine (device-test-16).
    const engineSet = new Set<string>(ENGINE_CONDITIONS);
    const engine = Array.from(selected).filter((k): k is HealthCondition =>
      engineSet.has(k)
    );
    Storage.onboardingDraft.merge({
      healthConditions: engine.length > 0 ? engine : [],
    });
    router.push('/(onboarding)/cycle-setup');
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
    router.push('/(onboarding)/cycle-setup');
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
                <View>
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
                    {/* ─── "WHAT IS THIS?" (device-test-29) ──────────────
                        A separate target from the row itself, because the
                        person who does not know what PCOD is must be able to
                        FIND OUT without ticking it first. Ticking is the
                        expensive action — an ovulatory condition widens the
                        model's prior for every forecast afterwards — so the
                        cheap action gets its own button. */}
                    <PressableScale
                      onPress={() => setOpen(open === opt.id ? null : opt.id)}
                      haptic="none"
                      scaleTo={0.9}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      style={styles.info}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: open === opt.id }}
                      accessibilityLabel={`What is ${opt.label}?`}
                    >
                      <Text style={styles.infoGlyph}>{open === opt.id ? '×' : '?'}</Text>
                    </PressableScale>
                    <View style={[styles.tick, active && styles.tickActive]}>
                      {active ? <Text style={styles.tickMark}>✓</Text> : null}
                    </View>
                  </PressableScale>

                  {open === opt.id && (
                    <Animated.View entering={FadeInDown.duration(220)} style={styles.explain}>
                      <Text style={styles.explainBody}>{opt.what}</Text>
                      <Text style={styles.explainLabel}>WHY WE ASK</Text>
                      <Text style={styles.explainBody}>{opt.why}</Text>
                      <Text style={styles.explainLabel}>
                        {opt.affectsPrediction ? 'WHAT IT DOES TO THE FORECAST' : 'EFFECT ON THE FORECAST'}
                      </Text>
                      <Text
                        style={[
                          styles.explainBody,
                          opt.affectsPrediction && styles.explainBodyStrong,
                        ]}
                      >
                        {opt.predictionEffect}
                      </Text>
                      {opt.affectsPrediction && (
                        <Text style={styles.explainWarn}>
                          Only tick this if a clinician has told you. A guess here changes the
                          maths for every forecast afterwards.
                        </Text>
                      )}
                    </Animated.View>
                  )}
                </View>
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
  // ─── THE EXPLAINER PANEL ──────────────────────────────────────────
  //
  //  Owner: "it should be in a white colour or something, small font — if we
  //  add any cement colour it won't display" on the deep aurora ground. So the
  //  body text is the same near-white ink the rest of the app uses at a small
  //  size, and the SEPARATION comes from a lifted panel and a lit left edge
  //  rather than from dimming the words.
  info: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${A.accent}55`,
    backgroundColor: `${A.accent}12`,
    marginRight: Spacing.sm,
  },
  infoGlyph: { color: A.accent, fontSize: 13, fontWeight: '800', lineHeight: 16 },
  explain: {
    marginTop: 6,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.base,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    gap: 6,
    borderLeftWidth: 2,
    borderLeftColor: `${A.accent}88`,
    borderRadius: Spacing.radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  explainLabel: {
    ...Typography.preset.caption,
    fontSize: 10,
    letterSpacing: 0.9,
    fontWeight: '800',
    color: A.accent,
    marginTop: 4,
  },
  explainBody: {
    ...Typography.preset.caption,
    fontSize: 12.5,
    lineHeight: 18,
    color: A.ink,
  },
  explainBodyStrong: { color: A.ink, fontWeight: '600' },
  explainWarn: {
    ...Typography.preset.caption,
    fontSize: 12,
    lineHeight: 17,
    color: A.gold,
    marginTop: 6,
  },
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
