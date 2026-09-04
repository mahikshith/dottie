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
import { CURRICULUM_QUIZZES } from './curriculum.generated';

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

// ─── HORMONES 101 QUIZZES (imported from the curriculum) ─────────────
//
// Verbatim from docs/dottie questions/dottie_curriculum.json. Curriculum's
// per-question `level` field is dropped (our Question type doesn't carry
// it). One quiz per lesson in path_hormones_101, 6 questions each.
QUIZZES.push(
  {
    id: 'quiz_estrogen_the_rising_star',
    title: 'Estrogen: The Rising Star',
    lessonId: 'lesson_estrogen_the_rising_star',
    totalQuestions: 6,
    questionsPerAttempt: 6,
    passingScore: 0.67,
    questions: [
      { id: 'q_estrogen_the_rising_star_1', text: 'Estrogen is mainly made by your…', options: ['Liver', 'Ovaries', 'Lungs', 'Skin'], correctIndex: 1, explanation: 'Your ovaries are the main source.', explanationEmoji: '🧬', level: 'beginner' },
      { id: 'q_estrogen_the_rising_star_2', text: 'Estrogen rises during the…', options: ['Luteal phase', 'First half of the cycle', 'Period only', 'Menopause'], correctIndex: 1, explanation: 'It rises through the follicular half.', explanationEmoji: '🌱', level: 'beginner' },
      { id: 'q_estrogen_the_rising_star_3', text: 'Estrogen helps build…', options: ['Muscle only', 'A thick lining and fertile mucus', 'Nothing', 'Bones only'], correctIndex: 1, explanation: 'It thickens the lining and creates fertile mucus.', explanationEmoji: '💧', level: 'beginner' },
      { id: 'q_estrogen_the_rising_star_4', text: 'Why feel most social and sharp mid-cycle?', options: ['Less sleep', 'Estrogen peaks near ovulation', 'Progesterone peaks', 'Low iron'], correctIndex: 1, explanation: 'Peak estrogen near ovulation lifts mood and clarity.', explanationEmoji: '✨', level: 'moderate' },
      { id: 'q_estrogen_the_rising_star_5', text: 'Why is estrogen important beyond reproduction?', options: ["It isn't", 'It supports bone and heart health', 'Only skin', 'It causes disease'], correctIndex: 1, explanation: 'Estrogen supports bones and cardiovascular health.', explanationEmoji: '🦴', level: 'moderate' },
      { id: 'q_estrogen_the_rising_star_6', text: 'If estrogen stays very low long-term (as after menopause), what needs attention?', options: ['Nothing', 'Bone density', 'Hair color', 'Eye color'], correctIndex: 1, explanation: 'Low estrogen long-term can reduce bone density.', explanationEmoji: '🦴', level: 'hard' },
    ],
  },
  {
    id: 'quiz_progesterone_the_calming_hormone',
    title: 'Progesterone: The Calming Hormone',
    lessonId: 'lesson_progesterone_the_calming_hormone',
    totalQuestions: 6,
    questionsPerAttempt: 6,
    passingScore: 0.67,
    questions: [
      { id: 'q_progesterone_the_calming_hormone_1', text: 'Progesterone rises…', options: ['Before ovulation', 'After ovulation', 'During your period', 'Never'], correctIndex: 1, explanation: 'It rises in the luteal phase.', explanationEmoji: '🌙', level: 'beginner' },
      { id: 'q_progesterone_the_calming_hormone_2', text: 'What makes progesterone after ovulation?', options: ['The ovary shell', 'The corpus luteum', 'The liver', 'The cervix'], correctIndex: 1, explanation: 'The corpus luteum produces it.', explanationEmoji: '🧬', level: 'beginner' },
      { id: 'q_progesterone_the_calming_hormone_3', text: "Progesterone's effect on temperature?", options: ['Lowers it', 'Raises it slightly', 'No effect', 'Freezes it'], correctIndex: 1, explanation: 'It slightly raises basal body temperature.', explanationEmoji: '🌡️', level: 'beginner' },
      { id: 'q_progesterone_the_calming_hormone_4', text: 'Why can the luteal phase feel restful or sleepy?', options: ['Low iron', "Progesterone's calming effect", 'High estrogen', 'Dehydration'], correctIndex: 1, explanation: 'Progesterone has a calming, sedating quality.', explanationEmoji: '💤', level: 'moderate' },
      { id: 'q_progesterone_the_calming_hormone_5', text: 'Why does your period start when it does?', options: ['Estrogen surges', 'Progesterone drops', 'You exercise', 'Random'], correctIndex: 1, explanation: 'The fall in progesterone triggers shedding.', explanationEmoji: '🩸', level: 'moderate' },
      { id: 'q_progesterone_the_calming_hormone_6', text: 'Progesterone stays high and no period comes after ovulation. Reasonable thought?', options: ['Impossible', 'Pregnancy is possible', "They're sick", 'Ovaries stopped'], correctIndex: 1, explanation: "In pregnancy, progesterone stays high and the period doesn't come.", explanationEmoji: '🤰', level: 'hard' },
    ],
  },
  {
    id: 'quiz_lh_fsh_your_cycle_s_starters',
    title: "LH & FSH: Your Cycle's Starters",
    lessonId: 'lesson_lh_fsh_your_cycle_s_starters',
    totalQuestions: 6,
    questionsPerAttempt: 6,
    passingScore: 0.67,
    questions: [
      { id: 'q_lh_fsh_your_cycle_s_starters_1', text: 'FSH and LH come from the…', options: ['Ovaries', 'Pituitary gland', 'Uterus', 'Liver'], correctIndex: 1, explanation: 'The pituitary releases them.', explanationEmoji: '🧠', level: 'beginner' },
      { id: 'q_lh_fsh_your_cycle_s_starters_2', text: 'FSH tells the ovaries to…', options: ['Release progesterone', 'Grow follicles', 'Shed the lining', 'Stop'], correctIndex: 1, explanation: 'It stimulates follicle growth.', explanationEmoji: '🧫', level: 'beginner' },
      { id: 'q_lh_fsh_your_cycle_s_starters_3', text: 'The LH surge triggers…', options: ['Your period', 'Ovulation', 'Sleep', 'Cramps'], correctIndex: 1, explanation: 'A sharp LH spike triggers ovulation.', explanationEmoji: '⚡', level: 'beginner' },
      { id: 'q_lh_fsh_your_cycle_s_starters_4', text: "Why does a positive LH test mean 'fertile soon'?", options: ['Ovulation passed', 'The surge precedes ovulation by ~a day', 'It means pregnancy', 'Random'], correctIndex: 1, explanation: 'The surge comes before release, predicting upcoming ovulation.', explanationEmoji: '🔮', level: 'moderate' },
      { id: 'q_lh_fsh_your_cycle_s_starters_5', text: "Why does usually only one follicle 'win'?", options: ['Luck', 'Rising estrogen lowers FSH so others fade', 'They all win', 'FSH rises forever'], correctIndex: 1, explanation: 'Estrogen feedback drops FSH, so smaller follicles stop.', explanationEmoji: '🔁', level: 'moderate' },
      { id: 'q_lh_fsh_your_cycle_s_starters_6', text: 'Repeated positive LH tests but never a temperature rise may mean…', options: ['Definitely pregnant', 'Ovulation may not be completing; discuss with a provider', 'All normal', 'Ovulating daily'], correctIndex: 1, explanation: "LH surges without a confirming BBT rise can suggest ovulation isn't completing.", explanationEmoji: '🩺', level: 'hard' },
    ],
  },
  {
    id: 'quiz_prostaglandins_your_cramps',
    title: 'Prostaglandins & Your Cramps',
    lessonId: 'lesson_prostaglandins_your_cramps',
    totalQuestions: 6,
    questionsPerAttempt: 6,
    passingScore: 0.67,
    questions: [
      { id: 'q_prostaglandins_your_cramps_1', text: 'Prostaglandins help the uterus…', options: ['Grow hair', 'Contract and shed its lining', 'Make estrogen', 'Sleep'], correctIndex: 1, explanation: 'They drive uterine contractions.', explanationEmoji: '🌊', level: 'beginner' },
      { id: 'q_prostaglandins_your_cramps_2', text: 'Higher prostaglandins often mean…', options: ['Less pain', 'More cramping', 'No effect', 'More energy'], correctIndex: 1, explanation: 'More prostaglandins tend to mean stronger cramps.', explanationEmoji: '💥', level: 'beginner' },
      { id: 'q_prostaglandins_your_cramps_3', text: 'Prostaglandins reaching the gut can cause…', options: ['Better digestion', 'Diarrhea or nausea', 'Hunger', 'Nothing'], correctIndex: 1, explanation: 'They can loosen stools and cause nausea.', explanationEmoji: '🌿', level: 'beginner' },
      { id: 'q_prostaglandins_your_cramps_4', text: 'Why do NSAIDs help cramps?', options: ['They add iron', 'They lower prostaglandin production', 'They raise estrogen', 'Placebo'], correctIndex: 1, explanation: 'NSAIDs reduce prostaglandins, easing contractions.', explanationEmoji: '💊', level: 'moderate' },
      { id: 'q_prostaglandins_your_cramps_5', text: "Why might cramps and 'period poops' happen together?", options: ['Coincidence', 'Both can be driven by prostaglandins', 'Different hormones', 'Diet'], correctIndex: 1, explanation: 'Prostaglandins affect both the uterus and gut.', explanationEmoji: '🌿', level: 'moderate' },
      { id: 'q_prostaglandins_your_cramps_6', text: "Cramps that don't respond to NSAIDs or rest and stop you monthly may point to…", options: ['Nothing', 'Conditions like endometriosis worth evaluating', 'Dehydration only', 'Too much sleep'], correctIndex: 1, explanation: 'NSAID-resistant, disabling pain warrants evaluation.', explanationEmoji: '🚩', level: 'hard' },
    ],
  },
  {
    id: 'quiz_the_brain_ovary_team_hpo_axis',
    title: 'The Brain-Ovary Team (HPO Axis)',
    lessonId: 'lesson_the_brain_ovary_team_hpo_axis',
    totalQuestions: 6,
    questionsPerAttempt: 6,
    passingScore: 0.67,
    questions: [
      { id: 'q_the_brain_ovary_team_hpo_axis_1', text: 'HPO stands for…', options: ['Heart-Pancreas-Ovary', 'Hypothalamus-Pituitary-Ovary', 'Hormone-Protein-Oxygen', 'None'], correctIndex: 1, explanation: 'Hypothalamus, Pituitary, Ovary.', explanationEmoji: '🧠', level: 'beginner' },
      { id: 'q_the_brain_ovary_team_hpo_axis_2', text: 'The pituitary releases…', options: ['Estrogen', 'FSH and LH', 'Progesterone', 'Insulin'], correctIndex: 1, explanation: 'The pituitary sends FSH and LH.', explanationEmoji: '🧫', level: 'beginner' },
      { id: 'q_the_brain_ovary_team_hpo_axis_3', text: 'Ovarian hormones feed back to…', options: ['The stomach', 'The brain', 'The skin', 'Nowhere'], correctIndex: 1, explanation: 'They feed back to the brain.', explanationEmoji: '🔁', level: 'beginner' },
      { id: 'q_the_brain_ovary_team_hpo_axis_4', text: 'Why can stress and sleep change your cycle?', options: ["They don't", 'They act on the brain that runs the axis', 'Change blood type', 'Random'], correctIndex: 1, explanation: 'Brain-affecting factors ripple to the cycle.', explanationEmoji: '🔗', level: 'moderate' },
      { id: 'q_the_brain_ovary_team_hpo_axis_5', text: 'Why do extreme dieting or overtraining stop periods?', options: ['More estrogen', 'The brain pauses the axis to conserve energy', 'Too much iron', "It doesn't"], correctIndex: 1, explanation: 'Low energy availability can suppress the axis.', explanationEmoji: '⏸️', level: 'moderate' },
      { id: 'q_the_brain_ovary_team_hpo_axis_6', text: 'An athlete training hard with very low body fat loses her period. Best framing?', options: ['Healthy, ignore it', 'May be hypothalamic amenorrhea, worth support', 'Train more', "It's permanent"], correctIndex: 1, explanation: 'This pattern can be hypothalamic amenorrhea and deserves care.', explanationEmoji: '🚩', level: 'hard' },
    ],
  },
  {
    id: 'quiz_testosterone_in_your_body',
    title: 'Testosterone in Your Body',
    lessonId: 'lesson_testosterone_in_your_body',
    totalQuestions: 6,
    questionsPerAttempt: 6,
    passingScore: 0.67,
    questions: [
      { id: 'q_testosterone_in_your_body_1', text: 'Do people with ovaries make testosterone?', options: ['No', 'Yes, in smaller amounts', 'Only in pregnancy', 'Only after 40'], correctIndex: 1, explanation: 'Everyone makes testosterone.', explanationEmoji: '💪', level: 'beginner' },
      { id: 'q_testosterone_in_your_body_2', text: 'Testosterone supports…', options: ['Only muscles', 'Libido, energy, muscle, and mood', 'Nothing', 'Only hair'], correctIndex: 1, explanation: 'It contributes to several functions.', explanationEmoji: '💪', level: 'beginner' },
      { id: 'q_testosterone_in_your_body_3', text: 'Testosterone rises slightly around…', options: ['Your period', 'Ovulation', 'Bedtime', 'Never'], correctIndex: 1, explanation: 'It nudges up near ovulation.', explanationEmoji: '☀️', level: 'beginner' },
      { id: 'q_testosterone_in_your_body_4', text: 'Why might desire feel higher mid-cycle?', options: ['Low sleep', 'Testosterone and estrogen both rise near ovulation', 'Progesterone peaks', 'Random'], correctIndex: 1, explanation: 'Rising testosterone and estrogen boost desire.', explanationEmoji: '💞', level: 'moderate' },
      { id: 'q_testosterone_in_your_body_5', text: 'Why can very high testosterone cause acne or extra hair?', options: ["It can't", 'Excess androgens affect skin and hair follicles', 'It lowers estrogen only', 'Myth'], correctIndex: 1, explanation: 'High androgens stimulate oil glands and hair growth.', explanationEmoji: '🔬', level: 'moderate' },
      { id: 'q_testosterone_in_your_body_6', text: 'Acne, irregular periods, and extra facial hair together most warrant…', options: ['Ignoring it', 'A provider visit to explore causes like PCOS', 'More makeup', 'A haircut'], correctIndex: 1, explanation: 'That cluster suggests exploring androgen conditions.', explanationEmoji: '🔬', level: 'hard' },
    ],
  },
  {
    id: 'quiz_serotonin_mood_your_cycle',
    title: 'Serotonin, Mood & Your Cycle',
    lessonId: 'lesson_serotonin_mood_your_cycle',
    totalQuestions: 6,
    questionsPerAttempt: 6,
    passingScore: 0.67,
    questions: [
      { id: 'q_serotonin_mood_your_cycle_1', text: 'Serotonin affects…', options: ['Only muscles', 'Mood, sleep, and appetite', 'Bone length', 'Eye color'], correctIndex: 1, explanation: 'It shapes mood, sleep, and appetite.', explanationEmoji: '💛', level: 'beginner' },
      { id: 'q_serotonin_mood_your_cycle_2', text: 'Before your period, serotonin can…', options: ['Spike', 'Dip', 'Vanish forever', 'Turn to iron'], correctIndex: 1, explanation: 'It can dip as hormones fall.', explanationEmoji: '📉', level: 'beginner' },
      { id: 'q_serotonin_mood_your_cycle_3', text: 'Premenstrual carb cravings are linked to…', options: ['Boredom', 'A serotonin nudge from carbs', 'Low water', 'Nothing'], correctIndex: 1, explanation: 'Carbs can raise serotonin.', explanationEmoji: '🍞', level: 'beginner' },
      { id: 'q_serotonin_mood_your_cycle_4', text: 'Why can mood dip in the late luteal phase?', options: ['More estrogen', 'Falling hormones lower serotonin', 'Too much iron', 'Random'], correctIndex: 1, explanation: 'The hormone drop pulls serotonin down.', explanationEmoji: '📉', level: 'moderate' },
      { id: 'q_serotonin_mood_your_cycle_5', text: 'Why do some cravings feel almost automatic premenstrually?', options: ['Willpower failure', "There's a physiological serotonin basis", 'Bad habits only', 'Dehydration'], correctIndex: 1, explanation: 'Cravings have a real serotonin-linked basis.', explanationEmoji: '🧬', level: 'moderate' },
      { id: 'q_serotonin_mood_your_cycle_6', text: 'Severe monthly depression that lifts when the period starts may be…', options: ['Laziness', 'PMDD, which is treatable', 'Normal and untreatable', 'Imaginary'], correctIndex: 1, explanation: 'Cyclical severe mood symptoms can be PMDD.', explanationEmoji: '🩺', level: 'hard' },
    ],
  },
);

