import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Share,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { AuroraBackground } from '../../src/components/ui';
import { A } from '../../src/theme';
import {
  useReportStore,
  selectCachedReport,
  selectIsGeneratingReport,
  selectReportError,
} from '../../src/stores';
import { ReportRangePreset } from '../../src/types/report.types';
import { formatDoctorReportText } from '../../src/engine/reports/doctor-report';
import { ReportPreview } from '../../src/components/reports/ReportPreview';
import { logSilentFailure } from '../../src/diagnostics/silent-failure';

/**
 * Doctor Report Screen
 *
 * ─── USER FLOW ──────────────────────────────────────────────────────
 *
 *  1. Pick a date range (30 / 90 / 180 / 365 days)
 *  2. Tap "Create summary" → engine aggregates → preview renders
 *  3. Tap "Share" → native Share sheet opens with plain-text report
 *  4. Tap "Choose different range" → goes back to range picker
 *
 *  Range and template state live locally on the screen. The cached
 *  report and generation status live in the store so the preview
 *  survives quick screen re-mounts.
 */
export default function DoctorReportScreen() {
  const [selectedRange, setSelectedRange] = useState<ReportRangePreset>(90);

  const cachedReport = useReportStore(selectCachedReport);
  const isGenerating = useReportStore(selectIsGeneratingReport);
  const error = useReportStore(selectReportError);
  const generateReport = useReportStore((s) => s.generateReport);
  const clearReport = useReportStore((s) => s.clearReport);

  // ─── Handlers ───────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    Haptics.selectionAsync().catch(() => {});
    try {
      await generateReport(selectedRange, 'standard');
    } catch {
      // Error is already in store.lastError — UI will display it
    }
  }, [generateReport, selectedRange]);

  const handleShare = useCallback(async () => {
    if (!cachedReport) return;
    Haptics.selectionAsync().catch(() => {});
    try {
      const text = formatDoctorReportText(cachedReport);
      await Share.share({
        message: text,
        title: 'Dottie Health Summary',
      });
    } catch (err) {
      logSilentFailure('doctorReport.share', err);
    }
  }, [cachedReport]);

  const handleChangeRange = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    clearReport();
  }, [clearReport]);

  // ─── Render ─────────────────────────────────────────────────────

  // After generation → show the preview + Share/Change-range CTAs
  if (cachedReport) {
    return (
      <AuroraBackground>
        <StatusBar style="light" />
        <View style={styles.container}>
        <View style={styles.previewWrap}>
          <ReportPreview data={cachedReport} />
        </View>
        <View style={styles.footerBar}>
          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleChangeRange}
          >
            <Text style={styles.secondaryButtonText}>Choose different range</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={handleShare}
          >
            <Text style={styles.primaryButtonText}>Share summary</Text>
          </Pressable>
        </View>
        </View>
      </AuroraBackground>
    );
  }

  // Pre-generation → range picker + generate CTA
  return (
    <AuroraBackground>
      <StatusBar style="light" />
      <View style={styles.container}>
      <View style={styles.scrollWrap}>
        {/* Intro */}
        <View style={styles.intro}>
          <Text style={styles.introEmoji}>🩺</Text>
          <Text style={styles.introTitle}>Your health, your story</Text>
          <Text style={styles.introBody}>
            Generate a gentle summary of your cycles, symptoms, and wellbeing
            that you can share with your doctor. Everything stays on your
            device — only the summary you choose to share leaves.
          </Text>
        </View>

        {/* Range picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Time range</Text>
          <View style={styles.rangeGrid}>
            <RangePill
              label="30 days"
              preset={30}
              selected={selectedRange === 30}
              onPress={() => setSelectedRange(30)}
            />
            <RangePill
              label="90 days"
              preset={90}
              selected={selectedRange === 90}
              onPress={() => setSelectedRange(90)}
            />
            <RangePill
              label="6 months"
              preset={180}
              selected={selectedRange === 180}
              onPress={() => setSelectedRange(180)}
            />
            <RangePill
              label="12 months"
              preset={365}
              selected={selectedRange === 365}
              onPress={() => setSelectedRange(365)}
            />
          </View>
        </View>

        {/* Template — only Standard in v1 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Summary style</Text>
          <View style={styles.templateRow}>
            <View style={styles.templatePillActive}>
              <Text style={styles.templatePillTextActive}>Standard</Text>
            </View>
            <View style={styles.templatePillDisabled}>
              <Text style={styles.templatePillTextDisabled}>PCOS · soon</Text>
            </View>
            <View style={styles.templatePillDisabled}>
              <Text style={styles.templatePillTextDisabled}>Fertility · soon</Text>
            </View>
          </View>
        </View>

        {/* Error surface */}
        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>
              We hit a tiny snag generating your summary. Mind trying again?
            </Text>
          </View>
        ) : null}
      </View>

      {/* Generate CTA */}
      <View style={styles.footerBar}>
        <Pressable
          style={({ pressed }) => [
            styles.primaryButtonWide,
            (pressed || isGenerating) && styles.buttonPressed,
          ]}
          onPress={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <ActivityIndicator color={A.ground} />
          ) : (
            <Text style={styles.primaryButtonText}>Create summary</Text>
          )}
        </Pressable>
      </View>
      </View>
    </AuroraBackground>
  );
}

