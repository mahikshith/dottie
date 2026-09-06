# Dottie — Claude Code project guide

**Read `docs/HANDOFF.md` FIRST (135 lines) — the open work.** This file is the
stable how-we-work reference. Between the two you have everything; do NOT
re-explore the codebase.

## What Dottie is

React Native + Expo (SDK 52 managed), TypeScript strict, expo-router, Zustand v5,
expo-sqlite + react-native-mmkv. Local-first, privacy-first cycle tracker.
"Mood Aurora": dark aurora ground, glass surfaces, mood-recoloured palette,
non-diagnostic voice throughout.

- **Branch `gemini-v2`.** `main` / `design-v2` frozen (never push to `main`
  except the workflow). Repo `mahikshith/dottie`.
- **Push = APK.** Any push to `gemini-v2` builds one (~25 min). The owner
  installs it by hand, so a broken build costs them a round. Ship small
  batches — DT8–DT14 went to a device together and white-screened.
- **Every commit ends with the Claude co-author + Claude-Session trailer.**

## Before every commit

`npm run test:all` — 32 suites, includes `tsc --noEmit`. Non-zero exit on any
failure. Notable ones:

`validate:content` (lesson `difficulty`, question `level`) · `test:predictor`
(14 scenarios) · `test:dates` (civil-date under 8 timezones — the regression
test for the period-log freeze) · `test:app:tz` (simulated user, 5 timezones)
· `test:fertile` · `test:export` · `test:dialogue` (821 content beats checked
verbatim) · `test:moodmap` · `test:recall` · `audit:ui` · `audit:safearea` · `audit:silent` (rule 18)
· `test:creature` (the C8 block is the anti-insect audit) · `test:quiz` (opens
EVERY lesson's quiz through the real engine — DT22's stuck spinner) ·
`audit:colour` (no phase colour may collide with a mood colour) ·
`test:ranges` (the dated calendar list against the grid it describes, cell for
cell, over 200 random months)

## Rules baked into the code (do not undo)

1. **NON-DIAGNOSTIC copy.** "Many people report", never "your body does X".
2. **Never invent a population statistic.** No cohort exists. Insight speaks
   about the user's OWN history with the sample size attached, and stays
   silent on n=1. Enforced by `test:recall`.
3. **All `YYYY-MM-DD` maths goes through `src/utils/civil-date.ts`.** Never
   local-parse + UTC-serialize — that made `addDay` the identity east of
   Greenwich and froze the app for four rounds. Date loops must be bounded
   and require strict forward progress.
4. **Safe area is not optional.** Every scrolling screen pads BOTH ends;
   `audit:safearea` fails the build otherwise. The status veil in
   `AuroraBackground` is EXACTLY `insets.top`, opaque, **no fade tail** — the
   tail dimmed live content below the status bar and read as the app eating
   the UI (DT16). Content scrolling under the status bar is fine.
5. **No tab scene animation.** `animation: 'none'` in the tabs' screenOptions.
   A cross-fade exposes the layer beneath the outgoing scene and shows as a
   white glitch at the bottom (DT16). The moving glass pill carries the travel.
6. **The root ErrorBoundary must stay OUTERMOST** in `app/_layout.tsx`. React
   unmounts the whole tree on an uncaught render error with no boundary above
   it — a white screen with no message (DT15).
7. **Never import a native module at module scope on the boot path.**
   expo-router requires every file under `app/` at startup, and
   `requireNativeModule()` throws on import. Load them inside functions.
8. **Companions: the drawn rig only** (`src/components/ui/creature/`), via
   `<CompanionLottie type= state= />`. Never a hardcoded emoji, never a Lottie
   character. The `butterfly` key is kept for saved data but draws a DEER.
   **The art is DATA in `geometry.ts`** — one source of truth, rendered to the
   app by `CompanionCreature` and to `docs/companion-preview.html` by
   `scripts/companion-preview.ts`. **Look at the preview before shipping art;
   never redraw blind into a 25-minute APK.** The six things that made these
   read as insects (a full ring of sparkles, wide-set black domes, no neck,
   symmetric dark shapes flanking the midline, stalked nubs above the head,
   perfect bilateral symmetry) are asserted by C8 in `test:creature` — read the
   header of `geometry.ts` before changing a number.
