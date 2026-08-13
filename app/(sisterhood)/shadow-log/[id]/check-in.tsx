import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../../../src/constants/colors';
import { Typography } from '../../../../src/constants/typography';
import { Spacing } from '../../../../src/constants/spacing';
import { Shadows } from '../../../../src/constants/shadows';
import {
  useUserStore,
  useCycleStore,
  useSisterhoodStore,
  selectCompanionType,
  selectCurrentPhase,
  selectMemberById,
} from '../../../../src/stores';
import { getCompanion } from '../../../../src/content/companions';
import { MoodScale } from '../../../../src/components/sisterhood/MoodScale';

/**
 * Shadow Check-In Sheet
 *
 * ─── WHAT THIS SCREEN DOES ──────────────────────────────────────────
 *
 *  Replaces the 3-button Alert mood picker from Batch 2A with a real
 *  warm sheet:
 *
 *    - Mood scale (5-emoji 😢 😕 😐 🙂 😊 with semantic labels)
 *    - Energy scale (5-emoji 🌑 🌘 🌗 🌖 🌕 with semantic labels)
 *    - Optional private note (only the primary ever sees it)
 *    - Big confirm button that runs `logShadowCheckIn` through the
 *      store
 *
 *  Defaults are NEUTRAL (mood 3 / energy 3) — we don't want to bias
 *  the primary toward either direction. They tap to commit.
 *
 * ─── COPY TONE ──────────────────────────────────────────────────────
 *
 *  Mood scale labels are emotional but grounded — never clinical.
 *  Energy scale uses moon phases as a metaphor (waning → full) because
 *  cycles + moons are an established Dottie metaphor.
 *
 * ─── PRIVACY NOTES ──────────────────────────────────────────────────
 *
 *  The notes field is captured into `shadow_check_ins.notes`, which
 *  the engine's privacy filter NEVER projects to the primary or anyone
 *  else. It's a "for the primary's eyes only" memory aid — useful for
 *  catching patterns later ("She was tired the week before her period
 *  every month").
 */
