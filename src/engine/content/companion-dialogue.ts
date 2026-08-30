/**
 * Dottie — Companion Dialogue Engine
 *
 * The PERSONALIZATION LAYER on top of shared cohort content.
 *
 * ─── HOW IT FITS INTO THE CONTENT PIPELINE ──────────────────────────
 *
 *  ContentResolver.resolve(stateKey, type)
 *           │
 *           │ returns raw cohort content (same for all users in state)
 *           ▼
 *  DialogueEngine.wrap(content, companion, mood, context)
 *           │
 *           │ applies companion-specific voice + template interpolation
 *           ▼
 *  Final user-facing string ("Luna noticed your skin is glowing! 🦊")
 *
 * KEY PROPERTIES:
 * - PURE FUNCTIONS — no I/O, no async, no side effects
 * - LOCAL & CHEAP — pure string operations, runs in <1ms
 * - DETERMINISTIC — same inputs always produce same output
 * - STATELESS — caller manages mood selection; engine just renders
 *
 * SUPPORTED PLACEHOLDERS:
 *   {{companion_name}}    → "Luna", "Pip", "Mira", "Nyx", "Sage", "Dottie"
 *   {{phase_name}}        → "menstrual" / "follicular" / "ovulatory" / "luteal"
 *   {{phase_label}}       → "Menstrual" / "Follicular" / etc. (Title Case)
 *   {{day_in_phase}}      → 1, 2, 3, ...
 *   {{day_in_cycle}}      → 1, 2, ..., 28
 *   {{streak_count}}      → "12-day", "47-day" etc.
 *   {{streak_number}}     → 12, 47 (raw number)
 *   {{user_mood}}         → "great", "okay", "rough" (if set)
 *   {{time_of_day}}       → "morning" / "afternoon" / "evening" / "night"
 *   {{time_greeting}}     → "Good morning" / "Good afternoon" / "Hey" / "Hi"
 *   {{rendered_question}} → used when wrapping a phase question
 *   {{rendered_insight}}  → used when wrapping a daily decode card
 *   {{emoji}}             → companion's emoji (🦊, 🐰, etc.)
 */

import {
  CompanionType,
  CompanionMood,
  DialogueContext,
  MoodCondition,
  MOOD_PRIORITY,
} from '../../types/companion.types';
import { Phase } from '../../types/cycle.types';
import { COMPANIONS, COMPANION_PHASE_MOODS, getCompanion } from '../../content/companions';

// ─── DIALOGUE TEMPLATES PER COMPANION × MOOD ─────────────────────────

/**
 * Per-companion dialogue templates organized by mood.
 *
 * Each template uses {{placeholders}} for runtime interpolation.
 * The dialogue engine picks a template based on:
 *   1. The companion the user chose
 *   2. The current mood (computed from user behavior)
 *   3. Optionally the current phase (for phase-aware templates)
 *
 * Templates are short, conversational, and end with the companion's emoji.
 */
export const DIALOGUE_TEMPLATES: Record<
  CompanionType,
  Partial<Record<CompanionMood, string[]>>
