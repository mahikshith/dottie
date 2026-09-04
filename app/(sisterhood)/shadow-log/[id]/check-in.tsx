/**
 * Shadow Check-In Sheet — MOOD AURORA (design-v2)
 *
 * Log a mood/energy on behalf of a shadow member of the Sisterhood circle.
 * Re-skinned to aurora (it shares the now-aurora MoodScale); all logic — the
 * shadow-vs-linked guard, `logShadowCheckIn`, the private note, labels — is
 * unchanged. The note stays private to the primary (engine never projects it).
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device).
 */

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
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../../../src/constants/typography';
import { Spacing } from '../../../../src/constants/spacing';
import { AuroraBackground } from '../../../../src/components/ui';
import { showAppDialog } from '../../../../src/components/ui/appDialog';
import { useAurora } from '../../../../src/theme';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CheckInScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const memberId = id ?? '';

  const { palette } = useAurora();
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
      showAppDialog({
        emoji: '💛',
        title: 'Linked members check in themselves',
        body: `${rawMember.displayName} logs their own moods in their Dottie. Sending a care nudge is the way to support today 💛`,
        actions: [{ label: 'OK', onPress: () => {} }],
      });
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

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      const moodWord = MOOD_LABELS[moodScore - 1] ?? 'okay';
      showAppDialog({
        emoji: '💛',
        title: 'Logged',
        body: `${companion.name} noted that ${rawMember.displayName} is ${moodWord.toLowerCase()} today.`,
        actions: [{ label: 'Sweet 💛', onPress: () => router.back() }],
      });
    } catch (err) {
      if (__DEV__) console.warn('[CheckIn] failed:', err);
      showAppDialog({
        emoji: '😅',
        title: 'Could not log',
        body: 'Something gentle went sideways — could you try again in a moment?',
        actions: [{ label: 'OK', onPress: () => {} }],
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────

  if (!rawMember) {
    return (
      <AuroraBackground>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={palette.accent} />
        </View>
      </AuroraBackground>
    );
  }

  return (
    <AuroraBackground>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing['3xl'] }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.eyebrow, { color: palette.accent }]}>Check-in · {rawMember.displayName}</Text>
            <Text style={[styles.title, { color: palette.ink }]}>How are they doing?</Text>
            <Text style={[styles.subtitle, { color: palette.ink2 }]}>
              {companion.name} keeps this private to you. It helps spot patterns over time.
            </Text>
          </View>

          {/* Mood */}
          <Text style={[styles.sectionLabel, { color: palette.ink2 }]}>Mood today</Text>
          <View style={[styles.scaleCard, { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge }]}>
            <MoodScale
              kind="mood"
              value={moodScore}
              onChange={(v) => { Haptics.selectionAsync().catch(() => {}); setMoodScore(v); }}
            />
            <Text style={[styles.scaleLabel, { color: palette.ink }]}>{MOOD_LABELS[moodScore - 1]}</Text>
          </View>

          {/* Energy */}
          <Text style={[styles.sectionLabel, { color: palette.ink2 }]}>Energy today</Text>
          <View style={[styles.scaleCard, { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge }]}>
            <MoodScale
              kind="energy"
              value={energyLevel}
              onChange={(v) => { Haptics.selectionAsync().catch(() => {}); setEnergyLevel(v); }}
            />
            <Text style={[styles.scaleLabel, { color: palette.ink }]}>{ENERGY_LABELS[energyLevel - 1]}</Text>
          </View>

          {/* Notes */}
          <Text style={[styles.sectionLabel, { color: palette.ink2 }]}>Anything to remember?</Text>
          <View style={[styles.notesCard, { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge }]}>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Private note — just for you. Skip if nothing comes to mind."
              placeholderTextColor={palette.ink3}
              style={[styles.notesInput, { color: palette.ink }]}
              multiline
              maxLength={300}
              textAlignVertical="top"
            />
            <Text style={[styles.notesCounter, { color: palette.ink3 }]}>{notes.length} / 300</Text>
          </View>

          <View style={{ height: Spacing['4xl'] }} />
        </ScrollView>

        {/* Bottom action bar */}
        <View style={[styles.actionBar, { backgroundColor: palette.ground, borderTopColor: palette.glass.edge }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.secondaryButton,
              { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={[styles.secondaryButtonText, { color: palette.ink2 }]}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSubmit}
            disabled={isSubmitting}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: palette.accent },
              isSubmitting && styles.primaryButtonDisabled,
              pressed && !isSubmitting && { opacity: 0.92, transform: [{ scale: 0.98 }] },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator color={palette.ground} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: palette.ground }]}>Save 💛</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </AuroraBackground>
  );
}

// ─── LABELS ──────────────────────────────────────────────────────────

const MOOD_LABELS = ['Really tough', 'A bit low', 'Okay', 'Pretty good', 'Glowing'];
const ENERGY_LABELS = ['Drained', 'Low', 'Steady', 'Energetic', 'Full power'];

// ─── STYLES (layout only — colours inline, palette-driven) ───────────

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.screenPadding, paddingTop: Spacing.lg },
  header: { marginBottom: Spacing.xl },
  eyebrow: { ...Typography.preset.overline, marginBottom: Spacing.xs },
  title: { ...Typography.preset.h2, marginBottom: Spacing.sm },
  subtitle: { ...Typography.preset.body, lineHeight: 22 },
  sectionLabel: {
    ...Typography.preset.captionBold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  scaleCard: {
    padding: Spacing.cardPadding,
    borderRadius: Spacing.radius['2xl'],
    borderWidth: 1,
    alignItems: 'center',
  },
  scaleLabel: { ...Typography.preset.bodySemibold, marginTop: Spacing.md },
  notesCard: {
    borderRadius: Spacing.radius['2xl'],
    padding: Spacing.md,
    borderWidth: 1,
    minHeight: 120,
  },
  notesInput: { ...Typography.preset.body, minHeight: 80, lineHeight: 22 },
  notesCounter: { ...Typography.preset.caption, textAlign: 'right', marginTop: Spacing.xs },
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
    borderTopWidth: 1,
  },
  secondaryButton: {
    flex: 1,
    height: Spacing.buttonHeight.lg,
    borderRadius: Spacing.radius.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: { ...Typography.preset.button },
  primaryButton: {
    flex: 2,
    height: Spacing.buttonHeight.lg,
    borderRadius: Spacing.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 6,
  },
  primaryButtonDisabled: { opacity: 0.5 },
  primaryButtonText: { ...Typography.preset.button },
});
