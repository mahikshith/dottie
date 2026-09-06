import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
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
import { CycleLengthCategory } from '../../src/types/cycle.types';
import { addDays, todayCivil } from '../../src/utils/civil-date';

/**
 * Cycle Setup Screen — design-v2 onboarding audit rewrite.
 *
 * The old screen asked "About how many days ago did your last period start?"
 * as a raw number field. Many users genuinely don't remember and stared at
 * an empty box. The new flow presents THREE quick buckets ("A few days ago",
 * "A week or two", "Longer / not sure"), plus a small "Enter a number"
 * escape hatch for the users who DO know. "Longer / not sure" is a full
 * legit answer — the app boots with no `lastPeriodStart` and Home shows
 * the honest "log your period first" get-started state.
 *
 * Cycle length also stays optional (bucket picker). Nothing here gates
 * progress on knowledge the user doesn't have.
 *
 *  ⚠️ design-v2 / UNVERIFIED on device.
 */

interface CycleLengthOption {
  id: CycleLengthCategory;
  label: string;
  days: string;
  emoji: string;
  /** Median cycle length we'll store for this bucket (null = we don't guess) */
  medianDays: number | null;
}

const cycleLengths: CycleLengthOption[] = [
  { id: 'short',     label: 'Short',        days: '21-25 days',  emoji: '⚡', medianDays: 23 },
  { id: 'average',   label: 'Average',      days: '26-30 days',  emoji: '🌿', medianDays: 28 },
  { id: 'long',      label: 'Long',         days: '31-35 days',  emoji: '🌙', medianDays: 33 },
  { id: 'irregular', label: 'Irregular',    days: 'Varies a lot', emoji: '🌊', medianDays: null },
  { id: 'unknown',   label: 'Not sure yet', days: "I'll learn!", emoji: '✨', medianDays: null },
];

// Last-period BUCKETS — for the "don't remember" case. Days values are the
// midpoint we'll seed with when the user picks the bucket without typing
// a precise number.
type LastPeriodBucket = 'few_days' | 'week_or_two' | 'about_month' | 'longer' | 'unknown';
interface LastPeriodOption {
  id: LastPeriodBucket;
  emoji: string;
  label: string;
  hint: string;
  /** Midpoint days-ago we seed with (null = don't set lastPeriodStart at all) */
  midpointDays: number | null;
}
const lastPeriodBuckets: LastPeriodOption[] = [
  { id: 'few_days',    emoji: '🩸', label: 'A few days ago',  hint: '1-5 days',  midpointDays: 3 },
  { id: 'week_or_two', emoji: '🌿', label: 'A week or two',   hint: '6-14 days', midpointDays: 10 },
  { id: 'about_month', emoji: '🌙', label: 'About a month',   hint: '15-30 days', midpointDays: 22 },
  { id: 'longer',      emoji: '🌊', label: 'Longer than that', hint: 'Or not sure', midpointDays: null },
  { id: 'unknown',     emoji: '✨', label: "Not sure at all",  hint: "That's okay — I'll learn", midpointDays: null },
];

