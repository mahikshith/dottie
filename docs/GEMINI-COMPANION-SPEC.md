# Brief for Gemini — design the companions, and hand them over as rig data

**What this is.** A single prompt to paste into Gemini (deep research mode),
plus the integration notes for our side. It deliberately tells Gemini **nothing
about what this app does** — only the language and libraries it has to fit,
because that is the only product fact that changes the answer.

**The idea that makes it work.** Gemini cannot animate, and it does not need
to. We already own a rig that runs on the device: it rotates named limb groups
about fixed joints on the UI thread and builds the whole face from numeric
parameters. So Gemini is not being asked for an animation. It is being asked
for **still geometry with the right labels on it** — and the rig moves it the
moment it lands.

**How to use it.**
1. Paste everything between `PROMPT STARTS` and `PROMPT ENDS` into Gemini.
2. Ask for one character at a time. Six in one reply gets you six half-designs.
3. What comes back goes into `src/components/ui/creature/geometry.ts`; run
   `npx tsx scripts/companion-preview.ts` and open `docs/companion-preview.html`
   to LOOK at it before any APK.
4. `npm run test:creature` (the C8 block) is the gate. Details in §B below.

---

## A. PROMPT STARTS

You are a character designer **and** a technical artist. I need six original
mascot characters for a mobile app, and I need them in a form my existing
animation rig can move. Work in two passes: research first, then design.

### The one thing that changes how you should answer

**Do not write animation code. Do not produce an animation.** The app already
has a working rig. It is a 2-D cut-out rig: it takes a flat list of drawing
primitives, groups them by a limb tag, and rotates each group about a fixed
joint every frame, on the device's UI thread. It also draws the entire face
itself from a set of numbers (how open the eyes are, how curved the mouth is,
where the eyes are looking, and so on).

So what I need from you is **the still artwork, expressed as data, with every
moving part tagged** — a character in a neutral pose whose arms, legs, ears and
tail are separate, labelled shapes. The rig supplies the motion. If you hand me
a beautiful picture that is one flat shape, it can never move, and it is
useless to me.

### The stack you must fit (the only thing you need to know about the app)

- **TypeScript**, strict mode. No `any`, no type assertions.
- **React Native + Expo (SDK 52)** — a native app, not a web page.
- Drawing is **react-native-svg**. Motion is **react-native-reanimated**.
- Therefore: **no DOM, no CSS, no HTML, no `<canvas>`, no web animation API, no
  SMIL, no `<animate>` tags, no JavaScript in the artwork, no external files,
  no libraries.** Anything that is not a number or an SVG path string cannot
  reach the screen.

### Pass 1 — research (do this before you design anything)

Search for and summarise, with named sources:

1. **How modern 2-D mascot rigs are actually built.** Cut-out / bone rigs,
   joint hierarchies, pivot placement, what gets separated from the body and
   what stays welded to it, and why the separation points are chosen where
   they are.
2. **The animation principles that make a still drawing read as alive** —
   anticipation, squash and stretch with conserved volume, overlapping action
   and follow-through (why an ear arrives late), hang time, overshoot and
   settle. I want the specific values people use, not the names.
3. **Shape language and appeal proportions for characters that must read at
   28 pixels**: head-to-body ratio, eye size and spacing, silhouette tests,
   the small number of primitive shapes that top mascot sets restrict
   themselves to, and how a character stays recognisable as a black silhouette.
4. **Facial expression from parameters** — how rigs get dozens of emotions out
   of a handful of continuous controls (lid aperture, pupil scale, brow tilt
   and skew, mouth curve and opening, gaze direction) rather than a hand-drawn
   face per emotion.
5. **What makes a cute creature accidentally read as an INSECT.** This one is
   not hypothetical; see the list below. Find out what the actual signals are.

Give me this as a short, dense briefing with sources. No filler.

**One hard constraint on the research:** study the *principles* of well-known
mascots, never their designs. Do not imitate, trace, redraw or "take inspiration
from" any existing commercial character, and do not produce anything that would
read as a lookalike of one. Everything you deliver must be original and free of
third-party rights, because it ships in a released app.

### Pass 2 — design six characters

Six creatures, each one **recognisable from its silhouette alone**, each with a
distinct BUILD before a single colour is applied (a leggy one, a squat one, a
slim one — not six recolours of one plush toy), and each with an attitude you
could describe in four words.

For each character give me:

**(a) A reference illustration** — front-facing, neutral pose, arms and legs
visible and separated from the body, flat colour, no background, no text
anywhere in the image. This is a REFERENCE for me to look at. It is not what
ships; (c) is what ships.

