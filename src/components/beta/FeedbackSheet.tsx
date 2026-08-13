/**
 * FeedbackSheet
 *
 * The actual UI for collecting in-app feedback during beta. Lives as
 * a reusable body component so the route file (and a future bottom
 * sheet variant) can render it in different contexts.
 *
 * ─── COMPOSITION ────────────────────────────────────────────────────
 *
 *   Header        ← warm title + close button
 *   Mood          ← MoodPicker (5 emoji)
 *   Message       ← multiline text input (placeholder rotates with mood)
 *   Email         ← optional, "if you'd like a reply"
 *   Disclosure    ← small subtle note about delivery
 *   Send button   ← primary CTA, disabled until valid
 *   Confirmation  ← swaps in over the form after successful send
 *
 *  After a successful send the sheet shows a 1.2s success screen
 *  (companion-themed) before calling onClose, so the user gets a
 *  warm thank-you instead of an abrupt dismiss.
 *
 * ─── ROUTER-FREE ────────────────────────────────────────────────────
 *
 *  Mirrors the GhostLockBody / DecoyHomeBody pattern from Chunk 11:
 *  the sheet's behavior is pure, the route file is a thin shell.
 *  This way an AppLockGate-style overlay can also mount this sheet
 *  in the future (e.g., for an "always available" floating bubble
 *  rather than navigation-based).
 *
 *  The sheet calls `onClose()` when:
 *   - The user taps the close X
 *   - The user taps "Maybe later" in the confirmation step
 *   - The 1.2s post-send confirmation timer elapses
 *
 *  The route file passes router.back as onClose; an overlay caller
 *  would pass its own close handler.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { Shadows } from '../../constants/shadows';

import {
  useBetaFeedbackStore,
  selectFeedbackDraft,
  selectIsSendingFeedback,
  selectFeedbackValidationError,
  selectLastDelivery,
  useUserStore,
  useCycleStore,
  selectCompanionType,
  selectUserMode,
  selectCurrentPhase,
  selectDayInCycle,
  type BetaFeedbackSendContext,
} from '../../stores';
import { getCompanion } from '../../content/companions';
import {
  FEEDBACK_MESSAGE_MAX,
  FeedbackMood,
} from '../../types/beta-feedback.types';

// ─── PROPS ───────────────────────────────────────────────────────────

interface FeedbackSheetProps {
  /** Called when the sheet wants to close itself. */
  onClose: () => void;
}

// ─── COMPONENT ───────────────────────────────────────────────────────

