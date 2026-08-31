# Onboarding audit + walkthrough proposal

**Status:** proposal (design-v2). Nothing here is built yet — the code changes
in this session added the Hormones 101 lessons and stopped. This doc is the
plan I want your read on before I touch the onboarding funnel.

## The problem

The current onboarding is 5 screens:

1. `welcome.tsx` — hello + mascot + Continue.
2. `mode-select.tsx` — Teen / Adult / Irregular Cycles.
3. `companion-select.tsx` — pick a spirit companion.
4. `cycle-setup.tsx` — "How many days ago was your last period?" (skippable)
   + a cycle-length bucket (Short / Average / Long / Irregular / Not sure yet).
5. `ready.tsx` — done, dropped on Home.

Two real gaps became obvious this pass:

**(a) The condition array is never filled in onboarding.** `mode-select`
lumps PCOS / thyroid / endometriosis into one "Irregular Cycles" mode, but
`draft.healthConditions` is set nowhere in the funnel. The user store
defaults `conditions: []` (`useUserStore.ts` line 130). Result: every path
that keys off `conditions` — doctor-report condition-signals, the
day-suggestion engine's condition modifiers, the personal-signal
tuning — silently no-ops for the vast majority of users. Someone who
picked "Irregular Cycles" and has PCOS gets zero PCOS-aware tips until
they hunt down `updateHealthProfile()` (which there is no UI for).

**(b) The user is dropped on Home cold.** After a 5-screen flow the app
lands on Home with a mood-emoji row, a phase bar (or "log your period"
CTA), and 4-5 cards below. No orientation — the user has to poke each
tab to find things like Sisterhood, Ghost Mode, Doctor Report.

Plus your call-outs:

- Users often **don't remember** when their last period was.
- Users often **don't know** if they have PCOS / any condition — it's
  something a provider names, and many go undiagnosed.
- Users may **never have logged** anything before — Dottie could be their
  first tracker.
- Complete **beginners** — a teen at menarche needs a different door
  than a 32-year-old cycle-syncer.

## Proposed onboarding v2 — "the honest funnel"

Guiding principles (drawn from the Flo / Clue scan in `DAY-SUGGESTIONS.md`):

- Every screen has a visible **"I'm not sure"** or **"Skip for now"**.
  Nothing gates progress on an answer the user genuinely can't give.
- **Ask questions that pay off** — every prompt is tied to a concrete
  feature the answer unlocks. Skip → the feature stays available but
  says "give me a bit of data and I'll turn this on" instead of failing
  silently.
- **Prefer relative time over dates.** "About how many days ago?" beats
  a date picker. Buckets ("A few days", "A week or two", "Longer / not
  sure") beat a number field for the truly uncertain.
- **Set expectations early.** "Approximate is fine. I get smarter as
  you use me." — the copy already says this; the whole funnel should
  behave like it.

### Screen-by-screen redesign

| Step | Current | v2 |
| --- | --- | --- |
| 1. Welcome | Hello + mascot + Continue | Same, unchanged — this one is good. |
| 2. Why are you here? (NEW) | — | 3-4 chip options: **"Understand my body"**, **"Predict my period"**, **"Track a condition / symptoms"**, **"Not sure — show me around"**. Powers a downstream "primary goal" flag we can use for content ordering. All routes forward — no dead ends. |
| 3. Mode | Teen / Adult / Irregular | Same, but the label is "**How's your cycle right now?**" and options become **Regular**, **Just started** (=teen), **Irregular** (=endocrine), **Not sure**. "Not sure" defaults to Adult mode with a note that they can change it later. |
| 4. What's going on? (NEW) | — (skipped entirely today) | An OPTIONAL checkbox row: **PCOS**, **Endometriosis**, **Thyroid**, **PMDD**, **On the pill / birth control**, **Nothing diagnosed yet**, **Prefer not to say**. Multi-select. All-skippable via a "Skip — I'll add this later" link. Whatever's checked fills `draft.healthConditions`. This is the fix for gap (a). |
| 5. Companion | Pick a spirit | Same, unchanged. |
| 6. Cycle setup | Days ago + length bucket | Days ago becomes **three chips + a text field**: "A few days ago", "A week or two", "Longer / not sure". The text field appears only if the user taps "Enter a number". "Longer / not sure" is legit — the app boots with no `lastPeriodStart` and Home shows the honest "log your period to see your phase" screen. |
| 7. Reminders (NEW, optional) | — | Two toggles: "Nudge me to check in" (default off), "Heads-up before my period" (default off). Both use the notification scheduler that's already written. All-skippable. |
| 8. Ready | Landing celebration | Same, plus: **"Show me around →"** launches the walkthrough (below). "Skip the tour" lives right next to it. |

That's 8 screens (2 more than today). The two new ones — "what's going on?" and reminders — are the ones that unlock existing engines the user is already paying the code cost for. Keeping them optional keeps the "duvet-day energy" test-user (owner's own phrase) able to blast through in <30s.

### Copy discipline for the "not sure" user

- **Never** use "diagnosis" — say "have you been told you have…"
- Every skippable step ends with a warm one-liner: "That's okay — I'll
  learn as we go."
- Condition selectors always include "Nothing diagnosed yet" as a
  first-class option — not a "None of the above" (which reads as failure).

## Proposed walkthrough — "Show me around"

A COACH-MARK tour, not a slide deck. Skip button at every step,
`Storage.walkthroughSeen` gates first-run auto-launch, and a
"Show me around again" row in Profile lets people replay it any time.

**Trigger:**
- First time landing on Home after onboarding — auto-launch (users can
  Skip at step 1).
- Any time from Profile → **"Show me around again"** row.

**Storage:**
- New MMKV flag: `walkthroughSeen` (boolean, gated same way as
  `sisterhoodExplainerSeen`).

**Steps (7 total, each ~1 tap):**

1. **Home hero** — "Tap a mood to log how you feel — a full check-in is
   one tap away in the little pencil." (Highlights the mood row.)
2. **Today at a glance card** — "Here's your sub-phase, what's happening
   hormonally, and a personal tip if I've spotted a pattern in your
   logs." (Highlights the card built in the last commit.)
3. **Calendar tab** — "Every day you can log a period, plan ahead, or
   tap a day for gentle suggestions. Purple dots mark days you've
   planned; red dots mark logged period days." (Bottom-tab pointer.)
4. **Learn tab** — "Bite-sized lessons about your cycle, hormones, and
   how to work with them. Start anywhere." (Bottom-tab pointer.)
5. **Circle tab** — "Anonymous or named, share and ask questions in a
   safe space. No judgement." (Bottom-tab pointer.)
6. **You tab → Sisterhood** — "Care for a loved one — log periods, mood
   and check-ins on their behalf. Everything stays private." (Highlights
   the Sisterhood row on Profile.)
