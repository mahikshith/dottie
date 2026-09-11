# Gemini round 3 — the illustration-faithful geometry, and the Lottie generator

Two deliverables came back. Both were rendered/run rather than read:
`scratchpad/gem/g2/{g2-gear,g2-gema,g2-orbo}.png` and a real execution of the
Lottie compiler.

## 1. The Lottie generator does not work, and it is not close

Gemini's `export-lottie.ts` was transliterated verbatim and run over all three
characters for the `idle → happy` transition. What it produces:

```
gear_gee  shapes= 46  paths= 19  degenerate-path-groups= 19  keyframed=2  anchor-offset-bug=2  geometry that changes idle→happy=7 (captured in the JSON: 2)
gema      shapes= 32  paths= 18  degenerate-path-groups= 18  keyframed=2  anchor-offset-bug=2  geometry that changes idle→happy=7 (captured in the JSON: 2)
orbo      shapes= 28  paths= 15  degenerate-path-groups= 15  keyframed=2  anchor-offset-bug=2  geometry that changes idle→happy=7 (captured in the JSON: 2)
```

Three independent defects, each fatal on its own:

1. **Every path becomes a single point.** The path branch emits
   `ks: { k: { c: true, i: [], o: [], v: [[px||50, py||50]] } }` — one vertex,
   no tangents. Lottie needs `v`, `i` and `o` to be equal-length arrays of
   cubic control points; an SVG `d` string is never parsed at all. So the
   torso, the head plate, the hair, the scarf, the arms, the bag and the mouth
   — 19, 18 and 15 shapes respectively — all collapse. **Orbo's entire body is
   paths**, so its Lottie is a shadow and two floating eyes.
2. **Only the eyebrows animate.** Keyframes are written only where
   `shape.rotate !== undefined`, which is two brows. Seven shapes per character
   actually differ between idle and happy; the JSON carries two of them. The
   mouth curve, the lids, the pupils and the catchlights are baked at frame 0
   and never move — i.e. the "expression transition" does not transition the
   expression.
3. **Those two animated groups are also mispositioned.** The transform sets
   `a` (anchor) to `[px, py]` while leaving `p` at `[0, 0]`, which translates
   each brow by `(-px, -py)` — roughly 42 units left and 34 up, off the
   character entirely.

This is not a thing to debug. **We do not need it**: our rig already animates
these characters on the device, on the UI thread, from the same parameters,
with no `.json` to ship and no Lottie runtime in the render path. A Lottie file
would also be *worse* than what we have — it cannot be recoloured per mood, it
cannot respond to `blush` or `winkLeft` at runtime, and it is an opaque blob we
cannot review.

## 2. The geometry: what it got right, and where ours is ahead

Rendered side by side with `docs/companion-v3-preview.html`:

**Gear-Gee.** Richer surface detail than ours — rivets along the plate edge,
chest vents, a floating XP crystal prop, chunky two-tone boots. But **it has no
head**: the "faceplate" is an oval on the torso, which is the no-neck
silhouette again. The gear's teeth are three detached rectangles that miss the
ring. The left arm is a shapeless lobe and the right is a wedge.

**Gema.** The mane resolved into **two horn-like pigtails** rather than the
round mane in the illustration, and the peach face-ellipse floats in front of
them with no neck. What it got right and we did not: **the asymmetric legs —
one orange, one teal**, exactly as in the reference, plus purple-and-teal spot
markings. Worth taking.

**Orbo.** Has the **wispy spiral tail** from the second illustration, which is
more faithful than our little legs, and three **prismatic gems** (cyan, pink,
gold) in the satchel instead of our one. Against that: the arms are detached
pods floating beside the body, the crest is a single blue blob, and the spiral
horn is a solid mass rather than a curl.

**Both sets share one problem on our ground:** everything is stroked with a
near-black ink (`#1F1F1F`, `#391085`, `#120338`). On `#0C0A16` those outlines
disappear — Orbo's especially — so the style depends on a light background we
do not have.

## 3. What to do

Keep our rig and our geometry (`src/components/ui/creature/geometry-v3.ts`),
and harvest the four details Gemini genuinely did better:

1. Gema's **asymmetric legs** (one orange, one teal) and spot markings.
2. Orbo's **three-gem satchel**.
3. Gear-Gee's **rivets and chest vents** — cheap detail that reads as machined.
4. Orbo's **wispy tail** as an option, if the owner prefers it to legs (it
   costs the four-foot-shape rule, so it is a deliberate trade, not a slip).

And do not ask Gemini for motion again. The division of labour that works is:
**Gemini designs, our rig animates.**
