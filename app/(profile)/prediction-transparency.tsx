/**
 * Dottie — How your forecast works, and how to sharpen it
 *
 * ─── WHY (device-test-29) ───────────────────────────────────────────
 *
 *  Owner: "add a transparency section under You — how the predictions are
 *  being done, what is being considered, and what the user needs to do to make
 *  the prediction power even better. The entire app depends on the prediction."
 *
 *  Both halves matter, and they are different jobs:
 *
 *  · TRANSPARENCY answers "what is this number built from" — including the
 *    inputs we collect and deliberately do NOT use. A disclosure that lists
 *    only the flattering half is an advertisement (rule 31).
 *
 *  · IMPROVEMENT answers "so what do I do about it". A bare 35% is a grade
 *    with no rubric: it tells someone the app is unsure without saying whether
 *    that is their doing, their body's, or ours.
 *
 *  The engine behind the second half is `engine/prediction/improve.ts`, which
 *  is careful about one thing above all: for a genuinely variable cycle it
 *  says so and stops, instead of promising that more logging will help. It
 *  will not. That is the honest end of what a calendar model can do.
 *
 *  Everything on this screen is computed from the user's own state — there is
 *  no cohort, no "users like you", no invented statistic (rule 2). Where a
 *  number is quoted it comes from our own measured runs, and it says so.
 */

import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { AuroraBackground, GlassCard, PressableScale } from '../../src/components/ui';
import { A } from '../../src/theme';
import { useUserStore, useCycleStore } from '../../src/stores';
import { predictionFactors, transparencySummary } from '../../src/engine/prediction/what-we-use';
import {
  improvementActions,
  confidenceBreakdown,
  confidenceLabel,
  type ImprovementAction,
  type PredictionReadiness,
} from '../../src/engine/prediction/improve';
import { Storage } from '../../src/database/storage';
import { todayCivil } from '../../src/utils/civil-date';
import { recentWeightChangeKg } from '../../src/engine/prediction/weight-change';

