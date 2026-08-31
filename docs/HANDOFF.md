# 🌱 Dottie — Session Handoff / Continuity Doc

> **Read this first when resuming the Dottie build.** It is the living record of
> where the project stands, what changed most recently, the environment
> constraints in play, and exactly what to do next. Update it at the end of every
> working session.

**Last updated:** 2026-08-31 (device-test #2 fixes + day-suggestions v2 + Home "Today at a
glance" + tab-bar rectangle removal + Sisterhood explainer + Hormones 101 lessons — all
LOCAL commits on `design-v2`, unpushed by owner's standing order until they OK a preview)
**Updated by:** Claude (Opus 4.7) — post device-test #2 iteration
**Companion docs:** `CLAUDE.md` (auto-loaded how-we-work guide), **`docs/REDESIGN-PLAN-R2.md`
(the earlier redesign plan)**, **`docs/DAY-SUGGESTIONS.md` (competitor scan + engine v2 —
new)**, **`docs/ONBOARDING-AND-WALKTHROUGH.md` (audit + proposal for next round — new)**,
**`docs/FEATURES-AND-RESEARCH.md` (predictor math, features, aurora system, research)**,
`docs/SESSION-CONTEXT.md` (original brief), `docs/BETA-TESTING-GUIDE.md`.

## 🔄 THIS SESSION (2026-08-31, LOCAL on `design-v2` — 5 commits, NOT PUSHED)
Order: b21c14a → f083ef0 → cd1e0b3 → 3d91d25 → [pending: Hormones 101 lessons].
All `[skip ci]`. Owner instruction: hold commits locally, push only on explicit OK.
- **Device-test #2 crashes fixed** — Sisterhood Circle + Ghost Mode "Maximum update depth
  exceeded" (Zustand v5 selectors returning fresh arrays / fresh `getConfig()` objects trip
  useSyncExternalStore's snapshot guard). Cached selectors + swapped Ghost Mode to a
  version-beacon + useMemo. See `src/stores/useSisterhoodStore.ts:459-483` and
  `app/(profile)/ghost-mode.tsx:80-95`.
- **Nav chrome cream → aurora** — `(sisterhood)/_layout`, `(community)/_layout`,
  `(profile)/_layout` were painting cream over the notch/status bar on aurora screens.
  Swapped to `A.ground` so time/battery are readable.
- **Community reply composer** — was one row of `[chip][input][big Reply pill]`. Split to
  small mode-chip row + wide input + compact circular send. `"Anon"` → `"Anonymous"`.
- **Tab bar rectangle removed** — `AuroraTabBar` stripped of BlurView + ground overlay +
  moving pill. Icons + labels only, active = `palette.accent` with a tiny underline dot.
- **Profile mode label** — `"Endocrine Mode"` (reads clinical / like an app default) →
  `"Irregular Cycles"` (matches onboarding).
- **Sisterhood explainer** — first tap on "Sisterhood Circle" from Profile now shows a
  themed dialog telling the user what it's for; once-only via new MMKV flag
  `Storage.sisterhoodExplainerSeen`.
- **Calendar ↔ Sisterhood bridge** — new "Care for a loved one →" glass card below the
  legend, adapts to sister count.
- **Day-suggestions v2** — the calendar day sheet + Home "Today at a glance" card. See
  `docs/DAY-SUGGESTIONS.md` for the competitor scan + engine design:
    - `resolveSubPhase()` — 9 sub-phases across the 4 classical phases.
    - Hormone story + culture line per sub-phase.
    - `why` tag on every suggestion.
    - `PersonalSignal[]` from last-7d symptom cluster + today's check-in.
    - `TrackPrompt[]` chips per sub-phase, wired to open the daily check-in.
    - Backward-compatible: all new fields are OPTIONAL on both input + output.
- **Home "Today at a glance"** (`src/components/home/TodayAtAGlanceCard.tsx`) — same
  engine on the home tab, above Phase Weather. Sub-phase chip + hormone story +
  personal signal + top tip + track chips + "See today ›".
- **Hormones 101 path imported** — 7 lessons + 7 quizzes from
  `docs/dottie questions/dottie_curriculum.json` added to `src/content/learning-paths.ts`
  and `src/content/quizzes.ts`. Curriculum has 24 paths / 93 lessons / 279 exercises /
  558 quiz questions — this is our first slice. UI/UX for the Learn tab is a later pass.

## 📋 NEXT (proposed — awaiting owner OK)
- **Onboarding audit + walkthrough** — full plan in
  **`docs/ONBOARDING-AND-WALKTHROUGH.md`**. Two headline fixes: (1) onboarding
  never fills `healthConditions`, so PCOS/endo/thyroid engine paths silently no-op
  for most users; (2) users are dropped on Home cold with no orientation. Plan is
  2 new onboarding screens (why-you're-here, conditions), a smarter cycle-setup, an
  optional reminders opt-in, and a 7-step coach-mark walkthrough (skip + revisit from
  Profile). Wait for owner call on the open questions before building.
- **Predictor simulation harness** — a tiny Node script that seeds fake cycle
  histories and prints what the engine predicts across N days. Answers the
  "how do we know it works?" question without a device.
- **Push the 5 waiting local commits** for a device preview when owner OKs.

## ⚡ CURRENT STATE (2026-08-31) — post on-device test #1
Node IS available now (24.19.0 via winget — prepend `C:\Program Files\nodejs` to PATH). Device
builds run on **GitHub Actions** (`.github/workflows/android-preview.yml`) — push to `design-v2`
builds an installable release APK (free, public repo). **Backup rule:** commit locally freely; to
back up WITHOUT a build put `[skip ci]` on the TIP commit before `git push origin design-v2`
(verified to skip the build; confirm via `gh run list`). Push WITHOUT `[skip ci]` only when the
owner OKs a preview. Verify with `npx tsc --noEmit` (expect 0) + `npx expo export --platform
android --output-dir <tmp> --no-minify` (bundle check).

**Owner tested the APK (test #1) and filed 18 annotated screenshots → `docs/testing.md`.** The
full execution plan + live status is **`docs/REDESIGN-PLAN-R2.md`**. Shipped so far (all on
`design-v2`, pushed with `[skip ci]`, origin tip `2c6995c`, ⚠️ NOT re-tested on device since #1):
- **P0 crash fixed** — Circle/You white-screen "Maximum update depth exceeded" = Zustand selectors
  returning fresh `[]`/objects each render (infinite re-render). Fixed with stable module-level
  EMPTY constants + memoized `selectLevelProgress`. Root `src/components/ErrorBoundary.tsx` added.
- **Batch 1** (quick wins): streak/gems moved off Home onto a minimal Learn header; frosted
  borderless tab bar; calendar day-sheet real backdrop blur (expo-blur `dimezisBlurView`); Home
  shows the real question text.
- **Theme A "don't fake a phase"** — Home + calendar gate ALL phase-derived content behind
  `selectHasCycleData` (`= lastPeriodStart != null`); honest "log your period" get-started when
  there's no data, instead of assuming follicular/Day 1.
- **Alert-theming** — every native `Alert.alert` app-wide (~30) → a global themed dialog:
  `src/components/ui/appDialog.tsx` (`showAppDialog(config)`, Zustand host `AppDialogHost` mounted
  once at root) rendering `CelebrationDialog` (warm palette; `danger` action variant for destructive
  confirms). **0 OS-white popups remain.**
- **Batch 4 — Learn overhaul (E1–E7)** — see `## 0.10` below.

**Also shipped (2026-08-31, on GitHub, `[skip ci]`, ⚠️ UNVERIFIED on device):**
- **Batch 3 — mood & check-in (Theme C):** C1 mood recolour RADIATES from the tapped emoji
  (`MoodScale` now surfaces the touch point → `applyMood(v, origin)`) + slower reveal (720/440ms);
  C2 explicit Mild/Moderate/Strong severity control (`SymptomPicker`, was hidden multi-tap dots);
  C3 `AuroraSlider` (PanResponder, snaps 1..5) replaces the 1–5 grid for Stress/Sleep; **mood-word
  layer** — `MoodWordPicker` names feelings under the valence scale (owner's chosen resolution of
  "more moods"), persisted as emotional symptom logs (no schema change; emotional removed from the
  symptom grid to avoid dup).
- **Theme D — calendar:** D2/D3 the day sheet leads with "YOUR DAY" (log-first) and pushes the
  "cosy & covered" suggestions below under "FOR THIS PHASE"; D4 week-ahead gated behind real data.
- **Batch 5 — Community F1:** prominent 2-col SPACE GRID + sort filters (Trending/New/Most
  hugs/Most answered); a selected space pulls up to a header with a back control.
- **G2:** the off-theme cream "white pane" was the new-post moderation card — retinted to glass.

**NEXT:** the whole redesign is UNVERIFIED on device — a **preview APK** (push WITHOUT `[skip ci]`)
is the obvious next step. Remaining backlog: Learn **E8** (content depth tiering) / **E9**
("later"); Community **F2** (personalized feed) / **F3** (replies — "later").

## 0.10 Batch 4 — Learn overhaul (DONE, design-v2, ⚠️ UNVERIFIED on device)
From `docs/testing.md` (screenshots 3,4,5 + 183339/183500/183547/183615/183655/184117). Files:
`app/(tabs)/learn.tsx`, `app/lesson/[id].tsx`, `app/quiz/[id].tsx`, `src/components/learn/
ExercisePlayer.tsx`, `src/engine/content/exercise-engine.ts`, new `src/components/learn/
CompanionScoreReaction.tsx`.
- **E3 (the "can't advance past completed lessons" BUG):** the Learn tab never re-read
  `lesson_progress` on focus, so a finished lesson stayed "current" + the next stayed locked. Fixed
  with `useFocusEffect` reloading progress (+ re-syncing the saved pace) on every focus.
- **E1/E4 path:** connector is a glossy TUBE (wide casing + lit core + gloss), wider meander to use
  the empty side space, a pulsing "you're here" glow ring, one-word pace labels (New/Basics/Deep),
  locked nodes = soft dashed accent ring + dimmed emoji + tiny lock badge (no glass), and
  **auto-scroll** to the current lesson on focus (best-effort `measureLayout` vs the scroll inner
  node; degrades to no-scroll).
- **E2:** the spirit companion HOPS in place on the current node; lesson reader intro now uses the
  animated `CompanionLottie` (was a static emoji).
- **E7:** `CompanionScoreReaction` — the companion reacts to the score (🤯 mind-blown at 100 → 🫂
  warm hug on a low score, never punishing) with a spring pop-in + expression badge + headline,
  replacing the generic leaf/star. Wired into the quiz result hero. Upgrades to illustrated Lottie
  automatically when art lands (score→`CompanionAnim` state).
- **E5:** quiz answer-review + explanation cards were LIGHT panes on the dark ground (+ near-white
  low-contrast text) → retinted translucent success/error. Lesson reader's bulky "✓ Already
  Complete" → a compact done-pill + a small Practice/Quiz next chip.
- **E6:** exercises now REVEAL the correct answer on a wrong/partial attempt — `describeSolution()`
  in the engine + `ExerciseFeedback.solution`, shown as an "ANSWER" card (was just "Almost — 1/4").
- **Remaining:** E8 (phase-aware / skill-level content TIERING — the pace chip toggles locks, not
  depth; there ARE 19 exercises across 7 lessons already) and E9 (opaque lesson pane + more
  content) — both owner-flagged "later".

## Session-end snapshot (engine/features phase)
On **`design-v2`** (all committed + pushed; `main` untouched; everything ⚠️ UNVERIFIED — no Node):
- **Predictor v2** — real Bayesian model (NIG → Student-t), drop-in. (§0.6 + FEATURES doc §1)
- **Symptom↔cycle correlation insights** — additive to Dottie Predicts (§0.6 · FEATURES §2)
- **Condition-pattern flags** — in the doctor report, non-diagnostic (§0.6 · FEATURES §3)
- **Mood Aurora** design system + mood-reveal + aurora components (§0 · FEATURES §4)
**Aurora theming — ✅ COMPLETE (design-v2, ⚠️ UNVERIFIED — no Node yet):** all **5 tab screens**
(Home, Calendar, Learn, Community, Profile) + **AuroraTabBar** wired into `(tabs)/_layout.tsx`;
report `patternsToDiscuss` in `ReportPreview.tsx`; and ALL **deep screens**: celebration flow (4
modals) · profile sub-screens (Reminders/Privacy/Medications) · daily-checkin cluster (+ mood pick
calls `applyMood`) · lesson + quiz readers · **community** (new-post, post detail) · **onboarding**
(welcome/mode-select/companion-select/cycle-setup/ready + layout) · **doctor-report** (ReportPreview
kept a light clinical document by design) · **sisterhood** (circle, member/[id], add-member,
shadow-log period + transfer). Deep-screen pattern: swap `Colors`/`Shadows` imports for the static
`A` tokens + `<AuroraBackground>` wrap + `StatusBar style="light"`; StyleSheet colours only, all
logic/handlers/copy byte-for-byte unchanged; phase badges map to `PHASE_AURORA` hues.
Intentionally NOT themed: `decoy-home` (a disguise screen) + `ghost-lock` (no direct Colors).
**Next (needs the Node machine — user now has one):** `expo install expo-blur` (real frost on glass),
then the verification pass — `npm install` → `tsc` (type-check) → EAS dev build → device feel-check
(esp. mood→recolour, the Learn aurora-stream, notification permission/delivery) — the gate to
merge `design-v2` → `main`. Also queued: perimenopause / birth-control-pill modes.

## 0.9 Competitive research — features to consider (2026-08-27)
Scan of competitor apps (Flo, Clue, Stardust, Natural Cycles, Oura, Drip, Wenly, Aavia, Life) +
reviews/studies + privacy discourse. Full sources in the session; key takeaways + roadmap:
- **Privacy is the #1 differentiator** — Meta found liable (2025) for Flo data; post-Roe fears are
  huge. Dottie's **local-first + Ghost Mode** already wins here. ✅ **DONE — Privacy trust screen**
  (`app/(profile)/privacy.tsx`, wired from Profile): the local-first promises + controls (Ghost Mode,
  Reminders, Doctor Report, and "Delete all my data" → existing `deleteAccount()`).
- **Anti-pink / inclusive design** — top UX complaint is pink/gendered/hetero-assuming UI. Dottie's
  aurora + ungendered companions align; ACTION: a copy **inclusivity audit** (avoid assuming she/female/
  male-partner; trans/non-binary friendly).
- **Cycle-syncing** (phase food/movement) = 294M TikTok views but science is INCONCLUSIVE and rarely
  disclosed. Dottie already offers it in the calendar with a non-diagnostic disclaimer — a trust win.
  KEEP the honest framing.
- **✅ DONE — Notifications v1** (the foundational unlock): `src/notifications/scheduler.ts`
  (`applyReminderPrefs` — daily check-in / hydration / period heads-up via expo-notifications, local +
  opt-in, permission asked only on enable) + `Storage.reminderPrefs` + `app/(profile)/reminders.tsx`
  (aurora settings: toggles, time presets, discreet-mode preview) wired from Profile. `hydration_nudge`
  copy added. ⚠️ needs `npm install` + dev build to deliver; logic verifiable by reading.
- **Gaps vs competitors (net-new, prioritized):**
  1. ✅ **DONE — Birth-control / medication reminders** (`app/(profile)/medications.tsx` +
     `Storage.medications` + `scheduler.syncAllReminders` + `medication_reminder` copy). Add a
     reminder (name/kind/time preset), toggle/remove, discreet lock-screen copy. Follow-ups: precise
     time picker, pack/placebo tracking + restart nudge, re-sync on launch/after check-in.
  2. **Wearable / Apple Health + Google Fit** (skin temp, HRV, sleep) — the accuracy frontier (Oura 96%
     ovulation detection). Native, bigger lift.
  3. **Perimenopause/menopause mode** (wider windows, hot-flash/sleep) — endocrine mode only today.
  4. **Partner sharing** (dedicated partner view) — Sisterhood is friend-based; partner is adjacent.
  5. **Notifications scheduler** (`expo-notifications`) — FOUNDATIONAL; unblocks #1, period heads-ups,
     hydration nudges (copy already exists in `src/notifications/copy.ts`).
- Dottie's existing strengths to keep leaning on: **Learn** (few competitors teach), **community +
  sisterhood**, **companions/gamification**, **on-device Bayesian predictor**, **doctor report**.

## 0.8 Learn + Calendar REIMAGINING (approved direction, 2026-08-27)
User wants a striking, Duolingo-grade Learn experience + an intuitive interactive Calendar.
**Two concept mockups built + approved (published artifacts, faithful to real aurora tokens/content):**
- **Learn Quest** 🦊 https://claude.ai/code/artifact/55ed5962-a5ba-497f-91bc-f753d250c7a5
- **Calendar Planner** 📅 https://claude.ai/code/artifact/7b2dfab6-4069-4b4f-a51b-b9e7fc7831d9

**Decisions (user):** (1) **Lottie illustrated characters** for the companions (not just emoji) —
but ship emoji-first, art drop-in. (2) Learn placement = **hybrid**: guided/mode-gated rail for
beginners + free topic/level choice for the knowledgeable, difficulty adapts from quiz scores.
(3) **Sequence: source Lottie art FIRST**, then build engines.

**Learn vision:** path-map UI (winding trail of lesson nodes) replacing the card list; an
**exercise-type engine** widening the existing MCQ quiz loop to 5 interactive types (tap-the-pairs,
drag-to-order, fill-the-blank, tap-the-diagram, tap-the-word) — additive, same instant-feedback +
companion-reaction + XP/gems; animated companion moments (celebrate, mid-lesson hydration nudge).
**Calendar vision:** tap a day → **glass day-detail popover** magnifies from the cell (calendar
blurs behind), showing phase + prediction + phase/mode/condition-aware suggestions (supplies,
clothes, food, movement) + plans/notes/quick-add + planning dots on close; **week-ahead** strip;
G-Cal sync + OS reminders = LATER (needs expo-notifications/OAuth). All suggestions NON-diagnostic.

**✅ DONE this session — drop-in Lottie pipeline (design-v2, ⚠️ UNVERIFIED):**
- `src/content/companion-lottie.ts` — manifest: 6 companions × states + shared moments → Lottie
  asset; all empty now (→ emoji fallback). Add art = one `require()`.
- `src/components/ui/CompanionLottie.tsx` — renders wired Lottie, else the emoji spirit-animal
  breathing; Reduce-Motion aware; exported from ui barrel. (`lottie-react-native` = Apache-2.0, a
  dep already; needs a dev build to render.)
- `assets/lottie/README.md` + **`docs/LOTTIE-SOURCING.md`** — inventory (P0 = 6×{idle,celebrate}),
  specs, **Lottie Simple License** (commercial OK, no attribution, mods = derivative), candidate
  sources (LottieFiles animal/mascot/confetti categories), attribution ledger, wiring checklist.
- **Art recommendation:** commission/adopt ONE matched-style set for the 6 heroes (consistency >
  free grab-bag); free singles OK for shared moments.
**✅ DONE — interactive exercise-type ENGINE (design-v2, ⚠️ UNVERIFIED):** the pure grading brain
for the 5 Duolingo-style types, additive (quizzes untouched):
- types in `content.types.ts` — `Exercise` union (pairs/order/fill_blank/tap_diagram/tap_word) +
  `ExerciseAnswer` (value-based, so grading needs no hidden key).
- `src/engine/content/exercise-engine.ts` — PURE/stateless: `renderExercise()` (answer-free
  shuffled display model, anti-leak), `gradeExercise()` (value-based, partial-credit aware),
  `checkExerciseAnswer()` (grade + `wrapInsight` companion reaction + explanation + rewards),
  `computeExerciseReward`, `validateExercise`, `ExerciseProvider` iface. Exported from the barrel.
- `src/content/exercises.ts` — 4 seed exercises on `lesson_cycle_basics_2` + `buildBundledExerciseProvider()`.

**✅ DONE — interactive exercise UI + screen + lesson wiring (design-v2, ⚠️ UNVERIFIED):**
- `src/components/learn/ExercisePlayer.tsx` — aurora-themed player + a renderer per type (pairs/
  order/fill_blank/tap_diagram/tap_word); the Duolingo loop (build → Check → grade + companion
  reaction + explanation → Continue); companion via `<CompanionLottie>`; progress + XP/gem tally.
- `app/exercise/[lessonId].tsx` — aurora-native screen (like the quiz screen) that runs the player,
  awards XP/gems (`quiz_complete` source, mirroring lesson/quiz), shows a result card, chains to quiz.
- `app/lesson/[id].tsx` — after "Mark as Complete", routes to practice when the lesson has exercises
  (then the exercise screen offers the quiz): **read → practice → quiz**. Cream reader otherwise untouched.
- In-flight decisions: exercises get their own aurora screen (don't retheme the working cream reader
  blind); `order` is **tap-to-sequence** (robust unverified), drag is a later upgrade.

**✅ DONE — interactive Calendar day-detail popover + suggestion engine (design-v2, ⚠️ UNVERIFIED):**
- `src/engine/calendar/day-suggestions.ts` — PURE, NON-diagnostic suggestion engine: phase base ×
  period-proximity (supplies/comfort) × condition modifiers (PCOS/endo/thyroid); carries a disclaimer.
- `src/components/calendar/DayDetailSheet.tsx` — aurora glass popover, origin-magnify + scrim
  (Reanimated, Reduce-Motion aware): suggestions, "Mark as period" (preserves old tap-to-log,
  past/today only), "Plan this day" toggle, note field, Google-Calendar row marked LATER.
- `src/database/storage.ts` — additive `dayPlans` MMKV accessor (date→{note,planned}) + `DayPlan` type
  (no SQLite migration).
- `app/(tabs)/calendar.tsx` — tap opens the sheet (was an Alert); FUTURE days now tappable (planning);
  planning dots on noted/flagged days; `phaseForDate` projects phase for any date.
- Decisions: period-logging preserved inside the sheet; in-screen overlay (calendar shows through
  dimmed — true frost awaits expo-blur); non-diagnostic throughout. Limitation: overlay sits under the
  AuroraTabBar (tab bar stays tappable) — a portal/Modal could cover it later.

**NEXT here (needs Node to verify feel):**
1. ✅ DONE — **Learn path-map** (`app/(tabs)/learn.tsx`): each path is a winding **aurora stream**
   (react-native-svg) of lesson nodes (done/current/locked) — the ribbon is lit (accent→accent2 +
   glow) up to the current node and dim beyond; companion (`CompanionLottie`) on the current node,
   reward node per path. (Replaced the earlier plain grey connector.) **Hybrid placement is a real switch**: `Storage.learnLevel` — 'new' keeps
   sequential locks (guided), 'basics'/'deep' unlock the trail (self-directed); null → guided.
   All logic (progress/mode-filter/lock rule/XP/nav) preserved. Difficulty-tiered CONTENT is future.
2. ✅ DONE — **exercises for every lesson** (`src/content/exercises.ts`, 19 total): all 7 lessons
   across both paths now have 2-4 interactive exercises, so every lesson routes into practice.
   Still to author: deeper phase-tip suggestion coverage in `day-suggestions.ts`; beginner→advanced
   tracks so the pace switch changes WHAT is shown, not just locking; more paths/lessons overall.

**✅ DONE — OTA content-update seam** (updatable lessons after launch, offline-first · ⚠️ UNVERIFIED,
no backend wired): `src/content/remote/` — `content-bundle.ts` (versioned `ContentBundle` +
`validateContentBundle`), `remote-content-store.ts` (MMKV cache via `Storage.remoteContentBundle`),
`content-updater.ts` (`ContentUpdater` + injectable `BundleFetcher`, default no-op; applies only
valid+newer; privacy: fetcher gets ONLY a version number), `merged-providers.ts` (cached-over-bundled
Lesson/Quiz providers, wired into `hydrate.ts`). `exercises.ts` merges cached exercises too. Full
design + hosting options (CDN JSON / EAS Update / CMS) + go-live wiring in **`docs/CONTENT-UPDATES.md`**.
Dormant + no-op until a real fetcher + backend are chosen — that's the remaining decision.
3. ✅ DONE — **Calendar week-ahead strip** (`src/components/calendar/WeekAheadStrip.tsx` + wired in
   `calendar.tsx`): next 7 days w/ phase + one-line suggestion + window/planning dots; taps open the
   same popover (shared `buildSelected`). Calendar remaining is later-only: `expo-notifications`
   reminders + **Google Calendar** sync (OAuth, opt-in, privacy-gated).
4. Parallel/independent: **source the Lottie art** (fill the ledger, drop into `assets/lottie/`, wire
   the manifest) — everything runs on the emoji fallback, so art is non-blocking.
5. First Node pass: `npm run type-check` + device feel-check the exercise loop AND the calendar
   popover (origin-magnify, scrim, note keyboard, planning dots).
All UNVERIFIED until a Node/device pass.

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
  - **✅ DONE — Home screen themed:** `app/(tabs)/home.tsx` (AuroraBackground + GlowRing +
    GlassCards + ClayButton mood keys wired to the ORIGIN reveal `applyMood(score,{x,y})` alongside
    the unchanged save/streak/celebration logic; palette from `todayCheckIn?.moodScore` on mount) +
    its child cards `DottiePredictsCard.tsx` + `PhaseWeatherCard.tsx` (palette glass; also removed
    stale `Colors.primary.sunshine/rose`/`surface.warmIvory` refs). `ClayButton` now forwards the
    press event. ⚠️ UNVERIFIED.
  - **✅ DONE — all 4 remaining tab screens themed** (design-v2, ⚠️ UNVERIFIED):
    `calendar.tsx` (glass phase-summary/legend, day cells glow in PHASE_AURORA hues),
    `learn.tsx` (glass stat/path/lesson cards; each path keeps its own brand accent),
    `community.tsx` (glass post cards + filter chips; warm GradientButton/Fab kept as the
    action pop), `profile.tsx` (glass stat/level/settings cards; companion keeps its accent).
    Each: `<AuroraBackground>` wrap, `<StatusBar style="light"/>`, colours inline from
    `useAurora()`, StyleSheet = layout only, all logic/handlers/copy byte-for-byte unchanged.
  - **✅ DONE — `AuroraTabBar` wired** into `(tabs)/_layout.tsx` via `tabBar={props => …}`;
    removed the old cream `tabBar` style + per-icon `TabIcon` spring (AuroraTabBar owns icons,
    labels Today/Cycle/Learn/Circle/You, active tint, selection haptic, indicator motion).
  - **✅ DONE — StatusBar** flipped to light on every aurora screen (added per-screen
    `<StatusBar style="light"/>` from expo-status-bar).
  - **✅ DONE — report `patternsToDiscuss` section** now renders in `ReportPreview.tsx`
    ("Patterns Worth Mentioning", shown only when non-empty; warm-amber accent for 'discuss',
    neutral for 'note'; report intentionally stays on the clean light theme, not aurora).
  - **NEXT theming (needs Node to verify):** (a) **deep screens** to aurora — do the
    **`(modals)/daily-checkin.tsx`** FIRST (it's the primary mood-logging surface; wire its mood
    pick to `applyMood(score, origin)` like Home does, so a full check-in also recolours the app),
    then `checkin-recap`, `(community)/new-post` + `post/[id]`, all `(sisterhood)/*`,
    `(profile)/doctor-report` + `ghost-mode`, `(onboarding)/*`, the celebration modals
    (`level-up`, `streak-celebration`), and `lesson/[id]` + `quiz/[id]`; (b) `expo install
    expo-blur` for real frost; (c) `tsc` + device feel-check; then merge design-v2 → main.

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
