import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { GradientButton, PressableScale, AuroraBackground } from '../../src/components/ui';
import { A } from '../../src/theme';
import {
  useCommunityStore,
  useUserStore,
  selectCompanionType,
  selectIsCreatingPost,
} from '../../src/stores';
import {
  COMMUNITY_SPACES,
  CommunitySpace,
  POST_BODY_MAX,
  POST_BODY_MIN,
  PostingMode,
  SpaceId,
  getSpaceById,
  getTeenSafeSpaces,
} from '../../src/types/community.types';
import { getCompanion } from '../../src/content/companions';
import { moderateContent } from '../../src/engine/community/moderation';

/**
 * New Post Screen — Compose & share with The Circle.
 *
 * ─── FLOW ───────────────────────────────────────────────────────────
 *
 *  1. User opens via "+" FAB or empty-state CTA
 *  2. (Optional) ?space=<id> route param pre-selects a space
 *  3. User picks a space, types their post
 *  4. User toggles anonymous mode if they want
 *  5. Live moderation preview shows BEFORE submit (no surprise blocks)
 *  6. Submit → store.createPost → optimistic feed update → router.back
 *
 * ─── SAFETY ─────────────────────────────────────────────────────────
 *
 *  Moderation runs on every keystroke (debounced visually via length
 *  checks) so the user sees a warm warning as soon as they type
 *  something we'll block. Better than silent failure on submit.
 *
 *  We also enforce min/max length client-side so the submit button
 *  stays disabled until the post is shareable.
 *
 * ─── TEEN MODE ──────────────────────────────────────────────────────
 *
 *  Teen-mode users only see teenSafe spaces in the picker. The store
 *  doesn't enforce this — it trusts the UI — because if a teen user's
 *  app updates after we mark a space teenSafe=false, we want existing
 *  drafts they had to still work. Defense in depth, not defense in
 *  exclusion.
 *
 * ─── PREMIUM POLISH PASS (Phase 2) ──────────────────────────────────
 *
 *  Presentation-only pass — zero logic/handler/validation changes.
 *   • Safe-area: scroll content top padding is now insets.top +
 *     Spacing.lg (was a fixed Spacing.base) so the composer clears the
 *     notch/status bar on any device instead of hugging it.
 *   • Entrance motion: each top-level section rises in with a staggered
 *     FadeInDown spring (mount-only — never refires on store/typing
 *     updates), giving the form a crafted "assemble" feel.
 *   • Shared tap primitives: space chips and the anonymous toggle now
 *     use <PressableScale> (UI-thread spring squish). Both already fire
 *     their own Haptics.selectionAsync, so they pass haptic="none" to
 *     avoid a double buzz.
 *   • CTA upgrade: the flat coral "Share" button is now the premium
 *     <GradientButton loading={isSubmitting}>, wired to the SAME
 *     handleSubmit + canSubmit gate. handleSubmit fires its own medium
 *     haptic, so the button passes haptic="none".
 *  Reduce-Motion is honored inside the primitives.
 */

// Staggered entrance: mount-only, so it never refires on store/typing updates.
function rise(delay: number): ReturnType<typeof FadeInDown.duration> {
  return FadeInDown.duration(480).delay(delay).springify().damping(16);
}

