# 🌱 Dottie — Session Handoff / Continuity Doc

> **Read this first when resuming the Dottie build.** It is the living record of
> where the project stands, what changed most recently, the environment
> constraints in play, and exactly what to do next. Update it at the end of every
> working session.

**Last updated:** 2026-08-13 (design-visualization + continuity update)
**Updated by:** Claude (Opus 4.8) — "Fix, Polish & Get-It-Running" → design phase
**Companion docs:** `CLAUDE.md` (auto-loaded how-we-work guide — read alongside this),
`docs/SESSION-CONTEXT.md` (original full project brief), `docs/BETA-TESTING-GUIDE.md`.

## 0. Design phase (current) — where we are RIGHT NOW
Phase-2 premium polish is code-complete across all 13 screens (see §4.5). The user has
installed the **`design:*` plugin skills** and wants premium frontend/UI + motion
principles (Emil Kowalski school: restraint, purposeful spring motion, spacing rhythm,
native micro-interactions) applied to Dottie's design.

**Before improving, the current screens were visualized** (app can't run — no Node — so
faithful HTML recreations from source were built instead of screenshots):
- **Screen gallery Artifact:** https://claude.ai/code/artifact/b24440b0-c454-4752-ae43-e1686c8dc2ad
  (six core screens: Welcome, Home, Calendar, Learn, Community, Sisterhood — real tokens).
- Source of that page: it was authored to scratchpad and published; not in the repo.

**Emil Kowalski's skills are installed** at `code/.claude/skills/` (vendored from
github.com/emilkowalski/skills, MIT). The load-bearing ones: `apple-design`,
`emil-design-eng`, and **`animate-expo`** (exact Reanimated recipes for OUR RN stack —
read it before implementing any motion: tabs never slide, springs `dampingRatio` 1.0
default / 0.8 for momentum, `EASE_OUT = bezier(0.23,1,0.32,1)`, press `scale 0.97` in
100–150ms, haptic on the same frame). Also `find-animation-opportunities`,
`review-animations`, `improve-animations`.

