import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '../../../src/constants/typography';
import { Spacing } from '../../../src/constants/spacing';
import { A } from '../../../src/theme';
import { PressableScale, BreathingView, AuroraBackground } from '../../../src/components/ui';
import { showAppDialog } from '../../../src/components/ui/appDialog';
import {
  useUserStore,
  useCycleStore,
  useSisterhoodStore,
  selectCompanionType,
  selectCurrentPhase,
  selectMemberViewById,
  selectMemberById,
} from '../../../src/stores';
import { getCompanion } from '../../../src/content/companions';
import { CareNudgePicker } from '../../../src/components/sisterhood/CareNudgePicker';
import {
  MemberView,
  CareNudgeTemplate,
  CareNudgeSituation,
} from '../../../src/types/sisterhood.types';
import { getPhaseColors, PhaseKey } from '../../../src/constants/colors';
import { logSilentFailure } from '../../../src/diagnostics/silent-failure';

/**
 * Sisterhood Member Detail Screen
 *
 * ─── PREMIUM POLISH PASS (Phase 2) ──────────────────────────────────
 *
 *  Presentation/animation only — every handler, store read, navigation
 *  call, privacy branch, and copy string is byte-for-byte unchanged.
 *
 *   - Entrance choreography: the hero, phase-sync banner, snapshot card,
 *     care-nudge section, shadow actions, linked card, and footer each
 *     fade + rise in a gentle stagger (Reanimated `FadeInDown`, UI
 *     thread) so the profile assembles with intent. `entering` runs on
 *     mount only, so focus-refresh store updates never refire it.
 *   - The hero member emoji now sits in a `BreathingView` so it feels
 *     like a living person rather than a static glyph.
 *   - Every tappable surface — the three "track on their behalf" action
 *     rows and the "Remove from circle" footer button — now uses the
 *     shared `PressableScale` spring-press primitive for buttery 60fps
 *     tap feedback. Their existing handlers already fire the right
 *     Haptics, so PressableScale is passed `haptic="none"` to avoid a
 *     double buzz.
 *
 *  No GradientButton here: the only footer control is a *destructive*
 *  outlined "Remove" action, and a saturated coral CTA would misread it.
 *  Safe-area top is owned by the native stack header (title bar), so no
 *  manual inset padding is added on this pushed screen.
 *
 *  All motion honors "Reduce Motion" via the shared primitives.
 *
 * ─── WHAT THIS SCREEN DOES ──────────────────────────────────────────
 *
 *  - Hero: large emoji + name + relationship + privacy badge
 *  - Privacy-filtered "what you see" panel (phase, mood, flow, etc.)
 *  - Care nudge picker (3 suggestions tailored to current state)
 *  - Shadow-only actions:
 *      • Log a period day for them → the main calendar, with them selected
 *      • Quick mood check-in       → /shadow-log/{id}/check-in
 *      • Generate a transfer code  → /shadow-log/{id}/transfer
 *  - Privacy + remove actions in a soft footer
 *
 * ─── PRIVACY DISCIPLINE ─────────────────────────────────────────────
 *
 *  All rendered cycle/mood data flows through MemberView (privacy-
 *  filtered upstream). We never read raw shadow tables here. The only
 *  raw member field we touch is `kind` so we know whether to show
 *  shadow-specific actions — that's metadata about the relationship,
 *  not health data.
 *
 * ─── WHAT CHANGED IN BATCH 2C ───────────────────────────────────────
 *
 *  The three shadow-only "Track on their behalf" actions now route to
 *  proper modal screens instead of chaining Alerts. The Alert-based
 *  logic that lived inline has been removed — those sheets own the
 *  full experience (date picker, flow level, mood scale, transfer
 *  code presentation).
 *
 *  Remove-member stays as an Alert because (a) it's a destructive
 *  confirmation, exactly what Alert is best at, and (b) it's a one-tap
 *  action that doesn't benefit from a screen.
 */
// Shared entrance curve — a gentle spring-damped fade + rise. `delay` (ms)
// staggers siblings so the screen assembles top-to-bottom on mount.
function rise(delay: number) {
  return FadeInDown.duration(480).delay(delay).springify().damping(16);
}

