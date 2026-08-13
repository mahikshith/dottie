/**
 * Dottie — Quizzes Seed Content
 *
 * The canonical set of free quizzes shipped with the app. Each quiz is
 * paired with a lesson from `learning-paths.ts` via `lessonId`.
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  Quizzes are STATIC bundled content — no server fetch. They live
 *  here so they're version-pinned to the app build and available offline.
 *
 *  Each quiz has a BANK of questions (typically 5-10). At attempt time,
 *  the QuizEngine randomly picks `questionsPerAttempt` from the bank
 *  for variety on retakes.
 *
 *  Question naming uses the canonical `text` field (chunk 6 alignment).
 *  Older content using `question` will still load thanks to the engine's
 *  normalization shim.
 *
 * ─── CONTENT VOICE ──────────────────────────────────────────────────
 *
 *  Questions are written conversationally, not academically.
 *  Explanations celebrate correct answers and gently correct wrong ones —
 *  never make the user feel stupid.
 */

import { Quiz } from '../types/content.types';

// ─── QUIZ DEFINITIONS ────────────────────────────────────────────────

export const QUIZZES: Quiz[] = [
  // ─── CYCLE BASICS QUIZZES ──────────────────────────────────────
  {
    id: 'quiz_cycle_basics_1',
    title: 'What is a menstrual cycle?',
    lessonId: 'lesson_cycle_basics_1',
    totalQuestions: 5,
    questionsPerAttempt: 5,
    passingScore: 0.6,
    questions: [
      {
        id: 'qcb1_q1',
        text: 'How many phases does a typical menstrual cycle have?',
        options: ['2', '3', '4', '5'],
        correctIndex: 2,
        explanation:
          "Your cycle has 4 phases: Menstrual, Follicular, Ovulatory, and Luteal.",
        explanationEmoji: '🌸',
      },
      {
        id: 'qcb1_q2',
        text: "What percentage of people have an exactly 28-day cycle?",
        options: ['About 13%', 'About 50%', 'About 87%', 'Around 99%'],
        correctIndex: 0,
        explanation:
          "Only ~13%! Anywhere from 21 to 35 days is totally normal. 'Average' doesn't mean 'should be.'",
        explanationEmoji: '💛',
      },
      {
        id: 'qcb1_q3',
        text: 'A cycle is mainly driven by which two hormones?',
        options: [
          'Adrenaline & cortisol',
          'Estrogen & progesterone',
          'Insulin & glucagon',
          'Serotonin & dopamine',
        ],
        correctIndex: 1,
        explanation:
          "Estrogen and progesterone are the two stars running your cycle. Other hormones play supporting roles.",
        explanationEmoji: '✨',
      },
      {
        id: 'qcb1_q4',
        text: 'Tracking your cycle helps because…',
        options: [
          "You can predict pregnancy outcomes 100% accurately",
          "Patterns emerge that help you understand your body's signals",
          "It guarantees regular cycles",
          "It cures hormonal conditions",
        ],
        correctIndex: 1,
        explanation:
          "Tracking surfaces patterns — energy, mood, symptoms — so you can work WITH your body, not against it.",
        explanationEmoji: '🌱',
      },
      {
        id: 'qcb1_q5',
        text: "If your cycle is 35 days instead of 28, that's…",
        options: [
          "Definitely abnormal",
          "Within the normal range",
          "A sign of pregnancy",
          "Caused by stress only",
        ],
        correctIndex: 1,
        explanation:
          "21-35 days is the normal range. Everyone's body has its own rhythm — and yours is valid.",
        explanationEmoji: '🌿',
      },
    ],
  },

  {
    id: 'quiz_cycle_basics_2',
    title: 'The four phases',
    lessonId: 'lesson_cycle_basics_2',
    totalQuestions: 5,
    questionsPerAttempt: 5,
    passingScore: 0.6,
    questions: [
      {
        id: 'qcb2_q1',
        text: 'Which phase usually has the LOWEST hormone levels?',
        options: ['Follicular', 'Ovulatory', 'Luteal', 'Menstrual'],
        correctIndex: 3,
        explanation:
          "During your period, hormones are at their lowest. That's why energy often dips — it's biology, not weakness.",
        explanationEmoji: '🌊',
      },
      {
        id: 'qcb2_q2',
        text: "Which phase is best known for a focus & energy boost?",
        options: ['Follicular', 'Menstrual', 'Luteal', 'Pre-menstrual'],
        correctIndex: 0,
        explanation:
          "Estrogen climbs in the follicular phase — sharper focus, brighter mood. Great window for big tasks!",
        explanationEmoji: '🌱',
      },
      {
        id: 'qcb2_q3',
        text: 'Ovulation typically happens around…',
        options: [
          "Day 1 of your cycle",
          "Mid-cycle (around days 14-16 for a 28-day cycle)",
          "Last day of your cycle",
          "The day before your period starts",
        ],
        correctIndex: 1,
        explanation:
          "Mid-cycle! It's the brief window when your peak hormones might bring extra confidence and energy.",
        explanationEmoji: '☀️',
      },
      {
        id: 'qcb2_q4',
        text: 'Which phase often comes with a desire for earlier bedtimes?',
        options: ['Menstrual', 'Follicular', 'Ovulatory', 'Luteal'],
        correctIndex: 3,
        explanation:
          "Progesterone dominates the luteal phase — its calming effect can make you sleepier. Honor it.",
        explanationEmoji: '🌙',
      },
      {
        id: 'qcb2_q5',
        text: 'How long is the menstrual phase usually?',
        options: ['1 day', '3-7 days', '10-14 days', '2-3 weeks'],
        correctIndex: 1,
        explanation:
          "3-7 days is the typical range. Length varies person to person — and that's totally fine.",
        explanationEmoji: '💛',
      },
    ],
  },

  {
    id: 'quiz_cycle_basics_3',
    title: 'Hormones — the messengers',
    lessonId: 'lesson_cycle_basics_3',
    totalQuestions: 4,
    questionsPerAttempt: 4,
    passingScore: 0.5,
    questions: [
      {
        id: 'qcb3_q1',
        text: 'Hormones are best described as…',
        options: [
          'Tiny chemical messengers',
          'A type of food',
          'Brain cells',
          'Bacteria in the gut',
        ],
        correctIndex: 0,
        explanation:
          "Hormones are chemical messengers your body sends to coordinate big changes. Tiny but mighty!",
        explanationEmoji: '✨',
      },
      {
        id: 'qcb3_q2',
        text: 'Estrogen peaks in the late…',
        options: ['Menstrual phase', 'Follicular phase', 'Luteal phase', 'Sleep cycle'],
        correctIndex: 1,
        explanation:
          "Late follicular phase! That's why mid-cycle often feels sharp, social, and energetic.",
        explanationEmoji: '🌱',
      },
      {
        id: 'qcb3_q3',
        text: 'Progesterone is most associated with…',
        options: [
          'Wanting to sleep more',
          'Feeling jittery',
          'Skin breakouts only',
          'Hair growth',
        ],
        correctIndex: 0,
        explanation:
          "Progesterone's calming effect is why the luteal phase often brings sleepiness and a desire to slow down.",
        explanationEmoji: '🌙',
      },
      {
        id: 'qcb3_q4',
        text: 'Mood swings around your cycle are…',
        options: [
          "All in your head",
          "A real biological signal worth tracking",
          "A sign of weakness",
          "Always a symptom of illness",
        ],
        correctIndex: 1,
        explanation:
          "Real biology — and worth tracking. Hormones genuinely affect mood, and noticing the pattern is power.",
        explanationEmoji: '💛',
      },
    ],
  },

  {
    id: 'quiz_cycle_basics_4',
    title: 'Why cycles vary',
    lessonId: 'lesson_cycle_basics_4',
    totalQuestions: 5,
    questionsPerAttempt: 5,
    passingScore: 0.6,
    questions: [
      {
        id: 'qcb4_q1',
        text: 'Which of these can shift your cycle by a few days?',
        options: [
          'Stress and travel',
          'Eating too many vegetables',
          'Wearing the wrong color',
          'Reading too much',
        ],
        correctIndex: 0,
        explanation:
          "Stress, travel, illness, sleep changes — your cycle is sensitive to life happening. That's normal.",
        explanationEmoji: '🌿',
      },
      {
        id: 'qcb4_q2',
        text: "If your cycle is consistently shorter than 21 days, you should…",
        options: [
          'Ignore it',
          'Check with a doctor',
          'Stop tracking',
          'Eat more sweets',
        ],
        correctIndex: 1,
        explanation:
          "Consistently under 21 days is worth checking with a doctor — they can help understand what's happening.",
        explanationEmoji: '🩷',
      },
      {
        id: 'qcb4_q3',
        text: 'Hormonal birth control typically…',
        options: [
          'Has no effect on your cycle',
          "Changes the cycle picture entirely",
          'Makes cycles longer',
          'Only affects mood',
        ],
        correctIndex: 1,
        explanation:
          "Hormonal birth control overrides your natural cycle — what you 'bleed' on the pill is a withdrawal bleed, not a true period.",
        explanationEmoji: '💊',
      },
      {
        id: 'qcb4_q4',
        text: 'Irregular cycles become more predictable with…',
        options: [
          'Time and tracking data',
          'Eating less',
          'Worrying more',
          'Avoiding exercise',
        ],
        correctIndex: 0,
        explanation:
          "Even irregular cycles reveal patterns with a few months of data. Dottie adapts to YOUR rhythm.",
        explanationEmoji: '🌸',
      },
      {
        id: 'qcb4_q5',
        text: "What's a 'normal' cycle?",
        options: [
          "Exactly 28 days for everyone",
          "Whatever's normal for YOU and within 21-35 days",
          "Always 5 days of bleeding",
          "Identical month-to-month",
        ],
        correctIndex: 1,
        explanation:
          "'Normal' is what's normal for YOU — within the wide healthy range. Your body, your rhythm.",
        explanationEmoji: '💛',
      },
    ],
  },
];

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────

/** Get a quiz by ID. Returns null if not found. */
export function getQuiz(quizId: string): Quiz | null {
  return QUIZZES.find(q => q.id === quizId) ?? null;
}

/** Get the quiz associated with a lesson. Returns null if none. */
export function getQuizForLesson(lessonId: string): Quiz | null {
  return QUIZZES.find(q => q.lessonId === lessonId) ?? null;
}

/** Total bundled quiz count (for stats). */
export function getTotalQuizCount(): number {
  return QUIZZES.length;
}