> = {
  // ─── 🦊 LUNA THE FOX (wise, gentle) ────────────────────────────────
  fox: {
    happy: [
      'Hey, you showed up — that means a lot 🦊',
      '{{time_greeting}}. I noticed you. {{rendered_insight}} 🦊',
      'Soft hello today. {{rendered_question}} 🦊',
    ],
    celebrating: [
      'I am genuinely so proud of you — {{streak_count}} streak 🦊✨',
      'Look at what you’ve built. {{streak_count}} of showing up 🦊',
      'This is beautiful work. Truly 🦊💛',
    ],
    sleepy: [
      'It’s been a moment. I’m still here, no rush 🦊',
      'Whenever you’re ready, love. I’ll be right here 🦊',
      'Soft return. No pressure. Just glad you’re back 🦊',
    ],
    supportive: [
      'I see you’re having a rough one. Be tender with yourself today 🦊',
      'Tough days are still important days. {{rendered_insight}} 🦊',
      'Whatever today is, you don’t have to do it alone 🦊',
    ],
    proud: [
      'You finished it. That’s real growth 🦊✨',
      'I noticed you keep choosing yourself. That’s rare 🦊',
      'You learned something new today. I hope you feel it 🦊',
    ],
    cozy: [
      'Rest is sacred work. Cramp Freeze on — streak protected 🦊🧣',
      'Today is for blankets and softness. I’ve got you 🦊',
      'Your body knows. Listening is wisdom 🦊',
    ],
    excited: [
      'Almost at {{streak_count}}! You’re right on the edge of something 🦊',
      'Big milestone is so close. Keep going at your own pace 🦊',
    ],
    neutral: [
      '{{time_greeting}}. {{rendered_insight}} 🦊',
      'Here when you’re ready 🦊',
    ],
  },

  // ─── 🐰 PIP THE BUNNY (playful, celebratory) ───────────────────────
  bunny: {
    happy: [
      'YAYYY hi!! {{rendered_insight}} 🐰💛',
      '{{time_greeting}}!! You showed up AGAIN!! Let’s gooo!! 🐰',
      'Heyyy you!! {{rendered_question}} 🐰✨',
    ],
    celebrating: [
      'OMGGG {{streak_count}} STREAK!! I CAN’T!! 🐰🎉',
      'YOU ARE ON FIRE!! {{streak_count}} of pure dedication!! 🐰🔥',
      'CONFETTI PARTY!! {{streak_count}}!! 🐰🎊',
    ],
    sleepy: [
      'Heyyy stranger!! I missed you SO much!! 🐰💔',
      'You’re back!! That’s ALL that matters!! 🐰🌸',
      'No notes, no judgment, just JOY that you’re here 🐰',
    ],
    supportive: [
      'Rough day? Sending ALL the bunny hugs!! 🐰🤗',
      'You logged it. THAT is brave. Proud of you!! 🐰💛',
      'Soft snacks and rest day vibes incoming!! 🐰☕',
    ],
    proud: [
      'YOU LEARNED A THING!! YOU’RE LITERALLY AMAZING!! 🐰📚',
      'QUIZ CRUSHED!! High-five energy!! 🐰✋',
      'Look at you GROWING!! I’m so proud!! 🐰🌱',
    ],
    cozy: [
      'Cramp Freeze ON!! Wrap up, snack up, you’re GOOD!! 🐰🧊',
      'Rest day approved!! Streak SAFE!! Vibes IMMACULATE!! 🐰',
      'Snuggle up, you’ve EARNED this!! 🐰🛏️',
    ],
    excited: [
      'JUST {{rendered_insight}} away from {{streak_count}}!! AHHH!! 🐰',
      'WE ARE SO CLOSE!! Can you FEEL it?! 🐰✨',
    ],
    neutral: [
      'Hi hi!! {{rendered_insight}} 🐰',
      'Here for ya!! 🐰💛',
    ],
  },

  // ─── 🦋 MIRA THE BUTTERFLY (calm, poetic) ──────────────────────────
  butterfly: {
    happy: [
      'A soft hello on a {{phase_name}} day 🦋',
      '{{rendered_insight}} Let it land gently 🦋',
      'Quiet check-in. {{rendered_question}} 🦋',
    ],
    celebrating: [
      '{{streak_count}} — a small ritual woven into your days 🦋',
      'Every check-in is a petal. You’ve grown a flower 🦋',
      'This streak is your devotion to yourself 🦋',
    ],
    sleepy: [
      'Time has its rhythms. Welcome back to mine 🦋',
      'The path is patient. So am I 🦋',
      'You returned — the rest is just weather 🦋',
    ],
    supportive: [
      'Heavy days have their own beauty. Breathe slowly 🦋',
      'Even storms move on. I’ll wait with you 🦋',
      'Softness is strength. You are practicing both 🦋',
    ],
    proud: [
      'A new flower opened in you today. I saw it 🦋',
      'Learning is a kind of blooming 🦋✨',
      'You moved through something. That’s sacred 🦋',
    ],
    cozy: [
      'Cocoon today. Bloom tomorrow 🦋',
      'Stillness is also progress 🦋🧣',
      'A cup of quiet for you, love 🦋☕',
    ],
    excited: [
      '{{streak_count}} is just over the next horizon 🦋',
      'Almost a new threshold. Keep walking 🦋',
    ],
    neutral: [
      '{{rendered_insight}} 🦋',
      'Soft hello 🦋',
    ],
  },

  // ─── 🐱 NYX THE CAT (sassy, direct) ───────────────────────────────
  cat: {
    happy: [
      'Oh, hi. {{rendered_insight}} 😼',
      'Look who’s being responsible today. {{rendered_question}} 😼',
      '{{time_greeting}}. Let’s keep this simple 😼',
    ],
    celebrating: [
      '{{streak_count}}?? Okay, icon. 😼💅',
      'A {{streak_count}} streak. I’d be insufferable if it were me. You’re cooler 😼',
      'Main character behavior. {{streak_count}}. 😼🔥',
    ],
    sleepy: [
      'Oh, *now* you’re back. Fine, I missed you 😼',
      'Vanished for a hot minute. No judgment. (A little judgment.) 😼',
      'Here we go again. Let’s ride 😼',
    ],
    supportive: [
      'Rough day energy? Same. We nap, we hydrate, we move on 😼',
      'Soft Cat mode activated. You’re allowed to feel things 😼',
      'No one asked your body for anything today. Take it slow 😼',
    ],
    proud: [
      'Quiz passed. You may now flex. 😼📚',
      'A lesson finished — and you stayed awake! Wild 😼',
      'You learned something. Don’t let it go to your head. (Do, actually.) 😼',
    ],
    cozy: [
      'Cramp Freeze: on. Couch: ready. Snacks: deployed 😼🍫',
      'Today is a do-nothing day. I’m thriving. Join me 😼',
      'Heating pad mode. Genius level decision 😼',
    ],
    excited: [
      '{{streak_count}} is RIGHT THERE. Just don’t flinch 😼',
      'One more check-in and you’re basically a legend 😼',
    ],
    neutral: [
      '{{rendered_insight}} 😼',
      'Here. Vibes ready 😼',
    ],
  },

  // ─── 🦉 SAGE THE OWL (intellectual, factual) ───────────────────────
  owl: {
    happy: [
      'Fun fact incoming: {{rendered_insight}} 🦉',
      '{{time_greeting}}. Today’s body note: {{rendered_question}} 🦉',
      'Day {{day_in_cycle}} of your cycle — interesting territory 🦉',
    ],
    celebrating: [
      '{{streak_count}} of consistent self-observation. That’s scientifically remarkable 🦉',
      'Your data is now rich enough to spot real patterns. {{streak_count}}! 🦉📊',
      'Habit formation typically takes 66 days. You’re proving it 🦉',
    ],
    sleepy: [
      'Welcome back. Even partial data tells us something 🦉',
      'Gaps in tracking are normal. Pattern recognition adapts 🦉',
      'You returned — which is the most important data point 🦉',
    ],
    supportive: [
      'High prostaglandins on day 1 are why cramps hit hard. You’re not weak — biology is intense 🦉',
      'Premenstrual mood shifts are real, measurable, and not your fault 🦉',
      'Tough days = real data. We learn from them too 🦉',
    ],
    proud: [
      'You absorbed that lesson well. Your cycle literacy is growing 🦉📚',
      'Quiz passed with insight. Knowledge → agency 🦉',
      'You now understand something about your body that millions don’t. Beautiful 🦉',
    ],
    cozy: [
      'Rest = healing. Studies confirm: it’s the most underrated medicine 🦉🛏️',
      'Cramp Freeze active. Your body is conserving resources. Smart 🦉',
      'Today, rest IS productivity 🦉',
    ],
    excited: [
      '{{streak_count}} would mark a meaningful milestone in habit research 🦉',
      'Closing in on a major streak — the dopamine reward is real 🦉',
    ],
    neutral: [
      '{{rendered_insight}} 🦉',
      'Quiet observation today 🦉',
    ],
  },

  // ─── 🌸 DOTTIE THE BLOSSOM (nurturing, big-sister) ────────────────
  blossom: {
    happy: [
      'Hey love. {{rendered_insight}} 🌸',
      '{{time_greeting}}, you. {{rendered_question}} 🌸',
      'So glad to see you today 🌸',
    ],
    celebrating: [
      '{{streak_count}}. Look what you’ve built for yourself 🌸💛',
      'I’m so proud of you — really, truly. {{streak_count}}! 🌸',
      'This streak is love in action. Yours, for you 🌸✨',
    ],
    sleepy: [
      'Hi sweetheart. No guilt, no rush — just glad you’re back 🌸',
      'Welcome home. I missed you 🌸',
      'You returned. That’s everything 🌸',
    ],
    supportive: [
      'Soft day, love. Whatever it is, you don’t carry it alone 🌸',
      'Be especially kind to yourself today. I’m right here 🌸💛',
      'Hard things are real. You’re allowed to feel all of it 🌸',
    ],
    proud: [
      'Look at you learning, growing, knowing yourself 🌸✨',
      'Every lesson you finish, you understand yourself a little more 🌸',
      'Your curiosity is gorgeous. Keep going 🌸',
    ],
    cozy: [
      'Rest day, love. Cramp Freeze is on — streak safe 🌸🧣',
      'Wrap up warm. The world can wait 🌸☕',
      'Your body is asking for softness. Give it 🌸',
    ],
    excited: [
      '{{streak_count}} is so close, love. So close 🌸',
      'You can feel that milestone coming, can’t you? 🌸✨',
    ],
    neutral: [
      '{{rendered_insight}} 🌸',
      'Soft hello, love 🌸',
    ],
  },
};

