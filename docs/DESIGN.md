# Dottie — the design system

**What the app looks like, why, and the rules that keep it that way.**
Companion doc: `docs/SCREENS.md` (every screen, one by one).
Every value here is read from the code, not from memory — the file that owns
each one is named so there is never a second copy to drift.

---

## 1. The idea: Mood Aurora

A cycle tracker is opened on the worst day of the month as often as the best.
So the interface is built on two ideas held together:

1. **A dark, calm ground with light glass on top.** Nothing glares at 2am, and
   the near-black ground (`#0C0A16`) is what every screen falls back to, so the
   app can never flash white between screens.
2. **The atmosphere follows the person; the data does not.** Log a mood and the
   whole app recolours — the aurora bloom, the accents, the ink. But the
   *cycle* colours (the four phases, the calendar marks) never move, because a
   phase that changes colour with your mood is a chart that lies.

> **Mood owns the atmosphere. Phase owns the data.** That single sentence
> resolves most colour questions in this app.

---

## 2. Ground and surfaces

`src/theme/aurora-static.ts` → imported as `A.*`. Use these on any screen that
does not need per-mood recolouring (onboarding, deep flows, reports, security).

| Token | Value | What it is |
|---|---|---|
| `A.ground` | `#0C0A16` | The ground. Every navigator surface is forced to it (`NAV_THEME` in `app/_layout.tsx`) so a transition can never show white. |
| `A.ground2` | `#120E20` | One step up — sheets, raised sections. |
| `A.glass` | `rgba(255,255,255,0.06)` | The standard card fill. |
| `A.glass2` | `rgba(255,255,255,0.09)` | A card ON a card. |
| `A.edge` | `rgba(255,255,255,0.14)` | The 1px hairline that makes glass read as a surface. |
| `A.edgeBright` | `rgba(255,255,255,0.28)` | The lit top edge, and focus. |
| `A.ink` / `ink2` / `ink3` | `#F3EEFF` / `#B8AED6` / `#8B82A8` | Primary / secondary / tertiary text. |
| `A.accent` | `#54E6C8` | The default action colour (mint). |
| `A.accent2` | `#9B7BFF` | The second voice (violet). |
| `A.gold` `A.rose` | `#FFC24D` `#FF6FA5` | Highlight and warmth. |
| `A.success` `A.error` | `#6FE6A8` `#FF7A8A` | Never raw green/red — both are tinted toward the aurora so a warning never feels like an alarm. |

**Glass is a recipe, not a colour:** `backgroundColor: glass.bg` +
`borderWidth: 1` + `borderColor: glass.edge` + a large radius. `GlassCard`
does it for you; do it by hand only when the card has to animate its own fill.

---

## 3. The five mood palettes

`src/theme/palettes.ts` · reached through `useAurora()` → `{ palette }`.
One palette per mood answer, `nocturne` before anything is logged.

| Mood | Palette | Ground | Accent | Accent 2 | The feeling it has to carry |
|---|---|---|---|---|---|
| okay 😐 (and the default) | **Nocturne** | `#0C0A16` | `#54E6C8` | `#9B7BFF` | steady |
| great 😊 | **Radiance** | `#170F08` | `#FFC24D` | `#FF8A5B` | radiant |
| good 🙂 | **Meadow** | `#07160F` | `#54E6C8` | `#6FE6A8` | fresh |
| low 😔 | **Twilight** | `#0B0D1C` | `#9FB0FF` | `#B79BFF` | held — *soft and soothing, never grey* |
| rough 😤 | **Ember** | `#160810` | `#FF8A7A` | `#FF6FA5` | grounded — *a hug, never a warning* |

Each palette carries its own `aurora` (four bloom colours), `ink/ink2/ink3`,
`glass{bg,edge,top,shadow}` and `clay{hi,lo}`, so a recolour is total rather
than an accent swap. **A rough day must not make the app look angry** — Ember
is warm, not red.

---

## 4. Phase colours — fixed, and chosen against the mood set

`PHASE_AURORA` in `src/theme/palettes.ts`:

| Phase | Colour | Why this one |
|---|---|---|
| menstrual | `#FF3D71` rose-red | the one convention worth keeping |
| follicular | `#22D3EE` cyan | rising and clear, nothing like the mint moods |
| ovulatory | `#EBDA23` citron | the peak, and far from Radiance's amber |
| luteal | `#9D4EFF` violet | deeper than Twilight's lavenders |