export function FeedbackSheet({ onClose }: FeedbackSheetProps) {
  // ─── Store subscriptions ────────────────────────────────────────
  const draft = useBetaFeedbackStore(selectFeedbackDraft);
  const isSending = useBetaFeedbackStore(selectIsSendingFeedback);
  const validationError = useBetaFeedbackStore(selectFeedbackValidationError);
  const lastDelivery = useBetaFeedbackStore(selectLastDelivery);
  const setDraft = useBetaFeedbackStore((s) => s.setDraft);
  const sendFn = useBetaFeedbackStore((s) => s.send);
  const resetDraft = useBetaFeedbackStore((s) => s.resetDraft);

  // Context fields (read once at render — no need for live subscriptions
  // since we only consume them when the user taps Send).
  const companionType = useUserStore(selectCompanionType);
  const userMode = useUserStore(selectUserMode);
  const currentPhase = useCycleStore(selectCurrentPhase);
  const dayInCycle = useCycleStore(selectDayInCycle);

  const companion = useMemo(() => getCompanion(companionType), [companionType]);

  // ─── Post-send confirmation state ───────────────────────────────
  const [showConfirmation, setShowConfirmation] = useState(false);
  const confirmationOpacity = useRef(new Animated.Value(0)).current;

  // Auto-close after the confirmation has been visible for a beat
  useEffect(() => {
    if (!showConfirmation) return;
    const timer = setTimeout(() => {
      handleClose();
    }, 1800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showConfirmation]);

  // Fade in the confirmation
  useEffect(() => {
    if (!showConfirmation) return;
    Animated.timing(confirmationOpacity, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [showConfirmation, confirmationOpacity]);

  // ─── Handlers ───────────────────────────────────────────────────

  const handleSetMood = (mood: FeedbackMood) => {
    setDraft({ mood });
  };

  const handleSetMessage = (message: string) => {
    if (message.length <= FEEDBACK_MESSAGE_MAX) {
      setDraft({ message });
    }
  };

  const handleSetEmail = (email: string) => {
    setDraft({ email });
  };

  const handleSend = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    // The store needs build/app metadata. We try to source from the
    // build-info module if it exists (Batch C); otherwise we fall back
    // to sensible MVP defaults so Batch B is usable on its own.
    const context = await buildSendContext({
      companion: companion.name,
      userMode,
      phase: currentPhase,
      dayInCycle,
    });

    const record = await sendFn(context);

    if (record) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setShowConfirmation(true);
    } else {
      // Validation failed — error is already in the store; useEffect
      // below renders it. Light shake feedback to draw the eye.
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
  };

  const handleClose = () => {
    resetDraft();
    setShowConfirmation(false);
    onClose();
  };

  // ─── Render ─────────────────────────────────────────────────────

  // Confirmation view (after successful send)
  if (showConfirmation) {
    const deliveryVia = lastDelivery?.kind === 'opened_composer' ? lastDelivery.via : 'mail';
    return (
      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.confirmationWrap, { opacity: confirmationOpacity }]}>
          <Text style={styles.confirmationEmoji}>{companion.emoji}</Text>
          <Text style={styles.confirmationTitle}>Thank you 💛</Text>
          <Text style={styles.confirmationBody}>
            {deliveryVia === 'mail'
              ? `Your email is open with your message. Tap Send when you're ready — it'll come straight to the Dottie team.`
              : `Pick where to share — your message is ready to go.`}
          </Text>
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              styles.confirmationButton,
              { backgroundColor: companion.accentColor },
              pressed && { opacity: 0.85 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <Text style={styles.confirmationButtonText}>Done</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // Main form view
  const canSend = draft.mood !== null && draft.message.trim().length > 0 && !isSending;
  const messageRemaining = FEEDBACK_MESSAGE_MAX - draft.message.length;
  const placeholder = buildPlaceholder(draft.mood);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Help Dottie grow 🌱</Text>
            <Text style={styles.headerSubtitle}>
              Tell us what's working — and what isn't.
            </Text>
          </View>
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && { opacity: 0.6 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Close feedback"
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Mood */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>How are you feeling about Dottie?</Text>
            <MoodRow
              value={draft.mood}
              onChange={handleSetMood}
              accent={companion.accentColor}
              disabled={isSending}
            />
          </View>

          {/* Message */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>What's on your mind?</Text>
            <View style={styles.textareaWrap}>
              <TextInput
                value={draft.message}
                onChangeText={handleSetMessage}
                placeholder={placeholder}
                placeholderTextColor={Colors.text.tertiary}
                multiline
                style={styles.textarea}
                maxLength={FEEDBACK_MESSAGE_MAX}
                editable={!isSending}
                accessibilityLabel="Your feedback message"
              />
            </View>
            <Text
              style={[
                styles.counter,
                messageRemaining < 100 && { color: Colors.semantic.warning },
              ]}
            >
              {messageRemaining} characters left
            </Text>
          </View>

          {/* Email (optional) */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              Your email <Text style={styles.optional}>(optional — if you'd like a reply)</Text>
            </Text>
            <TextInput
              value={draft.email ?? ''}
              onChangeText={handleSetEmail}
              placeholder="you@example.com"
              placeholderTextColor={Colors.text.tertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              editable={!isSending}
              accessibilityLabel="Your email address (optional)"
            />
          </View>

          {/* Validation error */}
          {validationError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{validationError}</Text>
            </View>
          ) : null}

          {/* Disclosure */}
          <Text style={styles.disclosure}>
            🔒 Your feedback opens your email app, addressed to the Dottie team.
            Nothing is sent to any other server — we never see what you don't choose to send.
          </Text>
        </ScrollView>

        {/* Sticky footer with CTA */}
        <View style={styles.footer}>
          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            style={({ pressed }) => [
              styles.sendButton,
              { backgroundColor: companion.accentColor },
              !canSend && styles.sendButtonDisabled,
              pressed && canSend && { opacity: 0.85, transform: [{ scale: 0.99 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Send feedback"
            accessibilityState={{ disabled: !canSend }}
          >
            {isSending ? (
              <ActivityIndicator color={Colors.text.inverse} />
            ) : (
              <Text style={styles.sendButtonText}>Send to Dottie team</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── MOOD ROW (uses local picker to avoid circular import) ───────────
//
// We import the local MoodPicker module at the bottom rather than the
// top to keep React Fast Refresh happy when these files are edited
// together. (Avoids a transient circular import during edits.)

import { MoodPicker } from './MoodPicker';

function MoodRow({
  value,
  onChange,
  accent,
  disabled,
}: {
  value: FeedbackMood | null;
  onChange: (mood: FeedbackMood) => void;
  accent: string;
  disabled: boolean;
}) {
  return <MoodPicker value={value} onChange={onChange} accentColor={accent} disabled={disabled} />;
}

// ─── HELPERS ─────────────────────────────────────────────────────────

/**
 * Pick a placeholder that matches the user's mood. Tiny touch, but
 * makes the form feel like it's listening.
 */
function buildPlaceholder(mood: FeedbackMood | null): string {
  switch (mood) {
    case 1:
      return 'What got in the way today? We really want to know.';
    case 2:
      return 'What would have made today better?';
    case 3:
      return 'What worked? What didn\'t?';
    case 4:
      return 'What did you love? Anything we should add?';
    case 5:
      return 'Tell us what made you smile 💛';
    default:
      return 'Anything you want to share — bugs, ideas, kind words 💛';
  }
}

/**
 * Assemble the SendContext payload, sourcing build/app version info
 * from the build-info constants if present (Batch C) or falling back
 * to safe MVP defaults.
 */
async function buildSendContext(args: {
  companion: string | null;
  userMode: string | null;
  phase: string | null;
  dayInCycle: number | null;
}): Promise<BetaFeedbackSendContext> {
  // Defaults that keep us shippable even before Batch C lands.
  let appVersion = '0.12.0';
  let buildNumber = '1';

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const buildInfo = require('../../constants/build-info');
    if (typeof buildInfo.APP_VERSION === 'string') appVersion = buildInfo.APP_VERSION;
    if (typeof buildInfo.BUILD_NUMBER === 'string') buildNumber = buildInfo.BUILD_NUMBER;
  } catch {
    // Batch C not shipped yet — that's fine, defaults above are valid.
  }

  return {
    appVersion,
    buildNumber,
    companion: args.companion,
    phase: args.phase,
    dayInCycle: args.dayInCycle,
    userMode: args.userMode,
  };
}

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface.background,
  },
  flex: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.base,
  },
  headerText: {
    flex: 1,
    paddingRight: Spacing.base,
  },
  headerTitle: {
    ...Typography.preset.h3,
    color: Colors.text.primary,
  },
  headerSubtitle: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: Spacing.radius.full,
    backgroundColor: Colors.surface.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: Colors.text.secondary,
    fontWeight: '500',
  },

  // Scroll content
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
  },

  // Sections
  section: {
    gap: Spacing.sm,
  },
  sectionLabel: {
    ...Typography.preset.bodySemibold,
    color: Colors.text.primary,
  },
  optional: {
    ...Typography.preset.body,
    color: Colors.text.tertiary,
    fontWeight: '400' as const,
  },

  // Inputs
  input: {
    backgroundColor: Colors.surface.card,
    borderRadius: Spacing.radius.lg,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    ...Typography.preset.body,
    color: Colors.text.primary,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  textareaWrap: {
    backgroundColor: Colors.surface.card,
    borderRadius: Spacing.radius.lg,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  textarea: {
    minHeight: 120,
    maxHeight: 200,
    padding: Spacing.base,
    ...Typography.preset.body,
    color: Colors.text.primary,
    textAlignVertical: 'top',
  },
  counter: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
    textAlign: 'right',
  },

  // Error
  errorBox: {
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
    borderRadius: Spacing.radius.lg,
    padding: Spacing.base,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.2)',
  },
  errorText: {
    ...Typography.preset.body,
    color: Colors.semantic.error,
  },

  // Disclosure
  disclosure: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
    lineHeight: 18,
  },

  // Footer
  footer: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.base,
    backgroundColor: Colors.surface.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  sendButton: {
    height: Spacing.buttonHeight.lg,
    borderRadius: Spacing.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendButtonText: {
    ...Typography.preset.button,
    color: Colors.text.inverse,
  },

  // Confirmation
  confirmationWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.screenPadding,
    gap: Spacing.base,
  },
  confirmationEmoji: {
    fontSize: 72,
    marginBottom: Spacing.sm,
  },
  confirmationTitle: {
    ...Typography.preset.h2,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  confirmationBody: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.base,
  },
  confirmationButton: {
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing.md,
    borderRadius: Spacing.radius.full,
    ...Shadows.button,
  },
  confirmationButtonText: {
    ...Typography.preset.button,
    color: Colors.text.inverse,
  },
});
