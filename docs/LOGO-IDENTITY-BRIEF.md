# 🎨 Dottie — Logo & Identity Brief

> Working reference for the app-icon / brand-mark effort. Captures the mission,
> the design principles in play, the hard constraints, the exact tokens, the
> explored directions (and what was rejected & why), and the render pipeline.
> Author: Claude (Opus 4.8), design phase on branch `design-v2`. Keep current.

---

## 0. Status / environment (read first)

- Repo cloned locally to `…/Desktop/dottie/dottie`, working on branch **`design-v2`**
  (the live dev branch — full "Mood Aurora" redesign + new engines; its own latest
  commit says *"Node verification is next"*).
- **This machine has NO Node / npm / bun / deno** — only `git` + `winget`. So:
  - `npm install`, `tsc --noEmit`, `eas build`, and the interactive **Claude Design
    canvas** (its assembler needs node/bun) are all **blocked until Node is installed**.
  - Node is being installed via `winget install OpenJS.NodeJS.LTS` (user approved).
- **Assets:** `assets/images/` was missing (app.json references icon/splash/adaptive).
  Placeholder PNGs were generated once (a coral→peach *blossom*) — **rejected as too
  floral**. To be replaced by the chosen direction below. `assets/lottie/` has only a
  README. No `eas.json` yet.
- Device target chosen: **Android** (free `.apk` via EAS dev build; iPhone needs the
  $99 Apple account). Needs a free Expo account for `eas login`/`eas init`.

## 1. What Dottie is (mission the mark must carry)

A **warm, joyful, privacy-first cycle-tracking companion** — "Monument Valley serenity
+ Duolingo joy." Local-first, offline-capable, Ghost-Mode private. Users pick a **Spirit
Companion**; mood **recolors** the whole UI ("Mood Aurora"). It exists for people who are
**fed up with clinical, pink period apps**. So the identity must feel: warm, calm,
confident, alive, *for me* — never clinical, never generic-feminine.

## 2. Hard constraints (from the user — do not violate)

1. **NO pink.** The entire reason the app exists is pink-period-app fatigue. Stay in the
   warm sunrise band: coral → peach → gold. (Menstrual-phase pink `#E88EA0` is a *phase
   accent inside the app*, never the brand mark.)
2. **NOT floral / not a flower.** Flowers read as category cliché + amateurish here.
3. **Professional AND fun AND mass-appeal** — "appealing to millions." Reference bar:
   Headspace (warm orb character), Oura, **Stardust** (celestial period tracker, millions
   of Gen-Z users, zero pink/flowers), Clue (bold confident mark), Duolingo (character).
4. **Judged in seconds.** On a store shelf a user decides to install/skip in ~2s, so the
   mark must be instantly legible, distinctive, and warm at a glance — and hold at 48–60px.

## 3. The two insights the mark is built on

- **"Dottie" IS the dot.** The name gives us the mark for free — a single, confident dot.
- **The menstrual cycle IS the moon cycle** (culturally "moon cycle"; the app already uses
  🌙 for the luteal phase). Celestial > floral for this category, and it's how Stardust
  won millions without pink.

## 4. Design principles applied (from the repo's `.claude/skills`)

