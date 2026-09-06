# Dottie — companion art brief v2

**What went wrong in v1, so it doesn't repeat:**

1. **The prompt was 400 words of rules.** Image models treat long rule-dumps as
   content — which is exactly why Gemini typeset the style bible into the picture.
   Every prompt below is under 120 words and describes a *picture*, not a policy.
2. **The words summoned a teddy bear.** "Chibi + pastel + cloud + fluffy" is the
   single most over-trained combination in cute-mascot generation. Those words are
   now banned from our vocabulary.
3. **No character had an attitude.** Duo is memorable because it's a bird that
   guilt-trips you. Charmander is memorable because its life depends on a flame.
   Species + soft colour is not a character. **Attitude + prop is.**

The new cast is built on one rule: **every character is a joke you get in half a
second.** A tiny creature that is furious. One that never gets out of its duvet.
One that cries at good news. You remember those; you don't remember a cloud.

---

## 1. The cast

Six creatures, no species, no fluff. Each has an **attitude**, a **prop** you can
spot at 28 pixels, and a **running gag** I can animate.

| # | Name | The joke | Silhouette hook | Colour | Animation gag |
|---|------|----------|-----------------|--------|----------------|
| 1 | **Bolt** | pure caffeine in a small body | zigzag lightning-bolt cowlick, spring legs, on tiptoe | electric lime + yellow | physically cannot stand still; vibrates, overshoots every jump |
| 2 | **Snug** | never fully left bed | wrapped in a duvet like a hooded cape, dragging one corner | lilac + deep indigo | falls asleep mid-sentence, slides down the screen |
| 3 | **Snap** | tiny and absolutely furious | arms crossed, gigantic angry eyebrows, steam puffs | tomato red + ember orange | stomps, and the whole screen shakes a little |
| 4 | **Drip** | cries at everything, including good news | one huge sparkling tear, tissue clutched in a fist | soft blue + white | happy-sobs into the tissue, blows nose, thumbs up |
| 5 | **Munch** | hamster cheeks, permanent snack | holding a biscuit bigger than its head | caramel + warm gold | chews constantly; hides the biscuit when caught |
| 6 | **Sage** | tiny old soul, seen it all | round spectacles, mug of tea, one raised eyebrow | deep teal + mint | slow blink, sips, says nothing, is right |

*Tone note: they're companions with comic personalities, never a comment on the
user. Snap is angry at the world, not at her.*

---

## 2. How to prompt (this is what fixes the last attempt)

- **One character per prompt. Under 120 words.**
- **Start with the subject**, not the rules. Models weight early words heavily.
- **Describe a picture**, not a spec: "arms crossed, thunderous scowl" beats
  "expression parameter: angry."
- **Negatives go last, and stay short.**
- **Always end with the anti-text line.** This is what stops it writing on the image:
  `Output the illustration only — no text, no words, no letters, no labels, no border.`
- If it drifts, don't re-paste everything — say one correcting sentence and
  "keep everything else identical."

---

## 3. Hero prompts — paste one at a time

### 1 · BOLT

```
A tiny hyperactive cartoon creature made of pure energy, caught mid-bounce on its
tiptoes. Chunky vinyl-toy mascot: big round head, small body, stubby mitten hands,
springy legs. Bright electric lime body with a yellow belly. Its hair is one bold
zigzag lightning-bolt shape sticking straight up, tilted to one side. Huge glossy
eyes with two catchlights, enormous open grin, eyebrows raised high. Small motion
sparks around its feet. Bold flat vector illustration, thick clean shapes,
saturated punchy colours, one cool rim light down the left side. Full body, front
view, centred, transparent background. Not fluffy, not a teddy bear, not pastel.
Output the illustration only — no text, no words, no letters, no labels, no border,
no ground shadow.
```

### 2 · SNUG

```
A small sleepy cartoon creature wrapped in a thick duvet worn like a hooded cape,
only its face and two small hands poking out, one corner of the duvet trailing on
the floor behind it. Chunky vinyl-toy mascot proportions: big head, small body.
Lilac duvet with a deep indigo lining, pale mint face. Heavy half-closed eyes, tiny
content smile, one small sleep bubble at its nose. Bold flat vector illustration,
thick clean shapes, saturated colours, one cool rim light. Full body, front view,
centred, transparent background. Not fluffy, not a teddy bear, not a cloud.
Output the illustration only — no text, no words, no letters, no labels, no border,
no ground shadow.
```

### 3 · SNAP

```
A tiny cartoon creature that is absolutely furious, standing with its arms tightly
crossed and a thunderous scowl. Chunky vinyl-toy mascot: big round head, short
stubby legs, mitten hands. Tomato-red body, ember-orange belly. Gigantic angry
eyebrows almost touching, huge glossy eyes, small clenched frown, two little puffs
of steam rising from the sides of its head. Comically small and comically angry.
Bold flat vector illustration, thick clean shapes, saturated punchy colours, one
cool rim light. Full body, front view, centred, transparent background. Not fluffy,
not cute-soft, not pastel.
Output the illustration only — no text, no words, no letters, no labels, no border,
no ground shadow.
```

### 4 · DRIP

