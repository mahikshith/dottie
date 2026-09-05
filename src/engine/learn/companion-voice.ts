/**
 * Dottie — Companion voices
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────
 *
 *  Owner, device-test-22, in capitals:
 *
 *      "EACH COMPANION MUST HAVE DIFFERENT TRAITS AND PERSONALITY RIGHT?? IF
 *       EVERYTHING OR EVERY COMPANION REMAINS THE SAME THEN WHAT IS THE USE OF
 *       HAVING THESE MANY COMPANIONS?? JUST FOR COLOR AND EXPRESSIONS??
 *       USERS ARE NOT GONNA TOLERATE THIS."
 *
 *  They are right, and the audit is embarrassing. Before this file, choosing
 *  between six companions changed exactly three things: the drawn animal, an
 *  accent colour, and four phase greetings on Home. `companions.ts` carries a
 *  `dialogueStyle` string per companion — "Sassy, direct, humorous" — and
 *  NOTHING READ IT. The quiz, which is where the user spends real time with
 *  their companion, called `leadFor`/`reactTo` with no companion argument at
 *  all: Nyx the blunt cat and Pip the sunshine bunny said the same eight words
 *  in the same order.
 *
 * ─── WHAT A COMPANION IS NOW ────────────────────────────────────────
 *
 *  Three things, all of which the user meets within a minute of choosing:
 *
 *   1. VOICE — its own lines for every beat of the quiz conversation. Pip
 *      cheers, Nyx deadpans, Sage explains, Mira notices, Luna reassures,
 *      Dottie mothers. Same beats, same facts, six different people.
 *
 *   2. FACE — which expression it wears for each beat. A correct answer makes
 *      Pip celebrate, Nyx smirk (`wink`), Sage look pleased-but-curious. The
 *      rig has 26 states; a companion uses its own handful.
 *
 *   3. BODY — how much it moves at rest. Pip is springy and quick, Sage is
 *      still and slow, Mira drifts. `CompanionCreature` multiplies the idle
 *      bob and tempo by these.
 *
 *  Plus one behavioural trait: `streakAt`, how many in a row it takes before
 *  this companion switches to its excited register. Pip notices at two; Sage
 *  needs four, because from Sage that means more.
 *
 * ─── THE RULE THESE LINES LIVE UNDER (CLAUDE.md rule 9) ─────────────
 *
 *  Not one line here states a fact about a body, a cycle, a symptom or a
 *  treatment. These are TONE ONLY. Every factual sentence in the quiz comes
 *  from the vetted curriculum and is rendered verbatim, whichever companion is
 *  speaking. `test:dialogue` enforces both halves of that.
 */

import type { CompanionType } from '../../types/companion.types';
import type { CompanionAnim } from '../../content/companion-lottie';

/** Faces this companion wears for each beat of the exchange. */
export interface VoiceFaces {
  hit: CompanionAnim;
  streak: CompanionAnim;
  comeback: CompanionAnim;
  recovered: CompanionAnim;
  miss: CompanionAnim;
  told: CompanionAnim;
  asking: CompanionAnim;
}

/** How much this companion moves when it is doing nothing. */
export interface VoiceMotion {
  /** Idle bob amplitude multiplier. 1 = the rig's default. */
  bounce: number;
  /** Idle loop speed multiplier. 1 = the rig's default. */
  tempo: number;
}

export interface CompanionVoice {
  /** One line the picker can show: what this companion is actually like. */
  trait: string;
  /** Openers before a mid-quiz question. */
  leads: readonly string[];
  /** Before the first question — sets the terms. */
  firstLeads: readonly string[];
  /** Before the last one. */
  finalLeads: readonly string[];
  /** Straight after a miss — this is where the personalities differ most. */
  softLeads: readonly string[];
  /** When they are on a run. */
  streakLeads: readonly string[];
  /** A correct answer. */
  hits: readonly string[];
  /** A correct answer while on a run. */
  streakHits: readonly string[];
  /** Correct straight after missing the previous one. */
  comebacks: readonly string[];
  /** Correct on the second attempt. */
  recovered: readonly string[];
  /** A miss, first attempt. */
  misses: readonly string[];
  /** The offer of a second go. */
  retryAsides: readonly string[];
  /** A miss, second attempt — the answer is handed over. */
  secondMisses: readonly string[];
  /** The line after handing the answer over. */
  toldAsides: readonly string[];
  faces: VoiceFaces;
  motion: VoiceMotion;
  /** Consecutive correct answers before the excited register kicks in. */
  streakAt: number;
}

// ─── THE SIX ─────────────────────────────────────────────────────────

