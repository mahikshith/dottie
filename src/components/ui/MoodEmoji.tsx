/**
 * Dottie — MoodEmoji
 *
 * The ONE way the app shows a reaction now: a plain emoji.
 *
 * ─── WHY THIS REPLACED THE COMPANIONS (device-test-30) ──────────────
 *
 *  Dottie carried six drawn "spirit companions" — a vector rig with limbs,
 *  ears, tails, blinking and a parametric face. Four device rounds were spent
 *  on that art (DT7, DT8, DT16, DT26) and the verdict never really moved:
 *
 *      "They look childish. Let's ditch the entire companion thing."
 *
 *  Two AI illustration passes and a hand-built rig later, the honest read is
 *  that character art needs an illustrator, not more iterations — so the whole
 *  layer is gone rather than half-good. An emoji is legible at 28px, costs no
 *  frames, never lands in the uncanny valley, and every phone already draws it
 *  well. It is not a placeholder for a rig; it IS the reaction.
 *
 *  The state vocabulary is unchanged, so everything that decided WHAT to feel —
 *  the quiz dialogue, `stateForScore`, the check-in — still works. Only the
 *  drawing changed.
 */

import { Text, StyleSheet, type StyleProp, type TextStyle } from 'react-native';

// ─── THE STATES ──────────────────────────────────────────────────────

/**
 * Every reaction the app can show. Kept deliberately wide: these names are
 * used by the quiz dialogue and the score/mood mappers, and narrowing them
 * would silently flatten the tone rather than simplify it.
 */
export type MoodState =
  | 'idle'
  | 'happy'
  | 'proud'
  | 'celebrate'
  | 'mindblown'
  | 'sad'
  | 'caring'
  | 'sleepy'
  | 'love'
  | 'curious'
  | 'thinking'
  | 'surprised'
  | 'wink'
  | 'laugh'
  | 'shy'
  | 'determined'
  | 'cheer'
  | 'confused'
  | 'relieved'
  | 'frustrated'
  | 'annoyed'
  | 'worried'
  | 'excited'
  | 'sulky'
  | 'queasy'
  | 'smug'
  | 'encourage'
  | 'cozy';

/**
 * One emoji per state. No two states share a glyph — a reaction that looks
 * identical to the one before it is the same as no reaction at all.
 */
export const MOOD_EMOJI: Record<MoodState, string> = {
  idle: '🙂',
  happy: '😊',
  proud: '😌',
  celebrate: '🎉',
  mindblown: '🤯',
  sad: '😔',
  caring: '🫶',
  sleepy: '😴',
  love: '💗',
  curious: '🤔',
  thinking: '💭',
  surprised: '😮',
  wink: '😉',
  laugh: '😄',
  shy: '🙈',
  determined: '💪',
  cheer: '👏',
  confused: '😕',
  relieved: '😮‍💨',
  frustrated: '😣',
  annoyed: '😑',
  worried: '😟',
  excited: '🤩',
  sulky: '😒',
  queasy: '🤢',
  smug: '😏',
  encourage: '✨',
  cozy: '🫖',
};

/** Plain words for a screen reader — the emoji itself reads as nonsense. */
const SPOKEN: Record<MoodState, string> = {
  idle: 'Dottie', happy: 'happy', proud: 'proud', celebrate: 'celebrating',
  mindblown: 'amazed', sad: 'gentle', caring: 'caring', sleepy: 'sleepy',
  love: 'warm', curious: 'curious', thinking: 'thinking', surprised: 'surprised',
  wink: 'playful', laugh: 'delighted', shy: 'shy', determined: 'determined',
  cheer: 'cheering', confused: 'puzzled', relieved: 'relieved',
  frustrated: 'frustrated', annoyed: 'unimpressed', worried: 'concerned',
  excited: 'excited', sulky: 'sulky', queasy: 'queasy', smug: 'smug',
  encourage: 'encouraging', cozy: 'cosy',
};

// ─── THE COMPONENT ───────────────────────────────────────────────────

export interface MoodEmojiProps {
  state?: MoodState;
  /** Box size in px. The glyph is sized to sit inside it. */
  size?: number;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

/**
 * An emoji, sized to a square box.
 *
 * `lineHeight` is set from the size on purpose: an emoji's glyph box is taller
 * than its font size on Android, and without it the character is clipped at
 * the top in a fixed-height row.
 */
export function MoodEmoji({
  state = 'idle',
  size = 44,
  style,
  accessibilityLabel,
}: MoodEmojiProps): JSX.Element {
  return (
    <Text
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? SPOKEN[state]}
      allowFontScaling={false}
      style={[styles.base, { fontSize: size * 0.84, lineHeight: size * 1.06 }, style]}
    >
      {MOOD_EMOJI[state]}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: { textAlign: 'center' },
});

// ─── SCORE / MOOD → STATE ────────────────────────────────────────────

/**
 * Quiz score → the reaction.
 *
 * The bottom of the ladder is 'caring', not 'idle' or 'sad' (device-test-8: a
 * 1-of-3 result was showing a full grin). Blank reads as the app not noticing;
 * sad reads as disappointment in the user. Neither is what someone who just
 * got most of a quiz wrong needs to see.
 */
export function stateForScore(scorePct: number): MoodState {
  if (!Number.isFinite(scorePct)) return 'idle';
  if (scorePct >= 100) return 'mindblown';
  if (scorePct >= 80) return 'celebrate';
  if (scorePct >= 60) return 'proud';
  if (scorePct >= 40) return 'happy';
  return 'caring';
}

/** Mood check-in score (1..5) → a reaction. */
export function stateForMood(moodScore: number | null): MoodState {
  if (moodScore === null || !Number.isFinite(moodScore)) return 'idle';
  if (moodScore <= 2) return 'sad';
  if (moodScore === 3) return 'idle';
  if (moodScore === 4) return 'happy';
  return 'celebrate';
}
