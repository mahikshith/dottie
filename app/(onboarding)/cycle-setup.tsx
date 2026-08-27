import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { AuroraBackground } from '../../src/components/ui';
import { A } from '../../src/theme';
import { Storage } from '../../src/database/storage';
import { CycleLengthCategory } from '../../src/types/cycle.types';

/**
 * Cycle Setup Screen
 *
 * ─── WHAT CHANGED FROM CHUNK 1 ──────────────────────────────────────
 *
 *  - Persists cycle setup to the MMKV draft:
 *      • `lastPeriodStart`        — derived from "days ago" input
 *      • `averageCycleLength`     — derived from the selected length bucket
 *  - Length category typed via `CycleLengthCategory` from cycle.types.
 *  - "I don't know" is fully supported — pressing Continue without a
 *    date input simply omits `lastPeriodStart` from the draft, and the
 *    prediction engine handles missing-data gracefully.
 *
 * ─── WHY DAYS-AGO INSTEAD OF A DATE PICKER ──────────────────────────
 *
 *  A date picker would force the user to navigate to a specific date,
 *  which feels heavy and clinical. "How many days ago?" is how people
 *  actually think about it ("um, like a week and a half ago?"). The
 *  store converts to an ISO date right before persisting.
 */

interface CycleLengthOption {
  id: CycleLengthCategory;
  label: string;
  days: string;
  emoji: string;
  /** Median cycle length we'll store for this bucket */
  medianDays: number | null;
}

const cycleLengths: CycleLengthOption[] = [
  { id: 'short', label: 'Short', days: '21-25 days', emoji: '⚡', medianDays: 23 },
  { id: 'average', label: 'Average', days: '26-30 days', emoji: '🌿', medianDays: 28 },
  { id: 'long', label: 'Long', days: '31-35 days', emoji: '🌙', medianDays: 33 },
  { id: 'irregular', label: 'Irregular', days: 'Varies a lot', emoji: '🌊', medianDays: null },
  { id: 'unknown', label: 'Not sure yet', days: "I'll learn!", emoji: '✨', medianDays: null },
];

export default function CycleSetupScreen() {
  const router = useRouter();
  const [selectedLength, setSelectedLength] = useState<CycleLengthCategory | null>(null);
  const [lastPeriodDays, setLastPeriodDays] = useState<string>('');

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    // Build the patch — only set fields the user actually answered.
    const patch: {
      averageCycleLength?: number;
      lastPeriodStart?: string;
    } = {};

    // Median cycle length from the bucket (skip if 'irregular' / 'unknown')
    if (selectedLength) {
      const option = cycleLengths.find(o => o.id === selectedLength);
      if (option?.medianDays) {
        patch.averageCycleLength = option.medianDays;
      }
    }

    // Convert "days ago" → ISO date string (YYYY-MM-DD)
    const daysAgoNum = parseInt(lastPeriodDays, 10);
    if (!isNaN(daysAgoNum) && daysAgoNum > 0 && daysAgoNum < 365) {
      const date = new Date();
      date.setDate(date.getDate() - daysAgoNum);
      patch.lastPeriodStart = date.toISOString().split('T')[0]!;
    }

    Storage.onboardingDraft.merge(patch);

    router.push('/(onboarding)/ready');
  };

  const canContinue = selectedLength !== null;

  return (
    <AuroraBackground>
      <StatusBar style="light" />
      <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Let's set things up 📅</Text>
        <Text style={styles.subtitle}>
          Don't worry — approximate is totally fine!{'\n'}
          I get smarter the more you use me.
        </Text>
      </View>

      {/* Last period question */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          About how many days ago did your last period start?
        </Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="e.g. 10"
            placeholderTextColor={A.ink3}
            keyboardType="number-pad"
            value={lastPeriodDays}
            onChangeText={setLastPeriodDays}
            maxLength={3}
          />
          <Text style={styles.inputLabel}>days ago</Text>
        </View>
        <Pressable onPress={() => setLastPeriodDays('')}>
          <Text style={styles.skipText}>Not sure? Skip this — I'll learn! ✨</Text>
        </Pressable>
      </View>

      {/* Cycle length question */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          How long is your typical cycle?
        </Text>
        <View style={styles.lengthOptions}>
          {cycleLengths.map((option) => (
            <Pressable
              key={option.id}
              style={[
                styles.lengthChip,
                selectedLength === option.id && styles.lengthChipSelected,
              ]}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setSelectedLength(option.id);
              }}
            >
              <Text style={styles.lengthEmoji}>{option.emoji}</Text>
              <Text style={[
                styles.lengthLabel,
                selectedLength === option.id && styles.lengthLabelSelected,
              ]}>
                {option.label}
              </Text>
              <Text style={[
                styles.lengthDays,
                selectedLength === option.id && styles.lengthDaysSelected,
              ]}>
                {option.days}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          style={[
            styles.button,
            !canContinue && styles.buttonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!canContinue}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </Pressable>
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
    paddingTop: Spacing['5xl'],
    paddingBottom: Spacing['3xl'],
  },
  header: {
    marginBottom: Spacing['2xl'],
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
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.preset.bodySemibold,
    color: A.ink,
    marginBottom: Spacing.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  input: {
    backgroundColor: A.glass, borderColor: A.edge, borderWidth: 1,
    borderRadius: Spacing.radius.xl,
    paddingHorizontal: Spacing.xl,
    height: Spacing.buttonHeight.md,
    width: 100,
    ...Typography.preset.h4,
    color: A.ink,
    textAlign: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  inputLabel: {
    ...Typography.preset.body,
    color: A.ink2,
  },
  skipText: {
    ...Typography.preset.caption,
    color: A.accent,
    marginTop: Spacing.sm,
  },
  lengthOptions: {
    gap: Spacing.sm,
  },
  lengthChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: A.glass, borderColor: A.edge, borderWidth: 1,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderRadius: Spacing.radius.xl,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  lengthChipSelected: {
    backgroundColor: A.accent,
  },
  lengthEmoji: {
    fontSize: 20,
    marginRight: Spacing.sm,
  },
  lengthLabel: {
    ...Typography.preset.bodySemibold,
    color: A.ink,
    flex: 1,
  },
  lengthLabelSelected: {
    color: A.ground,
  },
  lengthDays: {
    ...Typography.preset.caption,
    color: A.ink3,
  },
  lengthDaysSelected: {
    color: A.ground,
    opacity: 0.85,
  },
  footer: {
    marginTop: 'auto',
  },
  button: {
    backgroundColor: A.accent,
    height: Spacing.buttonHeight.lg,
    borderRadius: Spacing.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    ...Typography.preset.button,
    color: A.ground,
  },
});