# Dottie — Claude Code project guide

**Auto-loaded every session. Read `docs/HANDOFF.md` FIRST (137 lines) — live
status, the one open P0, and the jump table. This file is the stable how-we-work
reference. Between the two you have everything; do NOT re-explore the codebase.**

## Where the work is

- **Active branch: `gemini-v2`** (audit-driven build phase — prediction
  explainer, security, motion, etc; branched off `gemini-learn-redesign`).
  `gemini-learn-redesign` is the prior stable checkpoint; `design-v2` and
  `main` are frozen. Never push to `main` except the workflow file.
  **CI builds APKs for `gemini-v2`** — the workflow (on `gemini-v2` and mirrored
  on `main`) triggers on a `gemini-**` wildcard, so every gemini branch builds
  on push. Owner may ask to HOLD pushes and do a single final push later.
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
- **On-device runtime = GitHub Actions APK.** Push to `gemini-v2` without
  `[skip ci]` → builds a release APK. `[skip ci]` on the TIP commit skips the
  whole push, so keep a code commit last. Owner downloads it via the GitHub
  mobile app (Actions → run → Artifacts card).
- **Every commit ends with the Claude co-author + Claude-Session trailer.**

## Test scripts (all must stay green — CI runs `test:all`)

- `npm run type-check` — `tsc --noEmit`
- `npm run validate:content` — schema R1–R4 (lessons + quizzes)
- `npm run test:adaptive` — Phase 3 quiz engine, 17 invariants
- `npm run test:rhythm` — Phase 4 rhythm layer, 22 invariants
- `npm run test:predictor` — 14 real-user predictor scenarios, ~60 assertions
- `npm run test:journey` — 10 pure-engine end-to-end journeys
- `npm run test:charts` — explainer figure data, 12 invariants
- `npm run test:dates` — civil-date arithmetic re-run under 8 timezones (the
  regression test for the period-log freeze; a UTC-only run would not catch it)
- `npm run test:nudges` — encouragement pool: rotation + tone
- `npm run test:overlap` — user/sister cycle-window overlap + no-synchrony tone
- `npm run test:liquid` — mood-reveal blob geometry; proves the wash covers every
  screen corner at full extent (a gap flashes the OLD palette on commit)
- `npm run test:moodmap` — mood heatmap: a gap is never painted as a zero, and
  the distribution divides by LOGGED days not calendar days
- `npm run test:recall` — symptom recall; asserts the copy never claims a
  population statistic and always carries its sample size
- `npm run test:app` — SIMULATED USER: drives the real stores + SQLite repos
  through onboarding → logging → sisterhood → quizzes → deletion, with a
  per-step watchdog so a freeze is reported instead of hanging the run
- `npm run test:app:tz` — the same journey in 5 timezones (what `test:all` runs)
- `npm run test:sister` / `test:blocks` / `test:dedupe` / `test:diag` / `test:creature`
- `npm run audit:ui` — every Pressable/Button/GradientButton has onPress (167 tappables)
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
6. **Bottom tab bar is a floating pill** — never a solid rectangle. Its scene
   transition lives in `src/components/ui/aurora/tabSceneTransition.ts`:
   cross-fade + 18px drift, 170ms, native driver. Never make it a real slide
   (tabs are peers), and never put `animation:` back into the tabs'
   `screenOptions` — its absence is what keeps the outgoing screen alive to
   fade (`DEVICE-TEST-11.md`). The mood reveal is the opposite case and DOES get
   a liquid SVG path (`src/theme/liquid-reveal.ts`) — it is an opaque overlay,
   not a live screen, and it fires once a day rather than 100+ times.
7. **Notifications: `checkNotificationPermission()` is silent** (used by
   `syncAllReminders`); `requestNotificationPermission()` prompts and must be
   called ONLY from an explicit user tap.
8. **The companion is ALWAYS the SVG rig** (`CompanionCreature`), via
   `<CompanionLottie type=... state=... />`. Never hardcode emoji, and never
   route a state back to a Lottie character file: `idle` used to do that, and a
   mood change then swapped the drawing for a different-looking animal
   (`DEVICE-TEST-8.md` §1). Lottie is for MOMENT overlays only (confetti,
   mind-blown, hug), drawn as a corner badge, never over the face. One character
   per screen — no emoji reaction badges beside it.
