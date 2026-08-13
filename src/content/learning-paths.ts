/**
 * Dottie — Learning Paths Seed Content
 *
 * The canonical set of free learning paths shipped with the app.
 * Each path is a structured journey of bite-sized lessons.
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  Paths are STATIC bundled content (no server fetch required). They
 *  live here rather than the cohort cache because they don't vary by
 *  user state — every user with the same mode sees the same lesson list.
 *
 *  The lesson SHAPE follows the canonical `content.types.ts` schema:
 *    - `sections: LessonSection[]` (not flat `body: string`)
 *    - `order: number` (not `orderInPath`)
 *    - `quizId: string | null`
 *
 *  Lessons reference their parent path via `pathId`. The home screen
 *  and Learn tab compose them together at render time.
 *
 * ─── MVP CONTENT FOOTPRINT ──────────────────────────────────────────
 *
 *  This chunk seeds ONE complete free path ("Cycle Basics" with 4
 *  lessons) so the Learn tab is visually populated and end-to-end
 *  navigable. Additional paths land in their own focused chunks so
 *  content authors don't drown in a single PR.
 *
 *  Add more paths by editing `LEARNING_PATHS` below — no engine
 *  changes needed.
 */

import {
  LearningPath,
  Lesson,
} from '../types/content.types';
import { Colors } from '../constants/colors';

// ─── PATH DEFINITIONS ────────────────────────────────────────────────

/**
 * The canonical bundled learning paths.
 * Sorted in the order they appear on the Learn tab.
 */
export const LEARNING_PATHS: LearningPath[] = [
  {
    id: 'cycle_basics',
    title: 'Cycle Basics',
    description: "What's actually happening each month — minus the textbook.",
    emoji: '🌸',
    tier: 'free',
    mode: 'all',
    totalLessons: 4,
    estimatedMinutes: 12,
    completionBadgeId: 'badge_cycle_basics',
    completionXP: 100,
    completionGems: 25,
    gradient: Colors.phase.follicular.gradient,
  },
  {
    id: 'puberty_101',
    title: 'Puberty 101',
    description: "Your body is changing — here's why, and what's normal.",
    emoji: '🦋',
    tier: 'free',
    mode: 'teen',
    totalLessons: 3,
    estimatedMinutes: 9,
    completionBadgeId: 'badge_puberty_101',
    completionXP: 80,
    completionGems: 20,
    gradient: Colors.phase.ovulatory.gradient,
  },
];

// ─── LESSON DEFINITIONS ──────────────────────────────────────────────

/**
 * All lessons across all paths, addressable by ID.
 * The Learn tab groups them by `pathId` when rendering.
 */
