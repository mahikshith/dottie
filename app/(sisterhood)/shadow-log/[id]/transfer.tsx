import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Share,
  Clipboard,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { Typography } from '../../../../src/constants/typography';
import { Spacing } from '../../../../src/constants/spacing';
import { A } from '../../../../src/theme';
import { AuroraBackground } from '../../../../src/components/ui';
import { showAppDialog } from '../../../../src/components/ui/appDialog';
import {
  useUserStore,
  useSisterhoodStore,
  selectCompanionType,
  selectMemberById,
} from '../../../../src/stores';
import { getCompanion } from '../../../../src/content/companions';
import {
  ProfileTransferCode,
  TRANSFER_CODE_TTL_HOURS,
} from '../../../../src/types/sisterhood.types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logSilentFailure } from '../../../../src/diagnostics/silent-failure';

/**
 * Transfer-Code Handoff Sheet
 *
 * ─── WHAT THIS SCREEN DOES ──────────────────────────────────────────
 *
 *  Replaces the two-Alert flow from Batch 2A with a real screen that:
 *
 *    1. Generates a transfer code on mount (the store dedupes by
 *       calling the repo's `issueTransferCode`, which invalidates
 *       any older pending code first)
 *    2. Shows the 6-char code in a big, easy-to-read display
 *    3. Provides "Copy code" + "Share via..." actions
 *    4. Walks through the 3-step handoff plan in plain language
 *    5. Shows expiry time clearly so the primary knows the window
 *
 * ─── HONESTY NOTE ───────────────────────────────────────────────────
 *
 *  We're upfront in microcopy: the actual cross-device claim flow ships
 *  with the social plane. For MVP this code generates and stores
 *  locally — when {name} eventually gets Dottie, the "claim profile"
 *  flow during their onboarding will accept this code and pull the
 *  shadow data.
 *
 *  Better to tell the truth ("when they install Dottie") than to fake
 *  a delivery mechanism that doesn't exist yet.
 *
 * ─── PRIVACY ────────────────────────────────────────────────────────
 *
 *  The transfer code is shadow-data adjacent — only the primary can
 *  see and generate it. The code itself is meaningless without the
 *  full shadow profile state, which lives only on the primary's
 *  device. Even if someone intercepts the code, they can't claim
 *  anything without physical access to the originating device.
 */
