import { useCallback, useEffect, useState } from 'react';
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
import { StatusBar } from 'expo-status-bar';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { A } from '../../src/theme';
import {
  GradientButton,
  GradientFab,
  BreathingView,
  AuroraBackground,
} from '../../src/components/ui';
import { showAppDialog } from '../../src/components/ui/appDialog';
import {
  useUserStore,
  useCycleStore,
  useSisterhoodStore,
  selectCompanionType,
  selectCurrentPhase,
  selectMemberViewsOrdered,
  selectIsLoadingSisterhood,
  selectHasAnyMembers,
  selectCircle,
  selectPendingPhaseSyncs,
} from '../../src/stores';
import { getCompanion } from '../../src/content/companions';
import { MemberCard } from '../../src/components/sisterhood/MemberCard';
import { PhaseSyncBanner } from '../../src/components/sisterhood/PhaseSyncBanner';
import { MAX_FREE_MEMBERS } from '../../src/types/sisterhood.types';
import { CompanionCreature } from '../../src/components/ui/creature/CompanionCreature';
import type { CompanionType } from '../../src/types/content.types';

/**
 * Sisterhood Circle Dashboard
 *
 * ─── WHAT THIS SCREEN DOES ──────────────────────────────────────────
 *
 *  - Hero header with companion + circle name
 *  - Phase-sync banner(s) — magical "you're in sync" moments
 *  - Member cards list (privacy-filtered MemberViews)
 *  - Warm empty state with a clear "add your first member" CTA
 *  - Floating "+" action that opens the add-member wizard (Batch 2B)
 *  - Pull-to-refresh re-derives every member view
 *
 * ─── PRIVACY DISCIPLINE ─────────────────────────────────────────────
 *
 *  This screen reads ONLY MemberView objects (via selectMemberViewsOrdered)
 *  which have already been privacy-filtered by the engine. We never
 *  touch raw shadow data or unfiltered member records here. That's the
 *  whole privacy contract — enforced in exactly one place upstream.
 *
 * ─── WIZARD HANDOFF ─────────────────────────────────────────────────
 *
 *  The "+" FAB and empty-state CTA both navigate to
 *  /(sisterhood)/add-member, which is a presented-modal multi-step
 *  wizard. The wizard handles all the form complexity (kind, name,
 *  emoji, relationship, privacy, optional shadow context) and dismisses
 *  itself when done — control returns here and the new member appears
 *  in the list immediately because the store updates atomically.
 *
 * ─── PREMIUM POLISH PASS (Phase 2) ──────────────────────────────────
 *
 *  Presentation/animation-only pass — zero logic, data, or copy changes.
 *   - Hero mascot emoji now wrapped in <BreathingView> so it feels alive.
 *   - Every top-level section (hero, sync banners, member cards, footer)
 *     rises in on mount via FadeInDown (rise() helper), staggered so the
 *     screen assembles itself instead of snapping in flat. `entering`
 *     fires on MOUNT only, so store refreshes never retrigger it.
 *   - Hand-rolled coral FAB replaced by the shared <GradientFab>, offset
 *     with the safe-area inset (deep screen: insets.bottom + Spacing.xl).
 *   - Empty-state flat coral CTA replaced by the premium <GradientButton>.
 *   - Fixed top padding swapped for insets.top + Spacing.lg (real notch
 *     safety instead of a magic number). useSafeAreaInsets added.
 *   - Dead fab/fabPressed/fabIcon/emptyButton style keys removed.
 *  Reduce-Motion is honored inside the shared primitives themselves.
 */

/** Shared entrance curve — a soft spring rise used to stagger sections in. */
function rise(delay: number): ReturnType<typeof FadeInDown.duration> {
  return FadeInDown.duration(480).delay(delay).springify().damping(16);
}

