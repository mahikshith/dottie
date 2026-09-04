/**
 * Your data, as a spreadsheet — with the graphs already drawn.
 *
 * Owner ask: "under a user section, introduce a feature where we track every
 * single thing ... the mood for a particular day and the calendar logging
 * information, everything ... store it in the form of an Excel sheet ... embed
 * beautiful graphs in those Excel sheets ... so that the user can download it."
 *
 * ─── WHAT THIS SCREEN IS HONEST ABOUT ───────────────────────────────
 *
 *  It exports what the user ENTERED — periods, cycles, moods, symptoms, and the
 *  predictions Dottie made from them. It is not tap telemetry. Dottie doesn't
 *  follow people around its own screens, and a privacy-first tracker that
 *  quietly started doing so would have stopped being one. The screen says that
 *  plainly rather than implying a surveillance log the app doesn't keep.
 *
 *  The counts are read BEFORE the button, so nobody taps Export and receives a
 *  file full of nothing. With nothing logged, the button says so instead.
 *
 * ─── THE FILE ───────────────────────────────────────────────────────
 *
 *  A real .xlsx with up to eight sheets and seven native Excel charts, built on
 *  the phone by src/export (a hand-written ZIP + SpreadsheetML writer — no
 *  dependency ships a chart-capable xlsx small enough for a React Native
 *  bundle). The charts reference cell ranges rather than being pictures, so
 *  they stay live when the user edits or filters the data. Verified end to end
 *  by test:export.
 */

import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { PressableScale, AuroraBackground, GlassCard, GradientButton } from '../../src/components/ui';
import { useAurora } from '../../src/theme';
import { useUserStore } from '../../src/stores';
import { APP_VERSION } from '../../src/constants/build-info';
import { log } from '../../src/diagnostics/logger';
import { logSilentFailure } from '../../src/diagnostics/silent-failure';
import {
  gatherExportData,
  summariseExport,
  writeExportFile,
  shareExportFile,
  discardExport,
} from '../../src/services/data-export';
import type { ExportCounts, ExportInput } from '../../src/export/build-export';

type Status =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'building' }
  | { kind: 'done'; fileName: string; bytes: number }
  | { kind: 'error'; message: string };

const SHEETS: { emoji: string; title: string; body: string }[] = [
  { emoji: '📋', title: 'Overview', body: 'Your averages, each one next to the number of days it was calculated from.' },
  { emoji: '🔄', title: 'Cycles', body: 'Every completed cycle, with a line chart of how your cycle length has moved.' },
  { emoji: '🩸', title: 'Period days', body: 'Each logged day and its flow, charted day by day.' },
  { emoji: '💭', title: 'Daily check-ins', body: 'Mood, energy, sleep and stress on one chart — and your notes.' },
  { emoji: '📊', title: 'Mood dynamics', body: 'How your days have felt, as a share of the days you actually logged.' },
  { emoji: '🌡️', title: 'Symptoms', body: 'Every symptom you logged, plus a chart of what comes up most.' },
  { emoji: '🔮', title: 'Predictions', body: 'What Dottie predicted, what actually happened, and how far off it was.' },
];

