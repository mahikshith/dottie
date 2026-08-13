import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
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
import { FlowLevelPicker } from '../../../../src/components/sisterhood/FlowLevelPicker';

/**
 * Shadow Period Log Sheet
 *
 * ─── WHAT THIS SCREEN DOES ──────────────────────────────────────────
 *
 *  Replaces the simple "Log a period day for {name}?" alert from
 *  Batch 2A with a real focused experience:
 *
 *    1. Mini calendar — pick the day (defaults to today, can pick
 *       any of the last 14 days)
 *    2. Flow level picker — 5 drop emojis from light to heavy
 *    3. Big confirm button that runs `logShadowPeriod` through the
 *       store, then dismisses with success haptics + celebration
 *
 * ─── DATE STRATEGY ──────────────────────────────────────────────────
 *
 *  We deliberately limit the picker to the last 14 days. The primary
 *  is logging on behalf — they're probably catching up from yesterday
 *  or recording today. Anything older is an edge case that the full
 *  shadow-history editor (future PR) will handle.
 *
 *  No future dates — you can't log a period that hasn't happened.
 *
 * ─── PRIVACY ────────────────────────────────────────────────────────
 *
 *  Period logs are FULL-privacy data by definition. We don't even need
 *  to check the member's privacy level here — only shadow members can
 *  reach this screen (the member detail screen gates the entry).
 */
export default function PeriodLogScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const memberId = id ?? '';

  const userId = useUserStore((s) => s.userId);
  const companionType = useUserStore(selectCompanionType);
  const primaryPhase = useCycleStore(selectCurrentPhase);
  const rawMember = useSisterhoodStore(selectMemberById(memberId));

  const companion = getCompanion(companionType);

  // ─── State ──────────────────────────────────────────────────────
  // Default to today (ISO YYYY-MM-DD)
  const today = useMemo(() => isoDate(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [flowLevel, setFlowLevel] = useState<number>(3); // 1-5
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Build last 14 day options
  const dayOptions = useMemo(() => {
    const days: { date: string; label: string; day: number; isToday: boolean }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = isoDate(d);
      days.push({
        date: iso,
        label: shortDay(d),
        day: d.getDate(),
        isToday: i === 0,
      });
    }
    return days;
  }, []);

  // ─── Handlers ───────────────────────────────────────────────────

  const handleSelectDate = (date: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedDate(date);
  };

  const handleSubmit = async () => {
    if (!userId || !rawMember || isSubmitting) return;
    if (rawMember.kind !== 'shadow') {
      Alert.alert(
        'Linked members track their own cycle',
        `${rawMember.displayName} logs their own period in their Dottie. Sending them a care nudge is the way to support today 💛`
      );
      return;
    }

    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    try {
      await useSisterhoodStore.getState().logShadowPeriod(primaryPhase, {
        memberId,
        date: selectedDate,
        flowLevel,
      });

      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      ).catch(() => {});

      const dayLabel =
        selectedDate === today ? 'today' : `on ${formatFriendly(selectedDate)}`;
      Alert.alert(
        `Logged ${dayLabel} 🌷`,
        `${companion.name} noted ${rawMember.displayName}'s period day. Their phase predictions will update gently.`,
        [{ text: 'Sweet 💛', onPress: () => router.back() }]
      );
    } catch (err) {
      if (__DEV__) console.warn('[PeriodLog] failed:', err);
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

  const isToday = selectedDate === today;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Period day · {rawMember.displayName}</Text>
          <Text style={styles.title}>When did it start?</Text>
          <Text style={styles.subtitle}>
            Pick the day — {companion.name} will update {rawMember.displayName}'s
            phase predictions from there.
          </Text>
        </View>

        {/* Day strip */}
        <Text style={styles.sectionLabel}>Day</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayStrip}
        >
          {dayOptions.map((opt) => {
            const isActive = selectedDate === opt.date;
            return (
              <Pressable
                key={opt.date}
                onPress={() => handleSelectDate(opt.date)}
                style={({ pressed }) => [
                  styles.dayCell,
                  isActive && styles.dayCellActive,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text
                  style={[
                    styles.dayCellLabel,
                    isActive && styles.dayCellLabelActive,
                  ]}
                >
                  {opt.label}
                </Text>
                <Text
                  style={[
                    styles.dayCellDay,
                    isActive && styles.dayCellDayActive,
                  ]}
                >
                  {opt.day}
                </Text>
                {opt.isToday && (
                  <View
                    style={[
                      styles.todayDot,
                      isActive && styles.todayDotActive,
                    ]}
                  />
                )}
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Selected date confirmation */}
        <View style={styles.selectedBanner}>
          <Text style={styles.selectedEmoji}>🌷</Text>
          <Text style={styles.selectedText}>
            Logging{' '}
            <Text style={styles.selectedTextBold}>
              {isToday ? 'today' : formatFriendly(selectedDate)}
            </Text>
            {' '}as a period day for{' '}
            <Text style={styles.selectedTextBold}>{rawMember.displayName}</Text>
          </Text>
        </View>

        {/* Flow level */}
        <Text style={styles.sectionLabel}>How heavy was the flow?</Text>
        <FlowLevelPicker value={flowLevel} onChange={setFlowLevel} />

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
            <Text style={styles.primaryButtonText}>Save 🌷</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ─── DATE HELPERS ────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

function shortDay(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

function formatFriendly(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

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
  // Day strip
  dayStrip: {
    flexDirection: 'row-reverse', // most-recent on the left (right-to-left reverse for scroll)
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  dayCell: {
    width: 60,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface.card,
    borderRadius: Spacing.radius.xl,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...Shadows.sm,
  },
  dayCellActive: {
    backgroundColor: Colors.phase.menstrual.primary,
    borderColor: Colors.phase.menstrual.primary,
  },
  dayCellLabel: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
    marginBottom: 2,
  },
  dayCellLabelActive: {
    color: Colors.text.inverse,
  },
  dayCellDay: {
    ...Typography.preset.number,
    fontSize: 18,
    color: Colors.text.primary,
  },
  dayCellDayActive: {
    color: Colors.text.inverse,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary.coral,
    marginTop: 4,
  },
  todayDotActive: {
    backgroundColor: Colors.text.inverse,
  },
  // Selected banner
  selectedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.phase.menstrual.light,
    padding: Spacing.md,
    borderRadius: Spacing.radius.xl,
    marginTop: Spacing.lg,
    gap: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.phase.menstrual.primary,
  },
  selectedEmoji: {
    fontSize: 24,
  },
  selectedText: {
    ...Typography.preset.body,
    color: Colors.text.primary,
    flex: 1,
    lineHeight: 22,
  },
  selectedTextBold: {
    fontWeight: '700',
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
