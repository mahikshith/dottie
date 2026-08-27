/**
 * Privacy & Your Data (design-v2).
 *
 * The trust screen. Surfaces the single thing Dottie does better than almost
 * every competitor: your cycle data is **local-first** — it lives on THIS phone,
 * not on our servers, so there's nothing to sell, leak, or hand over. This is a
 * genuine differentiator (competitors have been fined/sued for sharing intimate
 * health data), and the research says users care about it most — so we say it
 * plainly and give the controls to back it up.
 *
 *  ⚠️ design-v2 / UNVERIFIED (no device). Pure UI + wiring to existing flows
 *  (deleteAccount, doctor report, ghost mode, reminders).
 */

import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { AuroraBackground, GlassCard, PressableScale } from '../../src/components/ui';
import { useAurora } from '../../src/theme';
import { useUserStore } from '../../src/stores';

const PROMISES: { emoji: string; title: string; body: string }[] = [
  { emoji: '📱', title: 'On your device, not our servers', body: 'Your cycle, symptoms and notes are stored on this phone. Dottie has no account, no cloud copy of your health data.' },
  { emoji: '🚫', title: 'Never sold, never ads', body: 'There is no data to sell — and we never would. No advertisers, no data brokers, no “app events.”' },
  { emoji: '🕵️', title: 'No third-party trackers', body: 'We don’t hand your activity to analytics giants. What happens in Dottie stays in Dottie.' },
  { emoji: '🕶️', title: 'Discreet by design', body: 'Notifications can hide the topic on your lock screen, so a glance never gives anything away.' },
];

export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useAurora();

  const go = (path: string) => {
    Haptics.selectionAsync().catch(() => {});
    router.push(path);
  };

  const confirmDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert(
      'Delete all your data?',
      'This permanently erases everything Dottie has on this device — cycles, symptoms, notes, progress. It cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            try {
              await useUserStore.getState().deleteAccount();
            } catch (err) {
              if (__DEV__) console.warn('[Privacy] deleteAccount failed:', err);
            }
            // Everything is wiped (incl. onboarding flag) → back to a fresh start.
            router.replace('/');
          },
        },
      ]
    );
  };

  return (
    <AuroraBackground>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <PressableScale onPress={() => router.back()} haptic="light" hitSlop={10} accessibilityRole="button" accessibilityLabel="Back">
            <Text style={[styles.back, { color: palette.accent }]}>‹ Back</Text>
          </PressableScale>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🔒</Text>
          <Text style={[styles.title, { color: palette.ink }]}>Your data stays on your phone</Text>
          <Text style={[styles.subtitle, { color: palette.ink2 }]}>
            Dottie is local-first. Your health data lives on this device — so there's nothing on a
            server to sell, leak, or be handed over.
          </Text>
        </View>

        {/* Promises */}
        {PROMISES.map((p) => (
          <GlassCard key={p.title} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowEmoji}>{p.emoji}</Text>
              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, { color: palette.ink }]}>{p.title}</Text>
                <Text style={[styles.rowBodyText, { color: palette.ink2 }]}>{p.body}</Text>
              </View>
            </View>
          </GlassCard>
        ))}

        {/* Controls */}
        <Text style={[styles.sectionLabel, { color: palette.ink3 }]}>YOU'RE IN CONTROL</Text>

        <ControlRow emoji="🔐" title="Ghost Mode" subtitle="Lock Dottie behind a PIN, with a decoy screen" onPress={() => go('/(profile)/ghost-mode')} />
        <ControlRow emoji="🔔" title="Reminders" subtitle="Local nudges — discreet on your lock screen" onPress={() => go('/(profile)/reminders')} />
        <ControlRow emoji="🩺" title="Doctor Report" subtitle="A summary YOU choose to share, when you want" onPress={() => go('/(profile)/doctor-report')} />
        <ControlRow emoji="🗑️" title="Delete all my data" subtitle="Erase everything on this device — permanent" danger onPress={confirmDelete} />

        <Text style={[styles.footnote, { color: palette.ink3 }]}>
          Many period apps have been caught sharing intimate data. Dottie was built so that can't
          happen — there's simply nothing on a server to leak. 💛
        </Text>

        <View style={{ height: Spacing['4xl'] }} />
      </ScrollView>
    </AuroraBackground>
  );
}

// ─── CONTROL ROW ─────────────────────────────────────────────────────

function ControlRow({
  emoji,
  title,
  subtitle,
  danger,
  onPress,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  danger?: boolean;
  onPress: () => void;
}): JSX.Element {
  const { palette } = useAurora();
  const dangerColor = '#FF7A8A';
  return (
    <PressableScale
      onPress={onPress}
      haptic="none"
      style={[
        styles.control,
        { backgroundColor: palette.glass.bg, borderColor: danger ? `${dangerColor}66` : palette.glass.edge },
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Text style={styles.rowEmoji}>{emoji}</Text>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: danger ? dangerColor : palette.ink }]}>{title}</Text>
        <Text style={[styles.controlSub, { color: palette.ink3 }]}>{subtitle}</Text>
      </View>
      <Text style={[styles.chevron, { color: palette.ink3 }]}>›</Text>
    </PressableScale>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.screenPadding },
  header: { marginBottom: Spacing.sm },
  back: { ...Typography.preset.bodySemibold },
  hero: { alignItems: 'center', marginBottom: Spacing.lg },
  heroEmoji: { fontSize: 48, marginBottom: Spacing.sm },
  title: { ...Typography.preset.h2, textAlign: 'center', marginBottom: Spacing.sm },
  subtitle: { ...Typography.preset.body, textAlign: 'center', lineHeight: 22 },
  card: { marginBottom: Spacing.base },
  row: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  rowEmoji: { fontSize: 22 },
  rowBody: { flex: 1 },
  rowTitle: { ...Typography.preset.bodySemibold },
  rowBodyText: { ...Typography.preset.caption, marginTop: 2, lineHeight: 18 },
  sectionLabel: { ...Typography.preset.overline, letterSpacing: 1, marginTop: Spacing.sm, marginBottom: Spacing.sm },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Spacing.radius.xl,
    padding: Spacing.cardPadding,
    marginBottom: Spacing.sm,
  },
  controlSub: { ...Typography.preset.caption, marginTop: 2 },
  chevron: { fontSize: 22 },
  footnote: { ...Typography.preset.caption, fontStyle: 'italic', textAlign: 'center', marginTop: Spacing.base, lineHeight: 18 },
});
