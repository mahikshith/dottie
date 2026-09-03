# Device Test 6 — findings, root-cause analysis & forward plan

**Build under test:** v0.12.0-1 (`gemini-v2`, ~`588b0fa`). 13 screenshots + a long
bug/UX list from the owner. This doc is the single source of truth for that round:
deep root-cause analysis, what was fixed this session, the prioritized backlog, the
competitor calendar-engine research, and the sequencing for the next session.

> **Read this first, then `git log --oneline` on `gemini-v2`.** The task backlog is
> mirrored in the session TODO (`#35–#46`, tagged `[DT6 …]`).

---

## 0. TL;DR — the keystone insight

Most of the "serious, recurring" bugs are **one keystone bug wearing three masks.**

The **period-log freeze** (screen freezes after the *first* successful log, must
force-close the app) is not just an annoyance — it is the *cause* of the
prediction-staleness symptoms too:

```
freeze after 1st log  ─┬─▶  tester can only ever get ONE period into the DB
                       │
                       ├─▶  cycleCount = 0   (a cycle length needs ≥2 period-starts)
                       │        → "0 cycles used" / "Still learning" everywhere
                       │
                       └─▶  lastPeriodStart = that one old test log
                                → dayInCycle = days-since = "Day 168" on Home
```

So **"0 cycles", "Day 168", "still learning", and the invisible/empty explainer are
all downstream of the freeze.** Fix the freeze → the tester can log multiple periods
→ cycles form → predictions populate → the day-counter becomes meaningful. This is
why the bug felt "persistent across ~20 builds": every build shipped the same
keystone defect, and every device test hit the wall at the second log.

**This session fixed the freeze at its structural root** (details in §2), plus the
unrelated-but-deterministic Learn "YOU'RE HERE on every path" bug. Everything else
is triaged and planned below.

---

## 1. Method

Root-caused by static analysis of the actual code paths (no device available in this
env). Two fixes were landed because they are **deterministic and verifiable by
reading** — they cannot regress behaviour, only remove a failure mode. `tsc --noEmit`
= 0 and `npm run test:all` = 0 after both. Everything requiring device iteration or a
design decision is left as a scoped task, not a blind patch.

---

## 2. Fixed this session

### 2.1 — P0 · Calendar period-log freeze (the keystone) ✅

**File:** `src/components/calendar/DayDetailSheet.tsx`

**Root cause.** The day sheet is an in-tree full-screen overlay (`styles.overlay`:
`absoluteFill`, `zIndex: 50`) — deliberately *not* a React-Native `<Modal>` (that was
the old stuck-white-circle bug). Its dismissal, however, was gated on Reanimated's
`withTiming` **completion callback**:

```ts
// BEFORE — fragile
t.value = withTiming(0, { duration: 180 }, (done) => {
  if (done) runOnJS(finish)();   // finish() → props.onClose() → parent setSelected(null) → unmount
});
```

On Android, when the JS thread is busy — which it is *right after logging a period*,
because `logPeriodDay()` synchronously kicks `recomputePrediction()` — that worklet
completion callback can be **dropped, or fire with `done === false`.** When it does,
`finish()` never runs, `onClose` never fires, `selected` never resets, and the
full-screen scrim **stays mounted swallowing every touch.** The app looks frozen;
only a force-close clears it. That is an exact match for the reported symptom, and it
is the same lesson CLAUDE.md already records for overlays: *never gate an overlay's
teardown on something that can fail to fire.*

**Fix.** Never gate unmount on the animation callback. Play the exit visual for looks,
but drive the actual teardown from the **JS thread** with a plain timer that always
fires; two refs make `close()` / `finish()` each run at most once:

```ts
// AFTER — robust
const closingRef = useRef(false);   // close() started
const teardownRef = useRef(false);  // onClose() fired
const finish = () => { if (teardownRef.current) return; teardownRef.current = true; props.onClose({…}); };
const close  = () => {
  if (closingRef.current) return; closingRef.current = true;
  Haptics.selectionAsync().catch(() => {});
  if (reduce) { finish(); return; }
  t.value = withTiming(0, { duration: 180 });
  setTimeout(finish, 200);          // JS thread — guaranteed
};
```