export default function TransferScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const memberId = id ?? '';

  const userId = useUserStore((s) => s.userId);
  const companionType = useUserStore(selectCompanionType);
  const rawMember = useSisterhoodStore(selectMemberById(memberId));

  const companion = getCompanion(companionType);

  // ─── State ──────────────────────────────────────────────────────
  const [transferCode, setTransferCode] = useState<ProfileTransferCode | null>(null);
  const [isGenerating, setIsGenerating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Generate on mount ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    if (!userId || !rawMember || rawMember.kind !== 'shadow') {
      setIsGenerating(false);
      return;
    }

    (async () => {
      try {
        const code = await useSisterhoodStore.getState().issueTransferCode(memberId);
        if (cancelled) return;
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        ).catch(() => {});
        setTransferCode(code);
      } catch (err) {
        logSilentFailure('transfer.generate', err);
        if (!cancelled) setError("Couldn't generate a code right now. Please try again.");
      } finally {
        if (!cancelled) setIsGenerating(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, memberId, rawMember]);

  // ─── Handlers ───────────────────────────────────────────────────

  const handleCopy = () => {
    if (!transferCode) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // Clipboard API: expo-clipboard is the modern API but RN's bundled
    // Clipboard module still works on iOS/Android. We use whatever's
    // available without adding a new dependency.
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clip: any = Clipboard;
      if (clip?.setString) {
        clip.setString(transferCode.code);
      }
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      ).catch(() => {});
      showAppDialog({
        emoji: '💛',
        title: 'Copied',
        body: `Code ${transferCode.code} is on your clipboard.`,
        actions: [{ label: 'OK', onPress: () => {} }],
      });
    } catch {
      showAppDialog({
        emoji: '📋',
        title: 'Almost',
        body: "Couldn't copy automatically — long-press the code to copy manually.",
        actions: [{ label: 'OK', onPress: () => {} }],
      });
    }
  };

  const handleShare = async () => {
    if (!transferCode || !rawMember) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await Share.share({
        message: composeShareMessage(rawMember.displayName, transferCode.code),
        title: `Your Dottie transfer code`,
      });
    } catch (err) {
      logSilentFailure('transfer.share', err);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────

  if (!rawMember) {
    return (
      <AuroraBackground>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={A.accent} />
        </View>
      </AuroraBackground>
    );
  }

  if (rawMember.kind !== 'shadow') {
    return (
      <AuroraBackground>
        <StatusBar style="light" />
        <View style={styles.errorContainer}>
        <Text style={styles.errorEmoji}>🔗</Text>
        <Text style={styles.errorTitle}>Already linked</Text>
        <Text style={styles.errorBody}>
          {rawMember.displayName} already has their own Dottie. No handoff needed —
          they own their data already.
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.errorButton,
            pressed && { opacity: 0.92 },
          ]}
        >
          <Text style={styles.errorButtonText}>Got it</Text>
        </Pressable>
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
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing['3xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Handoff · {rawMember.displayName}</Text>
          <Text style={styles.title}>One little code, big trust 🤝</Text>
          <Text style={styles.subtitle}>
            When {rawMember.displayName} installs Dottie on their own phone,
            this code lets them claim everything you've tracked so far.
          </Text>
        </View>

        {/* Code display */}
        {isGenerating ? (
          <View style={styles.codeCardLoading}>
            <ActivityIndicator color={A.accent} size="large" />
            <Text style={styles.codeLoadingText}>
              {companion.name} is making a code...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.codeCardError}>
            <Text style={styles.codeErrorEmoji}>🌧️</Text>
            <Text style={styles.codeErrorText}>{error}</Text>
          </View>
        ) : transferCode ? (
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Transfer code</Text>
            <Pressable onPress={handleCopy}>
              <Text style={styles.codeValue}>{transferCode.code}</Text>
            </Pressable>
            <Text style={styles.codeExpiry}>
              ⏳ Expires in {TRANSFER_CODE_TTL_HOURS} hours
            </Text>
          </View>
        ) : null}

        {/* Actions */}
        {transferCode && (
          <View style={styles.actionRow}>
            <Pressable
              onPress={handleCopy}
              style={({ pressed }) => [
                styles.actionButton,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.actionEmoji}>📋</Text>
              <Text style={styles.actionLabel}>Copy code</Text>
            </Pressable>
            <Pressable
              onPress={handleShare}
              style={({ pressed }) => [
                styles.actionButton,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.actionEmoji}>📤</Text>
              <Text style={styles.actionLabel}>Share via...</Text>
            </Pressable>
          </View>
        )}

        {/* How it works */}
        <Text style={styles.sectionLabel}>How the handoff works</Text>
        <StepCard
          number={1}
          title={`Share the code with ${rawMember.displayName}`}
          body="Text it, say it out loud, or pass them your phone — whatever feels natural."
        />
        <StepCard
          number={2}
          title={`${rawMember.displayName} installs Dottie on their phone`}
          body="During onboarding, they'll see an option to claim an existing profile."
        />
        <StepCard
          number={3}
          title="They type the code"
          body={`Everything you've tracked moves over to them. They become a linked member in your circle.`}
        />

        {/* MVP honesty */}
        <View style={styles.noteCard}>
          <Text style={styles.noteEmoji}>💛</Text>
          <Text style={styles.noteText}>
            <Text style={styles.noteBold}>A gentle note:</Text> the actual
            cross-device claim ships with our next update. For now this code
            is generated and safely stored — when {rawMember.displayName}'s
            Dottie is ready to receive it, everything just works.
          </Text>
        </View>

        <View style={{ height: Spacing['4xl'] }} />
      </ScrollView>

      {/* Bottom action bar */}
      {/* Pinned bars clear the gesture bar themselves (device-test-19). */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && { opacity: 0.92, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={styles.primaryButtonText}>Done 💛</Text>
        </Pressable>
      </View>
      </View>
    </AuroraBackground>
  );
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────

function StepCard({
  number,
  title,
  body,
}: {
  number: number;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.stepCard}>
      <View style={styles.stepNumberWrap}>
        <Text style={styles.stepNumber}>{number}</Text>
      </View>
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepBody}>{body}</Text>
      </View>
    </View>
  );
}

// ─── COPY ────────────────────────────────────────────────────────────

function composeShareMessage(name: string, code: string): string {
  // We compose a message that feels like a sister sharing care — not a
  // marketing blast. The receiver gets a clear call-to-action without
  // any guilt-trip energy.
  return (
    `Hey ${name} 🌸\n\n` +
    `I've been keeping a little Dottie profile for you — period tracking, ` +
    `mood check-ins, the cozy stuff. When you're ready to take it over on ` +
    `your own phone, install Dottie and use this code to claim everything:\n\n` +
    `${code}\n\n` +
    `It expires in 24 hours. No rush 💛`
  );
}

// Touch Platform so future platform-specific behaviour doesn't get
// flagged as an unused import.
void Platform;

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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.lg,
  },
  // Header
  header: {
    marginBottom: Spacing.xl,
  },
  eyebrow: {
    ...Typography.preset.overline,
    color: A.accent,
    marginBottom: Spacing.xs,
  },
  title: {
    ...Typography.preset.h2,
    color: A.ink,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.preset.body,
    color: A.ink2,
    lineHeight: 22,
  },
  // Code card
  codeCard: {
    backgroundColor: A.glass, borderColor: A.edge, borderWidth: 1,
    padding: Spacing.cardPaddingLarge,
    borderRadius: Spacing.radius['3xl'],
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.45, shadowRadius: 28, elevation: 8,
  },
  codeCardLoading: {
    backgroundColor: A.glass, borderColor: A.edge, borderWidth: 1,
    padding: Spacing['3xl'],
    borderRadius: Spacing.radius['3xl'],
    alignItems: 'center',
    gap: Spacing.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 22, elevation: 6,
  },
  codeLoadingText: {
    ...Typography.preset.caption,
    color: A.ink3,
  },
  codeCardError: {
    backgroundColor: A.glass2, borderColor: A.edge, borderWidth: 1,
    padding: Spacing.cardPaddingLarge,
    borderRadius: Spacing.radius['2xl'],
    alignItems: 'center',
    gap: Spacing.sm,
  },
  codeErrorEmoji: {
    fontSize: 36,
  },
  codeErrorText: {
    ...Typography.preset.body,
    color: A.ink2,
    textAlign: 'center',
  },
  codeLabel: {
    ...Typography.preset.overline,
    color: A.ink3,
    marginBottom: Spacing.md,
  },
  codeValue: {
    fontSize: 56,
    fontWeight: '800',
    letterSpacing: 8,
    color: A.accent,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  codeExpiry: {
    ...Typography.preset.caption,
    color: A.ink3,
    marginTop: Spacing.md,
  },
  // Action row
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  actionButton: {
    flex: 1,
    backgroundColor: A.glass, borderColor: A.edge, borderWidth: 1,
    padding: Spacing.md,
    borderRadius: Spacing.radius.xl,
    alignItems: 'center',
    gap: Spacing.xs,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  actionEmoji: {
    fontSize: 24,
  },
  actionLabel: {
    ...Typography.preset.captionBold,
    color: A.ink,
  },
  // Section
  sectionLabel: {
    ...Typography.preset.captionBold,
    color: A.ink2,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: Spacing['2xl'],
    marginBottom: Spacing.sm,
  },
  // Step cards
  stepCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: A.glass, borderColor: A.edge, borderWidth: 1,
    padding: Spacing.cardPadding,
    borderRadius: Spacing.radius.xl,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 4,
  },
  stepNumberWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: A.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumber: {
    ...Typography.preset.bodySemibold,
    color: A.ground,
    fontSize: 16,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    ...Typography.preset.bodySemibold,
    color: A.ink,
    marginBottom: 2,
  },
  stepBody: {
    ...Typography.preset.caption,
    color: A.ink2,
    lineHeight: 18,
  },
  // Note card
  noteCard: {
    flexDirection: 'row',
    backgroundColor: A.glass2, borderColor: A.edge, borderWidth: 1,
    padding: Spacing.md,
    borderRadius: Spacing.radius.lg,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  noteEmoji: {
    fontSize: 20,
  },
  noteText: {
    ...Typography.preset.caption,
    color: A.ink2,
    flex: 1,
    lineHeight: 18,
  },
  noteBold: {
    fontWeight: '700',
    color: A.ink,
  },
  // Bottom bar (single button)
  bottomBar: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    backgroundColor: 'transparent',
    borderTopWidth: 1,
    borderTopColor: A.edge,
  },
  primaryButton: {
    height: Spacing.buttonHeight.lg,
    borderRadius: Spacing.radius.full,
    backgroundColor: A.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 6,
  },
  primaryButtonText: {
    ...Typography.preset.button,
    color: A.ground,
  },
  // Error state
  errorContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['3xl'],
    gap: Spacing.md,
  },
  errorEmoji: {
    fontSize: 64,
  },
  errorTitle: {
    ...Typography.preset.h3,
    color: A.ink,
    textAlign: 'center',
  },
  errorBody: {
    ...Typography.preset.body,
    color: A.ink2,
    textAlign: 'center',
    lineHeight: 22,
  },
  errorButton: {
    marginTop: Spacing.md,
    backgroundColor: A.accent,
    paddingHorizontal: Spacing['3xl'],
    height: Spacing.buttonHeight.md,
    borderRadius: Spacing.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorButtonText: {
    ...Typography.preset.button,
    color: A.ground,
  },
});
