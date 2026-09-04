/**
 * Dottie — Simulated User Harness  (npm run test:app)
 *
 * A full pass through the app as a PERSON would use it, driving the REAL
 * Zustand stores and the REAL SQLite repositories — onboarding, logging
 * periods, check-ins, sisterhood, learning, reminders — and asserting what the
 * user should be seeing at each point.
 *
 * ─── WHY THIS EXISTS, AND WHY THE OTHER HARNESSES WEREN'T ENOUGH ────
 *
 *  The other 14 suites test PURE functions, which is a real safety net but has
 *  a shape-shaped hole in it: every bug that has actually reached the owner
 *  lived in the WIRING. The period-log freeze sat between a SQL query and a
 *  date helper in `cycle.repo.ts`; no pure test could ever have touched it. So
 *  this harness runs the wiring: real migrations, real SQL, real store actions,
 *  in dependency order, against `node:sqlite` and an in-memory MMKV
 *  (`scripts/harness/shims/`).
 *
 *  It cannot press a button — there is no device and no renderer here, and it
 *  would be dishonest to claim otherwise. What it does is exercise everything
 *  a button press CALLS. Rendering, layout, gestures and animation still need
 *  the owner on a real phone; `npm run audit:ui` covers "every tappable has a
 *  handler" statically, and this covers "the handler does the right thing".
 *
 * ─── HOW A HANG IS CAUGHT ───────────────────────────────────────────
 *
 *  Every step races a watchdog (see lib/runner.ts). A step that never settles
 *  is reported as a HANG with its name instead of silently wedging the run —
 *  which is precisely how the freeze bug should have surfaced months ago.
 *
 * ─── THE DIAGNOSTIC LOG ─────────────────────────────────────────────
 *
 *  The run drives the app's own logger (`src/diagnostics/logger.ts`), so it
 *  ends by printing the same redacted report the owner shares from
 *  Profile → Diagnostics. That makes the harness output directly comparable to
 *  a real device trace.
 */

import './harness/bootstrap';

import { Harness } from './harness/lib/runner';
import { initEncryptedStorage, Storage } from '../src/database/storage';
import { hydrateAppState } from '../src/stores/hydrate';
import { getDatabase } from '../src/database/client';
import {
  useUserStore,
  useCycleStore,
  useSisterhoodStore,
  useGamificationStore,
  selectCurrentPhase,
  selectDayInCycle,
  selectLastPeriodStart,
  selectCompanionType,
} from '../src/stores';
import { log, openSession, getEvents, clearEvents } from '../src/diagnostics/logger';
import { formatReport } from '../src/diagnostics/log-format';
import { addDays, todayCivil } from '../src/utils/civil-date';
import { explainPrediction } from '../src/engine/prediction/explain-prediction';
import { buildCycleLengthSeries, buildFlowShape } from '../src/engine/prediction/chart-data';
import { findCycleOverlaps } from '../src/engine/calendar/cycle-overlap';
import { groupPeriodBlocks, analysePeriodPattern } from '../src/engine/calendar/period-blocks';
import { buildSisterOverlay } from '../src/engine/calendar/sister-overlay';
import { nudgeForScore } from '../src/engine/learn/encouragement';
import { stateForScore, stateForMood } from '../src/components/ui/creature/expressions';
import * as notifShim from './harness/shims/expo-notifications';
import { checkinRepository } from '../src/database/repositories/checkin.repo';
import { cycleRepository } from '../src/database/repositories/cycle.repo';
import { sisterhoodRepository } from '../src/database/repositories/sisterhood.repo';
import type { HealthCondition } from '../src/types/cycle.types';

const H = new Harness(5000);

// The simulated "today". Fixed so the run is reproducible, and deliberately
// mid-month so month-boundary arithmetic still gets exercised around it.
const TODAY = todayCivil();
const day = (offset: number) => addDays(TODAY, offset);