export default function SisterhoodCircleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ─── Store reads ────────────────────────────────────────────────
  const userId = useUserStore((s) => s.userId);
  const companionType = useUserStore(selectCompanionType);
  const primaryCurrentPhase = useCycleStore(selectCurrentPhase);
  const circle = useSisterhoodStore(selectCircle);
  const memberViews = useSisterhoodStore(selectMemberViewsOrdered);
  const hasMembers = useSisterhoodStore(selectHasAnyMembers);
  const isLoading = useSisterhoodStore(selectIsLoadingSisterhood);
  const pendingSyncs = useSisterhoodStore(selectPendingPhaseSyncs);

  const companion = getCompanion(companionType);
  const memberCount = memberViews.length;
  const atFreeLimit = memberCount >= MAX_FREE_MEMBERS;

  // ─── Initial load + on-focus refresh ────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      useSisterhoodStore.getState().refresh(userId, primaryCurrentPhase);
    }, [userId, primaryCurrentPhase])
  );

  // Keep views fresh when primary phase changes (e.g. after a period log)
  useEffect(() => {
    if (!userId) return;
    useSisterhoodStore.getState().refresh(userId, primaryCurrentPhase);
  }, [userId, primaryCurrentPhase]);

  // ─── Handlers ───────────────────────────────────────────────────

  const handleRefresh = async () => {
    if (!userId) return;
    setIsRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await useSisterhoodStore.getState().refresh(userId, primaryCurrentPhase);
    setIsRefreshing(false);
  };

  const handleMemberTap = (memberId: string) => {
    Haptics.selectionAsync().catch(() => {});
    router.push(`/(sisterhood)/member/${memberId}`);
  };

  const handleAddMember = () => {
    if (!userId) return;

    if (atFreeLimit) {
      showAppDialog({
        emoji: '💛',
        title: 'Your circle is feeling full',
        body: `On the free plan you can connect with ${MAX_FREE_MEMBERS} sister. Dottie+ lets you grow your circle so you can care for everyone you love.`,
        actions: [{ label: 'Got it', onPress: () => {} }],
      });
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push('/(sisterhood)/add-member');
  };

  const handleAcknowledgeSync = (eventId: string) => {
    Haptics.selectionAsync().catch(() => {});
    useSisterhoodStore.getState().acknowledgePhaseSync(eventId);
  };

  // ─── Render ─────────────────────────────────────────────────────

  if (!userId) {
    return (
      <AuroraBackground>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={A.accent} />
        </View>
      </AuroraBackground>
    );
  }

  return (
    <AuroraBackground>
      <StatusBar style="light" />
      <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.tabBarClearance,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={A.accent}
            colors={[A.accent]}
          />
        }
      >
        {/* Hero header */}
        <Animated.View entering={rise(0)} style={styles.hero}>
          <BreathingView>
            <Text style={styles.heroEmoji}>👯</Text>
          </BreathingView>
          <Text style={styles.heroTitle}>{circle?.name ?? 'My Sisterhood'}</Text>
          <Text style={styles.heroSubtitle}>
            {hasMembers
              ? `${memberCount} ${memberCount === 1 ? 'sister' : 'sisters'} in your circle`
              : `${companion.name} thinks circles are better with company 💛`}
          </Text>
        </Animated.View>

        {/* Phase-sync banners — the magic moments */}
        {pendingSyncs.length > 0 && (
          <View style={styles.syncSection}>
            {pendingSyncs.slice(0, 3).map((event, index) => {
              const view = memberViews.find((v) => v.memberId === event.memberId);
              if (!view) return null;
              return (
                <Animated.View key={event.id} entering={rise(80 + index * 80)}>
                  <PhaseSyncBanner
                    memberName={view.displayName}
                    memberEmoji={view.emoji}
                    phase={event.phase}
                    onAcknowledge={() => handleAcknowledgeSync(event.id)}
                  />
                </Animated.View>
              );
            })}
          </View>
        )}

        {/* Member list OR empty state */}
        {isLoading && !hasMembers ? (
          <View style={styles.loadingInline}>
            <ActivityIndicator color={A.accent} />
            <Text style={styles.loadingText}>
              {companion.name} is gathering your circle...
            </Text>
          </View>
        ) : hasMembers ? (
          <View style={styles.memberList}>
            {memberViews.map((view, index) => (
              <Animated.View
                key={view.memberId}
                entering={rise(Math.min(index, 8) * 60)}
              >
                <MemberCard
                  view={view}
                  onPress={() => handleMemberTap(view.memberId)}
                />
              </Animated.View>
            ))}
          </View>
        ) : (
          <EmptyState
            companionType={companion.type}
            companionName={companion.name}
            onAdd={handleAddMember}
          />
        )}

        {/* Footer hint */}
        {hasMembers && (
          <Animated.View entering={rise(120)} style={styles.footerHint}>
            <Text style={styles.footerEmoji}>🔒</Text>
            <Text style={styles.footerText}>
              Every sister chooses how much they share. {companion.name} keeps everyone's privacy safe.
            </Text>
          </Animated.View>
        )}

        <View style={{ height: Spacing['5xl'] }} />
      </ScrollView>

      {/* Floating "+" action — shared premium gradient FAB */}
      {hasMembers && (
        <GradientFab
          onPress={handleAddMember}
          bottom={insets.bottom + Spacing.xl}
          haptic="none"
          accessibilityLabel="Add a sister to your circle"
        />
      )}
      </View>
    </AuroraBackground>
  );
}

