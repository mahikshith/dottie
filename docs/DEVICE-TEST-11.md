# Device Test 11 — the tab transition

**Reported:** "the movement or transition when user move from one screen to
another by clicking on them is not smooth at all. I have told u about this in
the previous builds as well but it was not fixed."

Fair. It was never fixed, because it was never actually broken — it was
**switched off**, deliberately, and I kept treating that as the fix.

---

## 1. What was wrong

`app/(tabs)/_layout.tsx` had `animation: 'none'`, with this justification in the
code:

> No cross-fade/shift on tab change — the liquid pill is the only motion we
> want; a screen transition just adds latency on top of the destination's mount.

That is defensible general advice — tab switches are the most repeated
interaction in an app, and the standard guidance is that they should not
animate. But it produced a specific bad result here: **the pill glides for
300ms while the screen behind it teleports in one frame.** Two things happen
from one tap, at completely different speeds, and they read as unrelated. The
hard cut *is* the un-smoothness.

## 2. What it is now

A custom `sceneStyleInterpolator` + `transitionSpec`
(`src/components/ui/aurora/tabSceneTransition.ts`):

| Channel | Value | Why |
| --- | --- | --- |
| opacity | 1 → 0 cross-fade | The dominant channel. Depth-free — it says "this changed", not "you moved somewhere" |
| translateX | **18px** directional drift | Enough to agree with the pill's direction, far too small to read as travel |
| scale | 1 → 0.985 settle | Felt, not seen |
| duration | 170ms | Under the 200ms budget for a small state change, and shorter than a real navigation transition on purpose |
| easing | `bezier(0.23, 1, 0.32, 1)` | Strong ease-out; most of the distance is covered immediately |
| thread | native driver | Transform + opacity only, so it keeps running while JS mounts the destination |

**It is not a slide, and that is deliberate.** Tabs are peers. A full-width
slide implies one screen sits "next to" another in a hierarchy that does not
exist, and you would pay for it dozens of times per session. 18px is a hint of
direction, not a journey.

**Timing against the pill.** The scene settles at 170ms; the pill lands at
~300ms; its glow trails to ~520ms. That ordering is intentional — content
first, chrome after. Making the user wait 300ms for the screen so the pill could
finish would feel *slower*, not smoother, and the trailing glow then reads as
the wake of the movement, which is where the liquid quality actually lives.

**Reduced motion** keeps the cross-fade and drops the drift and settle — fewer
and gentler, not nothing.

### One non-obvious detail

`animation` is now **absent** from `screenOptions`, not set to a value. The
library reads a named preset only when that key is present, and otherwise
decides whether to keep the outgoing screen mounted during the transition from
`Boolean(transitionSpec)`. Setting `animation: 'none'` alongside a custom
interpolator would tear the leaving screen down instantly and leave nothing to
cross-fade.

## 3. The "liquid swipe" reference — why it can't be ported

The shared reference builds its effect from `@use-gesture/react` +
`@react-spring/web` + an SVG Bézier `clip-path`, dragging a wave-shaped mask
across two stacked slides.

That stack is DOM-only in a way that matters:

- **React Native has no `clip-path`.** There is no way to clip an arbitrary
  live view tree to an animated path.
- The RN equivalent would be rendering the incoming screen into a Skia surface
  and masking that. It costs a **full snapshot per frame**, and the masked
  screen is **not interactive** while it animates.
- Paying that on the most frequent interaction in the app would produce the
  exact opposite of smooth.

The wave also assumes a *drag* — you pull the next slide in. Our screens are
reached by **tapping** a tab, so there is no continuous gesture to drive a wave
with in the first place.

So the liquid quality is carried where it is cheap and safe, which is where it
already was: the glass pill that tracks your finger across the bar, its
over-damped trailing glow, and now the screen agreeing with the direction it
just moved.

### If you do want to drag between screens