**(b) An expression sheet** — the same character showing: idle, happy,
celebrating, sad, sleepy, surprised, determined, smug. Same construction in
every panel; only the face parameters change.

**(c) The geometry, as TypeScript data.** This is the actual deliverable.

### The schema (c) must match exactly

Everything is drawn inside a **100 × 100 box**. Y increases downward. The
character stands with its feet at about y = 90 and its shadow just below.

```ts
type ShapeRole =
  | 'shadow' | 'foot' | 'tail' | 'ear' | 'wing' | 'petal' | 'body' | 'belly'
  | 'head' | 'cheek' | 'brow' | 'eye' | 'eye-light' | 'nose' | 'mouth'
  | 'sparkle' | 'arm' | 'leg' | 'hand' | 'anger' | 'tuft';

/** Which animated group a shape belongs to. Untagged = the still body. */
type Limb = 'armL' | 'armR' | 'legL' | 'legR' | 'tail' | 'earL' | 'earR';

interface BaseShape {
  role: ShapeRole;
  limb?: Limb;
  fill?: string;     // a hex colour, e.g. '#FF9A3C'
  stroke?: string;
  sw?: number;       // stroke width
  opacity?: number;  // 0..1
  rotate?: number;   // degrees, about the shape's own centre
}
interface EllipseShape extends BaseShape { k: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
interface CircleShape  extends BaseShape { k: 'circle';  cx: number; cy: number; r: number }
interface PathShape    extends BaseShape { k: 'path'; d: string; px?: number; py?: number } // px/py = rotation pivot

type Shape = EllipseShape | CircleShape | PathShape;
```

Three primitives. That is the whole vocabulary: **ellipse, circle, path.**
A path's `d` may use `M L Q C A Z` with absolute coordinates only.

The shapes are returned as **one flat array in paint order, back to front**.
There is no nesting, no transform stack, no groups in the data — the `limb` tag
IS the grouping.

### The rig contract — what moves, and from where

Every shape carrying a `limb` tag is lifted into its own layer and rotated
about that limb's joint. The joints are fixed:

```ts
const JOINTS = {
  armL: [36, 60], armR: [64, 60],
  legL: [45, 75], legR: [55, 75],
  tail: [64, 76],
  earL: [43, 18], earR: [57, 18],
};
```

What this means for you, concretely:

- **Draw each limb so that it starts at its joint and hangs away from it.** A
  limb drawn far from its joint will orbit rather than swing.
- **Bury the joint inside the body outline**, so the limb reads as growing out
  of the hip or shoulder rather than being parked next to it.
- **Draw ONE pose only** — arms hanging, legs standing. Every other pose (both
  arms up, hands on hips, one hand to the chin, a wave, a clap) is produced by
  the rig as a rotation of these same shapes. Do not draw a character with its
  arms already raised.
- The body as a whole gets a jump timeline: crouch → launch → hang → land →
  settle, with the width and height derived from that one value so volume is
  roughly conserved. Ears and tails read a **delayed** copy of the same wave,
  which is where follow-through comes from. You do not implement any of this;
  you just need to leave the parts separate so it can happen.

### The face is parameterised — design it that way

The rig builds the face from these numbers. Your job is to define **where** the
features sit and **how big** they are, as a function of the head, not to draw
eight different faces:

- `eyeOpen` 0..1 · `eyeArc` (happy ^ ^ arcs instead of round eyes) ·
  `pupilScale` · `winkLeft`
- `mouthCurve` −1..1 · `mouthOpen` 0..1 · `mouthShape`: `'curve' | 'grit' | 'smirk' | 'wavy'`
- `browTilt` −1..1 · `browSkew` (one up, one down) · `angerMark`
- `blush` 0..1 · `gazeX` −1..1 · `gazeY` −1..1 · `tilt` (whole-body degrees)

Give me the face as a **pure function** of the build and those parameters —
plain arithmetic, no branching on emotion names where a number will do.

### The hard rules — an automated audit rejects art that breaks these

These are checked in CI, so a design that violates one cannot ship:

1. **The body is never wider than the head.** Half-width of the body must be
   less than the head radius.
2. **Eyes are not wide-set black domes.** Centre-to-centre spacing must be
   under 0.45 of the head's diameter, and **every eye carries a real
   catchlight** (a `role: 'eye-light'` shape).
3. **Two arms and two legs**, each tagged, each swinging from its own joint —
   plus footwear shapes so each foot has a sole and a pad.
4. **Nothing floats clear above the skull.** A detached round shape on a stalk
   above the head is an antenna.
