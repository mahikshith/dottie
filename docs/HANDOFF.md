# 🌱 Dottie — Session Handoff (READ THIS FIRST)

**Updated:** 2026-09-03 · after Device Test 7
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
on top. Seven device-test rounds have landed. **11 test suites, all green.**

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
  `test:overlap`, `audit:ui`. 14 suites. `npm run simulate` is eyeball-only.
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

`DEVICE-TEST-8.md` (latest round) · `DEVICE-TEST-7.md` (the freeze post-mortem)
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