// ─── PER-PHASE PATH QUIZZES (Learn Redesign Phase 2 — 2026-09-02) ────
//
// Twelve quizzes (5 questions each, tiered 3× beginner / 1× moderate /
// 1× hard) paired to the 12 lessons added to LESSONS.push in
// learning-paths.ts under path_menstrual_phase / path_follicular_phase /
// path_ovulation / path_luteal_pms. Every question carries a `level`
// (Phase 0 validator R2). Voice matches the existing cycle_basics quizzes.
QUIZZES.push(
  // ─── path_menstrual_phase ───────────────────────────────────────
  {
    id: 'quiz_menstrual_day_one',
    title: 'Day 1: What just started',
    lessonId: 'lesson_menstrual_day_one',
    totalQuestions: 5,
    questionsPerAttempt: 5,
    passingScore: 0.6,
    questions: [
      { id: 'q_menstrual_day_one_1', text: 'What triggers day 1 bleeding?', options: ['A rise in estrogen', 'A drop in progesterone', 'Stress alone', 'Cold weather'], correctIndex: 1, explanation: 'The drop in progesterone at the end of the previous cycle is the signal that starts your period.', explanationEmoji: '🌊', level: 'beginner' },
      { id: 'q_menstrual_day_one_2', text: 'A typical period lasts about…', options: ['1 day', '3–7 days', '10–14 days', '2 weeks or more'], correctIndex: 1, explanation: '3–7 days is the common range. Cycles vary — yours is your own.', explanationEmoji: '💛', level: 'beginner' },
      { id: 'q_menstrual_day_one_3', text: 'What is menstrual blood mostly made of?', options: ['Only water', 'The uterine lining being shed', 'A random tissue', 'Nothing biological'], correctIndex: 1, explanation: "It's mainly the lining your uterus built during the last cycle.", explanationEmoji: '🩸', level: 'beginner' },
      { id: 'q_menstrual_day_one_4', text: 'Why does logging day 1 make Dottie better?', options: ["It doesn't", 'It sharpens the prediction of the next period', 'It sends data to a doctor', 'It changes the app theme'], correctIndex: 1, explanation: 'A few logged day-1s are what let the predictor learn your rhythm.', explanationEmoji: '📅', level: 'moderate' },
      { id: 'q_menstrual_day_one_5', text: 'Which of these is worth mentioning to a provider?', options: ['A 3-day period', 'A period with mild cramps', 'Soaking a pad or tampon every hour for several hours in a row', 'Any period at all'], correctIndex: 2, explanation: 'Very heavy flow (soaking through a full pad every hour for hours) is worth flagging — it can be a sign of things like fibroids or a bleeding disorder.', explanationEmoji: '🚩', level: 'hard' },
    ],
  },
  {
    id: 'quiz_menstrual_rest_as_strategy',
    title: 'Rest as strategy',
    lessonId: 'lesson_menstrual_rest_as_strategy',
    totalQuestions: 5,
    questionsPerAttempt: 5,
    passingScore: 0.6,
    questions: [
      { id: 'q_menstrual_rest_as_strategy_1', text: 'Why is energy often lower during your period?', options: ['Weakness of character', 'Estrogen and progesterone are at their lowest', 'Too much sleep', 'Only because of caffeine'], correctIndex: 1, explanation: 'Low hormones = less drive. Real biology, not a character flaw.', explanationEmoji: '🔋', level: 'beginner' },
      { id: 'q_menstrual_rest_as_strategy_2', text: 'What often helps cramps in the moment?', options: ['A brutal workout', 'A hot pack on the lower belly', 'Skipping meals', 'Cold showers only'], correctIndex: 1, explanation: 'Heat relaxes the muscle contractions behind cramps — simple and effective.', explanationEmoji: '☕', level: 'beginner' },
      { id: 'q_menstrual_rest_as_strategy_3', text: 'Movement during your period should be…', options: ['Skipped completely', 'Kind, not intense', 'As hard as possible', 'Only weightlifting'], correctIndex: 1, explanation: 'Gentle movement if it feels good — kindness is the rule.', explanationEmoji: '🌿', level: 'beginner' },
      { id: 'q_menstrual_rest_as_strategy_4', text: 'Why can heavy periods add fatigue?', options: ['They increase iron', 'Iron loss can leave you slightly more tired', 'They release adrenaline', "They don't"], correctIndex: 1, explanation: 'You lose iron with blood — a heavier period can mean noticeably lower energy.', explanationEmoji: '🩸', level: 'moderate' },
      { id: 'q_menstrual_rest_as_strategy_5', text: "Which best describes 'rest as strategy'?", options: ['Rest is lazy', 'Rest is calibrated care for a lower-hormone week', 'Rest is always bad', 'Only sleep in this week'], correctIndex: 1, explanation: 'Matching your effort to your hormones is smart, not indulgent.', explanationEmoji: '💛', level: 'hard' },
    ],
  },
  {
    id: 'quiz_menstrual_rebuild_as_flow_tapers',
    title: 'Rebuilding as flow tapers',
    lessonId: 'lesson_menstrual_rebuild_as_flow_tapers',
    totalQuestions: 5,
    questionsPerAttempt: 5,
    passingScore: 0.6,
    questions: [
      { id: 'q_menstrual_rebuild_as_flow_tapers_1', text: 'As bleeding lightens, estrogen…', options: ['Drops further', 'Starts to nudge upward', 'Stays flat forever', 'Peaks immediately'], correctIndex: 1, explanation: 'It begins climbing again — the start of the follicular rise.', explanationEmoji: '🌱', level: 'beginner' },
      { id: 'q_menstrual_rebuild_as_flow_tapers_2', text: 'Which foods help replenish iron?', options: ['Only candy', 'Eggs, beans, leafy greens', 'Only white bread', 'Only soda'], correctIndex: 1, explanation: 'Iron-rich foods help refill what a period costs.', explanationEmoji: '🍳', level: 'beginner' },
      { id: 'q_menstrual_rebuild_as_flow_tapers_3', text: 'Steady hydration helps because…', options: ['Water controls hormones directly', 'A well-watered body handles hormonal shifts more comfortably', "It doesn't", 'It replaces sleep'], correctIndex: 1, explanation: 'Being hydrated eases the transition between phases.', explanationEmoji: '💧', level: 'beginner' },
      { id: 'q_menstrual_rebuild_as_flow_tapers_4', text: 'The end of your period is a good time to…', options: ['Overhaul your whole life', 'Pencil in one small plan for the week ahead', 'Skip meals', 'Do nothing all week'], correctIndex: 1, explanation: 'Small plans stick better when your capacity is climbing.', explanationEmoji: '📅', level: 'moderate' },
      { id: 'q_menstrual_rebuild_as_flow_tapers_5', text: "Which is NOT a reason to plan lightly here?", options: ['Estrogen just began to rise', "You've likely been tired", 'Ovulation is imminent', 'Your body is still refilling reserves'], correctIndex: 2, explanation: "Ovulation isn't imminent yet — that's the late follicular window a bit later.", explanationEmoji: '🌿', level: 'hard' },
    ],
  },

  // ─── path_follicular_phase ──────────────────────────────────────
  {
    id: 'quiz_follicular_the_bright_climb',
    title: 'The bright climb',
    lessonId: 'lesson_follicular_the_bright_climb',
    totalQuestions: 5,
    questionsPerAttempt: 5,
    passingScore: 0.6,
    questions: [
      { id: 'q_follicular_the_bright_climb_1', text: 'Which hormone kicks off follicular growth?', options: ['LH', 'FSH', 'Progesterone', 'Insulin'], correctIndex: 1, explanation: 'FSH — follicle-stimulating hormone — from the pituitary starts the cycle.', explanationEmoji: '🧫', level: 'beginner' },
      { id: 'q_follicular_the_bright_climb_2', text: 'As follicles grow, they release…', options: ['Adrenaline', 'Estrogen', 'Cortisol', 'Melatonin'], correctIndex: 1, explanation: 'Growing follicles produce rising estrogen.', explanationEmoji: '✨', level: 'beginner' },
      { id: 'q_follicular_the_bright_climb_3', text: 'People often report the follicular week feels…', options: ['Foggier', 'Lighter, more social, more focused', 'The same as the period week', 'Exhausted'], correctIndex: 1, explanation: "Rising estrogen tends to lift mood and clarity — many people notice the shift.", explanationEmoji: '🌤️', level: 'beginner' },
      { id: 'q_follicular_the_bright_climb_4', text: 'What else does rising estrogen do?', options: ['Nothing', 'Rebuilds the uterine lining and updates mucus', 'Stops your heart', 'Turns off the brain'], correctIndex: 1, explanation: 'Invisible work — but it changes how you feel physically too.', explanationEmoji: '🧬', level: 'moderate' },
      { id: 'q_follicular_the_bright_climb_5', text: 'Why is contrast between weeks worth watching?', options: ['To beat yourself up', 'Because your own cycle patterns are the most useful data you have', 'To share online', "It isn't"], correctIndex: 1, explanation: 'Your own week-to-week feel is the most personal signal — it teaches you.', explanationEmoji: '💛', level: 'hard' },
    ],
  },
  {
    id: 'quiz_follicular_focus_window',
    title: 'Your focus window',
    lessonId: 'lesson_follicular_focus_window',
    totalQuestions: 5,
    questionsPerAttempt: 5,
    passingScore: 0.6,
    questions: [
      { id: 'q_follicular_focus_window_1', text: 'The mid-follicular window covers roughly…', options: ['Days 1–3', 'Days 8–13', 'Days 20–28', 'Days 15–20'], correctIndex: 1, explanation: 'Roughly days 8–13 for a typical cycle.', explanationEmoji: '📅', level: 'beginner' },
      { id: 'q_follicular_focus_window_2', text: 'In mid-follicular, estrogen is __ and progesterone is __.', options: ['Low; high', 'High; low', 'High; high', 'Low; low'], correctIndex: 1, explanation: 'High estrogen with low progesterone is the combination behind the focused feeling.', explanationEmoji: '🎯', level: 'beginner' },
      { id: 'q_follicular_focus_window_3', text: 'A common report in this window is feeling…', options: ['Cloudy', 'Clear-headed', 'Angrier than usual', 'Craving carbs strongly'], correctIndex: 1, explanation: 'Many people describe mid-follicular as clear and clicky — a good "climb" week.', explanationEmoji: '🧠', level: 'beginner' },
      { id: 'q_follicular_focus_window_4', text: 'How should you use this window?', options: ['Rest completely', 'Notice the pattern and plan hard work here if you can', 'Ignore your cycle', 'Skip meals'], correctIndex: 1, explanation: "It's a suggestion — cycles vary. Use the pattern where it fits your life.", explanationEmoji: '📅', level: 'moderate' },
      { id: 'q_follicular_focus_window_5', text: "If focus doesn't lift in this week, that…", options: ['Means something is broken', 'Is a personal failing', 'Is real information — some cycles feel flatter, and stress can flatten the whole climb', 'Should be ignored'], correctIndex: 2, explanation: "It's normal for the pattern to be quieter some cycles. Your data is still valid.", explanationEmoji: '💛', level: 'hard' },
    ],
  },
  {
    id: 'quiz_follicular_ride_the_momentum',
    title: 'Ride the momentum',
    lessonId: 'lesson_follicular_ride_the_momentum',
    totalQuestions: 5,
    questionsPerAttempt: 5,
    passingScore: 0.6,
    questions: [
      { id: 'q_follicular_ride_the_momentum_1', text: 'Rising estrogen also supports…', options: ['Slower recovery', 'Recovery from exercise and stress resilience', 'Only sleep', 'Only appetite'], correctIndex: 1, explanation: 'Estrogen has a broad supportive effect through this window.', explanationEmoji: '💪', level: 'beginner' },
      { id: 'q_follicular_ride_the_momentum_2', text: 'Same workout, late follicular, often feels…', options: ['Way harder', 'A bit easier', 'Identical to the period week', 'Impossible'], correctIndex: 1, explanation: 'Lower perceived exertion late follicular is a common pattern.', explanationEmoji: '🏃', level: 'beginner' },
      { id: 'q_follicular_ride_the_momentum_3', text: 'Small habits are more likely to stick when tried…', options: ['Only in the luteal week', 'When capacity is naturally higher (like this window)', 'Only on new-year day', 'Only after a fight'], correctIndex: 1, explanation: 'Riding the rise beats fighting the wind-down.', explanationEmoji: '🌱', level: 'beginner' },
      { id: 'q_follicular_ride_the_momentum_4', text: 'A better strategy than a big overhaul is…', options: ['One small experiment at a time', 'Redoing your entire life', 'No changes ever', 'Only extreme diets'], correctIndex: 0, explanation: 'Small experiments beat sweeping resolutions.', explanationEmoji: '🌤️', level: 'moderate' },
      { id: 'q_follicular_ride_the_momentum_5', text: "Why not try heroic new habits in the luteal week?", options: ['It works better then', 'Progesterone dominance and the pre-period dip make effortful change harder to sustain', 'Luteal week has more energy', "It doesn't matter"], correctIndex: 1, explanation: 'The luteal week naturally asks for less effort — habits started there are more likely to lapse.', explanationEmoji: '🌙', level: 'hard' },
    ],
  },

  // ─── path_ovulation ─────────────────────────────────────────────
  {
    id: 'quiz_ovulation_peak_day_signs',
    title: 'The peak day — signs to notice',
    lessonId: 'lesson_ovulation_peak_day_signs',
    totalQuestions: 5,
    questionsPerAttempt: 5,
    passingScore: 0.6,
    questions: [
      { id: 'q_ovulation_peak_day_signs_1', text: 'Ovulation is…', options: ['The whole cycle', 'The release of a mature egg', 'Your period', 'PMS'], correctIndex: 1, explanation: "It's a single moment — one egg released.", explanationEmoji: '🥚', level: 'beginner' },
      { id: 'q_ovulation_peak_day_signs_2', text: 'The trigger for ovulation is a surge in…', options: ['Insulin', 'LH (luteinizing hormone)', 'Progesterone', 'Melatonin'], correctIndex: 1, explanation: 'A sharp LH surge from the pituitary triggers release.', explanationEmoji: '⚡', level: 'beginner' },
      { id: 'q_ovulation_peak_day_signs_3', text: 'The egg lives for about…', options: ['A month', '12–24 hours after release', 'A week', 'A day of the cycle only'], correctIndex: 1, explanation: "The egg's short life is why the fertile window is so specific.", explanationEmoji: '☀️', level: 'beginner' },
      { id: 'q_ovulation_peak_day_signs_4', text: 'Around ovulation, cervical mucus often becomes…', options: ['Sticky and dry', 'Clear and stretchy (like egg white)', 'Blood-red', 'Absent'], correctIndex: 1, explanation: "That 'egg white' texture is a classic sign of the fertile window.", explanationEmoji: '💧', level: 'moderate' },
      { id: 'q_ovulation_peak_day_signs_5', text: 'A basal-body-temperature bump most often…', options: ['Predicts ovulation days before it happens', 'Confirms ovulation happened, after the fact', 'Never changes', 'Falls sharply during ovulation'], correctIndex: 1, explanation: 'BBT rises AFTER ovulation from progesterone — so it confirms rather than predicts.', explanationEmoji: '🌡️', level: 'hard' },
    ],
  },
  {
    id: 'quiz_ovulation_fertility_window',
    title: 'The fertile window (basics)',
    lessonId: 'lesson_ovulation_fertility_window',
    totalQuestions: 5,
    questionsPerAttempt: 5,
    passingScore: 0.6,
    questions: [
      { id: 'q_ovulation_fertility_window_1', text: 'The fertile window is wider than a day because…', options: ["The egg lives for a week", 'Sperm can survive in fertile mucus for up to 5 days', 'Estrogen is very high', 'Progesterone is very high'], correctIndex: 1, explanation: 'Sperm survival plus egg release = several days of fertility, not just one.', explanationEmoji: '🌸', level: 'beginner' },
      { id: 'q_ovulation_fertility_window_2', text: 'The classic fertile window covers roughly…', options: ['Only the day of ovulation', 'The 5 days leading up to ovulation plus ovulation day', 'The whole cycle', 'Only the day after ovulation'], correctIndex: 1, explanation: 'Roughly a 6-day window centered on ovulation.', explanationEmoji: '📅', level: 'beginner' },
      { id: 'q_ovulation_fertility_window_3', text: 'Calendar predictions are…', options: ['A reliable birth control method', 'Educational, not birth control', 'A legal contract', 'A cure for infertility'], correctIndex: 1, explanation: 'For preventing pregnancy, use a method chosen with a provider.', explanationEmoji: '⚠️', level: 'beginner' },
      { id: 'q_ovulation_fertility_window_4', text: 'The egg itself is only alive for about…', options: ['A month', '12–24 hours', 'A week', '5 days'], correctIndex: 1, explanation: "The egg's short life is why the window peaks at ovulation.", explanationEmoji: '🥚', level: 'moderate' },
      { id: 'q_ovulation_fertility_window_5', text: 'Sperm survival in fertile mucus is what stretches the window UP TO…', options: ['1 hour', '5 days', '30 days', "It doesn't"], correctIndex: 1, explanation: 'Under fertile mucus, sperm can persist for as long as ~5 days.', explanationEmoji: '💧', level: 'hard' },
    ],
  },
  {
    id: 'quiz_ovulation_mood_libido',
    title: 'Ovulation, mood & libido',
    lessonId: 'lesson_ovulation_mood_libido',
    totalQuestions: 5,
    questionsPerAttempt: 5,
    passingScore: 0.6,
    questions: [
      { id: 'q_ovulation_mood_libido_1', text: 'Just before ovulation, estrogen…', options: ['Drops sharply', 'Peaks', 'Stays flat', 'Is at its lowest'], correctIndex: 1, explanation: 'Estrogen peaks in the lead-up to ovulation.', explanationEmoji: '✨', level: 'beginner' },
      { id: 'q_ovulation_mood_libido_2', text: 'Around ovulation, testosterone…', options: ['Drops to zero', 'Gets a small bump', 'Stays completely flat all cycle', 'Doubles overnight'], correctIndex: 1, explanation: 'A small but real testosterone bump nudges libido up for many people.', explanationEmoji: '💪', level: 'beginner' },
      { id: 'q_ovulation_mood_libido_3', text: 'A common ovulation-window pattern is…', options: ['Lower confidence', 'A lift in confidence and sociability', 'Nothing at all', 'Increased sleep only'], correctIndex: 1, explanation: 'Peak estrogen + testosterone bump often shows up as a confidence lift.', explanationEmoji: '☀️', level: 'beginner' },
      { id: 'q_ovulation_mood_libido_4', text: "If you don't notice this mood shift, that means…", options: ['Something is wrong', "It's a totally normal variation — sensitivity to this shift varies a lot", 'Your cycle is broken', 'You should worry'], correctIndex: 1, explanation: 'Some people feel the peak strongly, others not at all — both fine.', explanationEmoji: '🌿', level: 'moderate' },
      { id: 'q_ovulation_mood_libido_5', text: 'Why can this window be good for something nervy (a pitch, a hard talk)?', options: ["It isn't", 'Peak estrogen and a testosterone bump often add a bit of nerve', 'Because sleep is bad here', 'Because you\'ll be angry'], correctIndex: 1, explanation: "The hormonal mix supports courage — if that's the pattern for you.", explanationEmoji: '💞', level: 'hard' },
    ],
  },

  // ─── path_luteal_pms ────────────────────────────────────────────
  {
    id: 'quiz_luteal_wind_down',
    title: 'The wind-down begins',
    lessonId: 'lesson_luteal_wind_down',
    totalQuestions: 5,
    questionsPerAttempt: 5,
    passingScore: 0.6,
    questions: [
      { id: 'q_luteal_wind_down_1', text: 'Progesterone in the luteal phase is made mostly by the…', options: ['Ovary follicles', 'Corpus luteum (the emptied follicle)', 'Pancreas', 'Liver'], correctIndex: 1, explanation: 'The corpus luteum forms from the follicle after ovulation and pumps out progesterone.', explanationEmoji: '🌙', level: 'beginner' },
      { id: 'q_luteal_wind_down_2', text: 'Progesterone in the luteal window tends to be…', options: ['Stimulating', 'Calm and warming', 'Sharp and jittery', 'Neutral, no effect'], correctIndex: 1, explanation: 'The calm, warming quality is why cozy rest becomes more appealing.', explanationEmoji: '💤', level: 'beginner' },
      { id: 'q_luteal_wind_down_3', text: 'BBT tracking notices the luteal shift because progesterone…', options: ['Cools the body', 'Raises basal temperature slightly', "Doesn't affect temperature", 'Turns off metabolism'], correctIndex: 1, explanation: 'The small BBT rise post-ovulation is the marker BBT charts look for.', explanationEmoji: '🌡️', level: 'beginner' },
      { id: 'q_luteal_wind_down_4', text: 'Earlier bedtimes in the luteal week are…', options: ['A sign of weakness', "Real biology speaking — not a character flaw", 'Only caused by boredom', 'A sign of illness'], correctIndex: 1, explanation: 'Progesterone is mildly sedating — needing more rest is biology.', explanationEmoji: '💛', level: 'moderate' },
      { id: 'q_luteal_wind_down_5', text: 'If pregnancy doesn\'t happen, progesterone will…', options: ['Stay high forever', 'Drop, which triggers your next period', 'Rise higher', 'Turn into estrogen'], correctIndex: 1, explanation: 'That drop is the day-1 trigger you met in the menstrual path.', explanationEmoji: '🌊', level: 'hard' },
    ],
  },
  {
    id: 'quiz_luteal_pms_what_is_happening',
    title: "PMS: what's actually happening",
    lessonId: 'lesson_luteal_pms_what_is_happening',
    totalQuestions: 5,
    questionsPerAttempt: 5,
    passingScore: 0.6,
    questions: [
      { id: 'q_luteal_pms_what_is_happening_1', text: 'In the last few days before a period, estrogen and progesterone…', options: ['Both peak', 'Both drop', 'Rise sharply', 'Stay completely flat'], correctIndex: 1, explanation: "The late-luteal drop is what sets up PMS symptoms and, ultimately, day 1.", explanationEmoji: '🌧️', level: 'beginner' },
      { id: 'q_luteal_pms_what_is_happening_2', text: 'Alongside those hormone drops, serotonin often…', options: ['Peaks', 'Dips', 'Stays flat', 'Doubles'], correctIndex: 1, explanation: 'The serotonin dip is a big part of PMS mood changes.', explanationEmoji: '💛', level: 'beginner' },
      { id: 'q_luteal_pms_what_is_happening_3', text: 'Carb cravings before a period are partly a…', options: ['Random glitch', 'Serotonin thing — carbs help the brain make more serotonin', 'Sign of illness', 'Failure of willpower'], correctIndex: 1, explanation: "They're a real biological signal, not a moral failing.", explanationEmoji: '🍫', level: 'beginner' },
      { id: 'q_luteal_pms_what_is_happening_4', text: 'Bloating and breast tenderness in this window are usually…', options: ['A medical emergency', 'Common and settle once your period starts', 'A sign of pregnancy always', 'Permanent'], correctIndex: 1, explanation: 'Very common late-luteal patterns that ease as bleeding begins.', explanationEmoji: '💧', level: 'moderate' },
      { id: 'q_luteal_pms_what_is_happening_5', text: 'PMS symptoms severe enough to disrupt your life every month may be…', options: ['Just PMS, ignore it', 'PMDD — a real, treatable condition worth a provider conversation', 'A sign to punish yourself', 'Untreatable'], correctIndex: 1, explanation: "PMDD is real and treatable — worth mentioning, never a personal failing.", explanationEmoji: '🩺', level: 'hard' },
    ],
  },
  {
    id: 'quiz_luteal_care_ideas',
    title: 'Care ideas for the PMS window',
    lessonId: 'lesson_luteal_care_ideas',
    totalQuestions: 5,
    questionsPerAttempt: 5,
    passingScore: 0.6,
    questions: [
      { id: 'q_luteal_care_ideas_1', text: 'PMS is best understood as…', options: ['A personal failing', 'A set of physiological shifts', 'Faked', 'Only in your head'], correctIndex: 1, explanation: "It's biology — real shifts you can support with small habits.", explanationEmoji: '💛', level: 'beginner' },
      { id: 'q_luteal_care_ideas_2', text: 'Gentle movement this week is meant to…', options: ['Fight the wind-down', 'Support mood without draining you', 'Replace sleep', 'Push you to exhaustion'], correctIndex: 1, explanation: 'Kind movement — walk, easy yoga, swim — helps without wrecking recovery.', explanationEmoji: '🚶', level: 'beginner' },
      { id: 'q_luteal_care_ideas_3', text: 'Steadier energy this week comes from…', options: ['Sugar spikes', 'Meals with protein and complex carbs', 'Skipping meals', 'Coffee only'], correctIndex: 1, explanation: 'Steady meals stabilise mood better than spikes and crashes.', explanationEmoji: '🍽️', level: 'beginner' },
      { id: 'q_luteal_care_ideas_4', text: 'Protecting sleep in the luteal week is worth extra effort because…', options: ["It isn't", 'Even 30 more minutes matter more here than earlier in the cycle', 'Only naps count', 'Sleep is always overrated'], correctIndex: 1, explanation: 'The body is doing more this week — more sleep is calibrated, not lazy.', explanationEmoji: '💤', level: 'moderate' },
      { id: 'q_luteal_care_ideas_5', text: 'Being kinder to yourself in this window is…', options: ['Indulgent', 'Calibrated — the body is doing more, so give it more slack', 'A waste of time', 'Only for children'], correctIndex: 1, explanation: "Kindness here is matched effort — real self-management, not self-indulgence.", explanationEmoji: '🛁', level: 'hard' },
    ],
  },
);

// The 51 quizzes that came in with the imported curriculum (306 questions,
// every one carrying its `level` so the adaptive engine can tier it).
QUIZZES.push(...CURRICULUM_QUIZZES);

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