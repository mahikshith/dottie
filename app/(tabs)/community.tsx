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
type SortKey = 'trending' | 'new' | 'hugs' | 'answered';

const SORTS: { key: SortKey; label: string; emoji: string }[] = [
  { key: 'trending', label: 'Trending', emoji: '🔥' },
  { key: 'new', label: 'New', emoji: '🌱' },
  { key: 'hugs', label: 'Most hugs', emoji: '🤗' },
  { key: 'answered', label: 'Most answered', emoji: '💬' },
];

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
  const [sort, setSort] = useState<SortKey>('trending');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ─── Teen Mode space filtering ──────────────────────────────────
  const visibleSpaces = useMemo<CommunitySpace[]>(() => {
    return userMode === 'teen' ? getTeenSafeSpaces() : COMMUNITY_SPACES;
  }, [userMode]);

  // Read feed from cache via selector (re-renders only on relevant change)
  const feed = useCommunityStore(selectFeedForSpace(activeFilter));
  // Client-side sort (trending / new / most hugs / most answered).
  const sortedFeed = useMemo(() => sortPosts(feed, sort), [feed, sort]);

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

  const handleSortTap = (key: SortKey) => {
    Haptics.selectionAsync().catch(() => {});
    setSort(key);
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

      {/* Feed — spaces GRID on top (browse), or the selected space header;
          then sort filters, then the sorted posts. */}
      <ScrollView
        style={styles.feed}
        contentContainerStyle={[
          styles.feedContent,
          { paddingBottom: insets.bottom + Spacing.tabBarClearance },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={palette.accent}
            colors={[palette.accent]}
          />
        }
      >
        {activeFilter === 'all' ? (
          <SpaceGrid spaces={visibleSpaces} onPick={handleFilterTap} />
        ) : (
          <SelectedSpaceHeader
            space={getSpaceById(activeFilter)}
            onBack={() => handleFilterTap('all')}
          />
        )}

        {/* Sort filters */}
        <View style={styles.sortRow}>
          {SORTS.map((s) => (
            <SortChip
              key={s.key}
              label={s.label}
              emoji={s.emoji}
              active={sort === s.key}
              onPress={() => handleSortTap(s.key)}
            />
          ))}
        </View>

        {isFetching && sortedFeed.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={palette.accent} />
            <Text style={[styles.loadingText, { color: palette.ink3 }]}>
              {companion.name} is gathering the feed...
            </Text>
          </View>
        ) : sortedFeed.length === 0 ? (
          <EmptyState
            companionEmoji={companion.emoji}
            companionName={companion.name}
            onShare={handleNewPost}
          />
        ) : (
          sortedFeed.map((post, index) => (
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

// A prominent 2-col grid of spaces — the primary way to discover the Circle
// (was a side-scroll-only chip row the owner couldn't see at a glance).
function SpaceGrid({
  spaces,
  onPick,
}: {
  spaces: CommunitySpace[];
  onPick: (id: SpaceId) => void;
}) {
  const { palette } = useAurora();
  return (
    <View style={styles.gridWrap}>
      <Text style={[styles.gridLabel, { color: palette.ink3 }]}>SPACES</Text>
      <View style={styles.grid}>
        {spaces.map((space) => (
          <PressableScale
            key={space.id}
            onPress={() => onPick(space.id)}
            haptic="none"
            scaleTo={0.97}
            style={[styles.spaceCard, { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge }]}
            accessibilityRole="button"
            accessibilityLabel={`${space.title} space`}
          >
            <Text style={styles.spaceEmoji}>{space.emoji}</Text>
            <Text style={[styles.spaceTitle, { color: palette.ink }]} numberOfLines={1}>{space.title}</Text>
            <Text style={[styles.spaceDesc, { color: palette.ink3 }]} numberOfLines={2}>{space.description}</Text>
          </PressableScale>
        ))}
      </View>
      <Text style={[styles.gridLabel, { color: palette.ink3, marginTop: Spacing.base }]}>ACROSS THE CIRCLE</Text>
    </View>
  );
}

// The chosen space, pulled to the top with a back-to-all control.
function SelectedSpaceHeader({
  space,
  onBack,
}: {
  space: CommunitySpace;
  onBack: () => void;
}) {
  const { palette } = useAurora();
  return (
    <View style={styles.spaceHeaderWrap}>
      <PressableScale
        onPress={onBack}
        haptic="none"
        style={[styles.backChip, { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge }]}
        accessibilityRole="button"
        accessibilityLabel="Back to all spaces"
      >
        <Text style={[styles.backChipText, { color: palette.ink2 }]}>← Spaces</Text>
      </PressableScale>
      <View style={styles.spaceHeaderRow}>
        <Text style={styles.spaceHeaderEmoji}>{space.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.spaceHeaderTitle, { color: palette.ink }]}>{space.title}</Text>
          <Text style={[styles.spaceHeaderDesc, { color: palette.ink3 }]}>{space.description}</Text>
        </View>
      </View>
    </View>
  );
}

function SortChip({
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
      accessibilityLabel={`Sort: ${label}`}
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

// Client-side feed sort. 'trending' blends hugs + replies with a mild recency
// nudge so a fresh, engaged post can rise; the rest are single-signal.
function sortPosts(posts: CommunityPost[], sort: SortKey): CommunityPost[] {
  const copy = [...posts];
  const time = (p: CommunityPost) => new Date(p.createdAt).getTime();
  switch (sort) {
    case 'new':
      return copy.sort((a, b) => time(b) - time(a));
    case 'hugs':
      return copy.sort((a, b) => b.hugsCount - a.hugsCount || time(b) - time(a));
    case 'answered':
      return copy.sort((a, b) => b.repliesCount - a.repliesCount || time(b) - time(a));
    case 'trending':
    default: {
      const now = Date.now();
      const score = (p: CommunityPost) => {
        const ageHrs = Math.max(1, (now - time(p)) / 3_600_000);
        const recency = Math.max(0, 6 - Math.log2(ageHrs)); // decays over ~days
        return p.hugsCount + p.repliesCount * 1.5 + recency;
      };
      return copy.sort((a, b) => score(b) - score(a));
    }
  }
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
  // Sort chips row (above the feed)
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  // Space grid
  gridWrap: {
    marginBottom: Spacing.sm,
  },
  gridLabel: {
    ...Typography.preset.overline,
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  spaceCard: {
    width: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: Spacing.radius.xl,
    padding: Spacing.base,
    gap: 4,
  },
  spaceEmoji: { fontSize: 24 },
  spaceTitle: { ...Typography.preset.bodySemibold, fontSize: 14 },
  spaceDesc: { ...Typography.preset.caption, fontSize: 11, lineHeight: 15 },
  // Selected space header
  spaceHeaderWrap: {
    marginBottom: Spacing.base,
    gap: Spacing.sm,
  },
  backChip: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Spacing.radius.full,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
  },
  backChipText: { ...Typography.preset.captionBold },
  spaceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  spaceHeaderEmoji: { fontSize: 34 },
  spaceHeaderTitle: { ...Typography.preset.h4 },
  spaceHeaderDesc: { ...Typography.preset.caption, marginTop: 2 },
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
