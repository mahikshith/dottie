# 🎨 Redesign Plan — Round 2 (from `docs/testing.md`, on-device test #2)

Source: owner's annotated screenshots in `docs/testing.md`. This is the execution plan.
Workflow: commit locally, **do NOT push** until a batch is finished and the owner approves a
preview build. `[R]` = needs research/design exploration. Status: TODO / WIP / DONE.

> North star (owner): *keep the user journey first; be genuinely different, warm, and
> energetic (Duolingo-level fun) — not placeholder-y or clinical. Don't show data we
> haven't earned (no assumed phases/feelings before the user logs).*

## ▶️ NEXT SESSION — START HERE (current state)
**Everything below is on GitHub, pushed with `[skip ci]` (NO build has run since device test #1).**
Verified each step: `tsc` 0 + bundle clean (4.92 MB). Shipped on `design-v2`:
- **Batch 1** (crash + quick wins) · **Theme A** "don't fake a phase" · **alert-theming** (0 native
  popups) · **Batch 4 — Learn overhaul (E1–E7)** — see §0.10 in HANDOFF.
- **Batch 3 — mood & check-in (Theme C):** C1 mood recolour RADIATES from the tapped emoji +
  slower reveal · C2 explicit Mild/Moderate/Strong severity control (was hidden multi-tap) · C3
  `AuroraSlider` (PanResponder, snaps 1..5) replaces the 1–5 grid · **mood-word layer** (owner
  chose it): `MoodWordPicker` names feelings under the valence scale, stored as emotional logs.
- **Theme D — calendar:** D2/D3 day sheet now leads with "YOUR DAY" (log fast) and pushes the
  "cosy & covered" suggestions BELOW under "FOR THIS PHASE"; D4 week-ahead gated behind real data.
- **Batch 5 — Community F1:** prominent 2-col SPACE GRID + sort filters (Trending/New/Most
  hugs/Most answered); selecting a space pulls it to a header with back control. F2/F3 remain.
- **G2** off-theme cream "white pane" (new-post moderation card) retinted to aurora glass.

**Remaining backlog (not yet built):** Learn **E8** (phase-aware / skill-level content TIERING —
the pace chip toggles locks, not depth) + **E9** ("later"); Community **F2** (personalized feed) +
**F3** (replies — "later"). Everything else from `docs/testing.md` is addressed.
**No preview build has run yet** — the whole redesign is UNVERIFIED on device; a preview APK is
the obvious next step (push WITHOUT `[skip ci]`).

**Resume options:**
1. **Build preview:** `git push origin design-v2` (a normal push, NO `[skip ci]`) → GitHub
   Actions builds the APK (~20 min) → owner installs & re-tests **Batch 1 + Theme A** on-device.
2. **Keep building:** remaining Theme D (D3 dynamic popover copy / D4 week-ahead), the
   systematic **alert-theming** pass (30 native `Alert.alert` → `CelebrationDialog`), then
   **Batch 3 (check-in/mood)** and **Batch 4 (Learn overhaul)**.
NOTE on push policy: owner wants commits backed up but NOT to trigger CI/CD unless a preview is
explicitly approved — use `[skip ci]` on the tip when backing up without building.

Env: prefix every node cmd with `$env:Path = "C:\Program Files\nodejs;" + $env:Path`.
Verify: `npx tsc --noEmit` (expect 0). Bundle: `npx expo export --platform android
--output-dir <tmp> --no-minify`. `gh` is authed. Owner has an Android phone.

---

## ✅ P0 — Circle/You crash — **DONE (committed `2c63ede`)**
"Maximum update depth exceeded" (infinite re-render) from Zustand selectors returning fresh
references on empty state. Fixed `selectFeedForSpace`/`selectRepliesForPost`/
`selectNudgesForMember` (stable EMPTY arrays) + memoized `selectLevelProgress`. Verify on next
preview: Circle + You should open normally.

---

## Theme A — "Don't fake it": reasoning engine, no placeholders `[R]`
The app assumes a phase and shows generic content before any data. Root fix = a small
**reasoning/gating layer**: until the user logs a period (and/or mood), we either ask them to
log, or show honest "still learning" states — never a fabricated phase/feeling.

- **A1** Today page shows luteal/"grateful/chocolate" etc. while the user is (per their own
  words) menstrual → wrong. Drive Today content from the **real logged phase**; if unknown,
  don't guess. (`app/(tabs)/home.tsx`, phase/predict engines)
- **A2** "Top feelings" (tired/introspective/bloating…) are placeholders shown with no data.
  Gate behind logged data, or reframe as "tell us how you feel" collection. `[R]`
- **A3** Daily Decode shows a generic template with no user data. Gate it until there's enough
  signal; otherwise keep the honest "Dottie is still learning your rhythm."
- **A4** Calendar assumes a phase ("cosy & covered", "day 25") for every day. Make dynamic from
  real data; when unknown, say so and invite logging.

## Theme B — Today page (`app/(tabs)/home.tsx`)
- **B1** Move streak + gems OFF Today → onto **Learn**, at the top, minimal: 🔥+count and 💎+count
  only, no words. (also Theme E)
- **B2** Remove placeholder "top feelings" pane (see A2) — collect real data instead. `[R]`
- **B3** Bottom nav (tab bar, `src/components/ui/aurora/AuroraTabBar.tsx`): drop the hard
  rectangle; use a color that blends with the UI; the **glass highlight moves to the active
  tab**. Make a clean design choice. `[R]`

## Theme C — Mood + check-in (`home.tsx`, daily check-in components)
**STATUS: Batch 3 DONE ✅ — C1 reveal-origin+slower · C2 explicit severity control · C3
AuroraSlider + more options · mood-word layer (MoodWordPicker) added (owner's chosen resolution
of "more moods"). All on GitHub.**
- **C1** Mood color fill must **originate from the tapped swatch** (radial reveal from the touch
  point), a touch slower; the origin point is the point. More mood options (periods bring many
  moods). `[R]` (there IS a mood-reveal in design-v2 — audit `AuroraProvider`/mood-reveal)
- **C2** Severity UX: tapping a symptom 2–3× to raise intensity (shown only as color/dots) is
  undiscoverable. Replace with an obvious control — a **slider or segmented intensity** that
  reads at a glance. `[R]`
- **C3** Way more options for body feelings, energy, skin, sleep, stress. Replace the 1–5 number
  (space-hungry) with a compact **slider** (fewer taps).

## Theme D — Calendar (`app/(tabs)/calendar.tsx`)
**STATUS: DONE ✅ — D1 blur (Batch 1) · D2/D3 day sheet leads with log-first, suggestions pushed
below · D4 week-ahead gated behind real cycle data. On GitHub.**
- **D1** Day popover: real **backdrop blur + dim** behind it (expo-blur), so the page isn't
  visible through it and text stops overlapping.
- **D2** Remove/относить the repeated "warm & simple / cosy & covered" per-day placeholder copy;
  users often just want to log a period fast — don't bury that. Push flourish down.
- **D3** Dynamic popover copy from the real phase (ties to A4). Close the big empty gap.
- **D4** Week-ahead: make dynamic (not repeated "window soon / restock supplies").

## Theme E — Learn (biggest chunk) `[R]` — Duolingo-grade path
Files: `app/(tabs)/learn.tsx`, `app/lesson/[id].tsx`, `app/quiz/[id].tsx`,
`app/exercise/[lessonId].tsx`, `src/content/exercises.ts`, aurora path components.
**STATUS: E1–E7 DONE (Batch 4, local, ahead 5). E8/E9 remain (see below).**
- **E1** Path: replace grey connector with a clean **concentric-tube / node trail** — completed
  node glows, next is highlighted; route the trail through the side empty space; a small glowy
  marker shows "you are here"; **auto-scroll** to the current lesson on open.
- **E2** The **selected Spirit Companion** appears on the path, animated (e.g., bunny hops),
  pointing at the current stage; fill empty side space with character animation.
- **E3** Progression is broken — can't advance past completed lessons. Fix lesson→next unlocking.
- **E4** "your pace" labels ("know basics") don't fit their curved pills/icons — fix layout;
  one-word labels, no full sentences; no glass on the lock; friendlier lock (energetic, not
  gloomy).
- **E5** Lesson-complete + "already complete" dialogs are **white/off-theme** and space-hungry →
  themed **celebration** (companion expression by score — 100% = "mind blown", streak/diamond
  bump animation), and a compact next/retry control (small arrow, not a giant "Continue").
- **E6** Quiz feedback: on a wrong answer, **show the correct answer + a short why** (not just
  "1/4"); nudge/hints ("almost! try again"); companion expression reacts. Remove default "soft
  snacks" copy. Replace the big "Continue" with a compact arrow; use the freed space for the
  explanation. Drop the "practice" sentence header → show the phase/topic instead.
- **E7** Companion expressions/score reactions like Duolingo (mind-blown at 100%, encouragement
  on miss). `[R]` research the interaction set + assets (Lottie/emoji states).
- **E8** More exercises (only 3 today) + **phase-aware & skill-level** content (basics vs
  deep-dive) so advanced users aren't stuck on basics. `[R]`
- **E9** The transparent lesson pane should be opaque/themed; more lessons/animations (later).

## Theme F — Circle / Community (`app/(tabs)/community.tsx`) `[R]`
**STATUS: F1 DONE ✅ (space grid + sort filters, on GitHub). F2 (personalized feed) + F3
(replies / follow) REMAIN.**
- **F1** Space chips (PCOS Warriors etc.) are side-scroll only. Show them **prominently first**
  (grid) + trending; on selecting one, transition it to the top and reveal posts below with
  **sort filters** (trending / new / upvotes / most-answered).
- **F2** Personalize the feed to the user's interactions/relatable posts. `[R]`
- **F3** Replies to posts (currently can't) — later. Follow non-anonymous users — later.

## Theme G — Orphan / broken screens
**STATUS: G1 DONE ✅ (home shows `q.rawText`). G2 DONE ✅ — the "white pane" was the new-post
moderation card (hardcoded cream + near-white text); retinted to aurora glass.**
- **G1** The context-less screen with repetitive headings (`184039`) — identify & remove or
  rebuild with a real purpose.
- **G2** The plain white pane (`184215`) that ignores the theme — identify & theme or remove.

---

## Proposed execution order (each = local commits; preview only after owner OK)
1. **DONE** P0 crash.
2. **Batch 1 (quick, high-impact, low-risk):** B1 streak/gems→Learn+minimize · B3 tab-bar redesign ·
   E5/E6 themed dialogs + compact quiz feedback + correct-answer reveal · D1 calendar blur ·
   G1/G2 kill/theme orphan white panes.
3. **Batch 2 (honesty layer):** Theme A reasoning/gating (A1–A4) + D2/D3/D4 dynamic calendar +
   B2 Today feelings.
4. **Batch 3 (check-in/mood):** C1 mood-origin reveal + more moods · C2/C3 severity slider + more options.
5. **Batch 4 (Learn path):** E1–E4, E7, E8 — the Duolingo overhaul (largest; own passes + research).
6. **Batch 5:** Community F1/F2 (F3 later).

Owner input needed before deep work: confirm order; and design calls on E (path/character
interaction set), C (mood palette + severity control), B3 (tab-bar look), A (how aggressively to
gate vs. collect).

---

## Follow-up discovered during Batch 1
- ✅ **DONE — alert-theming:** ALL 30 native `Alert.alert` app-wide are now the warm
  `showAppDialog` / `CelebrationDialog` (global host `src/components/ui/appDialog.tsx`,
  mounted once at root in `app/_layout.tsx`; `danger` action variant for destructive
  confirms). **ZERO OS-white popups remain** (verified: `grep -r Alert.alert app` = 0).
  Committed locally in 4 commits (`9fb1fe3`, `eb6ee9e`, `531b56a`, `8ee54b2`).
  Follow-up polish: the 7-option Report picker uses stacked ghost actions — could become a
  dedicated action-sheet later.
- **Today check-in showed the same generic companion wrapper for every question**
  ("WE ARE SO CLOSE!! Can you FEEL it?!") instead of the real question — now shows `q.rawText`
  (G1, done). The companion wrapQuestion voice itself needs a rework so it's warm AND specific
  (Theme C).
