/**
 * Community Tab — "The Circle" — MOOD AURORA THEME (design-v2)
 *
 * Re-skinned onto the aurora world: luminous dark ground, glass post cards,
 * glass filter chips (active = accent), palette ink throughout. The warm shared
 * CTA / FAB (GradientButton / GradientFab) stay as the coral pop of action.
 *
 * ─── WHAT CHANGED IN THIS PASS ──────────────────────────────────────
 *
 *  Presentation only. Seeding, feed fetch/cache, Teen-Mode space filtering,
 *  pull-to-refresh, navigation, and every copy string are unchanged. Colours
 *  moved to the palette (inline); the StyleSheet is layout only:
 *   - Outer container is <AuroraBackground>; StatusBar flipped to light.
 *   - Filter chips: inactive = glass, active = accent fill with ground ink.
 *   - Post cards + credibility pills are glass surfaces; refresh/spinner tint
 *     is the palette accent.
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { GradientButton, GradientFab, PressableScale, AuroraBackground } from '../../src/components/ui';
import { useAurora } from '../../src/theme';
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

type FilterKey = SpaceId | 'all';

export default function CommunityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useAurora();

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
    <AuroraBackground>
      <StatusBar style="light" />
      {/* Header */}
      <Animated.View
        entering={FadeInDown.duration(500).delay(40).springify().damping(16)}
        style={[styles.header, { paddingTop: insets.top + Spacing.md }]}
      >
        <Text style={[styles.headerTitle, { color: palette.ink }]}>The Circle</Text>
        <Text style={[styles.headerSubtitle, { color: palette.ink2 }]}>
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
            tintColor={palette.accent}
            colors={[palette.accent]}
          />
        }
      >
        {isFetching && feed.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={palette.accent} />
            <Text style={[styles.loadingText, { color: palette.ink3 }]}>
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
    </AuroraBackground>
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
  const { palette } = useAurora();
  return (
    <PressableScale
      onPress={onPress}
      haptic="none"
      scaleTo={0.94}
      style={[
        styles.filterChip,
        { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
        active && { backgroundColor: palette.accent, borderColor: palette.accent },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Filter: ${label}`}
      accessibilityState={{ selected: active }}
    >
      <Text style={styles.filterChipEmoji}>{emoji}</Text>
      <Text
        style={[
          styles.filterChipLabel,
          { color: active ? palette.ground : palette.ink2 },
        ]}
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
  const { palette } = useAurora();
  const space = getSpaceById(post.spaceId);
  const isAnonymous = post.mode === 'anonymous';
  const snapshot = post.authorSnapshot;

  return (
    <PressableScale
      onPress={onPress}
      haptic="none"
      scaleTo={0.985}
      style={[
        styles.postCard,
        { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
      ]}
      accessibilityRole="button"
    >
      {/* Author row */}
      <View style={styles.postAuthorRow}>
        <Text style={styles.postAuthorAvatar}>
          {isAnonymous ? snapshot.spiritEmoji ?? '🌸' : '💛'}
        </Text>
        <View style={styles.postAuthorMeta}>
          <Text style={[styles.postAuthorName, { color: palette.ink }]}>
            {isAnonymous
              ? snapshot.spiritAlias ?? 'Anonymous Friend'
              : snapshot.displayName ?? 'A Dottie friend'}
          </Text>
          <Text style={[styles.postSpaceTag, { color: palette.ink3 }]}>
            {space.emoji} {space.title} · {formatRelativeTime(post.createdAt)}
          </Text>
        </View>
      </View>

      {/* Anonymous credibility strip */}
      {isAnonymous && snapshot.credibility && (
        <CredibilityStrip credibility={snapshot.credibility} />
      )}

      {/* Body */}
      <Text style={[styles.postBody, { color: palette.ink }]} numberOfLines={6}>
        {post.body}
      </Text>

      {/* Action footer */}
      <View style={styles.postFooter}>
        <View style={styles.postFooterItem}>
          <Text style={styles.postFooterEmoji}>🤗</Text>
          <Text style={[styles.postFooterCount, { color: palette.ink2 }]}>{post.hugsCount}</Text>
        </View>
        <View style={styles.postFooterItem}>
          <Text style={styles.postFooterEmoji}>💬</Text>
          <Text style={[styles.postFooterCount, { color: palette.ink2 }]}>{post.repliesCount}</Text>
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
  const { palette } = useAurora();
  return (
    <View style={[styles.credPill, { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge }]}>
      <Text style={styles.credPillEmoji}>{emoji}</Text>
      <Text style={[styles.credPillValue, { color: palette.ink2 }]}>{value}</Text>
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
  const { palette } = useAurora();
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>{companionEmoji}</Text>
      <Text style={[styles.emptyTitle, { color: palette.ink }]}>It's quiet here right now</Text>
      <Text style={[styles.emptyBody, { color: palette.ink2 }]}>
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

// ─── STYLES (layout only — colours are inline, palette-driven) ───────

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.screenPadding,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    ...Typography.preset.h2,
  },
  headerSubtitle: {
    ...Typography.preset.body,
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
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Spacing.radius.full,
    borderWidth: 1,
  },
  filterChipEmoji: {
    fontSize: 14,
    marginRight: Spacing.xs,
  },
  filterChipLabel: {
    ...Typography.preset.captionBold,
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
  },
  // Post card
  postCard: {
    padding: Spacing.cardPaddingLarge,
    borderRadius: Spacing.radius['2xl'],
    borderWidth: 1,
    // aurora glass sits on the dark ground — soft dark lift
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 26,
    elevation: 6,
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
  },
  postSpaceTag: {
    ...Typography.preset.caption,
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
    borderWidth: 1,
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
  },
  // Body & footer
  postBody: {
    ...Typography.preset.body,
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
    textAlign: 'center',
  },
  emptyBody: {
    ...Typography.preset.body,
    textAlign: 'center',
    lineHeight: 22,
  },
});
