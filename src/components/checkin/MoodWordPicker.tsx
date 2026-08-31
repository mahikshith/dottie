import { View, Text, StyleSheet } from 'react-native';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { useAurora } from '../../theme';
import { SymptomChip } from './SymptomChip';

/**
 * MoodWordPicker — a named-mood multi-select layer for the check-in.
 *
 * ─── WHY IT EXISTS ──────────────────────────────────────────────────
 *
 *  The 5-emoji MoodScale is a VALENCE scale (sad → happy) — it drives the whole
 *  aurora recolour and the stored `moodScore`, so it stays 5 points. But owner
 *  feedback was that one axis isn't enough: "users could be under different moods
 *  when they're on their period." So this sits UNDER the valence scale and lets
 *  you name the actual feelings (calm, anxious, tearful, motivated…), stored
 *  ALONGSIDE the score. Each selected word persists via the existing emotional
 *  symptom log (`logSymptom`, category 'emotional') — no schema change.
 *
 *  These moods used to be buried as an "emotional" group inside SymptomPicker;
 *  surfacing them here (and excluding 'emotional' from that grid) makes them
 *  prominent and removes the duplication.
 */

export interface MoodWord {
  /** stored as the emotional symptom `type` */
  type: string;
  label: string;
  emoji: string;
}

export const MOOD_WORDS: MoodWord[] = [
  { type: 'calm', label: 'Calm', emoji: '🍃' },
  { type: 'content', label: 'Content', emoji: '😊' },
  { type: 'happy', label: 'Happy', emoji: '🌸' },
  { type: 'excited', label: 'Excited', emoji: '🤩' },
  { type: 'loved', label: 'Loved', emoji: '🥰' },
  { type: 'motivated', label: 'Motivated', emoji: '💪' },
  { type: 'sensitive', label: 'Sensitive', emoji: '🫧' },
  { type: 'anxious', label: 'Anxious', emoji: '😰' },
  { type: 'irritable', label: 'Irritable', emoji: '😤' },
  { type: 'angry', label: 'Angry', emoji: '😠' },
  { type: 'sad', label: 'Sad', emoji: '🥺' },
  { type: 'tearful', label: 'Tearful', emoji: '😢' },
  { type: 'overwhelmed', label: 'Overwhelmed', emoji: '🌊' },
  { type: 'foggy', label: 'Foggy', emoji: '🌫️' },
  { type: 'numb', label: 'Numb', emoji: '🫥' },
];

export function MoodWordPicker({
  selected,
  onToggle,
}: {
  selected: Set<string>;
  onToggle: (type: string) => void;
}) {
  const { palette } = useAurora();
  return (
    <View style={styles.wrap}>
      <View style={styles.chipsRow}>
        {MOOD_WORDS.map((m) => (
          <SymptomChip
            key={m.type}
            label={m.label}
            emoji={m.emoji}
            selected={selected.has(m.type)}
            onToggle={() => onToggle(m.type)}
          />
        ))}
      </View>
      <Text style={[styles.hint, { color: palette.ink3 }]}>
        Pick as many as fit — moods can layer, especially on your period.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm, marginTop: Spacing.md },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  hint: {
    ...Typography.preset.caption,
    fontStyle: 'italic',
  },
});