9. **Lessons are the READER; the QUIZ carries the conversation.** The lesson
   chat was reverted (DT16). `src/engine/learn/dialogue.ts`: `leadFor` opens
   each question, `reactTo` answers it. Never says "wrong", explains on right
   AND wrong, openers never repeat back to back, streaks change tone not facts,
   **two attempts then the answer** — a third go is a trap. The retry scores
   the FIRST attempt only (`quiz-engine.submitAnswer` writes once), so a second
   go costs nothing and pays no marks. ONE companion per panel: the reaction
   rig is the voice, there is no second face with its own phrase pool. Every
   factual sentence is verbatim curriculum — `test:dialogue` enforces it.
10. **Never use a React Native `<Modal>`.** A translucent Modal is a separate
   Android window that can stick over every screen. Use `CelebrationDialog` /
   `showAppDialog()`. Keep `grep -rn "<Modal" src app` empty.
11. **Zustand v5 selectors returning fresh arrays/objects** trip
   `useSyncExternalStore` → infinite loop. Cache at module level or `useMemo`.
12. **Validate at the repository boundary.** Single-statement upserts, never
   SELECT-then-INSERT (a double-tap raced it). Read-side engines drop unusable
   data rather than throwing.
13. **Every write needs an undo.** Tapping a logged period day un-marks it.
   After a removal, cycle records are REBUILT from entries, never patched.
14. **No empty shells.** A feature with no data shows one honest line, never a
   chart-shaped skeleton. A collapsed panel's closed state carries real data.
15. **Never draw a fertile window without its caveat.** `NOT_CONTRACEPTION` in
   `src/engine/calendar/fertile-window.ts` is the ONE wording — import it,
   never paraphrase. A logged period day always beats a fertile mark.
16. **The prediction explainer must never render nothing.** It recomputes when
   the store's copy is missing; its three figures draw in both states.
17. **One calendar.** Sisters' days are logged on `/(tabs)/calendar?logFor=`.
   No second date picker anywhere.
18. **Never `if (__DEV__) console.warn` in a catch** — `__DEV__` is false in
   the owner's build, so that is silence. Use `logSilentFailure(code, err)`.
   Enforced by `audit:silent`, which now catches the BLOCK form too
   (`if (__DEV__) {\n console.warn(...)`) — that spelling slipped past for four
   rounds and hid the hydration failure behind DT22's stuck quiz spinner.
19. **Walkthrough is opt-in only.** No auto-launch.
20. **Aurora ground `#0C0A16`** wherever the app can flash. `NAV_THEME` in
   `app/_layout.tsx` forces every navigator surface to it.
21. **No `experimentalBlurMethod="dimezisBlurView"`** over a heavy view tree —
   it snapshots per frame and ANRs on Android.
22. **Never a React Native `<Switch>`.** Its Android track tinted with a glass
   edge is a ~10% white hairline on a near-black card: the track vanishes and
   the control reads as a bullet, not a toggle (DT21). Use `AuroraSwitch`
   (`surface="light"` on the one cream screen, Ghost Mode). Keep
   `grep -rn "<Switch" src app` empty.
23. **A row that toggles something is tappable across its whole width**, and
   never under 48pt tall. DT21's "sometimes it may open, it may not" was a
   40pt row with an 18pt caret as its only visible affordance.
24. **Never `presentation: 'modal'`.** On Android that screen's safe-area
   insets read ZERO, so its padding silently does nothing — the add-to-circle
   CTA under the nav bar and the check-in title through the status bar were
   both this, for four rounds, while `audit:safearea` read the (correct)
   padding expression and passed. Use `SHEET_PRESENTATION`
   (`src/constants/navigation.ts`): modal on iOS, card on Android, same
   slide-from-bottom. Enforced by `audit:safearea`.
25. **Phase colours must clear the mood set, AND be drawn opaque.** Every
   colour in every mood palette is compared against every phase colour in
   CIELAB by `audit:colour`: ≥ ΔE 18 from any mood colour, ≥ ΔE 40 between
   phases. DT22 found THREE phase colours byte-identical to a palette accent.
   Then DT23 found the deeper bug: the grid drew them at 14% alpha over a
   drifting aurora bloom, so the audit measured the token and the eye saw the
   composite. Calendar marks are composited over the ground in
   `src/theme/blend.ts` and drawn OPAQUE; ink comes from `inkOn(fill)`, never
   assumed. Never put a data mark on an 8-hex alpha over the aurora.
26. **A logged day and an estimate must never look the same.** `PHASE_CELL`
   and `LOGGED_PERIOD_CELL` are held ≥ ΔE 20 apart by `audit:colour`. They
   were the same rose, so marking one day painted the whole estimated bleed
   in identical solid discs and the owner reported one tap "locking the entire
   week" (DT24). Facts are solid; every estimate is a composite.
