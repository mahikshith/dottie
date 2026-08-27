/**
 * Profile Tab — MOOD AURORA THEME (design-v2)
 *
 * Live user stats, companion display, and settings — re-skinned onto the aurora
 * world: luminous dark ground, glass stat/level/settings cards, palette ink
 * throughout. The companion's own accent (companion.accentColor) stays for the
 * mode badge + level bar so the companion keeps its identity while the
 * surrounding surfaces re-tint with the mood palette.
 *
 * ─── WHAT CHANGED IN THIS PASS ──────────────────────────────────────
 *
 *  Presentation only. Every selector, handler, navigation target, the live
 *  ghost-mode subtitle, and all copy are unchanged. Colours moved to the
 *  palette (inline); the StyleSheet is layout only:
 *   - Screen wrapped in <AuroraBackground>; StatusBar flipped to light.
 *   - Stat cards, level card, and settings rows are glass surfaces.
 *   - Companion breathing hero + PopOnChange stat pops are preserved.
 *
 *  ─── WHAT'S WIRED (unchanged) ──────────────────────────────────────
 *   Sisterhood Circle  → /(sisterhood)/circle
 *   Doctor Report      → /(profile)/doctor-report
 *   Ghost Mode         → /(profile)/ghost-mode
 *   Medications / Notifications / Theme / Export → gentle "coming soon" noop.
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device).
 */

import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { PressableScale, PopOnChange, BreathingView, AuroraBackground, GlassCard } from '../../src/components/ui';
import { useAurora } from '../../src/theme';
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

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useAurora();

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

  const handleRemindersTap = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push('/(profile)/reminders');
  };

  const handlePrivacyTap = () => {
    Haptics.selectionAsync().catch(() => {});
    router.push('/(profile)/privacy');
  };

  const handleComingSoon = (title: string) => {
    Haptics.selectionAsync().catch(() => {});
    // For now, a no-op. Wired in future chunks.
    if (__DEV__) console.log(`[Profile] "${title}" coming in a future chunk`);
  };

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <AuroraBackground>
      <StatusBar style="light" />
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
          <Text style={[styles.companionName, { color: palette.ink }]}>{companion.name}</Text>
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
        <Animated.View entering={rise(220)}>
          <GlassCard style={styles.levelCard} padding={Spacing.cardPadding}>
            <View style={styles.levelHeader}>
              <Text style={[styles.levelLabel, { color: palette.ink }]}>
                Level {currentLevel} — {levelProgress.currentLevel.name} {levelProgress.currentLevel.emoji}
              </Text>
              {!levelProgress.isMaxLevel && (
                <Text style={[styles.levelXP, { color: palette.ink3 }]}>
                  {levelProgress.xpInCurrentLevel} / {levelProgress.xpNeededForNext} XP
                </Text>
              )}
            </View>
            <View style={[styles.progressBarBg, { backgroundColor: palette.glass.edge }]}>
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
              <Text style={[styles.nextLevelHint, { color: palette.ink3 }]}>
                Next: {levelProgress.nextLevel.name} {levelProgress.nextLevel.emoji}
              </Text>
            )}
          </GlassCard>
        </Animated.View>

        {/* Settings List */}
        <View style={styles.settingsSection}>
          <Animated.View entering={rise(300)}>
            <Text style={[styles.sectionTitle, { color: palette.ink }]}>Settings</Text>
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

          {/* ✅ Shipped — Privacy & data (the trust screen) */}
          <Animated.View entering={rise(535)}>
            <SettingsItem
              emoji="🔒"
              title="Privacy & your data"
              subtitle="Local-first — your data never leaves this phone"
              onPress={handlePrivacyTap}
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
              title="Reminders"
              subtitle="Gentle local nudges, your way"
              onPress={handleRemindersTap}
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
    </AuroraBackground>
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
  const { palette } = useAurora();
  return (
    <GlassCard style={styles.statCard} padding={Spacing.md}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <PopOnChange value={value}>
        <Text style={[styles.statValue, { color: palette.ink }]}>{value}</Text>
      </PopOnChange>
      <Text style={[styles.statLabel, { color: palette.ink3 }]}>{label}</Text>
    </GlassCard>
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
  const { palette } = useAurora();
  return (
    <PressableScale
      style={[
        styles.settingsItem,
        { backgroundColor: palette.glass.bg, borderColor: palette.glass.edge },
      ]}
      onPress={onPress}
      haptic="none"
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
    >
      <Text style={styles.settingsEmoji}>{emoji}</Text>
      <View style={styles.settingsContent}>
        <Text style={[styles.settingsTitle, { color: palette.ink }]}>{title}</Text>
        <Text style={[styles.settingsSubtitle, { color: palette.ink3 }]}>{subtitle}</Text>
      </View>
      <Text style={[styles.settingsArrow, { color: palette.ink3 }]}>›</Text>
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

// ─── STYLES (layout only — colours are inline, palette-driven) ───────

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    marginBottom: Spacing.sm,
  },
  modeBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Spacing.radius.full,
  },
  modeBadgeText: {
    ...Typography.preset.captionBold,
    color: '#FFFFFF',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sectionGap,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statEmoji: {
    fontSize: 20,
    marginBottom: Spacing.xs,
  },
  statValue: {
    ...Typography.preset.number,
    fontSize: 20,
  },
  statLabel: {
    ...Typography.preset.caption,
  },
  levelCard: {
    marginBottom: Spacing.sectionGap,
  },
  levelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  levelLabel: {
    ...Typography.preset.bodySemibold,
    flexShrink: 1,
  },
  levelXP: {
    ...Typography.preset.caption,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  nextLevelHint: {
    ...Typography.preset.caption,
    marginTop: Spacing.sm,
  },
  settingsSection: {
    gap: Spacing.xs,
  },
  sectionTitle: {
    ...Typography.preset.h4,
    marginBottom: Spacing.md,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    padding: Spacing.cardPadding,
    borderRadius: Spacing.radius.xl,
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
  },
  settingsSubtitle: {
    ...Typography.preset.caption,
  },
  settingsArrow: {
    fontSize: 24,
  },
});