```
A soft round cartoon creature crying happy tears, clutching a crumpled tissue in
one mitten hand and giving a small thumbs up with the other. Chunky vinyl-toy
mascot: big head, small body. Soft blue body, white belly, pink blush. One huge
sparkling teardrop rolling down its cheek, wobbling smile, eyes shining and
squeezed slightly shut. Bold flat vector illustration, thick clean shapes,
saturated colours, one cool rim light. Full body, front view, centred, transparent
background. Not fluffy, not a teddy bear.
Output the illustration only — no text, no words, no letters, no labels, no border,
no ground shadow.
```

### 5 · MUNCH

```
A round cartoon creature with cheeks stuffed full, hugging a giant round biscuit
bigger than its own head, mid-chew, eyes darting sideways as if caught. Chunky
vinyl-toy mascot: big head, small body, stubby legs. Caramel body, warm gold belly,
crumbs on its face. Huge glossy eyes, closed bulging cheeks, one raised eyebrow.
Bold flat vector illustration, thick clean shapes, saturated colours, one cool rim
light. Full body, front view, centred, transparent background. Not fluffy, not a
teddy bear.
Output the illustration only — no text, no words, no letters, no labels, no border,
no ground shadow.
```

### 6 · SAGE

```
A tiny wise old-soul cartoon creature holding an oversized mug of tea in both
mitten hands, one eyebrow raised, completely unimpressed. Chunky vinyl-toy mascot:
big head, small body. Deep teal body, mint belly, small round gold spectacles low
on its face, a single curl of steam from the mug. Half-lidded knowing eyes, tiny
flat mouth. Bold flat vector illustration, thick clean shapes, saturated colours,
one cool rim light. Full body, front view, centred, transparent background. Not
fluffy, not a teddy bear.
Output the illustration only — no text, no words, no letters, no labels, no border,
no ground shadow.
```

---

## 4. Once a hero is approved — three follow-ups (attach the approved image)

**Expressions**
```
Using the attached character exactly as it is, draw a 4×3 grid of twelve
head-and-shoulders portraits of the same character: calm, smiling, laughing,
proud, curious, thinking, confused, surprised, affectionate, worried, sad, sleepy.
Same size and position in every cell, wide spacing, transparent background.
Output the illustration only — no text, no numbers, no grid lines, no labels.
```

**Poses**
```
Using the attached character exactly as it is, draw a 4×2 grid of eight full-body
poses of the same character: standing relaxed; crouched ready to jump; mid-air at
the top of a jump with arms up; landing with knees bent and body squashed wide;
huge celebration with both arms overhead; waving; thinking with a hand on its
cheek; slumped and deflated. Same scale, same baseline, wide spacing, transparent
background.
Output the illustration only — no text, no numbers, no grid lines, no labels.
```

**Parts — the one I actually need**
```
Using the attached character exactly as it is, draw it taken apart into separate
pieces, spread out flat with space around each one and nothing overlapping: head,
each ear or headpiece, each eye, each eyebrow, four mouths (small smile, big open
smile, small frown, small round "o"), body, belly, each arm with its hand, each
leg with its foot, its prop, and any floating extras. Draw every piece whole, as
if lifted off the character. Same scale as the original, transparent background.
Output the illustration only — no text, no numbers, no arrows, no labels.
```

---

## 5. When it drifts

| Problem | Say exactly this |
|---|---|
| Wrote text on the image | "Remove every letter and word from the image. Illustration only." |
| Different character in sheet 2 | "This is a different character. Match the attached image exactly — same shapes, same colours, same proportions. Change only the pose." |
| Went soft and teddy-like | "Sharper and bolder. Thick confident shapes, saturated colour, strong attitude in the face. Not soft, not fuzzy, not pastel." |
| Added an outline | "No outlines or stroke borders. Flat shapes only." |
| Added a shadow or floor | "Remove the shadow and the ground. Fully transparent background." |
| Background not transparent | "PNG with a real alpha channel, no background at all. If that's impossible, flat solid #101018, no gradient." |
| Eyes went small and dead | "Much bigger, glossier eyes with two white catchlights each. The eyes carry the whole character." |
| Body got wide and heavy | "Slimmer body, bigger head. The head should be wider than the body." |

---

## 6. What to send me

```
bolt_hero.png   bolt_expressions.png   bolt_poses.png   bolt_parts.png
snug_… snap_… drip_… munch_… sage_…
```

PNG, transparent, 2048px. **If you only get one sheet per character, get
`_parts.png`** — that's what lets me rotate limbs from their joints, swap eyes and
mouths per emotion, tint per mood, and build the anticipation, squash, overshoot
and follow-through that make it read as alive. Don't generate video; motion is
mine and video can't be rigged.

Send whatever you get and I'll put the whole cast in a browser page — every
expression, every state, animating — that you open in a second. No APK round to
look at art.

---

## 7. If this cast isn't funny enough either

Swap any character for one of these and keep everything else identical:
**Grump** (a small creature permanently carrying a hot water bottle twice its
size) · **Static** (fur standing on end, everything it touches sparks) ·
**Wobble** (a jelly creature that hasn't found its balance yet) · **Hoot** (an
owl-ish know-it-all with a clipboard) · **Pip** (the smallest one, wearing boots
far too big for it) · **Void** (a tiny black hole in a scarf that eats snacks).
