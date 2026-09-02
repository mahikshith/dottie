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