export const LESSONS: Lesson[] = [
  // ─── CYCLE BASICS PATH ──────────────────────────────────────────
  {
    id: 'lesson_cycle_basics_1',
    pathId: 'cycle_basics',
    order: 1,
    title: 'What is a menstrual cycle?',
    emoji: '🌸',
    estimatedMinutes: 3,
    xpReward: 25,
    gemReward: 5,
    quizId: 'quiz_cycle_basics_1',
    sections: [
      {
        type: 'paragraph',
        content:
          "Your menstrual cycle is your body's monthly rhythm — a sequence of hormonal changes that prepare your body, just in case it's growing a baby. (Spoiler: most months, it isn't!)",
      },
      {
        type: 'heading',
        content: 'The big idea',
      },
      {
        type: 'paragraph',
        content:
          "Every ~28 days, your body cycles through four phases. Each phase has its own vibe — different energy, mood, even skin behavior. Understanding the rhythm helps you work WITH your body instead of against it.",
      },
      {
        type: 'fact',
        emoji: '💡',
        highlight: 'follicular',
        content:
          "Only ~13% of people have an exactly 28-day cycle. Anywhere from 21 to 35 days is totally normal!",
      },
      {
        type: 'tip',
        emoji: '🌱',
        content:
          "Track your cycle start dates in Dottie — even a few months of data unlocks personalized predictions.",
      },
    ],
  },
  {
    id: 'lesson_cycle_basics_2',
    pathId: 'cycle_basics',
    order: 2,
    title: 'The four phases — your body\'s seasons',
    emoji: '🌿',
    estimatedMinutes: 3,
    xpReward: 25,
    gemReward: 5,
    quizId: 'quiz_cycle_basics_2',
    sections: [
      {
        type: 'paragraph',
        content:
          'Think of your cycle as four seasons — each with its own weather, energy, and mood. None is "better" than another. They all serve you.',
      },
      {
        type: 'callout',
        emoji: '🌊',
        highlight: 'menstrual',
        content:
          'MENSTRUAL (days 1-5): Hormones are at their lowest. Your body is renewing. Honor the rest.',
      },
      {
        type: 'callout',
        emoji: '🌱',
        highlight: 'follicular',
        content:
          'FOLLICULAR (days 6-13): Estrogen rises. Focus sharpens. Great window for new projects.',
      },
      {
        type: 'callout',
        emoji: '☀️',
        highlight: 'ovulatory',
        content:
          'OVULATORY (days 14-16): Peak hormones, peak confidence. Social energy is on full blast.',
      },
      {
        type: 'callout',
        emoji: '🌙',
        highlight: 'luteal',
        content:
          'LUTEAL (days 17-28): Progesterone takes over. Body slows down — earlier bedtimes welcome.',
      },
    ],
  },
  {
    id: 'lesson_cycle_basics_3',
    pathId: 'cycle_basics',
    order: 3,
    title: 'Hormones — the chemical messengers',
    emoji: '✨',
    estimatedMinutes: 3,
    xpReward: 25,
    gemReward: 5,
    quizId: 'quiz_cycle_basics_3',
    sections: [
      {
        type: 'paragraph',
        content:
          "Hormones are tiny chemical messengers your body sends to coordinate big changes. Two stars run your cycle: estrogen and progesterone.",
      },
      {
        type: 'fact',
        emoji: '🧠',
        highlight: 'follicular',
        content:
          'Estrogen peaks in the late follicular phase — that\'s why you might feel sharp, social, and energetic mid-cycle.',
      },
      {
        type: 'fact',
        emoji: '🛏️',
        highlight: 'luteal',
        content:
          "Progesterone dominates the luteal phase. Its calming effect is why you might want to nap or skip plans — totally normal.",
      },
      {
        type: 'tip',
        emoji: '💛',
        content:
          "If your mood swings around your cycle, it's not 'just hormones' — it IS hormones, and that's a real biological signal worth tracking.",
      },
    ],
  },
  {
    id: 'lesson_cycle_basics_4',
    pathId: 'cycle_basics',
    order: 4,
    title: 'Why cycles vary (and that\'s normal)',
    emoji: '🦋',
    estimatedMinutes: 3,
    xpReward: 25,
    gemReward: 5,
    quizId: 'quiz_cycle_basics_4',
    sections: [
      {
        type: 'paragraph',
        content:
          "Nobody's cycle is identical to anyone else's — or even identical month-to-month. That's biology, not malfunction.",
      },
      {
        type: 'heading',
        content: 'What can shift your cycle',
      },
      {
        type: 'paragraph',
        content:
          'Stress, travel, illness, sleep changes, weight shifts, and intense exercise can all nudge your cycle by a few days. Hormonal birth control changes the picture entirely.',
      },
      {
        type: 'callout',
        emoji: '⚠️',
        highlight: 'warm',
        content:
          "When to check with a doctor: cycles consistently shorter than 21 days, longer than 35 days, missing for 3+ months without pregnancy, or sudden major changes.",
      },
      {
        type: 'tip',
        emoji: '🌸',
        content:
          "Dottie's prediction engine adapts to YOUR pattern. Even irregular cycles become more predictable with a few months of data.",
      },
    ],
  },

  // ─── PUBERTY 101 PATH (Teen mode) ──────────────────────────────
  {
    id: 'lesson_puberty_1',
    pathId: 'puberty_101',
    order: 1,
    title: 'Your body is changing — here\'s why',
    emoji: '🦋',
    estimatedMinutes: 3,
    xpReward: 25,
    gemReward: 5,
    quizId: null,
    sections: [
      {
        type: 'paragraph',
        content:
          "Puberty is your body's way of growing into adulthood. It usually starts somewhere between 8 and 13 — and everyone's timeline is different. Yours is exactly right.",
      },
      {
        type: 'callout',
        emoji: '💛',
        highlight: 'warm',
        content:
          "There's no 'normal' age to start. Whether you start at 9 or 14, you're on YOUR schedule — and that's perfect.",
      },
      {
        type: 'tip',
        emoji: '🌸',
        content:
          "If you have questions about your body, it's always okay to talk to a trusted adult, school nurse, or doctor.",
      },
    ],
  },
  {
    id: 'lesson_puberty_2',
    pathId: 'puberty_101',
    order: 2,
    title: 'First period: what to expect',
    emoji: '🌸',
    estimatedMinutes: 3,
    xpReward: 25,
    gemReward: 5,
    quizId: null,
    sections: [
      {
        type: 'paragraph',
        content:
          "Your first period (called 'menarche') usually shows up between ages 10 and 15. It can start as a small amount of brownish or pinkish discharge — that's blood, just not very much yet.",
      },
      {
        type: 'fact',
        emoji: '💡',
        content:
          "First periods are often light and irregular. It can take 1-2 years for your cycle to find its rhythm — that's completely normal.",
      },
      {
        type: 'tip',
        emoji: '🎒',
        content:
          "Keep a pad or two in your bag, just in case. Dottie can also send you a heads-up when your period is likely coming.",
      },
    ],
  },
  {
    id: 'lesson_puberty_3',
    pathId: 'puberty_101',
    order: 3,
    title: 'Products: pads, tampons, cups',
    emoji: '🌿',
    estimatedMinutes: 3,
    xpReward: 25,
    gemReward: 5,
    quizId: null,
    sections: [
      {
        type: 'paragraph',
        content:
          "There's no 'right' product — just what works for YOU. You can try different ones over time. Here's a quick guide.",
      },
      {
        type: 'callout',
        emoji: '🩷',
        highlight: 'follicular',
        content:
          "PADS: Stick to your underwear. Easiest to start with. Change every 4-6 hours.",
      },
      {
        type: 'callout',
        emoji: '💛',
        highlight: 'ovulatory',
        content:
          "TAMPONS: Go inside, like a small absorbent cylinder. Comfortable for sports/swimming. Change every 4-8 hours.",
      },
      {
        type: 'callout',
        emoji: '🌿',
        highlight: 'luteal',
        content:
          "CUPS / DISCS: Reusable, eco-friendly. Bit of a learning curve, but many love them. Empty every 8-12 hours.",
      },
    ],
  },
];

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────

/**
 * Get all learning paths available for a user mode.
 * Paths marked `mode: 'all'` show for everyone.
 */
export function getPathsForMode(mode: 'teen' | 'adult' | 'endocrine'): LearningPath[] {
  return LEARNING_PATHS.filter(p => p.mode === 'all' || p.mode === mode);
}

/**
 * Get a single learning path by ID. Returns null if not found.
 */
export function getLearningPath(pathId: string): LearningPath | null {
  return LEARNING_PATHS.find(p => p.id === pathId) ?? null;
}

/**
 * Get all lessons in a path, sorted by `order`.
 */
export function getLessonsForPath(pathId: string): Lesson[] {
  return LESSONS.filter(l => l.pathId === pathId).sort((a, b) => a.order - b.order);
}

/**
 * Get a single lesson by ID. Returns null if not found.
 */
export function getLesson(lessonId: string): Lesson | null {
  return LESSONS.find(l => l.id === lessonId) ?? null;
}

/**
 * Get total lesson count across all bundled content (used by stats).
 */
export function getTotalLessonCount(): number {
  return LESSONS.length;
}