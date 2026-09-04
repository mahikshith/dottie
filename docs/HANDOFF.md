# 🌱 Dottie — Session Handoff (READ THIS FIRST)

**Updated:** 2026-09-04 · after Round 14
**Branch:** `gemini-v2` — all work. Pushing any `gemini-**` branch builds an APK.
`gemini-learn-redesign` = prior checkpoint. `design-v2` / `main` frozen (never push
to `main` except the workflow file).
**Owner device:** Nothing Phone (Android). NOT MIUI — don't assume MIUI behaviour.

> **Start here, cheaply.** §1 tells you the one open P0. §2 is how to work. §3 is
> the jump table. Everything else is reference — open a doc only when a line here
> names it. Do NOT re-explore the codebase.

---

## 1. State of play

The app is a complete local-first cycle tracker (predictor, calendar, sisterhood,
ghost mode, onboarding, walkthrough) with the Gemini Learn redesign (Phases 0–4)
on top. Fourteen rounds have landed. **21 test suites, all green** (`npm run test:all`).

### Round 14 (2026-09-04) — the companion teaches

- **Lessons are a CONVERSATION now.** `/lesson/chat/[id]` — the companion is
  pinned at the top, its face is the status indicator, its lines land as chat
  bubbles and yours echo back. Facts/tips are handed over as cards. All tap
  targets in the bottom third. The reader (`/lesson/[id]`) still exists and is
  one tap away from inside the chat; the Learn tab now opens the chat.
