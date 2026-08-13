import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { Shadows } from '../../src/constants/shadows';
import { GradientButton, GradientFab, PressableScale } from '../../src/components/ui';
import {
  useCommunityStore,
  useUserStore,
  useGamificationStore,
  selectCompanionType,
  selectFeedForSpace,
  selectIsFetchingFeed,
} from '../../src/stores';
import {
  COMMUNITY_SPACES,
  CommunityPost,
  CommunitySpace,
  SpaceId,
  getSpaceById,
  getTeenSafeSpaces,
} from '../../src/types/community.types';
import { getCompanion } from '../../src/content/companions';

/**
 * Community Tab — "The Circle"
 *
 * ─── WHAT THIS SCREEN DOES ──────────────────────────────────────────
 *
 *  - Space filter chips ('All' + each space; Teen Mode hides adult spaces)
 *  - Feed list (latest posts in the active space)
 *  - Pull-to-refresh
 *  - Empty state that's warm and encouraging, not stark
 *  - Floating "+" action that opens the new-post modal
 *
 * ─── DATA FLOW ──────────────────────────────────────────────────────
 *
 *  - On focus: ensureSeeded() runs once (idempotent) so first-time
 *    users see content instead of an empty void.
 *  - fetchFeed(activeSpace) populates the cache for instant subsequent
 *    renders. The selector reads directly from cache for zero-latency
 *    redraws.
 *  - Pull-to-refresh forces a re-fetch.
 *
 * ─── PERF ───────────────────────────────────────────────────────────
 *
 *  Feed renders directly from the per-space cache via selector — tab
 *  switches feel instant because the cache survives navigation.
 */

type FilterKey = SpaceId | 'all';

export default function CommunityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // ─── Store reads ────────────────────────────────────────────────
  const userMode = useUserStore((s) => s.user?.mode ?? 'adult');
  const companionType = useUserStore(selectCompanionType);
  const isFetching = useCommunityStore(selectIsFetchingFeed);

  // Active space filter — defaults to 'all'
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ─── Teen Mode space filtering ──────────────────────────────────
  const visibleSpaces = useMemo<CommunitySpace[]>(() => {
    return userMode === 'teen' ? getTeenSafeSpaces() : COMMUNITY_SPACES;
  }, [userMode]);

  // Read feed from cache via selector (re-renders only on relevant change)
  const feed = useCommunityStore(selectFeedForSpace(activeFilter));

  const companion = getCompanion(companionType);

  // ─── Seed + initial fetch on focus ──────────────────────────────
  useFocusEffect(
    useCallback(() => {
      const store = useCommunityStore.getState();
      (async () => {
        await store.ensureSeeded();
        await store.fetchFeed(activeFilter);
      })();
    }, [activeFilter])
  );

  // ─── Refetch when filter changes (cache-aware) ──────────────────
  useEffect(() => {
    useCommunityStore.getState().fetchFeed(activeFilter);
  }, [activeFilter]);

  // ─── Handlers ───────────────────────────────────────────────────

  const handleFilterTap = (key: FilterKey) => {
    Haptics.selectionAsync().catch(() => {});
    setActiveFilter(key);
  };

  const handleNewPost = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // Pre-select the active space if user picked one (skip 'all')
    const spaceParam = activeFilter === 'all' ? '' : `?space=${activeFilter}`;
    router.push(`/(community)/new-post${spaceParam}`);
  };

  const handlePostTap = (postId: string) => {
    Haptics.selectionAsync().catch(() => {});
    router.push(`/(community)/post/${postId}`);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await useCommunityStore.getState().fetchFeed(activeFilter, true);
    setIsRefreshing(false);
  };

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View
        entering={FadeInDown.duration(500).delay(40).springify().damping(16)}
        style={[styles.header, { paddingTop: insets.top + Spacing.md }]}
      >
        <Text style={styles.headerTitle}>The Circle</Text>
        <Text style={styles.headerSubtitle}>
          A safe space to share, ask, and support. 💛
        </Text>
      </Animated.View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        style={styles.filterScrollContainer}
      >
        <FilterChip
          label="All"
          emoji="✨"
          active={activeFilter === 'all'}
          onPress={() => handleFilterTap('all')}
        />
        {visibleSpaces.map((space) => (
          <FilterChip
            key={space.id}
            label={space.title}
            emoji={space.emoji}
            active={activeFilter === space.id}
            onPress={() => handleFilterTap(space.id)}
          />
        ))}
      </ScrollView>

      {/* Feed */}
      <ScrollView
        style={styles.feed}
        contentContainerStyle={styles.feedContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary.coral}
            colors={[Colors.primary.coral]}
          />
        }
      >
        {isFetching && feed.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={Colors.primary.coral} />
            <Text style={styles.loadingText}>
              {companion.name} is gathering the feed...
            </Text>
          </View>
        ) : feed.length === 0 ? (
          <EmptyState
            companionEmoji={companion.emoji}
            companionName={companion.name}
            onShare={handleNewPost}
          />
        ) : (
          feed.map((post, index) => (
            <Animated.View
              key={post.id}
              entering={FadeInDown.duration(420)
                .delay(Math.min(index, 8) * 55)
                .springify()
                .damping(16)}
            >
              <PostCard post={post} onPress={() => handlePostTap(post.id)} />
            </Animated.View>
          ))
        )}

        <View style={{ height: Spacing['4xl'] }} />
      </ScrollView>

      {/* Floating "+" action — shared premium gradient FAB */}
      <GradientFab
        onPress={handleNewPost}
        bottom={Spacing.tabBarHeight + Spacing.base}
        accessibilityLabel="Share something with the Circle"
      />
    </View>
  );
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────

