# 🌱 Dottie — Session Handoff (READ THIS FIRST)

**Last updated:** 2026-09-02 · Session ~4 hours
**Branch:** `gemini-learn-redesign` (all current work). `design-v2` and `main` are frozen.
**Owner device:** Nothing Phone (Android). NOT MIUI/Xiaomi — do not assume MIUI behaviour.

> **Token-efficient start.** Read §1–3 (5 min) and jump to §4 for open work.
> Every other doc is *reference only* — pull it when a specific section names it.

---

## 1. Where we are (one paragraph)

The Gemini Learn Redesign shipped in 4 phases + a stack of device-test fixes. The
app runs on the owner's Nothing Phone via GitHub Actions preview APKs. Latest
commit is `e8f1335` — fixed the **persistent top-left white circle** (Modal +
Reanimated FadeInDown race in `CelebrationDialog`; every `showAppDialog` call
site was misrendering the card at (0,0) with tiny bounds → white blob). Ship a
new APK from that commit and verify.

## 2. How to work (env + workflow)

- **Node available** (v22 via winget on Windows, /opt/node22 in this sandbox).
  `npx tsc --noEmit` should always exit 0 before commit.
- **On-device runtime** = GitHub Actions build (`.github/workflows/android-preview.yml`,
  registered on `main`). Push to `gemini-learn-redesign` without `[skip ci]` →
  builds an APK. With `[skip ci]` → just backs up.
- **Test scripts** (all pure Node via tsx, must stay green):
  - `npm run validate:content` — 4 schema rules
  - `npm run test:adaptive` — Phase 3 quiz engine, 17 invariants
  - `npm run test:rhythm` — Phase 4 rhythm, 22 invariants
  - `npm run simulate` — predictor Bayesian sim
- **CelebrationDialog rule** (post-fix): NEVER wrap the dialog card in a
  Reanimated `entering` animation — the Modal's own `animationType="fade"` is
  enough. Adding Reanimated back would re-introduce the white-circle bug.
