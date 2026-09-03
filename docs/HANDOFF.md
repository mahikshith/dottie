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

### 🔴 THE ONE OPEN P0 — period-log freeze on the 2nd date

Logging a period on a second date freezes the app; owner must force-close. It has
survived **two** wrong diagnoses (Reanimated teardown; `dimezisBlurView` ANR —
both fixes kept, both correct on their own merits, neither was the cause).

**Do not guess a third time.** The diagnostic logger exists for exactly this.
Ask the owner for a trace before touching code:

> Profile → Diagnostics → **Clear**, reproduce the freeze, force-close, reopen,
> **Share** the log.

MMKV write-through means the trail survives a force-close; `startFreezeDetector()`
(1s heartbeat, 2500ms threshold) stamps the gap. The last `daySheet:*` /
`calendar:logPeriod` bracket before the gap names the culprit.
Full history: `docs/DEVICE-TEST-7.md` §8.

### Other open items

- `#30` verify the white-circle fix on device (`21d5432`).
- `#37` prediction staleness — should be resolved by the freeze fix (the tester
  could only ever log one period ⇒ `cycleCount = 0` ⇒ "0 cycles / Day 168").
  Re-check once the freeze is closed.
- `#32` app-store rollout groundwork. `#34` Learn auto-advance re-verify.

## 2. How to work

- Node v22. **`npx tsc --noEmit` must exit 0 before every commit.**
- `npm run test:all` runs everything and is what CI gates on:
  `type-check`, `validate:content` (26 lessons / 23 quizzes / 121 questions),
  `test:adaptive` (17), `test:rhythm` (22), `test:predictor` (14 scenarios),
  `test:journey` (10), `test:explainer`, `test:sister` (11), `test:blocks` (12),
  `test:dedupe` (6), `test:diag` (7), `test:creature`, `test:charts` (12),
  `audit:ui` (167 tappables all have onPress). `npm run simulate` is eyeball-only.
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
8. TypeScript strict, no `any`/`as any`. Gradient `colors` must be a tuple.
   Inline components return `: JSX.Element`.

## 5. Companion docs (open only when named)

`DEVICE-TEST-7.md` (latest round + the open freeze) · `DEVICE-TEST-6.md`
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