export default function ExportDataScreen(): JSX.Element {
  const insets = useSafeAreaInsets();
  const { palette } = useAurora();
  const userId = useUserStore((s) => s.userId);
  const user = useUserStore((s) => s.user);

  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [counts, setCounts] = useState<ExportCounts | null>(null);
  const [data, setData] = useState<ExportInput | null>(null);

  // Read the counts up front so the screen can tell the truth about what's in
  // the file before anyone commits to making one.
  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setStatus({ kind: 'error', message: 'No profile loaded yet.' });
      return;
    }
    gatherExportData({
      userId,
      displayName: user?.displayName ?? null,
      healthProfile: user?.healthProfile ?? null,
      appVersion: APP_VERSION,
    })
      .then((gathered) => {
        if (cancelled) return;
        setData(gathered);
        setCounts(summariseExport(gathered));
        setStatus({ kind: 'ready' });
      })
      .catch((err) => {
        logSilentFailure('export.gather', err);
        if (!cancelled) setStatus({ kind: 'error', message: 'Could not read your data.' });
      });
    return () => {
      cancelled = true;
    };
  }, [userId, user?.displayName, user?.healthProfile]);

  const onExport = useCallback(async () => {
    if (!data) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    log.tap('export.build');
    setStatus({ kind: 'building' });
    try {
      const file = await writeExportFile(data);
      const shared = await shareExportFile(file);
      setStatus({ kind: 'done', fileName: file.fileName, bytes: file.bytes });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // The cached copy exists only to feed the share sheet. Once that has
      // closed, delete it — the user's real copy is wherever they sent it.
      if (shared) await discardExport(file);
      else setStatus({ kind: 'error', message: 'This device has no way to share files.' });
    } catch (err) {
      logSilentFailure('export.write', err);
      setStatus({ kind: 'error', message: 'Could not build the file. Nothing was sent anywhere.' });
    }
  }, [data]);

  const nothingLogged = counts !== null && counts.total === 0;

  return (
    <AuroraBackground>
      <StatusBar style="light" />
      <Stack.Screen options={{ title: 'Download your data' }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Spacing.lg, paddingBottom: insets.bottom + Spacing['3xl'] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(360)}>
          <Text style={[styles.title, { color: palette.ink }]}>
            Everything you&apos;ve logged, in one spreadsheet
          </Text>
          <Text style={[styles.lede, { color: palette.ink2 }]}>
            A real Excel file with the graphs already drawn — built here on your phone.
            It goes nowhere until you choose where to send it.
          </Text>
        </Animated.View>

        {/* What's actually in it, counted before the button. */}
        <Animated.View entering={FadeInDown.duration(360).delay(60)}>
          <GlassCard style={styles.countsCard} padding={Spacing.cardPadding}>
            {status.kind === 'loading' ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={palette.accent} />
                <Text style={[styles.loadingText, { color: palette.ink3 }]}>
                  Counting what you&apos;ve logged…
                </Text>
              </View>
            ) : counts ? (
              <>
                <Text style={[styles.countsTitle, { color: palette.ink }]}>In your file</Text>
                <CountRow label="Cycles" value={counts.cycles} palette={palette} />
                <CountRow label="Period days" value={counts.periodDays} palette={palette} />
                <CountRow label="Daily check-ins" value={counts.checkIns} palette={palette} />
                <CountRow label="Symptoms logged" value={counts.symptoms} palette={palette} />
                <CountRow label="Predictions" value={counts.predictions} palette={palette} />
                {nothingLogged ? (
                  <Text style={[styles.emptyNote, { color: palette.ink3 }]}>
                    Nothing logged yet — so there&apos;d be nothing in the file but the
                    headings. Log a period day or a check-in and come back.
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={[styles.emptyNote, { color: palette.ink3 }]}>
                {status.kind === 'error' ? status.message : ''}
              </Text>
            )}
          </GlassCard>
        </Animated.View>

        {/* The sheets, so the file isn't a surprise. */}
        <Animated.View entering={FadeInDown.duration(360).delay(120)}>
          <Text style={[styles.sectionLabel, { color: palette.ink3 }]}>WHAT&apos;S ON EACH SHEET</Text>
          {SHEETS.map((s) => (
            <View key={s.title} style={styles.sheetRow}>
              <Text style={styles.sheetEmoji}>{s.emoji}</Text>
              <View style={styles.sheetText}>
                <Text style={[styles.sheetTitle, { color: palette.ink }]}>{s.title}</Text>
                <Text style={[styles.sheetBody, { color: palette.ink3 }]}>{s.body}</Text>
              </View>
            </View>
          ))}
          <Text style={[styles.sheetFoot, { color: palette.ink3 }]}>
            A sheet with nothing to show is left out rather than shipped empty.
          </Text>
        </Animated.View>

        {/* The button. */}
        <Animated.View entering={FadeInDown.duration(360).delay(180)} style={styles.actions}>
          <GradientButton
            label={
              status.kind === 'building'
                ? 'Building your file…'
                : status.kind === 'done'
                  ? 'Export again'
                  : 'Build and share my file'
            }
            leadingEmoji="📗"
            onPress={onExport}
            loading={status.kind === 'building'}
            disabled={status.kind !== 'ready' && status.kind !== 'done'}
            accessibilityLabel="Build your data file and open the share sheet"
          />
          {status.kind === 'done' ? (
            <Animated.Text
              entering={FadeIn.duration(240)}
              style={[styles.doneText, { color: palette.accent }]}
            >
              ✓ {status.fileName} · {formatSize(status.bytes)}
            </Animated.Text>
          ) : null}
          {status.kind === 'error' ? (
            <Text style={[styles.errorText, { color: palette.ink2 }]}>{status.message}</Text>
          ) : null}
        </Animated.View>

        {/* The honest bit about what this is and isn't. */}
        <Animated.View entering={FadeInDown.duration(360).delay(240)}>
          <View
            style={[
              styles.privacy,
              { borderColor: palette.glass.edge, backgroundColor: palette.glass.bg },
            ]}
          >
            <Text style={[styles.privacyTitle, { color: palette.ink }]}>
              🔒 What this does and doesn&apos;t include
            </Text>
            <Text style={[styles.privacyBody, { color: palette.ink2 }]}>
              It includes what you entered: period days, cycles, moods, notes, symptoms and
              the predictions Dottie made from them.
            </Text>
            <Text style={[styles.privacyBody, { color: palette.ink2 }]}>
              It does not include a record of which screens you opened or which buttons you
              pressed. Dottie doesn&apos;t keep one — and building this file was not a reason
              to start.
            </Text>
            <Text style={[styles.privacyBody, { color: palette.ink2 }]}>
              The file is assembled on this phone and passed straight to whatever you pick
              from the share sheet. Nothing is uploaded. The temporary copy is deleted the
              moment the sheet closes.
            </Text>
            <Text style={[styles.privacyBody, { color: palette.ink3 }]}>
              Once you send it, it lives wherever you sent it — this is a health record, so
              choose that destination the way you&apos;d choose who to hand a paper one to.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </AuroraBackground>
  );
}

