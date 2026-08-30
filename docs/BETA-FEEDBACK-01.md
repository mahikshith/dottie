# 🐛 Beta Feedback — Round 1 (first on-device test, 2026-08-30)

First real device test of the EAS/GitHub-Actions APK. App installs & runs. Below is every
issue the owner reported, triaged. Status: `TODO` / `WIP` / `DONE`. Verify each on a rebuild.

> Guiding principle that ties most of P1 together: **DON'T ASSUME A PHASE.** On a fresh
> install the user hasn't logged a period yet, so we must NOT pretend they're in "follicular,
> Day 1." Ask them to log their period + mood first; only then show phase-derived content
> (Daily Decode, feelings, calendar phase, week-ahead).

## P0 — Blocker (app-breaking)

1. **[WIP] White-screen freeze on Circle (Community) and You (Profile) tabs.** Tapping either
   → entire screen goes white, back button unresponsive, must force-close.
   Files: `app/(tabs)/community.tsx`, `app/(tabs)/profile.tsx`.
   - Read-through found no obvious first-run null (companion/levelProgress/streak/feed all
     guard). Added a root **ErrorBoundary** (`src/components/ErrorBoundary.tsx`, wired in
     `app/_layout.tsx`) + `getCompanion` fallback. Next build will either fix it or SHOW the
     exact error text on-screen → then fix precisely.

## P1 — Core logic: stop assuming a phase before the user logs

2. **[TODO] Onboarding/first-run assumes follicular + "Day 1".** No period logged yet →
   don't assume. Prompt the user to log their last period first.
3. **[TODO] Home (Today) shows phase-derived "top feelings" (tired, introspective, bloating,
   low energy, headache) with no data logged.** Gate these until the user logs period + mood.
   File: `app/(tabs)/home.tsx`.
4. **[TODO] Daily Decode shows a generic template ("energy is rising, estrogen climbing…")
   before any period/mood is logged.** Don't show Daily Decode on Home until there's real
   data (period logged + a full check-in). "Dottie is still learning your rhythm" copy is FINE
   as the pre-data state.
5. **[TODO] Calendar assumes a phase.** Popover + calendar face show "follicular / your
   initial phase, day 25" with no data. Must be **dynamic** (derived from logged data) and,
   when unknown, tell the user we don't know their phase yet instead of guessing.

## P1 — Placement / gating

6. **[TODO] Move the streak + gems (Day-1 streak, 32 gems) OFF the Today page → into Learn.**
   Gamification belongs in Learn, not the daily home. Files: `app/(tabs)/home.tsx` (remove),
   `app/(tabs)/learn.tsx` (add).

## P2 — Daily check-in UX (`home.tsx` + check-in components)

7. **[TODO] Symptom intensity is undiscoverable.** Currently tap-once add / tap-again change
   intensity / tap-again remove — only the COLOR changes, shown as a "dot". Users won't know
   to tap 2–3× unless they scroll to the "tap once to add…" hint. Show intensity with an
   **emoji / visual indicator beside the option** (keep the color change too). Make the
   interaction self-evident on first use.
8. **[TODO] Add more options per symptom group.** Sleep (has insomnia, vivid dreams → add
   more), plus energy, skin, and body-feeling groups need more choices.

## P2 — Cycle / Calendar (`app/(tabs)/calendar.tsx`)

9. **[TODO] Glass day-popover has no real backdrop blur** — background still visible and the
   text overlaps it. Implement an actual blur/scrim behind the popover (expo-blur) + solid
   enough surface that text is legible.
10. **[TODO] Popover copy is static** ("Fresh energy is rising / warm feels possible today").
    Make it dynamic per the day's real (logged) phase.
11. **[TODO] "Week ahead" is not dynamic** — repeats "window soon / restock supplies". Derive
    from real predictions once data exists.
12. **[TODO] Large empty gap in the cycle section** — tighten layout.

## P2 — Learn (`app/(tabs)/learn.tsx`, lesson/quiz/exercise screens, content)

13. **[TODO] The connector line ("aurora stream") between lessons overlaps finished lessons.**
    Fix the path so it sits behind/between nodes cleanly.
14. **[TODO] Lessons aren't interactive.** Tapping gives brief info; "already complete" pops a
    **WHITE** "past lesson complete" dialog (not themed) — should match the warm UI.
15. **[TODO] "Practice" doesn't navigate to a practice screen.** Wire the redirect.
16. **[TODO] Make Learn Duolingo-fun & dynamic:** show the user's **selected Spirit Companion
    /emoji**; on a wrong answer NUDGE ("almost! try again") with **hints**, not a dead end.
17. **[TODO] Add more exercises** — only 3 today. Author more. File: `src/content/exercises.ts`.
18. **[TODO] Add phase-aware + skill-level content** (basics vs deep-dive). Advanced users who
    already know their phase shouldn't be stuck on basics — offer deeper lessons so engagement
    doesn't drop.

---

### Suggested execution order
1. **P0 crash** (this build: ErrorBoundary + fallback → diagnose/fix) — unblocks re-testing.
2. **P1 "don't assume a phase"** cluster (2–5) — the biggest correctness theme; do together.
3. **P1 placement** (6) + **P2 check-in UX** (7–8).
4. **P2 calendar** (9–12).
5. **P2 Learn** (13–18) — largest chunk; likely its own pass.

Each tier → rebuild via GitHub Actions → owner re-tests on device. Nothing is runtime-verified
except by on-device testing (tsc/bundle only prove it compiles).
