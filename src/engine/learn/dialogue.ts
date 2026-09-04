/**
 * Dottie — the companion conversation engine (pure)
 *
 * Turns a lesson, its exercises and its quiz into a CONVERSATION between the
 * user and their companion, instead of a wall of text followed by a scorecard.
 *
 * ─── WHERE THIS IS USED NOW (device-test-16) ────────────────────────
 *
 *  DT14 used the whole thing to replace the lesson READER with a chat. On
 *  device that was a mistake: repetitive, no sense of whose turn it was, and
 *  it re-showed the options after a correct answer. The reader is back, and
 *  `buildLessonScript` is currently unused by any screen.
 *
 *  What survived is the part that was actually right — `reactTo`, which now
 *  drives the QUIZ's feedback panel (app/quiz/[id].tsx). That is where
 *  turn-taking was always the point: a question, an answer, and a companion
 *  that responds without ever saying "wrong" and without repeating itself.
 *
 *  buildLessonScript is kept, tested, and ready for the next screen that wants
 *  a scripted conversation — but nothing renders it today, and that is
 *  deliberate rather than an oversight.
 *
 * ─── WHY ────────────────────────────────────────────────────────────
 *
 *  Owner, device-test-14: "In Duolingo, whenever there is a lesson, it looks
 *  like a conversation going on between the user and the mascot ... if the user
 *  gets it wrong, we provide a detailed information. If the user gets it right,
 *  we also provide that ... It should feel like there is a conversation going
 *  on. This is the real place where the companions come to life — playing an
 *  actual role, explaining, informing, correcting, acting like a friend."
 *
 *  Dottie's companion has been decorative. It sat in a corner of the quiz
 *  result and smiled. Everything below exists to make it the one doing the
 *  teaching.
 *
 * ─── WHAT THIS ENGINE IS, AND WHAT IT IS NOT ────────────────────────
 *
 *  It is a SCRIPT BUILDER and a REACTION PICKER. It sequences vetted content
 *  and chooses the connective tissue around it — a greeting, an
 *  acknowledgement, a segue, a way of saying "not quite" that doesn't feel like
 *  a buzzer.
 *
 *  It is NOT a generator of health information. Every factual sentence a
 *  companion speaks is lifted VERBATIM from the curriculum: a lesson section,
 *  an exercise's `explanation`, or a quiz question's `explanation`. The engine
 *  never writes a claim about a body, and never rephrases one. That boundary is
 *  the entire safety argument for putting words in a character's mouth, and
 *  test:dialogue asserts it by checking every factual beat back against the
 *  source content it came from.
 *
 *  The conversational lines it DOES own are deliberately contentless: "Ready?",
 *  "Ooh — close.", "That's the one." They carry tone, never information.
 *
 * ─── DETERMINISM ────────────────────────────────────────────────────
 *
 *  No Math.random anywhere. Variation comes from a seed the caller supplies
 *  (the lesson id) plus the position in the conversation, so the same lesson
 *  replays identically — which is what makes it testable, and what stops a
 *  re-render from swapping the companion's line mid-sentence.
 */

import type {
  Lesson,
  LessonSection,
  Quiz,
  QuizQuestion,
  Exercise,
} from '../../types/content.types';
import type { CompanionAnim } from '../../content/companion-lottie';

// ─── THE SCRIPT ──────────────────────────────────────────────────────

/** One thing that happens in the conversation. */
export type ScriptStep =
  | CompanionSay
  | CompanionShow
  | AskStep
  | FinishStep;

/** The companion speaks. Rendered as a chat bubble on the left. */
export interface CompanionSay {
  kind: 'say';
  id: string;
  text: string;
  expression: CompanionAnim;
  /** True when the text came from the curriculum rather than from this engine. */
  fromContent: boolean;
}

/** The companion hands over a highlighted card — a fact, tip or callout. */
export interface CompanionShow {
  kind: 'show';
  id: string;
  text: string;
  emoji?: string;
  highlight?: string;
  variant: 'fact' | 'tip' | 'callout' | 'heading';
  fromContent: true;
}

/** A question. The user answers by tapping; the engine reacts. */
export interface AskStep {
  kind: 'ask';
  id: string;
  /** How the companion introduces the question — tone only. */
  lead: string;
  prompt: string;
  options: AskOption[];
  correctIndex: number;
  /** The vetted explanation, shown after EITHER answer. */
  explanation: string;
  explanationEmoji?: string;
  /** Where this came from, so a harness can check it back against the source. */
  source: 'exercise' | 'quiz';
  sourceId: string;
}

