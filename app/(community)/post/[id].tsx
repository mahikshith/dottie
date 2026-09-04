import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { Typography } from '../../../src/constants/typography';
import { Spacing } from '../../../src/constants/spacing';
import { A } from '../../../src/theme';
import {
  GradientButton,
  PressableScale,
  PopOnChange,
  AuroraBackground,
} from '../../../src/components/ui';
import { showAppDialog } from '../../../src/components/ui/appDialog';
import {
  useCommunityStore,
  useUserStore,
  selectCompanionType,
  selectIsHugged,
  selectIsReported,
  selectRepliesForPost,
} from '../../../src/stores';
import {
  CommunityPost,
  CommunityReply,
  REPLY_BODY_MAX,
  REPLY_BODY_MIN,
  ReportReason,
  getSpaceById,
} from '../../../src/types/community.types';
import { getCompanion } from '../../../src/content/companions';
import { communityRepository } from '../../../src/database/repositories/community.repo';
import { logSilentFailure } from '../../../src/diagnostics/silent-failure';

/**
 * Post Detail Screen — Read a post + its replies, add your own reply,
 * send hugs, or report.
 *
 * ─── DATA FLOW ──────────────────────────────────────────────────────
 *
 *  - Post itself is fetched once on mount via communityRepository
 *    (not via store cache — we always want the latest reply count).
 *  - Replies are read via the store's repliesCache selector and
 *    refreshed on mount.
 *  - Hug + report state is read via per-target selectors so only the
 *    affected card re-renders.
 *
 * ─── SAFETY ─────────────────────────────────────────────────────────
 *
 *  - Report action surfaces a reason picker (no silent reports)
 *  - Self-report is allowed but pointless — UX doesn't show a special
 *    state to avoid teaching users to self-spam
 *  - 3+ reports → auto-hide → repository returns nowHidden=true →
 *    the store removes the post from caches → router.back() so the
 *    user isn't left staring at hidden content
 *
 * ─── PREMIUM POLISH PASS (Phase 2) ──────────────────────────────────
 *
 *  Presentation/animation only — zero logic, data, or copy changes.
 *   - Every tappable surface (post hug/report, reply hug/report, the
 *     composer mode chip) is now a <PressableScale> for the shared
 *     UI-thread spring-press. Buttons whose onPress already fires a
 *     Haptics.* call pass haptic="none" so there's no double-buzz;
 *     the report chips (no prior haptic) use a light 'selection' tap.
 *   - Both primary coral pills — the not-found "Back to The Circle"
 *     CTA and the composer "Reply" send button — become <GradientButton>
 *     (the send button forwards loading + disabled straight through, so
 *     the exact same enable/submit rules apply).
 *   - Hug counts (post + each reply) are wrapped in <PopOnChange> so the
 *     number gives a satisfying pop the instant a hug lands.
 *   - The post card, the replies header, and each reply enter with a
 *     staggered FadeInDown spring on mount (entering only — never refires
 *     on store updates).
 *   - Safe-area aware: this is a deep screen under a native Stack header
 *     (which owns the top inset), so the composer picks up the bottom
 *     inset to clear the home indicator.
 */

/** Staggered FadeInDown spring used for on-mount entrance of cards/rows. */
function rise(delay: number) {
  return FadeInDown.duration(480).delay(delay).springify().damping(16);
}