That is a real feature and worth doing on purpose, not as a side effect of a
transition. It would need `Gesture.Pan()` with the scenes on a shared
translateX, and it **conflicts with the calendar's existing horizontal
month-swipe** — both want the same gesture on the same screen. Resolving that
(edge-only activation, or `Gesture.Race`) is its own piece of work. Say the word
and I'll scope it.

## 4. The mood reveal — where the liquid idea DOES belong

Owner's follow-up: "when the user clicks on the mood the UI colour changes …
instead of a circular animation filling the screen from the point of origin, why
not move it a bit slower and add a liquid transition?"

**Yes — and this is the case the clip-path idea actually fits.** The reason §3
rejected it for tabs was that a tab transition would have to mask a **live,
interactive screen**. The mood reveal is the opposite: an **opaque overlay
filled with a colour**, already `pointerEvents="none"`, with nothing live inside
it. Drawing a filled shape is exactly what SVG is for — so there is no snapshot,
no lost interactivity, and the same technique that was wrong there is right
here.

It is also the right *frequency*. Tab switches happen 100+ times a day, which is
why they get 170ms and no ceremony. Changing your mood repaints the entire app
and happens about once a day. That is where a delight budget belongs.

### What changed

Was: a `View` with a `borderRadius`, scaled up over 720ms. A perfect circle
growing at a constant rate reads as a mechanical wipe — a progress indicator.

Now: an SVG `<Path>` whose outline is rebuilt on the UI thread each frame
(`src/theme/liquid-reveal.ts`).

- **The edge undulates while it travels and settles smooth.** Radius varies with
  angle by two incommensurate harmonics — one sine reads as an obvious wobble,
  two read as organic — and the amplitude peaks early then returns to zero.
- **Slower, and a different curve.** 1050ms (was 720ms), on
  `bezier(0.4, 0.05, 0.2, 1)` instead of the app's usual strong ease-out. That
  matters more than the duration: a strong ease-out puts most of the distance in
  the first fifth of the time, so there would be nothing to watch. This one
  eases in and out gently, so the colour reads as *travelling*.
- Same accent → ground gradient as before. Only the shape changed, not the
  colour story.
- `SPREAD_MS` is a single constant — tune the pace there and nothing else moves.

### The one bug this shape can have, and why it's asserted

The palette underneath swaps on the frame the wash reaches full extent. If the
blob does not cover **every** corner at that moment, you see a flash of the OLD
palette in the gap — one frame, in a corner, during a colour change. Invisible
in review, easy to miss on a phone, and it depends on the balance between the
wobble amplitude and the overshoot margin, which a future tweak could easily
break.

So `npm run test:liquid` asserts it directly: coverage from five origins
(including the corners and off-screen), at 720 angles, plus that the shape is a
**true circle at t=1** — which is what the coverage proof rests on — and
visibly not one mid-flight. It also measures the per-frame path rebuild at
**0.014ms**, which is what makes rebuilding it every frame defensible.

Reduced motion still swaps instantly, as before.

## 5. Feel-check on device

Motion cannot be judged from code. On the phone:

- Tap **Today → Learn**, then **Learn → Today**. The drift should reverse
  direction. If it feels like sliding, the drift is too big.
- Tap two tabs in quick succession — the second should interrupt cleanly, not
  queue.
- First visit to **Cycle** still pays its mount cost; the cross-fade masks it
  rather than removing it. Second visit onward is instant (`freezeOnBlur` keeps
  screens mounted). If the first open still looks empty mid-fade, the fix is
  mount cost, not the transition.
- Turn on **Reduce Motion** in Android settings — drift and settle should
  disappear, the fade should remain.

For the mood reveal:

- Log a mood from the **bottom row** — the wash should start under your thumb
  and you should be able to watch it cross the screen, with the edge visibly
  breathing rather than a hard circle.
- Watch the corner farthest from your tap at the moment the colour commits.
  Any flicker of the old palette there means the coverage margin needs raising
  (`OVERSHOOT` in `liquid-reveal.ts`) — the harness says it shouldn't.
- If 1050ms feels indulgent on the tenth time, drop `SPREAD_MS`; it is the only
  knob.
