# Gemini round 2 — what its geometry actually draws, and the corrections

Round 1 produced two things that must not be confused: **illustrations**
(GEAR-GEE, GEMA, ORBO) and **code** (Spark, Bramble, Nova). They are not the
same characters. The code was rendered through Chromium at
`scratchpad/gem/{spark,bramble,nova}.png` — eight expressions each — and that
is what this document is about, because that is what would ship.

## 1. The verdict, per character

**Nova (owl) — the strongest.** Reads as an owl at a glance, clean silhouette,
good colour. Three problems: it has **no head** (the face sits directly on the
torso, which is insect signal 3 — no neck), the two ear tufts are **long
symmetric dark shapes standing above the crown** (signals 4 and 5 — they read
as antennae, and they are close to the DT16 deer mistake), and the expression
sheet barely moves — idle, sad and determined are the same face with different
brows.

**Bramble (sprout bear) — the most appealing, with the oldest bug in it.** The
sprout is **a ball on a stalk floating above the skull**. That is precisely
what `audit:creature` C8b rejects, and precisely what DT16 shipped and the
owner rejected. Also: the happy-arc eyes render as **two donut rings that read
as spectacles**, and the scarf collides with the mouth.

**Spark — the weakest.** The head is a plain circle with a dark blob that reads
as a swimming cap; the eyes are small wide-set dots with no sclera at low
`eyeOpen`, so `sleepy` is two yellow specks floating on a blue circle.

**All three share the same structural gap:** no arms and no legs. There are
detached hands and detached feet, with nothing connecting them to the body.
That is the DT18 state of our own rig, which is exactly the thing the owner
said made them read as unfinished.

## 2. What would break on contact with the rig

These are not opinions, they are compile or audit failures:

1. **`limb: 'wingL' | 'wingR' | 'sprout'` does not exist.** Our union is
   `armL | armR | legL | legR | tail | earL | earR`. TypeScript rejects it.
2. **`role: 'mask' | 'sprout' | 'scarf' | 'beak'` do not exist** in `ShapeRole`.
   Same.
3. **`test:creature` C8e fails**: it requires four `role: 'foot'` shapes (a sole
   and a pad per foot). Each character has two.
4. **The hands would orbit, not swing.** The rig rotates anything tagged `armL`
   about the joint `[36, 60]`. Their hands sit at `(34, 74)` — fifteen units
   below the shoulder — so a swing sweeps them around the body in a wide arc
   instead of a limb pivoting. This is the exact failure the brief warned
   about: *a limb must start at its joint.*
5. **Two blinks at once.** `eyeOpen` shrinks the eyeball's radius (a sphere
   getting smaller is not a blink), and our rig draws its own lids from
   `eyeMetrics(type)`, which has no entry for these species.
6. **Half our emotional range is dead.** Their face ignores `blush` (the cheeks
   are a fixed opacity), `winkLeft`, `mouthShape` (`grit` / `smirk` / `wavy`),
   `angerMark`, `tilt`, `armPose`, `limbSwing` and `sparkles`.
7. **The outlines vanish on our ground.** Every shape is stroked with a dark
   ink (`#1F2937`, `#120338`) — on the `#0C0A16` aurora ground that outline is
   invisible, and the character loses the definition the style depends on.
   Either the art is stroke-less, or the stroke is a LIGHT colour.

## 3. Not shippable regardless of quality

The round-1 illustrations carry **the Gemini logo and wordmark** in a speech
bubble, and the characters are named after it. That is Google's brand and it
cannot go in a released app. The code characters (Spark, Bramble, Nova) carry
no branding and are fine on that count.

The images are **reference only** in any case — raster art cannot be rigged,
recoloured per mood, or blinked.

## 4. ROUND-2 PROMPT — paste this, with the three screenshots attached

Here is what your geometry actually renders as — I ran your `Shape[]` output
through a browser and screenshotted all eight expressions for each character.
Look at them before you reply, because several of these problems are invisible
in the code and obvious in the picture.

Fix these, one character at a time, and return the corrected geometry only:

1. **Give every character a head that is a separate mass from the body**, with
   a visible narrowing between them. Nova currently has a face printed on a
   torso; that silhouette reads as an insect thorax, not a character.
2. **Nothing may float above the crown of the skull.** Bramble's sprout is a
   ball on a stalk and reads as an antenna — root it INTO the head so its base
   is inside the skull outline, and thicken it so it is a shoot, not a wire.
   Nova's ear tufts must be shorter, asymmetric, and attached along the skull,
   not standing off it.
3. **Add real arms and real legs.** A hand with no arm is not a limb. Each arm
   is a stroked path from the shoulder joint to the hand; each leg is a stroked
   path from the hip joint to the foot. The path must START at the joint
   coordinate and the joint must sit inside the body outline.
4. **Two shapes per foot** — a darker sole and a lighter pad — so there are
   four `role: 'foot'` shapes per character.
5. **Use only these limb tags:** `armL`, `armR`, `legL`, `legR`, `tail`,
   `earL`, `earR`. A wing goes on `armL`/`armR`. A sprout goes on `earL` or
   `earR`. There are no other groups.
6. **Use only these roles:** `shadow, foot, tail, ear, wing, petal, body,
   belly, head, cheek, brow, eye, eye-light, nose, mouth, sparkle, arm, leg,
   hand, anger, tuft`. There is no `mask`, `sprout`, `scarf` or `beak` — a beak
   is `nose`, a scarf is `tuft`, a face mask is `cheek`.
7. **Do not animate the eyes by shrinking them.** Leave the eyeball at a
   constant size; my rig lowers a lid over it. Drive `eyeOpen` by squashing the
   lid, not the eye.
8. **Happy arcs must be arcs.** Yours renders as two rings that look like
   spectacles. Draw a stroked upward curve with no fill.
9. **Consume every parameter I gave you**: `blush` must drive the cheek
   opacity, `winkLeft` must shut ONE eye, `mouthShape` must switch between a
   curve, a gritted mouth, a one-sided smirk and a wavy line, and `angerMark`
   must draw the cross-vein. A parameter that changes nothing is a dead
   expression I cannot use.
10. **Strokes must be visible on a near-black background** (#0C0A16). Either
    drop the outlines entirely, or stroke with a LIGHTER tint of the fill —
    never a dark ink.
11. **Make the expressions actually differ.** In your sheet, idle, sad and
    determined are one face with different eyebrows. Sad needs the whole head
    tilted down, the gaze dropped, the mouth genuinely inverted and the brows
    with their INNER ends raised.

Then show me the eight-expression sheet again, as a picture, before we go on.

## 5. If the illustrations are the target

The pictures and the code are different characters. If what you liked is the
illustration, say so and Gemini should be told to **build the geometry FROM
that specific illustration** — same proportions, same colours, same props —
rather than designing a second cast in code. That is one sentence to add at the
top of the round-2 prompt, and it is the difference between reviewing art twice
and reviewing it once.
