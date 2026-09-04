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

## 4. Feel-check on device

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
