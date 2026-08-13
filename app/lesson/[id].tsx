import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { Shadows } from '../../src/constants/shadows';
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
import { contentRepository, LessonProgress } from '../../src/database/repositories/content.repo';
import { LessonSection, Phase } from '../../src/types/cycle.types';
import type { LessonSection as LessonSectionType } from '../../src/types/content.types';

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

  // ─── Resolve lesson + path ──────────────────────────────────────
  const lesson = useMemo(() => (id ? getLesson(id) : null), [id]);
  const path = useMemo(
    () => (lesson?.pathId ? getLearningPath(lesson.pathId) : null),
    [lesson?.pathId]
  );

  const [progress, setProgress] = useState<LessonProgress | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

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
        if (__DEV__) console.warn('[Lesson] start failed:', err);
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

        Alert.alert(
          `${path.emoji} ${path.title} Complete!`,
          `You finished the whole path!\n+${path.completionXP} XP · +${path.completionGems}💎`,
          [
            { text: 'Yay!', onPress: () => router.back() },
          ]
        );

        // Touch pathXp so it's not unused
        void pathXp;
        return;
      }

      // Otherwise just celebrate the lesson
      Alert.alert(
        'Lesson complete! ✨',
        `+${xpResult.xpAwarded} XP · +${gemResult.gemsAwarded}💎${
          lesson.quizId ? '\n\nWant to take the quiz?' : ''
        }`,
        lesson.quizId
          ? [
              { text: 'Later', style: 'cancel', onPress: () => router.back() },
              {
                text: 'Take Quiz',
                onPress: () => router.replace(`/quiz/${lesson.quizId}`),
              },
            ]
          : [{ text: 'Nice!', onPress: () => router.back() }]
      );
    } catch (err) {
      if (__DEV__) console.warn('[Lesson] complete failed:', err);
      Alert.alert('Oops', "I couldn't save your progress. Try again?");
    } finally {
      setIsCompleting(false);
    }
  };

  if (!lesson || !path) {
    return (
      <View style={styles.notFoundContainer}>
        <Stack.Screen options={{ title: '' }} />
        <Text style={styles.notFoundEmoji}>🤔</Text>
        <Text style={styles.notFoundTitle}>Lesson not found</Text>
        <Pressable style={styles.notFoundButton} onPress={() => router.back()}>
          <Text style={styles.notFoundButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const accent = path.gradient[0];
  const isComplete = progress?.status === 'complete';

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: path.title,
          headerStyle: { backgroundColor: Colors.surface.background },
          headerTintColor: Colors.text.primary,
          headerBackTitle: 'Back',
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Lesson header */}
        <View style={[styles.lessonHeader, { backgroundColor: `${accent}11` }]}>
          <Text style={styles.lessonEmoji}>{lesson.emoji}</Text>
          <Text style={styles.lessonTitle}>{lesson.title}</Text>
          <Text style={styles.lessonMeta}>
            {lesson.estimatedMinutes} min · {lesson.xpReward} XP · {lesson.gemReward}💎
          </Text>
        </View>

        {/* Companion intro */}
        <View style={styles.companionIntro}>
          <Text style={styles.companionEmoji}>{companion.emoji}</Text>
          <Text style={styles.companionIntroText}>
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

        {/* Complete button */}
        <Pressable
          style={({ pressed }) => [
            styles.completeButton,
            { backgroundColor: isComplete ? Colors.semantic.success : Colors.primary.coral },
            (pressed || isCompleting) && styles.completeButtonPressed,
          ]}
          onPress={handleComplete}
          disabled={isCompleting}
        >
          <Text style={styles.completeButtonText}>
            {isComplete
              ? '✓ Already Complete'
              : isCompleting
                ? 'Saving...'
                : 'Mark as Complete'}
          </Text>
        </Pressable>

        {/* Quiz hint */}
        {lesson.quizId && !isComplete && (
          <Text style={styles.quizHint}>
            A short quiz will be offered after completing.
          </Text>
        )}

        <View style={{ height: Spacing['3xl'] }} />
      </ScrollView>
    </>
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
  switch (section.type) {
    case 'heading':
      return <Text style={styles.sectionHeading}>{section.content}</Text>;

    case 'paragraph':
      return <Text style={styles.sectionParagraph}>{section.content}</Text>;

    case 'divider':
      return <View style={styles.sectionDivider} />;

    case 'callout': {
      const bg = resolveHighlightColor(section.highlight, pathAccent);
      const bgLight = resolveHighlightLight(section.highlight);
      return (
        <View
          style={[
            styles.calloutCard,
            { backgroundColor: bgLight, borderLeftColor: bg },
          ]}
        >
          {section.emoji && <Text style={styles.calloutEmoji}>{section.emoji}</Text>}
          <Text style={[styles.calloutText, { color: Colors.text.primary }]}>
            {section.content}
          </Text>
        </View>
      );
    }

    case 'fact': {
      const accent = resolveHighlightColor(section.highlight, pathAccent);
      return (
        <View style={[styles.factCard, { borderColor: `${accent}55` }]}>
          {section.emoji && <Text style={styles.factEmoji}>{section.emoji}</Text>}
          <Text style={styles.factText}>{section.content}</Text>
        </View>
      );
    }

    case 'tip':
      return (
        <View style={styles.tipCard}>
          {section.emoji && <Text style={styles.tipEmoji}>{section.emoji}</Text>}
          <Text style={styles.tipText}>{section.content}</Text>
        </View>
      );

    case 'image':
    default:
      return null; // Image rendering deferred to a later chunk
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────

function resolveHighlightColor(
  highlight: LessonSectionType['highlight'] | undefined,
  fallback: string
): string {
  if (!highlight) return fallback;
  if (highlight === 'warm') return Colors.primary.coral;
  if (highlight === 'cool') return Colors.primary.calm;
  // Phase
  return Colors.phase[highlight as Phase].primary;
}

function resolveHighlightLight(
  highlight: LessonSectionType['highlight'] | undefined
): string {
  if (!highlight) return Colors.surface.cardElevated;
  if (highlight === 'warm') return '#FFF1E8';
  if (highlight === 'cool') return '#EFF6FF';
  return Colors.phase[highlight as Phase].light;
}

// Touch import so unused-import warnings don't trigger in dev
void LessonSection;

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface.background,
  },
  contentContainer: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.base,
  },
  lessonHeader: {
    padding: Spacing.cardPaddingLarge,
    borderRadius: Spacing.radius['2xl'],
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  lessonEmoji: {
    fontSize: 40,
    marginBottom: Spacing.sm,
  },
  lessonTitle: {
    ...Typography.preset.h3,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  lessonMeta: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
  },
  companionIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.card,
    padding: Spacing.md,
    borderRadius: Spacing.radius.xl,
    marginBottom: Spacing.sectionGap,
    ...Shadows.sm,
  },
  companionEmoji: {
    fontSize: 28,
    marginRight: Spacing.md,
  },
  companionIntroText: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
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
    color: Colors.text.primary,
    marginTop: Spacing.md,
  },
  sectionParagraph: {
    ...Typography.preset.body,
    color: Colors.text.primary,
    lineHeight: 26,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: Colors.border.light,
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
    backgroundColor: Colors.surface.card,
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
    color: Colors.text.primary,
    flex: 1,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF1E8',
    padding: Spacing.cardPadding,
    borderRadius: Spacing.radius.xl,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary.coral,
  },
  tipEmoji: {
    fontSize: 24,
    marginRight: Spacing.md,
  },
  tipText: {
    ...Typography.preset.bodySemibold,
    color: Colors.text.primary,
    flex: 1,
    lineHeight: 22,
  },
  completeButton: {
    height: Spacing.buttonHeight.lg,
    borderRadius: Spacing.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.button,
  },
  completeButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  completeButtonText: {
    ...Typography.preset.button,
    color: Colors.text.inverse,
  },
  quizHint: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface.background,
    padding: Spacing.xl,
  },
  notFoundEmoji: {
    fontSize: 64,
    marginBottom: Spacing.lg,
  },
  notFoundTitle: {
    ...Typography.preset.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.xl,
  },
  notFoundButton: {
    backgroundColor: Colors.primary.coral,
    paddingHorizontal: Spacing['3xl'],
    height: Spacing.buttonHeight.md,
    borderRadius: Spacing.radius.full,
    justifyContent: 'center',
  },
  notFoundButtonText: {
    ...Typography.preset.button,
    color: Colors.text.inverse,
  },
});