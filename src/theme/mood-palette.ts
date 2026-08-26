/**
 * Dottie — Mood → Palette mapping (design-v2)
 *
 * The heart of the "your mood colours your world" idea: the daily check-in's
 * mood score selects which Aurora palette the whole UI wears. This is the ONE
 * place that mapping lives, so tuning "which feeling gets which world" is a
 * single-file change.
 *
 * Mood scores come from the check-in mood picker (see `app/(tabs)/home.tsx`
 * `moodOptions`): 5 = great 😊, 4 = good 🙂, 3 = okay 😐, 2 = low 😔, 1 = rough 😤.
 *
 * ─── THE CARE RULE (do not "fix" this into a literal gradient) ──────
 *
 *  Low and rough do NOT map to darker/greyer palettes — they map to the
 *  WARM, soothing Twilight and Ember. Mapping a hard day to a visually hard
 *  UI can reinforce the low mood; the app meets the user gently instead.
 *  (apple-design · Responsibility). Keep it that way unless a designer
 *  deliberately revisits it.
 */

import { MoodPaletteId, DEFAULT_PALETTE_ID } from './palettes';

/**
 * Resolve the palette id for a given mood score.
 * `null`/`undefined` (no check-in yet today) → the calm default.
 */
export function paletteForMood(moodScore: number | null | undefined): MoodPaletteId {
  switch (moodScore) {
    case 5:
      return 'radiance'; // great  → sunny gold
    case 4:
      return 'meadow'; // good   → fresh mint
    case 2:
      return 'twilight'; // low    → soothing periwinkle
    case 1:
      return 'ember'; // rough  → warm, grounding
    case 3:
    default:
      return DEFAULT_PALETTE_ID; // okay / unknown → calm Nocturne
  }
}
