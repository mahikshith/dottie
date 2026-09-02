/**
 * VersionBadge
 *
 * A tiny floating tag showing which beta build this is. Visible only
 * in beta builds (IS_BETA_BUILD). Tappable — taps show a friendly
 * Alert with full build details so testers can paste the exact build
 * info into a feedback email or bug report.
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  - Sits in a corner (top-right by default), small enough to ignore
 *  - Subtle warm-tinted background — never pulls focus from real UI
 *  - Tap → friendly Alert with copy-friendly text + an OK button
 *  - In production builds: returns null, zero bundle impact
 *
 * ─── WHO MOUNTS THIS ────────────────────────────────────────────────
 *
 *  Mounted by app/(tabs)/_layout.tsx in Batch D so it appears on
 *  every tab screen but not on onboarding / modals / lock screen.
 *
 *  Caller decides position via the `position` prop — default is
 *  top-right but bottom-left is also useful when the FeedbackBubble
 *  takes the bottom-right.
 *
 * ─── INTENTIONAL NON-FEATURES ───────────────────────────────────────
 *
 *  - No automatic clipboard copy on tap. We tried it; copy-without-
 *    confirmation feels invasive. Tap → show the info → user picks.
 *  - No "update available" check. That's an OTA concern for a later
 *    chunk.
 *  - No log uploader. The badge is for IDENTIFICATION, not telemetry.
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { Shadows } from '../../constants/shadows';
import {
  IS_BETA_BUILD,
  BUILD_LABEL,
  APP_VERSION,
  BUILD_NUMBER,
  BETA_COHORT_NAME,
  FEEDBACK_TO_EMAIL,
  getBuildInfoClipboardText,
} from '../../constants/build-info';

// ─── PROPS ───────────────────────────────────────────────────────────

export type VersionBadgePosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

interface VersionBadgeProps {
  /** Where on the screen to anchor the badge. Defaults to top-right. */
  position?: VersionBadgePosition;
  /**
   * Optional extra offset (pt) from the edge. Useful if the parent
   * already has a status bar / tab bar taking the natural corner.
   * Defaults to 0.
   */
  extraOffset?: number;
  /**
   * Force render even when not in a beta build. Useful in dev menu
   * previews. Defaults to false → hidden in production.
   */
  forceVisible?: boolean;
}

// ─── COMPONENT ───────────────────────────────────────────────────────