export default function PostDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserStore((s) => s.userId);
  const companionType = useUserStore(selectCompanionType);
  const companion = getCompanion(companionType);

  const [post, setPost] = useState<CommunityPost | null>(null);
  const [loadingPost, setLoadingPost] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [replyMode, setReplyMode] = useState<'named' | 'anonymous'>('named');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const replies = useCommunityStore(selectRepliesForPost(id ?? ''));
  const isPostHugged = useCommunityStore(selectIsHugged('post', id ?? ''));
  const isPostReported = useCommunityStore(selectIsReported('post', id ?? ''));

  // ─── Load post on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoadingPost(true);
      try {
        const fetched = await communityRepository.getPost(id);
        if (!cancelled) setPost(fetched);
      } catch (err) {
        logSilentFailure('postDetail.load', err);
      } finally {
        if (!cancelled) setLoadingPost(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // ─── Load replies on mount ──────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    useCommunityStore.getState().fetchReplies(id, true);
  }, [id]);

  // ─── Handlers ───────────────────────────────────────────────────

  const handleHugPost = useCallback(async () => {
    if (!id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const result = await useCommunityStore
      .getState()
      .toggleHug('post', id);
    // Reflect the new count locally on the post object
    setPost((prev) =>
      prev ? { ...prev, hugsCount: result.newCount } : prev
    );
  }, [id]);

  const handleHugReply = useCallback(async (replyId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await useCommunityStore.getState().toggleHug('reply', replyId);
  }, []);

  const handleReportPost = useCallback(() => {
    if (!id || isPostReported) return;
    promptReportReason((reason) => {
      submitReport('post', id, reason, () => {
        // If post was auto-hidden, kick back to feed
        showAppDialog({
          emoji: '💛',
          title: 'Thanks for keeping The Circle safe',
          body: 'Our team will review this post.',
          actions: [{ label: 'OK', onPress: () => router.back() }],
        });
      });
    });
  }, [id, isPostReported, router]);

  const handleReportReply = useCallback((replyId: string) => {
    promptReportReason((reason) => {
      submitReport('reply', replyId, reason);
    });
  }, []);

  const handleSubmitReply = async () => {
    if (!id) return;
    const trimmed = replyText.trim();
    if (trimmed.length < REPLY_BODY_MIN) return;

    setIsSubmittingReply(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    const result = await useCommunityStore.getState().createReply({
      postId: id,
      body: trimmed,
      mode: replyMode,
    });

    setIsSubmittingReply(false);

    if (!('ok' in result)) return;

    if (result.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {}
      );
      setReplyText('');
      // Bump the post's local reply counter to match the store cache bump
      setPost((prev) =>
        prev ? { ...prev, repliesCount: prev.repliesCount + 1 } : prev
      );
      return;
    }

    if ('moderation' in result) {
      showAppDialog({
        emoji: '💛',
        title: 'A gentle nudge',
        body:
          result.moderation.message ??
          "Something in that reply didn't pass our safety check. Could you give it another look? 💛",
        actions: [{ label: 'OK', onPress: () => {} }],
      });
      return;
    }

    showAppDialog({
      emoji: '😅',
      title: "Hmm, that didn't go through",
      body: result.message,
      actions: [{ label: 'OK', onPress: () => {} }],
    });
  };

  // ─── Render: loading / not found ────────────────────────────────

  if (loadingPost) {
    return (
      <AuroraBackground>
        <StatusBar style="light" />
        <View style={styles.centerScreen}>
          <Stack.Screen options={{ title: 'Post' }} />
          <ActivityIndicator color={A.accent} />
        </View>
      </AuroraBackground>
    );
  }

  if (!post) {
    return (
      <AuroraBackground>
        <StatusBar style="light" />
        <View style={styles.centerScreen}>
          <Stack.Screen options={{ title: 'Post' }} />
          <Text style={styles.notFoundEmoji}>🌸</Text>
          <Text style={styles.notFoundTitle}>This post isn't here</Text>
          <Text style={styles.notFoundBody}>
            It may have been removed or hidden for review.
          </Text>
          <GradientButton
            label="Back to The Circle"
            onPress={() => router.back()}
            style={{ marginTop: Spacing.md }}
          />
        </View>
      </AuroraBackground>
    );
  }

  const space = getSpaceById(post.spaceId);
  const isAnonymousPost = post.mode === 'anonymous';
  const snapshot = post.authorSnapshot;
  const isOwnPost = userId === post.authorUserId;

  return (
    <AuroraBackground>
      <StatusBar style="light" />
      <KeyboardAvoidingView
      style={styles.kav}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing['3xl'] }]}
        keyboardShouldPersistTaps="handled"
      >
        <Stack.Screen
          options={{
            title: space.title,
          }}
        />

        {/* Post header */}
        <Animated.View entering={rise(60)} style={styles.postCard}>
          <View style={styles.authorRow}>
            <Text style={styles.authorAvatar}>
              {isAnonymousPost ? snapshot.spiritEmoji ?? '🌸' : '💛'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.authorName}>
                {isAnonymousPost
                  ? snapshot.spiritAlias ?? 'Anonymous Friend'
                  : snapshot.displayName ?? 'A Dottie friend'}
              </Text>
              <Text style={styles.postMeta}>
                {space.emoji} {space.title} ·{' '}
                {formatRelativeTime(post.createdAt)}
              </Text>
            </View>
          </View>

          {isAnonymousPost && snapshot.credibility && (
            <View style={styles.credStrip}>
              <CredPill emoji="🔥" value={`${snapshot.credibility.streak}d`} />
              <CredPill
                emoji="✨"
                value={`${snapshot.credibility.xpTotal} xp`}
              />
              <CredPill
                emoji="🏅"
                value={`${snapshot.credibility.badgesCount}`}
              />
              <CredPill
                emoji="📅"
                value={formatMemberSince(snapshot.credibility.memberSince)}
              />
            </View>
          )}

          <Text style={styles.postBody}>{post.body}</Text>

          <View style={styles.actionRow}>
            <PressableScale
              onPress={handleHugPost}
              haptic="none"
              style={[
                styles.actionButton,
                isPostHugged && styles.actionButtonActive,
              ]}
              accessibilityRole="button"
              accessibilityLabel={isPostHugged ? 'Remove hug' : 'Send a hug'}
            >
              <Text style={styles.actionEmoji}>🤗</Text>
              <Text
                style={[
                  styles.actionLabel,
                  isPostHugged && styles.actionLabelActive,
                ]}
              >
                {isPostHugged ? 'Hugged' : 'Hug'} ·{' '}
              </Text>
              <PopOnChange value={post.hugsCount}>
                <Text
                  style={[
                    styles.actionLabel,
                    isPostHugged && styles.actionLabelActive,
                  ]}
                >
                  {post.hugsCount}
                </Text>
              </PopOnChange>
            </PressableScale>

            {!isOwnPost && (
              <PressableScale
                onPress={handleReportPost}
                disabled={isPostReported}
                style={[
                  styles.actionButton,
                  isPostReported && styles.actionButtonReported,
                ]}
                accessibilityRole="button"
                accessibilityLabel={isPostReported ? 'Reported' : 'Report post'}
              >
                <Text style={styles.actionEmoji}>🚩</Text>
                <Text style={styles.actionLabel}>
                  {isPostReported ? 'Reported' : 'Report'}
                </Text>
              </PressableScale>
            )}
          </View>
        </Animated.View>

        {/* Replies header */}
        <Animated.View entering={rise(140)} style={styles.repliesHeader}>
          <Text style={styles.repliesTitle}>
            {replies.length === 0
              ? 'Be the first to reply'
              : `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
          </Text>
          {replies.length === 0 && (
            <Text style={styles.repliesSubtitle}>
              {companion.name} thinks a kind word goes a long way. 💛
            </Text>
          )}
        </Animated.View>

        {/* Replies list */}
        {replies.map((reply, index) => (
          <Animated.View
            key={reply.id}
            entering={rise(200 + Math.min(index, 8) * 60)}
          >
            <ReplyCard
              reply={reply}
              currentUserId={userId}
              onHug={() => handleHugReply(reply.id)}
              onReport={() => handleReportReply(reply.id)}
            />
          </Animated.View>
        ))}

        <View style={{ height: Spacing['4xl'] }} />
      </ScrollView>

      {/* Reply composer (sticky bottom)
       *
       * Layout: mode chip in a small header row, then a wide input row with a
       * compact circular send button. The old single-row layout put the
       * big "Reply" GradientButton next to the input, which pushed the
       * placeholder off-screen and made the whole composer feel bulky —
       * user feedback: "reply is occupying too much space" + "'Share a kind
       * word' isn't trying to fit in the circle". */}
      <View
        style={[styles.composer, { paddingBottom: insets.bottom + Spacing.sm }]}
      >
        <View style={styles.composerHeader}>
          <PressableScale
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              setReplyMode(replyMode === 'named' ? 'anonymous' : 'named');
            }}
            haptic="none"
            scaleTo={0.94}
            style={[
              styles.composerModeChip,
              replyMode === 'anonymous' && styles.composerModeChipAnon,
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              replyMode === 'anonymous'
                ? 'Reply anonymously — tap for as yourself'
                : 'Reply as yourself — tap for anonymous'
            }
          >
            <Text style={styles.composerModeChipText}>
              {replyMode === 'anonymous' ? '🎭 Anonymous' : '💛 As yourself'}
            </Text>
          </PressableScale>
        </View>

        <View style={styles.composerRow}>
          <TextInput
            value={replyText}
            onChangeText={setReplyText}
            placeholder="Share a kind word..."
            placeholderTextColor={A.ink3}
            style={styles.composerInput}
            maxLength={REPLY_BODY_MAX + 100}
            multiline
          />

          <PressableScale
            onPress={handleSubmitReply}
            haptic="none"
            scaleTo={0.94}
            disabled={
              isSubmittingReply ||
              replyText.trim().length < REPLY_BODY_MIN ||
              replyText.trim().length > REPLY_BODY_MAX
            }
            style={[
              styles.composerSend,
              (isSubmittingReply ||
                replyText.trim().length < REPLY_BODY_MIN ||
                replyText.trim().length > REPLY_BODY_MAX) &&
                styles.composerSendDim,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Send reply"
          >
            {isSubmittingReply ? (
              <ActivityIndicator color={A.ground} />
            ) : (
              <Text style={styles.composerSendGlyph}>↑</Text>
            )}
          </PressableScale>
        </View>
      </View>
      </KeyboardAvoidingView>
    </AuroraBackground>
  );
}

// ─── REPLY CARD ──────────────────────────────────────────────────────

function ReplyCard({
  reply,
  currentUserId,
  onHug,
  onReport,
}: {
  reply: CommunityReply;
  currentUserId: string | null;
  onHug: () => void;
  onReport: () => void;
}) {
  const isHugged = useCommunityStore(selectIsHugged('reply', reply.id));
  const isReported = useCommunityStore(selectIsReported('reply', reply.id));
  const isOwn = currentUserId === reply.authorUserId;
  const isAnonymous = reply.mode === 'anonymous';
  const snapshot = reply.authorSnapshot;

  return (
    <View style={styles.replyCard}>
      <View style={styles.replyAuthorRow}>
        <Text style={styles.replyAvatar}>
          {isAnonymous ? snapshot.spiritEmoji ?? '🌸' : '💛'}
        </Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.replyAuthorName}>
            {isAnonymous
              ? snapshot.spiritAlias ?? 'Anonymous Friend'
              : snapshot.displayName ?? 'A Dottie friend'}
          </Text>
          <Text style={styles.replyTimestamp}>
            {formatRelativeTime(reply.createdAt)}
          </Text>
        </View>
      </View>

      <Text style={styles.replyBody}>{reply.body}</Text>

      <View style={styles.replyActions}>
        <PressableScale
          onPress={onHug}
          haptic="none"
          style={[styles.replyAction, isHugged && styles.replyActionActive]}
          accessibilityRole="button"
          accessibilityLabel={isHugged ? 'Remove hug' : 'Send a hug'}
        >
          <Text style={styles.replyActionEmoji}>🤗</Text>
          <PopOnChange value={reply.hugsCount}>
            <Text
              style={[
                styles.replyActionText,
                isHugged && styles.replyActionTextActive,
              ]}
            >
              {reply.hugsCount}
            </Text>
          </PopOnChange>
        </PressableScale>

        {!isOwn && (
          <PressableScale
            onPress={onReport}
            disabled={isReported}
            style={styles.replyAction}
            accessibilityRole="button"
            accessibilityLabel={isReported ? 'Reported' : 'Report reply'}
          >
            <Text style={styles.replyActionEmoji}>🚩</Text>
            <Text style={styles.replyActionText}>
              {isReported ? 'Reported' : 'Report'}
            </Text>
          </PressableScale>
        )}
      </View>
    </View>
  );
}

// ─── CREDIBILITY PILL ────────────────────────────────────────────────

function CredPill({ emoji, value }: { emoji: string; value: string }) {
  return (
    <View style={styles.credPill}>
      <Text style={styles.credPillEmoji}>{emoji}</Text>
      <Text style={styles.credPillValue}>{value}</Text>
    </View>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────

function promptReportReason(onPick: (reason: ReportReason) => void) {
  showAppDialog({
    emoji: '🚩',
    title: 'Report this content',
    body: 'What would you like to flag this for?',
    actions: [
      { label: 'Sharing medical advice', variant: 'ghost', onPress: () => onPick('medical_advice') },
      { label: 'Personal info shared', variant: 'ghost', onPress: () => onPick('personal_info') },
      { label: 'Bullying or harassment', variant: 'ghost', onPress: () => onPick('bullying_harassment') },
      { label: 'Self-harm content', variant: 'ghost', onPress: () => onPick('pro_ana_self_harm') },
      { label: 'Spam', variant: 'ghost', onPress: () => onPick('spam') },
      { label: 'Something else', variant: 'ghost', onPress: () => onPick('other') },
      { label: 'Cancel', variant: 'ghost', onPress: () => {} },
    ],
  });
}

async function submitReport(
  targetType: 'post' | 'reply',
  targetId: string,
  reason: ReportReason,
  onHidden?: () => void
) {
  const result = await useCommunityStore.getState().submitReport({
    targetType,
    targetId,
    reason,
  });
  if (result.nowHidden && onHidden) {
    onHidden();
    return;
  }
  if (result.submitted) {
    showAppDialog({
      emoji: '💛',
      title: 'Thanks for keeping The Circle safe',
      body: 'We appreciate you looking out for everyone.',
      actions: [{ label: 'OK', onPress: () => {} }],
    });
  }
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.max(1, Math.floor((now - then) / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatMemberSince(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
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
  centerScreen: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  notFoundEmoji: { fontSize: 64 },
  notFoundTitle: {
    ...Typography.preset.h3,
    color: A.ink,
  },
  notFoundBody: {
    ...Typography.preset.body,
    color: A.ink2,
    textAlign: 'center',
  },
  // Post card
  postCard: {
    backgroundColor: A.glass, borderColor: A.edge, borderWidth: 1,
    padding: Spacing.cardPaddingLarge,
    borderRadius: Spacing.radius['2xl'],
    marginBottom: Spacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 22, elevation: 6,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  authorAvatar: {
    fontSize: 36,
    marginRight: Spacing.md,
  },
  authorName: {
    ...Typography.preset.bodySemibold,
    color: A.ink,
  },
  postMeta: {
    ...Typography.preset.caption,
    color: A.ink3,
    marginTop: 2,
  },
  credStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  credPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: A.glass2, borderColor: A.edge, borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Spacing.radius.full,
  },
  credPillEmoji: {
    fontSize: 11,
    marginRight: 4,
  },
  credPillValue: {
    ...Typography.preset.caption,
    fontSize: 11,
    color: A.ink2,
  },
  postBody: {
    ...Typography.preset.bodyLarge,
    color: A.ink,
    lineHeight: 26,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Spacing.radius.full,
    backgroundColor: A.glass,
    borderWidth: 1,
    borderColor: A.edge,
  },
  actionButtonActive: {
    backgroundColor: `${A.accent}22`,
    borderColor: A.accent,
  },
  actionButtonReported: {
    opacity: 0.5,
  },
  actionEmoji: {
    fontSize: 16,
    marginRight: Spacing.xs,
  },
  actionLabel: {
    ...Typography.preset.captionBold,
    color: A.ink2,
  },
  actionLabelActive: {
    color: A.accent,
  },
  // Replies
  repliesHeader: {
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  repliesTitle: {
    ...Typography.preset.h4,
    color: A.ink,
  },
  repliesSubtitle: {
    ...Typography.preset.caption,
    color: A.ink3,
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  replyCard: {
    backgroundColor: A.glass, borderColor: A.edge, borderWidth: 1,
    padding: Spacing.cardPadding,
    borderRadius: Spacing.radius.xl,
    marginBottom: Spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  replyAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  replyAvatar: {
    fontSize: 24,
    marginRight: Spacing.sm,
  },
  replyAuthorName: {
    ...Typography.preset.captionBold,
    color: A.ink,
  },
  replyTimestamp: {
    ...Typography.preset.caption,
    fontSize: 11,
    color: A.ink3,
  },
  replyBody: {
    ...Typography.preset.body,
    color: A.ink,
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  replyActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  replyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: 4,
  },
  replyActionActive: {
    // visual only via text color
  },
  replyActionEmoji: { fontSize: 14 },
  replyActionText: {
    ...Typography.preset.caption,
    color: A.ink3,
  },
  replyActionTextActive: {
    color: A.accent,
  },
  // Composer (sticky bottom) — stacked: [mode chip row] over [input + send]
  composer: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.sm,
    backgroundColor: A.glass2,
    borderTopWidth: 1,
    borderTopColor: A.edge,
    gap: Spacing.xs,
  },
  composerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  composerModeChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    backgroundColor: A.glass,
    borderWidth: 1,
    borderColor: A.edge,
    borderRadius: Spacing.radius.full,
    alignSelf: 'flex-start',
  },
  composerModeChipAnon: {
    backgroundColor: `${A.accent2}22`,
    borderColor: A.accent2,
  },
  composerModeChipText: {
    ...Typography.preset.caption,
    color: A.ink2,
    fontWeight: '600',
    fontSize: 11,
  },
  composerInput: {
    flex: 1,
    ...Typography.preset.body,
    color: A.ink,
    backgroundColor: A.glass,
    borderRadius: Spacing.radius.xl,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: A.edge,
  },
  // Compact circular send — tucks next to the input so the placeholder gets
  // the full row width. Was a full-size GradientButton pill.
  composerSend: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: A.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  composerSendDim: {
    opacity: 0.45,
  },
  composerSendGlyph: {
    fontSize: 22,
    lineHeight: 24,
    color: A.ground,
    fontWeight: '800',
    // Tiny upward baseline nudge so the arrow sits visually centered.
    marginTop: -2,
  },
});