`runOnJS` is no longer imported. **Device verification still required** (task #35):
open a day → Mark as period → Done → open another day → Mark as period → Done,
repeated 5+ times, must never freeze.

### 2.2 — P0 · Learn "YOU'RE HERE" + hopping companion on every path ✅

**File:** `app/(tabs)/learn.tsx`

**Root cause.** `currentId` is computed **per-path** — the first not-complete lesson
*in that path* (`lessons.find(l => progress !== 'complete')`). Every path therefore
had a node flagged `state: 'current'`, which lit the pulse ring, the hopping
companion, and the "YOU'RE HERE" tag on **every path's first lesson at once.** A
separate latent bug compounded it: `currentIndex = Math.max(0, findIndex('current'))`
returned `0` when a path had *no* current node, pinning the anchor to node 0.

**Fix.** Only the one genuinely-active path (already identified by `activePathId`) may
own a current node, and the index is honest about "none":

```ts
const isCurrent = isActivePath && lesson.id === currentId;          // was: lesson.id === currentId
const currentIndex = allComplete ? nodes.length - 1
                                 : nodes.findIndex(n => n.state === 'current'); // was Math.max(0, …)
```

All downstream uses already guard on `> 0` / `>= 0` / `anchorPoint &&`, so the lit
trail, auto-scroll and companion correctly stay off on non-active paths. Verify on
device (task #36).

### 2.3 — Tab bar: finger-follow liquid pill + switch-stutter mitigation ✅

**Files:** `src/components/ui/aurora/AuroraTabBar.tsx`, `app/(tabs)/_layout.tsx`

**Owner report.** Switching tabs froze ~1–2s before the screen appeared, and the
liquid glass did **not** flow under the finger when dragging across the 5 icons —
"that was not implemented at all."

**Two causes, two fixes.**
1. *No finger-follow.* The pill only sprang **after** a tap committed navigation.
   Added a core-RN `PanResponder` layered over the tab buttons: it only claims a
   clearly-horizontal drag (>8px), so taps + a11y still go straight to the child
   `<Pressable>`s (navigation can never break). While dragging, the pill tracks the
   finger 1:1 (clamped in-bar) with the glow trailing one frame for the liquid
   smear; on release it springs to the tab under the finger and commits. We use
   PanResponder (not Gesture Handler) because there's no `GestureHandlerRootView` at
   the app root — same reason `AuroraSlider` does.
2. *Switch stutter.* That freeze is the **destination screen mounting** on first
   focus (lazy), not the pill (which is UI-thread). Added `freezeOnBlur: true` +
   `animation: 'none'` to the navigator so inactive tabs stop re-rendering and
   there's no transition cost on top of the mount. Screens stay mounted after first
   visit, so **return** trips are instant; only the FIRST open of a heavy tab
   (calendar/learn) still pays mount cost — deeper first-mount profiling (defer heavy
   subtrees via `InteractionManager`) is the follow-up if it still bites on device.

### 2.4 — Home: day number now says what it means ✅

**File:** `app/(tabs)/home.tsx`

**Owner ask.** "Day 2 / Day 5" must tell the user it's *days since they last logged
their period* — it wasn't shown. **Also a semantics question:** does the top-right
ring count from the *first-ever* period? **Answer: no.** `dayInCycle` =
`latestPrediction.dayInCycle` = days since the **most recent** period start, so it
**resets every time a newer start is logged** (log June→July→August and it recounts
from the latest). The "Day 168" was purely the freeze/staleness artifact — only one
old period had ever committed. The meaning line now states it plainly, e.g.
*"Day 5 — it's been 4 days since your last period started. Energy tends to build…"*,
and "started today → Day 1 of your new cycle" on the start day.

### 2.5 — Calendar redesign (v1) ✅

**File:** `app/(tabs)/calendar.tsx`

**Cross-impact checked (owner ask):** `DayDetailSheet`, `WeekAheadStrip`,
`buildMonthGrid` and `DayCell` are imported/defined **only** in `calendar.tsx` —
Sisterhood has its own separate log screen — so this redesign touches nothing else.
(Unifying them is the *separate*, deliberate task #40.)

Implemented: **swipe** left/right to change month (a horizontal `PanResponder` fling;
month arrows removed, tap the label to jump to today); **date dots removed**;
**bigger cells** (40→44px, still 7-per-week ≤ a 360dp row); a **backfill nudge**
when only a cycle or two is logged ("swipe back and tap earlier period days"); and a
**phase-why card** — the summary now shows the sub-phase + *why* (hormone story),
the prediction line, *what's next* (next-phase hint), and a *tip*, all
non-diagnostic. Past-month logging already worked once the month is navigable.
**Needs device verification** of the swipe feel + cell fit on the owner's phone.

---

### 2.6 — Round 3: the real freeze cause, and the rest of the round ✅

**THE FREEZE — earlier diagnosis was wrong.** `DayDetailSheet`'s backdrop used
`experimentalBlurMethod="dimezisBlurView"`, which on Android **snapshots the
entire view tree behind the overlay**. First open = nearly-empty calendar = cheap.
That first log then fills the screen (week-ahead, explainer, rich phase card), so
the **second** open snapshots a heavy tree and **ANR-wedges the JS thread** —
frozen screen, dead Done button, force-close, data already written (hence it
appears after restart). Deterministic, and it explains 1st-vs-2nd exactly; a
wedged JS thread would also have defeated the earlier `setTimeout` teardown fix.
Removed. Only this component used that method. **Needs device verification.**

Also landed this round:
- **Status-bar overlap** — fixed once for every screen via an opaque ground cap
  inside `AuroraBackground` (all screens already padded by `insets.top`, but that
  only protects the *initial* position; scrolling slid content under the clock).
- **White flash Today→Cycle** — tab `sceneStyle` painted `A.ground`.
- **Science card** — never returns `null` now (that's why it vanished). Added a
  real log-normal **distribution graph** from the live posterior with the quoted
  window shaded, predicted period window, **heavy-days** forecast, the 3–7 day
  reference facts, and a "WHAT SHAPED THIS PREDICTION" heading. +8 assertions.
- **Flow intensity** — logging no longer hardcodes `flowLevel: 3`.
- **Notifications** — `requestNotificationPermission()` existed but was **called
  from nowhere**, so Android was never prompted. Wired to the toggle tap; denied
  state deep-links via `Linking.openSettings()`.
- **Learn** — New/Basics/Deep → two modes; "My phase" surfaces 6 lessons matched
  to sub-phase + conditions. Streak banner removed.
- **Privacy** — the "You & 12,363 others" counts came from `sample-data.ts`
  (a comment there called them *"tuned to feel believable"*). Removed.
- **Sisterhood on the main calendar** — new pure `sister-overlay.ts` + 11 tested
  scenarios; sister days in gold, "who am I logging for" chips, heads-up card.
- **Quiz** — Next/Finish pinned to the bottom for thumb reach.
- **Companion lines** — rotation was keyed off `day_in_cycle`, which sat frozen
  while cycle data was stale, so the same sentence repeated forever. Now salted
  with the calendar day-of-year.
- **Period ranges** — new pure `period-blocks.ts` + 12 tested scenarios: real
  start/end/length, and data-entry nudges (never diagnoses — a test enforces the
  tone).

New suites in `test:all`: `test:sister`, `test:blocks`.

---

## 3. Prioritized backlog (not yet fixed)

### P0 — correctness, blocks trust

| # | Item | Root cause / note | Approach |
|---|------|-------------------|----------|
| 37 | Prediction staleness ("0 cycles / Day 168 / still learning") | **Downstream of the freeze** (see §0). | Verify it cascade-resolves once multiple periods can be logged. If it *persists* after the freeze fix, inspect `cycleRepository.logPeriodDay` auto-cycle-detection + `getLastPeriodStart` (is a new start superseding the old? is a cycle record formed from consecutive starts?). |

### P1 — core UX redesigns the owner explicitly asked for

| # | Item | Approach |
|---|------|----------|
| 38 | **Calendar redesign** | Swipe left/right for months (remove `‹ ›` arrows) via gesture/pager; remove per-day dots; bigger cells/touch targets; allow logging in **past** months + a nudge to backfill recent months; show **why** the user is in a phase + next phase + tips (the sheet already has `hormoneStory`/sub-phase — surface it on the month view too). |
| 39 | **Learn modes** | Remove `basic/deep` `LearnLevel`. Two modes: **Go with the flow** (free-jump any lesson, gem/diamond unlocks) and **My phase & conditions** (pull current phase + conditions from the calendar, surface matching lessons). |
| 40 | **Sisterhood** | Replace year/month/date **text** entry (a typo breaks the prediction) with a calendar picker / "how many days ago". Use the **same** calendar component as main, sister data in a **different colour**, instead of a separate screen. Freeze fix (§2.1) applies to the sister log path too — confirm it shares `DayDetailSheet`. Reconsider "nudge when they get Dottie" → prefer an **app-share** flow. |

### P2 — polish, depth, delight

| # | Item | Approach |
|---|------|----------|
| 41 | Prediction explainer — fully dynamic + elaborate | Add last-period date + days-ago, current phase + why, next phase + when, condition-specific reasoning, hydration/craving tips. Extend `explain-prediction.ts` output; fix the occasional invisible render (likely an empty-state height/opacity issue). |
| 42 | Quiz layout | Move Check/Next to the **bottom** (thumb reach); fill the empty space with descriptive content; fix "1/3"/% progress overlapping the emoji on mid/incomplete lessons (only the final result was fixed). |
| 43 | Companion messaging | `QuizAnswerReaction` rotates headlines but repeats one message — add rotation + positive/negative variants. `CompanionBuddy` emojis have no expression → ship real Lottie art (manifest is wired) **or** remove the emoji-only instances. |
| 44 | Reminders | Dedupe checker/nudge on duplicate reminders; specific-time picker (slider); when notifications are OFF, `Linking.openSettings()` deep-link instead of a dead message; hide the message when ON. |
| 45 | Home | Day-counter tied to real cycle (blocked on #37); unify font ramp; tighten the greeting (too much space, left-aligned). |
| 46 | Logging model | Cap realistic periods/month (one menstruation span, not many); count period **ranges** (start→end), not isolated day flags. See §4. |

---

## 4. Competitor calendar-engine research (Flo · Clue · Bearable)

The owner asked how the leaders model the calendar/logging. Findings:

- **Flo** — 16 trackers, **50+** symptoms/events. Logging = tap **+** → multi-select
  everything you're feeling → **Apply**. A *date* is a **container of many entries**
  (flow + symptoms + mood + events), reviewed by tapping the day in the calendar.
  AI-powered predictions.
- **Clue** — science-backed algorithm (their marketing contrast vs Flo's "AI"). Free
  tier = cycle + multi-category symptom logging. Same "day = many categories" model.
- **Bearable** — mood/energy/sleep/symptoms/habits/meds, **many factors per day**,
  multiple check-ins per day. Period logging is **optional, with an irregular-cycle
  mode and *no* predictions**; an "Impacts" view correlates cycle **phase → symptoms**.
  You log *when* you menstruate and it **estimates phases** from that.

**What this means for Dottie's model (informs #38, #41, #46):**

1. **A day is a container, not a boolean.** Today Dottie treats a day as ~period/not
   + a plan note. Move toward `date → { periodFlow?, symptoms[], mood?, energy?,
   sleep?, notes }`. The `DayDetailSheet` already gestures at this (track chips,
   check-in) — formalize the per-day record.
2. **Period is a range, phases derive from starts.** Anchor everything on
   *period-start* dates; a cycle = start→next-start; count period-range days
   (start→end). One menstruation span per cycle — guard against accidental multiple
   "starts" in a month (#46).
3. **Logging must be one tap to the primary action.** Flo's + → multi-select → apply
   is the bar. Dottie's "Mark as period" is already one tap; keep it above the fold
   (it is) and make symptom multi-select equally fast.
4. **Irregular-cycle honesty.** Bearable ships *no* prediction rather than a false
   one for irregular users. Dottie's log-normal predictor + wide "still learning"
   window is the right instinct — keep the honesty, never fabricate confidence.
5. **Phase → symptom correlation is the retention hook** (Bearable's "Impacts", Clue's
   insights). Dottie's per-phase suggestions + personal signals are the seed; the
   explainer elaboration (#41) is where this pays off.

Sources:
[Flo — Logging symptoms](https://help.flo.health/hc/en-us/articles/4406826542740-Logging-your-symptoms),
[Flo — Calendar & Symptoms](https://help.flo.health/hc/en-us/sections/360002040591-Calendar-Symptoms-Logging),
[Clue vs Flo](https://www.go-go-gaia.com/blog/clue-vs-flo.html),
[Bearable — period & cycle tracking](https://bearable.app/support/howto/period-menstrual-cycle-tracking/),
[Bearable — track cycle impact](https://bearable.app/support/tips/track-menstrual-cycle-health-symptoms/),
[Best period apps 2026 (Samphire)](https://www.samphireneuro.com/blog/best-period-tracking-apps).

---

## 5. Forward plan — sequencing for the next session

1. **Verify §2 on device first** (freeze + Learn). One APK, run the freeze repro 5+
   times and open every Learn path. If the freeze is gone, confirm #37 (staleness)
   cascade-resolved by logging 2–3 periods and checking Home/explainer.
2. **If #37 persists**, go straight to `cycleRepository.logPeriodDay` /
   `getLastPeriodStart` (cycle-record formation) — that's the only place left it can
   hide once the UI no longer freezes.
3. **P1 redesigns** in this order: Calendar (#38, unblocks the "day = container" model
   and the phase-why), then Learn modes (#39), then Sisterhood (#40, reuses the new
   calendar component).
4. **P2 polish** as capacity allows — explainer (#41) pairs naturally with the
   calendar work.

Keep every commit `tsc`-clean + `test:all`-green (CI gates on it). One validated push
per verified fix beats a batch of speculative ones — that's what ends the "20 builds,
same bug" loop.

---

## 6. Handoff compression note

`docs/HANDOFF.md §4` now points here for the DT6 backlog instead of duplicating it.
This doc is self-contained: a fresh session can read §0 + §2 + §3 and start work
without re-deriving anything. Don't re-explore the codebase — the file:line anchors
above are current as of this session.
