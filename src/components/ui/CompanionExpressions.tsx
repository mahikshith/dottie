/**
 * Dottie — CompanionExpressions
 *
 * A companion shown in several moods at once, side by side.
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────
 *
 *  Owner, device-test-16: "all the expressions of each and every single
 *  companion needs to be expressed so that the user will look at it and find
 *  out what they want, based upon the companion that they want to set up."
 *
 *  That is the right instinct. Both picker screens showed ONE static text
 *  emoji per companion — 🐰 — which tells you the species and nothing else.
 *  But the species is the least interesting thing about the choice: what the
 *  user is actually picking is a face that will react to them for months.
 *  Someone choosing between Pip and Nyx wants to know what each one looks like
 *  when it's proud of them and what it looks like on a rough day.
 *
 *  It also fixes a real inconsistency. The picker's text emoji and the rig
 *  drawn everywhere else are two different animals, so people chose one bunny
 *  and got another.
 *
 * ─── PERFORMANCE ────────────────────────────────────────────────────
 *
 *  Each face is a full rig, so the strip is deliberately short (3 by default)
 *  and small. Six companions × 3 faces is 18 rigs on the picker, which is fine
 *  because they are static SVG at rest — the idle bob is the only motion, and
 *  it is transform-only on the UI thread.
 */

import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { CompanionCreature } from './creature/CompanionCreature';
import type { CompanionType } from '../../types/companion.types';
import type { CreatureState } from './creature/expressions';

/**
 * The three moods worth showing when choosing.
 *
 * Not a random sample: they are the emotional RANGE. `celebrate` is the best
 * this companion gets, `idle` is what you'll see most days, and `cozy` is how
 * it behaves when you've had a bad one — which is the state people actually
 * care about and the one a static emoji can never show.
 */
const DEFAULT_FACES: CreatureState[] = ['celebrate', 'idle', 'caring'];

export interface CompanionExpressionsProps {
  type: CompanionType;
  /** Which faces to show, left to right. Defaults to celebrate / idle / caring. */
  faces?: CreatureState[];
  /** Size of the CENTRE face; the others are drawn slightly smaller. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function CompanionExpressions({
  type,
  faces = DEFAULT_FACES,
  size = 64,
  style,
}: CompanionExpressionsProps): JSX.Element {
  const middle = Math.floor(faces.length / 2);
  return (
    <View style={[styles.row, style]} pointerEvents="none">
      {faces.map((face, i) => {
        // The centre face is the "resting" one and reads as primary; the
        // others sit slightly smaller and softer so the row has a focal point
        // instead of three equal competing faces.
        const isCentre = i === middle;
        return (
          <View key={`${face}_${i}`} style={isCentre ? undefined : styles.side}>
            <CompanionCreature
              type={type}
              state={face}
              intensity={isCentre ? 0.8 : 1}
              size={isCentre ? size : size * 0.78}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  side: {
    opacity: 0.85,
  },
});
