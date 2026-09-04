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
  | 'love';     // affectionate

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
}

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
      return { ...BASE, eyeArc: true, eyeOpen: 0.9, mouthCurve: 0.55 + 0.25 * k, blush: 0.3, bounce: 1.2, tempo: 1.15 };
    case 'proud':
      return { ...BASE, eyeArc: true, eyeOpen: 0.85, mouthCurve: 0.5, blush: 0.35, browTilt: 0.4, bounce: 1.1, tilt: -3, sparkles: Math.round(2 * k) };
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
      };
    case 'sad':
      return { ...BASE, eyeOpen: 0.55, pupilScale: 1.15, mouthCurve: -0.5 - 0.2 * k, blush: 0.1, browTilt: -0.8, bounce: 0.4, tempo: 0.7, tilt: -5 };
    // The face for a rough result. It must not grin (that reads as the app
    // not noticing you struggled) and it must not be sad (that reads as
    // disappointment in you). Empathy is drawn with the INNER brows lifted and
    // a small, steady mouth — attentive, warm, unhurried. Device-test-8: a low
    // quiz score was showing 'proud', a full grin.
    case 'caring':
      return { ...BASE, eyeOpen: 0.78, pupilScale: 1.1, mouthCurve: 0.18 + 0.1 * k, blush: 0.28, browTilt: -0.35, bounce: 0.5, tempo: 0.85, tilt: 4 };
    case 'sleepy':
      return { ...BASE, eyeOpen: 0.12, pupilScale: 0.8, mouthCurve: 0.1, blush: 0.2, browTilt: -0.2, bounce: 0.35, tempo: 0.55, tilt: 6 };
    case 'love':
      return { ...BASE, eyeArc: true, eyeOpen: 0.9, mouthCurve: 0.7, blush: 0.65, browTilt: 0.3, bounce: 1.3, tempo: 1.2, sparkles: 3 };
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
