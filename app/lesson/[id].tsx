import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { AuroraBackground, CompanionLottie } from '../../src/components/ui';
import { useAurora, PHASE_AURORA } from '../../src/theme';

const AURORA_SUCCESS = '#6FE6A8';
import {
  useUserStore,
  useGamificationStore,
  selectCompanionType,
} from '../../src/stores';
import { getCompanion } from '../../src/content/companions';
import {
  getLesson,
  getLearningPath,
  getLessonsForPath,
} from '../../src/content/learning-paths';
import { getExercisesForLesson } from '../../src/content/exercises';
import { contentRepository, LessonProgress } from '../../src/database/repositories/content.repo';
import { Phase } from '../../src/types/cycle.types';
import type { LessonSection as LessonSectionType } from '../../src/types/content.types';
import { CelebrationDialog, type DialogAction } from '../../src/components/ui/CelebrationDialog';
import { logSilentFailure } from '../../src/diagnostics/silent-failure';

/**
 * Lesson Detail Screen — Renders a single lesson and awards completion XP.
 *
 * ─── FLOW ───────────────────────────────────────────────────────────
 *
 *  1. Read lesson ID from route params
 *  2. Look up lesson + path from bundled content
 *  3. On mount: mark lesson as 'in_progress' (idempotent)
 *  4. Render sections (paragraph, heading, callout, fact, tip, divider)
 *  5. User reads through, taps "Mark Complete"
 *  6. On complete:
 *       - Persist lesson as 'complete' via contentRepository
 *       - Award XP + gems via gamification store
 *       - If this was the last lesson in the path, award path bonus
 *       - If lesson has a quizId, offer to take the quiz next
 *
 * ─── SECTION STYLING ────────────────────────────────────────────────
 *
 *  Different section types render differently:
 *    - heading:   Bold, larger text
 *    - paragraph: Normal body text
 *    - callout:   Colored card with emoji (phase-aware highlight)
 *    - fact:      Subtle inset card with emoji
 *    - tip:       Coral accent
 *    - divider:   Thin horizontal rule
 *
 *  Callouts and facts can specify a `highlight` color (one of the four
 *  phases or 'warm'/'cool') for thematic consistency.
 */
