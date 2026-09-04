/**
 * Ghost Mode Settings Screen
 *
 * The single place users go to turn Ghost Mode on, change their PIN,
 * configure panic wipe, and disable it. Lives under (profile) so it
 * sits alongside the doctor-report screen and any future privacy
 * settings.
 *
 * ─── FLOW DESIGN ────────────────────────────────────────────────────
 *
 *  When DISABLED (no PIN set yet):
 *    [ Big sage button: "Set up Ghost Mode" ]
 *    Below: warm explanation of what it does, what it doesn't do,
 *    and a small "What is Ghost Mode?" expandable section.
 *
 *  Tap "Set up" → enters set-pin flow:
 *    Step 1: enter new PIN
 *    Step 2: confirm new PIN
 *    On match: enabled. Lands back on this screen now showing the
 *    ENABLED view.
 *
 *  When ENABLED:
 *    • Master toggle (off = full disable, wipes the PIN)
 *    • "Change PIN" button (re-enters set-pin flow)
 *    • Panic PIN section (set / clear / toggle wipe)
 *    • Disguise app name toggle
 *    • Route wrong PIN to decoy toggle
 *    • "Lock now" button — instantly drops to the lock screen
 *
 * ─── SAFETY COPY ────────────────────────────────────────────────────
 *
 *  Plain, honest, non-scary copy throughout. We explicitly say:
 *    - "If you forget your PIN, you'll lose access to your data."
 *    - "Panic wipe deletes everything. There's no undo."
 *    - "Ghost Mode is a privacy feature, not security software."
 *
 *  No dark patterns. No false confidence.
 */