27. **A DISPLAY stops at `PHASE_DISPLAY_GRACE_DAYS`.** `calculateCurrentPhase`
   extends the last phase forever past the expected cycle — right for the
   predictor (a late period is late), a lie for a grid (one old anchor painted
   every month solid luteal, DT24). Anything drawing a phase checks
   `daysPastExpected` and draws NOTHING past the grace, with a line saying
   why. `test:phase` pins both halves.
28. **When two marks land on one day, both stay visible.** The ovulation day
   keeps the fertile fill it sits inside and is identified by a ring and a pip
   — shape for the single day, colour for the span (DT24). Where a shape
   carries the identity, `audit:colour` checks the shape is legible on its
   fill instead of checking two fills apart.
29. **Never ask for something the app already has today.** The question deck
   takes `knownMetricsToday` and drops any question tracking a metric the
   check-in already holds — Home showed five mood keys and then asked the same
   question again underneath (DT23).
30. **One condition, one icon.** `src/content/conditions.ts` is the single
   list, shared by onboarding and add-to-circle, and `validate:content` R5
   fails on a shared icon or label. It was grouped by prediction FAMILY, which
   is how the model thinks and the opposite of how a person scans a list.
   Its `affectsPrediction` flag is what the transparency panel and the export
   read — a condition the engine ignores must say so.
31. **The prediction disclosure must match the model.**
   `src/engine/prediction/what-we-use.ts` is the ONE description of the
   forecast's inputs, rendered under the calendar (yours and a sister's) and
   as a sheet in the export. It lists what is NOT used too — height, weight,
   activity, mood — because a disclosure that only lists the flattering half
   is an advertisement. `test:transparency` pins it to the code.
32. **A companion is a voice, a face and a body — not a colour.**
   `src/engine/learn/companion-voice.ts` gives each of the six its own quiz
   lines, its own expression per beat, its own idle motion and its own streak
   threshold. Pass `companion` to `leadFor`/`reactTo`. The FACTS never vary —
   the explanation is verbatim curriculum whoever is speaking (rule 9), and
   `test:dialogue` D9 asserts both halves.
33. **The calendar decides what a day IS exactly once.**
   `src/engine/calendar/day-marks.ts` — `dayMark()` resolves the precedence
   (logged > predicted > ovulation > fertile > phase > unknown) and the THREE
   renderers consume it: the grid cell paints by it, the dated list under the
   toggle groups by it, the accessibility label speaks it. The owner's
   condition for the dated list was "never, ever add contradictory information
   from the visual calendar and what we are showing below" — a second
   precedence chain anywhere is that contradiction waiting to happen, and
   `test:ranges` fails on one. The list's swatches are the grid's own colours,
   its labels are the legend chips verbatim, and every non-logged row is
   badged ESTIMATED.

## Design system (never hardcode ad-hoc values)

- `src/theme/aurora-static.ts` → `A.*` (ground `#0C0A16`, ink/ink2/ink3,
  glass/glass2/edge, accent `#54E6C8`, accent2, gold, rose, success, error).
- `useAurora()` → `{ palette }` (mood-driven). `PHASE_AURORA[phase]`.
- Shadows are WARM (`#B48264`) · 4px spacing grid · typography preset ramp.
- Primitives in `src/components/ui/`: `AuroraBackground`, `AuroraTabBar`,
  `GlassCard`, `PressableScale` (the standard press for ANY tappable),
  `AuroraSwitch` (the ONLY on/off control — a visible channel with a knob that
  travels, never a colour fill), `GradientButton`,
  `CompanionLottie`, `CompanionExpressions` (ONE companion cycling its moods —
  never a row of copies).

## Conventions

TypeScript strict, no `any`, no `as any`. Inline components return
`: JSX.Element`. `expo-linear-gradient` colors must be a tuple (`as const`).
Heavy top-of-file comments explaining WHY; section dividers `// ─── X ───`.
Don't add dependencies casually. Don't change screens unless asked.
Haptics: `selectionAsync` light, `impactAsync(Light)` important,
`notificationAsync` celebrations. All tappables get accessibility props.

## Content

77 lessons / 74 quizzes / 427 questions. 51 imported by
`npx tsx scripts/import-curriculum.ts` → `src/content/curriculum.generated.ts`.
**Never hand-edit the generated file** — edit the JSON or the importer.
Hand-written content goes in `learning-paths.ts` / `quizzes.ts`.

## Session start

1. Read `docs/HANDOFF.md` §1 — the open work.
2. `git log --oneline -5` and `git status`.
3. Do NOT re-explore the codebase. Before every commit: `npm run test:all`.
