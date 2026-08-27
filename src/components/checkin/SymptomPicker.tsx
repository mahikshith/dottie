import { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { useAurora } from '../../theme';
import { SymptomChip, SymptomSeverity } from './SymptomChip';

/**
 * SymptomPicker
 *
 * Categorized multi-select symptom grid. Each category renders as a
 * subtle label + a wrapped row of SymptomChip pills.
 *
 * State shape returned to parent:
 *   Record<symptomKey, SymptomSeverity>
 *
 * Where symptomKey === `${category}:${type}` so the parent can split
 * back into the LogSymptomInput shape when persisting (each selection
 * becomes one row in symptom_logs via checkinRepository.logSymptom).
 *
 * ─── CATEGORY DESIGN ────────────────────────────────────────────────
 *
 *  We expose 5 categories that map 1:1 to the existing schema:
 *
 *    physical   → cramps, bloating, headache, back pain, breast tenderness
 *    emotional  → anxious, irritable, sad, sensitive
 *    skin       → breakout, oily, dry, glowing
 *    energy     → fatigue, restless
 *    sleep      → insomnia, vivid dreams
 *
 *  These cover ~90% of cycle-related symptom logging needs without
 *  overwhelming the user. More can be added later without UI changes.
 */
export interface SymptomCatalogItem {
  category: 'physical' | 'emotional' | 'skin' | 'energy' | 'sleep';
  type: string;
  label: string;
  emoji: string;
}

export const SYMPTOM_CATALOG: SymptomCatalogItem[] = [
  // Physical
  { category: 'physical', type: 'cramps', label: 'Cramps', emoji: '🌀' },
  { category: 'physical', type: 'bloating', label: 'Bloating', emoji: '🎈' },
  { category: 'physical', type: 'headache', label: 'Headache', emoji: '🤕' },
  { category: 'physical', type: 'back_pain', label: 'Back pain', emoji: '🩹' },
  { category: 'physical', type: 'breast_tenderness', label: 'Breast tenderness', emoji: '💗' },
  { category: 'physical', type: 'nausea', label: 'Nausea', emoji: '😵‍💫' },

  // Emotional
  { category: 'emotional', type: 'anxious', label: 'Anxious', emoji: '😰' },
  { category: 'emotional', type: 'irritable', label: 'Irritable', emoji: '😤' },
  { category: 'emotional', type: 'sad', label: 'Sad', emoji: '🥺' },
  { category: 'emotional', type: 'sensitive', label: 'Sensitive', emoji: '🫧' },
  { category: 'emotional', type: 'happy', label: 'Happy', emoji: '🌸' },

  // Skin
  { category: 'skin', type: 'breakout', label: 'Breakout', emoji: '🫥' },
  { category: 'skin', type: 'oily', label: 'Oily', emoji: '💧' },
  { category: 'skin', type: 'dry', label: 'Dry', emoji: '🍂' },
  { category: 'skin', type: 'glowing', label: 'Glowing', emoji: '✨' },

  // Energy
  { category: 'energy', type: 'fatigue', label: 'Fatigue', emoji: '😴' },
  { category: 'energy', type: 'restless', label: 'Restless', emoji: '🌀' },
  { category: 'energy', type: 'focused', label: 'Focused', emoji: '🎯' },

  // Sleep
  { category: 'sleep', type: 'insomnia', label: 'Insomnia', emoji: '🌙' },
  { category: 'sleep', type: 'vivid_dreams', label: 'Vivid dreams', emoji: '💭' },
];

const CATEGORY_LABELS: Record<SymptomCatalogItem['category'], string> = {
  physical: 'Body',
  emotional: 'Feelings',
  skin: 'Skin',
  energy: 'Energy',
  sleep: 'Sleep',
};

/**
 * Build the symptom key string used in the parent's record.
 * Exported so the parent can iterate selections deterministically.
 */
export function symptomKey(item: SymptomCatalogItem): string {
  return `${item.category}:${item.type}`;
}

/**
 * Map a UI severity word → the 1-10 number stored in symptom_logs.
 */
export function severityToNumber(s: SymptomSeverity): number {
  switch (s) {
    case 'mild':
      return 3;
    case 'moderate':
      return 5;
    case 'strong':
      return 8;
  }
}

export function SymptomPicker({
  selections,
  onChange,
}: {
  selections: Record<string, SymptomSeverity>;
  onChange: (next: Record<string, SymptomSeverity>) => void;
}) {
  // Group catalog by category — memoized so we don't re-bucket every render.
  const grouped = useMemo(() => {
    const m: Record<string, SymptomCatalogItem[]> = {};
    for (const item of SYMPTOM_CATALOG) {
      if (!m[item.category]) m[item.category] = [];
      m[item.category]!.push(item);
    }
    return m;
  }, []);

  const toggle = useCallback(
    (item: SymptomCatalogItem) => {
      const key = symptomKey(item);
      const current = selections[key];

      const next = { ...selections };

      // Cycle: undefined → moderate → mild → strong → undefined
      if (!current) {
        next[key] = 'moderate';
      } else if (current === 'moderate') {
        next[key] = 'mild';
      } else if (current === 'mild') {
        next[key] = 'strong';
      } else {
        delete next[key];
      }

      onChange(next);
    },
    [selections, onChange]
  );

  const { palette } = useAurora();

  return (
    <View style={styles.container}>
      {(Object.keys(grouped) as Array<keyof typeof CATEGORY_LABELS>).map(
        (cat) => (
          <View key={cat} style={styles.categoryBlock}>
            <Text style={[styles.categoryLabel, { color: palette.ink3 }]}>{CATEGORY_LABELS[cat]}</Text>
            <View style={styles.chipsRow}>
              {grouped[cat]!.map((item) => {
                const key = symptomKey(item);
                const sev = selections[key] ?? null;
                return (
                  <SymptomChip
                    key={key}
                    label={item.label}
                    emoji={item.emoji}
                    selected={sev !== null}
                    severity={sev}
                    onToggle={() => toggle(item)}
                  />
                );
              })}
            </View>
          </View>
        )
      )}
      <Text style={[styles.hint, { color: palette.ink3 }]}>
        Tap once to add. Tap again to change intensity. Tap again to remove.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.lg,
  },
  categoryBlock: {
    gap: Spacing.sm,
  },
  categoryLabel: {
    ...Typography.preset.overline,
  },
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