/** "Mon 15 Sep" — short, unambiguous, and never a bare ISO string. */
function prettyDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function CycleSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [selectedLength, setSelectedLength] = useState<CycleLengthCategory | null>(null);
  const [selectedBucket, setSelectedBucket] = useState<LastPeriodBucket | null>(null);
  const [showPreciseInput, setShowPreciseInput] = useState(false);
  const [preciseDaysAgo, setPreciseDaysAgo] = useState('');

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const patch: {
      averageCycleLength?: number;
      lastPeriodStart?: string;
    } = {};

    // Cycle length bucket (skip if 'irregular' / 'unknown').
    if (selectedLength) {
      const option = cycleLengths.find((o) => o.id === selectedLength);
      if (option?.medianDays) patch.averageCycleLength = option.medianDays;
    }

    // Last period: precise input wins if the user typed one; else the bucket
    // midpoint; else nothing (a full valid "not sure" answer).
    //
    // Through civil-date, NOT `new Date().toISOString()` — that builds a local
    // date and then serialises it as UTC, which lands on the wrong day either
    // side of Greenwich. It is the exact helper mistake that froze the app for
    // four rounds (CLAUDE.md rule 3), and it was still sitting here.
    if (seededStart) patch.lastPeriodStart = seededStart;

    Storage.onboardingDraft.merge(patch);

    // Route into the new optional reminders opt-in (was 'ready' directly).
    router.push('/(onboarding)/reminders');
  };

  const canContinue = selectedLength !== null; // last period is fully optional

  // ─── WHAT THIS ANSWER WILL ACTUALLY WRITE (device-test-24) ────────
  //
  //  Owner: "if they click on a week before or a month before, we should
  //  actually show them the dates upon which we are going to lock the period
  //  for them… since you clicked on a week before, here are the dates we are
  //  considering for your period input."
  //
  //  Right, and it is the honest half of the DT24 confusion. Picking "a week
  //  or two" writes ONE day — the start — and the calendar then shades the
  //  days around it as an ESTIMATE. Nothing said so, so five shaded days read
  //  as five days the app had decided for you. This says the date out loud
  //  before the tap, and names the estimate as an estimate.
  const preciseNum = parseInt(preciseDaysAgo, 10);
  const daysAgo =
    showPreciseInput && !isNaN(preciseNum) && preciseNum > 0 && preciseNum < 365
      ? preciseNum
      : selectedBucket
        ? (lastPeriodBuckets.find((o) => o.id === selectedBucket)?.midpointDays ?? null)
        : null;
  const seededStart = daysAgo === null ? null : addDays(todayCivil(), -daysAgo);
  const periodLength = 5;
  const seededEnd = seededStart ? addDays(seededStart, periodLength - 1) : null;

  return (
    <AuroraBackground>
      <StatusBar style="light" />
      <View style={[styles.container, { paddingTop: insets.top + Spacing['2xl'] }]}>
        <Animated.View entering={FadeInDown.duration(480).delay(80).springify().damping(16)} style={styles.header}>
          <Text style={styles.title}>Let's set things up 📅</Text>
          <Text style={styles.subtitle}>
            Approximate is totally fine. I get smarter as you use me. 💛
          </Text>
        </Animated.View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Last period — bucket chips first, escape hatch to type a number */}
          <Text style={styles.sectionTitle}>When did your last period start?</Text>

          {lastPeriodBuckets.map((opt, i) => {
            const active = selectedBucket === opt.id && !showPreciseInput;
            return (
              <Animated.View
                key={opt.id}
                entering={FadeInDown.duration(400).delay(140 + i * 40).springify().damping(16)}
              >
                <PressableScale
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setSelectedBucket(opt.id);
                    setShowPreciseInput(false);
                    setPreciseDaysAgo('');
                  }}
                  haptic="none"
                  scaleTo={0.98}
                  style={[styles.chip, active && styles.chipActive]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={styles.chipEmoji}>{opt.emoji}</Text>
                  <View style={styles.chipText}>
                    <Text style={styles.chipLabel}>{opt.label}</Text>
                    <Text style={styles.chipHint}>{opt.hint}</Text>
                  </View>
                </PressableScale>
              </Animated.View>
            );
          })}

          {/* Precise-number escape hatch — the users who DO remember get an
              exact date, without cluttering the flow for the ones who don't. */}
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setShowPreciseInput((s) => !s);
              if (!showPreciseInput) setSelectedBucket(null);
            }}
            style={styles.escapeLink}
            accessibilityRole="button"
          >
            <Text style={styles.escapeText}>
              {showPreciseInput ? 'Hide precise entry' : 'I remember the exact day →'}
            </Text>
          </Pressable>

          {showPreciseInput && (
            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="e.g. 10"
                placeholderTextColor={A.ink3}
                keyboardType="number-pad"
                value={preciseDaysAgo}
                onChangeText={setPreciseDaysAgo}
                maxLength={3}
                accessibilityLabel="Days since your last period started"
              />
              <Text style={styles.inputLabel}>days ago</Text>
            </View>
          )}

          {/* ─── WHAT WE'LL WRITE DOWN (device-test-24) ─────────────
              Its own block in the scroll column with a full section gap below,
              so it can never crowd the cycle-length question underneath. */}
          {seededStart && seededEnd && (
            <Animated.View entering={FadeInDown.duration(320)} style={styles.seedNote}>
              <Text style={styles.seedTitle}>
                We&apos;ll record {prettyDay(seededStart)} as your period start
              </Text>
              <Text style={styles.seedBody}>
                That is the ONE day we log. On the calendar, {prettyDay(seededStart)}–
                {prettyDay(seededEnd)} will be shaded paler as an estimate of the bleed — an
                estimate, not something we recorded for you. Change any of it with a tap.
              </Text>
            </Animated.View>
          )}

          {/* Cycle length — buckets */}
          <Text style={[styles.sectionTitle, styles.sectionSpaced]}>
            How long is your typical cycle?
          </Text>
          <View style={styles.lengthOptions}>
            {cycleLengths.map((option) => (
              <Pressable
                key={option.id}
                style={[styles.lengthChip, selectedLength === option.id && styles.lengthChipSelected]}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setSelectedLength(option.id);
                }}
              >
                <Text style={styles.lengthEmoji}>{option.emoji}</Text>
                <Text style={[styles.lengthLabel, selectedLength === option.id && styles.lengthLabelSelected]}>
                  {option.label}
                </Text>
                <Text style={[styles.lengthDays, selectedLength === option.id && styles.lengthDaysSelected]}>
                  {option.days}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.xl }]}>
          <GradientButton
            label="Continue"
            onPress={handleContinue}
            disabled={!canContinue}
            accessibilityHint="Saves your cycle info and continues"
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
  header: { marginBottom: Spacing.md },
  title: { ...Typography.preset.h2, color: A.ink, marginBottom: Spacing.sm },
  subtitle: { ...Typography.preset.body, color: A.ink2, lineHeight: 24 },

  scroll: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.lg, gap: Spacing.sm },

  sectionTitle: {
    ...Typography.preset.bodySemibold,
    color: A.ink,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  // Its own card in the column, with a section-sized gap below so the next
  // question is never crowded (device-test-24).
  seedNote: {
    borderWidth: 1,
    borderColor: `${A.accent}55`,
    backgroundColor: `${A.accent}12`,
    borderRadius: Spacing.radius.xl,
    padding: Spacing.base,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    gap: 4,
  },
  seedTitle: { ...Typography.preset.bodySemibold, color: A.ink },
  seedBody: { ...Typography.preset.caption, color: A.ink2, fontSize: 12, lineHeight: 17 },
  sectionSpaced: { marginTop: Spacing.xl },

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
  chipActive: { backgroundColor: `${A.accent}22`, borderColor: A.accent },
  chipEmoji: { fontSize: 22 },
  chipText: { flex: 1 },
  chipLabel: { ...Typography.preset.bodySemibold, color: A.ink },
  chipHint: { ...Typography.preset.caption, color: A.ink3, marginTop: 2 },

  escapeLink: { paddingVertical: Spacing.sm, alignItems: 'center' },
  escapeText: { ...Typography.preset.caption, color: A.accent, fontWeight: '700' },

  inputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
  input: {
    backgroundColor: A.glass,
    borderColor: A.edge,
    borderWidth: 1,
    borderRadius: Spacing.radius.xl,
    paddingHorizontal: Spacing.xl,
    height: Spacing.buttonHeight.md,
    width: 100,
    ...Typography.preset.h4,
    color: A.ink,
    textAlign: 'center',
  },
  inputLabel: { ...Typography.preset.body, color: A.ink2 },

  lengthOptions: { gap: Spacing.sm },
  lengthChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: A.glass,
    borderColor: A.edge,
    borderWidth: 1,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderRadius: Spacing.radius.xl,
  },
  lengthChipSelected: { backgroundColor: A.accent, borderColor: A.accent },
  lengthEmoji: { fontSize: 20, marginRight: Spacing.sm },
  lengthLabel: { ...Typography.preset.bodySemibold, color: A.ink, flex: 1 },
  lengthLabelSelected: { color: A.ground },
  lengthDays: { ...Typography.preset.caption, color: A.ink3 },
  lengthDaysSelected: { color: A.ground, opacity: 0.85 },

  footer: { paddingTop: Spacing.md },
});
