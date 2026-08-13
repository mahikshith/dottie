/**
 * DecoyHomeBody
 *
 * The actual UI of the "Garden Notes" decoy app. Decoupled from
 * Expo Router so the AppLockGate can render it as an overlay
 * without router context.
 *
 * ─── DESIGN ─────────────────────────────────────────────────────────
 *
 *  - Looks like a real notes app. Header, search-y greeting, list of
 *    plant notes with dates. Calm sage green palette.
 *  - Notes are deterministic from a small seed → same plants appear
 *    every time so it feels lived-in, not random.
 *  - Tapping a plant card produces a soft haptic + does nothing
 *    visible. To a snooper it looks like a fully working app.
 *  - There IS a secret way out: a tiny "Refresh garden" link at the
 *    very bottom, tapped 3 times in 2 seconds, returns to the real
 *    Dottie lock screen. Discoverable only to the owner.
 *
 * ─── NAVIGATION ─────────────────────────────────────────────────────
 *
 *  Rendered as a full-screen overlay when lockState.kind === 'decoy'.
 *  Cannot be dismissed by swipe — the only way back to the real app
 *  is the secret triple-tap.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { Shadows } from '../../constants/shadows';
import { useGhostModeStore } from '../../security/ghost-mode-store';
import { DecoyPlantNote } from '../../types/ghost-mode.types';

// ─── COMPONENT ───────────────────────────────────────────────────────

export function DecoyHomeBody() {
  const [tapCount, setTapCount] = useState(0);
  const lastTapAt = useRef<number>(0);

  // Generate the (deterministic) decoy data once
  const plants = useMemo(() => buildDecoyPlants(), []);
  const greeting = useMemo(() => buildDecoyGreeting(plants), [plants]);
  const lastSaved = useMemo(() => buildLastSavedLabel(), []);

  // ─── Secret exit gesture: triple-tap "Refresh garden" ───────────
  //
  // Implemented as an effect rather than inline state-update-during-
  // render so React stays happy and the unlock transition runs after
  // the press animation completes.
  useEffect(() => {
    if (tapCount < 3) return;
    setTapCount(0);
    useGhostModeStore.getState().lockNow('manual_lock');
  }, [tapCount]);

  const handleSecretTap = () => {
    Haptics.selectionAsync().catch(() => {});
    const now = Date.now();
    if (now - lastTapAt.current > 2000) {
      // Window expired — restart count
      setTapCount(1);
    } else {
      setTapCount((c) => c + 1);
    }
    lastTapAt.current = now;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLogo}>🌿</Text>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Garden Notes</Text>
          <Text style={styles.headerSubtitle}>{greeting}</Text>
        </View>
      </View>

      {/* Plant list */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {plants.map((plant) => (
          <PlantCard key={plant.id} plant={plant} />
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
          <Text style={styles.footerLink}>Refresh garden</Text>
          <Text style={styles.footerHint}>{lastSaved}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── PLANT CARD ──────────────────────────────────────────────────────

function PlantCard({ plant }: { plant: DecoyPlantNote }) {
  const handlePress = () => {
    // Silent — looks "active" to a snooper but does nothing meaningful
    Haptics.selectionAsync().catch(() => {});
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardEmoji}>{plant.emoji}</Text>
        <View style={styles.cardTitleWrap}>
          <Text style={styles.cardName}>{plant.name}</Text>
          <Text style={styles.cardSubtitle}>
            Last watered · {formatPretty(plant.lastWatered)}
          </Text>
        </View>
      </View>
      <Text style={styles.cardNote}>{plant.note}</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.cardNext}>Next: {formatPretty(plant.nextWatering)}</Text>
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

// ─── STYLES ──────────────────────────────────────────────────────────

// Deliberately uses a sage-green palette derived from existing tokens
// so the decoy looks like a completely different app from Dottie.
const SAGE_BG = '#F2F8F4';
const SAGE_PRIMARY = Colors.primary.sage;
const SAGE_TEXT_PRIMARY = '#2D3A2E';
const SAGE_TEXT_SECONDARY = '#5C6E5E';

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: SAGE_BG,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.base,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(107, 203, 119, 0.15)',
  },
  headerLogo: {
    fontSize: 32,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    ...Typography.preset.h3,
    color: SAGE_TEXT_PRIMARY,
  },
  headerSubtitle: {
    ...Typography.preset.caption,
    color: SAGE_TEXT_SECONDARY,
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
    backgroundColor: '#FFFFFF',
    borderRadius: Spacing.radius.xl,
    padding: Spacing.cardPadding,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
    backgroundColor: '#F8FBF9',
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
    color: SAGE_TEXT_PRIMARY,
  },
  cardSubtitle: {
    ...Typography.preset.caption,
    color: SAGE_TEXT_SECONDARY,
    marginTop: 2,
  },
  cardNote: {
    ...Typography.preset.body,
    color: SAGE_TEXT_PRIMARY,
    lineHeight: 22,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cardNext: {
    ...Typography.preset.captionBold,
    color: SAGE_PRIMARY,
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
    color: SAGE_TEXT_SECONDARY,
  },
  footerHint: {
    ...Typography.preset.caption,
    color: SAGE_TEXT_SECONDARY,
    opacity: 0.6,
    fontSize: 11,
  },
});
