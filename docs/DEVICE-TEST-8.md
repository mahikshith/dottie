# Device Test 8 — findings + what was done

Owner tested the DT7 build and sent five screenshots. One section per report,
each with the cause and the fix. Previous rounds: `DEVICE-TEST-7.md` (incl. the
period-log freeze post-mortem), `DEVICE-TEST-6.md`.

---

## 1. The companion changed species when the mood changed (P0)

**Reported:** "if the user selected Nyx as a companion, another spirit companion
is showing up based upon the mood ... the cat disappears and the owl or
something else is coming up ... Nyx does not showcase any expressions other than
the smiley patch face."

**Cause.** `CompanionLottie` sent `idle` to a **Noto Animated Emoji file** and
every other state to the **drawn rig** — two completely different drawings of
the same animal. Log a mood and the orange emoji cat was replaced by the rig's
grey cat. It reads, correctly, as a different creature. And the emoji file is a
single fixed grin, which is exactly the "smiley patch face" with no expressions.

**Fix.** The rig is no longer the fallback — **it IS the companion**, on every
screen and in every state. One body per species, with brows, eye openness and
mouth curve driven by state. The licensed Noto art is kept only for **moment
overlays** (confetti, mind-blown, hug), which are companion-agnostic effects and
play as a corner badge so they never cover the face.

**And you can change it now:** You → *Your companion*. Every card in the picker
draws the real rig, in a live expression — picking from an emoji and then
meeting a different animal is the bug above, so the picker must not reintroduce
it.

## 2. Build badge over the Home hero (P1)

The cream tag pinned top-right sat exactly where the day ring belongs and read
as a sticker. Removed from the overlay layer. Build identity now lives at
**You → About this build** (version, build, channel, share-for-bug-report).

## 3. Hero alignment + the day ring is now a link (P1)

The companion was pinned to the top of a text column that also held the
greeting, so its vertical position depended on how the greeting wrapped and it
never lined up with the ring. The hero is a real two-column row now, both sides
centred. **Tapping the ring opens the calendar** — the ring answers "where am I
in my cycle?", so that is where it should go.

## 4. The white flash on every tab switch (P0)

**Reported:** "when user shifts from homepage to Learn or Cycle page ... a white
glitchy thing that happens for 1 millisecond ... this is consistent across
multiple builds."

**Cause — and why the previous attempts missed it.** React Navigation paints its
own container behind every screen and behind the tab bar, coloured from the
**navigation theme**. Expo Router installs the LIGHT `DefaultTheme` unless you
replace it, so that container was `rgb(242,242,242)` — a near-white sheet one
layer *under* our dark screens. On a tab switch the outgoing screen detaches a
frame before the incoming one paints, and for that frame the container is what
you see. Per-screen `contentStyle` and `sceneStyle` had already been set and
could not fix it, because they style the wrong layer.

**Fix.** A `NAV_THEME` (DarkTheme with `background`/`card`/`border` forced to the
aurora ground) wraps the whole app in `app/_layout.tsx`. There is now nothing
light left anywhere in the navigator to flash through.

## 5. Tab bar depth + press feel (P1)

Owner asked the pane to "pop out towards the front" without changing its colour,
and for a press to "slightly pop up".

- **Depth**: a specular band along the top edge fading by the middle, and a
  darker wash along the bottom. Depth on a glass slab is read from where the
  light is; with the existing outer shadow it now reads as a raised, rounded
  slab. One gradient, no extra blur pass.
- **Press**: the icon scales **up** and lifts 2px instead of dipping. A dip is
  right for a flat button; pressing something that already sits proud of the
  screen should push it further out.
- **Clearance**: the bar floored its gap above the Android nav bar.

## 6. Quiz / practice result — wrong face, wrong layout (P1)

**Reported:** "even if the user got all the wrong answers ... still a smiley
face and still a celebratory face ... 1/3 is still going under the companion
pane at the top ... we are showing altogether different emoji."

Three separate bugs:

1. The practice result hardcoded `perfect ? 'celebrate' : 'proud'` — **1-of-3
   got a full grin.** Now driven by score, and the bottom of the ladder is a new
   **`caring`** expression: inner brows lifted, small steady mouth. Not a grin
   (which reads as the app not noticing you struggled) and not sad (which reads
   as disappointment in you).
2. The score sat on the container's small gap and collided with the character
   when the rig bobbed. It has its own block with clear air above it.
3. **Three faces on one screen** — the drawn creature, an emoji reaction badge,
   and a raw `companion.emoji` beside the celebration line. The badges are gone
   (the rig's own face carries the emotion) and the line's emoji is now the same
   rig. One character per screen.

**Encouragement nudges** (owner's ask): a pool of 22 lines across four score
bands, rotating deterministically by attempt — `src/engine/learn/encouragement.ts`,
asserted by `npm run test:nudges`, including a tone check that bans blaming or
shaming language. The low band mostly invites another attempt, in so many words.

## 7. Sisterhood had its own date picker (P1)

**Reported:** "we don't need the slider of the calendar anymore or separate
creamy [flow picker] ... we should be redirecting them to the calendar part. The
calendar is already everything set up."

`shadow-log/[id]/period.tsx` is **deleted**. "Log a period day" on a sister's
profile now deep-links to `/(tabs)/calendar?logFor=<memberId>`, which selects
her and uses the calendar's own grid, flow chips and sister colouring. One
calendar in the app; one place for the data to live.

## 8. The sister marker is a curve, not an underscore (P2)

A straight bar under a number reads as an *underline* — a typographic mark, part
of the text. A sister's day is now marked with a shallow **arc** cradling the
date: an object placed around the day rather than something competing with the
numeral, echoing the rounded language of the pill and the cells. Logged days get
a solid stroke, predicted ones a lighter dashed one — the same grammar the
user's own days already use.

## 9. Whose science am I reading? + overlapping periods (P1)

**Reported:** "the scientific explanation and the period information ... we
should also provide an option for the information to toggle between the
sisterhood and the main user ... if there are any periods coinciding with them
and their sisterhood, we should also show them."

- **Sister panel.** Selecting a sister now also switches the panel above the
  explainer to describe *her* — day in cycle, phase, next predicted days. It
  shows what her data supports and says plainly that the full model below (the
  window, the spread, the graphs) is the user's. Dressing up a distribution we
  don't have the history to compute would be the fabrication this app refuses.
- **Overlap insight.** `findCycleOverlaps()` (pure, `npm run test:overlap`)
  intersects the user's predicted window with each sister's and reports the
  shared stretch, soonest first. It compares **windows, not dates**, so the
  error bars are part of the answer.

  It deliberately does **not** claim cycles "sync" — menstrual synchrony is a
  popular belief that has repeatedly failed to replicate, and asserting it would
  be exactly the confident folk claim this app avoids. The copy says two
  predictions "could land together", never offers a cause, and the harness bans
  synchrony language outright.
