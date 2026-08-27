import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { AuroraBackground } from '../../src/components/ui';
import { A } from '../../src/theme';
import { Storage } from '../../src/database/storage';
import { UserMode } from '../../src/types/cycle.types';

/**
 * Mode Selection Screen
 *
 * ─── WHAT CHANGED FROM CHUNK 1 ──────────────────────────────────────
 *
 *  - Persists selected mode into MMKV's onboarding draft via
 *    `Storage.onboardingDraft.merge({ mode })`.
 *  - Mode literal is now the typed `UserMode` from cycle.types so
 *    the rest of the funnel + the final completeOnboarding call stay
 *    type-safe.
 *  - Soft haptic on selection.
 */

interface ModeOption {
  id: UserMode;
  emoji: string;
  title: string;
  description: string;
  ageHint: string;
}

const modes: ModeOption[] = [
  {
    id: 'teen',
    emoji: '🌸',
    title: 'Teen',
    description: "New to periods? I'll keep things simple and supportive.",
    ageHint: 'Ages 11-18',
  },
  {
    id: 'adult',
    emoji: '🌿',
    title: 'Adult',
    description: 'Full cycle tracking with detailed insights and predictions.',
    ageHint: 'Ages 18+',
  },
  {
    id: 'endocrine',
    emoji: '🦋',
    title: 'Irregular Cycles',
    description: 'PCOS, thyroid, or irregular periods? I adapt to you.',
    ageHint: 'Any age',
  },
];

export default function ModeSelectScreen() {
  const router = useRouter();

  const handleModeSelect = (mode: UserMode) => {
    Haptics.selectionAsync().catch(() => {});

    // Merge into existing draft (doesn't wipe other fields if user goes back)
    Storage.onboardingDraft.merge({ mode });

    router.push('/(onboarding)/companion-select');
  };

  return (
    <AuroraBackground>
      <StatusBar style="light" />
      <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tell me about you! 💛</Text>
        <Text style={styles.subtitle}>
          This helps me personalize your experience.{'\n'}
          You can always change this later.
        </Text>
      </View>

      <View style={styles.options}>
        {modes.map((mode) => (
          <Pressable
            key={mode.id}
            style={({ pressed }) => [
              styles.modeCard,
              pressed && styles.modeCardPressed,
            ]}
            onPress={() => handleModeSelect(mode.id)}
          >
            <Text style={styles.modeEmoji}>{mode.emoji}</Text>
            <View style={styles.modeContent}>
              <View style={styles.modeTitleRow}>
                <Text style={styles.modeTitle}>{mode.title}</Text>
                <Text style={styles.modeAge}>{mode.ageHint}</Text>
              </View>
              <Text style={styles.modeDescription}>{mode.description}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      <Text style={styles.footer}>
        No account needed. Everything stays on your device. 🔒
      </Text>
      </View>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing['5xl'],
    paddingBottom: Spacing['3xl'],
  },
  header: {
    marginBottom: Spacing['3xl'],
  },
  title: {
    ...Typography.preset.h2,
    color: A.ink,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.preset.body,
    color: A.ink2,
    lineHeight: 24,
  },
  options: {
    gap: Spacing.base,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: A.glass, borderColor: A.edge, borderWidth: 1,
    padding: Spacing.cardPaddingLarge,
    borderRadius: Spacing.radius['2xl'],
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 22, elevation: 6,
  },
  modeCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  modeEmoji: {
    fontSize: 36,
    marginRight: Spacing.base,
  },
  modeContent: {
    flex: 1,
  },
  modeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  modeTitle: {
    ...Typography.preset.h4,
    color: A.ink,
  },
  modeAge: {
    ...Typography.preset.caption,
    color: A.ink3,
  },
  modeDescription: {
    ...Typography.preset.body,
    color: A.ink2,
  },
  footer: {
    ...Typography.preset.caption,
    color: A.ink3,
    textAlign: 'center',
    marginTop: 'auto',
    paddingTop: Spacing.xl,
  },
});