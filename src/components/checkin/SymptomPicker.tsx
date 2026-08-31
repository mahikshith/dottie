import { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { useAurora, PHASE_AURORA } from '../../theme';
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
  { category: 'physical', type: 'breast_tenderness', label: 'Tender breasts', emoji: '💗' },
  { category: 'physical', type: 'nausea', label: 'Nausea', emoji: '😵‍💫' },
  { category: 'physical', type: 'cravings', label: 'Cravings', emoji: '🍫' },
  { category: 'physical', type: 'diarrhea', label: 'Loose stool', emoji: '🚽' },
  { category: 'physical', type: 'constipation', label: 'Constipated', emoji: '🧱' },
  { category: 'physical', type: 'dizziness', label: 'Dizzy', emoji: '💫' },
  { category: 'physical', type: 'hot_flashes', label: 'Hot flashes', emoji: '🥵' },
  { category: 'physical', type: 'chills', label: 'Chills', emoji: '🥶' },

  // Emotional
  { category: 'emotional', type: 'anxious', label: 'Anxious', emoji: '😰' },
  { category: 'emotional', type: 'irritable', label: 'Irritable', emoji: '😤' },
  { category: 'emotional', type: 'sad', label: 'Sad', emoji: '🥺' },
  { category: 'emotional', type: 'sensitive', label: 'Sensitive', emoji: '🫧' },
  { category: 'emotional', type: 'happy', label: 'Happy', emoji: '🌸' },
  { category: 'emotional', type: 'calm', label: 'Calm', emoji: '🍃' },
  { category: 'emotional', type: 'overwhelmed', label: 'Overwhelmed', emoji: '🌊' },
  { category: 'emotional', type: 'foggy', label: 'Foggy', emoji: '🌫️' },
  { category: 'emotional', type: 'low_libido', label: 'Low drive', emoji: '🌑' },
  { category: 'emotional', type: 'high_libido', label: 'High drive', emoji: '🔥' },

  // Skin
  { category: 'skin', type: 'breakout', label: 'Breakout', emoji: '🫥' },
  { category: 'skin', type: 'oily', label: 'Oily', emoji: '💧' },
  { category: 'skin', type: 'dry', label: 'Dry', emoji: '🍂' },
  { category: 'skin', type: 'glowing', label: 'Glowing', emoji: '✨' },

  // Energy
  { category: 'energy', type: 'fatigue', label: 'Fatigue', emoji: '😴' },
  { category: 'energy', type: 'restless', label: 'Restless', emoji: '🌀' },
  { category: 'energy', type: 'focused', label: 'Focused', emoji: '🎯' },
  { category: 'energy', type: 'energized', label: 'Energized', emoji: '⚡' },

  // Sleep
  { category: 'sleep', type: 'insomnia', label: 'Insomnia', emoji: '🌙' },
  { category: 'sleep', type: 'vivid_dreams', label: 'Vivid dreams', emoji: '💭' },
  { category: 'sleep', type: 'oversleeping', label: 'Oversleeping', emoji: '🛌' },
];