export function VersionBadge({
  position = 'top-right',
  extraOffset = 0,
  forceVisible = false,
}: VersionBadgeProps) {
  const insets = useSafeAreaInsets();
  const [detailsOpen, setDetailsOpen] = useState(false);

  // ─── Production guard ───────────────────────────────────────────
  if (!IS_BETA_BUILD && !forceVisible) {
    return null;
  }

  // ─── Position styles ────────────────────────────────────────────
  const positionStyle = computePositionStyle(position, insets, extraOffset);

  const handleBadgePress = () => {
    Haptics.selectionAsync().catch(() => {});
    setDetailsOpen(true);
  };

  const handleClose = () => {
    setDetailsOpen(false);
  };

  return (
    <>
      <View pointerEvents="box-none" style={[styles.wrapper, positionStyle]}>
        <Pressable
          onPress={handleBadgePress}
          style={({ pressed }) => [
            styles.badge,
            pressed && styles.badgePressed,
          ]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Beta build ${APP_VERSION}, build ${BUILD_NUMBER}. Tap for details.`}
        >
          <Text style={styles.badgeDot}>🌱</Text>
          <Text style={styles.badgeText} numberOfLines={1}>
            {`v${APP_VERSION}·${BUILD_NUMBER}`}
          </Text>
        </Pressable>
      </View>

      {/* Details overlay — in-tree (NOT a <Modal>) so it can never get
          stuck as a floating Android window. Device-test #6: every Modal
          in the app was converted to an in-tree overlay after the
          persistent white-circle bug traced to a stuck Modal window. */}
      {detailsOpen && (
        <Pressable
          style={[styles.modalBackdrop, StyleSheet.absoluteFillObject, { zIndex: 999, elevation: 999 }]}
          onPress={handleClose}
        >
          {/* Inner pressable swallows taps so tapping inside the card
              doesn't close it */}
          <Pressable style={styles.modalCardWrap} onPress={() => {}}>
            <SafeAreaView edges={['top']}>
              <View style={styles.modalCard}>
                <Text style={styles.modalEmoji}>🌱</Text>
                <Text style={styles.modalTitle}>You're testing a Dottie beta</Text>
                <Text style={styles.modalSubtitle}>{BUILD_LABEL}</Text>

                <View style={styles.modalDivider} />

                <DetailRow label="App version" value={APP_VERSION} />
                <DetailRow label="Build number" value={BUILD_NUMBER} />
                <DetailRow label="Cohort" value={BETA_COHORT_NAME} />
                <DetailRow label="Feedback email" value={FEEDBACK_TO_EMAIL} />

                <View style={styles.modalDivider} />

                <Text style={styles.modalHelp}>
                  Want to report a bug? Tap the 💌 bubble on any tab and
                  paste the build label above into your message — it
                  helps us pin down exactly what you were on.
                </Text>

                <View style={styles.clipboardBlock}>
                  <Text style={styles.clipboardLabel}>Copy this:</Text>
                  <Text style={styles.clipboardText} selectable>
                    {getBuildInfoClipboardText()}
                  </Text>
                </View>

                <Pressable
                  onPress={handleClose}
                  style={({ pressed }) => [
                    styles.modalCloseButton,
                    pressed && { opacity: 0.85 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                >
                  <Text style={styles.modalCloseText}>Got it</Text>
                </Pressable>
              </View>
            </SafeAreaView>
          </Pressable>
        </Pressable>
      )}
    </>
  );
}

// ─── DETAIL ROW ──────────────────────────────────────────────────────

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} selectable numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// ─── POSITION HELPER ─────────────────────────────────────────────────

function computePositionStyle(
  position: VersionBadgePosition,
  insets: { top: number; right: number; bottom: number; left: number },
  extraOffset: number
) {
  const base = {
    position: 'absolute' as const,
  };
  switch (position) {
    case 'top-right':
      return {
        ...base,
        top: insets.top + Spacing.sm + extraOffset,
        right: insets.right + Spacing.sm,
      };
    case 'top-left':
      return {
        ...base,
        top: insets.top + Spacing.sm + extraOffset,
        left: insets.left + Spacing.sm,
      };
    case 'bottom-right':
      return {
        ...base,
        bottom: insets.bottom + Spacing.sm + extraOffset,
        right: insets.right + Spacing.sm,
      };
    case 'bottom-left':
      return {
        ...base,
        bottom: insets.bottom + Spacing.sm + extraOffset,
        left: insets.left + Spacing.sm,
      };
  }
}

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    // Position set inline via computePositionStyle
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 241, 232, 0.92)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Spacing.radius.full,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.sm,
  },
  badgePressed: {
    opacity: 0.8,
    transform: [{ scale: 0.97 }],
  },
  badgeDot: {
    fontSize: 12,
  },
  badgeText: {
    ...Typography.preset.caption,
    color: Colors.text.secondary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: Colors.surface.overlay,
    justifyContent: 'center',
    paddingHorizontal: Spacing.screenPadding,
  },
  modalCardWrap: {
    // Wrapper exists only to provide a tap surface that doesn't
    // collapse the modal when tapped inside.
  },
  modalCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: Spacing.radius['2xl'],
    padding: Spacing.cardPaddingLarge,
    gap: Spacing.sm,
    ...Shadows.floating,
  },
  modalEmoji: {
    fontSize: 36,
    textAlign: 'center',
  },
  modalTitle: {
    ...Typography.preset.h3,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  modalSubtitle: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  modalDivider: {
    height: 1,
    backgroundColor: Colors.border.light,
    marginVertical: Spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    gap: Spacing.base,
  },
  detailLabel: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
  },
  detailValue: {
    ...Typography.preset.captionBold,
    color: Colors.text.primary,
    flexShrink: 1,
    textAlign: 'right',
  },
  modalHelp: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  clipboardBlock: {
    backgroundColor: Colors.surface.background,
    borderRadius: Spacing.radius.lg,
    padding: Spacing.base,
    marginTop: Spacing.sm,
    gap: 4,
  },
  clipboardLabel: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
  },
  clipboardText: {
    ...Typography.preset.caption,
    color: Colors.text.primary,
    fontFamily: 'Courier',
    fontSize: 12,
    lineHeight: 18,
  },
  modalCloseButton: {
    marginTop: Spacing.base,
    backgroundColor: Colors.primary.coral,
    paddingVertical: Spacing.md,
    borderRadius: Spacing.radius.full,
    alignItems: 'center',
    ...Shadows.button,
  },
  modalCloseText: {
    ...Typography.preset.button,
    color: Colors.text.inverse,
  },
});
