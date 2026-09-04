/**
 * Dottie — About this build
 *
 * Where the build identity lives now. It used to be a floating badge pinned to
 * the top-right of every tab screen, which put a cream-coloured tag over the
 * Home hero — right where the day ring belongs — and made the whole corner look
 * like a sticker someone forgot to peel off (device-test-8).
 *
 * A tester still needs the exact build string to file a useful report, so it
 * isn't deleted; it's moved somewhere you go on purpose. Tap the summary to
 * copy the whole block into a bug report.
 */

import { View, Text, StyleSheet, ScrollView, Share } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { A } from '../../src/theme';
import { AuroraBackground, PressableScale } from '../../src/components/ui';
import {
  APP_VERSION,
  BUILD_NUMBER,
  BUILD_LABEL,
  BETA_COHORT_NAME,
  IS_BETA_BUILD,
  FEEDBACK_TO_EMAIL,
  getBuildInfoClipboardText,
} from '../../src/constants/build-info';

function Row({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} selectable>
        {value}
      </Text>
    </View>
  );
}

export default function AboutBuildScreen(): JSX.Element {
  const insets = useSafeAreaInsets();

  const share = () => {
    Haptics.selectionAsync().catch(() => {});
    Share.share({ message: getBuildInfoClipboardText() }).catch(() => {});
  };

  return (
    <AuroraBackground>
      <StatusBar style="light" />
      <Stack.Screen
        options={{
          title: 'About this build',
          headerShown: true,
          headerStyle: { backgroundColor: A.ground },
          headerTintColor: A.ink,
        }}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing['4xl'] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.badge}>{BUILD_LABEL}</Text>
          <Row label="Version" value={APP_VERSION} />
          <Row label="Build" value={BUILD_NUMBER} />
          <Row label="Channel" value={IS_BETA_BUILD ? `Beta · ${BETA_COHORT_NAME}` : 'Release'} />
          <Row label="Feedback to" value={FEEDBACK_TO_EMAIL} />
        </View>

        <PressableScale
          onPress={share}
          haptic="none"
          accessibilityRole="button"
          accessibilityLabel="Share build details"
          style={styles.shareBtn}
        >
          <Text style={styles.shareText}>Share these details</Text>
        </PressableScale>

        <Text style={styles.note}>
          Handy when you report something: the build number tells us exactly
          which version you were on. For a full trace of what the app was doing,
          use Diagnostics instead — it records the steps, not just the version.
        </Text>
      </ScrollView>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: Spacing.screenPadding, paddingTop: Spacing.base },
  card: {
    backgroundColor: A.glass,
    borderWidth: 1,
    borderColor: A.edge,
    borderRadius: Spacing.radius.xl,
    padding: Spacing.cardPadding,
    gap: Spacing.sm,
  },
  badge: {
    ...Typography.preset.bodySemibold,
    color: A.accent,
    marginBottom: Spacing.xs,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md },
  rowLabel: { ...Typography.preset.caption, color: A.ink3 },
  rowValue: { ...Typography.preset.caption, color: A.ink, flexShrink: 1, textAlign: 'right' },
  shareBtn: {
    marginTop: Spacing.base,
    borderWidth: 1,
    borderColor: A.accent,
    borderRadius: Spacing.radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  shareText: { ...Typography.preset.bodySemibold, color: A.accent },
  note: {
    ...Typography.preset.caption,
    color: A.ink3,
    lineHeight: 17,
    marginTop: Spacing.base,
  },
});
