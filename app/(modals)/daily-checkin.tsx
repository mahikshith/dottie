import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { Shadows } from '../../src/constants/shadows';
import {
  useCycleStore,
  useGamificationStore,
  useUserStore,
  selectCompanionType,
  selectCurrentPhase,
} from '../../src/stores';
import { getCompanion } from '../../src/content/companions';
import { MoodScale } from '../../src/components/sisterhood/MoodScale';
import { SectionHeader } from '../../src/components/checkin/SectionHeader';
import { ScalePicker } from '../../src/components/checkin/ScalePicker';
import {
  SymptomPicker,
  SYMPTOM_CATALOG,
  symptomKey,
  severityToNumber,
} from '../../src/components/checkin/SymptomPicker';
import type { SymptomSeverity } from '../../src/components/checkin/SymptomChip';

/**
 * Daily Check-In Modal — Polished version (Batch 2)
 *
 * ─── WHAT CHANGED IN CHUNK 9 BATCH 2 ────────────────────────────────
 *
 *  The form portion is UNCHANGED from Batch 1. What changed is the
 *  post-submit moment.
 *
 *  Before (Batch 1):
 *    Submit → inline success block → 1.7s auto-dismiss → back to Home.
 *    Functional, but the moment evaporates and milestones felt flat.
 *
 *  Now (Batch 2):
 *    Submit → router.replace() into ONE of three celebration modals
 *    based on what just happened:
 *
 *        result.milestone !== null          ──► /(modals)/streak-celebration
 *        result.leveledUp === true          ──► /(modals)/level-up
 *        (default — streak ok or broken)    ──► /(modals)/checkin-recap
 *
 *    We use router.replace() not router.push() so the check-in modal
 *    is popped from the stack before the celebration mounts — closing
 *    the celebration returns the user straight to Home, not back into
 *    a stale check-in form.
 *
 *    Why three modals instead of one? Because milestone moments,
 *    level-ups, and regular days each deserve different visual weight.
 *    A 7-day streak doesn't feel right with a quiet recap card; a
 *    normal Tuesday doesn't need confetti. The shared CelebrationSheet
 *    primitive keeps the chrome consistent.
 *
 *    Tiered priority is intentional: a milestone always wins over a
 *    level-up which always wins over a recap, even if multiple flags
 *    are true. The user only sees ONE celebration per submit so the
 *    moment stays clean. We could chain them in a later polish pass.
 *
 * ─── EVERYTHING ELSE IS UNCHANGED ───────────────────────────────────
 *
 *    Pre-fill from existing check-in, four section layout, symptom
 *    multi-select, optimistic Haptics, store action calls — all the
 *    same wiring Batch 1 shipped.
 */
