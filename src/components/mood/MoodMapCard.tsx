/**
 * Dottie — MoodMapCard
 *
 * The mood map on Home, behind a toggle.
 *
 * ─── WHY IT IS NOT ALWAYS OPEN ──────────────────────────────────────
 *
 *  The first version rendered the full 91-day grid unconditionally. For a new
 *  user that is a chart-shaped hole: a hundred empty squares announcing how
 *  much they haven't done, on the screen they see most. The owner called it an
 *  empty shell, and that is exactly right — a skeleton with nothing in it is
 *  worse than no card at all, because it costs space AND confidence.
 *
 * ─── THE THREE STATES ───────────────────────────────────────────────
 *
 *  1. NOTHING LOGGED — one quiet line, no grid, no chevron. There is nothing
 *     to expand, so offering a control that opens an empty box would be a lie.
 *     It stays visible only so the feature is discoverable at all.
 *
 *  2. COLLAPSED (has data) — a live 14-day strip, the dominant mood, and the
 *     day count. This is the important part: the collapsed state SHOWS REAL
 *     DATA rather than being a labelled button. You get the gist without
 *     opening anything, which is what makes the toggle feel worth having
 *     instead of a chore.
 *
 *  3. EXPANDED — the full 91-day grid, legend and distribution.
 *
 *  The open/closed choice is remembered (Storage.moodMapOpen), because
 *  re-collapsing a panel someone deliberately opened, on every single visit,
 *  is the sort of small disrespect that makes an app feel like it isn't
 *  listening. It defaults to CLOSED — the strip already carries the summary,
 *  so opening is opt-in rather than something to dismiss.
 *
 * ─── MOTION ─────────────────────────────────────────────────────────
 *
 *  The panel MOUNTS and UNMOUNTS, so this is a layout animation, not an
 *  animated height — animating height re-runs layout for the node and its
 *  siblings every frame. `FadeInDown`/`FadeOut` on the panel plus
 *  `LinearTransition` on the card lets the rest of Home reflow smoothly while
 *  the work stays off the layout path. The chevron rotates on a short timing
 *  curve. Reduce Motion drops all of it and just swaps.
 */

import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { useAurora } from '../../theme';
import { GlassCard, PressableScale } from '../ui';
import { Storage } from '../../database/storage';
import { MoodMap } from './MoodMap';
import {
  buildMoodDynamics,
  colorForScore,
  type MoodMap as MoodMapData,
} from '../../engine/mood/mood-map';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
/** How many days the collapsed strip shows. Two weeks reads as "lately". */
const STRIP_DAYS = 14;

export interface MoodMapCardProps {
  map: MoodMapData;
}

export function MoodMapCard({ map }: MoodMapCardProps): JSX.Element | null {
  const { palette } = useAurora();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(() => Storage.moodMapOpen.get());
  const [width, setWidth] = useState(0);
  const chevron = useSharedValue(open ? 1 : 0);

  const dynamics = buildMoodDynamics(map);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevron.value * 180}deg` }],
  }));

  const toggle = () => {
    const next = !open;
    Haptics.selectionAsync().catch(() => {});
    setOpen(next);
    Storage.moodMapOpen.set(next);
    chevron.value = reduce ? (next ? 1 : 0) : withTiming(next ? 1 : 0, { duration: 180, easing: EASE_OUT });
  };

  // ─── STATE 1: nothing logged ──────────────────────────────────────
  // No grid, no chevron, no skeleton — just the sentence that makes the
  // feature discoverable.
  if (map.empty) {
    return (
      <GlassCard style={styles.card}>
        <Text style={[styles.emptyLine, { color: palette.ink3 }]}>
          🌱 Check in a few days and your mood map appears here.
        </Text>
      </GlassCard>
    );
  }

  const strip = map.days.filter((d) => !d.future).slice(-STRIP_DAYS);

  return (
    <Animated.View layout={reduce ? undefined : LinearTransition.duration(220)}>
      <GlassCard style={styles.card}>
        {/* ─── THE HEADER IS THE TOGGLE ───────────────────────────── */}
        <PressableScale
          onPress={toggle}
          haptic="none"
          scaleTo={0.99}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={open ? 'Hide your mood map' : 'Show your mood map'}
          accessibilityHint={`${map.logged} days logged${
            dynamics.dominant ? `, mostly ${dynamics.dominant.label.toLowerCase()}` : ''
          }`}
          // DT21: the row was a 40pt strip with no padding and the only thing
          // that LOOKED tappable was an 18pt caret glyph, so taps landed just
          // outside it and the card "sometimes didn't open". The target is now
          // a full 48pt row plus 10pt of slop on every side, and the caret has
          // become a labelled pill so the control is visible, not inferred.
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          // A few pixels of finger travel inside a ScrollView must not cancel
          // the press — that is the other half of "sometimes it may not open".
          pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}
          style={styles.header}
        >
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: palette.ink }]}>Your mood map</Text>
            <Text style={[styles.subtitle, { color: palette.ink3 }]}>
              {map.logged} day{map.logged === 1 ? '' : 's'} logged
              {dynamics.dominant ? ` · mostly ${dynamics.dominant.emoji}` : ''}
              {map.streak > 1 ? ` · ${map.streak}-day streak` : ''}
            </Text>
          </View>
          <View
            style={[
              styles.togglePill,
              { backgroundColor: `${palette.accent}1F`, borderColor: `${palette.accent}45` },
            ]}
          >
            <Text style={[styles.toggleLabel, { color: palette.accent }]}>
              {open ? 'Hide' : 'Show'}
            </Text>
            <Animated.Text style={[styles.chevron, { color: palette.accent }, chevronStyle]}>
              ⌄
            </Animated.Text>
          </View>
        </PressableScale>

        {/* ─── COLLAPSED: real data, not a button ─────────────────── */}
        {!open ? (
          <View style={styles.strip} accessibilityLabel="Your last two weeks">
            {strip.map((d) => (
              <View
                key={d.date}
                style={[styles.stripCell, { backgroundColor: colorForScore(d.score) }]}
              />
            ))}
          </View>
        ) : null}

        {/* ─── EXPANDED ───────────────────────────────────────────── */}
        {open ? (
          <Animated.View
            entering={reduce ? undefined : FadeInDown.duration(220)}
            exiting={reduce ? undefined : FadeOut.duration(140)}
            onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
            style={styles.panel}
          >
            {width > 0 ? <MoodMap map={map} width={width} /> : null}
          </Animated.View>
        ) : null}
      </GlassCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.cardPadding, marginBottom: Spacing.base, gap: Spacing.sm },
  emptyLine: { ...Typography.preset.caption, lineHeight: 18 },
  // minHeight 48 is Android's minimum touch target; the row is the toggle, so
  // the row has to meet it on its own rather than relying on the text height.
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 48,
    paddingVertical: Spacing.xs,
  },
  headerText: { flex: 1, gap: 2 },
  title: { ...Typography.preset.bodySemibold },
  subtitle: { ...Typography.preset.caption, fontSize: 11 },
  togglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 32,
    paddingHorizontal: Spacing.md,
    borderRadius: Spacing.radius.full,
    borderWidth: 1,
  },
  toggleLabel: { ...Typography.preset.captionBold },
  chevron: { fontSize: 14, lineHeight: 16 },
  // The 14-day teaser. Flex cells so it fills whatever width it's given.
  strip: { flexDirection: 'row', gap: 3, height: 14 },
  stripCell: { flex: 1, borderRadius: 2.5 },
  panel: { width: '100%' },
});