export interface AskOption {
  label: string;
  emoji?: string;
}

/** The closing beat. */
export interface FinishStep {
  kind: 'finish';
  id: string;
  text: string;
  expression: CompanionAnim;
}

export interface LessonScript {
  lessonId: string;
  steps: ScriptStep[];
  /** How many `ask` steps are in the script — drives the progress bar. */
  questionCount: number;
}

// ─── BUILDING THE SCRIPT ─────────────────────────────────────────────

export interface BuildScriptInput {
  lesson: Lesson;
  exercises: readonly Exercise[];
  quiz: Quiz | null;
  /** Display name of the companion, used in its opening line. */
  companionName: string;
  /** Optional: the user's name, so the opener can use it. */
  userName?: string | null;
  /** How many questions to weave in. Default 5 — a lesson, not an exam. */
  maxQuestions?: number;
}

const DEFAULT_MAX_QUESTIONS = 5;

/**
 * Build the conversation.
 *
 * The shape is deliberate: the companion opens, teaches a couple of beats,
 * THEN asks — never a question before anything has been taught, which is the
 * fastest way to make someone feel tested rather than talked to. Questions are
 * interleaved between teaching beats rather than stacked at the end, so the
 * conversation never turns into "lesson, then quiz" wearing a costume.
 */
export function buildLessonScript(input: BuildScriptInput): LessonScript {
  const { lesson, companionName } = input;
  const seed = hash(lesson.id);
  const steps: ScriptStep[] = [];
  let n = 0;
  const nextId = (prefix: string) => `${prefix}_${n++}`;

  // ─── Opening ───────────────────────────────────────────────────
  steps.push({
    kind: 'say',
    id: nextId('open'),
    text: pick(OPENERS, seed, 0)(companionName, input.userName ?? null, lesson.title),
    expression: 'encourage',
    fromContent: false,
  });

  // ─── Teaching beats, from the lesson's own sections ─────────────
  const teaching = lesson.sections.map((section, i) => sectionToStep(section, nextId(`sec${i}`)));

  // ─── Questions ─────────────────────────────────────────────────
  const asks = collectAsks(input, seed);
  const max = input.maxQuestions ?? DEFAULT_MAX_QUESTIONS;
  const chosen = asks.slice(0, max);

  // Interleave: teach at least two beats before the first question, then a
  // question roughly every two beats. A question that arrives before anything
  // has been said reads as a pop quiz.
  const LEAD_IN = 2;
  let askIdx = 0;
  teaching.forEach((step, i) => {
    steps.push(step);
    const canAsk = i + 1 >= LEAD_IN && (i + 1 - LEAD_IN) % 2 === 0;
    if (canAsk && askIdx < chosen.length) {
      steps.push(chosen[askIdx]!);
      askIdx++;
    }
  });
  // Anything that didn't fit goes at the end rather than being dropped.
  while (askIdx < chosen.length) {
    steps.push(chosen[askIdx]!);
    askIdx++;
  }

  // ─── Closing ───────────────────────────────────────────────────
  steps.push({
    kind: 'finish',
    id: nextId('finish'),
    text: pick(CLOSERS, seed, 1)(lesson.title),
    expression: 'proud',
  });

  return {
    lessonId: lesson.id,
    steps,
    questionCount: steps.filter((s) => s.kind === 'ask').length,
  };
}

/**
 * A lesson section becomes either something the companion SAYS or something it
 * SHOWS. Headings and prose are spoken; facts, tips and callouts are handed
 * over as cards, because those are the bits worth keeping and a chat bubble is
 * the wrong container for something you want to remember.
 */
function sectionToStep(section: LessonSection, id: string): ScriptStep {
  if (section.type === 'fact' || section.type === 'tip' || section.type === 'callout') {
    return {
      kind: 'show',
      id,
      text: section.content,
      emoji: section.emoji,
      highlight: section.highlight,
      variant: section.type,
      fromContent: true,
    };
  }
  if (section.type === 'heading') {
    return {
      kind: 'say',
      id,
      // Spoken as a heading, not decorated — the words are the content's.
      text: section.content,
      expression: 'encourage',
      fromContent: true,
    };
  }
  return {
    kind: 'say',
    id,
    text: section.content,
    expression: 'idle',
    fromContent: true,
  };
}

/**
 * Gather askable questions from the exercises and the quiz.
 *
 * Only the exercise types that are genuinely a single tap become conversation
 * questions — `tap_diagram` is exactly "pick one of these", which is what a
 * chat can ask. Matching pairs and ordering are good exercises but they are
 * screens, not sentences, and forcing them into a bubble would make both worse;
 * they stay in the practice flow where they already live.
 */
