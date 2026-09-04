import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { AuroraBackground } from '../../src/components/ui';
import { showAppDialog } from '../../src/components/ui/appDialog';
import { useAurora, PHASE_AURORA } from '../../src/theme';
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
import { AuroraSlider } from '../../src/components/checkin/AuroraSlider';
import {
  SymptomPicker,
  SYMPTOM_CATALOG,
  symptomKey,
  severityToNumber,
} from '../../src/components/checkin/SymptomPicker';
import { MoodWordPicker } from '../../src/components/checkin/MoodWordPicker';
import type { SymptomSeverity } from '../../src/components/checkin/SymptomChip';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // ─── Live store reads ──────────────────────────────────────────
  const companionType = useUserStore(selectCompanionType);
  const phase = useCycleStore(selectCurrentPhase);
  const todayCheckIn = useCycleStore((s) => s.todayCheckIn);

  const { palette, applyMood } = useAurora();
  const companion = getCompanion(companionType);
  const phaseHue = PHASE_AURORA[phase];

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
  // Named moods (valence-independent) — persisted as emotional symptom logs.
  const [moodWords, setMoodWords] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const toggleMoodWord = useCallback((type: string) => {
    Haptics.selectionAsync().catch(() => {});
    setMoodWords((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

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

      // 2b. Persist named moods as emotional symptom logs (append-only), so the
      //     valence score and the specific feelings are both captured.
      for (const type of moodWords) {
        await useCycleStore.getState().logSymptom({
          date: today,
          category: 'emotional',
          symptomType: type,
          severity: 5,
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
      showAppDialog({
        emoji: '😅',
        title: 'Something went wrong',
        body: 'We could not save your check-in. Please try again in a moment.',
        actions: [{ label: 'OK', onPress: () => {} }],
      });
      setSubmitting(false);
    }
  }, [
    submitting,
    mood,
    energy,
    stress,
    sleep,
    symptoms,
    moodWords,
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
    <AuroraBackground>
      <StatusBar style="light" />
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Sheet header */}
      <View style={styles.header}>
        <Pressable
          onPress={onDismiss}
          style={({ pressed }) => [
            styles.closeButton,
            { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
            pressed && { opacity: 0.7 },
          ]}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close check-in"
        >
          <Text style={[styles.closeText, { color: palette.ink2 }]}>✕</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: palette.ink }]}>Today's check-in</Text>
          <Text
            style={[styles.headerSubtitle, { color: phaseHue }]}
          >
            {greeting}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing['3xl'] }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* MOOD */}
        <View style={[styles.section, { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge }]}>
          <SectionHeader
            emoji="💛"
            title="How's your heart today?"
            hint="Pick whatever feels closest. No wrong answer."
          />
          <MoodScale
            kind="mood"
            value={mood}
            onChange={(v, origin) => {
              setMood(v);
              // Logging the mood recolours the whole app (the signature idea) —
              // pass the tap point so the colour RADIATES from the emoji you hit.
              applyMood(v, origin);
            }}
          />
          {/* Named moods — the valence scale sets the colour, these name the
              feelings (they can layer). Stored as emotional symptom logs. */}
          <Text style={[styles.moodWordsLabel, { color: palette.ink3 }]}>
            What's the mood? Optional — pick any that fit
          </Text>
          <MoodWordPicker selected={moodWords} onToggle={toggleMoodWord} />
        </View>

        {/* ENERGY */}
        <View style={[styles.section, { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge }]}>
          <SectionHeader
            emoji="✨"
            title="And your energy?"
            hint="From a quiet new moon to a bright full moon."
          />
          <MoodScale kind="energy" value={energy} onChange={setEnergy} />
        </View>

        {/* STRESS + SLEEP */}
        <View style={[styles.section, { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge }]}>
          <SectionHeader
            emoji="🌿"
            title="How was today?"
            hint="Optional — but it helps Dottie's predictions get smarter."
          />
          <View style={styles.scaleGroup}>
            <Text style={[styles.scaleLabel, { color: palette.ink }]}>Stress today</Text>
            <AuroraSlider
              value={stress}
              onChange={setStress}
              lowLabel="Chill"
              highLabel="Overwhelmed"
              accentColor={phaseHue}
            />
          </View>
          <View style={styles.scaleGroup}>
            <Text style={[styles.scaleLabel, { color: palette.ink }]}>Sleep last night</Text>
            <AuroraSlider
              value={sleep}
              onChange={setSleep}
              lowLabel="Restless"
              highLabel="Restful"
              accentColor={phaseHue}
            />
          </View>
        </View>

        {/* SYMPTOMS */}
        <View style={[styles.section, { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge }]}>
          <SectionHeader
            emoji="🌸"
            title="Anything your body is feeling?"
            hint="Tap what fits. Skip what doesn't."
          />
          <SymptomPicker
            selections={symptoms}
            onChange={setSymptoms}
            excludeCategories={['emotional']}
          />
        </View>

        {/* Bottom padding so the footer doesn't overlap last section */}
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky footer */}
      <View style={[styles.footer, { backgroundColor: palette.ground, borderTopColor: palette.glass.edge }]}>
        {symptomCount > 0 && (
          <Text style={[styles.footerSummary, { color: palette.ink3 }]}>
            {symptomCount} symptom{symptomCount === 1 ? '' : 's'} selected
          </Text>
        )}
        <Pressable
          onPress={onSubmit}
          disabled={submitting}
          style={({ pressed }) => [
            styles.submitButton,
            { backgroundColor: phaseHue },
            (pressed || submitting) && { opacity: 0.85 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Save today's check-in"
        >
          <Text style={[styles.submitText, { color: palette.ground }]}>
            {submitting ? 'Saving…' : 'Save check-in'}
          </Text>
        </Pressable>
      </View>
      </SafeAreaView>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    ...Typography.preset.h4,
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
    borderRadius: Spacing.radius['2xl'],
    borderWidth: 1,
    // device-test-6: was cardPaddingLarge (24) + base (16). The inputs were
    // swimming in dead space and pushed the symptom grid below the fold, so
    // fewer of them got logged. Tightened to fit more in one pane.
    padding: Spacing.cardPadding,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 22,
    elevation: 4,
  },
  scaleGroup: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  scaleLabel: {
    ...Typography.preset.bodySemibold,
  },
  moodWordsLabel: {
    ...Typography.preset.caption,
    fontWeight: '700',
    marginTop: Spacing.sm,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  footerSummary: {
    ...Typography.preset.caption,
    textAlign: 'center',
  },
  submitButton: {
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
  submitText: {
    ...Typography.preset.bodySemibold,
    fontSize: 16,
  },
});
