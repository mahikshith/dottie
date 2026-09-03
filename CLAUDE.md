# Dottie — Claude Code project guide

**Auto-loaded every session. Read `docs/HANDOFF.md` FIRST — it has the live status,
the current branch, the recent commit log, and the open TODO. This file is the
stable how-we-work reference; keep it short so a new session doesn't burn 25% of
its budget on rediscovery.**

## Where the work is

- **Active branch: `gemini-v2`** (audit-driven build phase — prediction
  explainer, security, motion, etc; branched off `gemini-learn-redesign`).
  `gemini-learn-redesign` is the prior stable checkpoint; `design-v2` and
  `main` are frozen. Never push to `main` except the workflow file.
  ⚠️ **CI does NOT build APKs for `gemini-v2` yet** — the workflow on `main`
  only triggers on `design-v2` / `gemini-learn-redesign`. To device-test
  `gemini-v2`, add it (ideally a `gemini-**` wildcard) to the workflow's
  `push.branches` on `main` — needs explicit owner OK (a `main` change).
- **Repo:** `mahikshith/dottie`. Owner: `mahikshith97@gmail.com`. Owner's phone:
  **Nothing Phone (Android)** — NOT MIUI/Xiaomi.
- **What's built:** the Learn tab redesign (Phases 0–4 shipped) sits on top of a
  complete cycle-tracker MVP (predictor, calendar, sisterhood, ghost mode,
  onboarding, walkthrough). Every phase and fix is enumerated in HANDOFF §3.

## What Dottie is

React Native + Expo (SDK 52 managed), TypeScript strict, expo-router, Zustand v5,
expo-sqlite + react-native-mmkv, local-first, privacy-first. "Mood Aurora" design
language: dark aurora backgrounds, glass surfaces, warm mood-recolored palette,
non-diagnostic voice throughout.

## Environment + workflow

- **Node available** (v22). `npx tsc --noEmit` must be exit 0 before every commit.
- **On-device runtime = GitHub Actions APK.** Push to `gemini-learn-redesign`
  without `[skip ci]` → builds a release APK. With `[skip ci]` → back-up only.
  Owner downloads it via the GitHub mobile app (Actions → run → Artifacts card).
- **`main` had no workflow before this session** — added it there so
  `workflow_dispatch` works. Don't touch `main` for anything else.
- **Every commit ends with the Claude co-author + Claude-Session trailer.**

## Test scripts (all must stay green — CI runs `test:all`)

- `npm run type-check` — `tsc --noEmit`
- `npm run validate:content` — schema R1–R4 (lessons + quizzes)
- `npm run test:adaptive` — Phase 3 quiz engine, 17 invariants
- `npm run test:rhythm` — Phase 4 rhythm layer, 22 invariants
- `npm run test:predictor` — 14 real-user predictor scenarios, ~60 assertions
- `npm run test:journey` — 10 pure-engine end-to-end journeys
- `npm run audit:ui` — every Pressable/Button/GradientButton has onPress (154 tappables)
- `npm run test:all` — runs all of the above, non-zero exit on any failure
- `npm run simulate` — non-assertive eyeball predictor simulation

## Design system (never hardcode ad-hoc values)

- **Aurora tokens (design-v2):** `src/theme/aurora-static.ts` exports `A.*`
  (ground `#0C0A16`, ink/ink2/ink3, glass/glass2/edge, accent `#54E6C8`, accent2,
  gold, rose, success, error). Use `A.ground` for anything that could flash on
  Android (splash, nav bar, Stack `contentStyle`, tabs root View).
- **Palette hooks:** `useAurora()` returns `{ palette }` (mood-driven). Reads
  `palette.ink/ink2/ink3`, `palette.glass.*`, `palette.accent/accent2`,
  `palette.ground`, `PHASE_AURORA[phase]`.
- **Warm palette (legacy `Colors.*`):** used ONLY by Ghost Mode's Garden Notes
  disguise and a few unthemed screens. New work uses aurora tokens.
- **Shadows are WARM** (`#B48264`, never grey) — `src/constants/shadows.ts`.
- **Spacing 4px grid + radius scale** — `src/constants/spacing.ts`.
- **Typography preset ramp** — `src/constants/typography.ts`.

## Shared UI primitives (`src/components/ui/`)

Reanimated-backed, UI thread, 60fps, Reduce-Motion aware.
- `AuroraBackground`, `AuroraTabBar` (liquid-glass BlurView + moving pill),
  `GlassCard`, `ClayButton`, `GlowRing`