5. **Sparkles, if any, stay above the head centre, and never more than five.**
   Small round things radiating around a body are read as legs.
6. **Coordinates are finite; opacities are within 0..1**; the same input always
   produces the same array (the art is pure data — no randomness, no dates, no
   state).

### Why those rules exist — the insect problem

Earlier versions of these characters were reported as looking like **insects**
three separate times. The signals were identified afterwards, and every one of
them is easy to reintroduce:

1. A full ring of sparkles around the character — small round things radiating
   from a round body are legs.
2. Big, wide-set, round black eyes — that is how a fly or a jumping spider is
   drawn. Mammal eyes sit closer in and carry a large soft catchlight.
3. **No neck** — head and body nearly the same size and concentric, so the
   outline is one lumpy oval: a thorax joined to an abdomen.
4. Symmetric dark shapes flanking the midline (e.g. two hard-edged dark
   ellipses for folded wings) — two mirrored dark limbs either side of a round
   body read the same way at any position.
5. Stalked nubs above the head. Antennae.
6. **Perfect bilateral symmetry.** Insects are read from symmetric radial
   forms; characters get their life from a tail, a tilted ear, a tuft that sits
   off-centre. Give every character one deliberate asymmetry.

### Also forbidden (technical, not aesthetic)

No gradients other than a single simple radial if you truly need one; no
filters, blurs, masks, clip paths, patterns or blend modes; no embedded raster
images; no text or lettering anywhere, including in the reference pictures; no
fonts; no `style=` attributes; no percentage or `em` units; no relative path
commands; no shape counts above roughly 40 per character — this is drawn on a
phone, 60 times a second, sometimes six at once in a row.

### Output format

For each character, in this order:

1. **Name and the four-word attitude.**
2. **One sentence: why this silhouette is unmistakable at 28 pixels.**
3. The reference illustration and the expression sheet (images).
4. **One fenced `ts` block** containing: the palette (`fur`, `furDark`,
   `belly`, `accent`, `ink` as hex), the build numbers (head radius and centre,
   body top/bottom, half-width, hip and foot height, stance width, shoulder
   height, limb thickness), and the pure functions that return the `Shape[]`.
   Numbers and comments only — no imports, no React, no classes, no `any`.

### Before you answer, check your own work

- Would this read as an insect by any of the six signals above? Name the one it
  comes closest to and say what you did about it.
- Convert it to a black silhouette in your head: is it still that character?
- Are the arms, legs, ears and tail separate, tagged shapes that begin at their
  joints?
- Is the head the largest mass, and the body narrower than it?
- Does anything in the output use DOM, CSS, or an animation API?
- Is every part of it original and free of third-party rights?

Start with the research briefing. Then do **one** character, completely, and
stop so I can review it.

## PROMPT ENDS

---

## B. Our side — how this lands safely

**Where it goes.** `src/components/ui/creature/geometry.ts` is the only file
that changes. It is pure data plus pure functions — no React, no
react-native-svg, no imports beyond types — and two renderers consume it:
`CompanionCreature.tsx` (the app) and `scripts/companion-preview.ts` (an HTML
page). One copy of the numbers, so what gets reviewed is what ships.

**The review loop, before any build.** `npx tsx scripts/companion-preview.ts`
→ open `docs/companion-preview.html`. Every companion in every expression, in a
browser, in a second. Nothing goes into a 25-minute APK unreviewed — that loop
is what broke the blind-redraw cycle in the first place.

**The gate.** `npm run test:creature` — the C8 block is the anti-insect audit,
and it asserts every rule in the prompt above. `npm run type-check` catches the
rest: the schema is a discriminated union, so a malformed shape cannot compile.

**What we will NOT accept back, whatever it looks like:**
- A raster image as the character. PNGs cannot be rigged, cannot be recoloured
  per mood, and cannot blink. They are reference only.
- An SVG file with transforms, groups, masks or CSS baked in — it has to be
  flattened into the schema by hand, and every transform is a place for the art
  to shift.
- Anything traced from or resembling an existing commercial mascot.

**The Lottie escape hatch, if Gemini insists on giving us motion.**
`CompanionLottie` already prefers a real Lottie file when one is wired into
`src/content/companion-lottie.ts`, and falls back to the drawn rig otherwise —
so commissioned or generated `.json` art drops in without touching a screen.
The constraints if we ever take that route: shape layers only, no expressions,
no embedded images, no text layers, no time remapping, under ~150 KB, and a
licence we can actually read. It is the weaker option — a `.json` is an opaque
blob we cannot review, cannot recolour per mood, and cannot drive from the
expression parameters — which is exactly why the rig exists.