export const COMPANION_VOICE: Record<CompanionType, CompanionVoice> = {
  // ─── 🦊 LUNA — gentle, observant, takes the pressure off ──────────
  fox: {
    trait: 'Gentle. Takes the pressure off before you feel it.',
    leads: ['Quiet one:', 'When you are ready:', 'Have a look at this:', 'No rush — this one:'],
    firstLeads: ['First one. Nothing here is scored against you.', 'Let us start softly.'],
    finalLeads: ['Last one, and then I will let you go.', 'One more, gently.'],
    softLeads: ['That one was unkind. Clean slate.', 'Let it go — different angle:'],
    streakLeads: ['You are finding these easily. Try:', 'Steady as you go:'],
    hits: ['That is the one.', 'Yes — exactly that.', 'You had that.', 'Quietly right.'],
    streakHits: ['You are in a rhythm now.', 'Right again, and calmly.', 'That is a run.'],
    comebacks: ['And back you come.', 'There — straight after a wobble.'],
    recovered: ['You worked that out yourself. That matters.', 'Second look got it.'],
    misses: ['Not quite — and it is a fair mistake.', 'Close. Let me show you why.', 'Ah. That one catches people.'],
    retryAsides: ['Have another look?', 'One more, if you like. I will wait.'],
    secondMisses: ['Let me just tell you, then.', 'Here it is, plainly.'],
    toldAsides: ['This one is genuinely fiddly. Onward.', 'Now you know it, which was the point.'],
    faces: {
      hit: 'proud', streak: 'happy', comeback: 'relieved', recovered: 'proud',
      miss: 'caring', told: 'cozy', asking: 'curious',
    },
    motion: { bounce: 0.85, tempo: 0.9 },
    streakAt: 3,
  },

  // ─── 🐰 PIP — sunshine, celebrates everything, fast ───────────────
  bunny: {
    trait: 'Loud, delighted, celebrates literally everything.',
    leads: ['Ooh, this one!', 'Okay okay okay:', 'Next!', 'Go go go:', 'This one is fun:'],
    firstLeads: ['FIRST ONE. I am so ready.', 'Here we go here we go!'],
    finalLeads: ['LAST ONE. Big finish!', 'One more and then we celebrate!'],
    softLeads: ['Pfft, forget that one. NEW one:', 'Doesn’t count. Fresh:'],
    streakLeads: ['You are on FIRE. Try:', 'Can you keep it going?!'],
    hits: ['YES!', 'Got it!', 'Nailed it!', 'Yesss, that one!', 'Boom.'],
    streakHits: ['THAT IS A RUN!', 'Unstoppable!', 'Again?! Okay, showing off!', 'I am out of words!'],
    comebacks: ['AND BACK!', 'Straight back on it — love that.'],
    recovered: ['Second go and you GOT it!', 'You worked it out! Bouncing!'],
    misses: ['Ooh, so close!', 'Nearly! That one is sneaky.', 'Not that one — but good guess!'],
    retryAsides: ['Another go? Go on!', 'One more shot!'],
    secondMisses: ['Okay okay, I will just tell you!', 'Right — answer time!'],
    toldAsides: ['Not dwelling! Next!', 'Now you know it. Onwards!'],
    faces: {
      hit: 'celebrate', streak: 'laugh', comeback: 'cheer', recovered: 'celebrate',
      miss: 'surprised', told: 'encourage', asking: 'excited',
    },
    motion: { bounce: 1.45, tempo: 1.35 },
    streakAt: 2,
  },

  // ─── 🦌 MIRA — quiet, poetic, notices things ──────────────────────
  butterfly: {
    trait: 'Quiet and unhurried. Notices what you almost said.',
    leads: ['Here:', 'Sit with this one:', 'A small one:', 'Softly:'],
    firstLeads: ['The first. Take your time with it.', 'We begin here.'],
    finalLeads: ['The last one.', 'One more, and then quiet.'],
    softLeads: ['Let that one drift off. Here:', 'Another way in:'],
    streakLeads: ['You are moving well. Here:', 'Then this:'],
    hits: ['Yes.', 'That is it.', 'Just so.', 'Exactly that.'],
    streakHits: ['One after another.', 'You are in it now.', 'Still going.'],
    comebacks: ['There you are again.', 'You came back to it.'],
    recovered: ['The second look found it.', 'You stayed with it. Good.'],
    misses: ['Not that one.', 'Close, but no — here is why.', 'A reasonable guess.'],
    retryAsides: ['Look again?', 'There is no hurry. Try once more.'],
    secondMisses: ['Then let me say it.', 'Here it is.'],
    toldAsides: ['Worth a second read another time.', 'It will keep.'],
    faces: {
      hit: 'happy', streak: 'proud', comeback: 'relieved', recovered: 'shy',
      miss: 'thinking', told: 'caring', asking: 'thinking',
    },
    motion: { bounce: 0.7, tempo: 0.75 },
    streakAt: 3,
  },

  // ─── 🐱 NYX — dry, blunt, secretly on your side ───────────────────
  cat: {
    trait: 'Dry and blunt. Will not pretend a wrong answer was close.',
    leads: ['Right:', 'Go on then:', 'This one:', 'Try not to overthink it:'],
    firstLeads: ['One. No warm-up.', 'Straight in.'],
    finalLeads: ['Last one. Then I am going back to sleep.', 'Final one.'],
    softLeads: ['Forget it. Next:', 'Moving on:'],
    streakLeads: ['Fine. Let us see if I can catch you out:', 'Harder one, then:'],
    hits: ['Correct.', 'Yep.', 'Obviously.', 'Fine, that is right.'],
    streakHits: ['Alright, showing off.', 'Again? Fine. Impressed.', 'You are enjoying this.'],
    comebacks: ['Knew you had it.', 'There. Was that so hard?'],
    recovered: ['Second time. Still counts.', 'You got there. On your own.'],
    misses: ['No.', 'Nope — and here is why.', 'Not even close, honestly.'],
    retryAsides: ['Go again.', 'One more. I am not counting.'],
    secondMisses: ['Right, I am telling you.', 'Enough. Here:'],
    toldAsides: ['It is a fiddly one. Move on.', 'Now you know. Next.'],
    faces: {
      hit: 'wink', streak: 'smug', comeback: 'smug', recovered: 'proud',
      miss: 'confused', told: 'annoyed', asking: 'curious',
    },
    motion: { bounce: 0.8, tempo: 0.95 },
    streakAt: 2,
  },

  // ─── 🦉 SAGE — explains, precise, warm about it ───────────────────
  owl: {
    trait: 'Explains the why. Precise, and warm about being precise.',
    leads: ['Question:', 'Consider this:', 'Here is a good one:', 'Test yourself:'],
    firstLeads: ['First question. I will explain every answer either way.', 'Let us establish a baseline.'],
    finalLeads: ['Final question.', 'Last one — then a summary.'],
    softLeads: ['A common confusion. Try this one:', 'Different angle on the same idea:'],
    streakLeads: ['You have the pattern. Try a harder one:', 'Let us raise it slightly:'],
    hits: ['Correct.', 'That is right.', 'Precisely.', 'Well reasoned.'],
    streakHits: ['Four for four — you have the model.', 'Consistent. That is the useful part.', 'You are not guessing.'],
    comebacks: ['Recovered — and that is how learning looks.', 'Straight back. Noted.'],
    recovered: ['Second attempt, and you reasoned it out. Better than being told.', 'That is the good kind of correct.'],
    misses: ['Not quite — and this is worth understanding.', 'A frequent mistake. Here is why.', 'No, but the reasoning is close.'],
    retryAsides: ['Try once more before I explain?', 'Have another attempt.'],
    secondMisses: ['Let me set it out.', 'Here is the answer, and the reason.'],
    toldAsides: ['This one is worth rereading later.', 'Understanding beats remembering.'],
    faces: {
      hit: 'happy', streak: 'proud', comeback: 'relieved', recovered: 'proud',
      miss: 'thinking', told: 'curious', asking: 'curious',
    },
    motion: { bounce: 0.65, tempo: 0.8 },
    streakAt: 4,
  },

  // ─── 🌸 DOTTIE — warm, big-sister, in your corner ─────────────────
  blossom: {
    trait: 'Big-sister warm. In your corner before you ask.',
    leads: ['Okay, love:', 'Here you go:', 'This one:', 'Have a go:'],
    firstLeads: ['First one, and I am right here.', 'Easy start, I promise.'],
    finalLeads: ['Last one, then a cup of tea.', 'One more and we are done.'],
    softLeads: ['That one was rotten. Clean slate:', 'Never mind that. Try:'],
    streakLeads: ['Look at you go. Here:', 'You are flying — try:'],
    hits: ['That is it, love.', 'Yes! Well done.', 'Perfect.', 'Knew you had it.'],
    streakHits: ['That is a proper run.', 'Look at you.', 'I am so pleased.'],
    comebacks: ['And back you come, brilliant.', 'Straight after a wobble. Proud of that.'],
    recovered: ['Second go and you got there yourself. Lovely.', 'That counts double with me.'],
    misses: ['Ooh, close, love.', 'Not quite — and it is a fair mistake.', 'Nearly! Let me show you.'],
    retryAsides: ['Want another go?', 'One more, no rush.'],
    secondMisses: ['Let me just tell you, love.', 'Here it is.'],
    toldAsides: ['Do not dwell on it. Onwards.', 'Now you know, which was the whole point.'],
    faces: {
      hit: 'proud', streak: 'celebrate', comeback: 'cheer', recovered: 'love',
      miss: 'caring', told: 'cozy', asking: 'happy',
    },
    motion: { bounce: 1.0, tempo: 1.0 },
    streakAt: 3,
  },
};

/** The voice for a companion, with a safe default. */
export function voiceFor(type: CompanionType | undefined | null): CompanionVoice {
  return (type && COMPANION_VOICE[type]) || COMPANION_VOICE.blossom;
}