// ─── MOOD SELECTION (from user behavior conditions) ───────────────────

/**
 * Map of which mood each condition fires.
 * Priority is handled by MOOD_PRIORITY ordering from companion.types.
 */
const CONDITION_TO_MOOD: Record<MoodCondition, CompanionMood> = {
  checked_in_today: 'happy',
  streak_milestone: 'celebrating',
  badge_unlocked: 'celebrating',
  level_up: 'celebrating',
  inactive_2_days: 'sleepy',
  inactive_5_days: 'sleepy',
  logged_high_pain: 'supportive',
  logged_low_mood: 'supportive',
  lesson_completed: 'proud',
  quiz_passed: 'proud',
  cramp_freeze_used: 'cozy',
  near_streak_milestone: 'excited',
  first_open_today: 'happy',
};

/**
 * Pick the highest-priority mood from a set of active conditions.
 *
 * If no conditions are active, returns the base mood for the current
 * companion × phase pairing (e.g., bunny in ovulatory → 'celebrating').
 *
 * @param activeConditions - Conditions currently true for this user
 * @param companionType - Selected companion
 * @param currentPhase - Current cycle phase
 * @returns The mood to use for dialogue selection
 */
export function selectMood(
  activeConditions: MoodCondition[],
  companionType: CompanionType,
  currentPhase: Phase
): CompanionMood {
  if (activeConditions.length === 0) {
    return COMPANION_PHASE_MOODS[companionType][currentPhase];
  }

  // Convert conditions to moods
  const candidateMoods = activeConditions
    .map(c => CONDITION_TO_MOOD[c])
    .filter((m): m is CompanionMood => m !== undefined);

  if (candidateMoods.length === 0) {
    return COMPANION_PHASE_MOODS[companionType][currentPhase];
  }

  // Pick the highest priority mood
  return candidateMoods.reduce((best, current) => {
    const bestPriority = MOOD_PRIORITY.indexOf(best);
    const currentPriority = MOOD_PRIORITY.indexOf(current);
    return currentPriority > bestPriority ? current : best;
  });
}