// ─── EMPTY STATE ─────────────────────────────────────────────────────

function EmptyState({
  companionType,
  companionName,
  onAdd,
}: {
  companionType: CompanionType;
  companionName: string;
  onAdd: () => void;
}) {
  return (
    <View style={styles.emptyState}>
      {/* The drawn rig, not an emoji stand-in (device-test-19, rule 8). */}
      <CompanionCreature type={companionType} state="caring" size={96} />
      <Text style={styles.emptyTitle}>Care is sweeter shared 🌷</Text>
      <Text style={styles.emptyBody}>
        Add a little sister, a cousin, your best friend — or someone who
        doesn't have a phone yet. {companionName} will help you care for them gently.
      </Text>

      <View style={styles.emptyFeatureGrid}>
        <EmptyFeatureCard
          emoji="🌸"
          title="Log for them"
          body="Track period days and check-ins on their behalf"
        />
        <EmptyFeatureCard
          emoji="💌"
          title="Send care nudges"
          body="Pre-written warmth, sent at exactly the right moment"
        />
        <EmptyFeatureCard
          emoji="🤝"
          title="Sync moments"
          body="Discover when you're going through the same phase"
        />
      </View>

      <GradientButton
        label="Add your first sister"
        onPress={onAdd}
        haptic="none"
        style={{ marginTop: Spacing.xl }}
        accessibilityHint="Opens the add-a-sister wizard"
      />
    </View>
  );
}

function EmptyFeatureCard({
  emoji,
  title,
  body,
}: {
  emoji: string;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.emptyFeatureCard}>
      <Text style={styles.emptyFeatureEmoji}>{emoji}</Text>
      <Text style={styles.emptyFeatureTitle}>{title}</Text>
      <Text style={styles.emptyFeatureBody}>{body}</Text>
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenPadding,
    // Sections had NO vertical separation of their own here, so each block sat
    // against whatever margin the one above happened to leave — which on this
    // screen was often nothing, and the card borders touched (device-test-19,
    // "the UI is cluttered and the borders are closing in"). One gap, applied
    // once, instead of a margin negotiated per block.
    gap: Spacing.sectionGap,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingInline: {
    alignItems: 'center',
    paddingVertical: Spacing['3xl'],
    gap: Spacing.md,
  },
  loadingText: {
    ...Typography.preset.caption,
    color: A.ink3,
  },
  // Hero
  hero: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  heroEmoji: {
    fontSize: 56,
    marginBottom: Spacing.sm,
  },
  heroTitle: {
    ...Typography.preset.h2,
    color: A.ink,
    textAlign: 'center',
  },
  heroSubtitle: {
    ...Typography.preset.body,
    color: A.ink2,
    textAlign: 'center',
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.lg,
  },
  // Phase-sync section
  syncSection: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  // Member list
  memberList: {
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.base,
    gap: Spacing.md,
  },
  emptyEmoji: {
    fontSize: 72,
  },
  emptyTitle: {
    ...Typography.preset.h3,
    color: A.ink,
    textAlign: 'center',
  },
  emptyBody: {
    ...Typography.preset.body,
    color: A.ink2,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.sm,
  },
  emptyFeatureGrid: {
    width: '100%',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  emptyFeatureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: A.glass, borderColor: A.edge, borderWidth: 1,
    padding: Spacing.md,
    borderRadius: Spacing.radius.xl,
    gap: Spacing.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  emptyFeatureEmoji: {
    fontSize: 28,
  },
  emptyFeatureTitle: {
    ...Typography.preset.bodySemibold,
    color: A.ink,
  },
  emptyFeatureBody: {
    ...Typography.preset.caption,
    color: A.ink2,
    flex: 1,
    flexShrink: 1,
  },
  // Footer hint
  footerHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: A.glass2, borderColor: A.edge, borderWidth: 1,
    padding: Spacing.md,
    borderRadius: Spacing.radius.lg,
    marginTop: Spacing['2xl'],
    gap: Spacing.sm,
  },
  footerEmoji: {
    fontSize: 18,
  },
  footerText: {
    ...Typography.preset.caption,
    color: A.ink2,
    flex: 1,
    fontStyle: 'italic',
    lineHeight: 18,
  },
});