From **apple-design** (Apple's 8 foundations) and **emil-design-eng** (Kowalski craft):
- **Purpose / naming = identity** → the mark is literally the dot.
- **Familiarity, right metaphor** → a dot on/as a cycle (moon), not literal anatomy, not an
  abstract blob.
- **Simplicity, not minimalism** → one idea, expressed with real dimension (not flat).
- **Craft** → deliberate geometry, gradients from the *real* tokens, soft **warm** shadow
  (`#B48264`, never grey), adapts to light/dark, nothing random.
- **Delight / "feels alive"** → warmth + a hint of motion/dimension so it reads as a
  companion, not a corporate glyph.
- **Cohesion** (Emil) → matches "Warm Geometric" + the design-v2 "Mood Aurora" gradient
  theme; beauty as leverage to stand out on the shelf.

## 5. Exact tokens (from `src/constants/colors.ts` + `typography.ts`)

| Role | Value |
|---|---|
| Cream ground (light) | `#FFF8F2` |
| Night ground (dark) | `#1A1210` (card `#2D2420`) |
| Ink / text | `#2D1B12` · `#6B5344` · `#9B8B80` |
| Coral (heart / primary) | `#FF6B6B` |
| Peach (warmth) | `#FFA07A` |
| Gold / apricot (ovulatory) | `#F4A261` |
| Sunburst (joy) | `#FFD93D` |
| Luteal / moon accent | `#9B8FD4` 🌙 |
| Warm shadow (never grey) | `#B48264` (light 0.08 / med 0.15 / heavy 0.25 alpha) |

**Type:** app uses **SF Pro Rounded** (headlines, cheerful) + SF Pro Text (body); Roboto
fallback on Android. Modular 1.25 scale. Web/brand equivalent for mockups: **"Baloo 2"**
(rounded, confident display) + **"Nunito Sans"** (clean body). Headlines: bold, tight
tracking (`-0.5`).

## 6. Directions explored

Four genuinely different, professional axes. **Recommended: 1 (Luna).**

1. **Luna — celestial moon-dot** ⭐ recommended.
   The dot rendered as a warm *gilded moon* (radial coral→peach→gold orb + soft terminator
   shading + a small gold sparkle). The cycle = the moon cycle. Mystical-but-warm (Stardust
   energy), premium, calm, unmistakable, scales beautifully. Biggest differentiator; zero
   pink, zero floral.
2. **Halo — companion orb (Headspace-class).**
   The Spirit Companion as a warm dimensional orb with a *serene* minimal face (careful
   proportions, real shading — not a flat smiley). Maximum warmth + fun + mass-appeal; the
   emotional heart of the app.
3. **Orbit — track your cycle (abstract).**
   A confident gradient dot with a single tilted elliptical orbit ring + a small tracking
   dot. Modern, premium, energetic, gender-neutral. Clue/Whoop confidence, warm.
4. **Monogram — "d" letter-mark + wordmark.**
   Lowercase **d** in Baloo 2, white on a coral→gold rounded-square tile, paired with the
   **dottie** wordmark. Classic ownable consumer branding; safest/most "professional".

## 7. Rejected (don't re-pitch without reason)

- **Blossom / flower** (v1 placeholder) — floral cliché, reads amateurish.
- **Beaded orbit / dot-ring (v2 "A")** — reads like a **loading spinner**.
- **Flat smiley face (v2 "Dottie char")** — cute but **amateurish execution**; a companion
  face only works with real dimension/refinement (see Halo).
- Anything **pink** or **petal-based**.

## 8. Render pipeline / next steps

1. **Install Node LTS** (winget) → unblocks everything below.
2. Pick a direction (present as a theme-aware Artifact and/or the Claude Design canvas once
   node/bun exists).
3. Author the final mark as **SVG** (crisp, tokenized, light+dark).
4. Export the three required PNGs into `assets/images/`:
   - `icon.png` — 1024², full-bleed cream (iOS gets no transparency).
   - `splash-icon.png` — centered mark (app.json scales via `imageWidth: 200`), cream/transparent.
   - `adaptive-icon.png` — 1024², transparent fg, motif inside the center safe zone (Android
     paints `#FFF8F2` behind it).
   Rasterize via a node tool (`sharp`/`resvg`) once Node exists, or Windows `System.Drawing`
   as a fallback.
5. Then continue the original plan: `npm install` → `npx tsc --noEmit` → `eas.json` →
   Android dev build.

> Interim placeholder PNGs currently in `assets/images/` are the rejected blossom — replace
> before shipping.

---

## 9. Revised brief (2026-08-30, round 3 — after competitor research)

The v1 mark set (Luna/Halo/Orbit/Monogram) was "not bad" but not it. New direction from user:

- **Symbol-only.** NO wordmark / no letters on the mark — "the logo should speak for itself."
  (Rules out the Monogram direction.)
- **Surreal, aesthetic, appealing** — dreamlike/artful, not just clean geometric.
- **Encode meaning:** *safety, privacy, women's health / period tracking, inclusivity.*
- Study competitors first (done, below).

### Competitor landscape (Google Play + knowledge)

| App | Mark | Category role |
|---|---|---|
| "Period Calendar" (Simple Design) | **pink book + white flower** | the cliché |
| "Period Tracker & Calendar" (SimpleInnovation) | **pink gradient + woman silhouette** | the cliché |
| **Clue** | one **bold flat red block**, minimal | gender-neutral, privacy/science |
| **Stardust** | **cold cosmic purple / lunar** | mystical, astrology + AI |
| **Flo** | soft **abstract wave**, teal/pink | market leader, soft |
| **Natural Cycles** | clinical **teal ring** | FDA contraceptive |

**Overused tropes to AVOID:** pink, flowers/petals, woman silhouettes / flowing hair,
hearts, water droplets, calendars, cutesy.
**Open lane for Dottie:** **warm + surreal** — nobody owns it. Not pink, not clinical-teal,
not cold-cosmic-purple. Warm sunrise/dusk gradients, glowing, dreamlike, meaning-rich,
inclusive (abstract & universal — NOT a female silhouette; menstruation is not only women,
mirror Clue's gender-neutral stance).

### Round-3 directions (symbol-only, surreal, warm)

1. **Aurora** — a warm glowing moon behind flowing aurora bands on a warm dusk. Cycle +
   *moods/inclusivity* (warm spectrum, ties to the app's "Mood Aurora") + privacy (soft veil).
   Most surreal/aesthetic; ties to the app's core theme. *(lead candidate for wow)*
2. **Cradle** — a luminous crescent cupping a glowing orb. *Safety & privacy* (held,
   protected) + cycle (moon). Cleanest, best legibility at tiny sizes. *(lead for clarity)*
3. **Cocoon** — a warm glowing seed inside a translucent glass vesica/almond shell. *Privacy
   & safety* (shielded) + health/growth (seed) + feminine-abstract + inclusive.
4. **Eclipse** — two warm orbs overlapping into a crescent with a corona rim-light. Cycle /
   phases, striking, premium, minimal.

Rendered as a theme-aware Artifact (each a full app-icon with its own warm background, shown
large + small, tagged by which meaning it emphasizes). Recommend **Aurora** for surreal wow,
**Cradle** for clarity — final pick then cut to `assets/images/` PNGs.

---

## 10. FINAL DECISION (2026-08-30) — Aurora, shipped to assets

**Chosen mark: `Aurora` (plain)** — a warm glowing moon over a flowing aurora dusk, with a
few stars. Symbol-only, no pink, no flowers, no words. The user weighed the "cycle-cue"
variants (Phases / Crescent / Track) but chose plain Aurora: the icon sets the *vibe*; the
name "Dottie" + the store listing carry the literal "period tracker" meaning (as Clue,
Headspace, Stardust all do).

**Assets cut** (via `node` + `sharp`, rasterised from vector — full fidelity incl. blur glow
+ screen-blended aurora):
- `assets/images/icon.png` — 1024², full-bleed square (OS applies the corner mask).
- `assets/images/adaptive-icon.png` — 1024², same full-bleed scene; moon sits inside the
  Android center safe-zone.
- `assets/images/splash-icon.png` — 1024², rounded squircle with transparent corners (sits
  on the cream `#FFF8F2` splash; app.json scales via `imageWidth: 200`).

**Vector source kept:** `assets/images/source/aurora_square.svg` + `aurora_round.svg`.
Re-render with: `node scratch/render.mjs` using `sharp` (`sharp(svg).resize(1024,1024).png()`),
density defaults fine. To make future edits (e.g. switch to the Phases/Crescent cue, retune
the moon size or aurora intensity) edit the SVGs and re-run.

**Render env note:** `sharp` installed cleanly on this machine (Node 24.19.0). `sharp`'s
librsvg backend DID honour `mix-blend-mode:screen` + `feGaussianBlur` — output matches the
approved Artifact. Node was installed via `winget install OpenJS.NodeJS.LTS`; new shells need
`C:\Program Files\nodejs` prepended to PATH until a terminal restart.

**Pitch Artifact:** https://claude.ai/code/artifact/b94aa4c8-1b8a-4ec6-80b0-4bb88b59867e

> ✅ The rejected blossom placeholders in `assets/images/` are now replaced. Icon work DONE.
> Next: resume the engineering path — `npm install` → `npx tsc --noEmit` → `eas.json` →
> Android dev build.
