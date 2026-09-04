/**
 * Diagnostics — the shareable log (owner-requested).
 *
 * "I need a logger I can share with you so you can trace the steps, where the
 * mistakes were made, where the screen freezes." This is that screen.
 *
 * ─── PRIVACY IS THE DEFAULT, NOT THE OPTION ─────────────────────────
 *
 *  The log leaves the phone when it's shared, and this app holds menstrual
 *  health data. So it ships REDACTED: the shape of what happened (which screen,
 *  which control, in what order, how long each step took) with every date, flow,
 *  mood, symptom and note masked. "Include my cycle details" is an explicit,
 *  clearly-labelled opt-in the user makes per report — never a default we chose
 *  for them.
 *
 *  Sharing uses React Native's built-in Share sheet, so no new dependency and
 *  the user picks where it goes.
 */

import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Share } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { PressableScale, AuroraBackground, GlassCard } from '../../src/components/ui';
import { useAurora } from '../../src/theme';
import { getEvents, clearEvents, log } from '../../src/diagnostics/logger';
import { formatReport, formatEvent } from '../../src/diagnostics/log-format';
import { APP_VERSION } from '../../src/constants/build-info';

/** Share sheets choke on very large payloads — send the most recent slice. */
const MAX_SHARED_EVENTS = 400;

export default function DiagnosticsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { palette } = useAurora();

  const [detailed, setDetailed] = useState(false);
  const [version, setVersion] = useState(0); // bump to re-read the buffer
  const [status, setStatus] = useState<string | null>(null);

  const events = useMemo(() => getEvents(), [version]);

  const freezes = events.filter((e) => e.cat === 'freeze').length;
  const errors = events.filter((e) => e.cat === 'error').length;

  const buildReport = (): string =>
    formatReport(events.slice(-MAX_SHARED_EVENTS), detailed, {
      app: APP_VERSION,
      generated: new Date().toISOString(),
      freezes,
      errors,
    });

  const onShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await Share.share({ message: buildReport(), title: 'Dottie diagnostic log' });
      setStatus('Shared. Paste it into the chat and I can trace the steps.');
    } catch {
      setStatus("Couldn't open the share sheet on this device.");
    }
  };

  const onClear = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    clearEvents();
    setVersion((v) => v + 1);
    setStatus('Cleared. Reproduce the bug now, then share.');
  };

  // Newest first on screen (easiest to spot what just happened); the SHARED
  // report stays oldest-first so it reads as a sequence.
  const shown = [...events].reverse().slice(0, 200);

  return (
    <AuroraBackground>
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing['3xl'] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <PressableScale
            onPress={() => router.back()}
            haptic="light"
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Text style={[styles.back, { color: palette.accent }]}>‹ Back</Text>
          </PressableScale>
        </View>

        <Text style={[styles.title, { color: palette.ink }]}>Diagnostics</Text>
        <Text style={[styles.subtitle, { color: palette.ink2 }]}>
          A trail of what happened in the app — screens, taps, timings, and any freeze
          or error. It stays on your phone until you choose to share it.
        </Text>

        {/* Summary */}
        <GlassCard style={styles.card}>
          <View style={styles.statRow}>
            <Stat label="Events" value={String(events.length)} palette={palette} />
            <Stat label="Freezes" value={String(freezes)} palette={palette} highlight={freezes > 0} />
            <Stat label="Errors" value={String(errors)} palette={palette} highlight={errors > 0} />
          </View>
        </GlassCard>

        {/* Privacy switch */}
        <GlassCard style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text style={[styles.switchTitle, { color: palette.ink }]}>
                Include my cycle details
              </Text>
              <Text style={[styles.switchBody, { color: palette.ink2 }]}>
                {detailed
                  ? 'ON — the shared log will include real dates, flow levels, moods and notes.'
                  : 'OFF — dates and health values are masked. The steps and timings are still there, which is usually all that is needed to find a bug.'}
              </Text>
            </View>
            <Switch
              value={detailed}
              onValueChange={(v) => {
                Haptics.selectionAsync().catch(() => {});
                setDetailed(v);
                log.action('diagnostics:detail', { on: v });
              }}
              trackColor={{ false: palette.glass.edge, true: palette.accent }}
            />
          </View>
        </GlassCard>

        {/* Actions */}
        <View style={styles.actions}>
          <PressableScale
            onPress={onShare}
            haptic="none"
            style={[styles.primaryBtn, { backgroundColor: palette.accent }]}
            accessibilityRole="button"
            accessibilityLabel="Share the diagnostic log"
          >
            <Text style={[styles.primaryBtnText, { color: palette.ground }]}>Share log</Text>
          </PressableScale>
          <PressableScale
            onPress={onClear}
            haptic="none"
            style={[styles.secondaryBtn, { borderColor: palette.glass.edge }]}
            accessibilityRole="button"
            accessibilityLabel="Clear the diagnostic log"
          >
            <Text style={[styles.secondaryBtnText, { color: palette.ink2 }]}>Clear</Text>
          </PressableScale>
        </View>

        {status && (
          <Text style={[styles.status, { color: palette.accent }]}>{status}</Text>
        )}

        <Text style={[styles.hint, { color: palette.ink3 }]}>
          To report a bug: tap Clear, reproduce it, come back and tap Share.
        </Text>

        {/* Live tail */}
        <Text style={[styles.sectionLabel, { color: palette.ink3 }]}>MOST RECENT FIRST</Text>
        <GlassCard style={styles.logCard}>
          {shown.length === 0 ? (
            <Text style={[styles.empty, { color: palette.ink3 }]}>
              Nothing logged yet. Move around the app and come back.
            </Text>
          ) : (
            shown.map((e, i) => (
              <Text
                key={`${e.t}_${i}`}
                style={[
                  styles.logLine,
                  {
                    color:
                      e.cat === 'freeze' || e.lvl === 'error'
                        ? palette.accent2
                        : palette.ink3,
                  },
                ]}
              >
                {formatEvent(e, detailed)}
              </Text>
            ))
          )}
        </GlassCard>

        <View style={{ height: Spacing['4xl'] }} />
      </ScrollView>
    </AuroraBackground>
  );
}