- **Notification permission rule** (device-test #5): `syncAllReminders` never
  prompts. Only call `requestNotificationPermission()` from an explicit user tap.

## 3. What shipped in this session (commits, newest first)

Chronological on `gemini-learn-redesign`. Each is a distinct fix — read commit
messages for the exact rationale.

| # | Commit | What |
|---|--------|------|
| 15 | `e8f1335` | **White-circle root cause** — dropped Reanimated FadeInDown in `CelebrationDialog` (Modal + entering-animation race) |
| 14 | `3152994` | AuroraTabBar liquid-glass redesign (BlurView + luminous pill + deeper shadow) |
| 13 | `fb8ae03` | Sisterhood period-log: multi-day rapid flow (auto-advance date, ✓ pills, "Log another" dialog) |
| 12 | `d48e6cc` | Device-test #5 batch: splash aurora, tab-bar root bg, learn label overlap, quiz "Clos" truncation, quiz % crowding, `Notifications.request*` silent-check split |
| 11 | `7b31e87` | AuroraTabBar first rebuild — curvy glass pill + moving highlight |
| 10 | `b984a3c` | **Phase 4** — Gentle Rhythm cadence chip (no separate Learn streak, rest days count, 22-invariant harness) |
| 9 | `9fa2a8d` | **Phase 3** — adaptive quiz engine (promote-only, nearest-tier fallback, seeded shuffle, 17-invariant harness) |
| 8 | `a0f4774` | **Phase 2** — 4 per-phase paths (menstrual/follicular/ovulation/luteal-PMS): 12 lessons + 12 quizzes + 60 questions |
| 7 | `aa24753` | **Phase 0+1** — schema hardened (`DifficultyTier`, `adultOnly`, quiz `level`), content validator, phase-aware selector, Today's Spotlight card |
| — | `74e89bd` `94573da` `e8fc555` `da7e4a8` `8ce4177` | CI wiring + earlier device-test fixes (tab bar, PIN aurora, add-reminder, day-counter=0, walkthrough hard-kill) |

Corpus: **26 lessons / 23 quizzes / 121 questions**. TSC clean. All three
harnesses green.

## 4. Open TODO (from owner, 2026-09-02)

**Priority 0 — verify white-circle fix on the next APK.** If it's gone, close
this out. If it persists, the next culprit is likely the WalkthroughOverlay
scrim (a Pressable with `absoluteFillObject`); either replace it with a plain
tap-outside dismiss or verify `Storage.walkthroughSeen` guard is working. My
`e8f1335` fix hits every `showAppDialog` call site, which is the most likely
source given owner's "on Save/Done/Next in Learn, Profile, period log."

**Priority 1 — end-to-end button simulation.** Owner asked for every button,
every screen, every edge case simulated + tested. A pragmatic path: write a
Detox / Maestro e2e suite (Maestro is lighter, uses YAML flows) hitting the
main journeys. There is NO test infra today besides the pure-TS harnesses.

**Priority 2 — App-store rollout.** Preview APK currently ships as a debug-
signed sideload. For Play Store: EAS Build (or a manual keystore + gradle
release path), signing config, `assembleRelease` with release variant,
version code bump, screenshots, store listing. `docs/BETA-TESTING-GUIDE.md`
has some prior groundwork.

**Priority 3 — Sister cycle data on the main calendar.** Deferred from
device-test #5 pending an owner design steer. Options: (a) second-colour dot
per day cell, (b) "Sisters this week" strip below week-ahead, (c) expanded
day-sheet section. Get owner's pick first.

**Priority 4 — Learn tab auto-advance report.** Owner said backing out of a
lesson advances the "you're here" marker. I could not find any code path that
marks a lesson complete without an explicit tap; suspected downstream of the
white-circle bug (dialog invisibly steals the tap). Re-verify after `e8f1335`
is on device.

## 5. Files that matter (jump table)

**Learn (Gemini redesign)**
- `src/engine/learn/phase-aware-selector.ts` — Phase 1 selector (pure TS)
- `src/engine/learn/adaptive-quiz.ts` — Phase 3 tier engine (pure TS)
- `src/engine/learn/gentle-rhythm.ts` — Phase 4 cadence (pure TS)
- `src/components/learn/TodaySpotlightCard.tsx` — Phase 1 UI
- `src/components/learn/GentleRhythmChip.tsx` — Phase 4 UI
- `app/(tabs)/learn.tsx` — the path-trail screen, all Learn UX
- `src/content/{learning-paths,quizzes,exercises}.ts` — bundled content

**UI primitives (aurora)**
- `src/components/ui/aurora/AuroraTabBar.tsx` — liquid-glass bar (BlurView + moving pill)
- `src/components/ui/aurora/{AuroraBackground,GlassCard,ClayButton,GlowRing}.tsx`
- `src/components/ui/CelebrationDialog.tsx` — **DO NOT re-wrap in Reanimated entering**
- `src/components/ui/appDialog.tsx` — `showAppDialog()` global dialog API
- `src/theme/{palettes,mood-palette,ThemeProvider,aurora-static}.ts` — palette tokens

**Data + engines**
- `src/stores/*` — 12 Zustand stores; Zustand v5 needs cached selectors (v5 breakage pattern documented in prior HANDOFF)
- `src/database/{storage.ts,client.ts,migrations.ts,repositories/*}` — MMKV + SQLite
- `src/engine/prediction/bayesian-predictor.ts` — cycle predictor
- `src/engine/calendar/day-suggestions.ts` — `resolveSubPhase()` — 9 sub-phases
- `src/notifications/scheduler.ts` — `checkNotificationPermission` (silent) vs `requestNotificationPermission` (explicit only)

**Scripts / CI**
- `.github/workflows/android-preview.yml` — the ONE workflow. Registered on
  `main`, triggers on push to `design-v2` or `gemini-learn-redesign`. Includes
  optional `npm run --if-present` gates so `design-v2` (no test scripts) still
  works.
- `scripts/{validate-content,adaptive-quiz-harness,gentle-rhythm-harness,predictor-simulation}.ts`

## 6. Rules baked into current code (do not undo)

- **NON-DIAGNOSTIC copy** everywhere. Doctor-report-signals discipline.
  "Many people report" not "your body is doing X." No wellness claims.
- **Every quiz question with id `q_*` must have `level`.** Every imported
  lesson must have `difficulty`. `validate:content` enforces R1/R2/R3/R4.
- **Aurora ground = `#0C0A16`** everywhere the app can flash (splash, nav bar,
  Stack contentStyle, tabs root View). No cream flashes.
- **Zustand v5**: selectors returning fresh arrays/objects trip
  `useSyncExternalStore`. Cache at module level or use `useMemo`.
- **`androidStatusBar.translucent = false`** in app.json + a per-screen
  `<StatusBar style="light" />` — do not combine with anything that draws
  behind the status bar.
- **Walkthrough is opt-in only.** Removed auto-launch on Home mount. Restart
  only via Profile → "Show me around again". Overlay hard-guards on
  `Storage.walkthroughSeen`.
- **Bottom tab bar is a floating pill** — never restore a solid rectangle
  behind it.

## 7. Companion docs (pull only when named)

- `docs/FEATURES-AND-RESEARCH.md` — predictor math, aurora system, feature research
- `docs/DAY-SUGGESTIONS.md` — competitor scan + sub-phase engine v2 design
- `docs/ONBOARDING-AND-WALKTHROUGH.md` — audit + tour design
- `docs/DEVICE-TEST-3.md` — earlier device-test fixes
- `docs/LEARN-REDESIGN-*.md` — Gemini brief + master spec (external Gemini research)
- `docs/APP-AUDIT-FOR-GEMINI.md` — six-prompt audit pack
- `docs/CONTENT-UPDATES.md` — OTA content pipeline (dormant, no backend yet)
- `docs/BETA-TESTING-GUIDE.md` — earlier beta testing groundwork
- `docs/LOTTIE-SOURCING.md` — companion Lottie art pipeline
- `docs/SESSION-CONTEXT.md` — original project brief

## 8. Environment traps (real ones I hit this session)

- **`main` had no `.github/workflows/`** — the workflow needed to be added
  there for `workflow_dispatch` API to work. Do NOT touch `main` for anything
  else.
- **Sandbox blocked Azure blob URLs** for artifact download; can't ship an APK
  to the owner directly. They download via the GitHub mobile app's Actions
  tab → run page → Artifacts section (below the job list).
- **Auto mode blocks certain destructive git ops** even on feature branches;
  needs explicit user OK for `push origin main`, `git branch -D`, etc.
- **`ensureNotificationPermission`** used to prompt on any sync — that was the
  white-circle before I traced it to CelebrationDialog. Both fixed now, but
  the silent/explicit split stands.

---

*If you're a new Claude session reading this: run `git log --oneline -10 gemini-learn-redesign`
to see the last 10 commits, then check `git status` and jump to §4. Do NOT re-explore
the codebase — it hasn't changed since `e8f1335`.*