export default function MemberDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const memberId = id ?? '';

  const userId = useUserStore((s) => s.userId);
  const companionType = useUserStore(selectCompanionType);
  const primaryCurrentPhase = useCycleStore(selectCurrentPhase);

  const view = useSisterhoodStore(selectMemberViewById(memberId));
  const rawMember = useSisterhoodStore(selectMemberById(memberId));

  const companion = getCompanion(companionType);
  const [isSendingNudge, setIsSendingNudge] = useState(false);

  // Ensure data is fresh when the screen comes back into focus
  // (including returning from a shadow-log modal that just wrote data)
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      useSisterhoodStore.getState().refresh(userId, primaryCurrentPhase);
    }, [userId, primaryCurrentPhase])
  );

  // ─── Change how much of her you track ───────────────────────────
  //
  //  Steps through full → summary → mood only → connected → full. A cycle
  //  rather than a picker sheet because there are four levels, the order is
  //  meaningful (most to least), and the label always names the current one —
  //  so it is discoverable by pressing it once, which is exactly what people
  //  were already trying to do (device-test-16).
  const onCyclePrivacy = useCallback(() => {
    if (!view) return;
    const next =
      PRIVACY_ORDER[(PRIVACY_ORDER.indexOf(view.privacyLevel) + 1) % PRIVACY_ORDER.length]!;
    Haptics.selectionAsync().catch(() => {});
    useSisterhoodStore
      .getState()
      .updateMember(memberId, primaryCurrentPhase, { privacyLevel: next })
      .catch((err) => logSilentFailure('sisterhood:privacyCycleFailed', err));
  }, [view, memberId, primaryCurrentPhase]);

  // ─── Suggested care nudges ──────────────────────────────────────
  const suggestion = useMemo(() => {
    if (!view) return null;
    return useSisterhoodStore.getState().suggestNudgesForMember(memberId);
  }, [view, memberId]);

  // ─── Handlers ───────────────────────────────────────────────────

  const handleSendNudge = async (template: CareNudgeTemplate) => {
    if (!userId || !view || isSendingNudge) return;
    setIsSendingNudge(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const result = await useSisterhoodStore.getState().sendCareNudge(userId, {
      memberId,
      templateId: template.id,
    });

    setIsSendingNudge(false);

    if (result.ok) {
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      ).catch(() => {});
      showAppDialog({
        emoji: template.emoji,
        title: `Sent to ${view.displayName}`,
        body: rawMember?.kind === 'linked'
          ? "They'll see it next time they open Dottie."
          : `${companion.name} held this nudge close. When ${view.displayName} gets their own Dottie, they'll find your warmth waiting.`,
        actions: [{ label: 'Sweet 💛', onPress: () => {} }],
      });
    } else {
      showAppDialog({
        emoji: '😅',
        title: 'Hmm',
        body: result.message,
        actions: [{ label: 'OK', onPress: () => {} }],
      });
    }
  };

  // ─── Shadow-action routers (Batch 2C: route to polished sheets) ─

  // Logging a period day goes to the MAIN CALENDAR with this sister already
  // selected — there is no separate sisterhood date picker any more.
  //
  //  The old screen made you learn a second, worse date UI: a horizontal day
  //  strip and a stack of white flow cards, sitting a tab away from a calendar
  //  that already does all of this (device-test-8: "why can't they simply
  //  toggle the option for their sisterhood ... the calendar is already
  //  everything set up"). Two places to log the same thing is also two places
  //  to disagree about what was logged.
  const handleLogPeriod = () => {
    if (!view || rawMember?.kind !== 'shadow') return;
    Haptics.selectionAsync().catch(() => {});
    router.push({ pathname: '/(tabs)/calendar', params: { logFor: memberId } });
  };

  const handleQuickCheckIn = () => {
    if (!view || rawMember?.kind !== 'shadow') return;
    Haptics.selectionAsync().catch(() => {});
    router.push(`/(sisterhood)/shadow-log/${memberId}/check-in`);
  };

  const handleGenerateTransfer = () => {
    if (!view || rawMember?.kind !== 'shadow') return;
    Haptics.selectionAsync().catch(() => {});
    router.push(`/(sisterhood)/shadow-log/${memberId}/transfer`);
  };

  const handleRemoveMember = () => {
    if (!view) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    showAppDialog({
      emoji: '💔',
      title: `Remove ${view.displayName} from your circle?`,
      body: rawMember?.kind === 'shadow'
        ? `This will erase everything you've tracked for ${view.displayName}. This can't be undone.`
        : `${view.displayName} will leave your circle. You can always invite them back.`,
      actions: [
        { label: 'Keep them', variant: 'ghost', onPress: () => {} },
        {
          label: 'Remove',
          variant: 'danger',
          onPress: async () => {
            try {
              await useSisterhoodStore.getState().removeMember(memberId);
              router.back();
            } catch (err) {
              logSilentFailure('sisterhood.remove', err);
            }
          },
        },
      ],
    });
  };

  // ─── Render ─────────────────────────────────────────────────────

  if (!view) {
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
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.scrollContent,
          // Safe area is not optional (device-test-16). This screen had NO
          // inset handling at all and no nav header, so the sister's name sat
          // under the status bar and the last card ran into the gesture bar.
          { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing['3xl'] },
        ]}
        showsVerticalScrollIndicator={false}
      >
      {/* Hero */}
      <Animated.View entering={rise(0)} style={styles.hero}>
        <BreathingView>
          <Text style={styles.heroEmoji}>{view.emoji}</Text>
        </BreathingView>
        <Text style={styles.heroName}>{view.displayName}</Text>
        <Text style={styles.heroRelationship}>{view.relationship}</Text>
        <View style={styles.heroBadges}>
          <KindBadge kind={view.kind} />
          <PrivacyBadge level={view.privacyLevel} onCycle={onCyclePrivacy} />
        </View>
        <Text style={styles.privacyBlurb}>
          {PRIVACY_META[view.privacyLevel].blurb} · tap to change
        </Text>
      </Animated.View>

      {/* Phase sync banner inline */}
      {view.inPhaseSync && view.currentPhase && (
        <Animated.View entering={rise(80)} style={styles.syncInline}>
          <Text style={styles.syncInlineEmoji}>🤝</Text>
          <Text style={styles.syncInlineText}>
            You and {view.displayName} are in the same phase right now.
          </Text>
        </Animated.View>
      )}

      {/* "What you see" — privacy-filtered snapshot */}
      <Animated.View entering={rise(150)}>
        <SnapshotSection view={view} />
      </Animated.View>

      {/* Care nudge picker */}
      {suggestion && (
        <Animated.View entering={rise(220)} style={styles.section}>
          <Text style={styles.sectionTitle}>Send a little warmth 💌</Text>
          <Text style={styles.sectionSubtitle}>
            {labelForSituation(suggestion.situation, view.displayName)}
          </Text>
          <CareNudgePicker
            templates={suggestion.templates}
            onSelect={handleSendNudge}
            disabled={isSendingNudge}
          />
        </Animated.View>
      )}

      {/* Shadow-only actions */}
      {rawMember?.kind === 'shadow' && (
        <Animated.View entering={rise(290)} style={styles.section}>
          <Text style={styles.sectionTitle}>Track on their behalf</Text>
          <Text style={styles.sectionSubtitle}>
            You're the one keeping Dottie warm for {view.displayName}.
          </Text>

          <Animated.View entering={rise(340)}>
            <ActionRow
              emoji="🩸"
              title="Log a period day"
              subtitle="Opens your calendar with their days selected"
              onPress={handleLogPeriod}
            />
          </Animated.View>
          <Animated.View entering={rise(410)}>
            <ActionRow
              emoji="💛"
              title="Quick mood check-in"
              subtitle="Mood, energy, and a private note"
              onPress={handleQuickCheckIn}
            />
          </Animated.View>
          <Animated.View entering={rise(480)}>
            <ActionRow
              emoji="🤝"
              title="Hand off to their phone"
              subtitle="Generate a one-time transfer code"
              onPress={handleGenerateTransfer}
            />
          </Animated.View>
        </Animated.View>
      )}

      {/* Linked-only placeholder for MVP */}
      {rawMember?.kind === 'linked' && (
        <Animated.View entering={rise(290)} style={styles.linkedCard}>
          <Text style={styles.linkedEmoji}>🔗</Text>
          <Text style={styles.linkedTitle}>Linked sister</Text>
          <Text style={styles.linkedBody}>
            {view.displayName} has their own Dottie. Their cycle data lives on
            their device — Dottie keeps it that way out of love. Care nudges
            you send will reach them when their app next syncs.
          </Text>
        </Animated.View>
      )}

      {/* Footer actions */}
      <Animated.View entering={rise(360)} style={styles.footerActions}>
        <PressableScale
          onPress={handleRemoveMember}
          haptic="none"
          scaleTo={0.98}
          style={styles.removeButton}
          accessibilityRole="button"
          accessibilityLabel="Remove from circle"
        >
          <Text style={styles.removeButtonText}>Remove from circle</Text>
        </PressableScale>
      </Animated.View>

      <View style={{ height: Spacing['4xl'] }} />
      </ScrollView>
    </AuroraBackground>
  );
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────