function Stat({
  label,
  value,
  palette,
  highlight,
}: {
  label: string;
  value: string;
  palette: ReturnType<typeof useAurora>['palette'];
  highlight?: boolean;
}): JSX.Element {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: highlight ? palette.accent2 : palette.ink }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: palette.ink3 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.screenPadding },
  header: { marginBottom: Spacing.sm },
  back: { ...Typography.preset.bodySemibold },
  title: { ...Typography.preset.h2, marginBottom: Spacing.xs },
  subtitle: { ...Typography.preset.body, lineHeight: 22, marginBottom: Spacing.base },
  card: { marginBottom: Spacing.md },
  statRow: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { ...Typography.preset.number },
  statLabel: { ...Typography.preset.caption },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  switchText: { flex: 1 },
  switchTitle: { ...Typography.preset.bodySemibold, marginBottom: 2 },
  switchBody: { ...Typography.preset.caption, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  primaryBtn: {
    flex: 1,
    height: Spacing.buttonHeight.md,
    borderRadius: Spacing.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { ...Typography.preset.button },
  secondaryBtn: {
    paddingHorizontal: Spacing.lg,
    height: Spacing.buttonHeight.md,
    borderRadius: Spacing.radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: { ...Typography.preset.bodySemibold },
  status: { ...Typography.preset.caption, marginBottom: Spacing.sm },
  hint: { ...Typography.preset.caption, marginBottom: Spacing.base, lineHeight: 18 },
  sectionLabel: { ...Typography.preset.overline, letterSpacing: 1, marginBottom: Spacing.xs },
  logCard: { gap: 2 },
  logLine: { fontSize: 10.5, lineHeight: 15, fontFamily: undefined },
  empty: { ...Typography.preset.caption, textAlign: 'center', paddingVertical: Spacing.lg },
});
