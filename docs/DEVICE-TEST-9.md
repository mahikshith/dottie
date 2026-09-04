# Device Test 9 — the simulated-user harness, and what it found

Owner asked for a run through the whole app "as a user", with the logger on, to
find where it breaks. This is that round.

---

## 0. What this run is, and what it is not

**Is:** a harness (`npm run test:app`) that drives the **real Zustand stores and
the real SQLite repositories** through a full journey — onboarding, logging
periods, check-ins, sisterhood, learning, rewards, account deletion — against
`node:sqlite` and an in-memory MMKV. Real migrations, real SQL, real store
actions, in dependency order. 42 steps, 110 assertions, replayed in 5
timezones.

**Is not:** a tap on a screen. There is no device and no renderer in this
environment, so nothing here proves a layout, a gesture, an animation or a
colour. Claiming otherwise would be the kind of thing that wastes a device-test
round. What the harness covers is everything a button press *calls*;
`npm run audit:ui` separately proves every tappable *has* a handler. The gap
between those two — does the pixel look right — still needs the owner's phone.

**Why it had to exist.** The other 14 suites test pure functions. That is a real
safety net with a hole in exactly the shape of every bug that has reached the
owner: the freeze lived between a SQL query and a date helper; the "0 cycles"
reading was a repository off-by-one. No pure test could touch either.

---

## 1. Findings — all fixed in this round

Five real defects, all in code paths the pure suites cannot reach.

### 1.1 Malformed dates were accepted into `cycle_entries` (P0)

`logPeriodDay({ date: "01/09/2026" })`, `""` and `"today"` all wrote rows.

That is worse than one bad row. Everything downstream assumes a well-formed
civil date and `civil-date` **throws** on anything else — so a single bad write
made the block walk, the pattern nudge and the charts throw on every subsequent
read. One bad date and the user's calendar is dead until the data is deleted.

**Fixed** by validating at the only door into the table (`upsertCycleEntry`
rejects with a clear `RangeError`), *and* by hardening the read side:
`groupPeriodBlocks` now drops unusable dates instead of throwing, so a phone
that already carries junk can still open its calendar.

### 1.2 A double-tap crashed the write (P1)

`upsertCycleEntry` did `SELECT` → branch to `UPDATE` or `INSERT`. Two calls
landing together — which is precisely what an impatient thumb on "Mark as
period" produces — both saw no row, both inserted, and the second threw
`UNIQUE constraint failed` as an unhandled rejection.

The doc comment above it already claimed "Combines INSERT with ON CONFLICT
UPDATE". The comment was right; the code wasn't. **Fixed** — it is now one
atomic upsert with `COALESCE` preserving the old merge semantics.

### 1.3 A future-dated period became "your last period" (P1)

The calendar lets you swipe forward and tap any cell. Marking a day that hasn't
happened made it `lastPeriodStart`, which makes day-in-cycle nonsense and every
prediction with it. **Fixed** — `getLastPeriodStart` ignores future days. They
are still stored and still drawn; they just can't be the period you are
currently in.

### 1.4 Out-of-range flow levels threw a raw SQL constraint error (P2)

`flow_level BETWEEN 0 AND 5` surfaced to the caller as a SQLite exception.
**Fixed** — clamped at the repository boundary. A slider value out of range is a
caller bug that should not lose the user's log.

### 1.5 Failures were invisible on the build the owner actually tests (P1)

Several non-fatal `catch` blocks read `if (__DEV__) console.warn(...)`.
`__DEV__` is **false** in a release build, so on the only build that matters
these produced no console line, no log entry and no user-visible sign.

The worst case is concrete: if the onboarding seed of "when did your last period
start" ever failed, the user would finish onboarding having typed their date and
land on an app claiming it has no cycle data, with nothing anywhere explaining
why.

**Fixed** — `logSilentFailure()` routes them to the diagnostic logger, so they
land in the trail shared from Profile → Diagnostics. They still swallow: not
blocking onboarding on a failed reminder sync is correct. The silence was not.

---

## 2. Things the run confirmed are working

- **The device-test-7 freeze is gone.** Logging a second, later day — the exact
  repro — completes in ~1ms, in all five timezones including the owner's.
- Onboarding seeds the first period; day-in-cycle and phase come out right.
- Six logged cycles produce a future-dated prediction with a plausible window,
  a positive SD, and named factors.
- All three explainer graphs have data, and the empty-history case degrades
  honestly (`provisional`, "typical pattern") instead of inventing numbers.
- Sister logging, the shared-calendar overlay, and privacy filtering (`mood`
  level really does hide flow and next-period).
- No fabricated prediction for a sister with no logged days.
- Nothing calls `requestPermissionsAsync` on its own anywhere in the run — the
  silent/explicit notification split holds.
- Account deletion clears the rows, the store and MMKV.
- The redacted diagnostic report leaks no raw dates.

---

## 3. The harness is verified, not assumed

A test that cannot fail is decoration. Both failure modes were checked by
deliberately breaking the app and confirming the harness caught it:

| Sabotage | Result |
| --- | --- |
| `await new Promise(() => {})` inside `logPeriodDay` | `⏱ HANG … 5001ms`, reported under **HANGS (the app would freeze here)** |
| Reverted the future-date fix | Reported under **WRONG BEHAVIOUR**, naming the step and the values |

The watchdog matters specifically because of device-test-7: a suite that merely
`await`s each step would have **hung** on that bug rather than failing, which is
indistinguishable from a slow CI box and easy to kill and ignore.

---

## 4. Running it

```
npm run test:app       # one pass, current timezone
npm run test:app:tz    # the same journey in 5 timezones (part of test:all)
```

Machinery lives in `scripts/harness/`:

- `alias.cjs` — patches `Module._resolveFilename` to swap the five native-only
  packages for shims. tsconfig `paths` is not enough: for a specifier that also
  exists in node_modules (`react-native` does) the real package wins and esbuild
  chokes on its Flow syntax. An ESM resolve hook is not enough either — tsx
  compiles to CJS, so the imports are `require()` calls the hook never sees.
- `shims/` — `expo-sqlite` on `node:sqlite`, in-memory MMKV, secure-store,
  expo-constants, a `Platform`-only react-native, and a notifications shim that
  **records** what would have been scheduled and **denies permission by
  default** (a shim that always granted would hide a regression where something
  prompts on its own).
- `lib/runner.ts` — the step runner, watchdog and report.

⚠️ The shims are harness-only and must never be imported by the app.

---

## 5. Still open

- Everything visual. Layout, motion, colour, gestures, the tab-bar flash fix,
  the new companion rig, the arc marker — all need the owner on the phone.
- `docs/DEVICE-TEST-8.md` items are code-complete but unconfirmed on device.
