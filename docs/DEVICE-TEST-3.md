# Device Test #3 — Findings + Fixes

**APK tested:** `88acaf2` (build run #7, artifact `9796301561`).
**Reporter:** owner, on Android device via screenshots + notes.
**Status of fixes:** all three findings addressed this session; needs a
device-test #4 build to confirm on-device.

## Finding 1 — Status bar overshadowed by aurora palette (P1)

**What owner saw.** On every aurora screen (check-in modal, lesson
reader, calendar, etc.), the phone's status bar (time, battery, wifi
icons) is invisible or unreadable. The dark aurora ground and its
bright radial blooms bleed under the OS status bar area, and the app's
own headline text sits at pixel 0 — overlapping the status bar.

**Root cause.** In Expo SDK 52 the default `androidStatusBar.translucent`
is `true`, which means the app draws behind the status bar area.
`AuroraBackground`'s topmost radial bloom is positioned at
`top: -0.1 * screenWidth` (deliberately above the viewport) — so a
bright teal/violet bloom appears right where the status bar sits.
Nothing tells Android to keep a solid strip behind the icons.

Additionally, several screens set `paddingTop: insets.top + Spacing.lg`
but a few (older ones) set fixed `paddingTop: Spacing['3xl']` — those
overlap with time/battery on tall-notch phones.

**Fix shipped (`app.json`).**

```json
"androidStatusBar": {
  "barStyle": "light-content",
  "backgroundColor": "#0C0A16",
  "translucent": false
}
```

- `translucent: false` → the app no longer draws behind the status bar.
- `backgroundColor: "#0C0A16"` → a solid strip in the aurora ground colour
  above the app content. Status-bar icons rest on this dark strip and are
  readable on every phone.
- `barStyle: "light-content"` → forces light icons regardless of
  per-screen `<StatusBar>` overrides on Android.

The aurora blooms still animate under the app content — they just don't
bleed above the app any more.

**Note on the "translucent-until-scroll" pattern owner suggested.** That's
a nice iOS-style pattern, but on Android it requires per-screen scroll
listeners + edge-to-edge insets. Solid strip is 90% of the payoff for
5% of the code and works identically on every screen. Can revisit later
as polish.

## Finding 2 — "Garden Notes" screen (feature, not bug)

**What owner saw.** A "Garden Notes" screen with plants listed
(Golden Pothos, Snake Plant, etc.) — "static at this point of time",
unclear why it exists.

**This is intentional — it's the Ghost Mode decoy screen.**

Path: `app/(modals)/decoy-home.tsx` (rendered via
`src/components/safety/DecoyHomeBody.tsx`).

**Why it exists.** Ghost Mode is Dottie's privacy-first defence for
users in coercive-control situations, post-Roe US states, or anyone
whose phone might be checked by someone else. When Ghost Mode is
enabled:

1. Dottie can be **disguised as "Garden Notes"** — the launcher icon
   still says Dottie (that would need a native module) but the app's
   internal chrome pretends to be a plant journal.
2. On wrong-PIN entry (or panic PIN), the user can be routed to this
   decoy plant-journal screen so a snooper sees a boring, believable
   fake app instead of Dottie's real content.
3. The panic-wipe option silently deletes all data on the panic PIN.

The plant list is **hard-coded fake data** — that's the point. It's
believable enough to pass a glance test. There's no real garden data.

**What to check.** If you're seeing Garden Notes when you shouldn't be
(e.g. on cold-start without Ghost Mode enabled), that's a bug — but
based on the screenshot it looks like you got there via
Profile → Ghost Mode → tested the flow. Full context in
`src/security/ghost-mode-store.ts` and `docs/HANDOFF.md` §Chunk 11.

**No fix needed.** But we should probably add a "This is a preview of
what snoopers will see" label at the top of the decoy when the user
reaches it INTENTIONALLY from settings, so it's obvious this isn't
the real Dottie chrome broken. Follow-up work.

## Finding 3 — White circle + screen freezes on Practice / Quiz tap (P0)

**What owner saw.** On a completed lesson (Cycle Basics screenshot),
tap "Practice →" or the quiz link → a white circle appears in the
top-left corner and the screen freezes. Force-quit + relaunch does
not clear it.

**Root cause.** The `WalkthroughOverlay` (mounted once at
`app/_layout.tsx`) had its scrim set to `pointerEvents="auto"` — a
full-screen invisible-until-active layer that BLOCKS all taps once
the walkthrough is active. The walkthrough was auto-launching on
first Home mount, and if the user navigated away without tapping
Skip / Next / Done, the store's `stepIndex` stayed non-null and the
overlay kept rendering on every subsequent screen, silently
intercepting every tap. On the lesson reader, tapping Practice hit
the scrim (invisible to the user because the coach-mark card was
off-screen or barely visible) → nothing happened → looked frozen.