function collectAsks(input: BuildScriptInput, seed: number): AskStep[] {
  const out: AskStep[] = [];

  for (const ex of input.exercises) {
    if (ex.type !== 'tap_diagram') continue;
    out.push({
      kind: 'ask',
      id: `ask_${ex.id}`,
      lead: pick(QUESTION_LEADS, seed, out.length),
      prompt: ex.prompt,
      options: ex.options.map((o) => ({ label: o.label, emoji: o.emoji })),
      correctIndex: ex.correctIndex,
      explanation: ex.explanation,
      explanationEmoji: ex.explanationEmoji,
      source: 'exercise',
      sourceId: ex.id,
    });
  }

  for (const question of input.quiz?.questions ?? []) {
    out.push(quizQuestionToAsk(question, pick(QUESTION_LEADS, seed, out.length)));
  }

  return out;
}

function quizQuestionToAsk(question: QuizQuestion, lead: string): AskStep {
  return {
    kind: 'ask',
    id: `ask_${question.id}`,
    lead,
    prompt: question.text,
    options: question.options.map((label) => ({ label })),
    correctIndex: question.correctIndex,
    explanation: question.explanation,
    explanationEmoji: question.explanationEmoji,
    source: 'quiz',
    sourceId: question.id,
  };
}

// ─── REACTING TO AN ANSWER ───────────────────────────────────────────

export interface ReactionInput {
  correct: boolean;
  /** 1 on the first try, 2 on the retry. Never more — see below. */
  attempt: number;
  /** Consecutive correct answers BEFORE this one. */
  streak: number;
  /** The vetted explanation for this question. */
  explanation: string;
  explanationEmoji?: string;
  /** Stable variation source — usually the question id. */
  seed: string;
  /** Which question this is, so consecutive reactions can't repeat an opener. */
  index: number;
  /**
   * True when the PREVIOUS question was missed. Getting the next one right
   * after a stumble is the beat that most deserves noticing, and a companion
   * that treats it like any other correct answer isn't paying attention.
   */
  afterMiss?: boolean;
}

/**
 * Which beat this is. The screen uses it to decide layout (a retry needs a
 * button); the harness uses it to assert every branch is reachable — the
 * previous version had two branches no screen could ever trigger.
 */
export type ReactionKind =
  | 'hit'
  | 'streak'
  | 'comeback'
  | 'recovered'
  | 'miss'
  | 'told';

export interface Reaction {
  /** Which of the six beats this is. */
  kind: ReactionKind;
  /** The companion's tonal opener. Contentless by design. */
  opener: string;
  /** The vetted explanation, verbatim. Always present — right OR wrong. */
  explanation: string;
  explanationEmoji?: string;
  expression: CompanionAnim;
  /** True when the user should get another go at this question. */
  offerRetry: boolean;
  /** An optional extra line — a streak note, or a "let's move on". */
  aside: string | null;
}

/**
 * Choose how the companion responds.
 *
 * ─── THE RULES THIS ENCODES ─────────────────────────────────────────
 *
 *  1. It never says "Wrong". A buzzer is a scorekeeper's word. The openers for
 *     a miss normalise it first ("Ooh — close.", "That one catches people.")
 *     and then teach, which is what a friend sitting next to you does.
 *  2. A right answer STILL gets the full explanation. The owner asked for this
 *     explicitly, and it's right: getting there by luck and getting there by
 *     understanding look identical from the outside, so explain both times.
 *  3. Two attempts, then the answer. A third go is a trap, not a lesson.
 *  4. Streaks change the TONE and nothing else. The facts don't get warmer
 *     because you're on a run.
 *  5. Openers rotate deterministically and never repeat back to back — the
 *     same discipline as the encouragement pool. A companion that says "Nice!"
 *     four times running stops being a character and becomes a sound effect.
 */
