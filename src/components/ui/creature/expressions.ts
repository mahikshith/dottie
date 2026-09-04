/**
 * Dottie — Companion expressions (pure).
 *
 * The FACE is the whole point. A bobbing emoji is not a character; a character
 * is something whose eyes narrow when it's pleased, whose brows tilt when it's
 * worried, and which visibly loses its mind when you do something brilliant.
 *
 * This module owns that mapping — state (+ how strongly) → concrete facial
 * parameters — with no React and no SVG, so the emotional rules are unit
 * testable (scripts/creature-harness.ts). The renderer just draws numbers.
 *
 * ─── WHY BUILD THE ART INSTEAD OF DOWNLOADING IT ────────────────────
 *
 *  The obvious move is to grab Lottie files off the internet. We don't:
 *  licensing on free character packs is usually unclear or non-commercial, and
 *  a .json is an opaque binary-ish blob we can't review. So the companions are
 *  drawn as vectors and rigged here — fully ours, fully inspectable, no
 *  attribution risk, and they can be recoloured per mood for free. The Lottie
 *  seam stays wired, so commissioned art can still drop in later.
 */

/** Emotional states a companion can be in. */
export type CreatureState =
  | 'idle'      // resting, alive, breathing
  | 'happy'     // pleased
  | 'proud'     // quietly chuffed with you
  | 'celebrate' // a win
  | 'mindblown' // an EXCEPTIONAL result — the 100%+ moment
  | 'sad'       // gentle, low
  | 'caring'    // "I'm with you" — soft, attentive, NOT a grin
  | 'sleepy'    // dormant / long absence
  | 'love'      // affectionate
  // ─── DT18: the quiz turned into a conversation, and a conversation
  // needs more than six faces. Each of these is a beat that actually
  // happens in the app, not a mood for its own sake.
  | 'curious'    // asking you a question
  | 'thinking'   // waiting while you decide — eyes off to one side
  | 'surprised'  // you missed one. Startled, NOT disappointed
  | 'wink'       // playful — the comeback, the in-joke
  | 'laugh'      // delight, louder than 'happy', sillier than 'celebrate'
  | 'shy'        // caught out, pleased about it — heavy blush, eyes down
  | 'determined' // the retry. Brows down, mouth set, nothing sad about it
  | 'cheer'      // rooting for you after a stumble
  | 'confused'   // one brow up, one down — "hmm?"
  | 'relieved'   // it worked out. A held breath let go
  // ─── The awkward half of the range. A companion that can only be
  // pleased, sad or asleep is a mood ring, not a character — and on a
  // cycle tracker the rough days are most of why anyone opens the app.
  // NOTE none of these is ever aimed AT the user: the companion can be
  // fed up with a question, queasy on a rough day, or smug about its own
  // cleverness, but it is never annoyed with the person holding the phone.
  | 'frustrated' // brows slammed down, mouth gritted — "argh"
  | 'annoyed'    // half-lidded, looking away, one brow down
  | 'worried'    // inner brows up, small frown
  | 'excited'    // anticipation, not victory — bouncing before the reveal
  | 'sulky'      // a pout. Chin down, bottom lip out
  | 'queasy'     // a rough day. Half-lidded, wavy mouth, slow
  | 'smug';      // pleased with ITSELF. One brow up, a smirk

export interface Expression {
  /** 0 = shut, 1 = wide. */
  eyeOpen: number;
  /** Draw happy upward arcs (^ ^) instead of round eyes. */
  eyeArc: boolean;
  /** Pupil size multiplier — big pupils read as delight/attention. */
  pupilScale: number;
  /** -1 deep frown … 0 neutral … 1 huge grin. */
  mouthCurve: number;
  /** 0 closed … 1 wide open. */
  mouthOpen: number;
  /** Cheek blush opacity 0..1. */
  blush: number;
  /** -1 worried (inner ends up) … 1 excited (raised). */
  browTilt: number;
  /** Idle motion amplitude multiplier. */
  bounce: number;
  /** How fast the idle loop runs (1 = base). */
  tempo: number;
  /** Sparkles drawn around the character. */
  sparkles: number;
  /** Whole-body tilt in degrees. */
  tilt: number;
  /** -1 looking hard left … 0 at you … 1 hard right. */
  gazeX: number;
  /** -1 looking up … 0 level … 1 down. */
  gazeY: number;
  /** Shut the LEFT eye only. A wink is the cheapest asymmetry in the rig. */
  winkLeft: boolean;
  /** Differential brow tilt: one up, one down. All of "confused" lives here. */
  browSkew: number;
  /**
   * How the closed mouth is drawn. A single curve could only ever say
   * happy/neutral/sad, which is why the rig had no way to look fed up: a
   * grimace is not a frown, and a smirk is not a smile.
   */
  mouthShape: MouthShape;
  /** The little cross-vein. Comic shorthand, and it reads instantly. */
  angerMark: boolean;
  /** Where the arms are held. The pose; the swing is added by the rig. */
  armPose: ArmPose;
  /** 0..2 — how much the limbs swing on the idle loop. */
  limbSwing: number;
}

