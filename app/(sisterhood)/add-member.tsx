import { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../src/constants/colors';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { Shadows } from '../../src/constants/shadows';
import { GradientButton, PressableScale } from '../../src/components/ui';
import {
  useUserStore,
  useCycleStore,
  useSisterhoodStore,
  selectCompanionType,
  selectCurrentPhase,
} from '../../src/stores';
import { getCompanion } from '../../src/content/companions';
import {
  AddMemberInput,
  MemberKind,
  PrivacyLevel,
  ShadowContext,
  defaultMemberEmoji,
} from '../../src/types/sisterhood.types';
import { HealthCondition, UserMode } from '../../src/types/cycle.types';
import { WizardStepIndicator } from '../../src/components/sisterhood/WizardStepIndicator';
import { KindCard } from '../../src/components/sisterhood/KindCard';
import { EmojiPicker } from '../../src/components/sisterhood/EmojiPicker';
import { PrivacyLevelCard } from '../../src/components/sisterhood/PrivacyLevelCard';

/**
 * Add-Member Wizard
 *
 * ─── DESIGN PHILOSOPHY ──────────────────────────────────────────────
 *
 *  The original "add member" flow used a chain of system Alert.prompt
 *  modals, which felt clunky and crashed the warm Dottie tone. This
 *  wizard replaces that with a delightful multi-step flow:
 *
 *    1. Kind        — shadow profile OR linked account
 *    2. Identity    — name + emoji
 *    3. Relationship — pre-baked options + custom
 *    4. Privacy     — what they'll see, in plain language
 *    5. Shadow      — (skipped for linked) optional shadow context
 *    6. Celebration — companion reacts, sister joined! → back to circle
 *
 *  Every step is a single decision. The user can always go back. The
 *  primary CTA stays disabled until the step's required field is
 *  satisfied — there's never a "what do I do now?" moment.
 *
 * ─── PRIVACY CONTRACT ───────────────────────────────────────────────
 *
 *  The privacy level the primary picks here is the AUTHORITATIVE
 *  privacy level for the member. The engine's `buildMemberView()` will
 *  enforce it on every render going forward. Shadow members default to
 *  FULL (because the primary is logging on their behalf anyway).
 *  Linked members default to SUMMARY (a respectful baseline — the
 *  linked person can change this later in their own app).
 *
 * ─── LINKED MODE NOTE ───────────────────────────────────────────────
 *
 *  For MVP the linked-account flow creates a placeholder member row
 *  with `linkedUserId = null` — the actual cross-device invite/accept
 *  ships with the social plane. We're being honest about this in the
 *  microcopy ("invite code coming soon") rather than pretending it
 *  works.
 *
 * ─── PREMIUM POLISH PASS (Phase 2) ──────────────────────────────────
 *
 *  Presentation-only activation of the shared motion + depth system.
 *  Logic, validation, step flow, store calls, and copy are untouched:
 *
 *   - The flat coral primary CTA is now the shared <GradientButton>
 *     (coral→peach fill, lift shadow, spring press). Its loading and
 *     disabled states are wired to the SAME isSubmitting / canAdvance
 *     state the old button read, so validation gating is identical.
 *   - Every INLINE selectable surface (Back button, relationship pills,
 *     shadow mode rows, condition chips, close button) now uses the
 *     shared <PressableScale> for buttery UI-thread spring-press. Rows
 *     that already fire their own Haptics.* pass haptic="none" to avoid
 *     a double buzz. Shared step cards (KindCard / PrivacyLevelCard /
 *     EmojiPicker) are left untouched per the no-shared-edit rule.
 *   - Each wizard step fades + rises in on mount (Reanimated FadeInDown),
 *     so advancing between steps feels intentional, not instant.
 *   - Real safe-area insets replace the fixed top-bar padding.
 *
 *  All motion honors "Reduce Motion" via the shared primitives.
 */

type WizardStep = 'kind' | 'identity' | 'relationship' | 'privacy' | 'shadow' | 'celebration';

/** Entrance choreography: gentle fade + rise, UI thread, mount-only. */
function rise(delay: number) {
  return FadeInDown.duration(480).delay(delay).springify().damping(16);
}

const STEPS_SHADOW: WizardStep[] = [
  'kind',
  'identity',
  'relationship',
  'privacy',
  'shadow',
  'celebration',
];

const STEPS_LINKED: WizardStep[] = [
  'kind',
  'identity',
  'relationship',
  'privacy',
  'celebration',
];

const RELATIONSHIP_OPTIONS = [
  { label: 'Little Sister', emoji: '👧' },
  { label: 'Big Sister', emoji: '🧕' },
  { label: 'Cousin', emoji: '👯' },
  { label: 'Best Friend', emoji: '💛' },
  { label: 'Partner', emoji: '💞' },
  { label: 'Mom', emoji: '🌷' },
  { label: 'Daughter', emoji: '🌼' },
  { label: 'Roommate', emoji: '🏡' },
  { label: 'Custom', emoji: '✨' },
];

const SHADOW_MODE_OPTIONS: { value: UserMode; label: string; emoji: string; hint: string }[] = [
  { value: 'teen', label: 'Teen Mode', emoji: '🌱', hint: 'Newly menstruating · younger cycles' },
  { value: 'adult', label: 'Adult Mode', emoji: '🌸', hint: 'Established adult cycles' },
  { value: 'endocrine', label: 'Endocrine Mode', emoji: '🌿', hint: 'PCOS, thyroid, irregular cycles' },
];

const SHADOW_CONDITION_OPTIONS: { value: HealthCondition; label: string }[] = [
  { value: 'pcos', label: 'PCOS' },
  { value: 'thyroid', label: 'Thyroid' },
  { value: 'endometriosis', label: 'Endometriosis' },
];

export default function AddMemberScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useUserStore((s) => s.userId);
  const companionType = useUserStore(selectCompanionType);
  const primaryCurrentPhase = useCycleStore(selectCurrentPhase);
  const companion = getCompanion(companionType);

  // ─── Wizard state ───────────────────────────────────────────────
  const [step, setStep] = useState<WizardStep>('kind');
  const [kind, setKind] = useState<MemberKind | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [emoji, setEmoji] = useState<string | null>(null);
  const [relationshipOption, setRelationshipOption] = useState<string | null>(null);
  const [customRelationship, setCustomRelationship] = useState('');
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel | null>(null);

  // Shadow-only state
  const [shadowMode, setShadowMode] = useState<UserMode>('adult');
  const [shadowAge, setShadowAge] = useState('');
  const [shadowConditions, setShadowConditions] = useState<HealthCondition[]>([]);
  const [shadowLastPeriod, setShadowLastPeriod] = useState(''); // ISO YYYY-MM-DD
  const [shadowNotes, setShadowNotes] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Derived ────────────────────────────────────────────────────
  const steps = useMemo<WizardStep[]>(
    () => (kind === 'linked' ? STEPS_LINKED : STEPS_SHADOW),
    [kind]
  );
  const stepIndex = steps.indexOf(step);
  const totalVisibleSteps = steps.filter((s) => s !== 'celebration').length;
  const visibleStepIndex = Math.min(stepIndex, totalVisibleSteps - 1);

  const resolvedRelationship =
    relationshipOption === 'Custom' ? customRelationship.trim() : relationshipOption ?? '';

  // ─── Step navigation ────────────────────────────────────────────
  const goNext = (nextStep: WizardStep) => {
    Haptics.selectionAsync().catch(() => {});
    setStep(nextStep);
  };

  const goBack = () => {
    Haptics.selectionAsync().catch(() => {});
    const prevIndex = stepIndex - 1;
    if (prevIndex < 0) {
      router.back();
      return;
    }
    setStep(steps[prevIndex] ?? 'kind');
  };

  const handleClose = () => {
    const hasProgress =
      kind !== null ||
      displayName.length > 0 ||
      emoji !== null ||
      relationshipOption !== null;

    if (!hasProgress) {
      router.back();
      return;
    }

    Alert.alert(
      'Leave this without finishing?',
      "Your draft will be gone — you can always start again.",
      [
        { text: 'Keep going', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => router.back() },
      ]
    );
  };

  // ─── Submit ─────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!userId || !kind || !privacyLevel || isSubmitting) return;
    const trimmedName = displayName.trim();
    if (trimmedName.length === 0 || resolvedRelationship.length === 0) return;

    setIsSubmitting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    const shadowContext: ShadowContext | undefined =
      kind === 'shadow'
        ? {
            age: parseAge(shadowAge),
            mode: shadowMode,
            conditions: shadowConditions,
            averageCycleLength: null,
            lastPeriodStart: shadowLastPeriod ? shadowLastPeriod : null,
            notes: shadowNotes.trim() ? shadowNotes.trim() : null,
          }
        : undefined;

    const input: AddMemberInput = {
      displayName: trimmedName,
      relationship: resolvedRelationship,
      kind,
      privacyLevel,
      emoji: emoji ?? defaultMemberEmoji(kind),
      shadowContext,
    };

    try {
      const member = await useSisterhoodStore
        .getState()
        .addMember(userId, primaryCurrentPhase, input);

      // If shadow + has lastPeriodStart, log it now so the dashboard
      // shows real cycle data immediately.
      if (kind === 'shadow' && shadowLastPeriod) {
        try {
          await useSisterhoodStore
            .getState()
            .logShadowPeriod(primaryCurrentPhase, {
              memberId: member.id,
              date: shadowLastPeriod,
              flowLevel: 3,
            });
        } catch (err) {
          if (__DEV__) console.warn('[Wizard] seed period failed:', err);
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setStep('celebration');
    } catch (err) {
      if (__DEV__) console.warn('[Wizard] addMember failed:', err);
      Alert.alert(
        'Something gentle went sideways',
        "Couldn't add them right now — please try again in a moment."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Step-specific validation ───────────────────────────────────
  const canAdvance = (() => {
    switch (step) {
      case 'kind':
        return kind !== null;
      case 'identity':
        return displayName.trim().length > 0 && emoji !== null;
      case 'relationship':
        return resolvedRelationship.length > 0;
      case 'privacy':
        return privacyLevel !== null;
      case 'shadow':
        return true; // all optional
      case 'celebration':
        return true;
    }
  })();

  // ─── Primary action label ───────────────────────────────────────
  const primaryActionLabel = (() => {
    if (step === 'celebration') return 'See my circle';
    if (kind === 'linked' && step === 'privacy') return 'Add to circle 💛';
    if (kind === 'shadow' && step === 'shadow') return 'Add to circle 💛';
    return 'Next';
  })();

  const handlePrimaryAction = () => {
    if (step === 'celebration') {
      router.back();
      return;
    }
    if (
      (kind === 'linked' && step === 'privacy') ||
      (kind === 'shadow' && step === 'shadow')
    ) {
      handleSubmit();
      return;
    }
    const nextIndex = stepIndex + 1;
    const nextStep = steps[nextIndex];
    if (nextStep) goNext(nextStep);
  };

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top bar: close + step indicator */}
      {step !== 'celebration' && (
        <View style={[styles.topBar, { paddingTop: insets.top + Spacing.md }]}>
          <PressableScale
            onPress={handleClose}
            scaleTo={0.9}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </PressableScale>
          <WizardStepIndicator total={totalVisibleSteps} currentIndex={visibleStepIndex} />
          <View style={styles.topBarSpacer} />
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 'kind' && (
          <Animated.View entering={rise(40)}>
            <KindStep
              companionEmoji={companion.emoji}
              companionName={companion.name}
              selected={kind}
              onSelect={setKind}
            />
          </Animated.View>
        )}

        {step === 'identity' && (
          <Animated.View entering={rise(40)}>
            <IdentityStep
              displayName={displayName}
              onChangeName={setDisplayName}
              emoji={emoji}
              onSelectEmoji={setEmoji}
              companionName={companion.name}
            />
          </Animated.View>
        )}

        {step === 'relationship' && (
          <Animated.View entering={rise(40)}>
            <RelationshipStep
              selected={relationshipOption}
              onSelect={setRelationshipOption}
              customValue={customRelationship}
              onChangeCustom={setCustomRelationship}
            />
          </Animated.View>
        )}

        {step === 'privacy' && (
          <Animated.View entering={rise(40)}>
            <PrivacyStep
              kind={kind ?? 'shadow'}
              selected={privacyLevel}
              onSelect={setPrivacyLevel}
              memberName={displayName.trim() || 'they'}
            />
          </Animated.View>
        )}

        {step === 'shadow' && (
          <Animated.View entering={rise(40)}>
          <ShadowStep
            memberName={displayName.trim() || 'they'}
            mode={shadowMode}
            onChangeMode={setShadowMode}
            age={shadowAge}
            onChangeAge={setShadowAge}
            conditions={shadowConditions}
            onToggleCondition={(c) =>
              setShadowConditions((prev) =>
                prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
              )
            }
            lastPeriod={shadowLastPeriod}
            onChangeLastPeriod={setShadowLastPeriod}
            notes={shadowNotes}
            onChangeNotes={setShadowNotes}
          />
          </Animated.View>
        )}

        {step === 'celebration' && (
          <Animated.View entering={rise(40)}>
            <CelebrationStep
              companionEmoji={companion.emoji}
              companionName={companion.name}
              memberEmoji={emoji ?? defaultMemberEmoji(kind ?? 'shadow')}
              memberName={displayName.trim()}
            />
          </Animated.View>
        )}

        <View style={{ height: Spacing['5xl'] }} />
      </ScrollView>

      {/* Bottom action bar */}
      <View style={styles.actionBar}>
        {step !== 'kind' && step !== 'celebration' && (
          <PressableScale
            onPress={goBack}
            haptic="none"
            scaleTo={0.97}
            style={styles.secondaryButton}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Text style={styles.secondaryButtonText}>Back</Text>
          </PressableScale>
        )}
        <GradientButton
          label={primaryActionLabel}
          onPress={handlePrimaryAction}
          disabled={!canAdvance || isSubmitting}
          loading={isSubmitting}
          haptic="none"
          style={styles.primaryButtonGrow}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── STEP: KIND ──────────────────────────────────────────────────────

function KindStep({
  companionEmoji,
  companionName,
  selected,
  onSelect,
}: {
  companionEmoji: string;
  companionName: string;
  selected: MemberKind | null;
  onSelect: (kind: MemberKind) => void;
}) {
  return (
    <View>
      <StepHeader
        eyebrow="Add someone you love"
        title="How will you connect?"
        subtitle={`${companionEmoji} ${companionName}: "Both options work beautifully — pick whichever fits."`}
      />

      <View style={styles.cardStack}>
        <KindCard
          kind="shadow"
          selected={selected === 'shadow'}
          onSelect={() => onSelect('shadow')}
        />
        <KindCard
          kind="linked"
          selected={selected === 'linked'}
          onSelect={() => onSelect('linked')}
        />
      </View>
    </View>
  );
}

// ─── STEP: IDENTITY ──────────────────────────────────────────────────

function IdentityStep({
  displayName,
  onChangeName,
  emoji,
  onSelectEmoji,
  companionName,
}: {
  displayName: string;
  onChangeName: (v: string) => void;
  emoji: string | null;
  onSelectEmoji: (v: string) => void;
  companionName: string;
}) {
  return (
    <View>
      <StepHeader
        eyebrow="Their name"
        title="What should we call them?"
        subtitle={`A first name or nickname is perfect — only ${companionName} (and you) will see it.`}
      />

      <View style={styles.inputCard}>
        <TextInput
          value={displayName}
          onChangeText={onChangeName}
          placeholder="Like Aisha, Lulu, or Bestie 💛"
          placeholderTextColor={Colors.text.tertiary}
          style={styles.textInput}
          maxLength={32}
          autoFocus
          returnKeyType="next"
          autoCorrect={false}
        />
      </View>

      <Text style={styles.sectionLabel}>Pick a little emoji for them</Text>
      <EmojiPicker selected={emoji} onSelect={onSelectEmoji} />
    </View>
  );
}

// ─── STEP: RELATIONSHIP ──────────────────────────────────────────────

function RelationshipStep({
  selected,
  onSelect,
  customValue,
  onChangeCustom,
}: {
  selected: string | null;
  onSelect: (v: string) => void;
  customValue: string;
  onChangeCustom: (v: string) => void;
}) {
  return (
    <View>
      <StepHeader
        eyebrow="Your bond"
        title="How do you know them?"
        subtitle="Pick what fits today — you can always change it later."
      />

      <View style={styles.relationshipGrid}>
        {RELATIONSHIP_OPTIONS.map((opt) => {
          const isActive = selected === opt.label;
          return (
            <PressableScale
              key={opt.label}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onSelect(opt.label);
              }}
              haptic="none"
              scaleTo={0.9}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
              accessibilityState={{ selected: isActive }}
              style={[
                styles.relationshipPill,
                isActive && styles.relationshipPillActive,
              ]}
            >
              <Text style={styles.relationshipEmoji}>{opt.emoji}</Text>
              <Text
                style={[
                  styles.relationshipLabel,
                  isActive && styles.relationshipLabelActive,
                ]}
              >
                {opt.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      {selected === 'Custom' && (
        <View style={[styles.inputCard, { marginTop: Spacing.md }]}>
          <TextInput
            value={customValue}
            onChangeText={onChangeCustom}
            placeholder="Tell us what they are to you ✨"
            placeholderTextColor={Colors.text.tertiary}
            style={styles.textInput}
            maxLength={40}
            autoFocus
            returnKeyType="done"
          />
        </View>
      )}
    </View>
  );
}

// ─── STEP: PRIVACY ───────────────────────────────────────────────────

function PrivacyStep({
  kind,
  selected,
  onSelect,
  memberName,
}: {
  kind: MemberKind;
  selected: PrivacyLevel | null;
  onSelect: (v: PrivacyLevel) => void;
  memberName: string;
}) {
  const recommendedNote = (() => {
    if (kind === 'shadow') {
      return `Since you're tracking on ${memberName}'s behalf, Full view is the natural pick — but you choose.`;
    }
    return `Summary is a kind starting point — ${memberName} can change this in their own Dottie any time.`;
  })();

  return (
    <View>
      <StepHeader
        eyebrow="Privacy first"
        title="What can you see about them?"
        subtitle={recommendedNote}
      />

      <View style={styles.cardStack}>
        <PrivacyLevelCard
          level="full"
          selected={selected === 'full'}
          onSelect={() => onSelect('full')}
        />
        <PrivacyLevelCard
          level="summary"
          selected={selected === 'summary'}
          onSelect={() => onSelect('summary')}
        />
        <PrivacyLevelCard
          level="mood"
          selected={selected === 'mood'}
          onSelect={() => onSelect('mood')}
        />
        <PrivacyLevelCard
          level="connected"
          selected={selected === 'connected'}
          onSelect={() => onSelect('connected')}
        />
      </View>
    </View>
  );
}

// ─── STEP: SHADOW CONTEXT ────────────────────────────────────────────

function ShadowStep({
  memberName,
  mode,
  onChangeMode,
  age,
  onChangeAge,
  conditions,
  onToggleCondition,
  lastPeriod,
  onChangeLastPeriod,
  notes,
  onChangeNotes,
}: {
  memberName: string;
  mode: UserMode;
  onChangeMode: (v: UserMode) => void;
  age: string;
  onChangeAge: (v: string) => void;
  conditions: HealthCondition[];
  onToggleCondition: (c: HealthCondition) => void;
  lastPeriod: string;
  onChangeLastPeriod: (v: string) => void;
  notes: string;
  onChangeNotes: (v: string) => void;
}) {
  return (
    <View>
      <StepHeader
        eyebrow="Almost done"
        title={`A little about ${memberName}`}
        subtitle="All of this is optional. Add what you know, skip what you don't."
      />

      {/* Mode picker */}
      <Text style={styles.sectionLabel}>What fits them best?</Text>
      <View style={styles.cardStack}>
        {SHADOW_MODE_OPTIONS.map((opt) => {
          const isActive = mode === opt.value;
          return (
            <PressableScale
              key={opt.value}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onChangeMode(opt.value);
              }}
              haptic="none"
              scaleTo={0.98}
              accessibilityRole="radio"
              accessibilityLabel={opt.label}
              accessibilityHint={opt.hint}
              accessibilityState={{ selected: isActive }}
              style={[
                styles.shadowOptionRow,
                isActive && styles.shadowOptionRowActive,
              ]}
            >
              <Text style={styles.shadowOptionEmoji}>{opt.emoji}</Text>
              <View style={styles.shadowOptionText}>
                <Text style={styles.shadowOptionLabel}>{opt.label}</Text>
                <Text style={styles.shadowOptionHint}>{opt.hint}</Text>
              </View>
              <View style={[styles.radioOuter, isActive && styles.radioOuterActive]}>
                {isActive && <View style={styles.radioInner} />}
              </View>
            </PressableScale>
          );
        })}
      </View>

      {/* Age */}
      <Text style={styles.sectionLabel}>How old are they?</Text>
      <View style={styles.inputCard}>
        <TextInput
          value={age}
          onChangeText={(v) => onChangeAge(v.replace(/[^0-9]/g, '').slice(0, 3))}
          placeholder="Optional · helps tune predictions"
          placeholderTextColor={Colors.text.tertiary}
          style={styles.textInput}
          keyboardType="number-pad"
          maxLength={3}
        />
      </View>

      {/* Conditions */}
      <Text style={styles.sectionLabel}>Anything they're managing?</Text>
      <View style={styles.conditionRow}>
        {SHADOW_CONDITION_OPTIONS.map((opt) => {
          const isActive = conditions.includes(opt.value);
          return (
            <PressableScale
              key={opt.value}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                onToggleCondition(opt.value);
              }}
              haptic="none"
              scaleTo={0.9}
              accessibilityRole="checkbox"
              accessibilityLabel={opt.label}
              accessibilityState={{ checked: isActive }}
              style={[
                styles.conditionChip,
                isActive && styles.conditionChipActive,
              ]}
            >
              <Text
                style={[
                  styles.conditionChipLabel,
                  isActive && styles.conditionChipLabelActive,
                ]}
              >
                {isActive ? '✓ ' : ''}{opt.label}
              </Text>
            </PressableScale>
          );
        })}
      </View>

      {/* Last period */}
      <Text style={styles.sectionLabel}>Their last period started…</Text>
      <View style={styles.inputCard}>
        <TextInput
          value={lastPeriod}
          onChangeText={(v) => onChangeLastPeriod(v.replace(/[^0-9-]/g, '').slice(0, 10))}
          placeholder="YYYY-MM-DD · optional"
          placeholderTextColor={Colors.text.tertiary}
          style={styles.textInput}
          keyboardType="numbers-and-punctuation"
          autoCorrect={false}
        />
      </View>

      {/* Notes */}
      <Text style={styles.sectionLabel}>Anything you want to remember?</Text>
      <View style={[styles.inputCard, styles.notesCard]}>
        <TextInput
          value={notes}
          onChangeText={onChangeNotes}
          placeholder="Just for you. They never see this."
          placeholderTextColor={Colors.text.tertiary}
          style={[styles.textInput, styles.notesInput]}
          multiline
          maxLength={300}
          textAlignVertical="top"
        />
      </View>
    </View>
  );
}

// ─── STEP: CELEBRATION ───────────────────────────────────────────────

function CelebrationStep({
  companionEmoji,
  companionName,
  memberEmoji,
  memberName,
}: {
  companionEmoji: string;
  companionName: string;
  memberEmoji: string;
  memberName: string;
}) {
  return (
    <View style={styles.celebration}>
      <View style={styles.celebrationEmojiRow}>
        <Text style={styles.celebrationEmoji}>{companionEmoji}</Text>
        <Text style={styles.celebrationHeart}>🩷</Text>
        <Text style={styles.celebrationEmoji}>{memberEmoji}</Text>
      </View>
      <Text style={styles.celebrationTitle}>
        {memberName} joined your circle!
      </Text>
      <Text style={styles.celebrationBody}>
        {companionName} is going to take such good care of both of you.{'\n'}
        Tap their card on the dashboard to log, send a care nudge, or
        just see how they're doing today. 💛
      </Text>
    </View>
  );
}

// ─── SHARED: STEP HEADER ─────────────────────────────────────────────

function StepHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.stepHeader}>
      <Text style={styles.stepEyebrow}>{eyebrow}</Text>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepSubtitle}>{subtitle}</Text>
    </View>
  );
}