export default function DailyCheckInScreen() {
  const router = useRouter();

  // ─── Live store reads ──────────────────────────────────────────
  const companionType = useUserStore(selectCompanionType);
  const phase = useCycleStore(selectCurrentPhase);
  const todayCheckIn = useCycleStore((s) => s.todayCheckIn);

  const companion = getCompanion(companionType);
  const phaseColors = Colors.phase[phase];

  // ─── Form state (initialized from any existing check-in) ───────
  const [mood, setMood] = useState<number>(todayCheckIn?.moodScore ?? 3);
  const [energy, setEnergy] = useState<number>(todayCheckIn?.energyLevel ?? 3);
  const [stress, setStress] = useState<number | null>(
    todayCheckIn?.stressLevel ?? null
  );
  const [sleep, setSleep] = useState<number | null>(
    todayCheckIn?.sleepQuality ?? null
  );
  const [symptoms, setSymptoms] = useState<Record<string, SymptomSeverity>>({});
  const [submitting, setSubmitting] = useState(false);

  // Whenever the modal opens (or todayCheckIn updates), sync prefill.
  useEffect(() => {
    if (todayCheckIn) {
      if (todayCheckIn.moodScore !== null) setMood(todayCheckIn.moodScore);
      if (todayCheckIn.energyLevel !== null) setEnergy(todayCheckIn.energyLevel);
      if (todayCheckIn.stressLevel !== null) setStress(todayCheckIn.stressLevel);
      if (todayCheckIn.sleepQuality !== null) setSleep(todayCheckIn.sleepQuality);
    }
  }, [todayCheckIn]);

  // ─── Greeting copy ─────────────────────────────────────────────
  const greeting = useMemo(() => {
    return `${companion.name} is listening ${companion.emoji}`;
  }, [companion]);

  // ─── Submit handler ────────────────────────────────────────────
  const onSubmit = useCallback(async () => {
    if (submitting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSubmitting(true);

    const today = new Date().toISOString().split('T')[0]!;

    try {
      // 1. Save the headline check-in fields. Engine auto-reruns prediction
      //    if stress or sleep changed.
      await useCycleStore.getState().saveCheckIn({
        date: today,
        moodScore: mood,
        energyLevel: energy,
        stressLevel: stress ?? undefined,
        sleepQuality: sleep ?? undefined,
      });

      // 2. Persist each selected symptom (append-only by design — same
      //    pattern the quick mood log uses).
      const symptomEntries = Object.entries(symptoms);
      for (const [key, sev] of symptomEntries) {
        const item = SYMPTOM_CATALOG.find((s) => symptomKey(s) === key);
        if (!item) continue;
        await useCycleStore.getState().logSymptom({
          date: today,
          category: item.category,
          symptomType: item.type,
          severity: severityToNumber(sev),
          phaseAtLog: phase,
        });
      }

      // 3. Bump streak / XP / gems via gamification engine.
      const result = await useGamificationStore
        .getState()
        .recordCheckIn(today);

      // 4. Pick the right celebration. Priority: milestone > levelUp > recap.
      //    Using router.replace() drops this check-in modal from the stack
      //    so closing the celebration returns to Home, not back into the form.
      if (result.milestone !== null) {
        router.replace({
          pathname: '/(modals)/streak-celebration',
          params: {
            streak: String(result.newStreakCount),
            xp: String(result.xpAwarded),
            gems: String(result.gemsAwarded),
            milestone: String(result.milestone),
            message: result.message,
          },
        });
      } else if (result.leveledUp) {
        router.replace({
          pathname: '/(modals)/level-up',
          params: {
            newLevel: String(result.newLevel),
            xp: String(result.xpAwarded),
          },
        });
      } else {
        router.replace({
          pathname: '/(modals)/checkin-recap',
          params: {
            xp: String(result.xpAwarded),
            gems: String(result.gemsAwarded),
            streakBroken: String(result.streakBroken),
            message: result.message,
          },
        });
      }
    } catch (err) {
      if (__DEV__) console.warn('[DailyCheckIn] submit failed:', err);
      Alert.alert(
        'Something went wrong',
        'We could not save your check-in. Please try again in a moment.',
        [{ text: 'OK' }]
      );
      setSubmitting(false);
    }
  }, [
    submitting,
    mood,
    energy,
    stress,
    sleep,
    symptoms,
    phase,
    router,
  ]);

  // ─── Dismiss handler ───────────────────────────────────────────
  const onDismiss = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    router.back();
  }, [router]);

  // ─── Symptom count (for footer summary) ────────────────────────
  const symptomCount = Object.keys(symptoms).length;

  // ─── FORM STATE ────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Sheet header */}
      <View style={styles.header}>
        <Pressable
          onPress={onDismiss}
          style={({ pressed }) => [
            styles.closeButton,
            pressed && { opacity: 0.7 },
          ]}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close check-in"
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Today's check-in</Text>
          <Text
            style={[styles.headerSubtitle, { color: phaseColors.primary }]}
          >
            {greeting}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* MOOD */}
        <View style={styles.section}>
          <SectionHeader
            emoji="💛"
            title="How's your heart today?"
            hint="Pick whatever feels closest. No wrong answer."
          />
          <MoodScale kind="mood" value={mood} onChange={setMood} />
        </View>

        {/* ENERGY */}
        <View style={styles.section}>
          <SectionHeader
            emoji="✨"
            title="And your energy?"
            hint="From a quiet new moon to a bright full moon."
          />
          <MoodScale kind="energy" value={energy} onChange={setEnergy} />
        </View>

        {/* STRESS + SLEEP */}
        <View style={styles.section}>
          <SectionHeader
            emoji="🌿"
            title="How was today?"
            hint="Optional — but it helps Dottie's predictions get smarter."
          />
          <View style={styles.scaleGroup}>
            <Text style={styles.scaleLabel}>Stress today</Text>
            <ScalePicker
              value={stress}
              onChange={setStress}
              lowLabel="Chill"
              highLabel="Overwhelmed"
              accentColor={phaseColors.primary}
            />
          </View>
          <View style={styles.scaleGroup}>
            <Text style={styles.scaleLabel}>Sleep last night</Text>
            <ScalePicker
              value={sleep}
              onChange={setSleep}
              lowLabel="Restless"
              highLabel="Restful"
              accentColor={phaseColors.primary}
            />
          </View>
        </View>

        {/* SYMPTOMS */}
        <View style={styles.section}>
          <SectionHeader
            emoji="🌸"
            title="Anything your body is feeling?"
            hint="Tap what fits. Skip what doesn't."
          />
          <SymptomPicker selections={symptoms} onChange={setSymptoms} />
        </View>

        {/* Bottom padding so the footer doesn't overlap last section */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky footer */}
      <View style={styles.footer}>
        {symptomCount > 0 && (
          <Text style={styles.footerSummary}>
            {symptomCount} symptom{symptomCount === 1 ? '' : 's'} selected
          </Text>
        )}
        <Pressable
          onPress={onSubmit}
          disabled={submitting}
          style={({ pressed }) => [
            styles.submitButton,
            { backgroundColor: phaseColors.primary },
            (pressed || submitting) && { opacity: 0.85 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Save today's check-in"
        >
          <Text style={styles.submitText}>
            {submitting ? 'Saving…' : 'Save check-in'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface.cardElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 16,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...Typography.preset.h4,
    color: Colors.text.primary,
  },
  headerSubtitle: {
    ...Typography.preset.caption,
    fontWeight: '600',
    marginTop: 2,
  },
  headerSpacer: {
    width: 36,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.sm,
  },
  section: {
    backgroundColor: Colors.surface.card,
    borderRadius: Spacing.radius['2xl'],
    padding: Spacing.cardPaddingLarge,
    marginBottom: Spacing.base,
    ...Shadows.sm,
  },
  scaleGroup: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  scaleLabel: {
    ...Typography.preset.bodySemibold,
    color: Colors.text.primary,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    backgroundColor: Colors.surface.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
    gap: Spacing.sm,
  },
  footerSummary: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
    textAlign: 'center',
  },
  submitButton: {
    height: Spacing.buttonHeight.lg,
    borderRadius: Spacing.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.card,
  },
  submitText: {
    ...Typography.preset.bodySemibold,
    color: Colors.text.inverse,
    fontSize: 16,
  },
});
