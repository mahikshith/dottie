/**
 * Dottie — navigation constants
 *
 * ─── WHY `presentation: 'modal'` IS BANNED ON ANDROID (device-test-22) ──
 *
 *  Two of the owner's long-running complaints turned out to be the same bug:
 *
 *    · "on the add to sisterhood page the bottom part to proceed of the UI is
 *       still stuck under the android page" — the Next button, half under the
 *       navigation bar.
 *    · Today's check-in drawing its title straight through the status bar.
 *
 *  Both screens are presented with `presentation: 'modal'`. On Android,
 *  react-native-screens puts a modal-presented screen in its own container
 *  that does not carry the window's system-bar insets, so
 *  `useSafeAreaInsets()` inside it reports ZERO at the edge that is actually
 *  covered. Every one of those screens pads correctly — with zero. That is
 *  why round after round of safe-area fixes worked everywhere EXCEPT here,
 *  and why `audit:safearea` (which reads the padding expression, and the
 *  expression is right) kept passing.
 *
 *  This is the same family as CLAUDE.md rule 10: a separate Android window is
 *  never worth what it costs. iOS's modal presentation has no such problem and
 *  is genuinely nicer there, so it keeps it.
 *
 *  The `slide_from_bottom` animation is what actually made these feel like
 *  sheets, and that is unchanged — so a card presentation looks the same.
 */

import { Platform } from 'react-native';

/**
 * Use for any screen that should feel like a sheet. Modal on iOS, a normal
 * card on Android — where a modal costs the screen its safe-area insets.
 */
export const SHEET_PRESENTATION: 'modal' | 'card' =
  Platform.OS === 'ios' ? 'modal' : 'card';