The "white circle" is likely the OS status-bar icon glowing on the
aurora bloom (finding 1); the freeze is the walkthrough scrim.

**Fix shipped (`src/walkthrough/WalkthroughOverlay.tsx`).**

- Scrim is now a `<Pressable>` that calls `skip()` on tap.
  So any tap on the dark area outside the coach-mark card dismisses
  the walkthrough (writes `Storage.walkthroughSeen = true`, clears
  stepIndex).
- The user is no longer able to get "trapped" — one tap frees them.
- If they tap Practice on a lesson while the walkthrough is stuck,
  the first tap dismisses the tour; the next tap proceeds normally.
  Two-tap not ideal but no longer a full app freeze.

**Follow-up (not shipped).** A cleaner v2 would auto-clear the tour
when the user leaves a `/(tabs)/*` route — the tour is meant for the
initial tab pass, not deep screens. Would eliminate the "stuck at
step 0" state entirely. Small change but wanted to keep the fix
minimal for the test-#3 build.

---

## Docs updated this session

- `app.json` — androidStatusBar block added
- `src/walkthrough/WalkthroughOverlay.tsx` — scrim tap-to-dismiss
- `docs/DEVICE-TEST-3.md` — this doc
- `docs/HANDOFF.md` — device-test #3 section

## Next preview APK

The two fixes above are committed on `design-v2`. Push without
`[skip ci]` when owner wants the next preview build.

---

# ROUND 2 — device-test #3 follow-ups (after first fix build)

Owner tested the first-round APK and reported three of the four
findings **still visible**. Second-round fixes:

## Round-2 Finding A — White circle at top-left DURING QUIZ was a real bug (not the status bar)

The "white circle" wasn't the punch-hole camera or the aurora bloom —
it was an actual `<ActivityIndicator size="large" />` on the quiz
screen that never went away. Root cause: `app/quiz/[id].tsx`'s
"start-attempt" `useEffect` had `[id]` as its only dep. If
`quizEngine` (from `useContentStore`) was still hydrating when the
effect ran (which happens on cold-start quiz taps), the effect took
the "engine not ready" bail path and never re-ran when hydration
finished. User was stuck on the spinner forever.

**Fix.** `app/quiz/[id].tsx` — deps now `[id, quizEngine]`; when
engine is missing the effect stays in `starting` phase (spinner is
appropriate) instead of setting error; when hydration lands the
effect re-runs and starts the attempt. Also stops flipping to a
scary error state during a benign race.

## Round-2 Finding B — Garden Notes preview label

When a user navigates to `/(modals)/decoy-home` from Ghost Mode
settings, they now see a coral banner:

> 🔒  PREVIEW · This is the fake app a snooper sees on wrong PIN

The real trigger (via AppLockGate on wrong PIN) does NOT show the
banner — a snooper still sees just Garden Notes with no giveaway.

**Fix.** `DecoyHomeBody` now takes an optional `preview?: boolean`
prop. The modal route passes `preview={true}`; AppLockGate stays as
`<DecoyHomeBody />` for the real trigger.

## Round-2 Finding C — Post-skip walkthrough hint

Users skipping the tour didn't know how to find it again. Now,
whenever the user taps Skip (either the button or the scrim), a
themed dialog fires:

> 🧭  Want the tour later?
> You can always replay it from Profile → 'Show me around again'.
> No pressure.

**Fix.** `WalkthroughOverlay.tsx` — both Skip paths now call
`showReplayHint()` after `skip()`, which shows a one-off
`showAppDialog`.

## Round-2 Finding D — Status bar strip enforcement

The `app.json` `androidStatusBar` config from round-1 was correct
but per-screen `<StatusBar style="light" />` from expo-status-bar
was overriding the backgroundColor to transparent on every screen
that set its own tag. Root layout now also declares
`<StatusBar style="light" backgroundColor="#0C0A16" translucent={false} />`.
Per-screen tags can still tweak the TINT (light/dark icons) but the
solid dark strip stays under them — punch-hole cameras and
notches hide against it.

**Fix.** `app/_layout.tsx` — root StatusBar upgraded from
`style="dark"` (which itself was probably wrong for the dark aurora
world — dark icons on dark ground) to `style="light"
backgroundColor="#0C0A16" translucent={false}`.

## Round-2: what's still not addressed

- Owner's "pull down to reveal the status bar" gesture — requires
  Android immersive mode + SystemUI hide + touch listeners. Not
  standard on iOS. Skipped in favour of the always-visible solid
  strip. Can revisit if the owner wants the more Apple-style
  hide-on-scroll behaviour.
- Per-screen "try the tutorial for THIS screen" pointer — the
  current walkthrough is a single 7-step tour, not context-sensitive
  per-tab help. Adding a per-screen (?) icon is a bigger scope
  (needs a shorter local tour per tab). Tracked for a later session.