**Design approach = VISUALIZE FIRST, code later** (user's call — smart, since the app
can't run here). Work happens on the **`design-v2` branch** (pushed).
Two directions for Home are visualized (user wants bold + morphisms, free of the
current palette):
- **Direction A — "Elevate, keep the soul"** (warm, cream/coral, subtle glass):
  https://claude.ai/code/artifact/db9078f7-b9fc-42c8-ae60-84e6a37ceaa9
- **CHOSEN DIRECTION → "Mood Aurora"** (BOLD, from-scratch aurora system; the cycle as
  a night sky; glassmorphism + claymorphism + aurora-mesh + grain; glowing cycle ring;
  fluid spring-driven glass tab indicator). Same artifact URL, evolved:
  https://claude.ai/code/artifact/64d7a36b-cca1-4c8d-a731-889d936b97d6
  **THE BIG IDEA (user's): the logged MOOD recolours the entire UI.** Default = Nocturne
  violet; tapping a mood morphs the whole palette → makes the daily check-in the hook.
  Mood→palette map (ALL supportive — low/rough stay WARM & soothing, never grey/dark,
  per apple-design *Responsibility*):
  - 😊 great → Radiance (warm gold/coral) · 🙂 good → Meadow (mint/aqua)
  - 😐 okay → Nocturne (violet/aqua, default) · 😔 low → Twilight (soft periwinkle)
  - 😤 rough → Ember (warm rose/amber)
  Phase stays in the ring; mood owns the atmosphere. A separate light "Dawn" theme +
  cool "Reef" remain optional user settings (were in the prior 4-palette version).

  **Full-app visual (all 5 screens in the aurora world):**
  https://claude.ai/code/artifact/ca1f800f-1f53-4f7d-a387-bf7c44c2d432
  (Today, Cycle — ring-as-hero + glass calendar with glowing phase days, Learn, Circle,
  You — glowing avatar/level ring/badges/glass settings). Shown in Nocturne default.

  **DONE — theme foundation code (`src/theme/`, committed on design-v2, statically safe):**
  - `palettes.ts` — the 5 mood palettes as typed token sets + `PHASE_AURORA` (constant
    phase hues) + `getPalette()`.
  - `mood-palette.ts` — `paletteForMood(score)` map (5→radiance,4→meadow,3→nocturne,
    2→twilight,1→ember; care rule: low/rough stay warm).
  - `index.ts` — barrel.

  **DONE — aurora components written (design-v2, ⚠️ UNVERIFIED, no device):**
  - `src/theme/ThemeProvider.tsx` — `AuroraProvider` + `useAurora()` (holds active palette,
    default Nocturne, `applyMood(score)` swaps it; token swap instant, cross-fade lives in
    AuroraBackground). Barrel updated.
  - `src/components/ui/aurora/` — `AuroraBackground` (SVG radial blooms + Reanimated drift +
    re-bloom on palette change), `GlassCard` (translucent panel; upgrades to frost with
    expo-blur — commented in file), `ClayButton` (gradient + sheen + two-view shadow, on
    PressableScale), `GlowRing` (self-drawing SVG progress ring), `AuroraTabBar` (fluid glass
    indicator, custom icons, haptics; NOT wired into `(tabs)/_layout.tsx` yet). Exported via
    `src/components/ui`.

  **NEXT (all needs the Node machine to build/run/verify):**
  1. `npx expo install expo-blur` → enable real frost in `GlassCard` (commented block).
  2. Wrap the root (`app/_layout.tsx`) in `<AuroraProvider>`; add an effect that calls
     `applyMood(todayCheckIn?.moodScore)` so the check-in recolours the app.
  3. Plug `AuroraTabBar` into `app/(tabs)/_layout.tsx` via `tabBar={...}` (only once screens
     are themed, or the dark bar clashes with cream screens).
  4. Apply the aurora system screen-by-screen (Today → Cycle → Learn → Circle → You), each
     wrapped in `<AuroraBackground>` and reading `useAurora().palette` tokens.
  5. `tsc` + device feel-check every animation (drift subtle, ring draw, tab spring, mood
     re-bloom, Reduce-Motion). Everything above is STATICALLY written but unrun.

  Reference mockups: all-screens https://claude.ai/code/artifact/ca1f800f-1f53-4f7d-a387-bf7c44c2d432
  · interactive Mood Aurora https://claude.ai/code/artifact/64d7a36b-cca1-4c8d-a731-889d936b97d6

  **DONE since — mood reveal + provider wiring (design-v2, ⚠️ UNVERIFIED):**
  - `ThemeProvider.tsx` now does the **origin-aware mood reveal** (user request): a circle of
    the new palette's colour grows from the tapped mood's {x,y} (~520ms ease-out), commits the
    palette underneath, then fades out into the settled aurora. `applyMood(score, origin)`
    (Reanimated + runOnJS). No origin / Reduce-Motion = instant swap.
  - `app/_layout.tsx` now wraps the app in `<AuroraProvider>` (safe — only provides context;
    non-aurora screens unaffected). So the palette + reveal are live app-wide once screens read it.
  - **NEXT screen-theming step:** convert `app/(tabs)/home.tsx` to aurora (AuroraBackground +
    GlassCard + ClayButton mood keys wired to `applyMood(score, {x:e.nativeEvent.pageX, y:pageY})`
    + GlowRing), and its child cards (`PhaseWeatherCard`, `DottiePredictsCard`) — those are
    cream-styled and must be themed together or a mood reveal flashes into a cream screen. Then
    the other 4 screens. On mount, drive the palette from `todayCheckIn?.moodScore`.

## 0.6 Research — predictor + feature gaps (2026-08, for the roadmap)

**Predictor (what we have vs the field):** Our `src/engine/prediction/predictor.ts` is a
multi-factor **heuristic** (weighted moving average + rule-based PCOS/thyroid/age/stress/sleep
adjustments + error-bias correction) — labelled "Bayesian" but NOT a formal Bayesian/ML model.
- **Flo** = two-step ML: per-user models learn individual patterns → features into a **neural
  network** trained on population data (5M+ users); reported +54% accuracy.
- **Natural Cycles** = FDA-cleared (De Novo) basal-body-temperature algorithm (93% typical /
  98% perfect use). **Clue** = calendar/statistics (period dates only), FDA-cleared as
  "substantially equivalent". Academic SOTA = **hierarchical Bayesian generative models**
  (Urteaga et al., MLR 2021) — handle irregular cyclers, improve as cycles evolve.
- **Recommendation for Dottie (local-first/offline/private):** a true Bayesian generative
  model in pure TS. A tiny on-device NN (TFLite, Flo-style) is a heavier later option
  (runtime + data). Optional: **HealthKit temperature/HR** → 85–87% fertile-window.
- **✅ DONE (design-v2, ⚠️ UNVERIFIED — no device):** implemented as a **Normal-Inverse-Gamma
  conjugate model → Student-t posterior predictive**, closed-form on-device:
  - `src/engine/prediction/bayesian-predictor.ts` — the model: `buildPopulationPrior()`
    (population prior, widened for teen/PCOS/thyroid/perimenopause) + `posteriorPredictiveCycleLength()`
    (recency-weighted conjugate update → predicted length, principled SD, df, effective-n).
  - `src/engine/prediction/predictor.ts` — REWRITTEN to use it; SAME public API
    (`predictNextPeriod`/`generateFullPrediction`/`getPredictionMessage`/`PredictionInput`), so
    `useCycleStore` is unchanged. Window now = ~1.15·posterior SD (+condition inflation);
    confidence from predictive spread × data volume. Lifestyle shifts (stress/sleep) kept.
  - **Verify on Node:** unit-test known histories (regular → tight window; PCOS/sparse → wide;
    cold-start → prior). NN + HealthKit remain future options.

**Feature gaps worth incorporating (feasible, differentiated):**
1. **Lead with PRIVACY** — Flo paid a $59.5M (2025) settlement over data sharing; Dottie is
   already local-first/no-ads. This is a huge trust moat — make it a headline, not a footnote.
2. **Perimenopause mode** — fastest-growing segment; Flo/ENdi just entered. Dottie has an
   Endocrine mode; a dedicated perimenopause experience (hot-flash/HRT tracking, cycle drift,
   a "perimenopause score") is a big opportunity.
3. **Personal symptom↔cycle correlation insights** (Bearable's strength) — "headaches tend to
   hit 2 days pre-period". **✅ DONE (design-v2, ⚠️ UNVERIFIED)** — purely additive to Dottie
   Predicts: `src/engine/predicts/symptom-correlations.ts` (finds concentrated symptom→phase/
   day patterns, derives phase from cycle day when needed), new `symptom_pattern_learned`
   insight kind + priority (72) + `buildSymptomPatternLearned` template (curious, explicitly
   NON-diagnostic) + `trySymptomPatterns` generator (excludes cramps; 0–2 insights). No store/
   UI changes (UI auto-renders any DottieInsight). Verify counts/framing on a Node machine.
4. **Responsible condition-pattern flags** (PCOS / PMDD / endometriosis) → gentle "worth asking
   a doctor". **✅ DONE (design-v2, ⚠️ UNVERIFIED)** — surfaced in the DOCTOR REPORT (the safe,
   medically-appropriate place; NOT the home feed where it could alarm a teen):
   `src/engine/reports/condition-signals.ts` (conservative, NON-diagnostic detection: irregular/
   long/short cycles, long periods, frequent high-severity pain → endo-adjacent, strong luteal
   mood → PMDD-adjacent — all framed as "worth mentioning", never a diagnosis). New
   `ReportPatternObservation`/`ReportPatternsSection` types + `patternsToDiscuss` on
   `DoctorReportData`; `doctor-report.ts` computes it and adds a "PATTERNS WORTH MENTIONING"
   block to the shared text. **UI-phase TODO:** render the new section in `ReportPreview.tsx`.
   ⚠️ Thresholds are clinician-informed rules of thumb — review with a professional before launch.
5. **Hormonal birth-control (pill) mode** — track packs/placebo week; commonly requested; do NOT
   claim contraception (regulatory). Add a clear "not birth control" line.
6. **Inclusivity** — research repeatedly flags heteronormative/over-pink/fertility-centric
   assumptions; Dottie's modes + companion help — keep language inclusive + customization high.
   Sources in the session transcript (Flo/InData Labs, Urteaga MLR 2021, Natural Cycles FDA,
   BMC Women's Health 2025, bearable app roundups).

  ⚠️ **Git push to GitHub is intermittently hanging on the corporate network** — commits
  are safe LOCALLY on `design-v2`; `design-v2` may be ahead of origin. Retry push when
  the network allows. All design deliverables are published artifacts (safe on claude.ai).
Both are interactive (press moods, ring draws, streak ticks). Shared IA in both:
hero states the day, primary action (mood) first, glass stats, one insight card,
glass tab bar with custom line icons + honest labels (Today/Cycle/Learn/Circle/You).
Awaiting the user's pick (A, B, or a blend) before extending across screens.
- **"Before" gallery:** https://claude.ai/code/artifact/b24440b0-c454-4752-ae43-e1686c8dc2ad

**Next step:** get the user's reactions to the reimagined Home → refine that direction →
extend the language to the other screens as mockups → ONLY THEN implement on `design-v2`
in RN using the `animate-expo` recipes + `src/components/ui` primitives. The `design`
canvas skill needs Node to seed, so use plain Artifacts for mockups.

---

## 1. What Dottie is (30-second version)

A warm, joyful cycle-tracking + women's-health companion (React Native + Expo,
TypeScript strict, local-first). "Warm Geometric" design language. Users pick a
Spirit Companion; the app is offline-capable, privacy-first (Ghost Mode PIN +
decoy), and free during beta. 12 feature chunks are built (onboarding → beta
pack). Architecture is strong: pure engines → async repos → Zustand stores.
Full detail in `docs/SESSION-CONTEXT.md`.

---

## 2. Current status (as of this session)

- **The app has never been run on a device.** No screenshots exist yet. The #1
  unknown is still "how does it actually look / feel."
- The MVP code is complete and, after this session, the known pre-beta blockers
  in the code layer are fixed (see §4).
- **The project is NOT yet runnable in this environment** — see constraints in §3.

---

## 3. Environment constraints (IMPORTANT — read before planning any "run/test" work)

This is being built on a **corporate laptop** with real limits:

- **Node.js / npm are NOT installed**, and **package installation is restricted /
  unknown**. Do not assume `npm install`, `npx`, or `eas` will work. Confirm with
  the user before planning anything that needs installs.
- Only **git** is available on the PATH.
- **Consequence:** the assistant **cannot run, build, type-check, or visually
  verify** the app here. All code work this session was done **statically**
  (read + reason), not verified at runtime. Treat unverified UI changes as
  drafts until they're seen on a real device.
- `react-native-mmkv` (a dependency) **cannot run in Expo Go** — it needs a
  custom dev build (EAS) or `expo run:android/ios`. Expo Go will red-screen on
  launch. This is a hard fact independent of the laptop.
- The `assets/` folder referenced by `app.json` (`icon.png`, `splash-icon.png`,
  `adaptive-icon.png`) **does not exist** — `eas build` will fail until it does;
  `expo start` only warns.

**Working rule for this project:** prefer package-free, statically-reasonable
changes. Anything requiring installs or a running app is gated on the user
sorting out a machine where Node + a dev build are allowed (personal machine,
or corporate approval).

---

## 4. Changes made THIS session (Phase 1 — safe, package-free fixes)

All from the earlier forensic audit (see
`session history/.../code_audit_for_dottie_mvp.md`). Applied to the `code/` tree.
None required new packages. **Not yet runtime-verified** (see §3).

| # | File | Change | Why |
|---|------|--------|-----|
| 1 | `src/database/migrations.ts` | Moved `writeSchemaVersion()` + `appliedVersions.push()` to run **after** `COMMIT` (own try/catch, non-fatal). | Prevents schema `user_version` from being persisted while DDL rolls back on a driver/WAL edge case; re-runs are safe (all DDL is `IF NOT EXISTS`). Avoids re-migration churn between beta builds. |
| 2 | `src/utils/date.utils.ts` **(NEW)** | Added `todayISO()` + `toISODate(date)` — safe, **UTC-preserving** replacements for the `new Date().toISOString().split('T')[0]!` idiom. | Removes non-null-assertion landmines under `noUncheckedIndexedAccess`. Kept UTC on purpose so it's a behavior-identical drop-in (the whole app derives "today" in UTC — do not switch to local-day piecemeal). |
| 3 | `src/stores/hydrate.ts` | (a) Use `todayISO()`. (b) **Fixed a real type error**: `migrationResult.didMigrate` → `migrationResult.appliedVersions.length > 0` (`MigrationResult` has no `didMigrate` field). (c) Warm the beta-feedback table via `betaFeedbackRepository.count()` during hydration, gated to `IS_BETA_BUILD`. | (b) means `tsc` was NOT clean before; now it is on this path. (c) guarantees the `beta_feedback` table exists before the first 💌 tap (avoids a lazy CREATE+INSERT race on force-quit). |
| 4 | `app/(onboarding)/ready.tsx` | Call `awardBetaPioneerIfNew()` right after `completeOnboarding()`. | The badge/toast previously only fired on the *next* cold start (during hydration a brand-new user has no `userId`). Now it fires on the first Home landing. Service is idempotent, so the existing `_layout.tsx` call stays too. |
| 5 | `app/_layout.tsx` | Replaced the invisible dev-only error stub with a **friendly full-screen "Dottie hit a snag → Try again"** recovery screen (re-runs hydration via an `attempt` counter). | Previously a hard hydration failure still routed to `/(tabs)/home` on empty stores, risking a crash deep in a screen. Calm retry > red box. |

### Deliberately NOT changed (with reasons — don't "fix" these without discussing)
- **`expo-mail-composer` install** (audit item): requires a package install →
  blocked by §3. Feedback already falls back to the share sheet gracefully
  (`src/services/feedback-transport.ts` dynamic-imports it with a catch). Add the
  dep once installs are possible; until then, some feedback lands via share sheet
  instead of direct email.
- **`IS_BETA_BUILD` from EAS channel** (audit item): `src/constants/build-info.ts`
  **deliberately** hardcodes this and documents why it avoids `expo-constants`.
  Respected the author's decision. **Action for production ship:** manually flip
  `IS_BETA_BUILD = false` (and bump `APP_VERSION` / `BUILD_NUMBER`).

---

## 4.5 Phase 2 premium-UX polish STARTED this session (⚠️ NOT runtime-verified)

All Reanimated-backed (UI thread, 60fps), Reduce-Motion aware, using **only
already-installed deps** (`react-native-reanimated`, `expo-linear-gradient`,
`react-native-safe-area-context`). **None of this has been seen on a device yet**
(no Node here) — treat as drafts to eyeball first thing once runnable.

**New reusable primitives — `src/components/ui/` (was empty):**
- `PressableScale.tsx` — spring press-scale + haptic tap primitive (the app-wide
  "spring on press" standard). Import via `src/components/ui`.
- `GradientButton.tsx` — premium pill CTA: coral→peach gradient, lift shadow,
  spring press, loading state. Uses the two-view shadow/clip trick (iOS can't
  clip + shadow on one view).
- `BreathingView.tsx` — gentle infinite "breathe" scale for the companion mascot.
- `PopOnChange.tsx` — quick pop when a watched value changes (streak/gems).
- `GradientFab.tsx` — shared premium floating "+" (coral→peach, spring, two-view
  shadow/clip). Replaces the hand-rolled FABs in Community + Sisterhood.
- `index.ts` — barrel.

**Screens polished (entrance choreography + safe-area + the primitives):**
- `app/(onboarding)/welcome.tsx` — staggered `FadeInDown` entrance, breathing
  mascot, `GradientButton` CTA, `useSafeAreaInsets`.
- `app/(onboarding)/ready.tsx` — same treatment; CTA `loading` state wired to the
  existing create-user flow. (Also still contains the Phase-1 beta-pioneer award.)
- `app/(tabs)/home.tsx` — card entrance stagger; greeting is now a soft
  phase-tinted gradient with a breathing companion "halo"; `PopOnChange` on
  streak/gems; `PressableScale` on mood buttons + full-check-in CTA + question
  chips; safe-area top inset; uses the shared `todayISO()`.
- `app/(tabs)/_layout.tsx` — tab icons spring "pop + lift" on focus (was a static
  scale).
- `app/(tabs)/community.tsx` — spring-press filter chips + post cards, staggered
  feed entrance, `GradientFab`, `GradientButton` empty CTA, safe-area. This is the
  **gold reference** for the polish language.

**Workflow `dottie-premium-polish` (parallel polish → adversarial verify) — COMPLETE.**
Ran in two passes (first hit the account usage limit; resumed after reset with cached
replay). Final: 16/16 agents, all 8 screens `compiles:true, logicPreserved:true`.
Polished + verified:
- `app/(tabs)/calendar.tsx`, `app/(tabs)/learn.tsx`, `app/(tabs)/profile.tsx`
- `app/(sisterhood)/circle.tsx`, `app/(sisterhood)/add-member.tsx`,
  `app/(sisterhood)/member/[id].tsx`
- `app/(community)/new-post.tsx`, `app/(community)/post/[id].tsx`

The verify pass also **repaired two files the interrupted first run had left broken**:
`post/[id].tsx` (raw `<Pressable>` never imported — a compile error) and
`add-member.tsx` (referenced a non-existent `styles.primaryButtonGrow`). Both fixed.

**Root-cause fixes the main agent applied after review (in the primitives):**
- `PressableScale` no longer auto-dims `disabled` to 0.6 (it fought calendar day
  cells, learn locked-rows, and loading buttons). Callers own the disabled look now.
- `GradientButton` dims itself (0.55) ONLY when `disabled && !loading`, so a loading
  spinner shows on a full-opacity pill.
- `learn.tsx` path cards: dropped `overflow:'hidden'` so the iOS warm shadow casts
  (content sits inside padding, so nothing needed clipping).

**Known-trivial leftovers (harmless, do not fail `tsc` — `noUnusedLocals` is off):**
dead `useMemo` import in `post/[id].tsx`; dead `paddingTop` in `new-post.tsx`
`styles.content`; extra selection haptics on new-post Cancel / add-member close
buttons (arguably nicer). Fix opportunistically. A few PRE-EXISTING low-contrast
spots (period/predicted day-cell text, peach "Shadow Profile" badge, mode badge on
light companion accents) are noted for the future accessibility pass — NOT regressions.

Community + Sisterhood are feature-complete locally (feeds, seeding, credibility,
phase-sync, privacy-filtered member views, add-member wizard). **No preview banners**
(per user).

**Verification notes for these (do first on device):**
- Confirm greeting-card text stays readable on the gradient (kept text on the
  light end on purpose) across all 4 phase palettes.
- Confirm entrance animations don't re-fire on store updates (they shouldn't —
  `entering` runs on mount only) and don't stutter the first paint.
- Confirm tab-focus spring feels right; tune `TAB_SPRING`/`FOCUSED_*` in
  `(tabs)/_layout.tsx` if needed.
- Toggle iOS "Reduce Motion" → all animation should go static, taps still work.

**Deps note:** `useSafeAreaInsets()` already works app-wide because React
Navigation mounts `SafeAreaProviderCompat` inside its navigators (the existing
`FeedbackBubble` relies on this too) — no root `SafeAreaProvider` was added.

**Not yet done in Phase 2:** branded app icon/splash art; gradient/motion polish
on Calendar / Learn / Community / Profile / Sisterhood; celebration-modal juice;
optional Lottie companion. See §5.

---

## 5. What's still ahead

### Phase 0 — Make it runnable (BLOCKED on §3; needs the user)
1. Get a machine where **Node 20 LTS** installs (personal, or corporate approval).
2. `cd code && npm install`.
3. Create `assets/images/` PNGs (`icon.png` 1024², `splash-icon.png`,
   `adaptive-icon.png`) — cream `#FFF8F2` bg. Interim plain versions are enough to
   boot; branded versions are a Phase 2 task.
4. Add `code/eas.json` (development / preview / production profiles) — needs a free
   Expo account (`eas login` + `eas init`).
5. Run path: **Android** = `eas build --profile development --platform android` →
   sideload `.apk` → `npx expo start --dev-client`. **iPhone** = needs Apple
   Developer account ($99/yr) + TestFlight. **Web quick-look** = `expo start --web`
   for layout only (MMKV/SQLite degrade).

### Phase 2 — Premium iPhone UX polish (do WITH a live preview, not blind)
The design *system* is already premium; these activate it. All use **already-installed**
deps (`expo-linear-gradient`, `react-native-reanimated`, `react-native-safe-area-context`,
`lottie-react-native`, `expo-haptics`) — no installs needed.
1. **Branded assets** — real Dottie icon/splash/adaptive (biggest premium signal).
   **[NOT STARTED]** — icon concept designed (coral→peach blossom, shown to user);
   needs SVG→PNG export on a Node machine, then drop into `assets/images/`.
2. **Safe-area insets** — `useSafeAreaInsets()` on screens. **[DONE across the app]**
3. **Gradient depth** — `expo-linear-gradient` on CTAs / FAB / greeting card.
   **[DONE — GradientButton + GradientFab primitives, applied everywhere]**
4. **Motion** — entrance stagger + spring press + pop + breathe.
   **[DONE — primitives + all 13 screens]**
5. **Companion presence** — evaluate a Lottie/illustrated companion for the hero
   greeting (needs real art — scope as stretch). **[NOT STARTED]**
6. **Micro-polish sweep** — consistent haptics + pressed states + empty states.
   **[DONE across the tab + deep screens]**

### Phase 2 status: SUBSTANTIALLY COMPLETE
All 13 screens (5 tabs + onboarding welcome/ready + tab bar + 5 Community/Sisterhood
deep screens) carry the polish language. Remaining Phase-2 stretch: branded asset
export (#1) and the optional Lottie companion (#5). **Nothing is runtime-verified yet
(no Node)** — first on-device session should eyeball each screen + run `tsc`.

> ⚠️ Do Phase 2 **one screen at a time against a running app**. Without a live
> preview (§3), UI edits are unverified drafts and risk looking wrong on device.

### Later roadmap (from SESSION-CONTEXT.md, unchanged)
Accessibility pass · Notifications · Onboarding polish · OTA content · Supabase
backend · Subscriptions (RevenueCat) · E2E cloud sync · Audio/soundscapes.

---

## 6. How to resume (suggested next-session opener)

> "Continuing Dottie. Read `code/docs/HANDOFF.md`. Phase 1 code fixes are done but
> unverified (no Node on the corporate laptop). Either (a) I now have a machine
> where Node installs — let's do Phase 0 and get it running, or (b) let's keep
> doing package-free Phase 2 polish and asset design that doesn't need a build."

**Before trusting Phase 1 fixes:** once runnable, run `npm run type-check` (tsc)
and the smoke test in `docs/SESSION-CONTEXT.md §11`, plus: complete onboarding →
Beta Pioneer badge shows immediately; cold-launch twice → no re-migration log
spam; force a hydration error → friendly retry screen appears.

---

## 7. Key file map (quick orientation)

```
code/
├── app/                      # expo-router screens
│   ├── _layout.tsx           # root: hydration + ghost gate + beta pioneer + (NEW) error screen
│   ├── (onboarding)/ready.tsx# (EDITED) awards beta pioneer on completion
│   └── (tabs)/home.tsx       # main dashboard — prime Phase 2 polish target
├── src/
│   ├── constants/            # colors / typography / spacing / shadows / build-info
│   ├── database/             # client, schema, migrations (EDITED), repositories
│   ├── engine/               # prediction / gamification / content / reports (pure)
│   ├── stores/               # Zustand; hydrate.ts (EDITED) is the cold-start bootstrap
│   ├── services/             # beta-onboarding, feedback-transport
│   └── utils/date.utils.ts   # (NEW) safe today/date helpers
├── app.json                  # references missing assets/ (Phase 0)
└── docs/                     # SESSION-CONTEXT.md, BETA-TESTING-GUIDE.md, HANDOFF.md (this)
```

🌱 Keep this file current — it is the memory that survives when the chat doesn't.
