import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { Shadows } from '../../src/constants/shadows';
import { Storage } from '../../src/database/storage';
import { getAllCompanions } from '../../src/content/companions';
import { CompanionType } from '../../src/types/companion.types';

/**
 * Companion Selection Screen
 *
 * ─── WHAT CHANGED FROM CHUNK 1 ──────────────────────────────────────
 *
 *  - Source of truth for companions is now `src/content/companions.ts`
 *    (`getAllCompanions()`) — single canonical list shared with the
 *    dialogue engine. No more hardcoded copies that drift.
 *  - The greeting shown in each card uses the companion's REAL
 *    follicular-phase greeting (representative neutral phase) — what
 *    you preview here is what you'll actually hear in the app.
 *  - Selection persists `companionType` into the MMKV draft.
 *  - Lower-impact haptic on selection (warm tap, not buzzing).
 */
export default function CompanionSelectScreen() {
  const router = useRouter();

  const companions = getAllCompanions();

  const handleCompanionSelect = (type: CompanionType) => {
    Haptics.selectionAsync().catch(() => {});

    Storage.onboardingDraft.merge({ companionType: type });

    // Pre-mirror the companion type so the splash on next launch can
    // render the right mascot immediately. (completeOnboarding does
    // this too, but doing it here means even if the user backgrounds
    // the app between screens, the splash still gets it.)
    Storage.companionType.set(type);

    router.push('/(onboarding)/cycle-setup');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Choose your companion! 🤝</Text>
        <Text style={styles.subtitle}>
          They'll be with you every step — cheering you on,{'\n'}
          sharing insights, and celebrating your wins.
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
      >
        {companions.map((companion) => (
          <Pressable
            key={companion.type}
            style={({ pressed }) => [
              styles.companionCard,
              { borderColor: companion.accentColor },
              pressed && styles.companionCardPressed,
            ]}
            onPress={() => handleCompanionSelect(companion.type)}
          >
            <Text style={styles.companionEmoji}>{companion.emoji}</Text>
            <Text style={styles.companionName}>{companion.name}</Text>
            <Text
              style={[
                styles.companionPersonality,
                { color: companion.accentColor },
              ]}
            >
              {companion.tagline}
            </Text>
            <Text style={styles.companionGreeting}>
              "{companion.greetings.follicular}"
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface.background,
    paddingTop: Spacing['5xl'],
  },
  header: {
    paddingHorizontal: Spacing.screenPadding,
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.preset.h2,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
    lineHeight: 24,
  },
  scrollView: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.screenPadding,
    gap: Spacing.base,
    paddingBottom: Spacing['3xl'],
  },
  companionCard: {
    width: '47%',
    backgroundColor: Colors.surface.card,
    padding: Spacing.cardPadding,
    borderRadius: Spacing.radius['2xl'],
    alignItems: 'center',
    borderWidth: 2,
    ...Shadows.card,
  },
  companionCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },
  companionEmoji: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  companionName: {
    ...Typography.preset.h4,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  companionPersonality: {
    ...Typography.preset.captionBold,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  companionGreeting: {
    ...Typography.preset.caption,
    color: Colors.text.secondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});