// ─── DIALOGUE WRAPPING ────────────────────────────────────────────────

/**
 * Wrap a piece of shared content in the companion's voice.
 *
 * This is the PRIMARY entry point for the dialogue engine.
 *
 * @param options - Wrapping configuration
 * @returns Final user-facing string with companion voice + interpolation
 */
export function wrapInCompanionVoice(options: WrapOptions): string {
  const {
    companionType,
    mood,
    context,
    rawContent = '',
    contentRole = 'insight',
  } = options;

  // Pick a template for this companion × mood
  const templates = DIALOGUE_TEMPLATES[companionType][mood];

  // Fallback: if no templates for this mood, try 'neutral'
  const candidateTemplates =
    templates && templates.length > 0
      ? templates
      : DIALOGUE_TEMPLATES[companionType].neutral ?? [];

  // If still nothing, return the raw content with companion emoji
  if (candidateTemplates.length === 0) {
    const companion = getCompanion(companionType);
    return rawContent ? `${rawContent} ${companion.emoji}` : companion.emoji;
  }

  // Deterministic template choice based on (day_in_cycle + mood)
  // → same day = same template = no jarring randomness
  const templateIndex = deterministicPick(
    candidateTemplates.length,
    context.day_in_cycle,
    mood
  );
  const template = candidateTemplates[templateIndex]!;

  // Interpolate the template with context values
  return interpolate(template, context, rawContent, contentRole);
}

