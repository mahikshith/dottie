/**
 * DecoyHomeBody
 *
 * The actual UI of the "Garden Notes" decoy app. Decoupled from
 * Expo Router so the AppLockGate can render it as an overlay
 * without router context.
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  - Looks like a real notes app. Header, greeting, list of plant notes
 *    with dates. Tapping a plant card produces a soft haptic + does
 *    nothing visible. To a snooper it looks like a fully working app.
 *  - TWO skins, chosen by the owner in Ghost Mode settings and read
 *    live from `selectDecoyTheme`:
 *      • 'aurora' → dark liquid glass (default, matches the rest of Dottie)
 *      • 'cream'  → the classic warm plant-journal palette
 *    "Give the control to the user" — the owner decides which disguise
 *    they find more convincing.
 *
 * ─── ESCAPE HATCHES (the owner must NEVER be trapped) ────────────────
 *
 *  Earlier the ONLY way out was an obscure triple-tap, and the Android
 *  hardware back button did nothing — so the owner had to force-quit and
 *  re-enter their PIN. That was the "trapped in the garden" report. Now:
 *
 *   1. Android hardware BACK button → leaves the decoy (via the store's
 *      exitDecoy(), which returns to the PIN screen so the owner can
 *      unlock, or reveals the app if a panic wipe already cleared the
 *      PIN). This is the primary fix for the trap.
 *   2. Secret triple-tap on the "Refresh garden" footer within 2s →
 *      same exitDecoy(). Kept as the escape hatch on platforms with no
 *      hardware back button (iOS) and as belt-and-braces.
 *
 *  Neither escape reveals the real app directly — both drop to the PIN
 *  lock, so the disguise still requires the PIN to actually get in.
 *
 * ─── NAVIGATION ─────────────────────────────────────────────────────
 *
 *  Rendered as a full-screen overlay when lockState.kind === 'decoy'.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { A } from '../../theme';
import { AuroraBackground } from '../ui';
import { useGhostModeStore, selectDecoyTheme } from '../../security/ghost-mode-store';
import { DecoyPlantNote, DecoyTheme } from '../../types/ghost-mode.types';

// ─── PALETTE ─────────────────────────────────────────────────────────
//
// Colors live here (not baked into StyleSheet) so the same structural
// styles serve both skins. Layout stays in `styles`; every color comes
// from the palette the owner selected.

interface DecoyPalette {
  /** true → wrap in AuroraBackground; false → plain cream ground. */
  aurora: boolean;
  screenBg: string;
  headerBorder: string;
  ink: string;
  ink2: string;
  ink3: string;
  cardBg: string;
  cardBgPressed: string;
  cardBorder: string;
  accent: string;
  previewBannerBg: string;
  previewBannerBorder: string;
}

const AURORA_PALETTE: DecoyPalette = {
  aurora: true,
  screenBg: 'transparent',
  headerBorder: A.edge,
  ink: A.ink,
  ink2: A.ink2,
  ink3: A.ink3,
  cardBg: A.glass,
  cardBgPressed: A.glass2,
  cardBorder: A.edge,
  accent: A.accent,
  previewBannerBg: `${A.accent}22`,
  previewBannerBorder: A.accent,
};

// Warm "notebook on a linen desk" palette — a fully plausible standalone
// plant-journal app that looks nothing like Dottie's aurora surfaces.
const CREAM_PALETTE: DecoyPalette = {
  aurora: false,
  screenBg: '#FBF6ED',
  headerBorder: '#E7DECF',
  ink: '#3E3A34',
  ink2: '#6E655A',
  ink3: '#A3988A',
  cardBg: '#FFFFFF',
  cardBgPressed: '#F4EEE3',
  cardBorder: '#ECE3D5',
  accent: '#5E8C6A', // sage green
  previewBannerBg: '#EAF3EC',
  previewBannerBorder: '#5E8C6A',
};

function paletteFor(theme: DecoyTheme): DecoyPalette {
  return theme === 'cream' ? CREAM_PALETTE : AURORA_PALETTE;
}

// ─── COMPONENT ───────────────────────────────────────────────────────

/**
 * Optional preview banner — pass `preview={true}` when this body is
 * rendered as a MODAL PREVIEW (e.g. from Ghost Mode settings so the
 * user can see what a snooper sees) rather than the real decoy trigger.
 */