import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  SafeAreaView,
} from 'react-native';
import { showAppDialog } from '../../src/components/ui/appDialog';
import { Stack, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { Shadows } from '../../src/constants/shadows';
import { PinPad } from '../../src/components/safety/PinPad';
import { useGhostModeStore, selectConfigVersion } from '../../src/security/ghost-mode-store';
import {
  GhostModeConfig,
  MIN_PIN_LENGTH,
} from '../../src/types/ghost-mode.types';

type Step =
  | { kind: 'overview' }
  | { kind: 'set_main_enter' }
  | { kind: 'set_main_confirm'; firstPin: string }
  | { kind: 'set_panic_enter' }
  | { kind: 'set_panic_confirm'; firstPin: string };

// ─── COMPONENT ───────────────────────────────────────────────────────

export default function GhostModeSettingsScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: 'overview' });
  const [pin, setPin] = useState('');
  const [errorKey, setErrorKey] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Subscribe to the store's own configVersion beacon (a plain number, stable
  // snapshot) and recompute the config OBJECT via useMemo. Prior code called
  // `s.getConfig()` directly in the selector — that returns a fresh object
  // each render, which under Zustand v5 / useSyncExternalStore trips the
  // "getSnapshot should be cached" guard → "Maximum update depth exceeded".
  const configVersion = useGhostModeStore(selectConfigVersion);
  const config: GhostModeConfig = useMemo(
    () => useGhostModeStore.getState().getConfig(),
    [configVersion]
  );

  // ─── Step machine for set-pin flows ─────────────────────────────

  // Every mutation (setPin / disable / updateConfig / setPanicPin) already
  // bumps `configVersion` inside the store, which re-runs the memo above.
  // No local bump needed — bumpConfig() is a no-op kept for call-site clarity.
  const bumpConfig = () => {};

  const startSetMain = () => {
    setPin('');
    setErrorMessage(null);
    setStep({ kind: 'set_main_enter' });
  };

  const startSetPanic = () => {
    setPin('');
    setErrorMessage(null);
    setStep({ kind: 'set_panic_enter' });
  };

  const cancelSetFlow = () => {
    setPin('');
    setErrorMessage(null);
    setStep({ kind: 'overview' });
  };

  // Step submit handlers
  const handleSetMainEnterSubmit = (typedPin: string) => {
    setStep({ kind: 'set_main_confirm', firstPin: typedPin });
    setPin('');
    setErrorMessage(null);
  };

  const handleSetMainConfirmSubmit = (typedPin: string) => {
    if (step.kind !== 'set_main_confirm') return;
    if (typedPin !== step.firstPin) {
      setPin('');
      setErrorKey((k) => k + 1);
      setErrorMessage("PINs don't match — try again");
      setStep({ kind: 'set_main_enter' });
      return;
    }
    const result = useGhostModeStore.getState().setPin(typedPin);
    if (!result.ok) {
      setPin('');
      setErrorKey((k) => k + 1);
      setErrorMessage(setPinErrorMessage(result.reason));
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setPin('');
    setErrorMessage(null);
    setStep({ kind: 'overview' });
    bumpConfig();
  };

  const handleSetPanicEnterSubmit = (typedPin: string) => {
    setStep({ kind: 'set_panic_confirm', firstPin: typedPin });
    setPin('');
    setErrorMessage(null);
  };

  const handleSetPanicConfirmSubmit = (typedPin: string) => {
    if (step.kind !== 'set_panic_confirm') return;
    if (typedPin !== step.firstPin) {
      setPin('');
      setErrorKey((k) => k + 1);
      setErrorMessage("PINs don't match — try again");
      setStep({ kind: 'set_panic_enter' });
      return;
    }
    const result = useGhostModeStore.getState().setPanicPin(typedPin);
    if (!result.ok) {
      setPin('');
      setErrorKey((k) => k + 1);
      setErrorMessage(setPinErrorMessage(result.reason));
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setPin('');
    setErrorMessage(null);
    setStep({ kind: 'overview' });
    bumpConfig();
  };

  // ─── Toggles ────────────────────────────────────────────────────

  const handleMasterToggle = (next: boolean) => {
    if (next) {
      startSetMain();
      return;
    }
    showAppDialog({
      emoji: '🔓',
      title: 'Turn off Ghost Mode?',
      body: 'Your PIN will be erased. You can always set it up again later.',
      actions: [
        { label: 'Cancel', variant: 'ghost', onPress: () => {} },
        {
          label: 'Turn off',
          variant: 'danger',
          onPress: () => {
            useGhostModeStore.getState().disable();
            bumpConfig();
          },
        },
      ],
    });
  };

  const handleClearPanicPin = () => {
    showAppDialog({
      emoji: '🔑',
      title: 'Remove panic PIN?',
      body: "You'll keep your main Ghost Mode PIN, but the panic PIN will no longer work.",
      actions: [
        { label: 'Cancel', variant: 'ghost', onPress: () => {} },
        {
          label: 'Remove',
          onPress: () => {
            useGhostModeStore.getState().setPanicPin(null);
            bumpConfig();
          },
        },
      ],
    });
  };

  const handleTogglePanicWipe = (next: boolean) => {
    if (next) {
      showAppDialog({
        emoji: '⚠️',
        title: 'Enable panic wipe?',
        body: 'When the panic PIN is entered, all your Dottie data will be silently deleted. There is no undo.\n\nReally enable this?',
        actions: [
          { label: 'Cancel', variant: 'ghost', onPress: () => {} },
          {
            label: 'Enable',
            variant: 'danger',
            onPress: () => {
              useGhostModeStore.getState().updateConfig({ panicWipeEnabled: true });
              bumpConfig();
            },
          },
        ],
      });
    } else {
      useGhostModeStore.getState().updateConfig({ panicWipeEnabled: false });
      bumpConfig();
    }
  };

  const handleToggleDisguise = (next: boolean) => {
    useGhostModeStore.getState().updateConfig({ disguiseAppName: next });
    bumpConfig();
  };

  const handleToggleDecoyOnFailure = (next: boolean) => {
    useGhostModeStore.getState().updateConfig({ routeToDecoyOnFailure: next });
    bumpConfig();
    // Teach the way out at the moment it starts mattering. Switching this on is
    // the point where a wrong PIN silently drops you into the journal, so it is
    // also the point where not knowing the gesture becomes a real problem.
    if (next) {
      showAppDialog({
        emoji: '🌿',
        title: 'How to get back out',
        body:
          'A wrong PIN now shows a plant journal instead of an error.\n\n' +
          'To leave it: tap "Refresh garden" at the bottom three times quickly, ' +
          'or press your phone\u2019s back button. Either returns you to the PIN screen.\n\n' +
          'This is written down under "Getting back from the journal" below, ' +
          'so you never have to remember it cold.',
        actions: [{ label: 'Got it', onPress: () => {} }],
      });
    }
  };

  // Decoy appearance: on → 'aurora' (dark), off → 'cream' (classic journal).
  // The owner chooses which disguise reads as more convincing to them.
  const handleToggleDecoyTheme = (next: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    useGhostModeStore.getState().updateConfig({ decoyTheme: next ? 'aurora' : 'cream' });
    bumpConfig();
  };

  const handleLockNow = () => {
    Haptics.selectionAsync().catch(() => {});
    useGhostModeStore.getState().lockNow('manual_lock');
    // The root layout will overlay the lock screen automatically.
    // Pop this screen so the user lands back on Profile on unlock.
    router.back();
  };

  // ─── RENDER ─────────────────────────────────────────────────────

  // PIN entry overlay for set-pin flows
  if (step.kind !== 'overview') {
    const isConfirm =
      step.kind === 'set_main_confirm' || step.kind === 'set_panic_confirm';
    const isPanic =
      step.kind === 'set_panic_enter' || step.kind === 'set_panic_confirm';

    const helperText = isPanic
      ? isConfirm
        ? 'Confirm your panic PIN'
        : 'Choose a panic PIN (different from your main PIN)'
      : isConfirm
        ? 'Confirm your new PIN'
        : 'Choose a new PIN (4 digits)';

    const onSubmit =
      step.kind === 'set_main_enter' ? handleSetMainEnterSubmit :
      step.kind === 'set_main_confirm' ? handleSetMainConfirmSubmit :
      step.kind === 'set_panic_enter' ? handleSetPanicEnterSubmit :
      handleSetPanicConfirmSubmit;

    return (
      <>
        <Stack.Screen
          options={{
            title: isPanic ? 'Set Panic PIN' : 'Set PIN',
            headerBackTitle: 'Back',
          }}
        />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.pinFlowContainer}>
            <PinPad
              value={pin}
              onChange={setPin}
              onSubmit={onSubmit}
              length={MIN_PIN_LENGTH}
              showCancel
              onCancel={cancelSetFlow}
              errorKey={errorKey}
              helperText={helperText}
              errorMessage={errorMessage ?? undefined}
            />
          </View>
        </SafeAreaView>
      </>
    );
  }

  // ─── OVERVIEW ───────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen options={{ title: 'Ghost Mode', headerBackTitle: 'Back' }} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🔒</Text>
          <Text style={styles.heroTitle}>
            {config.enabled ? 'Ghost Mode is on' : 'Keep Dottie just for you'}
          </Text>
          <Text style={styles.heroBody}>
            {config.enabled
              ? 'A PIN protects your data. Wrong PIN sends a snooper to a calm plant journal instead.'
              : 'Add a PIN so only you can open Dottie. We can even pretend to be a different app to anyone glancing over your shoulder.'}
          </Text>
        </View>

        {/* Master toggle */}
        <SettingCard>
          <View style={styles.settingRow}>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingTitle}>Ghost Mode</Text>
              <Text style={styles.settingSubtitle}>
                {config.enabled ? 'PIN required to open Dottie' : 'Off — anyone with the phone can open Dottie'}
              </Text>
            </View>
            <Switch
              value={config.enabled}
              onValueChange={handleMasterToggle}
              trackColor={{ false: Colors.border.medium, true: Colors.primary.coral }}
            />
          </View>
        </SettingCard>

        {config.enabled && (
          <>
            {/* Change PIN */}
            <SettingCard>
              <Pressable
                onPress={startSetMain}
                style={({ pressed }) => [
                  styles.settingButtonRow,
                  pressed && styles.settingPressed,
                ]}
              >
                <View style={styles.settingTextWrap}>
                  <Text style={styles.settingTitle}>Change PIN</Text>
                  <Text style={styles.settingSubtitle}>
                    Pick a new 4-digit PIN
                  </Text>
                </View>
                <Text style={styles.settingChevron}>›</Text>
              </Pressable>
            </SettingCard>

            {/* Lock now */}
            <SettingCard>
              <Pressable
                onPress={handleLockNow}
                style={({ pressed }) => [
                  styles.settingButtonRow,
                  pressed && styles.settingPressed,
                ]}
              >
                <View style={styles.settingTextWrap}>
                  <Text style={styles.settingTitle}>Lock now</Text>
                  <Text style={styles.settingSubtitle}>
                    Drop straight to the lock screen
                  </Text>
                </View>
                <Text style={styles.settingChevron}>›</Text>
              </Pressable>
            </SettingCard>

            {/* Disguise app name */}
            <SettingCard>
              <View style={styles.settingRow}>
                <View style={styles.settingTextWrap}>
                  <Text style={styles.settingTitle}>Disguise app name</Text>
                  <Text style={styles.settingSubtitle}>
                    Lock screen poses as "Garden Notes"
                  </Text>
                </View>
                <Switch
                  value={config.disguiseAppName}
                  onValueChange={handleToggleDisguise}
                  trackColor={{ false: Colors.border.medium, true: Colors.primary.coral }}
                />
              </View>
            </SettingCard>

            {/* Route to decoy on failure */}
            <SettingCard>
              <View style={styles.settingRow}>
                <View style={styles.settingTextWrap}>
                  <Text style={styles.settingTitle}>Wrong PIN → plant journal</Text>
                  <Text style={styles.settingSubtitle}>
                    Snoopers see notes instead of a "wrong PIN" error
                  </Text>
                </View>
                <Switch
                  value={config.routeToDecoyOnFailure}
                  onValueChange={handleToggleDecoyOnFailure}
                  trackColor={{ false: Colors.border.medium, true: Colors.primary.coral }}
                />
              </View>
            </SettingCard>

            {/* Decoy appearance — cream vs aurora */}
            <SettingCard>
              <View style={styles.settingRow}>
                <View style={styles.settingTextWrap}>
                  <Text style={styles.settingTitle}>Plant journal style</Text>
                  <Text style={styles.settingSubtitle}>
                    {config.decoyTheme === 'aurora'
                      ? 'Dark aurora look — matches Dottie'
                      : 'Classic cream look — a warm notebook'}
                  </Text>
                </View>
                <Switch
                  value={config.decoyTheme === 'aurora'}
                  onValueChange={handleToggleDecoyTheme}
                  trackColor={{ false: Colors.border.medium, true: Colors.primary.coral }}
                />
              </View>
            </SettingCard>

            {/* ─── HOW TO GET BACK OUT ────────────────────────────
                An escape hatch nobody can find is not an escape hatch. The
                decoy hides the exit ON PURPOSE — a visible "back to Dottie"
                button would tell a snooper the journal is a front — but that
                same secrecy meant the owner couldn't get out either, and had
                no way to learn the gesture (device-test-10). So it is written
                down here, inside Ghost Mode settings: the one place you go
                deliberately, and the one place a casual snooper won't. */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>Getting back from the journal</Text>
            </View>
            <SettingCard>
              <View style={styles.settingTextWrap}>
                <Text style={styles.settingTitle}>Two ways out — remember one</Text>
                <Text style={styles.settingSubtitle}>
                  1. Scroll to the bottom of the plant journal and tap
                  &ldquo;Refresh garden&rdquo; <Text style={styles.escapeStrong}>three times</Text> quickly
                  (within two seconds). It looks like an ordinary utility link.
                  {'\n\n'}
                  2. Or press your phone&apos;s <Text style={styles.escapeStrong}>back</Text> button.
                  {'\n\n'}
                  Either takes you to the PIN screen, where your real PIN opens
                  Dottie. Nothing on the journal hints at this — that is the
                  point of it.
                </Text>
              </View>
            </SettingCard>

            {/* Panic PIN section */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>Panic PIN</Text>
            </View>
            <SettingCard>
              <Pressable
                onPress={startSetPanic}
                style={({ pressed }) => [
                  styles.settingButtonRow,
                  pressed && styles.settingPressed,
                ]}
              >
                <View style={styles.settingTextWrap}>
                  <Text style={styles.settingTitle}>
                    Set panic PIN
                  </Text>
                  <Text style={styles.settingSubtitle}>
                    A second PIN that silently sends a snooper to the plant journal
                  </Text>
                </View>
                <Text style={styles.settingChevron}>›</Text>
              </Pressable>
              <View style={styles.divider} />
              <Pressable
                onPress={handleClearPanicPin}
                style={({ pressed }) => [
                  styles.settingButtonRow,
                  pressed && styles.settingPressed,
                ]}
              >
                <View style={styles.settingTextWrap}>
                  <Text style={[styles.settingTitle, styles.dangerText]}>
                    Remove panic PIN
                  </Text>
                </View>
              </Pressable>
            </SettingCard>

            <SettingCard>
              <View style={styles.settingRow}>
                <View style={styles.settingTextWrap}>
                  <Text style={[styles.settingTitle, styles.dangerText]}>
                    Wipe everything on panic PIN
                  </Text>
                  <Text style={styles.settingSubtitle}>
                    Entering the panic PIN deletes all your data — silently and immediately. No undo.
                  </Text>
                </View>
                <Switch
                  value={config.panicWipeEnabled}
                  onValueChange={handleTogglePanicWipe}
                  trackColor={{ false: Colors.border.medium, true: Colors.semantic.error }}
                />
              </View>
            </SettingCard>
          </>
        )}

        {/* Honest disclaimer footer */}
        <View style={styles.footerNote}>
          <Text style={styles.footerNoteText}>
            Ghost Mode is a <Text style={styles.footerNoteEmphasis}>privacy</Text> feature, not security software. It keeps casual eyes out of your data — it isn't designed to defeat a forensic investigator. If you forget your PIN, your data is gone.
          </Text>
        </View>

        <View style={{ height: Spacing['3xl'] }} />
      </ScrollView>
    </>
  );
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────────────

function SettingCard({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

// ─── HELPERS ─────────────────────────────────────────────────────────

function setPinErrorMessage(reason: 'too_short' | 'too_long' | 'non_numeric'): string {
  switch (reason) {
    case 'too_short':   return `Choose at least ${MIN_PIN_LENGTH} digits`;
    case 'too_long':    return 'PIN is too long';
    case 'non_numeric': return 'Use digits only';
  }
}

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.surface.background,
  },
  scroll: {
    flex: 1,
    backgroundColor: Colors.surface.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },

  // PIN flow screen
  pinFlowContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenPadding,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  heroEmoji: {
    fontSize: 48,
    marginBottom: Spacing.sm,
  },
  heroTitle: {
    ...Typography.preset.h3,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  heroBody: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.base,
  },

  // Setting cards
  card: {
    backgroundColor: Colors.surface.card,
    borderRadius: Spacing.radius.xl,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.cardPadding,
    gap: Spacing.base,
  },
  settingButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.cardPadding,
    gap: Spacing.base,
  },
  settingPressed: {
    backgroundColor: Colors.surface.cardElevated,
  },
  settingTextWrap: {
    flex: 1,
  },
  settingTitle: {
    ...Typography.preset.bodySemibold,
    color: Colors.text.primary,
  },
  escapeStrong: {
    fontWeight: '700',
    color: Colors.primary.coral,
  },
  settingSubtitle: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
    marginTop: 2,
    lineHeight: 18,
  },
  settingChevron: {
    fontSize: 24,
    color: Colors.text.tertiary,
    fontWeight: '300' as const,
  },
  dangerText: {
    color: Colors.semantic.error,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border.light,
    marginHorizontal: Spacing.cardPadding,
  },

  // Section header
  sectionHeader: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  sectionHeaderText: {
    ...Typography.preset.overline,
    color: Colors.text.tertiary,
  },

  // Footer note
  footerNote: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.lg,
  },
  footerNoteText: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
    lineHeight: 18,
    textAlign: 'center',
  },
  footerNoteEmphasis: {
    ...Typography.preset.captionBold,
    color: Colors.text.secondary,
  },
});
