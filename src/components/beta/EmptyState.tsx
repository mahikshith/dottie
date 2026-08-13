/**
 * EmptyState
 *
 * A reusable warm widget for screens that have NO data yet. Used by
 * community feeds, sisterhood circles, doctor reports, etc. — anywhere
 * a real user might first land and see "nothing here."
 *
 * ─── WHY THIS MATTERS FOR BETA ──────────────────────────────────────
 *
 *  Testers will hit empty screens often. Their first time on:
 *    - Community tab → no posts yet
 *    - Sisterhood circle → no members yet
 *    - Doctor report → not enough cycle data yet
 *    - Predicts feed → not enough history yet
 *
 *  If those screens show a bare "No data" or — worse — a blank white
 *  page, testers think the app is broken and bounce. A warm empty
 *  state turns "broken" into "I see what you're showing me and I know
 *  what to do next."
 *
 *  This component handles the WARM PART. Each consumer screen
 *  provides the right emoji, copy, and CTA for its context.
 *
 * ─── LOCATION ───────────────────────────────────────────────────────
 *
 *  Lives in src/components/beta/ because that's where the rest of
 *  Chunk 12's polish components live. NOT inherently a "beta-only"
 *  component — designed to graduate to src/components/ui/ in a
 *  future refactor when we formalize the UI primitives folder.
 *
 *  Until then, importing from `@/components/beta/EmptyState` is fine
 *  and won't break when we move the file.
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  - Big friendly emoji at top (no illustrations — keeps file size
 *    tiny and lets every screen pick its own emotional tone)
 *  - Title (short, encouraging)
 *  - Body (1-2 sentences explaining the state + what to do)
 *  - Optional primary action (pill button)
 *  - Optional secondary action (text link)
 *  - Optional companion footer (e.g., "Luna is here whenever 🦊")
 *
 *  Stays vertically centered on most screens; consumer can wrap in
 *  ScrollView if the content might exceed screen height (rare).
 */

import { ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { Shadows } from '../../constants/shadows';

// ─── PROPS ───────────────────────────────────────────────────────────

export interface EmptyStateAction {
  label: string;
  onPress: () => void;
  /** Optional accent color for the button (defaults to coral). */
  color?: string;
}

interface EmptyStateProps {
  /** Big emoji at the top — pick something that fits the screen's mood. */
  emoji: string;
  /** Short title (1 line ideal). */
  title: string;
  /** 1-2 sentences of friendly explanation + what to do next. */
  body: string;
  /** Optional primary action — appears as a filled pill button. */
  primaryAction?: EmptyStateAction;
  /** Optional secondary action — appears as a text link below primary. */
  secondaryAction?: EmptyStateAction;
  /**
   * Optional small footer text. Use for companion-flavored signoffs
   * like "Luna is here whenever 🦊". Keeps the screen feeling alive.
   */
  footer?: string;
  /**
   * Optional custom slot rendered between body and actions. Use
   * sparingly — most screens don't need this. Useful for inline
   * illustrations or a one-line stat.
   */
  extraContent?: ReactNode;
  /**
   * When true, removes the vertical centering and just stacks content
   * normally. Useful when embedding inside a scrollable list as a
   * placeholder rather than a full-screen state.
   */
  inline?: boolean;
}

// ─── COMPONENT ───────────────────────────────────────────────────────

export function EmptyState({
  emoji,
  title,
  body,
  primaryAction,
  secondaryAction,
  footer,
  extraContent,
  inline = false,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, inline ? styles.containerInline : styles.containerCentered]}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>

      {extraContent ? <View style={styles.extraSlot}>{extraContent}</View> : null}

      {primaryAction ? (
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            primaryAction.onPress();
          }}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: primaryAction.color ?? Colors.primary.coral },
            pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
          ]}
          accessibilityRole="button"
          accessibilityLabel={primaryAction.label}
        >
          <Text style={styles.primaryButtonText}>{primaryAction.label}</Text>
        </Pressable>
      ) : null}

      {secondaryAction ? (
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            secondaryAction.onPress();
          }}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && { opacity: 0.6 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={secondaryAction.label}
          hitSlop={6}
        >
          <Text
            style={[
              styles.secondaryButtonText,
              secondaryAction.color ? { color: secondaryAction.color } : null,
            ]}
          >
            {secondaryAction.label}
          </Text>
        </Pressable>
      ) : null}

      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.screenPadding,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  containerCentered: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: Spacing['3xl'],
  },
  containerInline: {
    paddingVertical: Spacing['2xl'],
  },
  emoji: {
    fontSize: 64,
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.preset.h3,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  body: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
    marginBottom: Spacing.sm,
  },
  extraSlot: {
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  primaryButton: {
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing.md,
    borderRadius: Spacing.radius.full,
    marginTop: Spacing.md,
    ...Shadows.button,
  },
  primaryButtonText: {
    ...Typography.preset.button,
    color: Colors.text.inverse,
  },
  secondaryButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  secondaryButtonText: {
    ...Typography.preset.bodySemibold,
    color: Colors.text.link,
  },
  footer: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
    marginTop: Spacing.lg,
    textAlign: 'center',
  },
});
