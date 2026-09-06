/**
 * Dottie — data export service
 *
 * Gathers everything the user has logged, builds the .xlsx in memory, writes it
 * to the cache directory, and hands it to the OS share sheet.
 *
 * ─── WHY THE CACHE DIRECTORY ────────────────────────────────────────
 *
 *  The file is a copy of data the app already holds, made for one purpose:
 *  handing it to whatever the user picks from the share sheet. Writing it to
 *  documentDirectory would leave a second, permanent copy of an intimate health
 *  record sitting on the phone forever. cacheDirectory is reclaimed by the OS,
 *  and `discardExport` deletes it the moment the sheet closes. The user's real
 *  copy is wherever THEY chose to send it.
 *
 * ─── NO NETWORK, EVER ───────────────────────────────────────────────
 *
 *  Nothing here uploads. The workbook is assembled on the device by pure TS and
 *  goes straight into the platform share intent. Dottie never sees it.
 */

import { cycleRepository } from '../database/repositories/cycle.repo';
import { checkinRepository } from '../database/repositories/checkin.repo';
import { buildXlsx } from '../export/xlsx';
import { bytesToBase64 } from '../export/zip';
import {
  buildExportWorkbook,
  countExport,
  exportFileName,
  type ExportCounts,
  type ExportInput,
  type ExportProfile,
  type ExportReminder,
} from '../export/build-export';
import { predictionFactors } from '../engine/prediction/what-we-use';
import { Storage, medicationKinds, type ReminderTime } from '../database/storage';
import { formatClockTime } from '../engine/reminders/dedupe';
import { todayCivil } from '../utils/civil-date';
import { logSilentFailure } from '../diagnostics/silent-failure';
import type { HealthProfile } from '../types/cycle.types';

// ─── NATIVE MODULES ARE LOADED LAZILY, ON PURPOSE ───────────────────
//
//  expo-file-system and expo-sharing both call `requireNativeModule()` at
//  MODULE SCOPE — importing them runs native lookup immediately and THROWS if
//  the module isn't in the build. And expo-router constructs its route tree by
//  requiring every file under app/ at startup, so a static import here is
//  imported during BOOT, via app/(profile)/export-data.tsx.
//
//  That means a broken or missing native module in a once-a-month export
//  feature could take down app launch, before React renders and before any
//  error boundary exists to catch it — an unrecoverable white screen with no
//  message (device-test-15).
//
//  Requiring them inside the functions that use them moves that risk to the
//  moment someone taps Export, where the failure is catchable, reportable and
//  costs the user nothing but one feature. A leaf feature must never be able
//  to stop the app from starting.

type FileSystemModule = typeof import('expo-file-system');
type SharingModule = typeof import('expo-sharing');

function loadFileSystem(): FileSystemModule {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  return require('expo-file-system') as FileSystemModule;
}

function loadSharing(): SharingModule {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  return require('expo-sharing') as SharingModule;
}

// The whole of a person's logging history, bounded by dates SQLite can compare
// as strings. Wide enough that nobody's data falls outside it, narrow enough to
// stay a bounded query.
const RANGE_START = '1900-01-01';
const RANGE_END = '2999-12-31';

export interface GatherInput {
  userId: string;
  displayName: string | null;
  healthProfile: HealthProfile | null;
  appVersion: string;
}

/**
 * Read everything out of the repositories.
 *
 * Each read is individually guarded: one unreadable table must not cost the
 * user the other six. A phone with a corrupt symptom row should still be able
 * to export its cycles — the same read-side tolerance the calendar engines use.
 */