// ─── SUBCOMPONENTS ───────────────────────────────────────────────────

type Palette = ReturnType<typeof useAurora>['palette'];

function CountRow({
  label,
  value,
  palette,
}: {
  label: string;
  value: number;
  palette: Palette;
}): JSX.Element {
  return (
    <View style={styles.countRow}>
      <Text style={[styles.countLabel, { color: palette.ink2 }]}>{label}</Text>
      <Text
        style={[styles.countValue, { color: value > 0 ? palette.accent : palette.ink3 }]}
      >
        {value}
      </Text>
    </View>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.screenPadding, gap: Spacing.lg },
  title: { ...Typography.preset.h3 },
  lede: { ...Typography.preset.body, marginTop: Spacing.sm },
  countsCard: { gap: 6 },
  countsTitle: { ...Typography.preset.bodySemibold, marginBottom: Spacing.xs },
  countRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  countLabel: { ...Typography.preset.caption },
  countValue: { ...Typography.preset.bodySemibold },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  loadingText: { ...Typography.preset.caption },
  emptyNote: { ...Typography.preset.caption, lineHeight: 19, marginTop: Spacing.sm },
  sectionLabel: { ...Typography.preset.overline, marginBottom: Spacing.sm },
  sheetRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  sheetEmoji: { fontSize: 18, width: 24 },
  sheetText: { flex: 1 },
  sheetTitle: { ...Typography.preset.bodySemibold },
  sheetBody: { ...Typography.preset.caption, fontSize: 12, lineHeight: 17 },
  sheetFoot: { ...Typography.preset.caption, fontSize: 11, fontStyle: 'italic' },
  actions: { gap: Spacing.md },
  doneText: { ...Typography.preset.caption, textAlign: 'center' },
  errorText: { ...Typography.preset.caption, textAlign: 'center' },
  privacy: {
    borderWidth: 1,
    borderRadius: Spacing.radius.xl,
    padding: Spacing.cardPadding,
    gap: Spacing.sm,
  },
  privacyTitle: { ...Typography.preset.bodySemibold },
  privacyBody: { ...Typography.preset.caption, lineHeight: 19 },
});
