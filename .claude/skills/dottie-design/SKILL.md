---
name: dottie-design
description: Build or change any Dottie screen, component or colour — the Mood Aurora tokens, the primitives to use (and the RN components that are banned), the safe-area and colour laws, and the audits that fail the build. Use when adding a screen, restyling one, picking a colour, adding a toggle/dialog/reaction, or fixing a device-round UI report.
---

# Building UI in Dottie

Read `docs/DESIGN.md` for the full system and `docs/SCREENS.md` for what already
exists. This skill is the short version you act on.

## The one sentence

**Mood owns the atmosphere; phase owns the data.** Log a mood and the ground,
bloom, accents and ink recolour. The four phase colours and every calendar mark
never move, because a phase that changes colour with a mood is a chart that
lies.

## Never hardcode

| Need | Take it from |
|---|---|
| a colour | `A.*` (`src/theme/aurora-static.ts`) for utility screens, `useAurora().palette` for mood-reactive ones, `PHASE_AURORA[phase]` for cycle data |
| a calendar fill | `src/theme/blend.ts` — already composited over the ground, drawn OPAQUE, ink from `inkOn(fill)` |
| a font size | `Typography.preset.*` |
| a gap / padding / radius | `Spacing.*`, `Spacing.radius.*` (4px grid) |
| a shadow | `Shadows.*` — WARM `#B48264`, never black |

A hex literal in a component is a bug. So is `fontSize: 15`.

## Use these, never those

- `AuroraBackground` — not a `View` with a background. It owns the ground, the
  bloom, and the opaque status veil of exactly `insets.top` (no fade tail).
- `PressableScale` — not `TouchableOpacity`. Every tappable.
- `AuroraSwitch` — **never** RN `<Switch>` (rule 22). Keep
  `grep -rn "<Switch" src app` empty.
- `showAppDialog()` / `CelebrationDialog` — **never** RN `<Modal>` (rule 10).
  Keep `grep -rn "<Modal" src app` empty.
- `MoodEmoji` — **never** a drawn character or a Lottie character (rule 8). One
  emoji, one mark per panel, never a second face beside it.
- `SHEET_PRESENTATION` — **never** `presentation: 'modal'` (rule 24). On
  Android that screen's insets read ZERO and its padding silently does nothing.
- `GlassCard`, `GradientButton` / `ClayButton` / `GradientFab`, `BreathingView`,
  `PopOnChange`, `GlowRing` for everything else.

## Laws that have each cost a device round

1. **Both ends padded.** `insets.top + Spacing.lg` and
   `insets.bottom + Spacing.tabBarClearance` on every scrolling screen.
2. **A row that toggles is full-width tappable and ≥ 48pt tall.**
3. **A fact is solid; an estimate is a wash.** Logged days and estimates stay
   ≥ ΔE 20 apart, and two marks on one day both stay visible (shape for the
   day, colour for the span).
4. **No empty shells.** No data → one honest line, never a chart skeleton.
5. **Non-diagnostic copy**, no invented statistics, and the fertile window
   never appears without `NOT_CONTRACEPTION` verbatim.
6. **Motion:** UI thread only, respect Reduce Motion, no tab scene animation,
   no `dimezisBlurView` over a heavy tree, and either a visible amplitude or
   none at all.
7. **Errors are never silent** — `logSilentFailure(code, err)`, never
   `if (__DEV__) console.warn` in a catch.

## Before you commit

`npm run test:all` (34 suites). The four that catch UI mistakes:
`audit:safearea` · `audit:colour` · `audit:ui` · `audit:silent`.
Then: small batches — **a push to `gemini-v2` builds a ~25-minute APK the owner
installs by hand**, so a broken build costs them a round.

## When you cannot see it

There is no simulator here. Anything visual that can be rendered outside the
app (geometry, charts, a colour set) should be rendered to HTML and
screenshotted with Chromium before shipping — reasoning about pixels in a
25-minute build loop is how the same complaint comes back four rounds running.
