/**
 * Dottie — Care Nudge Templates
 *
 * Pre-written supportive messages the primary user can send to members
 * of their Sisterhood Circle. Templates are grouped by SITUATION — the
 * engine matches a situation to the receiver's current state (phase,
 * mood, streak) and offers 2-3 nudges to pick from.
 *
 * ─── WRITING GUIDELINES ─────────────────────────────────────────────
 *
 *   - Warm, never clinical
 *   - Specific enough to feel personal, general enough to fit anyone
 *   - Always validating, never advice-giving
 *   - Short enough to read in 1-2 seconds
 *   - One emoji prefix; rare second emoji in the body
 *   - Never use "should" or imperative verbs ("rest!", "drink water!")
 *   - Address the receiver directly ("you", not "they")
 *
 * ─── SITUATIONS COVERED ─────────────────────────────────────────────
 *
 *   period_day      They're on day 1-3 of their period
 *   tough_pms       Luteal phase + low mood (most universally hard)
 *   low_mood        Mood score 1-2 regardless of phase
 *   streak_broken   Their streak just broke
 *   phase_sync      You and they are in the same phase today
 *   inactive_3_days No check-in for 3+ days
 *   celebration     They hit a milestone (streak, badge, level)
 *   general_warmth  Default — just-because care
 */

import {
  CareNudgeSituation,
  CareNudgeTemplate,
} from '../types/sisterhood.types';

// ─── TEMPLATE BANK ───────────────────────────────────────────────────