export default function LessonDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserStore((s) => s.userId);
  const companionType = useUserStore(selectCompanionType);
  const companion = getCompanion(companionType);
  const { palette } = useAurora();
  const insets = useSafeAreaInsets();

  // ─── Resolve lesson + path ──────────────────────────────────────
  const lesson = useMemo(() => (id ? getLesson(id) : null), [id]);
  const path = useMemo(
    () => (lesson?.pathId ? getLearningPath(lesson.pathId) : null),
    [lesson?.pathId]
  );

  const [progress, setProgress] = useState<LessonProgress | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [dialog, setDialog] = useState<{
    emoji: string;
    title: string;
    body?: string;
    actions: DialogAction[];
  } | null>(null);

  // ─── Mark as started on mount, load existing progress ───────────
  useEffect(() => {
    if (!userId || !lesson) return;

    let cancelled = false;
    (async () => {
      try {
        const existing = await contentRepository.getLessonProgress(userId, lesson.id);

        if (existing) {
          if (!cancelled) setProgress(existing);
          return;
        }

        // No progress yet — create the in_progress row
        const fresh: LessonProgress = {
          lessonId: lesson.id,
          pathId: lesson.pathId,
          status: 'in_progress',
          startedAt: new Date().toISOString(),
          completedAt: null,
          quizScore: null,
          xpEarned: 0,
          gemsEarned: 0,
        };
        await contentRepository.saveLessonProgress(userId, fresh);
        if (!cancelled) setProgress(fresh);
      } catch (err) {
        logSilentFailure('lesson.start', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, lesson]);

  // ─── Complete handler ───────────────────────────────────────────
  const handleComplete = async () => {
    if (!userId || !lesson || !path || isCompleting) return;
    if (progress?.status === 'complete') {
      // Already done — just go back
      router.back();
      return;
    }

    setIsCompleting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    try {
      // Persist completion
      const completed: LessonProgress = {
        lessonId: lesson.id,
        pathId: lesson.pathId,
        status: 'complete',
        startedAt: progress?.startedAt ?? new Date().toISOString(),
        completedAt: new Date().toISOString(),
        quizScore: progress?.quizScore ?? null,
        xpEarned: lesson.xpReward,
        gemsEarned: lesson.gemReward,
      };
      await contentRepository.saveLessonProgress(userId, completed);
      setProgress(completed);

      // Award XP + gems
      const xpResult = await useGamificationStore
        .getState()
        .awardXp('lesson_complete', { overrideAmount: lesson.xpReward });
      // Use quiz_complete as the gem source since lesson completion isn't its
      // own GemSource; the description disambiguates in the transaction log.
      const gemResult = await useGamificationStore
        .getState()
        .earnGems('quiz_complete');

      // Check if this was the last lesson of the path → path bonus
      const pathLessons = getLessonsForPath(path.id);
      const allProgress = await contentRepository.getAllLessonProgress(userId);
      const completedSet = new Set(
        allProgress.filter((p) => p.status === 'complete').map((p) => p.lessonId)
      );
      const pathComplete = pathLessons.every((l) => completedSet.has(l.id));

      if (pathComplete) {
        const pathXp = await useGamificationStore
          .getState()
          .awardXp('badge_unlock', { overrideAmount: path.completionXP });
        await useGamificationStore.getState().earnGems('badge_unlock');
        await useGamificationStore.getState().unlockBadge(path.completionBadgeId, {
          pathId: path.id,
          completedAt: new Date().toISOString(),
        });

        setDialog({
          emoji: path.emoji,
          title: `${path.title} complete!`,
          body: `You finished the whole path!\n+${path.completionXP} XP · +${path.completionGems} 💎`,
          actions: [{ label: 'Yay! 🎉', onPress: () => { setDialog(null); router.back(); } }],
        });

        // Touch pathXp so it's not unused
        void pathXp;
        return;
      }

      // Otherwise just celebrate the lesson. Prefer the interactive practice
      // (exercises) when the lesson has any — the exercise screen chains to the
      // quiz at the end, so the flow is: read → practice → quiz.
      const hasExercises = getExercisesForLesson(lesson.id).length > 0;
      const rewardLine = `+${xpResult.xpAwarded} XP · +${gemResult.gemsAwarded}💎`;

      if (hasExercises) {
        setDialog({
          emoji: '✨',
          title: 'Lesson complete!',
          body: `${rewardLine}\n\nReady to practice what you learned?`,
          actions: [
            { label: 'Practice ✨', onPress: () => { setDialog(null); router.replace(`/exercise/${lesson.id}`); } },
            { label: 'Later', variant: 'ghost', onPress: () => { setDialog(null); router.back(); } },
          ],
        });
      } else if (lesson.quizId) {
        setDialog({
          emoji: '✨',
          title: 'Lesson complete!',
          body: `${rewardLine}\n\nWant to take the quiz?`,
          actions: [
            { label: 'Take the quiz →', onPress: () => { setDialog(null); router.replace(`/quiz/${lesson.quizId}`); } },
            { label: 'Later', variant: 'ghost', onPress: () => { setDialog(null); router.back(); } },
          ],
        });
      } else {
        setDialog({
          emoji: '🌟',
          title: 'Lesson complete!',
          body: rewardLine,
          actions: [{ label: 'Nice!', onPress: () => { setDialog(null); router.back(); } }],
        });
      }
    } catch (err) {
      logSilentFailure('lesson.complete', err);
      setDialog({
        emoji: '😅',
        title: "That didn't save",
        body: "I couldn't save your progress just now. Want to try again?",
        actions: [{ label: 'OK', onPress: () => setDialog(null) }],
      });
    } finally {
      setIsCompleting(false);
    }
  };

  if (!lesson || !path) {
    return (
      <AuroraBackground>
        <StatusBar style="light" />
        <View style={styles.notFoundContainer}>
          <Stack.Screen options={{ title: '' }} />
          <Text style={styles.notFoundEmoji}>🤔</Text>
          <Text style={[styles.notFoundTitle, { color: palette.ink }]}>Lesson not found</Text>
          <Pressable style={[styles.notFoundButton, { backgroundColor: palette.accent }]} onPress={() => router.back()}>
            <Text style={[styles.notFoundButtonText, { color: palette.ground }]}>Go back</Text>
          </Pressable>
        </View>
      </AuroraBackground>
    );
  }

  const accent = path.gradient[0];
  const isComplete = progress?.status === 'complete';

  // When already done, offer a COMPACT next step instead of a giant button:
  // practice → quiz → review, whichever the lesson has.
  const hasExercises = getExercisesForLesson(lesson.id).length > 0;
  const reviewLabel = hasExercises ? 'Practice →' : lesson.quizId ? 'Quiz →' : 'Review';
  const handleReviewNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (hasExercises) router.replace(`/exercise/${lesson.id}`);
    else if (lesson.quizId) router.replace(`/quiz/${lesson.quizId}`);
    else router.back();
  };

  return (
    <AuroraBackground>
      <StatusBar style="light" />
      <Stack.Screen
        options={{
          headerShown: true,
          title: path.title,
          headerStyle: { backgroundColor: palette.ground },
          headerTintColor: palette.ink,
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          // Clear the gesture bar. The lesson's action deliberately stays at the
          // END of the reading (unlike the exercise player, which pins it):
          // pinning a button over a page of text would cover the thing you are
          // there to read, and you only press it once, at the end.
          { paddingBottom: insets.bottom + Spacing['3xl'] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Lesson header */}
        <View style={[styles.lessonHeader, { backgroundColor: `${accent}22`, borderColor: `${accent}55` }]}>
          <Text style={styles.lessonEmoji}>{lesson.emoji}</Text>
          <Text style={[styles.lessonTitle, { color: palette.ink }]}>{lesson.title}</Text>
          <Text style={[styles.lessonMeta, { color: palette.ink3 }]}>
            {lesson.estimatedMinutes} min · {lesson.xpReward} XP · {lesson.gemReward}💎
          </Text>
        </View>

        {/* Companion intro — the animated spirit companion greets the lesson */}
        <View style={[styles.companionIntro, { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge }]}>
          <CompanionLottie type={companionType} state="idle" size={44} style={styles.companionIntroArt} />
          <Text style={[styles.companionIntroText, { color: palette.ink2 }]}>
            {isComplete
              ? `${companion.name} is proud — you've already learned this! Reviewing is wisdom.`
              : `${companion.name} is here to walk you through this with you.`}
          </Text>
        </View>

        {/* Sections */}
        <View style={styles.sections}>
          {lesson.sections.map((section, idx) => (
            <SectionRenderer key={idx} section={section} pathAccent={accent} />
          ))}
        </View>

        {/* Complete CTA — compact when already done (owner: don't hog space) */}
        {isComplete ? (
          <View style={styles.completeRow}>
            <View style={[styles.donePill, { backgroundColor: `${AURORA_SUCCESS}22`, borderColor: AURORA_SUCCESS }]}>
              <Text style={[styles.donePillText, { color: AURORA_SUCCESS }]}>✓ Completed</Text>
            </View>
            <Pressable
              onPress={handleReviewNext}
              style={({ pressed }) => [
                styles.nextChip,
                { backgroundColor: accent },
                pressed && styles.completeButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={reviewLabel}
            >
              <Text style={[styles.nextChipText, { color: palette.ground }]}>{reviewLabel}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.completeButton,
              { backgroundColor: palette.accent },
              (pressed || isCompleting) && styles.completeButtonPressed,
            ]}
            onPress={handleComplete}
            disabled={isCompleting}
          >
            <Text style={[styles.completeButtonText, { color: palette.ground }]}>
              {isCompleting ? 'Saving...' : 'Mark as Complete'}
            </Text>
          </Pressable>
        )}

        {/* Quiz hint */}
        {lesson.quizId && !isComplete && (
          <Text style={[styles.quizHint, { color: palette.ink3 }]}>
            A short quiz will be offered after completing.
          </Text>
        )}

      </ScrollView>

      <CelebrationDialog
        visible={dialog !== null}
        emoji={dialog?.emoji ?? ''}
        title={dialog?.title ?? ''}
        body={dialog?.body}
        actions={dialog?.actions ?? []}
        onRequestClose={() => setDialog(null)}
      />
    </AuroraBackground>
  );
}

// ─── SECTION RENDERER ────────────────────────────────────────────────

function SectionRenderer({
  section,
  pathAccent,
}: {
  section: LessonSectionType;
  pathAccent: string;
}) {
  const { palette } = useAurora();
  switch (section.type) {
    case 'heading':
      return <Text style={[styles.sectionHeading, { color: palette.ink }]}>{section.content}</Text>;

    case 'paragraph':
      return <Text style={[styles.sectionParagraph, { color: palette.ink }]}>{section.content}</Text>;

    case 'divider':
      return <View style={[styles.sectionDivider, { backgroundColor: palette.glass.edge }]} />;

    case 'callout': {
      const hue = resolveHighlightColor(section.highlight, pathAccent);
      return (
        <View style={[styles.calloutCard, { backgroundColor: `${hue}1F`, borderLeftColor: hue }]}>
          {section.emoji && <Text style={styles.calloutEmoji}>{section.emoji}</Text>}
          <Text style={[styles.calloutText, { color: palette.ink }]}>{section.content}</Text>
        </View>
      );
    }

    case 'fact': {
      const hue = resolveHighlightColor(section.highlight, pathAccent);
      return (
        <View style={[styles.factCard, { backgroundColor: palette.glass.bg, borderColor: `${hue}66` }]}>
          {section.emoji && <Text style={styles.factEmoji}>{section.emoji}</Text>}
          <Text style={[styles.factText, { color: palette.ink2 }]}>{section.content}</Text>
        </View>
      );
    }

    case 'tip':
      return (
        <View style={[styles.tipCard, { backgroundColor: palette.glass.bg, borderLeftColor: palette.accent }]}>
          {section.emoji && <Text style={styles.tipEmoji}>{section.emoji}</Text>}
          <Text style={[styles.tipText, { color: palette.ink }]}>{section.content}</Text>
        </View>
      );

    case 'image':
    default:
      return null; // Image rendering deferred to a later chunk
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────

// Map a section highlight to a constant aurora hue (phase identity stays
// consistent across moods; warm→gold, cool→teal, else the path accent).
function resolveHighlightColor(
  highlight: LessonSectionType['highlight'] | undefined,
  fallback: string
): string {
  if (!highlight) return fallback;
  if (highlight === 'warm') return PHASE_AURORA.ovulatory;
  if (highlight === 'cool') return PHASE_AURORA.follicular;
  return PHASE_AURORA[highlight as Phase];
}

// Touch import so unused-import warnings don't trigger in dev
// (LessonSectionType from content.types is used for section typing above.)

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.base,
  },
  lessonHeader: {
    padding: Spacing.cardPaddingLarge,
    borderRadius: Spacing.radius['2xl'],
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  lessonEmoji: {
    fontSize: 40,
    marginBottom: Spacing.sm,
  },
  lessonTitle: {
    ...Typography.preset.h3,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  lessonMeta: {
    ...Typography.preset.caption,
  },
  companionIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: Spacing.md,
    borderRadius: Spacing.radius.xl,
    marginBottom: Spacing.sectionGap,
  },
  companionEmoji: {
    fontSize: 28,
    marginRight: Spacing.md,
  },
  companionIntroArt: {
    marginRight: Spacing.md,
  },
  companionIntroText: {
    ...Typography.preset.body,
    flex: 1,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  sections: {
    gap: Spacing.base,
    marginBottom: Spacing.sectionGap,
  },
  sectionHeading: {
    ...Typography.preset.h4,
    marginTop: Spacing.md,
  },
  sectionParagraph: {
    ...Typography.preset.body,
    lineHeight: 26,
  },
  sectionDivider: {
    height: 1,
    marginVertical: Spacing.md,
  },
  calloutCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.cardPadding,
    borderRadius: Spacing.radius.xl,
    borderLeftWidth: 4,
  },
  calloutEmoji: {
    fontSize: 24,
    marginRight: Spacing.md,
  },
  calloutText: {
    ...Typography.preset.body,
    flex: 1,
    lineHeight: 22,
  },
  factCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.cardPadding,
    borderRadius: Spacing.radius.xl,
    borderWidth: 1.5,
  },
  factEmoji: {
    fontSize: 24,
    marginRight: Spacing.md,
  },
  factText: {
    ...Typography.preset.body,
    flex: 1,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.cardPadding,
    borderRadius: Spacing.radius.xl,
    borderLeftWidth: 4,
  },
  tipEmoji: {
    fontSize: 24,
    marginRight: Spacing.md,
  },
  tipText: {
    ...Typography.preset.bodySemibold,
    flex: 1,
    lineHeight: 22,
  },
  completeButton: {
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
  completeButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  completeButtonText: {
    ...Typography.preset.button,
  },
  completeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  donePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: Spacing.radius.full,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  donePillText: {
    ...Typography.preset.captionBold,
  },
  nextChip: {
    height: Spacing.buttonHeight.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Spacing.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 5,
  },
  nextChipText: {
    ...Typography.preset.button,
  },
  quizHint: {
    ...Typography.preset.caption,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  notFoundEmoji: {
    fontSize: 64,
    marginBottom: Spacing.lg,
  },
  notFoundTitle: {
    ...Typography.preset.h3,
    marginBottom: Spacing.xl,
  },
  notFoundButton: {
    paddingHorizontal: Spacing['3xl'],
    height: Spacing.buttonHeight.md,
    borderRadius: Spacing.radius.full,
    justifyContent: 'center',
  },
  notFoundButtonText: {
    ...Typography.preset.button,
  },
});