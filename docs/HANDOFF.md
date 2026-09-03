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
commit is `21d5432`. The **persistent top-left white circle** is now fixed at the
root: it was a stuck React Native `<Modal statusBarTranslucent transparent>`
window (a separate Android OS window that mis-measured on first paint and floated
above every screen, intercepting touches — the card collapsed to a top-left blob
and `visible` never flipped back). `e8f1335` (dropping Reanimated) was the wrong
diagnosis; `21d5432` removes **every** `<Modal>` in the app — `CelebrationDialog`
and `VersionBadge` are now in-tree absolutely-positioned overlays that return null
when hidden. Same commit frees the **decoy trap** (hardware back + `exitDecoy()`)
and adds the owner-requested **cream ⇄ aurora decoy toggle**. Ship the new APK and
verify all three on device.

## 2. How to work (env + workflow)

- **Node available** (v22 via winget on Windows, /opt/node22 in this sandbox).
  `npx tsc --noEmit` should always exit 0 before commit.
- **On-device runtime** = GitHub Actions build (`.github/workflows/android-preview.yml`,
  registered on `main`). Push to `gemini-learn-redesign` without `[skip ci]` →
  builds an APK. With `[skip ci]` → just backs up.
- **Test scripts** (all pure Node via tsx, must stay green — CI runs them all
  before the APK build):
  - `npm run type-check` — `tsc --noEmit`
  - `npm run validate:content` — 4 schema rules (26 lessons / 23 quizzes / 121 questions)
  - `npm run test:adaptive` — Phase 3 quiz engine, 17 invariants
  - `npm run test:rhythm` — Phase 4 rhythm, 22 invariants
  - `npm run test:predictor` — 14 real-user predictor scenarios, ~60 assertions
  - `npm run test:journey` — 10 pure-engine end-to-end journeys, phase × condition
    combinations, spotlight/quiz/rhythm cross-cutting
  - `npm run audit:ui` — static onPress audit over 154 tappables (Pressable /
    PressableScale / GradientButton / GradientFab)
  - `npm run test:all` — runs every one of the above, exits non-zero on any failure
  - `npm run simulate` — eyeball predictor sim (non-assertive; for visual review)
- **No `<Modal>` rule** (post `21d5432`): the app must contain ZERO React Native
  `<Modal>` components. On Android a transparent/translucent Modal is a separate
  OS window that can get stuck floating over everything (the white-circle bug).
  Any dialog/overlay must be an in-tree absolutely-positioned View mounted at the
  app root (see `CelebrationDialog`, `VersionBadge`), returning null when hidden,
  with a tap-outside backdrop. `grep -rn "<Modal" src app` must stay empty.