export function reactTo(input: ReactionInput): Reaction {
  const seed = hash(input.seed) + input.index;
  const base = {
    explanation: input.explanation,
    explanationEmoji: input.explanationEmoji,
  };

  if (input.correct) {
    // Got there on the SECOND go. This is the beat the old version could never
    // reach, because the only screen using the engine hardcoded attempt: 1 —
    // so nobody was ever offered a retry, and nobody was ever congratulated for
    // taking one. It is also the most earned correct answer in the quiz.
    if (input.attempt >= 2) {
      return {
        ...base,
        kind: 'recovered',
        opener: pick(RECOVERED, seed, input.index),
        expression: 'proud',
        offerRetry: false,
        aside: 'Second look got it. That counts double with me.',
      };
    }

    // Right straight after missing the previous one. Worth naming: a companion
    // that says "Nice." identically whether you are cruising or clawing back
    // isn't listening, it's counting.
    if (input.afterMiss) {
      return {
        ...base,
        kind: 'comeback',
        opener: pick(COMEBACKS, seed, input.index),
        expression: 'proud',
        offerRetry: false,
        aside: null,
      };
    }

    const streaked = input.streak >= 2;
    return {
      ...base,
      kind: streaked ? 'streak' : 'hit',
      opener: pick(streaked ? STREAK_HITS : HITS, seed, input.index),
      expression: streaked ? 'celebrate' : 'proud',
      offerRetry: false,
      aside: streaked ? `${input.streak + 1} in a row.` : null,
    };
  }

  // First miss: normalise, explain, and offer another go.
  if (input.attempt === 1) {
    return {
      ...base,
      kind: 'miss',
      opener: pick(MISSES, seed, input.index),
      expression: 'encourage',
      offerRetry: true,
      aside: pick(RETRY_ASIDES, seed, input.index),
    };
  }

  // Second miss: no third attempt. Say it plainly, keep the tone level, move on.
  return {
    ...base,
    kind: 'told',
    opener: pick(SECOND_MISSES, seed, input.index),
    expression: 'cozy',
    offerRetry: false,
    aside: pick(TOLD_ASIDES, seed, input.index),
  };
}

// ─── ASKING ──────────────────────────────────────────────────────────

export interface LeadInput {
  /** 0-based position of this question. */
  index: number;
  /** How many questions the quiz has. */
  total: number;
  /** Stable variation source — usually the session id. */
  seed: string;
  /** True when the previous question was missed, so the lead softens. */
  afterMiss: boolean;
  /** Consecutive correct answers so far. */
  streak: number;
}

/**
 * The line the companion says BEFORE the question.
 *
 * Until now the companion only ever spoke after an answer — it reacted, but it
 * never asked. That is why the screen read as a scorecard with a mascot glued
 * on rather than a conversation: one side of the exchange was missing. The
 * pools already existed (QUESTION_LEADS, written in DT14); nothing rendered
 * them.
 *
 * Position picks the register: the first question sets up, the last one lands,
 * a question after a stumble gets the pressure taken off it, and a run gets
 * played with. Contentless throughout — a lead never hints at the answer, which
 * is why none of these pools may ever mention a symptom, a phase or a number.
 */
export function leadFor(input: LeadInput): string {
  const seed = hash(input.seed) + input.index;
  if (input.index === 0) return pick(FIRST_LEADS, seed, input.index);
  if (input.total > 1 && input.index === input.total - 1) {
    return pick(FINAL_LEADS, seed, input.index);
  }
  if (input.afterMiss) return pick(SOFT_LEADS, seed, input.index);
  if (input.streak >= 3) return pick(STREAK_LEADS, seed, input.index);
  return pick(QUESTION_LEADS, seed, input.index);
}

// ─── THE COMPANION'S OWN WORDS ───────────────────────────────────────
//
// Everything below is TONE. Not one line states a fact about a body, a cycle,
// a symptom or a treatment — that is the whole point of keeping them here,
// separate and small enough to read in one sitting. If a line in these pools
// ever needs to say something true about health, it belongs in the curriculum
// instead, where it can be reviewed as content.

const OPENERS: ((name: string, user: string | null, title: string) => string)[] = [
  (name, user, title) =>
    user ? `Hey ${user} — it's ${name}. Today: ${title}. Ready?` : `Hey — it's ${name}. Today: ${title}. Ready?`,
  (name, _user, title) => `${name} here. Let's do ${title} together — I'll do the talking, you do the tapping.`,
  (_name, user, title) => (user ? `Right, ${user}. ${title}. Come sit down.` : `Right. ${title}. Come sit down.`),
  (name, _user, title) => `Okay — ${title}. I've been looking forward to this one. — ${name}`,
];

const QUESTION_LEADS: string[] = [
  'Quick one:',
  "Let's see what stuck:",
  'Try this:',
  'Your turn:',
  'Small test, no stakes:',
  "Have a guess — I'll explain either way:",
  'Next:',
  'Okay, this one I like:',
  'Bear with me:',
];

/** The very first question — set the terms, take the pressure off. */
const FIRST_LEADS: string[] = [
  "Right — first one. No stakes, I promise.",
  "Let's start easy.",
  "Here we go. I'll explain every one either way.",
  "First question. Guess freely — nothing here is scored against you.",
];