/**
 * Render a companion's default phase greeting.
 * Used on app open / home screen header before any other content loads.
 *
 * Pulls from the companion's `greetings[phase]` map (defined in companions.ts).
 */
export function getCompanionGreeting(
  companionType: CompanionType,
  phase: Phase
): string {
  const companion = getCompanion(companionType);
  return companion.greetings[phase];
}

/**
 * Render a phase question wrapped in companion voice.
 * Convenience wrapper around wrapInCompanionVoice for the question role.
 */
export function wrapQuestion(
  companionType: CompanionType,
  questionText: string,
  context: DialogueContext,
  mood?: CompanionMood
): string {
  return wrapInCompanionVoice({
    companionType,
    mood: mood ?? 'happy',
    context,
    rawContent: questionText,
    contentRole: 'question',
  });
}

/**
 * Render a daily decode insight wrapped in companion voice.
 * Convenience wrapper for the insight role.
 */
export function wrapInsight(
  companionType: CompanionType,
  insightText: string,
  context: DialogueContext,
  mood?: CompanionMood
): string {
  return wrapInCompanionVoice({
    companionType,
    mood: mood ?? 'happy',
    context,
    rawContent: insightText,
    contentRole: 'insight',
  });
}

// ─── CONTEXT BUILDING HELPERS ─────────────────────────────────────────

/**
 * Build a DialogueContext from runtime values.
 * Convenience builder so callers don't have to remember every field.
 */
export function buildContext(input: {
  companionType: CompanionType;
  phase: Phase;
  dayInPhase: number;
  dayInCycle: number;
  streakCount: number;
  userMood?: string;
  now?: Date;
}): DialogueContext {
  const companion = getCompanion(input.companionType);
  const now = input.now ?? new Date();

  return {
    companion_name: companion.name,
    phase_name: input.phase,
    day_in_phase: input.dayInPhase,
    day_in_cycle: input.dayInCycle,
    streak_count: input.streakCount,
    user_mood: input.userMood,
    time_of_day: getTimeOfDay(now),
  };
}