/**
 * Arm poses.
 *
 * The companions had no arms at all until DT18 — just a body and two feet — so
 * every emotion had to be carried by the face alone. Half of what makes a
 * character read at 28px is what its hands are doing.
 */
export type ArmPose =
  | 'rest'   // hanging, slightly out
  | 'up'     // both raised — the cheer
  | 'wave'   // one up, one down
  | 'chin'   // one hand to the chin — thinking
  | 'hips'   // hands on hips — smug, determined
  | 'cover'  // hands up by the face — shy, surprised
  | 'clap';  // together in front — delight

/** Closed-mouth shapes. `mouthOpen > 0.05` overrides all of these. */
export type MouthShape = 'curve' | 'grit' | 'smirk' | 'wavy';

const BASE: Expression = {
  eyeOpen: 1,
  eyeArc: false,
  pupilScale: 1,
  mouthCurve: 0.2,
  mouthOpen: 0,
  blush: 0.15,
  browTilt: 0,
  bounce: 1,
  tempo: 1,
  sparkles: 0,
  tilt: 0,
  gazeX: 0,
  gazeY: 0,
  winkLeft: false,
  browSkew: 0,
  mouthShape: 'curve',
  angerMark: false,
  armPose: 'rest',
  limbSwing: 1,
};

/**
 * Facial parameters for a state.
 *
 * `intensity` (0..1) scales how strongly the emotion reads, so the same state
 * can be a flicker or a full performance — that's what lets a 60% score and a
 * 200% score both be "celebrate" without looking identical.
 */