// Severity → a constant aurora hue (mild→teal, moderate→amber, strong→rose).
const SEVERITY_HUE: Record<SymptomSeverity, string> = {
  mild: PHASE_AURORA.follicular,
  moderate: PHASE_AURORA.ovulatory,
  strong: PHASE_AURORA.menstrual,
};
const SEVERITY_STEPS: { key: SymptomSeverity; label: string }[] = [
  { key: 'mild', label: 'Mild' },
  { key: 'moderate', label: 'Moderate' },
  { key: 'strong', label: 'Strong' },
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
  excludeCategories,
}: {
  selections: Record<string, SymptomSeverity>;
  onChange: (next: Record<string, SymptomSeverity>) => void;
  /** Categories to hide (e.g. 'emotional' when moods are shown separately). */
  excludeCategories?: SymptomCatalogItem['category'][];
}) {
  // Group catalog by category — memoized so we don't re-bucket every render.
  const grouped = useMemo(() => {
    const skip = new Set(excludeCategories ?? []);
    const m: Record<string, SymptomCatalogItem[]> = {};
    for (const item of SYMPTOM_CATALOG) {
      if (skip.has(item.category)) continue;
      if (!m[item.category]) m[item.category] = [];
      m[item.category]!.push(item);
    }
    return m;
  }, [excludeCategories]);

  // Tap = add (at Moderate) / remove. Severity is set below, not by re-tapping.
  const toggle = useCallback(
    (item: SymptomCatalogItem) => {
      Haptics.selectionAsync().catch(() => {});
      const key = symptomKey(item);
      const next = { ...selections };
      if (next[key]) delete next[key];
      else next[key] = 'moderate';
      onChange(next);
    },
    [selections, onChange]
  );

  const setSeverity = useCallback(
    (item: SymptomCatalogItem, sev: SymptomSeverity) => {
      Haptics.selectionAsync().catch(() => {});
      onChange({ ...selections, [symptomKey(item)]: sev });
    },
    [selections, onChange]
  );

  const { palette } = useAurora();

  // Selected symptoms, in catalog order — drives the explicit intensity control.
  const selectedItems = useMemo(
    () => SYMPTOM_CATALOG.filter((it) => selections[symptomKey(it)]),
    [selections]
  );

  return (
    <View style={styles.container}>
      {(Object.keys(grouped) as Array<keyof typeof CATEGORY_LABELS>).map(
        (cat) => (
          <View key={cat} style={styles.categoryBlock}>
            <Text style={[styles.categoryLabel, { color: palette.ink3 }]}>{CATEGORY_LABELS[cat]}</Text>
            <View style={styles.chipsRow}>
              {grouped[cat]!.map((item) => {
                const key = symptomKey(item);
                return (
                  <SymptomChip
                    key={key}
                    label={item.label}
                    emoji={item.emoji}
                    selected={selections[key] != null}
                    onToggle={() => toggle(item)}
                  />
                );
              })}
            </View>
          </View>
        )
      )}

      {/* Explicit, discoverable intensity — one labelled control per selected
          symptom (replaces the invisible "tap again to intensify" dots). */}
      {selectedItems.length > 0 && (
        <View style={styles.intensityBlock}>
          <Text style={[styles.categoryLabel, { color: palette.ink3 }]}>How strong?</Text>
          {selectedItems.map((item) => {
            const key = symptomKey(item);
            const sev = selections[key]!;
            return (
              <View key={key} style={styles.intensityRow}>
                <Text style={[styles.intensityLabel, { color: palette.ink2 }]} numberOfLines={1}>
                  {item.emoji} {item.label}
                </Text>
                <View style={styles.segments}>
                  {SEVERITY_STEPS.map((step) => {
                    const on = sev === step.key;
                    const hue = SEVERITY_HUE[step.key];
                    return (
                      <Pressable
                        key={step.key}
                        onPress={() => setSeverity(item, step.key)}
                        style={[
                          styles.segment,
                          { borderColor: palette.glass.edge },
                          on && { backgroundColor: hue, borderColor: hue },
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={`${item.label} ${step.label}`}
                      >
                        <Text style={[styles.segmentText, { color: on ? '#1a1024' : palette.ink3 }]}>
                          {step.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Text style={[styles.hint, { color: palette.ink3 }]}>
        Tap to add or remove. Set how strong each one feels below.
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
  intensityBlock: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  intensityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  intensityLabel: {
    ...Typography.preset.bodySemibold,
    fontSize: 13,
    flex: 1,
    flexShrink: 1,
  },
  segments: {
    flexDirection: 'row',
    gap: 4,
  },
  segment: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderRadius: Spacing.radius.full,
    borderWidth: 1.5,
    minWidth: 52,
    alignItems: 'center',
  },
  segmentText: {
    ...Typography.preset.caption,
    fontSize: 11,
    fontWeight: '800',
  },
  hint: {
    ...Typography.preset.caption,
    fontStyle: 'italic',
  },
});