/** The last question — land it without making it feel like an exam. */
const FINAL_LEADS: string[] = [
  'Last one.',
  'Okay — final question.',
  "One more and we're done.",
  'Last one, and then I’ll let you go.',
];

/** Straight after a miss — take the weight off before asking again. */
const SOFT_LEADS: string[] = [
  'Fresh one. That last one was mean.',
  'Moving on — try this:',
  'Clean slate:',
  "Different angle, same idea:",
];

/** They're on a run — play with them a bit. */
const STREAK_LEADS: string[] = [
  "Alright, let's see if I can catch you out:",
  "You're making this look easy. Try:",
  'Harder one, then:',
  "I'm going to keep going until one of these lands:",
];

const HITS: string[] = [
  "That's the one.",
  'Yep — exactly that.',
  'Got it in one.',
  'Correct.',
  'Nice.',
  'Straight through.',
  'Yes — that one.',
  'Bang on.',
];

const STREAK_HITS: string[] = [
  "You're on a roll.",
  "Right again — you're flying.",
  'Okay, showing off now.',
  "That's a run.",
  "I'm running out of ways to say yes.",
  "Again? Fine, I'm impressed.",
];

/** Correct straight after missing the previous question. */
const COMEBACKS: string[] = [
  'And back you come.',
  "There it is — straight after a wobble.",
  'See, that one you had all along.',
  "Recovered. That's the bit that matters.",
  'Right back on it.',
];

/** Correct on the second attempt, after taking the retry. */
const RECOVERED: string[] = [
  'There we go.',
  'Second time, and you got there yourself.',
  "That's it — and you worked it out rather than being told.",
  'Yes. Worth the extra look.',
];

const MISSES: string[] = [
  'Ooh — close.',
  'Not quite, and honestly that one catches people.',
  'Nearly. Let me show you why.',
  'Ah — reasonable guess, but no.',
  'That one trips a lot of people up.',
  "Not this time — and it's a fair mistake.",
  'Hmm, not quite. Stay with me.',
];

/** The offer of a second go. Never a scold, never a countdown. */
const RETRY_ASIDES: string[] = [
  'Want another go?',
  'Have one more look?',
  'Try again — I’ll wait.',
  'One more shot, if you like.',
];

const SECOND_MISSES: string[] = [
  'Still no — so let me just tell you.',
  'Right, I’ll stop being coy.',
  "Here's the answer, plainly.",
  "Okay, I'll give you this one.",
  "Let's not labour it — here it is.",
];

/** After the answer is handed over. Level tone; no consolation prize. */
const TOLD_ASIDES: string[] = [
  "Genuinely — this one's fiddly. Onward.",
  "Don't dwell on it. Next.",
  'Now you know it, which was the point.',
  "That one's worth a second read later.",
];

const CLOSERS: ((title: string) => string)[] = [
  (title) => `And that's ${title}. You did the thinking — I just talked a lot.`,
  (title) => `That's ${title} done. Come back to it whenever; it'll still be here.`,
  () => `Done. That's the whole thing — no small print.`,
  (title) => `${title}, finished. Nicely done.`,
];

// ─── ROTATION ────────────────────────────────────────────────────────

/**
 * Deterministic pick that never lands on the same entry two calls running.
 *
 * A plain `seed % length` repeats whenever consecutive indexes are congruent,
 * which is exactly the "Nice! Nice! Nice!" failure. Offsetting by the index
 * guarantees adjacent picks differ as long as the pool has more than one entry.
 */
export function pick<T>(pool: readonly T[], seed: number, index: number): T {
  if (pool.length === 0) throw new Error('dialogue: empty pool');
  const i = Math.abs(seed + index * 1) % pool.length;
  return pool[i]!;
}

/** Small stable string hash. Not cryptographic — just needs to be the same twice. */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/** Every tonal line the engine can speak — the harness sweeps these for claims. */
export const ALL_TONAL_LINES: string[] = [
  ...OPENERS.map((f) => f('Nyx', 'Sam', 'A Lesson')),
  ...QUESTION_LEADS,
  ...FIRST_LEADS,
  ...FINAL_LEADS,
  ...SOFT_LEADS,
  ...STREAK_LEADS,
  ...HITS,
  ...STREAK_HITS,
  ...COMEBACKS,
  ...RECOVERED,
  ...MISSES,
  ...RETRY_ASIDES,
  ...SECOND_MISSES,
  ...TOLD_ASIDES,
  ...CLOSERS.map((f) => f('A Lesson')),
];