export function expressionFor(state: CreatureState, intensity = 1): Expression {
  const k = clamp01(intensity);
  switch (state) {
    case 'happy':
      return { ...BASE, eyeArc: true, eyeOpen: 0.9, mouthCurve: 0.55 + 0.25 * k, blush: 0.3, bounce: 1.2, tempo: 1.15, armPose: 'wave', limbSwing: 1.2 };
    case 'proud':
      return { ...BASE, eyeArc: true, eyeOpen: 0.85, mouthCurve: 0.5, blush: 0.35, browTilt: 0.4, bounce: 1.1, tilt: -3, sparkles: Math.round(2 * k), armPose: 'hips', limbSwing: 0.7 };
    case 'celebrate':
      return {
        ...BASE,
        eyeArc: true,
        eyeOpen: 0.95,
        pupilScale: 1.2,
        mouthCurve: 0.85 + 0.15 * k,
        mouthOpen: 0.5 + 0.3 * k,
        blush: 0.45,
        browTilt: 0.7,
        bounce: 1.8 + 0.8 * k,
        tempo: 1.7,
        sparkles: 3 + Math.round(3 * k),
        tilt: 4,
        armPose: 'up',
        limbSwing: 2,
      };
    case 'mindblown':
      // The 100%+ moment: eyes blown wide, jaw open, everything moving.
      return {
        ...BASE,
        eyeOpen: 1,
        eyeArc: false,
        pupilScale: 1.55,
        mouthCurve: 0.6,
        mouthOpen: 1,
        blush: 0.6,
        browTilt: 1,
        bounce: 3.2 + 0.8 * k,
        tempo: 2.2,
        sparkles: 8 + Math.round(4 * k),
        tilt: 0,
        armPose: 'up',
        limbSwing: 2,
      };
    case 'sad':
      return { ...BASE, eyeOpen: 0.55, pupilScale: 1.15, mouthCurve: -0.5 - 0.2 * k, blush: 0.1, browTilt: -0.8, bounce: 0.4, tempo: 0.7, tilt: -5, armPose: 'rest', limbSwing: 0.25 };
    // The face for a rough result. It must not grin (that reads as the app
    // not noticing you struggled) and it must not be sad (that reads as
    // disappointment in you). Empathy is drawn with the INNER brows lifted and
    // a small, steady mouth — attentive, warm, unhurried. Device-test-8: a low
    // quiz score was showing 'proud', a full grin.
    case 'caring':
      return { ...BASE, eyeOpen: 0.78, pupilScale: 1.1, mouthCurve: 0.18 + 0.1 * k, blush: 0.28, browTilt: -0.35, bounce: 0.5, tempo: 0.85, tilt: 4 , armPose: 'clap', limbSwing: 0.5 };
    case 'sleepy':
      return { ...BASE, eyeOpen: 0.12, pupilScale: 0.8, mouthCurve: 0.1, blush: 0.2, browTilt: -0.2, bounce: 0.35, tempo: 0.55, tilt: 6 , armPose: 'rest', limbSwing: 0.2 };
    case 'love':
      return { ...BASE, eyeArc: true, eyeOpen: 0.9, mouthCurve: 0.7, blush: 0.65, browTilt: 0.3, bounce: 1.3, tempo: 1.2, sparkles: 3 , armPose: 'clap', limbSwing: 1 };
    // ─── DT18 additions ────────────────────────────────────────────

    case 'curious':
      // Asking you something. Head cocked, eyes up and wide, one brow raised.
      return { ...BASE, eyeOpen: 1, pupilScale: 1.25, mouthCurve: 0.3, blush: 0.2, browTilt: 0.5, browSkew: 0.45, gazeY: -0.3, bounce: 0.9, tempo: 1.05, tilt: -7 , armPose: 'chin', limbSwing: 0.7 };
    case 'thinking':
      // Waiting while you decide. Looking away is the whole trick — a face
      // staring straight out while you pick feels like being watched.
      return { ...BASE, eyeOpen: 0.85, pupilScale: 0.95, mouthCurve: 0.05, blush: 0.15, browTilt: 0.15, gazeX: 0.75, gazeY: -0.2, bounce: 0.5, tempo: 0.8, tilt: 4 , armPose: 'chin', limbSwing: 0.4 };
    case 'surprised':
      // A miss. Startled, never disappointed — disappointment in a character
      // the user chose is the one thing this rig must never draw.
      return { ...BASE, eyeOpen: 1, pupilScale: 1.5, mouthCurve: 0.1, mouthOpen: 0.55, blush: 0.3, browTilt: 0.9, bounce: 1.6, tempo: 1.5, tilt: 0 , armPose: 'cover', limbSwing: 1.5 };
    case 'wink':
      return { ...BASE, eyeOpen: 1, winkLeft: true, pupilScale: 1.15, mouthCurve: 0.6 + 0.2 * k, blush: 0.4, browTilt: 0.35, bounce: 1.2, tempo: 1.2, tilt: -5, sparkles: Math.round(2 * k) , armPose: 'wave', limbSwing: 1.2 };
    case 'laugh':
      return { ...BASE, eyeArc: true, eyeOpen: 0.95, mouthCurve: 0.9, mouthOpen: 0.75 + 0.2 * k, blush: 0.5, browTilt: 0.6, bounce: 2.2 + 0.6 * k, tempo: 1.9, tilt: 7, sparkles: Math.round(3 * k) , armPose: 'up', limbSwing: 1.8 };
    case 'shy':
      return { ...BASE, eyeArc: true, eyeOpen: 0.8, mouthCurve: 0.4, blush: 0.85, browTilt: -0.15, gazeY: 0.6, bounce: 0.6, tempo: 0.85, tilt: 9 , armPose: 'cover', limbSwing: 0.6 };
    case 'determined':
      // The retry face. Set, not sad: brows DOWN and level, mouth firm.
      return { ...BASE, eyeOpen: 0.9, pupilScale: 1.1, mouthCurve: 0.12, blush: 0.2, browTilt: -0.55, bounce: 0.8, tempo: 1.1, tilt: 0 , armPose: 'hips', limbSwing: 0.9 };
    case 'cheer':
      return { ...BASE, eyeArc: true, eyeOpen: 0.95, mouthCurve: 0.75, mouthOpen: 0.35, blush: 0.45, browTilt: 0.8, bounce: 2 + 0.5 * k, tempo: 1.8, tilt: -6, sparkles: 2 + Math.round(2 * k) , armPose: 'up', limbSwing: 2 };
    case 'confused':
      // One brow up, one down. Nothing else needs to change.
      return { ...BASE, eyeOpen: 0.92, pupilScale: 1.05, mouthCurve: -0.15, blush: 0.18, browTilt: 0.1, browSkew: 0.9, gazeX: -0.4, bounce: 0.7, tempo: 0.9, tilt: -9 , armPose: 'chin', limbSwing: 0.6 };
    case 'relieved':
      return { ...BASE, eyeArc: true, eyeOpen: 0.85, mouthCurve: 0.45, blush: 0.4, browTilt: -0.25, bounce: 0.7, tempo: 0.8, tilt: 2 , armPose: 'clap', limbSwing: 0.6 };

    // ─── The awkward half ──────────────────────────────────────────

    case 'frustrated':
      // Aimed at the problem, never at the user. Brows down and level, jaw
      // set, everything vibrating slightly.
      return { ...BASE, eyeOpen: 0.75, pupilScale: 0.9, mouthShape: 'grit', mouthCurve: -0.3, blush: 0.3, browTilt: -1, bounce: 1.6, tempo: 1.9, tilt: -3, angerMark: true , armPose: 'hips', limbSwing: 1.7 };
    case 'annoyed':
      // Half-lidded and pointedly looking elsewhere. The eye-roll is the gaze,
      // the opinion is the single lowered brow.
      return { ...BASE, eyeOpen: 0.5, pupilScale: 0.85, mouthShape: 'smirk', mouthCurve: -0.1, blush: 0.15, browTilt: -0.4, browSkew: -0.75, gazeX: 0.8, bounce: 0.5, tempo: 0.85, tilt: 5 , armPose: 'hips', limbSwing: 0.4 };
    case 'worried':
      return { ...BASE, eyeOpen: 0.95, pupilScale: 1.3, mouthCurve: -0.3, blush: 0.2, browTilt: -0.9, bounce: 0.9, tempo: 1.25, gazeY: 0.15, tilt: -4 , armPose: 'clap', limbSwing: 0.9 };
    case 'sulky':
      // A pout, not a sulk at you: chin tucked, eyes up under the brows.
      return { ...BASE, eyeOpen: 0.8, pupilScale: 1.2, mouthCurve: -0.45, blush: 0.5, browTilt: -0.5, gazeY: -0.35, bounce: 0.45, tempo: 0.75, tilt: 8 , armPose: 'clap', limbSwing: 0.3 };
    case 'queasy':
      // The rough-day face. Slow, half-lidded, mouth unsteady. Deliberately
      // not 'sad' — feeling rotten and feeling low are different, and a cycle
      // tracker needs the first one far more often than the second.
      return { ...BASE, eyeOpen: 0.42, pupilScale: 0.95, mouthShape: 'wavy', mouthCurve: -0.2, blush: 0.35, browTilt: -0.6, gazeY: 0.25, bounce: 0.3, tempo: 0.5, tilt: -6 , armPose: 'clap', limbSwing: 0.25 };
    case 'excited':
      // Anticipation, not victory: it does not know the result yet, so the
      // eyes are round and huge rather than happily arced shut.
      return { ...BASE, eyeOpen: 1, eyeArc: false, pupilScale: 1.45, mouthCurve: 0.8, mouthOpen: 0.4, blush: 0.5, browTilt: 0.85, bounce: 2.6 + 0.6 * k, tempo: 2, sparkles: 2 + Math.round(2 * k), tilt: -4 , armPose: 'up', limbSwing: 2 };
    case 'smug':
      // Pleased with ITSELF. One brow up, lids low, a crooked little mouth.
      return { ...BASE, eyeOpen: 0.6, pupilScale: 1, mouthShape: 'smirk', mouthCurve: 0.3, blush: 0.3, browTilt: 0.2, browSkew: 0.8, bounce: 0.8, tempo: 0.95, tilt: -6, sparkles: Math.round(1 * k) , armPose: 'hips', limbSwing: 0.6 };

    case 'idle':
    default:
      return { ...BASE };
  }
}