export async function gatherExportData(input: GatherInput): Promise<ExportInput> {
  const profile: ExportProfile = {
    displayName: input.displayName,
    age: input.healthProfile?.age ?? null,
    averageCycleLength: input.healthProfile?.averageCycleLength ?? null,
    averagePeriodLength: input.healthProfile?.averagePeriodLength ?? null,
    conditions: input.healthProfile?.conditions ?? [],
  };

  const cycles = await safe('export.cycles', () =>
    cycleRepository.getCycleHistory(input.userId, 500)
  );
  const entries = await safe('export.entries', () =>
    cycleRepository.getEntriesInRange(input.userId, RANGE_START, RANGE_END)
  );
  const checkIns = await safe('export.checkins', () =>
    checkinRepository.getCheckInsInRange(input.userId, RANGE_START, RANGE_END)
  );
  const symptoms = await safe('export.symptoms', () =>
    checkinRepository.getSymptomsInRange(input.userId, RANGE_START, RANGE_END)
  );
  const latest = await safe('export.prediction', async () => {
    const p = await cycleRepository.getLatestPrediction(input.userId);
    return p ? [p] : [];
  });

  // ─── WHAT THEY ASKED THE APP TO DO (device-test-22) ─────────────
  //
  //  Reminders live in MMKV, not SQLite, so they are read here rather than
  //  through a repository. Wrapped in `safe` like every other read: an
  //  unreadable preferences blob must not cost the user their cycle history.
  const reminders = await safe('export.reminders', async () => gatherReminders());

  // ─── AND WHAT THE FORECAST IS MADE OF (device-test-23) ──────────
  //
  //  Owner: "this transparency also needs to be added [to the Excel sheet]."
  //  The spreadsheet is the copy that goes to a doctor, so it is the copy that
  //  most needs to be straight about which of these numbers the model read —
  //  including the ones it did not.
  const factors = await safe('export.factors', async () =>
    predictionFactors({
      healthProfile: input.healthProfile,
      cycleCount: cycles.length,
      lastPeriodStart: cycles.length > 0 ? (cycles[cycles.length - 1]?.startDate ?? null) : null,
      stressLevel: checkIns[checkIns.length - 1]?.stressLevel ?? null,
      sleepQuality: checkIns[checkIns.length - 1]?.sleepQuality ?? null,
      premenstrualSignal: false,
      subject: 'you',
    }).map((f) => ({
      what: f.label,
      status:
        f.state === 'active' ? 'In use' : f.state === 'missing' ? 'Not yet given' : 'Not used',
      effect: f.effect,
      value: f.value ?? '',
    }))
  );

  // Sorted oldest-first: a spreadsheet reads down the page, and a line chart
  // drawn from newest-first rows runs backwards.
  const asc = <T extends { date: string }>(rows: T[]) =>
    [...rows].sort((a, b) => a.date.localeCompare(b.date));

  return {
    generatedOn: todayCivil(),
    appVersion: input.appVersion,
    profile,
    cycles: [...cycles].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    periodDays: asc(entries.filter((e) => e.isPeriodDay)).map((e) => ({
      date: e.date,
      flowLevel: e.flowLevel,
      phase: e.phase,
    })),
    checkIns: asc(checkIns).map((c) => ({
      date: c.date,
      moodScore: c.moodScore,
      energyLevel: c.energyLevel,
      sleepQuality: c.sleepQuality,
      stressLevel: c.stressLevel,
      notes: c.notes,
    })),
    symptoms: asc(symptoms).map((s) => ({
      date: s.date,
      category: s.category,
      symptomType: s.symptomType,
      severity: s.severity,
      phaseAtLog: s.phaseAtLog,
    })),
    // The predictions table keeps the live one; the cycle records say what
    // actually happened, so the two are matched here rather than in the pure
    // builder, which must not know about repositories.
    reminders,
    factors,
    predictions: latest.map((p) => ({
      predictedNextPeriod: p.predictedNextPeriod,
      windowDays: p.windowDays,
      confidence: p.confidence,
      actualStart:
        cycles.find((c) => c.startDate >= p.predictedNextPeriod)?.startDate ?? null,
    })),
  };
}