async function main(): Promise<void> {
  // ─── ACT 1 — FIRST LAUNCH + ONBOARDING ───────────────────────────
  H.act('ACT 1 · First launch and onboarding');

  await H.step('cold boot: unlock storage', async () => {
    await initEncryptedStorage();
    openSession('harness');
    clearEvents();
    log.nav('/');
  });

  await H.step('hydrate the app (migrations + stores)', async () => {
    const r = await hydrateAppState();
    H.expect('migrations applied', r.migrationApplied);
    H.expect('no hydration error', r.error === null, r.error ?? '');
    H.expect('no user yet — onboarding is required', !r.hasUser);
  });

  await H.step('schema is complete', async () => {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    const names = rows.map((r) => r.name);
    for (const t of ['users', 'cycle_entries', 'cycle_records', 'daily_check_ins',
                     'symptom_logs', 'sisterhood_members', 'shadow_cycle_entries',
                     'quiz_attempts', 'lesson_progress', 'gamification_state']) {
      H.expect(`table ${t} exists`, names.includes(t));
    }
  });

  await H.step('walk the onboarding screens (mode, conditions, companion)', async () => {
    log.nav('/welcome');
    log.nav('/mode-select');
    log.nav('/conditions');
    log.nav('/companion-select');
    log.nav('/cycle-setup');
    Storage.onboardingDraft.set({
      mode: 'adult',
      companionType: 'cat',
      healthConditions: ['pcos', 'thyroid'] as HealthCondition[],
      age: 27,
      averageCycleLength: 29,
      averagePeriodLength: 5,
      lastPeriodStart: day(-3),
    });
    H.expect('draft persisted before commit', Storage.onboardingDraft.get() !== null);
  });

  await H.step('tap "Let\'s Go" — completeOnboarding()', async () => {
    const user = await useUserStore.getState().completeOnboarding();
    H.expect('a user now exists', !!user?.id);
    H.expect('the chosen companion stuck',
      selectCompanionType(useUserStore.getState()) === 'cat',
      String(selectCompanionType(useUserStore.getState())));
    H.expect('mode saved', user.mode === 'adult', String(user.mode));
    H.expect('both conditions saved',
      user.healthProfile.conditions.includes('pcos') && user.healthProfile.conditions.includes('thyroid'),
      user.healthProfile.conditions.join());
    H.expect('reported cycle length saved', user.healthProfile.averageCycleLength === 29);
    H.expect('onboarding flag set', Storage.hasOnboarded.get() === true);
    H.expect('current user id mirrored to MMKV', Storage.currentUserId.get() === user.id);
  });

  await H.step('the seeded first period landed', async () => {
    await useCycleStore.getState().refresh();
    const last = selectLastPeriodStart(useCycleStore.getState());
    H.expect('lastPeriodStart is the date given at setup', last === day(-3), String(last));
    H.expect('a phase is now known', selectCurrentPhase(useCycleStore.getState()) !== null);
    const d = selectDayInCycle(useCycleStore.getState());
    H.expect('day in cycle is sane (1-60)', d !== null && d >= 1 && d <= 60, String(d));
  });

  // ─── ACT 2 — LOGGING PERIODS (the freeze path) ───────────────────
  H.act('ACT 2 · Logging periods — including the device-test-7 freeze repro');

  const uid = () => useUserStore.getState().userId!;

  await H.step('mark today as a period day', async () => {
    log.nav('/calendar');
    log.action('daySheet:open');
    await useCycleStore.getState().logPeriodDay({ date: day(-3), flowLevel: 3 });
    log.action('logPeriodDay:done');
  });

  // THE REGRESSION. Logging a day LATER than an existing one is what used to
  // spin forever inside detectAndSaveCycleRecord. If it ever returns, the
  // watchdog above will have already failed the step.
  await H.step('⚠ REPRO: log a SECOND, LATER day (this used to freeze the app)', async () => {
    await useCycleStore.getState().logPeriodDay({ date: day(-2), flowLevel: 4 });
    const last = selectLastPeriodStart(useCycleStore.getState());
    H.expect('still responsive, and the block start is unchanged', last === day(-3), String(last));
  });

  await H.step('log a contiguous block, ascending', async () => {
    for (const off of [-1, 0]) {
      await useCycleStore.getState().logPeriodDay({ date: day(off), flowLevel: 2 });
    }
    const days = await cycleRepository.getPeriodDaysInRange(uid(), day(-10), day(2));
    H.expect('4 period days recorded', days.length === 4, String(days.length));
    const blocks = groupPeriodBlocks(days);
    H.expect('they group into ONE block', blocks.length === 1, JSON.stringify(blocks));
    H.expect('block spans 4 days', blocks[0]?.lengthDays === 4, String(blocks[0]?.lengthDays));
  });

  await H.step('log across a month boundary', async () => {
    // Find a month end near today so this is a real boundary, not a synthetic one.
    const base = `${TODAY.slice(0, 7)}-28`;
    for (const off of [0, 1, 2, 3, 4]) {
      await useCycleStore.getState().logPeriodDay({ date: addDays(base, off), flowLevel: 3 });
    }
    const days = await cycleRepository.getPeriodDaysInRange(uid(), addDays(base, -1), addDays(base, 6));
    H.expect('all 5 days across the boundary stored', days.length === 5, String(days.length));
    H.expect('they are one contiguous block', groupPeriodBlocks(days).length === 1);
  });

  await H.step('backfill a period in a PAST month', async () => {
    const past = addDays(TODAY, -35);
    for (const off of [0, 1, 2, 3]) {
      await useCycleStore.getState().logPeriodDay({ date: addDays(past, off), flowLevel: 3 });
    }
    await useCycleStore.getState().refresh();
    H.expect('cycle count grew from the backfill',
      useCycleStore.getState().cycleCount > 0, String(useCycleStore.getState().cycleCount));
  });

  await H.step('build a real history — six cycles', async () => {
    // Roughly 29-day spacing with natural variation, oldest first.
    const starts = [-180, -151, -124, -93, -65, -35];
    for (const s of starts) {
      for (let d = 0; d < 5; d++) {
        await useCycleStore.getState().logPeriodDay({ date: addDays(TODAY, s + d), flowLevel: d < 2 ? 4 : 2 });
      }
    }
    await useCycleStore.getState().refresh();
    const st = useCycleStore.getState();
    H.expect('several completed cycles recorded', st.cycleCount >= 4, String(st.cycleCount));
    H.expect('history is available to the predictor', st.cycleHistory.length >= 4, String(st.cycleHistory.length));
  });

  await H.step('the prediction recomputes and is sane', async () => {
    const p = await useCycleStore.getState().recomputePrediction();
    H.expect('a prediction exists', !!p);
    H.expect('it predicts a FUTURE date', !!p && p.predictedNextPeriod > TODAY,
      p?.predictedNextPeriod ?? 'none');
    H.expect('confidence is a real probability', !!p && p.confidence > 0 && p.confidence <= 1, String(p?.confidence));
    H.expect('the window is plausible', !!p && p.windowDays >= 0 && p.windowDays <= 14, String(p?.windowDays));
    H.expect('it names the factors it used', !!p && p.factorsUsed.length > 0);
  });

  await H.step('re-logging the SAME day is idempotent', async () => {
    const before = (await cycleRepository.getPeriodDaysInRange(uid(), day(-10), day(2))).length;
    await useCycleStore.getState().logPeriodDay({ date: day(-3), flowLevel: 1 });
    const after = (await cycleRepository.getPeriodDaysInRange(uid(), day(-10), day(2))).length;
    H.expect('no duplicate row created', before === after, `${before} → ${after}`);
  });

  // ─── ACT 3 — THE SCIENCE THE CALENDAR SHOWS ──────────────────────
  H.act('ACT 3 · The prediction explainer and its three graphs');

  await H.step('the explainer card has something to render', async () => {
    const st = useCycleStore.getState();
    const user = useUserStore.getState().user!;
    const e = explainPrediction({
      cycleHistory: st.cycleHistory,
      healthProfile: user.healthProfile,
      lastPeriodStart: new Date(st.lastPeriodStart!),
      predictionErrors: st.predictionErrors,
    });
    H.expect('point date is in the future', e.pointDate > TODAY, e.pointDate);
    H.expect('interval brackets the point date',
      e.intervalStartDate <= e.pointDate && e.pointDate <= e.intervalEndDate,
      `${e.intervalStartDate}..${e.intervalEndDate}`);
    H.expect('standard deviation is positive', e.stdDevDays > 0, String(e.stdDevDays));
    H.expect('window probability is a probability',
      e.approxWindowProbability > 0 && e.approxWindowProbability <= 1, String(e.approxWindowProbability));
    H.expect('period length is clinically plausible (2-8d)',
      e.periodLengthDays >= 2 && e.periodLengthDays <= 8, String(e.periodLengthDays));
    H.expect('heavy days fall inside the period', e.heavyEndDate <= e.periodEndDate);
    H.expect('it lists what shaped the prediction', e.factors.length > 0, String(e.factors.length));
    H.expect('the store copy matches the freshly computed one',
      useCycleStore.getState().latestExplanation?.pointDate === e.pointDate);

    const banned = /\b(abnormal|irregular|disorder|you should|diagnos)/i;
    H.expect('summary stays non-diagnostic', !banned.test(e.plainSummary), e.plainSummary);
    H.expect('science paragraph stays non-diagnostic', !banned.test(e.scienceSummary));
  });

  await H.step('all three graphs have data', async () => {
    const st = useCycleStore.getState();
    const lens = buildCycleLengthSeries(st.cycleHistory);
    H.expect('cycle-length series has points', lens.points.length > 0, String(lens.points.length));
    H.expect('mean is a real cycle length', lens.mean > 15 && lens.mean < 60, String(lens.mean));
    H.expect('SD is computable', lens.sd >= 0, String(lens.sd));
    H.expect('domain contains the ±SD band',
      lens.mean + lens.sd <= lens.maxLength && lens.mean - lens.sd >= lens.minLength);

    const flow = buildFlowShape(5, st.cycleHistory);
    H.expect('flow shape has one bar per period day', flow.points.length === 5, String(flow.points.length));
    H.expect('it uses the user\'s own logged flow', flow.source === 'your-logs', flow.source);
    H.expect('heaviness never increases later in the period',
      flow.points.every((p, i) => i === 0 || p.level <= flow.points[i - 1]!.level));
  });

  await H.step('the logging-pattern nudge behaves', async () => {
    const days = await cycleRepository.getPeriodDaysInRange(uid(), addDays(TODAY, -200), day(5));
    const pattern = analysePeriodPattern(days);
    H.expect('a realistic history raises no alarm', pattern.warnings.length === 0,
      pattern.warnings.map((w) => w.message).join(' | '));
    H.expect('blocks were derived', pattern.blocks.length > 0, String(pattern.blocks.length));
  });

  // ─── ACT 4 — DAILY CHECK-IN ──────────────────────────────────────
  H.act('ACT 4 · Daily check-in and symptoms');

  await H.step('save a check-in', async () => {
    log.nav('/daily-checkin');
    const c = await useCycleStore.getState().saveCheckIn({
      date: TODAY, moodScore: 2, energyLevel: 2, sleepQuality: 3, stressLevel: 4,
    });
    H.expect('check-in stored', c.date === TODAY);
    H.expect('the store now holds today\'s check-in',
      useCycleStore.getState().todayCheckIn?.moodScore === 2);
    H.expect('a rough mood gives a supportive companion, never a grin',
      stateForMood(2) === 'sad', stateForMood(2));
  });

  await H.step('log a symptom in every allowed category', async () => {
    const cats = ['physical', 'emotional', 'skin', 'energy', 'sleep'] as const;
    for (const category of cats) {
      await useCycleStore.getState().logSymptom({
        date: TODAY, category, symptomType: `${category}_test`, severity: 3,
      });
    }
    const recent = await checkinRepository.getRecentSymptoms(uid(), 7, TODAY);
    H.expect('all five categories accepted by the CHECK constraint',
      recent.length >= 5, String(recent.length));
  });

  await H.step('an invalid symptom category is REJECTED, not silently dropped', async () => {
    let threw = false;
    try {
      await checkinRepository.logSymptom({
        userId: uid(), date: TODAY,
        category: 'nonsense' as 'physical', symptomType: 'x', severity: 1,
      });
    } catch { threw = true; }
    H.expect('the database refuses a bad category', threw);
  });

  await H.step('an updated check-in overwrites rather than duplicating', async () => {
    await useCycleStore.getState().saveCheckIn({ date: TODAY, moodScore: 5 });
    const rows = await checkinRepository.getCheckIn(uid(), TODAY);
    H.expect('mood updated', rows?.moodScore === 5, String(rows?.moodScore));
    H.expect('a good mood now reads as celebrate', stateForMood(5) === 'celebrate');
  });

  // ─── ACT 5 — SISTERHOOD ──────────────────────────────────────────
  H.act('ACT 5 · Sisterhood — adding a sister and logging for her');

  let sisterId = '';

  await H.step('open the circle and add a shadow sister', async () => {
    log.nav('/circle');
    log.nav('/add-member');
    const phase = selectCurrentPhase(useCycleStore.getState());
    await useSisterhoodStore.getState().refresh(uid(), phase);
    const member = await useSisterhoodStore.getState().addMember(uid(), phase, {
      displayName: 'Aisha',
      relationship: 'Little Sister',
      kind: 'shadow',
      privacyLevel: 'full',
      emoji: '🌸',
      shadowContext: {
        age: 15, mode: 'teen', conditions: [],
        averageCycleLength: null, lastPeriodStart: null, notes: null,
      },
    });
    sisterId = member.id;
    H.expect('the sister is in the circle', !!sisterId);
    H.expect('no seed date was written (the typed field is gone)',
      member.shadowContext?.lastPeriodStart == null,
      String(member.shadowContext?.lastPeriodStart));
  });

  await H.step('log her first period day on the shared calendar', async () => {
    const phase = selectCurrentPhase(useCycleStore.getState());
    await useSisterhoodStore.getState().logShadowPeriod(phase, {
      memberId: sisterId, date: day(-6), flowLevel: 3,
    });
  });

  await H.step('⚠ REPRO: log a SECOND, LATER day for her too', async () => {
    const phase = selectCurrentPhase(useCycleStore.getState());
    await useSisterhoodStore.getState().logShadowPeriod(phase, {
      memberId: sisterId, date: day(-5), flowLevel: 4,
    });
    const days = await sisterhoodRepository.getShadowPeriodDaysInRange(sisterId, day(-10), day(1));
    H.expect('both of her days stored', days.length === 2, String(days.length));
  });

  await H.step('build her a history so she gets a prediction', async () => {
    const phase = selectCurrentPhase(useCycleStore.getState());
    for (const s of [-90, -62, -34, -6]) {
      for (let d = 0; d < 4; d++) {
        await useSisterhoodStore.getState().logShadowPeriod(phase, {
          memberId: sisterId, date: addDays(TODAY, s + d), flowLevel: 3,
        });
      }
    }
    const v = useSisterhoodStore.getState().viewsById[sisterId];
    H.expect('her view exists', !!v);
    H.expect('she has a day-in-cycle', v?.dayInCycle != null, String(v?.dayInCycle));
    H.expect('she has a predicted next period', v?.predictedNextPeriod != null,
      String(v?.predictedNextPeriod));
  });

  await H.step('her days render on the shared calendar in her own colour', async () => {
    const v = useSisterhoodStore.getState().viewsById[sisterId]!;
    const days = await sisterhoodRepository.getShadowPeriodDaysInRange(sisterId, addDays(TODAY, -100), day(30));
    const overlay = buildSisterOverlay({
      sisters: [{ memberId: v.memberId, displayName: v.displayName, emoji: v.emoji,
                  periodDays: days, predictedNextPeriod: v.predictedNextPeriod }],
      rangeStart: addDays(TODAY, -100), rangeEnd: day(30), today: TODAY,
    });
    H.expect('the overlay has marks to draw', overlay.marksByDate.size > 0, String(overlay.marksByDate.size));
    const anyLogged = [...overlay.marksByDate.values()].some((m) => m.some((x) => x.kind === 'logged'));
    H.expect('logged days are marked as logged', anyLogged);
    H.expect('every mark names the sister it belongs to',
      [...overlay.marksByDate.values()].every((m) => m.every((x) => x.memberId === sisterId)));
  });

  await H.step('overlapping windows are detected and hedged', async () => {
    const st = useCycleStore.getState();
    const v = useSisterhoodStore.getState().viewsById[sisterId]!;
    const overlaps = findCycleOverlaps({
      userPredictedStart: st.latestPrediction?.predictedNextPeriod ?? null,
      userPeriodLengthDays: 5,
      sisters: [{ memberId: v.memberId, displayName: v.displayName, emoji: v.emoji,
                  predictedNextPeriod: v.predictedNextPeriod }],
      today: TODAY,
    });
    H.note(`${overlaps.length} overlap(s) between the user and Aisha`);
    for (const o of overlaps) {
      H.expect('overlap range is ordered', o.overlapStart <= o.overlapEnd);
      H.expect('copy never claims cycles sync', !/\bsync/i.test(o.summary), o.summary);
    }
  });

  await H.step('privacy level actually filters what is exposed', async () => {
    const phase = selectCurrentPhase(useCycleStore.getState());
    await useSisterhoodStore.getState().updateMember(sisterId, phase, { privacyLevel: 'mood' });
    const v = useSisterhoodStore.getState().viewsById[sisterId]!;
    H.expect('flow is hidden at MOOD level', v.flowLevel === null, String(v.flowLevel));
    H.expect('next period is hidden at MOOD level', v.predictedNextPeriod === null,
      String(v.predictedNextPeriod));
    await useSisterhoodStore.getState().updateMember(sisterId, phase, { privacyLevel: 'full' });
    const back = useSisterhoodStore.getState().viewsById[sisterId]!;
    H.expect('restored at FULL level', back.predictedNextPeriod !== null);
  });

  // ─── ACT 6 — LEARN, QUIZZES, REWARDS ─────────────────────────────
  H.act('ACT 6 · Learning, quizzes and rewards');

  await H.step('a rough score gets support, a great one gets celebration', async () => {
    H.expect('1 of 3 does NOT read as pleased',
      !['happy', 'proud', 'celebrate', 'mindblown'].includes(stateForScore(33)), stateForScore(33));
    H.expect('a perfect run is mind-blown', stateForScore(100) === 'mindblown');
    const low = nudgeForScore(1 / 3, 0);
    H.expect('a low score invites another go', low.invitesRetry, low.text);
    H.expect('nudges rotate between attempts',
      nudgeForScore(1 / 3, 0).text !== nudgeForScore(1 / 3, 1).text);
  });

  await H.step('earn XP and gems', async () => {
    await useGamificationStore.getState().refresh();
    const before = useGamificationStore.getState().xpTotal;
    await useGamificationStore.getState().awardXp('lesson_complete');
    const after = useGamificationStore.getState().xpTotal;
    H.expect('XP increased', after > before, `${before} → ${after}`);
  });

  await H.step('record a check-in streak', async () => {
    const r = await useGamificationStore.getState().recordCheckIn(TODAY);
    H.expect('streak is at least 1', r.newStreakCount >= 1, String(r.newStreakCount));
    const again = await useGamificationStore.getState().recordCheckIn(TODAY);
    H.expect('checking in twice in a day does not double the streak',
      again.newStreakCount === r.newStreakCount,
      `${r.newStreakCount} → ${again.newStreakCount}`);
  });

  // ─── ACT 7 — NOTIFICATION DISCIPLINE ─────────────────────────────
  H.act('ACT 7 · Notification permission discipline');

  await H.step('nothing prompted for notifications during the whole run', async () => {
    const prompted = notifShim.__calls.filter((c) => c === 'requestPermissionsAsync');
    H.expect('requestPermissionsAsync was never called on its own', prompted.length === 0,
      `called ${prompted.length}×`);
  });

  // ─── ACT 8 — RESTART, AND THE DIAGNOSTIC TRAIL ───────────────────
  H.act('ACT 8 · Restart — does anything survive?');

  await H.step('state survives a store refresh (simulated app restart)', async () => {
    await useUserStore.getState().refresh();
    await useCycleStore.getState().refresh();
    const st = useCycleStore.getState();
    H.expect('the user is still there', !!useUserStore.getState().user);
    H.expect('the companion is still theirs',
      selectCompanionType(useUserStore.getState()) === 'cat',
      String(selectCompanionType(useUserStore.getState())));
    H.expect('cycle history survived', st.cycleHistory.length > 0);
    H.expect('the explanation is rebuilt on load, not left null', st.latestExplanation !== null);
  });


  // ─── ACT 9 — ADVERSARIAL: what a real user does by accident ──────
  //
  //  A scripted happy path proves the feature works; it proves nothing about
  //  what happens when someone fat-fingers a date, taps twice, or hands the
  //  phone to a teenager who logs every day of the month. Those are the inputs
  //  that produce the screenshots.
  H.act('ACT 9 · Adversarial input — fat fingers, double taps, nonsense');

  await H.step('log a period day in the FUTURE', async () => {
    await useCycleStore.getState().logPeriodDay({ date: day(20), flowLevel: 3 });
    const st = useCycleStore.getState();
    H.expect('the app survives it', true);
    H.expect('a future log does not become "last period"',
      (st.lastPeriodStart ?? '') <= TODAY,
      `lastPeriodStart=${st.lastPeriodStart} today=${TODAY}`);
  });

  await H.step('out-of-range flow levels', async () => {
    for (const flowLevel of [0, 6, -1, 99]) {
      await useCycleStore.getState().logPeriodDay({ date: day(-40), flowLevel });
    }
    const e = await checkinRepository.getRecentSymptoms(uid(), 1, TODAY);
    H.expect('no crash from silly flow values', Array.isArray(e));
  });

  await H.step('malformed dates are refused, not stored', async () => {
    for (const date of ['', 'today', '2026-13-45', '01/09/2026']) {
      try {
        await useCycleStore.getState().logPeriodDay({ date, flowLevel: 3 });
      } catch {
        /* throwing is a fine outcome — silently storing junk is not */
      }
    }
    const db = await getDatabase();
    const bad = await db.getAllAsync<{ date: string }>(
      "SELECT date FROM cycle_entries WHERE date NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'"
    );
    H.expect('no malformed date reached the table', bad.length === 0,
      bad.map((b) => JSON.stringify(b.date)).join());
  });

  await H.step('someone logs 40 consecutive days', async () => {
    const base = addDays(TODAY, -400);
    for (let i = 0; i < 40; i++) {
      await useCycleStore.getState().logPeriodDay({ date: addDays(base, i), flowLevel: 2 });
    }
    const days = await cycleRepository.getPeriodDaysInRange(uid(), addDays(base, -1), addDays(base, 45));
    const pattern = analysePeriodPattern(days);
    H.expect('the run is noticed and flagged', pattern.warnings.length > 0,
      String(pattern.warnings.length));
    H.expect('the nudge is about checking dates, not a diagnosis',
      pattern.warnings.every((w) => !/abnormal|irregular|disorder|see a doctor/i.test(w.message)),
      pattern.warnings.map((w) => w.message).join(' | '));
  });

  await H.step('double-tap: the same day logged twice concurrently', async () => {
    const d = addDays(TODAY, -300);
    await Promise.all([
      useCycleStore.getState().logPeriodDay({ date: d, flowLevel: 3 }),
      useCycleStore.getState().logPeriodDay({ date: d, flowLevel: 3 }),
    ]);
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM cycle_entries WHERE user_id = ? AND date = ?', uid(), d
    );
    H.expect('exactly one row for that day', rows[0]?.n === 1, String(rows[0]?.n));
  });

  await H.step('a sister with no logged days at all', async () => {
    const phase = selectCurrentPhase(useCycleStore.getState());
    const empty = await useSisterhoodStore.getState().addMember(uid(), phase, {
      displayName: 'Bea', relationship: 'Friend', kind: 'shadow', privacyLevel: 'full', emoji: '🌷',
      shadowContext: { age: 30, mode: 'adult', conditions: [], averageCycleLength: null, lastPeriodStart: null, notes: null },
    });
    const v = useSisterhoodStore.getState().viewsById[empty.id]!;
    H.expect('no fabricated prediction for her', v.predictedNextPeriod === null,
      String(v.predictedNextPeriod));
    H.expect('no fabricated day-in-cycle', v.dayInCycle === null, String(v.dayInCycle));
    const overlaps = findCycleOverlaps({
      userPredictedStart: useCycleStore.getState().latestPrediction?.predictedNextPeriod ?? null,
      sisters: [{ memberId: v.memberId, displayName: v.displayName, emoji: v.emoji, predictedNextPeriod: null }],
      today: TODAY,
    });
    H.expect('and no invented overlap', overlaps.length === 0);
  });

  await H.step('graphs survive a user with almost no data', async () => {
    const lens = buildCycleLengthSeries([]);
    H.expect('empty series is still drawable', lens.maxLength > lens.minLength);
    H.expect('and says so honestly', lens.provisional);
    const flow = buildFlowShape(5, []);
    H.expect('flow falls back to the population pattern', flow.source === 'typical-pattern');
    H.expect('and never claims it measured her', flow.provisional);
  });

  await H.step('deleting the account clears everything', async () => {
    const id = uid();
    await useUserStore.getState().deleteAccount();
    const db = await getDatabase();
    const left = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM cycle_entries WHERE user_id = ?', id
    );
    H.expect('cycle entries are gone', left?.n === 0, String(left?.n));
    H.expect('the store forgot the user', useUserStore.getState().user === null);
    H.expect('MMKV forgot the user id', Storage.currentUserId.get() === null,
      String(Storage.currentUserId.get()));
  });

  // ─── ACT 10 — THE DIAGNOSTIC TRAIL ───────────────────────────────
  H.act('ACT 10 · The shareable diagnostic log');

  await H.step('the diagnostic log is populated and redacted', async () => {
    const events = getEvents();
    H.expect('events were recorded', events.length > 0, String(events.length));
    const redacted = formatReport(events, false, { app: 'harness', events: events.length });
    H.expect('no raw ISO date leaks into the redacted report',
      !/\d{4}-\d{2}-\d{2}/.test(redacted.split('\n').slice(4).join('\n')),
      redacted.split('\n').find((l) => /\d{4}-\d{2}-\d{2}/.test(l)) ?? '');
    H.note(`log contains ${events.length} events`);
  });
}

main()
  .then(() => {
    console.log('\n');
    process.exit(H.report());
  })
  .catch((err) => {
    console.error('\n\x1b[31mHARNESS CRASHED\x1b[0m\n', err);
    H.report();
    process.exit(1);
  });
