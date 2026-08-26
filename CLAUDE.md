# Dottie — Claude Code project guide

Auto-loaded every session. **Read `docs/HANDOFF.md` first** — it is the live status
log (what's done, what's next, decisions). For the *complete picture* of features +
algorithms (the Bayesian predictor math, the two new engine features, the aurora
system, and the research), read **`docs/FEATURES-AND-RESEARCH.md`**. This file is the
stable how-we-work guide.

## Engine/feature state (design-v2, ⚠️ UNVERIFIED — no Node here)
- **Predictor v2** = a REAL Bayesian model (Normal-Inverse-Gamma → Student-t, on-device,
  closed-form): `src/engine/prediction/bayesian-predictor.ts` + rewritten `predictor.ts`
  (same public API). Replaces the old heuristic. Math in `docs/FEATURES-AND-RESEARCH.md §1`.
- **Symptom↔cycle correlation insights** — additive to Dottie Predicts
  (`src/engine/predicts/symptom-correlations.ts` + new insight kind). Non-diagnostic.
- **Condition-pattern flags** — in the DOCTOR REPORT only
  (`src/engine/reports/condition-signals.ts`), NON-diagnostic "worth mentioning". Never home feed.

## What Dottie is
A warm, local-first women's-health / cycle-tracking companion. React Native + Expo
(managed), TypeScript strict, expo-router, Zustand stores, expo-sqlite + MMKV.
"Warm Geometric" design language. 12-chunk MVP is complete; currently in a UI/UX
premium-polish phase.

## ⚠️ Environment constraints (READ THIS)
- Built on a **corporate laptop with NO Node.js/npm** and restricted installs. Only
  `git` is available. **You cannot run, build, `tsc`, lint, or launch the app here.**
- So **all code is written statically and is UNVERIFIED at runtime** until the user
  gets to a Node-capable machine. Reason carefully; prefer changes verifiable by reading.
- Do NOT assume `npm install`/`npx`/`eas` work — confirm with the user first.
- `react-native-mmkv` can't run in Expo Go (needs an EAS dev build). `assets/` (icon/
  splash) referenced by `app.json` is currently missing.

## Repo
- GitHub: `https://github.com/mahikshith/dottie` (this `code/` folder is the repo root).
- Branch `main`. Commit only when asked. Owner email `mahikshith97@gmail.com`.

## Design system (use these tokens — never hardcode ad-hoc values)
- `src/constants/colors.ts` — cream `#FFF8F2`, coral `#FF6B6B`, peach `#FFA07A`; phases:
  menstrual `#E88EA0`, follicular `#7ECFB3`, ovulatory `#F4A261`, luteal `#9B8FD4` (each
  has `.light`, `.gradient`, `.primary`). Text `#2D1B12`/`#6B5344`/`#9B8B80`.
- Shadows are **warm** (`#B48264`, never grey) — `src/constants/shadows.ts`.
- `spacing.ts` (4px grid + radius scale), `typography.ts` (preset ramp).

## Shared UI primitives — `src/components/ui/` (prefer these)
Reanimated-backed (UI thread, 60fps), Reduce-Motion aware:
- `PressableScale` — the standard spring-press + haptic for ANY tappable surface. If the
  onPress handler already fires a haptic, pass `haptic="none"`. Does NOT auto-dim disabled.
- `GradientButton` — coral→peach primary CTA pill (`loading`/`disabled` states; pass only
  margin/width via `style`, never height/bg). Dims itself only when `disabled && !loading`.
- `GradientFab` — the shared floating "+" (Community/Sisterhood).
- `BreathingView` — gentle breathe for hero companion emojis.
- `PopOnChange` — pop a changing number (streak/gems/counters).
- Entrance motion: `<Animated.View entering={FadeInDown.duration(480).delay(d).springify().damping(16)}>`.
- Safe-area: `useSafeAreaInsets()` (works via React Navigation's provider — no root provider added).
- Two-view shadow/clip trick for rounded gradient surfaces (iOS can't clip + shadow on one view).

## Conventions (from the project's working agreements)
- TypeScript strict, **no `any`**, no `as any` to silence errors — fix the type.
- New inline components: return type `: JSX.Element` (NOT `React.JSX.Element` unless React
  is imported — @types/react is pinned to 18.3, global JSX namespace exists).
- expo-linear-gradient `colors` must be a **tuple** (`as const` / `readonly [string,string]`),
  not `string[]` (SDK 52).
- Heavy top-of-file block comments explaining WHY (design, integration points, perf); section
  dividers `// ─── SECTION ───`. Explain why, not what.
- Don't add dependencies casually. Don't change screens unless asked (regression risk — and
  we can't test). Don't bump schema version for additive tables (use `ensureTables()`).
- Haptics: `selectionAsync` on light taps, `impactAsync(Light)` on important, `notificationAsync`
  on celebrations. All tappables get `accessibilityRole`/`Label`/`State`.

## Current design direction — "Mood Aurora" (on the `design-v2` branch)
A bold from-scratch visual world being built on **`design-v2`** (NOT `main`): the cycle as a
luminous night sky — **glassmorphism + claymorphism + aurora-mesh + grain**, a glowing cycle
ring, a fluid glass tab bar. **The signature idea: the logged mood recolours the whole UI.**
Default = Nocturne violet; each mood → a supportive palette (low/rough stay WARM & soothing,
never grey — apple-design *Responsibility*). Visual mockups are published Artifacts (links in
`docs/HANDOFF.md`).

**Emil Kowalski's skills are vendored at `.claude/skills/`** (MIT). Before writing ANY motion,
read `.claude/skills/animate-expo` — it has the exact Reanimated recipes for our stack.

**Aurora theme system (design-v2, statically written, ⚠️ UNVERIFIED — no device here):**
- `src/theme/` — `palettes.ts` (5 mood palette token sets + `PHASE_AURORA`), `mood-palette.ts`
  (`paletteForMood(score)`), `ThemeProvider.tsx` (`AuroraProvider` + `useAurora()`), barrel.
- `src/components/ui/aurora/` — `AuroraBackground`, `GlassCard`, `ClayButton`, `GlowRing`,
  `AuroraTabBar` (all read palette tokens via `useAurora()`). Exported from `src/components/ui`.
- **Needs on a Node machine:** `expo-blur` (real frosted glass — GlassCard currently degrades to
  a translucent panel), then wire `AuroraProvider` at the root + drive `applyMood(moodScore)`
  from the check-in, plug in `AuroraTabBar`, and apply screen-by-screen. All UNVERIFIED until run.

Community & Sisterhood are treated as complete local features — **no "preview" banners**.