9. **No `experimentalBlurMethod="dimezisBlurView"`** on anything overlaying a
   heavy view tree — it snapshots the whole tree per frame and ANRs on Android.
10. **Safe area is not optional.** Every scroll screen pads
   `insets.top + Spacing.lg` and `insets.bottom + Spacing.tabBarClearance`.
   `AuroraBackground` paints a GRADIENT status veil — never restore the opaque
   block, it reads as the app eating the heading.
11. **All date maths on `YYYY-MM-DD` goes through `src/utils/civil-date.ts`.**
   Never write `new Date(`${d}T00:00:00`)` + `.toISOString()` — local in, UTC
   out makes `addDay` the identity function east of Greenwich, which is what
   froze the app for four device-test rounds (`DEVICE-TEST-7.md` §8). Any loop
   walking dates must be bounded and require strict forward progress.
12. **Never let React Navigation use a light theme.** `NAV_THEME` in
   `app/_layout.tsx` forces every navigator surface to the aurora ground; the
   default light container was the one-frame white flash on tab switches that
   survived several rounds of `contentStyle`/`sceneStyle` fixes.
13. **Validate at the repository boundary.** `upsertCycleEntry` rejects
   malformed dates and clamps flow levels; writes are single-statement upserts,
   never SELECT-then-INSERT (a double-tap raced it). Read-side engines drop
   unusable dates rather than throwing, so a phone with bad data can still open
   its calendar.
14. **Never `if (__DEV__) console.warn` in a catch.** `__DEV__` is false in the
   build the owner tests, so that is silence. Use `logSilentFailure(code, err)`
   — it lands in the shareable diagnostic trail.
15. **Every write needs an undo.** Period days toggle: tapping a logged day
   un-marks it (`unlogPeriodDay`), for the user and for sisters. After a removal
   cycle records are REBUILT from the entries, never patched. If you add a
   harness step that writes something, add the one that removes it — DT9 missed
   the missing undo entirely because it only ever added.
16. **One calendar.** Sisters' period days are logged on `/(tabs)/calendar`
   (`?logFor=<memberId>`). Do not add a second date picker anywhere.
17. **Never invent a population statistic.** Dottie is local-first with no
   cohort, so "68% of people report X" would be fabricated — the same fault as
   the "You & 12,363 others" counters removed in DT6. Insight speaks about the
   USER'S OWN logged history with the sample size attached, and stays silent on
   a single occurrence. Enforced by `test:recall`, not just by review.
18. **The prediction explainer must never render nothing.** It recomputes the
   explanation itself when the store's copy is missing, and its three figures
   draw in both states. Owner requirement: mandatory, at any cost.

## Conventions

- TypeScript strict, **no `any`**, no `as any` to silence errors.
- New inline components: return type `: JSX.Element` (not `React.JSX.Element`).
- expo-linear-gradient `colors` must be a **tuple** (`as const`), not `string[]`.
- Heavy top-of-file comments explaining WHY (design, integration points, perf).
  Section dividers `// ─── SECTION ───`. Explain why, not what.
- Don't add dependencies casually. Don't change screens unless asked.
- Haptics: `selectionAsync` on light taps, `impactAsync(Light)` on important,
  `notificationAsync` on celebrations. All tappables get accessibility props.

## Learn redesign phase state

Phases 0–4 all shipped. Corpus: 26 lessons / 23 quizzes / 121 questions. More
content = paths in `learning-paths.ts` + quizzes in `quizzes.ts` (lessons need
`difficulty`, questions need `level`, or `validate:content` fails).

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

1. Read `docs/HANDOFF.md` — live status + the one open P0.
2. `git log --oneline -8` and `git status`.
3. Jump straight to HANDOFF §1. Do NOT re-explore the codebase.
4. Before every commit: `npm run test:all` (it includes `tsc --noEmit`).

If the user asks for help or wants to give feedback:
- `/help` for Claude Code help
- File issues at https://github.com/anthropics/claude-code/issues