- `PressableScale` — the standard spring-press for ANY tappable. If the handler
  already fires a haptic, pass `haptic="none"`.
- `GradientButton`, `GradientFab`, `BreathingView`, `PopOnChange`,
  `CompanionLottie` (art with emoji fallback — never hardcode a companion emoji)
- **`CelebrationDialog` / `showAppDialog()` global API.** NEVER use a React
  Native `<Modal>` for this (or any) overlay. A transparent/translucent Modal is
  a separate Android OS window that can get stuck floating over every screen —
  that was the persistent white-circle-at-top-left bug that plagued 5 device
  tests. It is now an in-tree absolutely-positioned overlay at the app root that
  returns null when hidden (fixed for real in `21d5432`; `e8f1335` was the wrong
  diagnosis). Keep `grep -rn "<Modal" src app` empty.

## Rules baked into the code (do not undo)

1. **NON-DIAGNOSTIC copy** everywhere. "Many people report", not "your body
   does X." No wellness claims. Doctor-report-signals discipline.
2. **Every quiz question with id `q_*` must have `level`**; every imported
   lesson must have `difficulty`. `validate:content` enforces R1/R2/R3/R4.
3. **Aurora ground `#0C0A16`** wherever the app can flash. No cream flashes.
4. **Zustand v5 selectors returning fresh arrays/objects** trip
   `useSyncExternalStore` → infinite loop. Cache at module level or use
   `useMemo`.
5. **Walkthrough is opt-in only** — no auto-launch. Restart via Profile →
   "Show me around again". Overlay hard-guards on `Storage.walkthroughSeen`.
6. **Bottom tab bar is a floating pill** — never a solid rectangle.
7. **Notifications: `checkNotificationPermission()` is silent** (used by
   `syncAllReminders`); `requestNotificationPermission()` prompts and must be
   called ONLY from an explicit user tap.
8. **Companion Lottie via `<CompanionLottie type=... state=... />`** — never
   hardcode emoji.

## Conventions

- TypeScript strict, **no `any`**, no `as any` to silence errors.
- New inline components: return type `: JSX.Element` (not `React.JSX.Element`).
- expo-linear-gradient `colors` must be a **tuple** (`as const`), not `string[]`.
- Heavy top-of-file comments explaining WHY (design, integration points, perf).
  Section dividers `// ─── SECTION ───`. Explain why, not what.
- Don't add dependencies casually. Don't change screens unless asked.
- Haptics: `selectionAsync` on light taps, `impactAsync(Light)` on important,
  `notificationAsync` on celebrations. All tappables get accessibility props.

## Learn redesign phase state (Gemini Master Spec)

All four phases + Phase 0 schema hardening are shipped on `gemini-learn-redesign`.
Phase-by-phase file map + commit hashes are in `docs/HANDOFF.md §3`. Corpus:
26 lessons / 23 quizzes / 121 questions. If the owner asks for more content,
add paths to `learning-paths.ts` + quizzes to `quizzes.ts` (both need
`difficulty` on lessons and `level` on questions or the validator fails).

## Companion docs (pull only when a section names them)

- `docs/FEATURES-AND-RESEARCH.md` — predictor math, aurora system, feature research
- `docs/DAY-SUGGESTIONS.md` — sub-phase engine v2 + competitor scan
- `docs/ONBOARDING-AND-WALKTHROUGH.md` — tour audit + design
- `docs/DEVICE-TEST-3.md` — earlier device-test round
- `docs/LEARN-REDESIGN-*.md` — external Gemini research
- `docs/PREDICTION-EXPLAINER-PLAN.md` — approved next-build plan (B1): dynamic
  prediction explainer + home day-ring meaning + height/weight
- `docs/CONTENT-UPDATES.md` — OTA content pipeline (dormant)
- `docs/BETA-TESTING-GUIDE.md` — beta testing groundwork
- `docs/LOTTIE-SOURCING.md` — companion art pipeline
- `docs/SESSION-CONTEXT.md` — original project brief

## Session-start checklist for the NEXT Claude

1. Read `docs/HANDOFF.md` (has the live status + open TODO).
2. `git log --oneline -10 gemini-learn-redesign` (see recent commits).
3. `git status` (see local work-tree state).
4. Do NOT re-explore the codebase. Jump straight to the TODO items in HANDOFF §4.
5. Every commit → `npx tsc --noEmit` + `npm run test:adaptive` + `npm run
   test:rhythm` + `npm run validate:content` before pushing.

If the user asks for help or wants to give feedback:
- `/help` for Claude Code help
- File issues at https://github.com/anthropics/claude-code/issues
