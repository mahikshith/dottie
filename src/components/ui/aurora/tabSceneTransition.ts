/**
 * Dottie — tab scene transition
 *
 * How a tab screen enters and leaves when you tap the bottom bar.
 *
 * ─── THE PROBLEM ────────────────────────────────────────────────────
 *
 *  The navigator was set to `animation: 'none'`. That is not "the platform
 *  default" — it is an explicit hard cut, and it was chosen on the theory that
 *  the moving pill was the only motion needed. On device it reads as a glitch:
 *  the pill glides, the screen behind it teleports, and the two look like
 *  unrelated events happening at the same time. The owner reported it across
 *  several builds.
 *
 * ─── WHY THIS IS NOT A SLIDE ────────────────────────────────────────
 *
 *  Tabs are peers. A full-width slide implies one screen is "next to" another
 *  in a hierarchy that does not exist, and you pay for it dozens of times a
 *  session — which is exactly why the standard advice is that tab switches
 *  should not slide.
 *
 *  So the dominant channel here is OPACITY (a cross-fade, the neutral,
 *  depth-free transition), and the movement is a DRIFT of 18px — far too small
 *  to read as travel between places, just enough to say "the thing you tapped
 *  was over there". The direction is taken from the tab's index relative to the
 *  active one, so the content drifts the same way the pill just moved. That
 *  coupling is the entire point: one gesture, one system, rather than a pill
 *  animation and a separate screen swap.
 *
 * ─── WHY NOT THE SVG "LIQUID SWIPE" WAVE ────────────────────────────
 *
 *  The reference implementation for that effect (use-gesture + react-spring +
 *  a Bézier `clip-path`) is DOM-only in a way that does not port: React Native
 *  has no `clip-path`, and the trick depends on clipping a live element to an
 *  animated path. In RN you would have to render the incoming screen into a
 *  Skia surface to mask it, which costs a full snapshot per frame and makes the
 *  masked screen non-interactive while it animates. Paying that on the most
 *  frequent interaction in the app would produce the opposite of smooth.
 *
 *  The liquid quality is instead carried where it is cheap and safe: the glass
 *  pill that tracks the finger in `AuroraTabBar`, and this drift agreeing with
 *  it.
 *
 * ─── THREAD ─────────────────────────────────────────────────────────
 *
 *  `sceneStyleInterpolator` receives a core-`Animated` value that
 *  @react-navigation drives with `useNativeDriver` on native, and every
 *  property used here (transform, opacity) is native-driver eligible. So this
 *  runs on the UI thread and keeps running while JS is busy mounting the
 *  destination screen — which is the moment it matters most.
 */

import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

/**
 * The interpolator contract, declared locally.
 *
 * @react-navigation/bottom-tabs does not re-export these types from its
 * package root (only the runtime presets), and reaching into its internal
 * `lib/typescript` path would break on any patch release. This is the same
 * shape, structurally typed against it — so if the library changes it, the
 * navigator's own prop type rejects our function at the call site rather than
 * failing silently at runtime.
 */
interface SceneInterpolationProps {
  current: { progress: Animated.Value };
}
interface SceneInterpolatedStyle {
  sceneStyle: StyleProp<ViewStyle>;
}

/**
 * How far a leaving screen drifts, in px.
 *
 * Deliberately small. Anything near screen-width becomes a slide and starts
 * implying spatial hierarchy between peers; anything under ~10px is invisible
 * and just costs frames.
 */
const DRIFT = 18;

/** How far it settles back, as a scale. Subtle enough to feel, not to see. */
const SETTLE = 0.985;

/**
 * Fast. This fires on the single most repeated interaction in the app, so it
 * has to be over before it can annoy anyone — well inside the ~200ms budget for
 * a small state change, and shorter than a navigation transition on purpose,
 * because this is not navigation between places.
 */
const DURATION = 170;

/** Strong ease-out: most of the distance is covered immediately. */
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

export const tabTransitionSpec = {
  animation: 'timing' as const,
  config: { duration: DURATION, easing: EASE_OUT },
};

/**
 * The full transition: directional drift + settle + cross-fade.
 *
 * `progress` is -1 when this screen's tab sits LEFT of the active one, 0 when
 * it is active, +1 when it sits right. Multiplying the drift by it gives the
 * correct direction for free in both directions of travel.
 *
 * Transform order matters: translate first, so the settle does not scale the
 * drift distance.
 */
export function tabSceneInterpolator({
  current,
}: SceneInterpolationProps): SceneInterpolatedStyle {
  return {
    sceneStyle: {
      opacity: current.progress.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: [0, 1, 0],
      }),
      transform: [
        {
          translateX: current.progress.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [-DRIFT, 0, DRIFT],
          }),
        },
        {
          scale: current.progress.interpolate({
            inputRange: [-1, 0, 1],
            outputRange: [SETTLE, 1, SETTLE],
          }),
        },
      ],
    },
  };
}

/**
 * Reduced-motion variant: the cross-fade only.
 *
 * Reduced motion means fewer and gentler, not none — an opacity change still
 * explains that the screen changed, while the translation and scale (the parts
 * that actually trigger vestibular discomfort) are dropped.
 */
export function tabSceneInterpolatorReduced({
  current,
}: SceneInterpolationProps): SceneInterpolatedStyle {
  return {
    sceneStyle: {
      opacity: current.progress.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: [0, 1, 0],
      }),
    },
  };
}