- **Notification permission rule** (device-test #5): `syncAllReminders` never
  prompts. Only call `requestNotificationPermission()` from an explicit user tap.

## 3. What shipped in this session (commits, newest first)

Chronological on `gemini-learn-redesign`. Each is a distinct fix — read commit
messages for the exact rationale.

| # | Commit | What |
|---|--------|------|
| 17 | `21d5432` | **White-circle real fix** (removed EVERY `<Modal>` → in-tree overlays) + **decoy trap freed** (hardware back + `exitDecoy()`) + **cream⇄aurora decoy toggle** (`decoyTheme` setting) |
| 16 | `9b80d37` | Deep test harnesses — 3 new suites (predictor scenarios, app journeys, UI onPress audit), all wired into CI |
| 15 | `e8f1335` | White-circle attempt #2 (dropped Reanimated FadeInDown) — **superseded by `21d5432`; Modal was the real cause** |
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

**Priority 0 — verify on the next APK (`21d5432`):**
1. **White circle** — open a lesson, tap "Understood/Proceed", confirm NO white
   dot at top-left and the quiz opens. Repeat across several lessons + the period
   log + Profile dialogs. Root cause was a stuck `<Modal>` window; `21d5432`
   removed all Modals, so if it recurs the culprit is a NEW absolutely-positioned
   overlay, not a Modal (grep confirms zero remain).
2. **Decoy exit** — trigger the decoy (wrong PIN, or "Skip · view notes" on the
   lock screen), then press the Android back button → should return to the PIN
   lock (not force-quit, not stay trapped). Triple-tap "Refresh garden" still
   works too.
3. **Decoy toggle** — Profile → Ghost Mode → "Plant journal style" switch. Off =
   cream notebook, On = dark aurora. Flip it, re-enter the decoy, confirm the look
   changed and the header clears the status-bar clock in both.

**Priority 1 — end-to-end button simulation.** _Partial: engine + UI-static
layer done, on-device layer still open._ Three new harnesses shipped this
session (all wired into CI, all green as of `test:all`):

- `scripts/predictor-scenarios-harness.ts` — 14 scenarios: cold start, first
  period logged, regular mature, PCOS irregular, perimenopause drift, teen
  sparse, stress+low-sleep shift, learning curve (1→12 cycles), condition
  stacking, edge inputs (1-day / 200-day cycles), NaN guards. **Caught 3
  fixture bugs before shipping.**
- `scripts/app-journey-harness.ts` — 10 pure-engine journeys: onboarding→
  first-period→prediction, 6-month mature, PCOS, teen-mode `adultOnly`
  filter, adaptive quiz progression, gentle-rhythm 14-day cadence, spotlight
  adapts as lessons complete, perimenopause drift, every phase × condition
  combo (20 combos), garbage-input tolerance.
- `scripts/ui-onpress-audit.ts` — regex scan of 97 .tsx files, 154 tappables,
  verifies every `<Pressable>` / `<PressableScale>` / `<GradientButton>` /
  `<GradientFab>` has an `onPress`. Currently 100% clean.

**Still open for this priority:** true UI end-to-end on a running app.
Recommended path: Maestro (YAML flows, single binary) rather than Detox
(heavier). Add a `.maestro/` folder of flows (onboarding, log-period,
lesson-complete, quiz, sisterhood-add, ghost-mode) and add a job to the CI
workflow that runs them on an emulator OR a real device via BrowserStack /
Firebase Test Lab.

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

### Owner-approved backlog (2026-09-02/03) — build in this order

> **Now building on branch `gemini-v2`** (off `gemini-learn-redesign`). CI builds
> APKs for it (workflow triggers on `gemini-**`). **Pushes are held** at owner's
> request — commit to `gemini-v2` as we go; the owner does the FINAL push to
> trigger the APK build. So `origin/gemini-v2` may lag local by several commits.

**B1 — Prediction explainer + Home day-ring meaning ✅ DONE (`gemini-v2`).**
B1.1 `explain-prediction.ts` + `test:explainer` (`0c19ae7`); B1.2 store
`latestExplanation`/`selectPredictionExplanation` + reactive
`PredictionExplainerCard` on Calendar (`d00d95b`); B1.4 home day-ring meaning
(`0cfe55a`); B1.5 optional height/weight → `app/(profile)/about-you.tsx` +
profile row (`b52b0d5`). Dynamic card lives under the Sisterhood bridge; reads
`selectPredictionExplanation` (recomputes on every log/edit). Plan:
`docs/PREDICTION-EXPLAINER-PLAN.md`.

**B2 — Security honesty ✅ DONE (Step 1 `28de618`, Step 2 `252833e`).**
Step 2: SQLCipher DB encryption — `app.json` expo-sqlite `useSQLCipher: true`;
`ENCRYPTION_ACTIVE=true`; encrypted DB renamed `dottie-enc.db`;
`migratePlaintextDbIfNeeded()` does a guarded, non-destructive
`sqlcipher_export()` of the old plaintext DB then deletes it. Whole data plane
(MMKV + SQLite) now encrypted under hardware-held keys. ⚠️ NATIVE + DEVICE
critical — needs the SQLCipher prebuild; safe test = clean reinstall.
Details below (Step 1 unchanged):
- Step 1: hardware-backed MMKV key via `expo-secure-store` replaces the
  hardcoded key. `src/security/keychain.ts` (new); `storage.ts` now lazy —
  `initEncryptedStorage()` (called before `hydrateAppState()` in `_layout.tsx`)
  fetches the key and, first boot after upgrade, `recrypt()`s the legacy store
  in place (data preserved). Never bricks (legacy-key fallback). `db()` throws
  if used before init. `useUserStore` initial `userId` no longer reads Storage
  at import. ⚠️ DEVICE-CRITICAL — verify the upgrade path on device; recovery =
  reinstall.
- Step 2 (NEXT): SQLCipher DB encryption (`client.ts` `ENCRYPTION_ACTIVE=false`
  today) — native driver swap + dev-client build, wired to Ghost Mode panic wipe.

**B3 — Motion / transition pass (Gemini was right).** The app has micro-
interactions (PressableScale springs, moving tab pill, BreathingView, PopOnChange,
GlowRing, haptics) but NO choreography layer: no screen/stack transitions, no
entrance/stagger on lists & cards, no shared-element handoff, no skeleton/loading
motion. Do a cohesive pass with the `animate-expo` skill — Reduce-Motion aware,
UI-thread only. Scope: expo-router stack transitions, card/list entrance stagger
on Home/Learn/Calendar, number/date tweens when predictions update (ties into B1).

**B4 — Data portability.** Password-encrypted JSON export/import (no backend) so
device loss ≠ data loss; later a HealthKit/CSV import seam for Flo switchers.

**B5 — A11y + tone.** Dynamic-type (drop fixed heights → minHeight), glass
contrast ≥4.5:1, hide decorative SVGs from screen readers; suppress streak/gem
celebration when a pain/low-mood is logged.

**B6 — Predictor skew (later).** Log-normal / skew-aware prior for PCOS/anovulatory
right tails. Accuracy refinement, not urgent.

**Deferred by design** (revisit at real scale, NOT now): zero-knowledge E2EE sync
relay, blind-signature community gateway. Sound but heavy + premature pre-launch.

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
- `src/components/ui/CelebrationDialog.tsx` — **in-tree overlay, NEVER a `<Modal>`** (see §2 no-Modal rule)
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

## 9. Gemini architecture audit — reconciled against the code (2026-09-02)

Owner fed the old architecture brief to Gemini; it returned two docs
(`Comprehensive App Audit` + `Acceptable Compromise Hybrid Architecture`). I
checked every concrete claim against the source. **Verdict: strategically strong,
factually stale in places.** Treat it as a roadmap, not a bug list.

**Already done — do NOT re-implement (audit was out of date):**
- Composite indices exist: `idx_symptom_logs_user_date`, `idx_check_ins_user_date`,
  `idx_cycle_entries_user_date`, etc. (`src/database/schema.ts`). Audit's "missing
  indices" is wrong.
- `PRAGMA foreign_keys = ON` is set (`src/database/client.ts:251`).
- OTA content seam is more than "dormant": `src/content/remote/` has
  `content-bundle.ts`, `content-updater.ts`, `merged-providers.ts`,
  `remote-content-store.ts` — client scaffolding exists, just no CDN wired.
- Content is **26 lessons / 23 quizzes / 121 questions**, NOT "93 lessons."
- Perimenopause/birth-control already influence the predictor
  (`src/engine/prediction/health-adjustments.ts`) — but there's no dedicated UX mode.

**Real, valid findings (worth doing):**
- **Hardcoded MMKV key** — `storage.ts:61` ships `encryptionKey:
  'dottie-mvp-static-key-rotate-before-prod'`. Should derive a hardware-backed key
  via `expo-secure-store` (Keychain/Keystore).
- **SQLite DB itself is plaintext** — `client.ts` has `ENCRYPTION_ACTIVE = false`;
  the SQLCipher hook is stubbed. The audit's threat model *assumes* SQLCipher that
  isn't on yet. Real gap for post-Roe forensic-seizure claims.
- **No data export/import** — device loss = total data loss (the #1 red-team
  1-star review). No HealthKit/CSV import seam (`grep` finds none) = cold-start
  for Flo switchers.
- **A11y**: fixed heights clip at 200% font scale; glass contrast can dip below
  4.5:1; decorative SVGs need `accessibilityElementsHidden`.
- **Tone**: celebration dialogs (streaks/gems) can fire right after a pain/low-mood
  log — should suppress.
- **Predictor is Gaussian-symmetric** — real cycles are right-skewed; a
  log-normal/skew prior would help PCOS/anovulatory tails. (Nice-to-have, not urgent.)

**Deferred by design (correct to NOT build yet):** zero-knowledge E2EE sync relay,
blind-signature community gateway. Sound long-term, heavy, and premature pre-launch.
Keep local-first as the master authority; revisit at real scale.

**Owner's new feature asks (2026-09-02) — planned, awaiting greenlight:**
1. **"How your next period is predicted" explainer** — a plain-language, scientifically
   grounded card in the empty space under the Sisterhood bridge on the Calendar tab,
   translating the Bayesian model + condition adjustments into simple "here's why these
   dates" copy. Non-diagnostic.
2. **Height/weight capture** — columns ALREADY exist (`weight_kg`,`height_cm` in
   schema + `weightKg`,`heightCm` in `cycle.types.ts`) but nothing collects or reads
   them. Wire an onboarding/profile input. ⚠️ BMI↔cycle link is real but WEAK and
   easily misused — use as *context* in the explainer, not a hard predictor input,
   pending owner decision.
3. **Home day-ring meaning** — the top day-number ring shows a number with no meaning;
   add a short "what this day means" label beside it (phase + one-line significance).

---

*If you're a new Claude session reading this: run `git log --oneline -10 gemini-learn-redesign`
to see the last 10 commits, then check `git status` and jump to §4. Do NOT re-explore
the codebase — it hasn't changed since `e8f1335`.*
