import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { Shadows } from '../../src/constants/shadows';
import { PressableScale, PopOnChange, BreathingView } from '../../src/components/ui';
import {
  useUserStore,
  useGamificationStore,
  useSisterhoodStore,
  selectCompanionType,
  selectUserMode,
  selectStreak,
  selectGemsBalance,
  selectXpTotal,
  selectCurrentLevel,
  selectLevelProgress,
  selectMemberCount,
} from '../../src/stores';
import {
  useGhostModeStore,
  selectIsGhostEnabled,
} from '../../src/security/ghost-mode-store';
import { getCompanion } from '../../src/content/companions';

/**
 * Profile Tab — Live user stats, companion display, settings.
 *
 * ─── PREMIUM POLISH PASS (Phase 2) ──────────────────────────────────
 *
 *  Presentation-only pass that activates the shared motion system. No
 *  handler, selector, navigation target, or copy string changed.
 *
 *   - Entrance choreography: the companion header, stats grid, level
 *     card, and each settings row fade + rise in a gentle stagger
 *     (Reanimated `FadeInDown`, UI thread) so the screen assembles with
 *     intent on every visit. `entering` fires on mount only, so live
 *     store updates (streak/gems/ghost-mode) never re-trigger it.
 *   - The companion hero emoji now sits in a soft breathing loop
 *     (BreathingView) so it reads as a living companion, not a static
 *     glyph.
 *   - Every stat number (streak / XP / gems / badges) "pops" (PopOnChange)
 *     the instant its underlying value changes, so progress feels earned.
 *   - Settings rows are now spring-press surfaces (PressableScale) for
 *     buttery 60fps tap feedback. Their handlers already fire a selection
 *     haptic, so PressableScale runs haptic="none" to avoid a double buzz.
 *   - Real safe-area insets replace the fixed top padding.
 *
 *  All motion honors "Reduce Motion" via the shared primitives.
 *
 * ─── WHAT'S WIRED ───────────────────────────────────────────────────
 *
 *  Sisterhood Circle  → /(sisterhood)/circle      (Chunk 8)
 *  Doctor Report      → /(profile)/doctor-report  (Chunk 10 Batch 1)
 *  Ghost Mode         → /(profile)/ghost-mode     (Chunk 11)
 *
 *  Unshipped rows (Medications, Notifications, Theme, Export) stay
 *  visible as roadmap teasers but tap into a gentle "coming soon"
 *  noop until those PRs land. We deliberately keep them visible to
 *  signal direction to early testers.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const companionType = useUserStore(selectCompanionType);
  const userMode = useUserStore(selectUserMode);
  const streak = useGamificationStore(selectStreak);
  const gemsBalance = useGamificationStore(selectGemsBalance);
  const xpTotal = useGamificationStore(selectXpTotal);
  const currentLevel = useGamificationStore(selectCurrentLevel);
  const levelProgress = useGamificationStore(selectLevelProgress);
  const badgesEarned = useGamificationStore((s) => s.badgesEarned);
  const sisterCount = useSisterhoodStore(selectMemberCount);

  // Live subscription to ghost-mode enablement. Re-runs whenever
  // the store's configVersion or lockState changes, so the subtitle
  // refreshes the instant the user enables/disables ghost mode from
  // the settings screen.
  const ghostEnabled = useGhostModeStore(selectIsGhostEnabled);

  const companion = getCompanion(companionType);

  // Pretty progress percentage (clamped 0-100)
  const progressPct = Math.round(levelProgress.progressPercent * 100);

  // ─── Handlers ───────────────────────────────────────────────────

  const handleSisterhoodTap = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push('/(sisterhood)/circle');
  };

  const handleDoctorReportTap = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push('/(profile)/doctor-report');
  };

  const handleGhostModeTap = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push('/(profile)/ghost-mode');
  };

  const handleComingSoon = (title: string) => {
    Haptics.selectionAsync().catch(() => {});
    // For now, a no-op. Wired in future chunks.
    if (__DEV__) console.log(`[Profile] "${title}" coming in a future chunk`);
  };

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingTop: insets.top + Spacing.lg },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Companion & Identity */}
      <Animated.View entering={rise(60)} style={styles.profileHeader}>
        <BreathingView>
          <Text style={styles.companionEmoji}>{companion.emoji}</Text>
        </BreathingView>
        <Text style={styles.companionName}>{companion.name}</Text>
        <View style={[styles.modeBadge, { backgroundColor: companion.accentColor }]}>
          <Text style={styles.modeBadgeText}>{formatMode(userMode)}</Text>
        </View>
      </Animated.View>

      {/* Stats Grid */}
      <Animated.View entering={rise(140)} style={styles.statsGrid}>
        <StatCard emoji="🔥" value={String(streak.currentStreak)} label="Streak" />
        <StatCard emoji="⭐" value={String(xpTotal)} label="XP" />
        <StatCard emoji="💎" value={String(gemsBalance)} label="Gems" />
        <StatCard emoji="🏅" value={String(badgesEarned.length)} label="Badges" />
      </Animated.View>

      {/* Level Progress */}
      <Animated.View entering={rise(220)} style={styles.levelCard}>
        <View style={styles.levelHeader}>
          <Text style={styles.levelLabel}>
            Level {currentLevel} — {levelProgress.currentLevel.name} {levelProgress.currentLevel.emoji}
          </Text>
          {!levelProgress.isMaxLevel && (
            <Text style={styles.levelXP}>
              {levelProgress.xpInCurrentLevel} / {levelProgress.xpNeededForNext} XP
            </Text>
          )}
        </View>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${Math.max(2, progressPct)}%`,
                backgroundColor: companion.accentColor,
              },
            ]}
          />
        </View>
        {levelProgress.nextLevel && (
          <Text style={styles.nextLevelHint}>
            Next: {levelProgress.nextLevel.name} {levelProgress.nextLevel.emoji}
          </Text>
        )}
      </Animated.View>

      {/* Settings List */}
      <View style={styles.settingsSection}>
        <Animated.View entering={rise(300)}>
          <Text style={styles.sectionTitle}>Settings</Text>
        </Animated.View>

        {/* ✅ Shipped — Sisterhood Circle */}
        <Animated.View entering={rise(360)}>
          <SettingsItem
            emoji="👯"
            title="Sisterhood Circle"
            subtitle={
              sisterCount > 0
                ? `${sisterCount} ${sisterCount === 1 ? 'sister' : 'sisters'} in your circle`
                : 'Connect friends & family'
            }
            onPress={handleSisterhoodTap}
          />
        </Animated.View>

        {/* ✅ Shipped — Doctor Report */}
        <Animated.View entering={rise(430)}>
          <SettingsItem
            emoji="🩺"
            title="Doctor Report"
            subtitle="Gentle summary you can share"
            onPress={handleDoctorReportTap}
          />
        </Animated.View>

        {/* ✅ Shipped — Ghost Mode (live subtitle, see selector above) */}
        <Animated.View entering={rise(500)}>
          <SettingsItem
            emoji="🔒"
            title="Ghost Mode"
            subtitle={
              ghostEnabled
                ? 'PIN protection is on'
                : 'Set up a PIN to keep Dottie private'
            }
            onPress={handleGhostModeTap}
          />
        </Animated.View>

        {/* 🌱 Coming soon */}
        <Animated.View entering={rise(570)}>
          <SettingsItem
            emoji="💊"
            title="Medications"
            subtitle="Track birth control & meds · coming soon"
            onPress={() => handleComingSoon('Medications')}
          />
        </Animated.View>
        <Animated.View entering={rise(640)}>
          <SettingsItem
            emoji="🔔"
            title="Notifications"
            subtitle="Discrete reminders · coming soon"
            onPress={() => handleComingSoon('Notifications')}
          />
        </Animated.View>
        <Animated.View entering={rise(710)}>
          <SettingsItem
            emoji="🎨"
            title="Theme"
            subtitle="Customize your look · coming soon"
            onPress={() => handleComingSoon('Theme')}
          />
        </Animated.View>
        <Animated.View entering={rise(780)}>
          <SettingsItem
            emoji="📤"
            title="Export Data"
            subtitle="Your data belongs to you · coming soon"
            onPress={() => handleComingSoon('Export Data')}
          />
        </Animated.View>
      </View>

      {/* Bottom padding */}
      <View style={{ height: Spacing.tabBarHeight + Spacing.xl }} />
    </ScrollView>
  );
}

// ─── SUBCOMPONENTS ───────────────────────────────────────────────────

function StatCard({
  emoji,
  value,
  label,
}: {
  emoji: string;
  value: string;
  label: string;
}): JSX.Element {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <PopOnChange value={value}>
        <Text style={styles.statValue}>{value}</Text>
      </PopOnChange>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SettingsItem({
  emoji,
  title,
  subtitle,
  onPress,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
}): JSX.Element {
  return (
    <PressableScale
      style={styles.settingsItem}
      onPress={onPress}
      haptic="none"
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
    >
      <Text style={styles.settingsEmoji}>{emoji}</Text>
      <View style={styles.settingsContent}>
        <Text style={styles.settingsTitle}>{title}</Text>
        <Text style={styles.settingsSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.settingsArrow}>›</Text>
    </PressableScale>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────

// Shared entrance rhythm — fade + rise with a soft spring settle. Runs on
// mount only, so live store updates never re-trigger it.
function rise(delayMs: number) {
  return FadeInDown.duration(480).delay(delayMs).springify().damping(16);
}

function formatMode(mode: string): string {
  switch (mode) {
    case 'teen':
      return 'Teen Mode';
    case 'endocrine':
      return 'Endocrine Mode';
    case 'adult':
    default:
      return 'Adult Mode';
  }
}

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface.background,
  },
  contentContainer: {
    paddingHorizontal: Spacing.screenPadding,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  companionEmoji: {
    fontSize: 64,
    marginBottom: Spacing.sm,
  },
  companionName: {
    ...Typography.preset.h3,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  modeBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Spacing.radius.full,
  },
  modeBadgeText: {
    ...Typography.preset.captionBold,
    color: Colors.text.inverse,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sectionGap,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface.card,
    padding: Spacing.md,
    borderRadius: Spacing.radius.xl,
    alignItems: 'center',
    ...Shadows.sm,
  },
  statEmoji: {
    fontSize: 20,
    marginBottom: Spacing.xs,
  },
  statValue: {
    ...Typography.preset.number,
    fontSize: 20,
    color: Colors.text.primary,
  },
  statLabel: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
  },
  levelCard: {
    backgroundColor: Colors.surface.card,
    padding: Spacing.cardPadding,
    borderRadius: Spacing.radius.xl,
    marginBottom: Spacing.sectionGap,
    ...Shadows.sm,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  levelLabel: {
    ...Typography.preset.bodySemibold,
    color: Colors.text.primary,
    flexShrink: 1,
  },
  levelXP: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: Colors.surface.background,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  nextLevelHint: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
    marginTop: Spacing.sm,
  },
  settingsSection: {
    gap: Spacing.xs,
  },
  sectionTitle: {
    ...Typography.preset.h4,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.card,
    padding: Spacing.cardPadding,
    borderRadius: Spacing.radius.xl,
    ...Shadows.sm,
  },
  settingsEmoji: {
    fontSize: 24,
    marginRight: Spacing.md,
  },
  settingsContent: {
    flex: 1,
  },
  settingsTitle: {
    ...Typography.preset.bodySemibold,
    color: Colors.text.primary,
  },
  settingsSubtitle: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
  },
  settingsArrow: {
    fontSize: 24,
    color: Colors.text.tertiary,
  },
});