// ─── HELPERS ─────────────────────────────────────────────────────────

function parseAge(input: string): number | null {
  const n = parseInt(input, 10);
  if (Number.isNaN(n)) return null;
  if (n < 8 || n > 120) return null;
  return n;
}

// ─── STYLES ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface.background,
  },
  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  closeButtonText: {
    fontSize: 18,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  topBarSpacer: {
    width: 40,
  },
  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.lg,
  },
  // Step header
  stepHeader: {
    marginBottom: Spacing.xl,
  },
  stepEyebrow: {
    ...Typography.preset.overline,
    color: Colors.primary.coral,
    marginBottom: Spacing.xs,
  },
  stepTitle: {
    ...Typography.preset.h2,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  stepSubtitle: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  sectionLabel: {
    ...Typography.preset.captionBold,
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  // Card stack (Kind, Privacy, Shadow mode)
  cardStack: {
    gap: Spacing.md,
  },
  // Identity
  inputCard: {
    backgroundColor: Colors.surface.card,
    borderRadius: Spacing.radius.xl,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border.light,
    ...Shadows.sm,
  },
  textInput: {
    ...Typography.preset.bodyLarge,
    color: Colors.text.primary,
    minHeight: 28,
  },
  notesCard: {
    minHeight: 100,
  },
  notesInput: {
    minHeight: 80,
    lineHeight: 22,
  },
  // Relationship grid
  relationshipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  relationshipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.card,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Spacing.radius.full,
    borderWidth: 1,
    borderColor: Colors.border.light,
    gap: 6,
  },
  relationshipPillActive: {
    backgroundColor: Colors.primary.coral,
    borderColor: Colors.primary.coral,
  },
  relationshipEmoji: {
    fontSize: 14,
  },
  relationshipLabel: {
    ...Typography.preset.captionBold,
    color: Colors.text.secondary,
  },
  relationshipLabelActive: {
    color: Colors.text.inverse,
  },
  // Shadow mode rows
  shadowOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface.card,
    padding: Spacing.cardPadding,
    borderRadius: Spacing.radius.xl,
    gap: Spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...Shadows.sm,
  },
  shadowOptionRowActive: {
    borderColor: Colors.primary.coral,
  },
  shadowOptionEmoji: {
    fontSize: 28,
    width: 32,
    textAlign: 'center',
  },
  shadowOptionText: {
    flex: 1,
  },
  shadowOptionLabel: {
    ...Typography.preset.bodySemibold,
    color: Colors.text.primary,
  },
  shadowOptionHint: {
    ...Typography.preset.caption,
    color: Colors.text.tertiary,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.border.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterActive: {
    borderColor: Colors.primary.coral,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary.coral,
  },
  // Condition chips
  conditionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  conditionChip: {
    backgroundColor: Colors.surface.card,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: Spacing.radius.full,
    borderWidth: 1,
    borderColor: Colors.border.light,
  },
  conditionChipActive: {
    backgroundColor: Colors.primary.sage,
    borderColor: Colors.primary.sage,
  },
  conditionChipLabel: {
    ...Typography.preset.captionBold,
    color: Colors.text.secondary,
  },
  conditionChipLabelActive: {
    color: Colors.text.inverse,
  },
  // Celebration
  celebration: {
    alignItems: 'center',
    paddingTop: Spacing['3xl'],
  },
  celebrationEmojiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  celebrationEmoji: {
    fontSize: 80,
  },
  celebrationHeart: {
    fontSize: 36,
  },
  celebrationTitle: {
    ...Typography.preset.h2,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  celebrationBody: {
    ...Typography.preset.body,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: Spacing.md,
  },
  // Action bar
  actionBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
    backgroundColor: Colors.surface.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border.light,
  },
  secondaryButton: {
    flex: 1,
    height: Spacing.buttonHeight.lg,
    borderRadius: Spacing.radius.full,
    backgroundColor: Colors.surface.card,
    borderWidth: 1,
    borderColor: Colors.border.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    ...Typography.preset.button,
    color: Colors.text.secondary,
  },
  // GradientButton owns its height / fill / padding / shadow — we only
  // hand it flex growth so it fills the action bar next to Back.
  primaryButtonGrow: {
    flex: 2,
  },
});