export default function NewPostScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ space?: string }>();
  const userMode = useUserStore((s) => s.user?.mode ?? 'adult');
  const companionType = useUserStore(selectCompanionType);
  const companion = getCompanion(companionType);
  const isSubmitting = useCommunityStore(selectIsCreatingPost);

  // ─── Space picker ───────────────────────────────────────────────
  const availableSpaces = useMemo<CommunitySpace[]>(
    () => (userMode === 'teen' ? getTeenSafeSpaces() : COMMUNITY_SPACES),
    [userMode]
  );

  // Default to pre-selected space (if valid) or first available
  const initialSpace: SpaceId = useMemo(() => {
    const candidate = params.space as SpaceId | undefined;
    if (candidate && availableSpaces.some((s) => s.id === candidate)) {
      return candidate;
    }
    return availableSpaces[0]?.id ?? 'general_support';
  }, [params.space, availableSpaces]);

  const [spaceId, setSpaceId] = useState<SpaceId>(initialSpace);
  const [body, setBody] = useState('');
  const [mode, setMode] = useState<PostingMode>('named');

  const space = getSpaceById(spaceId);
  const trimmed = body.trim();

  // ─── Live moderation preview ────────────────────────────────────
  const moderation = useMemo(() => {
    if (trimmed.length < POST_BODY_MIN) return null;
    return moderateContent(trimmed);
  }, [trimmed]);

  const tooShort = trimmed.length > 0 && trimmed.length < POST_BODY_MIN;
  const tooLong = trimmed.length > POST_BODY_MAX;
  const moderationBlocked = moderation !== null && !moderation.ok;

  const canSubmit =
    !isSubmitting &&
    trimmed.length >= POST_BODY_MIN &&
    !tooLong &&
    !moderationBlocked;

  // ─── Sync mode picker if the active space changes ───────────────
  useEffect(() => {
    if (!availableSpaces.some((s) => s.id === spaceId)) {
      setSpaceId(availableSpaces[0]?.id ?? 'general_support');
    }
  }, [availableSpaces, spaceId]);

  // ─── Handlers ───────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!canSubmit) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const result = await useCommunityStore.getState().createPost({
      spaceId,
      body: trimmed,
      mode,
    });

    if (!('ok' in result)) return;

    if (result.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );
      Alert.alert(
        'Thanks for sharing 💛',
        `${companion.name} added your post to The Circle. +${result.xpAwarded} XP · +${result.gemsAwarded}💎`,
        [{ text: 'Yay!', onPress: () => router.back() }]
      );
      return;
    }

    // Failure paths
    if ('moderation' in result) {
      Alert.alert(
        'A gentle nudge',
        result.moderation.message ??
          "Something in that post didn't pass our safety check. Could you give it another look? 💛"
      );
      return;
    }

    Alert.alert("Hmm, that didn't go through", result.message);
  };

  const handleCancel = () => {
    if (trimmed.length === 0) {
      router.back();
      return;
    }
    Alert.alert(
      'Discard this draft?',
      'Your post will be lost.',
      [
        { text: 'Keep writing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => router.back(),
        },
      ]
    );
  };

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <AuroraBackground>
      <StatusBar style="light" />
      <KeyboardAvoidingView
      style={styles.kav}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Companion intro */}
        <Animated.View entering={rise(0)} style={styles.companionRow}>
          <Text style={styles.companionEmoji}>{companion.emoji}</Text>
          <Text style={styles.companionText}>
            {companion.name} is glad you're sharing. Take your time. 💛
          </Text>
        </Animated.View>

        {/* Space picker */}
        <Animated.View entering={rise(80)}>
          <Text style={styles.label}>Where would you like to share?</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.spaceRow}
            style={styles.spaceScroll}
          >
            {availableSpaces.map((s) => (
              <SpaceChip
                key={s.id}
                space={s}
                active={s.id === spaceId}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setSpaceId(s.id);
                }}
              />
            ))}
          </ScrollView>
        </Animated.View>

        {/* Space hint */}
        <Animated.View entering={rise(160)} style={styles.hintCard}>
          <Text style={styles.hintEmoji}>{space.emoji}</Text>
          <Text style={styles.hintText}>{space.postingHint}</Text>
        </Animated.View>

        {/* Body input */}
        <Animated.View entering={rise(240)}>
        <Text style={styles.label}>What would you like to say?</Text>
        <View style={styles.inputCard}>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Share a thought, a question, or just a feeling..."
            placeholderTextColor={A.ink3}
            multiline
            style={styles.input}
            maxLength={POST_BODY_MAX + 200}
            textAlignVertical="top"
          />
          <View style={styles.inputFooter}>
            <Text
              style={[
                styles.counter,
                tooLong && { color: A.error },
              ]}
            >
              {trimmed.length} / {POST_BODY_MAX}
            </Text>
          </View>
        </View>
        </Animated.View>

        {/* Length feedback */}
        {tooShort && (
          <Text style={styles.helperText}>
            A few more words? Posts need at least {POST_BODY_MIN} characters. 💛
          </Text>
        )}
        {tooLong && (
          <Text style={[styles.helperText, { color: A.error }]}>
            That's a lot to share — could you trim to {POST_BODY_MAX} characters?
          </Text>
        )}

        {/* Moderation preview */}
        {moderationBlocked && moderation && (
          <View style={styles.moderationCard}>
            <Text style={styles.moderationEmoji}>🌸</Text>
            <Text style={styles.moderationText}>{moderation.message}</Text>
          </View>
        )}

        {/* Anonymous toggle */}
        <Animated.View entering={rise(320)}>
        <PressableScale
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setMode(mode === 'named' ? 'anonymous' : 'named');
          }}
          haptic="none"
          scaleTo={0.985}
          style={styles.anonymousRow}
          accessibilityRole="switch"
          accessibilityState={{ checked: mode === 'anonymous' }}
        >
          <View style={styles.anonymousTextWrap}>
            <Text style={styles.anonymousTitle}>
              {mode === 'anonymous'
                ? 'Posting anonymously 🎭'
                : 'Posting as yourself 💛'}
            </Text>
            <Text style={styles.anonymousHint}>
              {mode === 'anonymous'
                ? 'Your name is hidden. People still see your streak, points, and badges so they know you\'re a real Dottie friend.'
                : 'Your name and companion show on this post. Tap to go anonymous instead.'}
            </Text>
          </View>
          <View
            style={[
              styles.toggleTrack,
              mode === 'anonymous' && styles.toggleTrackActive,
            ]}
          >
            <View
              style={[
                styles.toggleThumb,
                mode === 'anonymous' && styles.toggleThumbActive,
              ]}
            />
          </View>
        </PressableScale>
        </Animated.View>

        {/* Submit / cancel */}
        <Animated.View entering={rise(400)} style={styles.actions}>
          <PressableScale
            onPress={handleCancel}
            haptic="light"
            scaleTo={0.97}
            style={styles.cancelButton}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </PressableScale>
          <GradientButton
            label="Share"
            onPress={handleSubmit}
            disabled={!canSubmit}
            loading={isSubmitting}
            haptic="none"
            style={styles.submitFlex}
            accessibilityHint="Shares your post with The Circle"
          />
        </Animated.View>

        <View style={{ height: Spacing['4xl'] }} />
      </ScrollView>
      </KeyboardAvoidingView>
    </AuroraBackground>
  );
}