export default function PredictionTransparencyScreen(): JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useUserStore((s) => s.user);
  const cycleCount = useCycleStore((s) => s.cycleCount);
  const cycleHistory = useCycleStore((s) => s.cycleHistory);
  const lastPeriodStart = useCycleStore((s) => s.lastPeriodStart);
  const prediction = useCycleStore((s) => s.latestPrediction);
  const todayCheckIn = useCycleStore((s) => s.todayCheckIn);

  const hp = user?.healthProfile ?? null;

  /**
   * The spread of the user's OWN cycles. Null under three, because a standard
   * deviation of two numbers is not a fact about a body — and this figure is
   * what decides whether we tell someone their cycle is variable.
   */
  const spread = useMemo(() => {
    const lengths = cycleHistory.map((c) => c.cycleLength).filter((n) => n > 15 && n < 60);
    if (lengths.length < 3) return null;
    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / (lengths.length - 1);
    return Math.sqrt(variance);
  }, [cycleHistory]);

  const readiness: PredictionReadiness = useMemo(
    () => ({
      cycleCount,
      hasLastPeriod: lastPeriodStart !== null,
      cycleSpreadDays: spread,
      healthProfile: {
        age: hp?.age ?? null,
        averageCycleLength: hp?.averageCycleLength ?? null,
        conditions: hp?.conditions ?? [],
      },
      conditionsAnswered: (hp?.conditions?.length ?? 0) > 0,
      weightTracked:
        recentWeightChangeKg(Storage.weightLog.get(), todayCivil()) !== undefined,
      checkInsLast7: todayCheckIn ? 1 : 0,
      confidence: prediction?.confidence ?? 0,
      windowDays: prediction?.windowDays ?? 0,
    }),
    [cycleCount, lastPeriodStart, spread, hp, todayCheckIn, prediction]
  );

  const actions = useMemo(() => improvementActions(readiness), [readiness]);
  const breakdown = useMemo(() => confidenceBreakdown(readiness), [readiness]);
  const factors = useMemo(
    () =>
      predictionFactors({
        healthProfile: hp,
        cycleCount,
        lastPeriodStart,
        stressLevel: todayCheckIn?.stressLevel,
        sleepQuality: todayCheckIn?.sleepQuality,
        subject: 'you',
      }),
    [hp, cycleCount, lastPeriodStart, todayCheckIn]
  );

  const pct = Math.round((prediction?.confidence ?? 0) * 100);
  const todo = actions.filter((a) => !a.done);
  const done = actions.filter((a) => a.done);

  return (
    <AuroraBackground>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing['3xl'] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <PressableScale onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={styles.backText}>‹ Back</Text>
        </PressableScale>

        <Text style={styles.title}>Your forecast, explained</Text>
        <Text style={styles.sub}>
          What the prediction is built from, why it is as confident as it is, and what
          would sharpen it. All of it computed on this phone, from your own logs.
        </Text>

        {/* ─── THE NUMBER, AND WHY ────────────────────────────────── */}
        {prediction ? (
          <GlassCard style={styles.card} padding={Spacing.cardPadding}>
            <View style={styles.headRow}>
              <Text style={styles.big}>{pct}%</Text>
              <View style={styles.headText}>
                <Text style={styles.headLabel}>{confidenceLabel(prediction.confidence)}</Text>
                <Text style={styles.headSub}>
                  Predicted within ±{prediction.windowDays}{' '}
                  {prediction.windowDays === 1 ? 'day' : 'days'}
                </Text>
              </View>
            </View>
            <Text style={styles.sectionLabel}>WHY IT IS THIS NUMBER</Text>
            {breakdown.map((f) => (
              <View key={f.label} style={styles.factorRow}>
                <Text
                  style={[
                    styles.arrow,
                    {
                      color:
                        f.direction === 'lifts'
                          ? A.success
                          : f.direction === 'lowers'
                            ? A.gold
                            : A.ink3,
                    },
                  ]}
                >
                  {f.direction === 'lifts' ? '▲' : f.direction === 'lowers' ? '▼' : '–'}
                </Text>
                <View style={styles.factorBody}>
                  <Text style={styles.factorLabel}>{f.label}</Text>
                  <Text style={styles.factorDetail}>{f.detail}</Text>
                </View>
              </View>
            ))}
          </GlassCard>
        ) : (
          <GlassCard style={styles.card} padding={Spacing.cardPadding}>
            <Text style={styles.factorLabel}>No forecast yet</Text>
            <Text style={styles.factorDetail}>
              Log the day your period starts and the first one appears. Everything on this
              screen fills in from there.
            </Text>
          </GlassCard>
        )}

        {/* ─── WHAT THE NUMBER ACTUALLY IS (device-test-29) ───────
            Owner: "we should display that the prediction is a median
            prediction, and what the standard deviation actually means to the
            user." Right — a date with no distribution behind it reads as a
            promise, and then a two-day miss feels like a bug rather than the
            middle of a range doing exactly what a middle does. */}
        <Text style={styles.h2}>What the date and the ± mean</Text>
        <GlassCard style={styles.card} padding={Spacing.cardPadding}>
          <Text style={styles.factorLabel}>The date is a middle, not a promise</Text>
          <Text style={styles.factorDetail}>
            Your forecast is the MIDDLE of the range your cycles suggest — half the time a
            period arrives before it, half the time after. It is not the app’s best guess
            at one exact day, because no honest model has one.
          </Text>
          <Text style={styles.factorLabel}>The ± is how spread out your cycles are</Text>
          <Text style={styles.factorDetail}>
            {spread === null
              ? 'Once you have logged three cycles, the app measures how much your own cycles vary and sets the ± from that. Until then it uses a cautious starting range.'
              : `Your logged cycles vary by about ${spread.toFixed(1)} days around their average. The ± window is built from that spread — a steady cycle earns a narrow window, a variable one honestly needs a wide one.`}
          </Text>
          <Text style={styles.factorLabel}>Where your conditions come in</Text>
          <Text style={styles.factorDetail}>
            A condition like PCOS or a thyroid condition does not shift the date. It widens
            the range the model starts from, because cycle length genuinely varies more —
            so the window opens up and the confidence figure comes down. That is the model
            being careful, not the app being unsure of itself.
          </Text>
          <Text style={styles.factorDetail}>
            As you log real cycles, your own history steadily replaces those starting
            assumptions. After about six, the forecast is almost entirely you.
          </Text>
        </GlassCard>

        {/* ─── WHAT TO DO ─────────────────────────────────────────── */}
        <Text style={styles.h2}>How to sharpen it</Text>
        <Text style={styles.sub}>
          In order of how much each one actually moves the forecast — not how easy it is
          for us to ask.
        </Text>
        {todo.map((a) => (
          <ActionRow key={a.id} action={a} onPress={() => a.route && router.push(a.route as never)} />
        ))}

        {done.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>ALREADY DONE</Text>
            {done.map((a) => (
              <View key={a.id} style={styles.doneRow}>
                <Text style={styles.doneTick}>✓</Text>
                <Text style={styles.doneText}>{a.title}</Text>
              </View>
            ))}
          </>
        )}

        {/* ─── EVERY INPUT, INCLUDING THE UNUSED ──────────────────── */}
        <Text style={styles.h2}>Every input, including the ones we ignore</Text>
        <Text style={styles.sub}>{transparencySummary(factors)}</Text>
        <GlassCard style={styles.card} padding={Spacing.cardPadding}>
          {factors.map((f) => (
            <View key={f.label} style={styles.factorRow}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      f.state === 'active' ? A.success : f.state === 'missing' ? A.gold : A.ink3,
                  },
                ]}
              />
              <View style={styles.factorBody}>
                <Text style={styles.factorLabel}>
                  {f.label}
                  {f.value ? <Text style={styles.factorValue}>{`  ${f.value}`}</Text> : null}
                </Text>
                <Text style={styles.factorDetail}>{f.effect}</Text>
                {f.state === 'not_used' && (
                  <Text style={styles.notUsed}>Collected, but the forecast never reads it.</Text>
                )}
              </View>
            </View>
          ))}
        </GlassCard>

        {/* ─── THE CEILING ────────────────────────────────────────── */}
        <Text style={styles.h2}>What no app can do</Text>
        <GlassCard style={styles.card} padding={Spacing.cardPadding}>
          <Text style={styles.factorDetail}>
            A calendar forecast can only be as sharp as your cycle is steady. If your
            cycles swing by five days, the best possible prediction is still about five
            days wide — that gap is your body, not the maths, and no amount of logging
            closes it.
          </Text>
          <Text style={styles.factorDetail}>
            The only thing that goes further is a measured signal on the day: an ovulation
            test, waking temperature, or cervical fluid. Dottie does not collect those
            yet. When it does, this screen will say so.
          </Text>
        </GlassCard>
      </ScrollView>
    </AuroraBackground>
  );
}