/**
 * Every reminder the user has set, flattened into rows.
 *
 * Three sources, one list, because that is how the user thinks about it: the
 * built-in nudges, the ones they wrote themselves, and their medication plans.
 */
function gatherReminders(): ExportReminder[] {
  const prefs = Storage.reminderPrefs.get();
  const meds = Storage.medications.get();
  const rows: ExportReminder[] = [];

  const clock = (hour: number | undefined, minute: number | undefined, fallback: ReminderTime) =>
    hour === undefined
      ? `Every day, ${fallback}`
      : `Every day at ${formatClockTime(hour, minute ?? 0)}`;

  rows.push({
    what: 'Daily check-in',
    kind: 'Built-in',
    when: clock(prefs.checkInHour, prefs.checkInMinute, prefs.checkInTime),
    on: prefs.checkIn,
  });
  rows.push({
    what: 'Hydration nudge',
    kind: 'Built-in',
    when: clock(prefs.hydrationHour, prefs.hydrationMinute, 'midday'),
    on: prefs.hydration,
  });
  rows.push({
    what: 'Period heads-up',
    kind: 'Built-in',
    when: `${prefs.periodHeadsUpLeadDays} day(s) before the predicted period`,
    on: prefs.periodHeadsUp,
  });
  rows.push({
    what: 'Did it start?',
    kind: 'Built-in',
    when: 'On the predicted day',
    on: prefs.periodArrivedCheck,
  });
  rows.push({
    what: 'Phase changes',
    kind: 'Built-in',
    when: 'On the predicted ovulation day',
    on: prefs.phaseChange,
  });
  rows.push({
    what: 'Weekly recap',
    kind: 'Built-in',
    when: 'Sunday evening',
    on: prefs.weeklyRecap,
  });

  for (const c of prefs.custom) {
    rows.push({
      what: c.label,
      kind: 'Your own',
      when: `Every day at ${formatClockTime(c.hour, c.minute)}`,
      on: c.active,
    });
  }

  for (const m of meds) {
    rows.push({
      what: `${m.name} (${medicationKinds(m).join(', ')})`,
      kind: 'Medication',
      when: clock(m.hour, m.minute, m.time),
      on: m.active,
    });
  }

  return rows;
}

/** What the export screen shows BEFORE the user commits to making a file. */
export function summariseExport(data: ExportInput): ExportCounts {
  return countExport(data);
}

export interface WrittenExport {
  uri: string;
  fileName: string;
  bytes: number;
}

/** Build the workbook and write it to the cache directory. */
export async function writeExportFile(data: ExportInput): Promise<WrittenExport> {
  const FileSystem = loadFileSystem();
  const bytes = buildXlsx(buildExportWorkbook(data));
  const fileName = exportFileName(data.generatedOn);
  const dir = FileSystem.cacheDirectory;
  if (!dir) throw new Error('No cache directory available on this device');
  const uri = `${dir}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, bytesToBase64(bytes), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { uri, fileName, bytes: bytes.length };
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Hand the file to the OS share sheet.
 *
 * Returns false when the platform has no share sheet at all, so the caller can
 * say something true rather than appearing to do nothing.
 */
export async function shareExportFile(file: WrittenExport): Promise<boolean> {
  const Sharing = loadSharing();
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, {
    mimeType: XLSX_MIME,
    dialogTitle: 'Your Dottie data',
    // iOS needs the uniform type identifier as well as the MIME type.
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
  });
  return true;
}

/** Delete the cached copy. Failure here is not worth telling the user about. */
export async function discardExport(file: WrittenExport): Promise<void> {
  try {
    await loadFileSystem().deleteAsync(file.uri, { idempotent: true });
  } catch (err) {
    logSilentFailure('export.discard', err);
  }
}

async function safe<T>(code: string, read: () => Promise<T[]>): Promise<T[]> {
  try {
    return await read();
  } catch (err) {
    logSilentFailure(code, err);
    return [];
  }
}
