/**
 * Dottie — Diagnostic logger (owner-requested).
 *
 * A shareable trail of what the user actually did, so a bug can be diagnosed
 * from evidence instead of guesswork. Built specifically because the period-log
 * freeze survived several builds while we reasoned about it from source.
 *
 * ─── THE THREE THINGS THAT MAKE IT USEFUL ───────────────────────────
 *
 *  1. IT SURVIVES A FORCE-CLOSE. Every event is written straight through to
 *     MMKV (synchronous, mmap-backed). When the app wedges and the user has to
 *     kill it, the events leading up to the wedge are already on disk. A buffer
 *     that only lived in memory would lose exactly the evidence we need.
 *
 *  2. IT DETECTS THE FREEZE ITSELF. A 1s heartbeat runs on the JS thread; if
 *     the thread is blocked the tick can't fire, so on recovery the gap IS the
 *     stall duration. That turns "the screen froze for a bit" into
 *     "freeze js-thread-stalled ms=4300" sitting right after the tap that
 *     caused it.
 *
 *  3. IT KNOWS WHEN A SESSION DIDN'T END CLEANLY. We mark the session open on
 *     start and closed on background. If the next start finds an open marker,
 *     the previous run was force-closed or crashed — logged as such.
 *
 *  Health values are masked on the way OUT (see log-format.ts), not on the way
 *  in, so a detailed report is still possible when the user opts in.
 */

import { MMKV } from 'react-native-mmkv';
import {
  boundBuffer,
  type LogCategory,
  type LogEvent,
  type LogLevel,
} from './log-format';

const STORE_ID = 'dottie-diagnostics';
const KEY_EVENTS = 'events';
const KEY_SESSION_OPEN = 'session_open';

/** Bounded so the log can't grow without limit on a long-lived install. */
const MAX_EVENTS = 600;
/** A tick gap beyond this means the JS thread was genuinely blocked. */
const FREEZE_THRESHOLD_MS = 2500;
const HEARTBEAT_MS = 1000;

// A dedicated, UNENCRYPTED store: diagnostics must be readable even if the
// encrypted app DB is what's broken, and it deliberately holds no health data.
let store: MMKV | null = null;
function db(): MMKV | null {
  if (store) return store;
  try {
    store = new MMKV({ id: STORE_ID });
    return store;
  } catch {
    return null; // never let diagnostics break the app
  }
}

let buffer: LogEvent[] = [];
let loaded = false;
let heartbeat: ReturnType<typeof setInterval> | null = null;
let lastTick = 0;

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    const raw = db()?.getString(KEY_EVENTS);
    if (raw) buffer = JSON.parse(raw) as LogEvent[];
  } catch {
    buffer = [];
  }
}

function persist(): void {
  try {
    db()?.set(KEY_EVENTS, JSON.stringify(buffer));
  } catch {
    // Diagnostics must never throw into the app.
  }
}

/**
 * Record one event. Cheap and synchronous: humans generate a handful of events
 * a second, and a write-through is what makes the pre-freeze trail survivable.
 */
export function logEvent(
  cat: LogCategory,
  msg: string,
  data?: Record<string, string | number | boolean | null>,
  lvl: LogLevel = 'info'
): void {
  try {
    load();
    buffer.push({ t: Date.now(), lvl, cat, msg, ...(data ? { data } : {}) });
    buffer = boundBuffer(buffer, MAX_EVENTS);
    persist();
  } catch {
    // ignore
  }
}

// ─── CONVENIENCE API ─────────────────────────────────────────────────

export const log = {
  nav: (to: string, from?: string) => logEvent('nav', to, from ? { from } : undefined),
  tap: (label: string, data?: Record<string, string | number | boolean | null>) =>
    logEvent('tap', label, data),
  action: (name: string, data?: Record<string, string | number | boolean | null>) =>
    logEvent('action', name, data),
  db: (name: string, data?: Record<string, string | number | boolean | null>) =>
    logEvent('db', name, data),
  perf: (name: string, ms: number) => logEvent('perf', name, { ms }),
  warn: (msg: string, data?: Record<string, string | number | boolean | null>) =>
    logEvent('error', msg, data, 'warn'),
  error: (msg: string, data?: Record<string, string | number | boolean | null>) =>
    logEvent('error', msg, data, 'error'),
  lifecycle: (msg: string, data?: Record<string, string | number | boolean | null>) =>
    logEvent('lifecycle', msg, data),
};

/** Time an async operation and log how long it took. */
export async function timed<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    log.perf(name, Date.now() - start);
  }
}

// ─── READ / CLEAR ────────────────────────────────────────────────────

export function getEvents(): LogEvent[] {
  load();
  return [...buffer];
}

export function clearEvents(): void {
  buffer = [];
  loaded = true;
  persist();
  log.lifecycle('log cleared');
}

// ─── FREEZE DETECTION + SESSION INTEGRITY ────────────────────────────

/**
 * Start the heartbeat. If the JS thread stalls, the tick can't run; the gap we
 * measure on recovery is the stall. This is what turns the reported "screen
 * freezes and I have to force-close" into a timestamped, measured event.
 */
export function startFreezeDetector(): void {
  if (heartbeat) return;
  lastTick = Date.now();
  heartbeat = setInterval(() => {
    const now = Date.now();
    const gap = now - lastTick;
    lastTick = now;
    if (gap > FREEZE_THRESHOLD_MS) {
      logEvent(
        'freeze',
        'js-thread-stalled',
        { ms: gap, threshold: FREEZE_THRESHOLD_MS },
        'error'
      );
    }
  }, HEARTBEAT_MS);
}

export function stopFreezeDetector(): void {
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = null;
}

/** Call once on app start. Detects an unclean previous exit. */
export function openSession(appVersion: string): void {
  load();
  let previousWasUnclean = false;
  try {
    previousWasUnclean = db()?.getBoolean(KEY_SESSION_OPEN) === true;
  } catch {
    previousWasUnclean = false;
  }
  if (previousWasUnclean) {
    logEvent(
      'lifecycle',
      'previous session ended WITHOUT a clean exit (force-close or crash)',
      undefined,
      'warn'
    );
  }
  try {
    db()?.set(KEY_SESSION_OPEN, true);
  } catch {
    // ignore
  }
  log.lifecycle('session start', { v: appVersion });
}

/** Call when the app goes to background — a clean exit marker. */
export function closeSession(): void {
  try {
    db()?.set(KEY_SESSION_OPEN, false);
  } catch {
    // ignore
  }
  log.lifecycle('session background');
}

/**
 * Route uncaught JS errors into the log so a crash leaves a trail.
 * Chains to the previous handler so normal red-box/crash reporting is intact.
 */
export function installErrorHandler(): void {
  const g = globalThis as unknown as {
    ErrorUtils?: {
      getGlobalHandler?: () => ((e: Error, isFatal?: boolean) => void) | undefined;
      setGlobalHandler?: (h: (e: Error, isFatal?: boolean) => void) => void;
    };
  };
  const utils = g.ErrorUtils;
  if (!utils?.setGlobalHandler) return;
  const previous = utils.getGlobalHandler?.();
  utils.setGlobalHandler((error: Error, isFatal?: boolean) => {
    logEvent(
      'error',
      `uncaught: ${error?.message ?? 'unknown'}`,
      { fatal: isFatal === true, stack: (error?.stack ?? '').slice(0, 400) },
      'error'
    );
    previous?.(error, isFatal);
  });
}