/**
 * Categorize a Date into a time-of-day bucket.
 * Used to pick contextual greetings ("Good morning", "Hey", etc.).
 */
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

export function getTimeOfDay(now: Date = new Date()): TimeOfDay {
  const hour = now.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

/**
 * Convert a time-of-day into a friendly greeting word.
 */
export function getTimeGreeting(
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'
): string {
  switch (timeOfDay) {
    case 'morning':
      return 'Good morning';
    case 'afternoon':
      return 'Good afternoon';
    case 'evening':
      return 'Hey';
    case 'night':
      return 'Hi';
  }
}

// ─── HELPER TYPES ─────────────────────────────────────────────────────

export interface WrapOptions {
  companionType: CompanionType;
  mood: CompanionMood;
  context: DialogueContext;
  /** The raw content from the cohort cache (insight / question text) */
  rawContent?: string;
  /** Hints which placeholder to fill with rawContent */
  contentRole?: 'insight' | 'question';
}

// ─── INTERNAL: TEMPLATE INTERPOLATION ─────────────────────────────────

/**
 * Replace {{placeholder}} tokens in a template with context values.
 * Unknown placeholders are left as-is (with a console.warn in dev mode).
 *
 * Supports all DialogueContext fields plus:
 *   - {{phase_label}}    → Title Case version of phase_name
 *   - {{streak_number}}  → Just the number
 *   - {{streak_count}}   → "N-day" formatted
 *   - {{time_greeting}}  → "Good morning" etc.
 *   - {{emoji}}          → Companion emoji
 *   - {{rendered_insight}}  → rawContent if contentRole is 'insight'
 *   - {{rendered_question}} → rawContent if contentRole is 'question'
 */
function interpolate(
  template: string,
  context: DialogueContext,
  rawContent: string,
  contentRole: 'insight' | 'question'
): string {
  const companion = findCompanionByName(context.companion_name);

  const replacements: Record<string, string> = {
    companion_name: context.companion_name,
    phase_name: context.phase_name,
    phase_label: capitalize(context.phase_name),
    day_in_phase: String(context.day_in_phase),
    day_in_cycle: String(context.day_in_cycle),
    streak_count: `${context.streak_count}-day`,
    streak_number: String(context.streak_count),
    user_mood: context.user_mood ?? '',
    time_of_day: context.time_of_day,
    time_greeting: getTimeGreeting(context.time_of_day),
    emoji: companion?.emoji ?? '',
    rendered_insight: contentRole === 'insight' ? rawContent : '',
    rendered_question: contentRole === 'question' ? rawContent : '',
  };

  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const replacement = replacements[key];
    return replacement !== undefined ? replacement : match;
  });
}

/**
 * Deterministic pick from a set of choices using stable inputs.
 * This guarantees a user sees the SAME template all day for the same
 * mood — no jarring re-rolls between renders.
 *
 * It also gives natural variation across days and across moods.
 */
function deterministicPick(
  choiceCount: number,
  dayInCycle: number,
  mood: CompanionMood
): number {
  if (choiceCount <= 0) return 0;

  // Simple stable hash: dayInCycle × 31 + mood string length × 7
  const moodKey = MOOD_PRIORITY.indexOf(mood) + 1;
  const hash = (dayInCycle * 31 + moodKey * 7) >>> 0;
  return hash % choiceCount;
}

function capitalize(word: string): string {
  if (!word) return '';
  return word[0]!.toUpperCase() + word.slice(1);
}

/**
 * Find a companion by name. Inline reimplementation to avoid a circular
 * import — companion-dialogue is referenced by content modules, but it
 * lives in the engine layer.
 */
function findCompanionByName(name: string) {
  const normalized = name.toLowerCase().trim();
  return (
    Object.values(COMPANIONS).find(c => c.name.toLowerCase() === normalized) ??
    null
  );
}