- **`src/engine/learn/dialogue.ts` is pure and is the safety boundary.** It may
  SEQUENCE vetted curriculum copy and add contentless tone ("Ready?", "Try
  this:", "That's the one"). It may never state or rephrase a fact.
  `test:dialogue` checks all 821 content beats across all 77 lessons back
  against the source corpus, and sweeps the engine's own lines for clinical
  vocabulary, body claims, invented statistics and population claims.
- Encoded rules: never says "wrong"; a RIGHT answer still gets the full
  explanation; two attempts then the answer (no trap loop); streaks change tone
  only; openers never repeat back to back; teach two beats before the first
  question.
- **51 lessons imported.** `scripts/import-curriculum.ts` →
  `src/content/curriculum.generated.ts` (14 paths / 51 lessons / 51 quizzes /
  306 questions / 153 exercises) from `docs/curriculum/dottie_curriculum_1.json`.
  Regenerate with `npx tsx scripts/import-curriculum.ts` — never hand-edit the
  generated file. It refuses ids the app already ships, renumbers `order` after
  a skip, and refuses to write if any lesson lacks `difficulty` or any question
  lacks `level`. Corpus: **77 lessons / 74 quizzes / 427 questions.**
- NOT imported yet: contraception, sexual health, PCOS/endo/perimenopause/
  thyroid. They need the adult/teen gate + condition routing designed rather
  than bulk-imported. `ADULT_ONLY` ids are already listed in the importer.

### Round 13 (2026-09-04) — calendar + data export

- **Fertile window on the grid.** `predictedOvulation` had been computed by the
  predictor since it was written and NOTHING drew it (same shape of gap as the
  DT12 premenstrual flag). `src/engine/calendar/fertile-window.ts` is pure and
  deterministic: the window is ASYMMETRIC (5 days before ovulation, ovulation,
  1 day after), confidence comes from cycle count + SD, and a single
  `NOT_CONTRACEPTION` constant carries the safety wording everywhere it appears.
  Period days never also render as fertile — precedence resolved once, in
  `buildMonthGrid`. `test:fertile` (33 invariants).
- **"The graphs are invisible" was not a render bug.** The charts self-measure
  and draw correctly (test:charts). They were the LAST card in a very long
  scroll with nothing pointing at them. Fixed with a "Why these dates?" jump
  under the grid that scrolls to a MEASURED offset.
- **Download your data** (You → Download your data). A real `.xlsx` with native
  Excel charts, built on the phone: `src/export/zip.ts` (store-only ZIP, no
  codec) + `src/export/xlsx.ts` (SpreadsheetML by hand) + `build-export.ts`
  (pure sheet model). Neither library works here — SheetJS community cannot
  write charts, ExcelJS is Node-shaped. Charts reference cell RANGES so they
  stay live. New deps: `expo-file-system`, `expo-sharing`.
- The app's honesty rules are enforced INSIDE the file: unlogged day = blank
  cell never zero (`dispBlanksAs="gap"`), mood distribution divides by logged
  days, a pending prediction has no error score, every derived figure sits
  beside its sample size. `test:export` (~70 invariants) walks the archive back
  with an independent reader. Separately confirmed to load in openpyxl with all
  7 charts and survive a load→save→load round trip.

### Round 12 (2026-09-04)

- **Symptoms now reach the predictor.** `premenstrualSymptomsDetected` was a
  live predictor parameter that NOTHING ever set — so symptom logs were written
  and never used. Now fed by `detectPremenstrualSignal()` (2+ distinct markers,
  3 days, severity ≥2). Still unwired: `recentWeightChangeKg` (no weight history
  collected); stress/sleep still read TODAY's check-in only despite docs saying
  7-day average.
- **Symptom recall** on the Cycle tab — "on day 2 you've logged nausea in 2 of
  your last 3 periods". Own history only, sample size always attached, silent on
  n=1. `test:recall` asserts it never claims population stats.
- **Mood map** on Home, **behind a toggle** — collapsed shows a live 14-day
  strip (real data, not a labelled button); expanded is the 91-day heatmap +
  distribution. With nothing logged it is ONE LINE, never a grid-shaped hole.
  Open/closed remembered in `Storage.moodMapOpen`. Diverging ramp (not GitHub's
  sequential green), validated with the dataviz ordinal checks. `test:moodmap`
  protects "a gap is not a zero", the logged-days denominator, and that the
  collapsed strip ends on today rather than on future blanks.

Detail: `docs/DEVICE-TEST-12.md`.

### Round 11 (2026-09-04) — tab transition

`animation: 'none'` was a hard cut, so the pill glided for 300ms while the
screen teleported in one frame. Replaced with a custom `sceneStyleInterpolator`:
cross-fade + 18px directional drift + slight settle, 170ms, native driver,
reduced-motion variant. **Not a slide** — tabs are peers. Content settles before
the pill lands on purpose. `animation` must stay ABSENT from screenOptions (the
library uses `Boolean(transitionSpec)` to keep the outgoing screen alive).
The SVG clip-path "liquid swipe" from the owner's reference cannot port to RN —
reasoning in `docs/DEVICE-TEST-11.md` §3, along with what a real drag-between-
screens feature would take (it conflicts with the calendar's month swipe).

**Mood reveal is now a liquid blob wash** (same round): SVG `<Path>` rebuilt on
the UI thread, undulating edge that settles smooth, 1050ms on a gentler curve.
The clip-path idea works HERE — unlike tabs — because the reveal is an opaque
overlay, not a live screen. `npm run test:liquid` proves it covers every corner
at full extent (a gap there would flash the old palette on commit).

### Round 10 (2026-09-04)

- **Period days can be UN-marked.** There was no un-log path anywhere in the
  codebase; the sheet button just went disabled, so a mis-tap was permanent.
  Now a toggle, end to end (repo → store → sheet → sisters), with cycle records
  **rebuilt** from entries after a removal rather than patched.
  The DT9 harness missed this because every step only ever added data — six
  removal steps now cover it.
- **Ghost Mode explains how to leave the decoy** (You → Ghost Mode): triple-tap
  "Refresh garden", or hardware back. Also shown as a dialog when you enable
  "Wrong PIN → plant journal".
- **The exercise player's action is pinned to the bottom.** It used to sit at
  the end of the scrolled content, so it drifted with question length. The
  lesson reading screen deliberately keeps its action at the end of the text.

Detail: `docs/DEVICE-TEST-10.md`.

### Round 9 (2026-09-04) — the simulated-user harness

`npm run test:app` now drives the REAL stores + SQLite repositories through a
full user journey (42 steps, 110 assertions), replayed in 5 timezones by
`npm run test:app:tz`. It found and we fixed five defects the 14 pure suites
structurally could not reach — malformed dates poisoning the calendar, a
double-tap `UNIQUE` crash, a future-dated period becoming "last period",
unclamped flow levels, and `catch` blocks that were invisible in release builds
(`__DEV__` is false there). Detail: `docs/DEVICE-TEST-9.md`.

It does NOT test rendering — no device, no renderer. Layout, motion and colour
still need the owner's phone.

### Round 8 landed (2026-09-04) — awaiting device confirmation

`docs/DEVICE-TEST-8.md` has the per-bug detail. Headlines:
- **The white tab-switch flash was the NAVIGATION THEME.** Expo Router installs
  React Navigation's light `DefaultTheme`, so the container behind every screen
  was `rgb(242,242,242)`. `contentStyle`/`sceneStyle` could never fix it — wrong
  layer. `NAV_THEME` in `app/_layout.tsx` now forces every navigator surface to
  the aurora ground.
- **One companion everywhere.** The rig is the companion in every state; the
  Noto emoji files are moment overlays only. Change it at You → Your companion.
- **Sisterhood has no date picker.** `shadow-log/[id]/period` deleted; "Log a
  period day" deep-links to `/(tabs)/calendar?logFor=<memberId>`.
- New pure engines: `encouragement.ts` (rotating nudges), `cycle-overlap.ts`
  (your window vs a sister's — never claims cycles "sync").

### The period-log freeze is FIXED (root cause found, 2026-09-03)

It was never a UI bug. `addDay()` in `cycle.repo.ts` parsed a date as **local**
midnight and serialised it as **UTC**, so east of Greenwich it returned the date
it was given — the identity function. A `while (true)` walk over it therefore
never advanced and spun the JS thread forever. Owner is at UTC+5:30; CI is at
UTC+0, where the broken helper is accidentally correct, which is why nothing
caught it. Full post-mortem: `docs/DEVICE-TEST-7.md` §8.

Fixed by `src/utils/civil-date.ts` (UTC-only, shared — six files each had their
own buggy copy), a bounded loop that cannot hang whatever the date maths does,
and `npm run test:dates`, which re-execs itself under 8 timezones.

**Needs on-device confirmation.** Same repro: log a period day, then log a
*later* one.

### Other open items

- `#30` verify the white-circle fix on device (`21d5432`).
- `#37` prediction staleness — same root cause: `getLastPeriodStart()` compared
  against the wrong day (`subtractDay` returned d−2), so the "Day 168 / 0 cycles"
  reading was the date bug, not staleness. Fixed; confirm on device.
- The sisterhood member profile still routes to a separate `/shadow-log/…/period`
  screen. The owner wants sisters logged on the main calendar (that path works);
  decide whether to retire the standalone screen.
- `#32` app-store rollout groundwork. `#34` Learn auto-advance re-verify.

## 2. How to work

- Node v22. **`npx tsc --noEmit` must exit 0 before every commit.**
- `npm run test:all` runs everything and is what CI gates on:
  `type-check`, `validate:content` (26 lessons / 23 quizzes / 121 questions),
  `test:adaptive` (17), `test:rhythm` (22), `test:predictor` (14 scenarios),
  `test:journey` (10), `test:explainer`, `test:sister` (11), `test:blocks` (12),
  `test:dedupe` (6), `test:diag` (7), `test:creature`, `test:charts` (12),
  `test:dates` (8 timezones — the freeze regression), `test:nudges`,
  `test:overlap`, `test:liquid`, `test:moodmap`, `test:recall`, `audit:ui`,
  `test:app:tz`. 18 suites.
- `npm run test:app` — the simulated-user integration run on its own (fastest
  way to check a data-layer change; the tz matrix is what CI gates on). `npm run simulate` is eyeball-only.
- **On-device runtime = the GitHub Actions APK.** Push to `gemini-v2` without
  `[skip ci]` → build. `[skip ci]` **on the tip commit skips the whole push** —
  keep a code commit last. Owner downloads via the GitHub mobile app
  (Actions → run → Artifacts).
- Every commit ends with the Claude co-author + `Claude-Session` trailer.
- Owner may ask to HOLD pushes and do one final push. Ask before pushing if unsure.

## 3. Jump table (where things live)

**Prediction + its explanation**
- `src/engine/prediction/bayesian-predictor.ts` — NIG prior → Student-t predictor
- `src/engine/prediction/explain-prediction.ts` — the pure explainer (dates,
  window, SD, factors, period length, heavy days)
- `src/engine/prediction/chart-data.ts` — pure figure data (cycle-length series,
  flow shape). Tested by `test:charts`.
- `src/components/calendar/PredictionExplainerCard.tsx` — **never renders null**;
  recomputes the explanation itself if the store's copy is missing (DT7 §6)
- `src/components/calendar/{PredictionDistributionChart,CycleLengthHistoryChart,FlowShapeChart}.tsx`

**Calendar**
- `app/(tabs)/calendar.tsx` — swipe months, sister overlay, log routing
- `src/components/calendar/DayDetailSheet.tsx` — the day sheet. Opaque card +
  0.78 scrim; **no `dimezisBlurView`** (ANR).
- `src/engine/calendar/{sister-overlay,period-blocks,day-suggestions}.ts` — pure

**Companions + animation**
- `src/components/ui/creature/{CompanionCreature.tsx,expressions.ts}` — the SVG rig
  (8 states, intensity-scaled). Expressive states ALWAYS use this.
- `src/components/ui/CompanionLottie.tsx` — Lottie for idle only; moment
  animations are a corner badge, never full-size over the face.
- `assets/lottie/` — Noto Animated Emoji, **CC BY 4.0**, attribution in
  `ATTRIBUTION.md` + in-app on the privacy screen.

**Diagnostics**
- `src/diagnostics/{logger.ts,log-format.ts}` — MMKV write-through, freeze
  detector, redaction. `app/(profile)/diagnostics.tsx` — the shareable screen.

**UI + theme**
- `src/components/ui/aurora/AuroraBackground.tsx` — blooms + the **gradient
  status veil** (`STATUS_FADE`)
- `src/components/ui/aurora/AuroraTabBar.tsx` — finger-follow liquid pill
- `src/theme/{palettes,mood-palette,ThemeProvider,aurora-static}.ts`
- `src/constants/spacing.ts` — grid, radii, **`tabBarClearance`**

**Testing**
- `scripts/app-simulation-harness.ts` — the simulated user; add a step here when
  you add a feature, it is the only suite that exercises stores + SQL.
- `scripts/harness/{alias.cjs,shims/,lib/runner.ts}` — how it runs in Node.
  Shims are harness-only; never import them from the app.

**Data**
- `src/utils/civil-date.ts` — **the only place date maths on `YYYY-MM-DD` may
  happen.** UTC-only by construction. Never write a local `new Date(\`${d}T00:00:00\`)`
  + `toISOString()` helper again — that combination caused the freeze.
- `src/stores/*` — Zustand v5; selectors must not return fresh arrays/objects
- `src/database/{storage,client,migrations,repositories/*}` — MMKV + SQLite

**CI** — `.github/workflows/android-preview.yml` (on `gemini-**`, mirrored on `main`)

## 4. Rules baked into the code (do not undo)

1. **Non-diagnostic copy everywhere.** "Many people report", never "your body
   does X". Harnesses actively ban abnormal/irregular/disorder in generated copy.
2. **Zero React Native `<Modal>`.** `grep -rn "<Modal" src app` must stay empty —
   a translucent Modal is a separate Android window that gets stuck over every
   screen (the white-circle bug, 5 device tests). Use `showAppDialog()`.
3. **No `experimentalBlurMethod="dimezisBlurView"`** on anything overlaying a
   heavy tree — it snapshots the whole view tree per frame.
4. Aurora ground `#0C0A16` wherever the app can flash. No cream flashes.
5. Every scroll screen pads `insets.top + Spacing.lg` / `insets.bottom +
   Spacing.tabBarClearance`.
6. Quiz questions `q_*` need `level`; lessons need `difficulty` (`validate:content`).
7. Walkthrough is opt-in only; `checkNotificationPermission()` is silent,
   `requestNotificationPermission()` only from an explicit tap.
8. **All civil-date arithmetic goes through `src/utils/civil-date.ts`.** Mixing
   local parsing with UTC serialisation froze the app for four device tests.
   Any loop walking dates must also be bounded and require forward progress.
9. TypeScript strict, no `any`/`as any`. Gradient `colors` must be a tuple.
   Inline components return `: JSX.Element`.

## 5. Companion docs (open only when named)

`DEVICE-TEST-12.md` (latest) · `DEVICE-TEST-11.md` · `DEVICE-TEST-10.md` · `DEVICE-TEST-9.md` (the harness + its findings) ·
`DEVICE-TEST-8.md` ·
`DEVICE-TEST-7.md` (the freeze post-mortem)
· `DEVICE-TEST-6.md`
(previous round, incl. the two wrong freeze diagnoses) · `DEVICE-TEST-3.md` ·
`FEATURES-AND-RESEARCH.md` (predictor math, aurora system) · `DAY-SUGGESTIONS.md`
· `ONBOARDING-AND-WALKTHROUGH.md` · `PREDICTION-EXPLAINER-PLAN.md` ·
`LEARN-REDESIGN-*.md` · `APP-AUDIT-FOR-GEMINI.md` · `LOTTIE-SOURCING.md` ·
`BETA-TESTING-GUIDE.md` · `CONTENT-UPDATES.md` (dormant) · `SESSION-CONTEXT.md`

## 6. Environment traps

- `[skip ci]` on the **tip** commit skips the entire push's build.
- Sandbox can't download Actions artifacts (Azure blob blocked) — the owner
  fetches the APK from the GitHub mobile app.
- Auto mode needs explicit OK for destructive git ops.