These were not picked by eye. DT22 measured every phase colour against every
colour in every mood palette in CIELAB and found **three of four were byte-
identical to a mood colour** (ΔE 0.0) — so whichever mood the app wore, one
phase was painted in the background's own paint. `audit:colour` now fails the
build below **ΔE 18 from any mood colour** and **ΔE 40 between phases**.

### 4b. Calendar marks are composited, never alpha'd

`src/theme/blend.ts`. DT23 found the deeper bug: the grid drew phases at 14%
alpha over a *drifting* aurora bloom, so the audit measured a token and the eye
saw a composite. Every calendar fill is now **blended against the ground ahead
of time and drawn opaque**, and its text colour comes from `inkOn(fill)`:

- `LOGGED_PERIOD_CELL` — the pure phase colour. **A fact is solid.**
- `PHASE_CELL.*`, `FERTILE_CELL`, `PREDICTED_CELL` — composites at decreasing
  strength. **An estimate is a wash.**
- A logged day and an estimate are held **≥ ΔE 20 apart** (DT24: they were the
  same rose, so one tap looked like it had claimed the whole week).
- When two marks land on the same day, both stay visible: the ovulation day
  keeps the fertile fill it sits inside and adds a **ring and a pip** — shape
  for the single day, colour for the span.

---

## 5. Typography

`src/constants/typography.ts` → `Typography.preset.*`. System font (SF Pro /
Roboto), weights only — no bundled font files.

| Preset | Size / line / weight | Used for |
|---|---|---|
| `h1` | 36 / 43 / 700, −0.5 | screen hero |
| `h2` | 30 / 36 / 700, −0.3 | screen title |
| `h3` | 24 / 29 / 600 | section |
| `h4` | 20 / 24 / 600 | card title |
| `bodyLarge` | 17 / 26 / 400 | lead paragraph |
| `body` | 15 / 23 / 400 | default |
| `bodySemibold` | 15 / 23 / 600 | emphasis in body |
| `caption` | 13 / 18 / 400, +0.2 | supporting |
| `captionBold` | 13 / 18 / 600 | labels |
| `overline` | 11 / 14 / 600, +1.0 | ALL-CAPS eyebrows |
| `number` / `numberLarge` | 24 / 48, 700 | stats and the day counter |
| `button` / `buttonSmall` | — | CTAs |

**Never hardcode a font size.** One preset per role is what keeps five people's
screens looking like one app.

---

## 6. Space, radius, shadow

`src/constants/spacing.ts` — a **4px grid**:
`xs 4 · sm 8 · md 12 · base 16 · lg 20 · xl 24 · 2xl 32 · 3xl 40 · 4xl 48 · 5xl 64 · 6xl 80`

Named uses that matter more than the raw numbers:

- `screenPadding: 20` — horizontal page margin, everywhere.
- `cardPadding: 16`, `cardPaddingLarge: 24`
- `sectionGap: 24`, `itemGap: 12`, `inlineGap: 8`
- **`tabBarClearance: 96`** — the bottom padding every scrolling screen adds so
  the last row is never trapped under the floating tab pill (DT7).

Radii: `sm 8 · md 12 · lg 16 · xl 20 · 2xl 24` (cards) · `3xl 32` (sheets) ·
`full` (pills, circles). Big radii are part of the brand — nothing in this app
has a sharp corner.

**Shadows are WARM** (`#B48264`, `src/constants/shadows.ts`), never black. A
neutral shadow on the aurora ground reads as dirt.

---

## 7. The primitives

`src/components/ui/` — the whole vocabulary.

| Use | Instead of | Because |
|---|---|---|
| `AuroraBackground` | a `View` with a background colour | it draws the ground, the drifting bloom **and** the opaque status veil of exactly `insets.top` |
| `GlassCard` | a hand-rolled card | one fill/edge/radius recipe |
| `PressableScale` | `TouchableOpacity` | the standard press for ANY tappable — a scale dip plus the right haptic |
| `AuroraSwitch` | RN `<Switch>` | **rule 22** — the Android track tinted with a glass edge is a ~10% white hairline on near-black: the control vanished and read as a bullet (DT21) |
| `GradientButton` / `ClayButton` / `GradientFab` | a styled Pressable | the three CTA weights |
| `CelebrationDialog` / `showAppDialog()` | RN `<Modal>` | **rule 10** — a translucent Modal is a separate Android window that can stick over every screen |
| `MoodEmoji` | a drawn character, a Lottie, a raw emoji in a `<Text>` | **rule 8** — the six drawn companions were removed at DT31; a reaction is ONE emoji and there is never a second face beside it |
| `AuroraTabBar` | the stock tab bar | the moving glass pill (and `animation: 'none'` on the scenes — a cross-fade showed as a white glitch at the bottom, DT16) |
| `BreathingView`, `PopOnChange`, `GlowRing` | ad-hoc animation | the three idle/feedback motions the app actually uses |