export function DecoyHomeBody({ preview = false }: { preview?: boolean } = {}) {
  const insets = useSafeAreaInsets();
  const theme = useGhostModeStore(selectDecoyTheme);
  const c = paletteFor(theme);

  const [tapCount, setTapCount] = useState(0);
  const lastTapAt = useRef<number>(0);

  // Generate the (deterministic) decoy data once
  const plants = useMemo(() => buildDecoyPlants(), []);
  const greeting = useMemo(() => buildDecoyGreeting(plants), [plants]);
  const lastSaved = useMemo(() => buildLastSavedLabel(), []);

  // ─── Hardware BACK → leave the decoy ────────────────────────────
  //
  // In preview mode the settings screen owns navigation, so we DON'T
  // hijack back there. In the real decoy overlay we consume back and
  // route through exitDecoy() so the owner is never trapped.
  useEffect(() => {
    if (preview) return;
    const onBack = () => {
      Haptics.selectionAsync().catch(() => {});
      useGhostModeStore.getState().exitDecoy();
      return true; // consume — never let back close the app from the decoy
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [preview]);

  // ─── Secret exit gesture: triple-tap "Refresh garden" ───────────
  useEffect(() => {
    if (tapCount < 3) return;
    setTapCount(0);
    useGhostModeStore.getState().exitDecoy();
  }, [tapCount]);

  const handleSecretTap = () => {
    Haptics.selectionAsync().catch(() => {});
    const now = Date.now();
    if (now - lastTapAt.current > 2000) {
      // Window expired — restart count
      setTapCount(1);
    } else {
      setTapCount((count) => count + 1);
    }
    lastTapAt.current = now;
  };

  const body = (
    <View style={[styles.safeArea, { paddingTop: insets.top }]}>
      {/* Preview banner — only shown when opened as a preview from Ghost
          Mode settings. When Ghost Mode fires the decoy for real,
          `preview` is false and nothing appears. */}
      {preview && (
        <View
          style={[
            styles.previewBanner,
            { backgroundColor: c.previewBannerBg, borderBottomColor: c.previewBannerBorder },
          ]}
        >
          <Text style={[styles.previewBannerText, { color: c.ink }]}>
            🔒  PREVIEW · This is the fake app a snooper sees on wrong PIN
          </Text>
        </View>
      )}

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.headerBorder }]}>
        <Text style={styles.headerLogo}>🌿</Text>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: c.ink }]}>Garden Notes</Text>
          <Text style={[styles.headerSubtitle, { color: c.ink2 }]}>{greeting}</Text>
        </View>
      </View>

      {/* Plant list */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {plants.map((plant) => (
          <PlantCard key={plant.id} plant={plant} palette={c} />
        ))}

        {/* Footer — the secret exit. Looks like a boring utility link. */}
        <Pressable
          onPress={handleSecretTap}
          hitSlop={12}
          style={({ pressed }) => [
            styles.footerLinkWrap,
            pressed && styles.footerLinkPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Refresh garden"
        >
          <Text style={[styles.footerLink, { color: c.ink3 }]}>Refresh garden</Text>
          <Text style={[styles.footerHint, { color: c.ink3 }]}>{lastSaved}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );

  // Aurora skin gets the animated aurora ground; cream skin gets a flat
  // warm ground so it reads as a different, self-contained app.
  return c.aurora ? (
    <AuroraBackground>{body}</AuroraBackground>
  ) : (
    <View style={[styles.creamRoot, { backgroundColor: c.screenBg }]}>{body}</View>
  );
}

// ─── PLANT CARD ──────────────────────────────────────────────────────

function PlantCard({ plant, palette }: { plant: DecoyPlantNote; palette: DecoyPalette }) {
  const handlePress = () => {
    // Silent — looks "active" to a snooper but does nothing meaningful
    Haptics.selectionAsync().catch(() => {});
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: palette.cardBg, borderColor: palette.cardBorder },
        pressed && { transform: [{ scale: 0.99 }], backgroundColor: palette.cardBgPressed },
      ]}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardEmoji}>{plant.emoji}</Text>
        <View style={styles.cardTitleWrap}>
          <Text style={[styles.cardName, { color: palette.ink }]}>{plant.name}</Text>
          <Text style={[styles.cardSubtitle, { color: palette.ink2 }]}>
            Last watered · {formatPretty(plant.lastWatered)}
          </Text>
        </View>
      </View>
      <Text style={[styles.cardNote, { color: palette.ink }]}>{plant.note}</Text>
      <View style={styles.cardFooter}>
        <Text style={[styles.cardNext, { color: palette.accent }]}>
          Next: {formatPretty(plant.nextWatering)}
        </Text>
      </View>
    </Pressable>
  );
}