function ActionRow({ action, onPress }: { action: ImprovementAction; onPress: () => void }): JSX.Element {
  const tint = action.impact === 'high' ? A.accent : action.impact === 'medium' ? A.accent2 : A.ink3;
  return (
    <PressableScale
      onPress={onPress}
      haptic={action.route ? 'light' : 'none'}
      disabled={!action.route}
      scaleTo={0.99}
      style={[styles.action, { borderColor: `${tint}44` }]}
      accessibilityRole={action.route ? 'button' : 'text'}
      accessibilityLabel={action.title}
    >
      <View style={styles.actionHead}>
        <Text style={styles.actionTitle}>{action.title}</Text>
        <View style={[styles.impact, { borderColor: `${tint}66`, backgroundColor: `${tint}14` }]}>
          <Text style={[styles.impactText, { color: tint }]}>
            {action.impact === 'high' ? 'BIGGEST' : action.impact === 'medium' ? 'HELPS' : 'SMALL'}
          </Text>
        </View>
      </View>
      <Text style={styles.actionBody}>{action.body}</Text>
      {action.evidence ? <Text style={styles.evidence}>{action.evidence}</Text> : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.screenPadding, gap: Spacing.md },
  back: { alignSelf: 'flex-start', paddingVertical: Spacing.sm },
  backText: { ...Typography.preset.body, color: A.accent },
  title: { ...Typography.preset.h1, color: A.ink },
  h2: { ...Typography.preset.h2, color: A.ink, marginTop: Spacing.lg },
  sub: { ...Typography.preset.body, color: A.ink2, lineHeight: 22 },
  card: { gap: Spacing.sm },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.base },
  big: { ...Typography.preset.h1, fontSize: 44, color: A.accent, fontVariant: ['tabular-nums'] },
  headText: { flex: 1, gap: 2 },
  headLabel: { ...Typography.preset.bodySemibold, color: A.ink },
  headSub: { ...Typography.preset.caption, color: A.ink2 },
  sectionLabel: {
    ...Typography.preset.caption,
    fontSize: 10,
    letterSpacing: 0.9,
    fontWeight: '800',
    color: A.ink3,
    marginTop: Spacing.sm,
  },
  factorRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  arrow: { fontSize: 12, marginTop: 3, width: 14 },
  dot: { width: 9, height: 9, borderRadius: 5, marginTop: 6 },
  factorBody: { flex: 1, gap: 2 },
  factorLabel: { ...Typography.preset.bodySemibold, fontSize: 14.5, color: A.ink },
  factorValue: { ...Typography.preset.caption, color: A.accent },
  factorDetail: { ...Typography.preset.caption, fontSize: 12.5, lineHeight: 18, color: A.ink2 },
  notUsed: { ...Typography.preset.caption, fontSize: 11.5, color: A.ink3, fontStyle: 'italic' },
  action: {
    borderWidth: 1,
    borderRadius: Spacing.radius.lg,
    padding: Spacing.base,
    gap: 6,
    backgroundColor: A.glass,
  },
  actionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  actionTitle: { ...Typography.preset.bodySemibold, color: A.ink, flex: 1 },
  impact: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Spacing.radius.full, borderWidth: 1 },
  impactText: { ...Typography.preset.caption, fontSize: 9.5, fontWeight: '800', letterSpacing: 0.6 },
  actionBody: { ...Typography.preset.caption, fontSize: 12.5, lineHeight: 18, color: A.ink2 },
  evidence: { ...Typography.preset.caption, fontSize: 11.5, lineHeight: 17, color: A.ink3 },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
  doneTick: { color: A.success, fontSize: 13, fontWeight: '900' },
  doneText: { ...Typography.preset.caption, color: A.ink3 },
});
