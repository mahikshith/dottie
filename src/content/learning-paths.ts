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
  {
    // Imported from docs/dottie questions/dottie_curriculum.json (path_hormones_101).
    // 7 lessons covering estrogen, progesterone, LH/FSH, prostaglandins, the HPO
    // axis, testosterone, and serotonin. Curriculum's exerciseIds are skipped for
    // now (each lesson still routes into its quiz — exercise seed lands later).
    id: 'path_hormones_101',
    title: 'Hormones 101',
    description: 'Meet the hormones that run your cycle.',
    emoji: '🧬',
    tier: 'free',
    mode: 'all',
    totalLessons: 7,
    estimatedMinutes: 42,
    completionBadgeId: 'badge_hormones_101',
    completionXP: 200,
    completionGems: 50,
    gradient: Colors.phase.luteal.gradient,
  },
  // ─── PER-PHASE PATHS (Learn Redesign Phase 2 — 2026-09-02) ─────────
  // Four short "in-phase" paths the spotlight card can surface for any of
  // the 9 sub-phases via the ranking in phase-aware-selector.ts. Every
  // lesson is beginner-tier (spotlight-friendly for a first-time user)
  // and NON-DIAGNOSTIC. The single fertility-window lesson is `adultOnly`
  // so the teen-mode filter drops it (Gemini FM-3).
  {
    id: 'path_menstrual_phase',
    title: 'Your Period, Kindly',
    description: 'What actually happens on day 1 — and how to care for yourself.',
    emoji: '🩸',
    tier: 'free',
    mode: 'all',
    totalLessons: 3,
    estimatedMinutes: 12,
    completionBadgeId: 'badge_menstrual_phase',
    completionXP: 90,
    completionGems: 22,
    gradient: Colors.phase.menstrual.gradient,
  },
  {
    id: 'path_follicular_phase',
    title: 'The Bright Climb',
    description: 'Estrogen rises — your energy, focus, and confidence do too.',
    emoji: '🌱',
    tier: 'free',
    mode: 'all',
    totalLessons: 3,
    estimatedMinutes: 12,
    completionBadgeId: 'badge_follicular_phase',
    completionXP: 90,
    completionGems: 22,
    gradient: Colors.phase.follicular.gradient,
  },
  {
    id: 'path_ovulation',
    title: 'Ovulation & You',
    description: 'The peak day — what to notice, and what it means.',
    emoji: '☀️',
    tier: 'free',
    mode: 'all',
    totalLessons: 3,
    estimatedMinutes: 13,
    completionBadgeId: 'badge_ovulation',
    completionXP: 90,
    completionGems: 22,
    gradient: Colors.phase.ovulatory.gradient,
  },
  {
    id: 'path_luteal_pms',
    title: 'The Wind-Down',
    description: 'What the luteal + PMS window is doing — and small comforts that help.',
    emoji: '🌙',
    tier: 'free',
    mode: 'all',
    totalLessons: 3,
    estimatedMinutes: 13,
    completionBadgeId: 'badge_luteal_pms',
    completionXP: 90,
    completionGems: 22,
    gradient: Colors.phase.luteal.gradient,
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

// ─── HORMONES 101 LESSONS (imported from the curriculum) ─────────────
//
// These 7 lessons come verbatim from `docs/dottie questions/dottie_curriculum.json`
// (path_hormones_101). Curriculum's `exerciseIds` are stripped to match our
// Lesson shape (we have our own exercises seed). `difficulty` is RESTORED
// here (Learn Redesign Phase 0 — was previously stripped, causing the phase-
// aware selector to have nothing to rank on). Each lesson still points at its
// quiz. `adultOnly` flag added where the topic isn't teen-appropriate.
LESSONS.push(
  {
    id: 'lesson_estrogen_the_rising_star',
    pathId: 'path_hormones_101',
    order: 1,
    title: 'Estrogen: The Rising Star',
    emoji: '🌟',
    difficulty: 'beginner',
    estimatedMinutes: 5,
    xpReward: 25,
    gemReward: 12,
    quizId: 'quiz_estrogen_the_rising_star',
    sections: [
      { type: 'heading', content: 'What Estrogen Does' },
      { type: 'paragraph', content: 'Estrogen is a key hormone your ovaries make. It rises through the first half of your cycle and shapes how you feel and function.' },
      { type: 'fact', emoji: '🧬', highlight: 'warm', content: 'Estrogen thickens your uterine lining and helps build fertile cervical mucus.' },
      { type: 'fact', emoji: '✨', highlight: 'warm', content: 'It peaks just before ovulation, when many people feel most energetic, social, and clear-headed.' },
      { type: 'tip', emoji: '🌟', content: "If you feel your brightest mid-cycle, rising estrogen is a big reason why." },
      { type: 'callout', emoji: '🦴', highlight: 'warm', content: "Estrogen also supports bone strength and heart health — it's not just a 'reproductive' hormone." },
    ],
  },
  {
    id: 'lesson_progesterone_the_calming_hormone',
    pathId: 'path_hormones_101',
    order: 2,
    title: 'Progesterone: The Calming Hormone',
    emoji: '🌙',
    difficulty: 'beginner',
    estimatedMinutes: 5,
    xpReward: 25,
    gemReward: 12,
    quizId: 'quiz_progesterone_the_calming_hormone',
    sections: [
      { type: 'heading', content: 'What Progesterone Does' },
      { type: 'paragraph', content: 'Progesterone rises after ovulation, made by the corpus luteum (the emptied follicle). It rules the second half of your cycle.' },
      { type: 'fact', emoji: '🧬', highlight: 'warm', content: 'Progesterone stabilizes your uterine lining so it could support a pregnancy.' },
      { type: 'fact', emoji: '🌡️', highlight: 'warm', content: 'It has a calming, warming effect — it slightly raises your temperature and can make rest more appealing.' },
      { type: 'fact', emoji: '🩸', highlight: 'warm', content: "If pregnancy doesn't happen, progesterone drops, which triggers your period." },
      { type: 'tip', emoji: '💤', content: 'Craving cozy rest in the luteal phase? Progesterone is part of the reason.' },
      { type: 'callout', emoji: '💛', highlight: 'warm', content: "The natural progesterone drop before your period is a normal trigger for menstruation, not a sign something's wrong." },
    ],
  },
  {
    id: 'lesson_lh_fsh_your_cycle_s_starters',
    pathId: 'path_hormones_101',
    order: 3,
    title: "LH & FSH: Your Cycle's Starters",
    emoji: '🧫',
    difficulty: 'moderate',
    estimatedMinutes: 6,
    xpReward: 30,
    gemReward: 15,
    quizId: 'quiz_lh_fsh_your_cycle_s_starters',
    sections: [
      { type: 'heading', content: 'Signals from the Brain' },
      { type: 'paragraph', content: 'FSH and LH come from your pituitary gland in the brain and drive the ovarian side of your cycle.' },
      { type: 'fact', emoji: '🧫', highlight: 'warm', content: 'FSH (follicle-stimulating hormone) starts each cycle by prompting follicles to grow.' },
      { type: 'fact', emoji: '⚡', highlight: 'warm', content: 'A sharp LH (luteinizing hormone) surge triggers ovulation, about 24–36 hours before the egg is released.' },
      { type: 'fact', emoji: '🧪', highlight: 'warm', content: 'Ovulation predictor kits work by detecting the LH surge in your urine.' },
      { type: 'tip', emoji: '🌼', content: 'A positive ovulation test means your fertile peak is likely within a day or two.' },
      { type: 'callout', emoji: '🔮', highlight: 'warm', content: 'Because the LH surge happens before release, LH tests help you predict ovulation ahead of time.' },
    ],
  },
  {
    id: 'lesson_prostaglandins_your_cramps',
    pathId: 'path_hormones_101',
    order: 4,
    title: 'Prostaglandins & Your Cramps',
    emoji: '🌊',
    difficulty: 'moderate',
    estimatedMinutes: 6,
    xpReward: 30,
    gemReward: 15,
    quizId: 'quiz_prostaglandins_your_cramps',
    sections: [
      { type: 'heading', content: 'The Chemistry of Cramps' },
      { type: 'paragraph', content: 'Prostaglandins are hormone-like compounds your uterus makes to help it contract and shed its lining during your period.' },
      { type: 'fact', emoji: '🌊', highlight: 'warm', content: 'Higher prostaglandin levels mean stronger contractions — and often more cramping.' },
      { type: 'fact', emoji: '🌿', highlight: 'warm', content: 'Prostaglandins can also reach your gut, which is why periods sometimes bring diarrhea or nausea.' },
      { type: 'tip', emoji: '💊', content: "Anti-inflammatory pain relievers (NSAIDs) work partly by lowering prostaglandins — that's why they help cramps." },
      { type: 'callout', emoji: '🚩', highlight: 'warm', content: "Cramps so severe they stop your daily life aren't something to just endure; they're worth discussing with a provider." },
    ],
  },
  {
    id: 'lesson_the_brain_ovary_team_hpo_axis',
    pathId: 'path_hormones_101',
    order: 5,
    title: 'The Brain-Ovary Team (HPO Axis)',
    emoji: '🧠',
    difficulty: 'hard',
    estimatedMinutes: 7,
    xpReward: 35,
    gemReward: 18,
    quizId: 'quiz_the_brain_ovary_team_hpo_axis',
    sections: [
      { type: 'heading', content: 'A Conversation Between Brain and Ovaries' },
      { type: 'paragraph', content: 'Your cycle is run by a feedback loop called the HPO axis: hypothalamus, pituitary, and ovaries, all talking to each other.' },
      { type: 'fact', emoji: '🧠', highlight: 'warm', content: 'The hypothalamus signals the pituitary, which releases FSH and LH to the ovaries.' },
      { type: 'fact', emoji: '🔁', highlight: 'warm', content: 'The ovaries make estrogen and progesterone, which feed back to the brain to adjust the next signals.' },
      { type: 'tip', emoji: '🔗', content: 'This is why stress, sleep, and nutrition — which act on the brain — can change your cycle.' },
      { type: 'callout', emoji: '🚩', highlight: 'warm', content: 'When the brain senses too little energy (from extreme dieting or overtraining), it can pause the whole axis and stop periods.' },
    ],
  },
  {
    id: 'lesson_testosterone_in_your_body',
    pathId: 'path_hormones_101',
    order: 6,
    title: 'Testosterone in Your Body',
    emoji: '💪',
    difficulty: 'moderate',
    estimatedMinutes: 6,
    xpReward: 30,
    gemReward: 15,
    quizId: 'quiz_testosterone_in_your_body',
    sections: [
      { type: 'heading', content: 'Yes, You Have It Too' },
      { type: 'paragraph', content: "Testosterone is often called a 'male' hormone, but everyone makes it. In smaller amounts, it plays real roles in your body." },
      { type: 'fact', emoji: '💪', highlight: 'warm', content: 'Testosterone contributes to libido, energy, muscle, and mood.' },
      { type: 'fact', emoji: '☀️', highlight: 'warm', content: 'It tends to rise slightly around ovulation, which can boost desire and confidence.' },
      { type: 'tip', emoji: '💞', content: 'A little extra drive mid-cycle is normal and healthy.' },
      { type: 'callout', emoji: '🔬', highlight: 'warm', content: 'Very high testosterone can cause acne or extra hair growth and is a feature of conditions like PCOS — worth exploring with a provider.' },
    ],
  },
  {
    id: 'lesson_serotonin_mood_your_cycle',
    pathId: 'path_hormones_101',
    order: 7,
    title: 'Serotonin, Mood & Your Cycle',
    emoji: '💛',
    difficulty: 'moderate',
    estimatedMinutes: 6,
    xpReward: 30,
    gemReward: 15,
    quizId: 'quiz_serotonin_mood_your_cycle',
    sections: [
      { type: 'heading', content: 'Hormones Talk to Your Mood' },
      { type: 'paragraph', content: 'Serotonin is a brain chemical that shapes mood, sleep, and appetite. Its levels shift alongside your cycle hormones.' },
      { type: 'fact', emoji: '💛', highlight: 'warm', content: 'When estrogen and progesterone drop before your period, serotonin can dip too, which may lower mood.' },
      { type: 'fact', emoji: '🍞', highlight: 'warm', content: 'This serotonin link is one reason carbohydrate cravings rise premenstrually — carbs can nudge serotonin up.' },
      { type: 'tip', emoji: '🌤️', content: 'Gentle movement, daylight, and steady meals can support serotonin during the luteal phase.' },
      { type: 'callout', emoji: '🩺', highlight: 'warm', content: 'For some, this serotonin sensitivity is intense enough to cause PMDD — a treatable condition, not a personal failing.' },
    ],
  },
);

// ─── PER-PHASE PATH LESSONS (Learn Redesign Phase 2 — 2026-09-02) ────
//
// Twelve short lessons (3 per path) covering the menstrual, follicular,
// ovulation and luteal windows. All beginner-tier so the spotlight card
// on the Learn tab can safely surface them to a first-time user. Copy is
// NON-DIAGNOSTIC (doctor-report-signals discipline) — no "your brain is
// better today", no clinical claims. One fertility-window lesson is
// flagged `adultOnly` so the teen filter in the phase-aware selector
// drops it (Gemini FM-3 belt-and-braces).
LESSONS.push(
  // ─── path_menstrual_phase (3) ───────────────────────────────────
  {
    id: 'lesson_menstrual_day_one',
    pathId: 'path_menstrual_phase',
    order: 1,
    title: 'Day 1: What just started',
    emoji: '🌊',
    difficulty: 'beginner',
    estimatedMinutes: 4,
    xpReward: 25,
    gemReward: 10,
    quizId: 'quiz_menstrual_day_one',
    sections: [
      { type: 'heading', content: 'The signal to shed' },
      { type: 'paragraph', content: "Day 1 is the first day of real menstrual bleeding. It's triggered by a drop in progesterone at the tail of the previous cycle — a normal cue, not a malfunction." },
      { type: 'fact', emoji: '🩸', highlight: 'menstrual', content: 'The blood is mostly your uterine lining leaving — the same tissue your body built earlier in the cycle just in case.' },
      { type: 'fact', emoji: '🌊', highlight: 'menstrual', content: 'A typical period lasts 3–7 days. Anywhere in that range is common.' },
      { type: 'tip', emoji: '💛', content: "Logging day 1 in Dottie is the single most useful thing you can do — a few of them and your predictions get much sharper." },
      { type: 'callout', emoji: '🚩', highlight: 'warm', content: 'Soaking through a pad or tampon every hour for several hours in a row is worth mentioning to a provider.' },
    ],
  },
  {
    id: 'lesson_menstrual_rest_as_strategy',
    pathId: 'path_menstrual_phase',
    order: 2,
    title: 'Rest as strategy',
    emoji: '🛌',
    difficulty: 'beginner',
    estimatedMinutes: 4,
    xpReward: 25,
    gemReward: 10,
    quizId: 'quiz_menstrual_rest_as_strategy',
    sections: [
      { type: 'heading', content: "Why energy dips (and it's biology)" },
      { type: 'paragraph', content: 'Estrogen and progesterone are at their lowest this week. Lower hormones = less drive, more tired — that reading is real, not laziness.' },
      { type: 'fact', emoji: '🔋', highlight: 'menstrual', content: "Iron loss during a period can add a little extra fatigue, especially if your flow is on the heavier side." },
      { type: 'tip', emoji: '☕', content: 'Warm drinks, a hot pack on the lower belly, and an earlier bedtime often do more for cramps and low mood than a workout would.' },
      { type: 'callout', emoji: '🌿', highlight: 'menstrual', content: "Gentle movement (walk, stretch, easy yoga) is welcome if it feels good — the rule is 'kind, not intense'." },
    ],
  },
  {
    id: 'lesson_menstrual_rebuild_as_flow_tapers',
    pathId: 'path_menstrual_phase',
    order: 3,
    title: 'Rebuilding as flow tapers',
    emoji: '🌾',
    difficulty: 'beginner',
    estimatedMinutes: 4,
    xpReward: 25,
    gemReward: 10,
    quizId: 'quiz_menstrual_rebuild_as_flow_tapers',
    sections: [
      { type: 'heading', content: 'The switch back on' },
      { type: 'paragraph', content: "Around days 3–5, bleeding lightens and estrogen begins to nudge upward. Many people notice a small return of energy and appetite." },
      { type: 'fact', emoji: '🍳', highlight: 'menstrual', content: 'Iron-rich foods (eggs, beans, leafy greens, red meat if you eat it) help replenish what a period costs.' },
      { type: 'tip', emoji: '💧', content: 'Steady hydration eases the transition — hormones shift more comfortably in a well-watered body.' },
      { type: 'callout', emoji: '🌱', highlight: 'follicular', content: "This is a good moment to pencil in one small plan for the week — you'll likely have a bit more capacity in the follicular window ahead." },
    ],
  },

  // ─── path_follicular_phase (3) ──────────────────────────────────
  {
    id: 'lesson_follicular_the_bright_climb',
    pathId: 'path_follicular_phase',
    order: 1,
    title: 'The bright climb',
    emoji: '🌤️',
    difficulty: 'beginner',
    estimatedMinutes: 4,
    xpReward: 25,
    gemReward: 10,
    quizId: 'quiz_follicular_the_bright_climb',
    sections: [
      { type: 'heading', content: 'What rising estrogen does' },
      { type: 'paragraph', content: "After your period, FSH nudges your ovaries to grow a batch of follicles. As they grow, estrogen rises — and lots of little things shift with it." },
      { type: 'fact', emoji: '✨', highlight: 'follicular', content: 'Many people report feeling lighter, more social, and a bit more focused as estrogen climbs.' },
      { type: 'fact', emoji: '🧬', highlight: 'follicular', content: 'Estrogen rebuilds your uterine lining and updates cervical mucus — invisible work, but it changes how you feel.' },
      { type: 'tip', emoji: '💛', content: "If your period week felt hard, notice how the second week feels different — that contrast is your own cycle teaching you." },
    ],
  },
  {
    id: 'lesson_follicular_focus_window',
    pathId: 'path_follicular_phase',
    order: 2,
    title: 'Your focus window',
    emoji: '🎯',
    difficulty: 'beginner',
    estimatedMinutes: 4,
    xpReward: 25,
    gemReward: 10,
    quizId: 'quiz_follicular_focus_window',
    sections: [
      { type: 'heading', content: 'Why mid-follicular often clicks' },
      { type: 'paragraph', content: "Between roughly day 8 and day 13, estrogen is high and progesterone is still low. That combination tends to feel clear-headed for many people." },
      { type: 'fact', emoji: '🧠', highlight: 'follicular', content: 'This is a common window for tackling harder work, learning new things, or planning ahead.' },
      { type: 'tip', emoji: '📅', content: "If you can, park heavy meetings or creative work here. This isn't a rule — cycles vary — but it's a pattern worth watching for in yourself." },
      { type: 'callout', emoji: '💛', highlight: 'warm', content: "If focus doesn't lift here, that's real information too, not a failure — some cycles feel flatter, and stress can flatten the whole climb." },
    ],
  },
  {
    id: 'lesson_follicular_ride_the_momentum',
    pathId: 'path_follicular_phase',
    order: 3,
    title: 'Ride the momentum',
    emoji: '🏃',
    difficulty: 'beginner',
    estimatedMinutes: 4,
    xpReward: 25,
    gemReward: 10,
    quizId: 'quiz_follicular_ride_the_momentum',
    sections: [
      { type: 'heading', content: 'A friendly window for new habits' },
      { type: 'paragraph', content: 'Rising estrogen supports recovery from exercise and a bit more resilience to stress. Small stretches you commit to now often stick better than in the luteal week.' },
      { type: 'fact', emoji: '💪', highlight: 'follicular', content: 'Strength and cardio effort often feels easier late follicular — same workout, less perceived exertion.' },
      { type: 'tip', emoji: '🌱', content: 'Pick ONE small new habit to try this week — a 10-minute walk, a hydration goal, an earlier lights-out. Small experiments beat big overhauls.' },
    ],
  },

  // ─── path_ovulation (3) ─────────────────────────────────────────
  {
    id: 'lesson_ovulation_peak_day_signs',
    pathId: 'path_ovulation',
    order: 1,
    title: 'The peak day — signs to notice',
    emoji: '☀️',
    difficulty: 'beginner',
    estimatedMinutes: 5,
    xpReward: 25,
    gemReward: 10,
    quizId: 'quiz_ovulation_peak_day_signs',
    sections: [
      { type: 'heading', content: "What ovulation actually is" },
      { type: 'paragraph', content: "Ovulation is the release of a mature egg from an ovary. It's a single moment, triggered by a sharp LH surge from your brain." },
      { type: 'fact', emoji: '🥚', highlight: 'ovulatory', content: 'The egg lives about 12–24 hours after release. That short life shapes the "fertile window" idea covered in the next lesson.' },
      { type: 'fact', emoji: '💧', highlight: 'ovulatory', content: 'Cervical mucus around this window tends to be clear and stretchy (like raw egg white) — that texture is a classic sign.' },
      { type: 'fact', emoji: '🌡️', highlight: 'ovulatory', content: 'Basal body temperature rises by roughly 0.3–0.6 °C AFTER ovulation, so a temperature bump usually confirms it happened rather than predicting it.' },
      { type: 'tip', emoji: '🧪', content: 'LH ovulation strips catch the LH surge in urine and can give you 12–36 hours\' notice before release.' },
    ],
  },
  {
    id: 'lesson_ovulation_fertility_window',
    pathId: 'path_ovulation',
    order: 2,
    title: 'The fertile window (basics)',
    emoji: '🌸',
    difficulty: 'beginner',
    adultOnly: true,
    estimatedMinutes: 5,
    xpReward: 25,
    gemReward: 10,
    quizId: 'quiz_ovulation_fertility_window',
    sections: [
      { type: 'heading', content: 'Why the window is wider than a day' },
      { type: 'paragraph', content: "The egg only lives about a day. But sperm can survive in fertile cervical mucus for up to 5 days — which is why the fertile window covers several days around ovulation, not just the day itself." },
      { type: 'fact', emoji: '📅', highlight: 'ovulatory', content: 'Roughly the 5 days leading up to ovulation plus ovulation day is the classic fertile window.' },
      { type: 'callout', emoji: '⚠️', highlight: 'warm', content: 'Calendar predictions are educational, not birth control. If you\'re trying to prevent pregnancy, use a method you\'ve chosen with a provider.' },
      { type: 'tip', emoji: '💛', content: 'Whether you\'re trying to conceive, trying to avoid, or just curious — knowing your own window is useful information.' },
    ],
  },
  {
    id: 'lesson_ovulation_mood_libido',
    pathId: 'path_ovulation',
    order: 3,
    title: 'Ovulation, mood & libido',
    emoji: '💞',
    difficulty: 'beginner',
    estimatedMinutes: 4,
    xpReward: 25,
    gemReward: 10,
    quizId: 'quiz_ovulation_mood_libido',
    sections: [
      { type: 'heading', content: 'Why this window can feel different' },
      { type: 'paragraph', content: "Estrogen peaks just before ovulation, and testosterone gets a small bump too. Many people notice a lift in confidence, sociability, and desire during this window." },
      { type: 'fact', emoji: '💪', highlight: 'ovulatory', content: "That testosterone bump is small but real — it's part of why libido often nudges up around ovulation." },
      { type: 'tip', emoji: '☀️', content: "If a mid-cycle boost is a pattern for you, this can be a good window for anything requiring a bit of nerve — a hard conversation, a pitch, a first draft." },
      { type: 'callout', emoji: '🌿', highlight: 'warm', content: "Not everyone notices this, and that's fine. Sensitivity to the ovulation shift varies a lot from person to person." },
    ],
  },

  // ─── path_luteal_pms (3) ────────────────────────────────────────
  {
    id: 'lesson_luteal_wind_down',
    pathId: 'path_luteal_pms',
    order: 1,
    title: 'The wind-down begins',
    emoji: '🌙',
    difficulty: 'beginner',
    estimatedMinutes: 4,
    xpReward: 25,
    gemReward: 10,
    quizId: 'quiz_luteal_wind_down',
    sections: [
      { type: 'heading', content: 'Progesterone takes the wheel' },
      { type: 'paragraph', content: "After ovulation, the emptied follicle (now the 'corpus luteum') pumps out progesterone. It's the calm, warming hormone that runs the second half of your cycle." },
      { type: 'fact', emoji: '🌡️', highlight: 'luteal', content: 'Progesterone raises your basal body temperature slightly — the same bump BBT tracking looks for.' },
      { type: 'fact', emoji: '💤', highlight: 'luteal', content: 'It has a mildly sedating effect, which is why cozy rest becomes more appealing in the luteal week.' },
      { type: 'tip', emoji: '💛', content: "If earlier bedtimes call your name this week, that's biology speaking, not weakness." },
    ],
  },
  {
    id: 'lesson_luteal_pms_what_is_happening',
    pathId: 'path_luteal_pms',
    order: 2,
    title: 'PMS: what\'s actually happening',
    emoji: '🌧️',
    difficulty: 'beginner',
    estimatedMinutes: 5,
    xpReward: 25,
    gemReward: 10,
    quizId: 'quiz_luteal_pms_what_is_happening',
    sections: [
      { type: 'heading', content: 'The late-luteal dip' },
      { type: 'paragraph', content: "In the last 3–5 days before your period, both estrogen and progesterone drop. Serotonin often dips alongside them — and that shift can show up as mood changes, cravings, and tenderness." },
      { type: 'fact', emoji: '🍫', highlight: 'luteal', content: 'Carbohydrate cravings around PMS are partly a serotonin thing — carbs help the brain make more of it.' },
      { type: 'fact', emoji: '💧', highlight: 'luteal', content: 'Bloating and breast tenderness in this window are common and usually settle once your period starts.' },
      { type: 'callout', emoji: '🩺', highlight: 'warm', content: "If PMS symptoms are severe enough to disrupt your life every month, PMDD is a real, treatable condition — worth a conversation with a provider." },
    ],
  },
  {
    id: 'lesson_luteal_care_ideas',
    pathId: 'path_luteal_pms',
    order: 3,
    title: 'Care ideas for the PMS window',
    emoji: '🛁',
    difficulty: 'beginner',
    estimatedMinutes: 4,
    xpReward: 25,
    gemReward: 10,
    quizId: 'quiz_luteal_care_ideas',
    sections: [
      { type: 'heading', content: 'Small, steady, kind' },
      { type: 'paragraph', content: "PMS is not a personal failing — it's a set of physiological shifts. A few small habits often take the edge off." },
      { type: 'tip', emoji: '🚶', content: 'Gentle movement (walk, easy yoga, swim) helps mood without fighting the wind-down.' },
      { type: 'tip', emoji: '🍽️', content: 'Steady meals with protein + complex carbs help stabilise energy and mood better than sugar spikes and crashes.' },
      { type: 'tip', emoji: '💤', content: "Protect sleep this week — even 30 more minutes matter more now than they did earlier in your cycle." },
      { type: 'callout', emoji: '💛', highlight: 'warm', content: "Being kinder to yourself in this window isn't indulgent — it's calibrated. The body is doing more; give it more slack." },
    ],
  },
);