// ─── DECOY DATA GENERATION ───────────────────────────────────────────

function buildDecoyPlants(): DecoyPlantNote[] {
  // Deterministic-ish dates based on today (so the journal looks
  // lived-in and consistent across opens, but freshens each day).
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = today.getMonth();
  const dd = today.getDate();

  return [
    {
      id: 'plant_pothos',
      emoji: '🪴',
      name: 'Golden Pothos',
      lastWatered: isoFor(yyyy, mm, dd - 2),
      nextWatering: isoFor(yyyy, mm, dd + 4),
      note: 'New leaf unfurling near the window. Loves the morning light.',
    },
    {
      id: 'plant_snake',
      emoji: '🌱',
      name: 'Snake Plant',
      lastWatered: isoFor(yyyy, mm, dd - 10),
      nextWatering: isoFor(yyyy, mm, dd + 11),
      note: "Steady as ever. Hasn't asked for much in weeks.",
    },
    {
      id: 'plant_basil',
      emoji: '🌿',
      name: 'Sweet Basil',
      lastWatered: isoFor(yyyy, mm, dd - 1),
      nextWatering: isoFor(yyyy, mm, dd + 1),
      note: 'Smells incredible after a trim. Pesto soon?',
    },
    {
      id: 'plant_lavender',
      emoji: '💜',
      name: 'Lavender',
      lastWatered: isoFor(yyyy, mm, dd - 5),
      nextWatering: isoFor(yyyy, mm, dd + 3),
      note: 'A little leggy — moving closer to the south window this week.',
    },
    {
      id: 'plant_peace',
      emoji: '🌸',
      name: 'Peace Lily',
      lastWatered: isoFor(yyyy, mm, dd - 3),
      nextWatering: isoFor(yyyy, mm, dd + 5),
      note: 'Droopy when I got home today. Watered. Already perking up.',
    },
  ];
}

function buildDecoyGreeting(plants: DecoyPlantNote[]): string {
  const today = new Date();
  const hour = today.getHours();
  const timeOfDay =
    hour < 12 ? 'Good morning' :
    hour < 17 ? 'Good afternoon' :
    'Good evening';

  const todayIso = today.toISOString().split('T')[0]!;
  const thirsty = plants.filter((p) => p.nextWatering <= todayIso).length;
  if (thirsty === 0) return `${timeOfDay} · everyone's happy`;
  if (thirsty === 1) return `${timeOfDay} · 1 plant thirsty`;
  return `${timeOfDay} · ${thirsty} plants thirsty`;
}

function buildLastSavedLabel(): string {
  const today = new Date();
  return `Saved · ${today.toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

function isoFor(year: number, month: number, day: number): string {
  const d = new Date(year, month, day);
  return d.toISOString().split('T')[0]!;
}

function formatPretty(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ─── STYLES (structure only — colors come from the palette) ──────────

const styles = StyleSheet.create({
  creamRoot: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  // Preview banner — only rendered when preview=true (via the settings
  // preview). Sits above the fake header.
  previewBanner: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  previewBannerText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.base,
    gap: Spacing.md,
    borderBottomWidth: 1,
  },
  headerLogo: {
    fontSize: 32,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    ...Typography.preset.h3,
  },
  headerSubtitle: {
    ...Typography.preset.caption,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.base,
    paddingBottom: Spacing['3xl'],
    gap: Spacing.md,
  },

  // Plant card
  card: {
    borderRadius: Spacing.radius.xl,
    borderWidth: 1,
    padding: Spacing.cardPadding,
    gap: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  cardEmoji: {
    fontSize: 28,
  },
  cardTitleWrap: {
    flex: 1,
  },
  cardName: {
    ...Typography.preset.bodySemibold,
  },
  cardSubtitle: {
    ...Typography.preset.caption,
    marginTop: 2,
  },
  cardNote: {
    ...Typography.preset.body,
    lineHeight: 22,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cardNext: {
    ...Typography.preset.captionBold,
  },

  // Footer (secret exit)
  footerLinkWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: 4,
  },
  footerLinkPressed: {
    opacity: 0.5,
  },
  footerLink: {
    ...Typography.preset.captionBold,
  },
  footerHint: {
    ...Typography.preset.caption,
    opacity: 0.6,
    fontSize: 11,
  },
});
