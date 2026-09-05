/**
 * Dottie — Change your spirit companion
 *
 * The companion is picked once in onboarding and was then permanent, which is
 * the wrong call for a character you live with every day: the owner asked for a
 * way to try a different one (device-test-8). This is that screen.
 *
 * ─── WHY THE PREVIEW IS THE REAL RIG ────────────────────────────────
 *
 *  Every card draws the ACTUAL `CompanionCreature` the app will use, in a live
 *  expression, not an emoji stand-in. Picking a companion from an emoji and
 *  then meeting a different-looking animal on Home is exactly the bug this
 *  round fixed; the picker must not reintroduce it.
 *
 *  The selected card plays `celebrate` so you can see the creature emote before
 *  committing — the whole reason to change is how it feels, not how it reads.
 */

import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { A } from '../../src/theme';
import { AuroraBackground, PressableScale, GradientButton } from '../../src/components/ui';
import { CompanionExpressions } from '../../src/components/ui';
import { CompanionCreature } from '../../src/components/ui/creature/CompanionCreature';
import { useUserStore, selectCompanionType } from '../../src/stores';
import { COMPANIONS } from '../../src/content/companions';
import { COMPANION_TYPES } from '../../src/types/companion.types';
import type { CompanionType } from '../../src/types/companion.types';

export default function ChangeCompanionScreen(): JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const current = useUserStore(selectCompanionType);
  const [picked, setPicked] = useState<CompanionType>(current);
  const [saving, setSaving] = useState(false);

  const changed = picked !== current;

  const save = async () => {
    if (!changed || saving) return;
    setSaving(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try {
      await useUserStore.getState().setCompanion(picked);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuroraBackground>
      <StatusBar style="light" />
      <Stack.Screen options={{ title: 'Your companion', headerShown: true, headerStyle: { backgroundColor: A.ground }, headerTintColor: A.ink }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing['5xl'] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.lede}>
          Whoever you pick guides you everywhere — Home, the calendar, lessons,
          quizzes. Same creature, every screen, every mood.
        </Text>

        {COMPANION_TYPES.map((type, i) => {
          const def = COMPANIONS[type];
          const active = picked === type;
          return (
            <Animated.View key={type} entering={FadeInDown.delay(60 + i * 50).duration(320)}>
              <PressableScale
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setPicked(type);
                }}
                haptic="none"
                scaleTo={0.98}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${def.name} the ${type}`}
                accessibilityHint={def.tagline}
                style={[styles.card, active && styles.cardActive]}
              >
                {/* The real rig, emoting when selected — see header. */}
                <CompanionCreature
                  type={type}
                  state={active ? 'celebrate' : 'idle'}
                  size={64}
                  accessibilityLabel={`${def.name}`}
                />
                <View style={styles.cardText}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{def.name}</Text>
                    {type === current ? (
                      <View style={styles.currentTag}>
                        <Text style={styles.currentTagText}>YOURS</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.tagline}>{def.tagline}</Text>
                  <Text style={styles.style} numberOfLines={2}>
                    {def.dialogueStyle}
                  </Text>
                </View>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? <View style={styles.radioDot} /> : null}
                </View>
              </PressableScale>
              {/* The one you're considering, cycling through its moods (DT21).
                  Owner: "all the expressions of each and every single companion
                  needs to be expressed so that the user will look at it and
                  find out what they want" — but ONE of it, changing face, not
                  three of it in a row. Shown only for the selected card so the
                  list stays scannable. */}
              {active ? (
                <View style={styles.facesRow}>
                  <CompanionExpressions type={type} size={92} playing={active} />
                  <Text style={styles.facesLabel}>
                    This is {def.name} — the same face you&apos;ll see on a win, on an
                    ordinary day, and when yours has been hard.
                  </Text>
                </View>
              ) : null}
            </Animated.View>
          );
        })}

        <Text style={styles.footnote}>
          Changing your companion changes the voice of the app, never your data.
          Everything you&apos;ve logged stays exactly where it is.
        </Text>

        <GradientButton
          label={changed ? `Switch to ${COMPANIONS[picked].name}` : 'This is your companion'}
          onPress={save}
          disabled={!changed || saving}
          style={styles.save}
        />
      </ScrollView>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: Spacing.screenPadding, paddingTop: Spacing.base },
  lede: {
    ...Typography.preset.body,
    color: A.ink2,
    marginBottom: Spacing.base,
    lineHeight: 22,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: A.glass,
    borderWidth: 1,
    borderColor: A.edge,
    borderRadius: Spacing.radius.xl,
    padding: Spacing.cardPadding,
    marginBottom: Spacing.md,
  },
  cardActive: {
    borderColor: A.accent,
    backgroundColor: `${A.accent}14`,
  },
  facesRow: {
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.md,
  },
  facesLabel: {
    ...Typography.preset.caption,
    fontSize: 11,
    color: A.ink3,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
  cardText: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  name: { ...Typography.preset.h4, color: A.ink },
  currentTag: {
    borderWidth: 1,
    borderColor: A.accent2,
    borderRadius: Spacing.radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  currentTagText: { ...Typography.preset.caption, fontSize: 9, color: A.accent2, letterSpacing: 0.5 },
  tagline: { ...Typography.preset.caption, color: A.ink2 },
  style: { ...Typography.preset.caption, fontSize: 11, color: A.ink3, lineHeight: 15 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: A.edge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: { borderColor: A.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: A.accent },
  footnote: {
    ...Typography.preset.caption,
    color: A.ink3,
    lineHeight: 17,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  save: { marginTop: Spacing.sm },
});