// ─── SPACE CHIP ──────────────────────────────────────────────────────

function SpaceChip({
  space,
  active,
  onPress,
}: {
  space: CommunitySpace;
  active: boolean;
  onPress: () => void;
}): JSX.Element {
  return (
    <PressableScale
      onPress={onPress}
      haptic="none"
      scaleTo={0.94}
      style={[styles.spaceChip, active && styles.spaceChipActive]}
      accessibilityRole="button"
      accessibilityLabel={`Share in ${space.title}`}
      accessibilityState={{ selected: active }}
    >
      <Text style={styles.spaceChipEmoji}>{space.emoji}</Text>
      <Text
        style={[
          styles.spaceChipLabel,
          active && styles.spaceChipLabelActive,
        ]}
        numberOfLines={1}
      >
        {space.title}
      </Text>
    </PressableScale>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  kav: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.base,
  },
  companionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: A.glass, borderColor: A.edge, borderWidth: 1,
    padding: Spacing.md,
    borderRadius: Spacing.radius.xl,
    marginBottom: Spacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  companionEmoji: {
    fontSize: 28,
    marginRight: Spacing.md,
  },
  companionText: {
    ...Typography.preset.body,
    color: A.ink2,
    flex: 1,
    lineHeight: 22,
  },
  label: {
    ...Typography.preset.captionBold,
    color: A.ink2,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  spaceScroll: {
    flexGrow: 0,
    marginBottom: Spacing.md,
  },
  spaceRow: {
    gap: Spacing.sm,
  },
  spaceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: A.glass, borderColor: A.edge, borderWidth: 1,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Spacing.radius.full,  },
  spaceChipActive: {
    backgroundColor: A.accent,
    borderColor: A.accent,
  },
  spaceChipEmoji: {
    fontSize: 14,
    marginRight: Spacing.xs,
  },
  spaceChipLabel: {
    ...Typography.preset.captionBold,
    color: A.ink2,
  },
  spaceChipLabelActive: {
    color: A.ground,
  },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: A.glass2, borderColor: A.edge, borderWidth: 1,
    padding: Spacing.md,
    borderRadius: Spacing.radius.lg,
    marginBottom: Spacing.lg,
  },
  hintEmoji: {
    fontSize: 20,
    marginRight: Spacing.sm,
  },
  hintText: {
    ...Typography.preset.caption,
    color: A.ink2,
    flex: 1,
    fontStyle: 'italic',
  },
  inputCard: {
    backgroundColor: A.glass, borderColor: A.edge, borderWidth: 1,
    borderRadius: Spacing.radius.xl,
    padding: Spacing.md,
    minHeight: 180,    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  input: {
    ...Typography.preset.body,
    color: A.ink,
    minHeight: 140,
    lineHeight: 22,
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Spacing.xs,
  },
  counter: {
    ...Typography.preset.caption,
    color: A.ink3,
  },
  helperText: {
    ...Typography.preset.caption,
    color: A.ink2,
    marginTop: Spacing.sm,
  },
  moderationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF1E8',
    padding: Spacing.md,
    borderRadius: Spacing.radius.lg,
    borderLeftWidth: 3,
    borderLeftColor: A.accent,
    marginTop: Spacing.md,
  },
  moderationEmoji: {
    fontSize: 20,
    marginRight: Spacing.sm,
  },
  moderationText: {
    ...Typography.preset.body,
    color: A.ink,
    flex: 1,
    lineHeight: 20,
  },
  anonymousRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: A.glass, borderColor: A.edge, borderWidth: 1,
    padding: Spacing.md,
    borderRadius: Spacing.radius.xl,
    marginTop: Spacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  anonymousTextWrap: {
    flex: 1,
    marginRight: Spacing.md,
  },
  anonymousTitle: {
    ...Typography.preset.bodySemibold,
    color: A.ink,
    marginBottom: 2,
  },
  anonymousHint: {
    ...Typography.preset.caption,
    color: A.ink3,
    lineHeight: 16,
  },
  toggleTrack: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: A.edge,
    padding: 2,
    justifyContent: 'center',
  },
  toggleTrackActive: {
    backgroundColor: A.accent,
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: A.glass, borderColor: A.edge, borderWidth: 1,
  },
  toggleThumbActive: {
    transform: [{ translateX: 18 }],
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  cancelButton: {
    flex: 1,
    height: Spacing.buttonHeight.lg,
    borderRadius: Spacing.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: A.glass, borderColor: A.edge, borderWidth: 1,  },
  cancelButtonText: {
    ...Typography.preset.button,
    color: A.ink2,
  },
  // GradientButton owns its own height/background/shadow — we only feed
  // it the flex ratio so it keeps the original 2:1 split with Cancel.
  submitFlex: {
    flex: 2,
  },
});