7. **You tab → Doctor Report** — "One tap builds a clinician-ready
   summary of your cycle and symptoms — perfect for an appointment."
   (Highlights the Doctor Report row.)

**Interaction spec:**

- Full-screen scrim (like the calendar day sheet), with a spotlight
  cut-out over the highlighted UI. Reanimated (UI thread), Reduce-Motion
  aware (spotlight snaps, no crossfade).
- Bottom sheet card carries the copy + Next / Skip / (last step) Done.
- On Skip: writes `walkthroughSeen = true`, closes the tour.
- On Done: same.
- Navigating between tabs during the tour is fine — the tour is a
  single overlay that follows the user, not a slideshow.

**Replay:**

- Profile → new row **"Show me around again"** (between "Reminders"
  and "Privacy & your data"). Tapping it clears `walkthroughSeen` in
  memory + relaunches step 1.

## Docs / files this proposal touches when built

- `app/(onboarding)/why-here.tsx` — NEW screen 2.
- `app/(onboarding)/conditions.tsx` — NEW screen 4.
- `app/(onboarding)/reminders.tsx` — NEW screen 7 (opt-in).
- `app/(onboarding)/mode-select.tsx` — copy + a "Not sure" option.
- `app/(onboarding)/cycle-setup.tsx` — bucket chips + optional number.
- `app/(onboarding)/ready.tsx` — routes into walkthrough OR home.
- `src/components/walkthrough/*` — NEW: `WalkthroughOverlay`,
  `SpotlightScrim`, `CoachMarkCard`.
- `app/_layout.tsx` — mount the walkthrough overlay once, alongside
  `AppDialogHost`.
- `src/database/storage.ts` — `walkthroughSeen` + `primaryGoal` accessors.
- `src/types/user.types.ts` — extend the profile with `primaryGoal`.
- `app/(tabs)/profile.tsx` — "Show me around again" row.

## Open questions I'd like your call on

1. **Screen 2 "Why are you here?"** — worth it? Or does it feel like
   another quiz screen? Alternative: skip it, just let the primary
   goal emerge from the first check-in.
2. **Coach-mark on tabs 3-6** — do we want them to auto-advance as the
   user taps each tab, or step through with a Next button while the
   tour picks the tab for them (safer, no risk of the user getting
   lost)?
3. **Reminders opt-in during onboarding** — bold move, some apps put
   it later. Flo asks up front. I'd suggest we do too, since
   notifications are the retention lever.
4. **Perimenopause / birth-control modes** — the mode picker will
   grow (both are on the roadmap in HANDOFF.md §0.9). Include as
   options in v2 now, or wait until the code paths for those modes
   land? I'd wait — showing a mode that half-works is worse than
   omitting it.

## Next step

Say **build it** and I'll take the funnel + walkthrough end-to-end (probably
2 commits: the funnel, then the walkthrough). Or push back on any of the
open questions and I'll re-scope. All local, no CI, per the standing rule.