export default function CheckInScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const memberId = id ?? '';

  const userId = useUserStore((s) => s.userId);
  const companionType = useUserStore(selectCompanionType);
  const primaryPhase = useCycleStore(selectCurrentPhase);
  const rawMember = useSisterhoodStore(selectMemberById(memberId));

  const companion = getCompanion(companionType);

  // ─── State ──────────────────────────────────────────────────────
  const [moodScore, setMoodScore] = useState<number>(3);
  const [energyLevel, setEnergyLevel] = useState<number>(3);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Handlers ───────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!userId || !rawMember || isSubmitting) return;
    if (rawMember.kind !== 'shadow') {
      Alert.alert(
        'Linked members check in themselves',
        `${rawMember.displayName} logs their own moods in their Dottie. Sending a care nudge is the way to support today 💛`
      );
      return;
    }

    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    const today = new Date().toISOString().split('T')[0]!;

    try {
      await useSisterhoodStore.getState().logShadowCheckIn(primaryPhase, {
        memberId,
        date: today,
        moodScore,
        energyLevel,
        notes: notes.trim() || null,
      });

      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      ).catch(() => {});

      const moodWord = MOOD_LABELS[moodScore - 1] ?? 'okay';
      Alert.alert(
        `Logged 💛`,
        `${companion.name} noted that ${rawMember.displayName} is ${moodWord.toLowerCase()} today.`,
        [{ text: 'Sweet 💛', onPress: () => router.back() }]
      );
    } catch (err) {
      if (__DEV__) console.warn('[CheckIn] failed:', err);
      Alert.alert(
        'Could not log',
        "Something gentle went sideways — could you try again in a moment?"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────

  if (!rawMember) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.primary.coral} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Check-in · {rawMember.displayName}</Text>
          <Text style={styles.title}>How are they doing?</Text>
          <Text style={styles.subtitle}>
            {companion.name} keeps this private to you. It helps spot
            patterns over time.
          </Text>
        </View>

        {/* Mood */}
        <Text style={styles.sectionLabel}>Mood today</Text>
        <View style={styles.scaleCard}>
          <MoodScale
            kind="mood"
            value={moodScore}
            onChange={(v) => {
              Haptics.selectionAsync().catch(() => {});
              setMoodScore(v);
            }}
          />
          <Text style={styles.scaleLabel}>{MOOD_LABELS[moodScore - 1]}</Text>
        </View>

        {/* Energy */}
        <Text style={styles.sectionLabel}>Energy today</Text>
        <View style={styles.scaleCard}>
          <MoodScale
            kind="energy"
            value={energyLevel}
            onChange={(v) => {
              Haptics.selectionAsync().catch(() => {});
              setEnergyLevel(v);
            }}
          />
          <Text style={styles.scaleLabel}>{ENERGY_LABELS[energyLevel - 1]}</Text>
        </View>

        {/* Notes */}
        <Text style={styles.sectionLabel}>Anything to remember?</Text>
        <View style={styles.notesCard}>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Private note — just for you. Skip if nothing comes to mind."
            placeholderTextColor={Colors.text.tertiary}
            style={styles.notesInput}
            multiline
            maxLength={300}
            textAlignVertical="top"
          />
          <Text style={styles.notesCounter}>{notes.length} / 300</Text>
        </View>

        <View style={{ height: Spacing['4xl'] }} />
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.actionBar}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleSubmit}
          disabled={isSubmitting}
          style={({ pressed }) => [
            styles.primaryButton,
            isSubmitting && styles.primaryButtonDisabled,
            pressed && !isSubmitting && {
              opacity: 0.92,
              transform: [{ scale: 0.98 }],
            },
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color={Colors.text.inverse} />
          ) : (
            <Text style={styles.primaryButtonText}>Save 💛</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── LABELS ──────────────────────────────────────────────────────────

const MOOD_LABELS = [
  'Really tough',
  'A bit low',
  'Okay',
  'Pretty good',
  'Glowing',
];

const ENERGY_LABELS = [
  'Drained',
  'Low',
  'Steady',
  'Energetic',
  'Full power',
];

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.surface.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: Colors.surface.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.lg,
  },
  // Header
  header: {
    marginBottom: Spacing.xl,
  },
  eyebrow: {
    ...Typography.preset.overline,
    color: Colors.primary.coral,
    marginBottom: Spacing.xs,
  },
  title: {
    ...Typography.preset.h2,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  sectionLabel: {
    ...Typography.preset.captionBold,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  // Scale card
  scaleCard: {
    backgroundColor: Colors.surface.card,
    padding: Spacing.cardPadding,
    borderRadius: Spacing.radius['2xl'],
    alignItems: 'center',
    ...Shadows.card,
  },
  scaleLabel: {
    ...Typography.preset.bodySemibold,
    color: Colors.text.primary,
    marginTop: Spacing.md,
  },
  // Notes
  notesCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: Spacing.radius['2xl'],
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.light,
    minHeight: 120,
    ...Shadows.sm,
  },
  notesInput: {
    ...Typography.preset.body,
    color: Colors.text.primary,
    minHeight: 80,
    lineHeight: 22,
  },
  notesCounter: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  // Action bar
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
    backgroundColor: Colors.surface.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  secondaryButton: {
    flex: 1,
    height: Spacing.buttonHeight.lg,
    borderRadius: Spacing.radius.full,
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.border.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    ...Typography.preset.button,
    color: Colors.text.secondary,
  },
  primaryButton: {
    flex: 2,
    height: Spacing.buttonHeight.lg,
    borderRadius: Spacing.radius.full,
    backgroundColor: Colors.primary.coral,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.button,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    ...Typography.preset.button,
    color: Colors.text.inverse,
  },
});