/**
 * Map a score percentage to a reaction.
 *
 * The owner's ask: at 100%+ the companion should be "mind blowing". So the
 * ladder tops out in a state that is deliberately unhinged, and everything
 * below it is proportionate rather than uniformly enthusiastic — praise that
 * never varies stops meaning anything.
 */
export function stateForScore(scorePct: number): CreatureState {
  if (!Number.isFinite(scorePct)) return 'idle';
  if (scorePct >= 100) return 'mindblown';
  if (scorePct >= 80) return 'celebrate';
  if (scorePct >= 60) return 'proud';
  if (scorePct >= 40) return 'happy';
  // The bottom of the ladder is 'caring', not 'idle' or 'sad' (device-test-8:
  // a 1-of-3 result was showing a full grin). Blank reads as the app not
  // noticing; sad reads as disappointment in the user. Neither is what someone
  // who just got most of a quiz wrong needs to see.
  return 'caring';
}

/** How strongly to play the state, from the score within its band. */
export function intensityForScore(scorePct: number): number {
  if (!Number.isFinite(scorePct)) return 0.5;
  if (scorePct >= 100) return clamp01((scorePct - 100) / 100); // 100→0, 200→1
  return clamp01((scorePct % 20) / 20);
}

/** Mood check-in score (1..5) → a companion reaction. */
export function stateForMood(moodScore: number | null): CreatureState {
  if (moodScore === null || !Number.isFinite(moodScore)) return 'idle';
  if (moodScore <= 1) return 'sad';
  if (moodScore === 2) return 'sad';
  if (moodScore === 3) return 'idle';
  if (moodScore === 4) return 'happy';
  return 'celebrate';
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