export const CARE_NUDGE_TEMPLATES: CareNudgeTemplate[] = [
  // ─── period_day ─────────────────────────────────────────────────
  {
    id: 'nudge_period_1',
    situation: 'period_day',
    emoji: '🫂',
    message: 'Sending you a warm cup of something and a soft blanket today.',
  },
  {
    id: 'nudge_period_2',
    situation: 'period_day',
    emoji: '💛',
    message: 'Hey — you deserve the comfiest day. I\'m thinking of you.',
  },
  {
    id: 'nudge_period_3',
    situation: 'period_day',
    emoji: '☕',
    message: 'Hot chocolate kind of day. Take it slow today, friend.',
  },
  {
    id: 'nudge_period_4',
    situation: 'period_day',
    emoji: '🌷',
    message: 'Your body is doing big things this week. I\'m proud of you for showing up.',
  },

  // ─── tough_pms ──────────────────────────────────────────────────
  {
    id: 'nudge_tough_pms_1',
    situation: 'tough_pms',
    emoji: '🌧️',
    message: 'This week can feel heavier. It\'s not in your head — your body really is asking for extra softness.',
  },
  {
    id: 'nudge_tough_pms_2',
    situation: 'tough_pms',
    emoji: '🤗',
    message: 'Tough PMS days are real. Sending you a hug big enough to last till the storm passes.',
  },
  {
    id: 'nudge_tough_pms_3',
    situation: 'tough_pms',
    emoji: '💛',
    message: 'You\'re not "being too much" right now. Your hormones are loud, and you\'re still loved.',
  },

  // ─── low_mood ───────────────────────────────────────────────────
  {
    id: 'nudge_low_mood_1',
    situation: 'low_mood',
    emoji: '🤗',
    message: 'Just dropping in to say I\'m thinking of you. No pressure to respond.',
  },
  {
    id: 'nudge_low_mood_2',
    situation: 'low_mood',
    emoji: '🌈',
    message: 'Hard days don\'t last forever, but the people who care about you do. I\'m one of them.',
  },
  {
    id: 'nudge_low_mood_3',
    situation: 'low_mood',
    emoji: '💛',
    message: 'You don\'t have to be okay today. I just wanted you to know you\'re not alone in it.',
  },
  {
    id: 'nudge_low_mood_4',
    situation: 'low_mood',
    emoji: '🫧',
    message: 'A gentle reminder: you\'re allowed to do less today. Breathing counts.',
  },

  // ─── streak_broken ──────────────────────────────────────────────
  {
    id: 'nudge_streak_broken_1',
    situation: 'streak_broken',
    emoji: '🩷',
    message: 'Streaks come and go. The fact that you keep coming back is what matters.',
  },
  {
    id: 'nudge_streak_broken_2',
    situation: 'streak_broken',
    emoji: '✨',
    message: 'Rest is productive too. Your streak will rebuild — you already know how.',
  },
  {
    id: 'nudge_streak_broken_3',
    situation: 'streak_broken',
    emoji: '🌱',
    message: 'A pause isn\'t a failure. It\'s just a comma in your story.',
  },

  // ─── phase_sync ─────────────────────────────────────────────────
  {
    id: 'nudge_phase_sync_1',
    situation: 'phase_sync',
    emoji: '🤝',
    message: 'Apparently our bodies are on the same wavelength today. I see you — you\'re seen.',
  },
  {
    id: 'nudge_phase_sync_2',
    situation: 'phase_sync',
    emoji: '🌙',
    message: 'In sync with you today. If you\'re feeling what I\'m feeling — same. We\'ve got each other.',
  },
  {
    id: 'nudge_phase_sync_3',
    situation: 'phase_sync',
    emoji: '✨',
    message: 'Funny — we\'re in the same phase right now. Solidarity from one body to another.',
  },

  // ─── inactive_3_days ────────────────────────────────────────────
  {
    id: 'nudge_inactive_1',
    situation: 'inactive_3_days',
    emoji: '🌸',
    message: 'Hey — no pressure, just checking in. Whenever you\'re ready to log, I\'ll be here.',
  },
  {
    id: 'nudge_inactive_2',
    situation: 'inactive_3_days',
    emoji: '💛',
    message: 'Life gets full sometimes. Just want you to know I\'m around if you need anything.',
  },
  {
    id: 'nudge_inactive_3',
    situation: 'inactive_3_days',
    emoji: '🫧',
    message: 'Sending a soft hello. No agenda, just thinking of you.',
  },

  // ─── celebration ────────────────────────────────────────────────
  {
    id: 'nudge_celebration_1',
    situation: 'celebration',
    emoji: '🎉',
    message: 'Saw your milestone — go YOU! So proud of how consistent you\'ve been.',
  },
  {
    id: 'nudge_celebration_2',
    situation: 'celebration',
    emoji: '🌟',
    message: 'You\'re doing the thing! Quietly proud and loudly cheering for you.',
  },
  {
    id: 'nudge_celebration_3',
    situation: 'celebration',
    emoji: '🩷',
    message: 'Look at you taking care of you. That\'s not a small thing — it\'s a big one.',
  },

  // ─── general_warmth ─────────────────────────────────────────────
  {
    id: 'nudge_general_1',
    situation: 'general_warmth',
    emoji: '💛',
    message: 'Just a random "thinking of you" — no reason needed.',
  },
  {
    id: 'nudge_general_2',
    situation: 'general_warmth',
    emoji: '🌷',
    message: 'You\'re a really good one. Hope your day has a soft moment in it.',
  },
  {
    id: 'nudge_general_3',
    situation: 'general_warmth',
    emoji: '✨',
    message: 'Sending you good energy today. You don\'t have to do anything with it — just receive it.',
  },
];

// ─── LOOKUP HELPERS ──────────────────────────────────────────────────

/** Get all templates for a specific situation */
export function getNudgesForSituation(
  situation: CareNudgeSituation
): CareNudgeTemplate[] {
  return CARE_NUDGE_TEMPLATES.filter(n => n.situation === situation);
}

/** Get a specific template by ID, or null if not found */
export function getNudgeTemplate(id: string): CareNudgeTemplate | null {
  return CARE_NUDGE_TEMPLATES.find(n => n.id === id) ?? null;
}

/**
 * Pick 3 templates for the given situation (or fewer if pool is small).
 * Deterministic per-(situation, seed) so the primary doesn't see the
 * same choices flicker on each render. Seed is typically the member ID
 * so different members get different rotations.
 */
export function pickNudges(
  situation: CareNudgeSituation,
  seed: string,
  count: number = 3
): CareNudgeTemplate[] {
  const pool = getNudgesForSituation(situation);
  if (pool.length <= count) return pool;

  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const startIndex = Math.abs(hash) % pool.length;

  const picked: CareNudgeTemplate[] = [];
  for (let i = 0; i < count; i++) {
    picked.push(pool[(startIndex + i) % pool.length]!);
  }
  return picked;
}