function KindBadge({ kind }: { kind: MemberView['kind'] }) {
  const label = kind === 'shadow' ? 'Shadow Profile' : 'Linked';
  const color = kind === 'shadow' ? A.gold : A.accent2;
  // A LABEL, not a control — this describes the member and cannot be changed
  // here. Drawn as an outline so it stops masquerading as half of a toggle.
  return (
    <View style={[styles.badge, styles.kindBadge, { borderColor: `${color}88` }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

/**
 * How much of this sister you track — and, now, a CONTROL rather than a label.
 *
 * Device-test-16: "there is a shadow profile and a full view, users have
 * complained that they were not able to move to the full view." They were
 * right, and it was worse than a broken button: these two pills were plain
 * <View>s. `Shadow Profile` is a fact about the member (you log for her, she
 * has no phone) and can't be toggled at all, while `Full view` is a genuine
 * setting that simply had no way to be changed. Rendered side by side as two
 * filled pills, they read as a segmented toggle, so people tapped and nothing
 * happened.
 *
 * Now: the kind is drawn as a plain label so it stops inviting a tap, and the
 * privacy level is a real button that steps through the levels.
 */
const PRIVACY_ORDER: MemberView['privacyLevel'][] = ['full', 'summary', 'mood', 'connected'];

const PRIVACY_META: Record<
  MemberView['privacyLevel'],
  { label: string; emoji: string; blurb: string }
> = {
  full: { label: 'Full view', emoji: '🌷', blurb: 'Cycle, mood and check-ins' },
  summary: { label: 'Summary', emoji: '🌼', blurb: 'Phase and next period only' },
  mood: { label: 'Mood only', emoji: '💛', blurb: 'How she is feeling, nothing else' },
  connected: { label: 'Connected', emoji: '🔗', blurb: 'Linked, nothing shared yet' },
};

function PrivacyBadge({
  level,
  onCycle,
}: {
  level: MemberView['privacyLevel'];
  onCycle?: () => void;
}) {
  const { label, emoji } = PRIVACY_META[level];
  if (!onCycle) {
    return (
      <View style={[styles.badge, styles.privacyBadge]}>
        <Text style={styles.badgeEmoji}>{emoji}</Text>
        <Text style={[styles.badgeText, { color: A.ink2 }]}>{label}</Text>
      </View>
    );
  }
  return (
    <PressableScale
      onPress={onCycle}
      haptic="none"
      scaleTo={0.95}
      style={[styles.badge, styles.privacyBadge, styles.privacyBadgeTappable]}
      accessibilityRole="button"
      accessibilityLabel={`Sharing: ${label}. Tap to change how much you see.`}
    >
      <Text style={styles.badgeEmoji}>{emoji}</Text>
      <Text style={[styles.badgeText, { color: A.accent }]}>{label}</Text>
      <Text style={[styles.badgeText, { color: A.accent }]}>⇄</Text>
    </PressableScale>
  );
}

function SnapshotSection({ view }: { view: MemberView }) {
  const phaseKey: PhaseKey | null = view.currentPhase as PhaseKey | null;
  const phaseColors = phaseKey ? getPhaseColors(phaseKey) : null;

  return (
    <View style={styles.snapshotCard}>
      <Text style={styles.snapshotLabel}>What you see</Text>

      {/* Phase + day */}
      {view.currentPhase && phaseColors ? (
        <View style={[styles.snapshotRow, styles.snapshotPhaseRow]}>
          <View
            style={[
              styles.phaseDot,
              { backgroundColor: phaseColors.primary },
            ]}
          />
          <View style={styles.snapshotRowText}>
            <Text style={styles.snapshotPrimary}>
              {phaseColors.emoji} {phaseColors.label} phase
              {view.dayInCycle ? ` · Day ${view.dayInCycle}` : ''}
            </Text>
            {view.predictedNextPeriod && (
              <Text style={styles.snapshotSub}>
                Next period around {formatDate(view.predictedNextPeriod)}
              </Text>
            )}
          </View>
        </View>
      ) : view.privacyLevel === 'mood' ? null : view.privacyLevel === 'connected' ? null : (
        <View style={styles.snapshotEmpty}>
          <Text style={styles.snapshotEmptyText}>
            No cycle data yet — once you log a period day, predictions will appear here gently.
          </Text>
        </View>
      )}

      {/* Mood */}
      {view.moodSignal && (
        <View style={styles.snapshotRow}>
          <Text style={styles.snapshotEmoji}>{moodEmoji(view.moodSignal)}</Text>
          <View style={styles.snapshotRowText}>
            <Text style={styles.snapshotPrimary}>{moodLabel(view.moodSignal)}</Text>
            {view.moodScore !== null && (
              <Text style={styles.snapshotSub}>Mood {view.moodScore}/5</Text>
            )}
          </View>
        </View>
      )}

      {/* Energy */}
      {view.energyLevel !== null && (
        <View style={styles.snapshotRow}>
          <Text style={styles.snapshotEmoji}>⚡</Text>
          <View style={styles.snapshotRowText}>
            <Text style={styles.snapshotPrimary}>Energy {view.energyLevel}/5</Text>
          </View>
        </View>
      )}

      {/* Flow */}
      {view.flowLevel !== null && (
        <View style={styles.snapshotRow}>
          <Text style={styles.snapshotEmoji}>🌊</Text>
          <View style={styles.snapshotRowText}>
            <Text style={styles.snapshotPrimary}>
              Flow level {view.flowLevel}/5
            </Text>
          </View>
        </View>
      )}

      {/* Symptoms */}
      {view.recentSymptoms.length > 0 && (
        <View style={styles.snapshotRow}>
          <Text style={styles.snapshotEmoji}>🌿</Text>
          <View style={styles.snapshotRowText}>
            <Text style={styles.snapshotPrimary}>Recently noted</Text>
            <Text style={styles.snapshotSub}>
              {view.recentSymptoms.slice(0, 4).join(', ')}
            </Text>
          </View>
        </View>
      )}

      {/* Connected-level fallback */}
      {view.privacyLevel === 'connected' && (
        <View style={styles.snapshotEmpty}>
          <Text style={styles.snapshotEmptyText}>
            {view.displayName} chose to stay connected without sharing cycle details.
            Your circle still counts. 💛
          </Text>
        </View>
      )}

      {/* Mood-only level note */}
      {view.privacyLevel === 'mood' && !view.moodSignal && (
        <View style={styles.snapshotEmpty}>
          <Text style={styles.snapshotEmptyText}>
            {view.displayName} hasn't checked in lately. No nudge needed — just love.
          </Text>
        </View>
      )}

      {/* Last activity */}
      {view.lastActiveAt && (
        <Text style={styles.lastActive}>
          Last activity {formatRelative(view.lastActiveAt)}
        </Text>
      )}
    </View>
  );
}

function ActionRow({
  emoji,
  title,
  subtitle,
  onPress,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}): JSX.Element {
  return (
    <PressableScale
      onPress={onPress}
      haptic="none"
      scaleTo={0.985}
      style={styles.actionRow}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
    >
      <Text style={styles.actionEmoji}>{emoji}</Text>
      <View style={styles.actionContent}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.actionArrow}>›</Text>
    </PressableScale>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────

function moodEmoji(signal: NonNullable<MemberView['moodSignal']>): string {
  switch (signal) {
    case 'tough_day': return '🌧️';
    case 'ok':        return '🌤️';
    case 'great':     return '🌞';
  }
}

function moodLabel(signal: NonNullable<MemberView['moodSignal']>): string {
  switch (signal) {
    case 'tough_day': return 'Having a tough day';
    case 'ok':        return 'Doing okay';
    case 'great':     return 'Feeling great';
  }
}

function labelForSituation(situation: CareNudgeSituation, name: string): string {
  switch (situation) {
    case 'period_day':       return `${name} is on their period — soft warmth helps.`;
    case 'tough_pms':        return `Luteal + low mood. ${name} could use a real hug today.`;
    case 'low_mood':         return `${name} flagged a tough day. A gentle word goes far.`;
    case 'streak_broken':    return `Their streak broke. Remind them rest is productive too.`;
    case 'phase_sync':       return `You're in sync — celebrate the magic.`;
    case 'inactive_3_days':  return `Quiet for a few days. No pressure, just a hello.`;
    case 'celebration':      return `${name} hit a milestone — celebrate them loudly!`;
    case 'general_warmth':   return `Just because. Warmth never needs a reason.`;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffMin = Math.max(1, Math.floor((now - then) / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenPadding,
  },
  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  heroEmoji: {
    fontSize: 80,
    marginBottom: Spacing.sm,
  },
  heroName: {
    ...Typography.preset.h2,
    color: A.ink,
    textAlign: 'center',
  },
  heroRelationship: {
    ...Typography.preset.body,
    color: A.ink2,
    marginTop: 2,
  },
  heroBadges: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  badge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Spacing.radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  privacyBadge: {
    backgroundColor: A.glass2, borderColor: A.edge, borderWidth: 1,
  },
  privacyBlurb: {
    ...Typography.preset.caption,
    fontSize: 11,
    color: A.ink3,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  privacyBadgeTappable: {
    borderColor: `${A.accent}66`,
  },
  kindBadge: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  badgeEmoji: {
    fontSize: 12,
  },
  badgeText: {
    ...Typography.preset.caption,
    fontSize: 11,
    fontWeight: '600',
    color: A.ground,
    letterSpacing: 0.3,
  },
  // Phase sync inline
  syncInline: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${A.gold}22`,
    padding: Spacing.md,
    borderRadius: Spacing.radius.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: A.gold,
  },
  syncInlineEmoji: {
    fontSize: 22,
  },
  syncInlineText: {
    ...Typography.preset.body,
    color: A.ink,
    flex: 1,
    lineHeight: 20,
  },
  // Snapshot card
  snapshotCard: {
    backgroundColor: A.glass, borderColor: A.edge, borderWidth: 1,
    padding: Spacing.cardPaddingLarge,
    borderRadius: Spacing.radius['2xl'],
    marginBottom: Spacing.lg,
    gap: Spacing.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 22, elevation: 6,
  },
  snapshotLabel: {
    ...Typography.preset.overline,
    color: A.ink3,
  },
  snapshotRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  snapshotPhaseRow: {
    alignItems: 'center',
  },
  snapshotRowText: {
    flex: 1,
  },
  snapshotPrimary: {
    ...Typography.preset.bodySemibold,
    color: A.ink,
  },
  snapshotSub: {
    ...Typography.preset.caption,
    color: A.ink3,
    marginTop: 2,
  },
  snapshotEmoji: {
    fontSize: 24,
    width: 28,
    textAlign: 'center',
  },
  phaseDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  snapshotEmpty: {
    paddingVertical: Spacing.sm,
  },
  snapshotEmptyText: {
    ...Typography.preset.caption,
    color: A.ink3,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  lastActive: {
    ...Typography.preset.caption,
    color: A.ink3,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  // Sections
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.preset.h4,
    color: A.ink,
    marginBottom: Spacing.xs,
  },
  sectionSubtitle: {
    ...Typography.preset.caption,
    color: A.ink2,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  // Action rows
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: A.glass, borderColor: A.edge, borderWidth: 1,
    padding: Spacing.cardPadding,
    borderRadius: Spacing.radius.xl,
    marginBottom: Spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  actionEmoji: {
    fontSize: 26,
    marginRight: Spacing.md,
    width: 32,
    textAlign: 'center',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    ...Typography.preset.bodySemibold,
    color: A.ink,
  },
  actionSubtitle: {
    ...Typography.preset.caption,
    color: A.ink3,
    marginTop: 2,
  },
  actionArrow: {
    fontSize: 24,
    color: A.ink3,
  },
  // Linked placeholder
  linkedCard: {
    alignItems: 'center',
    backgroundColor: A.glass2, borderColor: A.edge, borderWidth: 1,
    padding: Spacing.cardPaddingLarge,
    borderRadius: Spacing.radius['2xl'],
    marginBottom: Spacing.lg,
  },
  linkedEmoji: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  linkedTitle: {
    ...Typography.preset.h4,
    color: A.ink,
    marginBottom: Spacing.xs,
  },
  linkedBody: {
    ...Typography.preset.body,
    color: A.ink2,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Footer
  footerActions: {
    paddingTop: Spacing.lg,
  },
  removeButton: {
    height: Spacing.buttonHeight.md,
    borderRadius: Spacing.radius.full,
    backgroundColor: A.glass, borderColor: A.edge, borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    ...Typography.preset.bodySemibold,
    color: A.error,
  },
});