Supporting families: `calendar/` (grid, day sheet, explainer), `checkin/`,
`celebration/` (streak week, milestone, reward chips), `home/`, `learn/`,
`sisterhood/`, `health/ConditionRow`, `mood/`, `safety/` (Ghost Mode),
`reports/`, `beta/`.

---

## 8. Motion

Reanimated, on the UI thread, always. The rules learned the hard way:

- **Reduce Motion is respected everywhere** — the state still reads, it just
  stops moving.
- **No tab scene animation** (rule 5). The pill carries the travel.
- **Big amplitudes or none.** DT19: ±9° on a limb at 96px is a two-pixel
  wobble the owner correctly called "not moving".
- **A press is a scale dip, not an opacity fade.** Opacity on glass looks like
  a rendering bug.
- **Never `experimentalBlurMethod="dimezisBlurView"` over a heavy tree**
  (rule 21) — it snapshots per frame and ANRs on Android.
- Heavy animated SVG is a scroll killer: ~10 `<Svg>` surfaces per character ×
  six characters per path is what made the Learn tab crawl (DT28).

Haptics: `selectionAsync` for light, `impactAsync(Light)` for important,
`notificationAsync` for celebrations.

---

## 9. Accessibility, and the safe area

- **Every scrolling screen pads BOTH ends** — `insets.top + Spacing.lg` at the
  top, `insets.bottom + Spacing.tabBarClearance` at the bottom.
  `audit:safearea` fails the build otherwise.
- **Never `presentation: 'modal'`** (rule 24). On Android that screen's insets
  read ZERO, so correct-looking padding silently does nothing — this hid the
  add-to-circle CTA under the nav bar for four rounds while the audit read the
  expression and passed. Use `SHEET_PRESENTATION` (`src/constants/navigation.ts`):
  modal on iOS, card on Android, same slide-from-bottom.
- **A row that toggles something is tappable across its full width and never
  under 48pt tall** (rule 23).
- Every tappable carries `accessibilityRole` and a real label; every emoji
  carries a spoken word, because the glyph reads as nonsense otherwise.
- Text contrast: `ink` on glass on ground clears WCAG AA at body size; `ink3`
  is for supporting text only, never for anything you must read.

---

## 10. Voice (it is part of the design)

- **Non-diagnostic, always** (rule 1): "many people report", never "your body
  does X".
- **Never invent a population statistic** (rule 2). There is no cohort. Insight
  speaks about the user's own history with the sample size attached, and stays
  silent at n=1.
- **Never draw a fertile window without its caveat** (rule 15) — `NOT_CONTRACEPTION`
  is the one wording; import it, never paraphrase.
- **No empty shells** (rule 14): a feature with no data shows one honest line,
  never a chart-shaped skeleton.
- The app speaks as **Dottie**, one voice, warm and never coy.

---

## 11. Building a new screen — the checklist

1. Wrap in `<AuroraBackground>`; never set a background colour yourself.
2. `ScrollView` with **both** insets padded (`+ Spacing.tabBarClearance` at the
   bottom).
3. Colour: `useAurora()` if the screen should follow the mood, `A.*` if it is a
   utility flow. Never a hex literal in a component.
4. Text: a `Typography.preset`. Space: a `Spacing` token. Radius: a
   `Spacing.radius`.
5. Tappables: `PressableScale` + haptic + accessibility props. Toggles:
   `AuroraSwitch`. Dialogs: `showAppDialog`. Reactions: `MoodEmoji`.
6. Empty state: one honest sentence.
7. If it is presented as a sheet: `SHEET_PRESENTATION`.
8. `npm run test:all` — 34 suites, including the four audits below.

## 12. What the audits actually check

| Audit | Fails the build when |
|---|---|
| `audit:safearea` | a scrolling screen misses an inset, or a route uses `presentation: 'modal'` |
| `audit:colour` | a phase colour lands within ΔE 18 of any mood colour, phases within ΔE 40 of each other, or a logged day within ΔE 20 of an estimate |
| `audit:ui` | a tappable has no press handler / no accessibility props |
| `audit:silent` | a `catch` swallows an error behind `if (__DEV__) console.warn` (rule 18) |
| `validate:content` | a condition shares an icon or label, or ships without its explainer |
| `test:ranges` | the dated calendar list disagrees with the grid it describes, cell for cell |

---

*Written 2026-09-11 on `gemini-v2`, after DT31 removed the companion layer.*