function FilterChip({
  label,
  emoji,
  active,
  onPress,
}: {
  label: string;
  emoji: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      haptic="none"
      scaleTo={0.94}
      style={[styles.filterChip, active && styles.filterChipActive]}
      accessibilityRole="button"
      accessibilityLabel={`Filter: ${label}`}
      accessibilityState={{ selected: active }}
    >
      <Text style={styles.filterChipEmoji}>{emoji}</Text>
      <Text
        style={[styles.filterChipLabel, active && styles.filterChipLabelActive]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

function PostCard({
  post,
  onPress,
}: {
  post: CommunityPost;
  onPress: () => void;
}) {
  const space = getSpaceById(post.spaceId);
  const isAnonymous = post.mode === 'anonymous';
  const snapshot = post.authorSnapshot;

  return (
    <PressableScale
      onPress={onPress}
      haptic="none"
      scaleTo={0.985}
      style={styles.postCard}
      accessibilityRole="button"
    >
      {/* Author row */}
      <View style={styles.postAuthorRow}>
        <Text style={styles.postAuthorAvatar}>
          {isAnonymous ? snapshot.spiritEmoji ?? '🌸' : '💛'}
        </Text>
        <View style={styles.postAuthorMeta}>
          <Text style={styles.postAuthorName}>
            {isAnonymous
              ? snapshot.spiritAlias ?? 'Anonymous Friend'
              : snapshot.displayName ?? 'A Dottie friend'}
          </Text>
          <Text style={styles.postSpaceTag}>
            {space.emoji} {space.title} · {formatRelativeTime(post.createdAt)}
          </Text>
        </View>
      </View>

      {/* Anonymous credibility strip */}
      {isAnonymous && snapshot.credibility && (
        <CredibilityStrip credibility={snapshot.credibility} />
      )}

      {/* Body */}
      <Text style={styles.postBody} numberOfLines={6}>
        {post.body}
      </Text>

      {/* Action footer */}
      <View style={styles.postFooter}>
        <View style={styles.postFooterItem}>
          <Text style={styles.postFooterEmoji}>🤗</Text>
          <Text style={styles.postFooterCount}>{post.hugsCount}</Text>
        </View>
        <View style={styles.postFooterItem}>
          <Text style={styles.postFooterEmoji}>💬</Text>
          <Text style={styles.postFooterCount}>{post.repliesCount}</Text>
        </View>
      </View>
    </PressableScale>
  );
}

function CredibilityStrip({
  credibility,
}: {
  credibility: NonNullable<CommunityPost['authorSnapshot']['credibility']>;
}) {
  return (
    <View style={styles.credibilityStrip}>
      <CredibilityPill emoji="🔥" value={`${credibility.streak}d`} />
      <CredibilityPill emoji="✨" value={`${credibility.xpTotal} xp`} />
      <CredibilityPill emoji="🏅" value={`${credibility.badgesCount}`} />
      <CredibilityPill
        emoji="📅"
        value={formatMemberSince(credibility.memberSince)}
      />
    </View>
  );
}

function CredibilityPill({ emoji, value }: { emoji: string; value: string }) {
  return (
    <View style={styles.credPill}>
      <Text style={styles.credPillEmoji}>{emoji}</Text>
      <Text style={styles.credPillValue}>{value}</Text>
    </View>
  );
}

function EmptyState({
  companionEmoji,
  companionName,
  onShare,
}: {
  companionEmoji: string;
  companionName: string;
  onShare: () => void;
}) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>{companionEmoji}</Text>
      <Text style={styles.emptyTitle}>It's quiet here right now</Text>
      <Text style={styles.emptyBody}>
        {companionName} would love to see the first share in this space.{'\n'}
        Be the kind voice someone else needs today. 💛
      </Text>
      <GradientButton
        label="Share something"
        onPress={onShare}
        style={{ marginTop: Spacing.md }}
        accessibilityHint="Opens the new post composer"
      />
    </View>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────

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

// Touch unused selector import so future refactors keep barrel intact
void useGamificationStore;

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface.background,
  },
  header: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing['5xl'],
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    ...Typography.preset.h2,
    color: Colors.text.primary,
  },
  headerSubtitle: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
    marginTop: Spacing.xs,
  },
  filterScrollContainer: {
    flexGrow: 0,
    paddingBottom: Spacing.md,
  },
  filterRow: {
    paddingHorizontal: Spacing.screenPadding,
    gap: Spacing.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.card,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Spacing.radius.full,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  filterChipActive: {
    backgroundColor: Colors.primary.coral,
    borderColor: Colors.primary.coral,
  },
  filterChipEmoji: {
    fontSize: 14,
    marginRight: Spacing.xs,
  },
  filterChipLabel: {
    ...Typography.preset.captionBold,
    color: Colors.text.secondary,
  },
  filterChipLabelActive: {
    color: Colors.text.inverse,
  },
  feed: {
    flex: 1,
  },
  feedContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.sm,
    gap: Spacing.base,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: Spacing['3xl'],
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
  },
  // Post card
  postCard: {
    backgroundColor: Colors.surface.card,
    padding: Spacing.cardPaddingLarge,
    borderRadius: Spacing.radius['2xl'],
    ...Shadows.card,
  },
  postAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  postAuthorAvatar: {
    fontSize: 32,
    marginRight: Spacing.md,
  },
  postAuthorMeta: {
    flex: 1,
  },
  postAuthorName: {
    ...Typography.preset.bodySemibold,
    color: Colors.text.primary,
  },
  postSpaceTag: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  // Credibility strip
  credibilityStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  credPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.cardElevated,
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
    color: Colors.text.secondary,
  },
  // Body & footer
  postBody: {
    ...Typography.preset.body,
    color: Colors.text.primary,
    lineHeight: 22,
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  postFooterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  postFooterEmoji: {
    fontSize: 16,
  },
  postFooterCount: {
    ...Typography.preset.captionBold,
    color: Colors.text.secondary,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    padding: Spacing['3xl'],
    gap: Spacing.md,
  },
  emptyEmoji: {
    fontSize: 64,
  },
  emptyTitle: {
    ...Typography.preset.h4,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  emptyBody: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Empty-state CTA + FAB are now the shared GradientButton / GradientFab
  // primitives, so their bespoke styles were removed.
});