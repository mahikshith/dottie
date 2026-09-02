/**
 * CelebrationDialog — warm, themed replacement for native Alert popups.
 *
 * ─── WHY NO <Modal> (device-test #6 — the white-circle saga) ────────
 *
 *  Prior versions wrapped the card in React Native's <Modal> with
 *  `statusBarTranslucent transparent`. On Android that spawns a SEPARATE
 *  OS window. If that window's content mis-measures on first paint (a
 *  known race with statusBarTranslucent, and worse when a Reanimated
 *  entering animation runs on the same frame), the card collapses to a
 *  tiny fragment at the top-left — a white blob on the aurora ground —
 *  and, being a separate window, it FLOATS ABOVE EVERY SCREEN and keeps
 *  intercepting touches. Because the mis-rendered buttons can't be
 *  tapped, `visible` never flips back to false, so the blob persists
 *  until the app is killed. That is exactly the owner's report: a white
 *  dot top-left on every dark screen after tapping "proceed" in a lesson,
 *  only cleared by closing the app.
 *
 *  Fix: render the dialog IN the app's own view tree as an absolutely-
 *  positioned full-screen overlay (this component is mounted at the app
 *  root, a sibling of the navigator — see app/_layout.tsx AppDialogHost).
 *  No separate window ⇒ no window-layout race ⇒ nothing to get stuck.
 *  It returns null when hidden, so it costs nothing when idle.
 *
 * ─── DARK GLASS, NOT CREAM ──────────────────────────────────────────
 *
 *  The card is now aurora dark glass (was cream #FFF8F2). Two reasons:
 *  (1) it matches the rest of the app, and (2) DEFENSIVELY — if a future
 *  layout bug ever collapses the card, a dark fragment on the dark
 *  ground is invisible, never a glaring white dot.
 *
 * ─── ALWAYS DISMISSABLE ─────────────────────────────────────────────
 *
 *  Tapping the dim backdrop OUTSIDE the card calls onRequestClose, so the
 *  user can ALWAYS escape even if an action button somehow fails. Belt
 *  and braces against ever trapping the user again.
 */

import { View, Text, Pressable, StyleSheet } from 'react-native';
import { A } from '../../theme';

export interface DialogAction {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
}

interface Props {
  visible: boolean;
  emoji: string;
  title: string;
  body?: string;
  actions: DialogAction[];
  onRequestClose?: () => void;
}

export function CelebrationDialog({
  visible,
  emoji,
  title,
  body,
  actions,
  onRequestClose,
}: Props): JSX.Element | null {
  // Return null when hidden — no separate window, no stuck overlay, no cost.
  if (!visible) return null;

  return (
    <View style={styles.root} pointerEvents="box-none">
      {/* Dim backdrop. Tapping it dismisses (extra escape hatch). */}
      <Pressable
        style={styles.backdrop}
        onPress={onRequestClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      />

      {/* The card. pointerEvents default so its buttons receive taps; the
          backdrop behind it handles tap-outside. */}
      <View style={styles.card}>
        <Text style={styles.emoji}>{emoji}</Text>
        <Text style={styles.title}>{title}</Text>
        {body ? <Text style={styles.body}>{body}</Text> : null}

        <View style={styles.actions}>
          {actions.map((a) =>
            a.variant === 'ghost' ? (
              <Pressable
                key={a.label}
                onPress={a.onPress}
                style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
                accessibilityLabel={a.label}
              >
                <Text style={styles.ghostText}>{a.label}</Text>
              </Pressable>
            ) : (
              <Pressable
                key={a.label}
                onPress={a.onPress}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  a.variant === 'danger' && styles.dangerBtn,
                  pressed && styles.primaryPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={a.label}
              >
                <Text style={[styles.primaryText, a.variant === 'danger' && { color: '#FFF' }]}>
                  {a.label}
                </Text>
              </Pressable>
            )
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    // Fill the whole app viewport, above the navigator. zIndex + elevation
    // so it sits over tab content AND the floating tab bar.
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,4,14,0.66)',
  },
  card: {
    alignSelf: 'stretch',
    maxWidth: 400,
    backgroundColor: A.ground2,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: A.edge,
    padding: 26,
    alignItems: 'center',
    gap: 8,
    // Dark, soft shadow (not warm/cream) so nothing reads as a light blob.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 24,
  },
  emoji: { fontSize: 52 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: A.ink,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: A.ink2,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 6,
  },
  actions: { alignSelf: 'stretch', gap: 8, marginTop: 8 },
  primaryBtn: {
    backgroundColor: A.accent,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryPressed: { transform: [{ scale: 0.97 }], opacity: 0.95 },
  dangerBtn: { backgroundColor: A.error },
  primaryText: { color: A.ground, fontSize: 16, fontWeight: '800' },
  ghostBtn: { paddingVertical: 12, alignItems: 'center' },
  ghostText: { color: A.ink3, fontSize: 15, fontWeight: '600' },
});