// ─── SUBCOMPONENTS ───────────────────────────────────────────────────

function RangePill({
  label,
  preset: _preset,
  selected,
  onPress,
}: {
  label: string;
  preset: ReportRangePreset;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.rangePill,
        selected && styles.rangePillSelected,
        pressed && styles.buttonPressed,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.rangePillText,
          selected && styles.rangePillTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollWrap: {
    flex: 1,
    padding: Spacing.screenPadding,
  },
  previewWrap: {
    flex: 1,
  },

  // Intro
  intro: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.sectionGap,
    alignItems: 'center',
  },
  introEmoji: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  introTitle: {
    ...Typography.preset.h2,
    color: A.ink,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  introBody: {
    ...Typography.preset.body,
    color: A.ink2,
    textAlign: 'center',
    paddingHorizontal: Spacing.sm,
  },

  // Sections
  section: {
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    ...Typography.preset.captionBold,
    color: A.ink3,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },

  // Range picker
  rangeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  rangePill: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Spacing.radius.full,
    backgroundColor: A.glass, borderColor: A.edge, borderWidth: 1,
    minWidth: 96,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  rangePillSelected: {
    backgroundColor: A.accent,
    borderColor: A.accent,
  },
  rangePillText: {
    ...Typography.preset.buttonSmall,
    color: A.ink,
  },
  rangePillTextSelected: {
    color: A.ground,
  },

  // Template pills
  templateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  templatePillActive: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Spacing.radius.full,
    backgroundColor: A.accent2,
  },
  templatePillTextActive: {
    ...Typography.preset.captionBold,
    color: A.ground,
  },
  templatePillDisabled: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Spacing.radius.full,
    backgroundColor: A.glass2, borderColor: A.edge, borderWidth: 1,
  },
  templatePillTextDisabled: {
    ...Typography.preset.caption,
    color: A.ink3,
  },

  // Error card
  errorCard: {
    backgroundColor: A.glass2, borderColor: A.edge, borderWidth: 1,
    padding: Spacing.md,
    borderRadius: Spacing.radius.lg,
    marginTop: Spacing.sm,
  },
  errorText: {
    ...Typography.preset.body,
    color: A.ink2,
  },

  // Footer (CTAs)
  footerBar: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.screenPadding,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    backgroundColor: A.ground,
    borderTopWidth: 1,
    borderTopColor: A.edge,
  },
  primaryButtonWide: {
    flex: 1,
    height: Spacing.buttonHeight.lg,
    borderRadius: Spacing.radius.full,
    backgroundColor: A.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 6,
  },
  primaryButton: {
    flex: 1,
    height: Spacing.buttonHeight.md,
    borderRadius: Spacing.radius.full,
    backgroundColor: A.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 6,
  },
  primaryButtonText: {
    ...Typography.preset.button,
    color: A.ground,
  },
  secondaryButton: {
    flex: 1,
    height: Spacing.buttonHeight.md,
    borderRadius: Spacing.radius.full,
    backgroundColor: A.glass, borderColor: A.edge, borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  secondaryButtonText: {
    ...Typography.preset.button,
    color: A.ink,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
