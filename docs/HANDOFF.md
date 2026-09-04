# 🌱 Dottie — Session Handoff

**Updated:** 2026-09-04 · after Device Test 16 · branch `gemini-v2`
**Owner device:** Nothing Phone (Android). Not MIUI.

> This file + `CLAUDE.md` is everything. Do NOT re-explore the codebase.
> §1 is the open work. §2 is what to know before touching anything.

---

## 1. OPEN — DT16 device feedback, 5 of 10 done

Owner sent 10 screenshots. Done and pushed: tab transition, safe area,
lesson revert, insect companions, companion consistency. **Remaining five,
in the owner's priority order:**

| # | What | Where |
|---|---|---|
| 6 | **Week-ahead strip + colour legend move directly UNDER the month grid.** Today they sit far below, so you scroll away from the calendar to learn what its colours mean. | `app/(tabs)/calendar.tsx` — move the `weekAhead` and `legend` blocks up to just after the grid `Animated.View` |
| 7 | **Cream panels → aurora.** "Send a little warmth" cards, the sister card in Circle, and the created sister profile all render cream/white. Also: highlight "Tap to start tracking together" in a bright accent. | `app/(sisterhood)/circle.tsx`, `app/(sisterhood)/member/[id].tsx` |
| 8 | **Shadow Profile / Full view toggle is inert** — the user cannot reach Full view. Fix it, or delete the control if the states aren't meaningfully different. | `app/(sisterhood)/member/[id].tsx` |
| 9 | **Conditions picker: more options + multi-select.** Only PCOS/Thyroid/Endometriosis today; owner wants PCOD, hypo/hyperthyroid etc. and several selectable at once. | `app/(sisterhood)/add-member.tsx` |
| 10 | **Sister selected ⇒ sister's data everywhere on Cycle.** Graphs/explainer must describe HER. Coinciding predicted days should GLOW; the sister curve should read "on", not off-colour. | `app/(tabs)/calendar.tsx` (`logTarget`), `src/engine/calendar/cycle-overlap.ts` |

Tasks #86–#90 in the task list mirror this table.

### Also still open
- `[DT16]` The **quiz** now carries the conversation (`reactTo`). Owner asked
  for it to be "funny, interactive, expressive" — currently it's only the
  rotating opener + streak line. Worth more once the five above land.
- `[P2]` App-store rollout groundwork.
- `[P4]` Learn tab auto-advance report — re-verify.

---

## 2. Before you touch anything

**Run `npm run test:all` before every commit.** 22 suites, includes
`tsc --noEmit`. It is the only gate — CI runs a subset.

**Push = APK.** Any push to `gemini-v2` builds one (~25 min, Actions →
Artifacts). The owner installs it by hand, so **a broken build costs them a
round.** Don't stack many rounds into one APK: DT8–DT14 went to a device
together and produced a white screen that took a whole session to chase.

**Two audits exist because per-screen fixes kept drifting:**
- `audit:safearea` — every scrolling screen must pad both ends. This bug was
  reported in DT3, DT6, DT7 and DT16; 20 screens were unprotected.
- `audit:ui` — every tappable has an onPress.

**The white screen (DT15) was never root-caused.** It stopped after the root
error boundary + lazy native loads landed. If it returns, the boundary now
shows the real error with a "Send this error →" button — get that text
first, don't guess. Everything ruled out is in commit `73e65e8`.

---

## 3. Where things live

- **Predictor** — `src/engine/prediction/`. Full write-up with measured
  accuracy: `docs/PREDICTION-ENGINE.md`. Two files there
  (`confidence.ts`, `health-adjustments.ts`, 747 lines) are DEAD — nothing
  imports them. Wire in or delete.
- **Calendar** — `app/(tabs)/calendar.tsx` (1600+ lines), engines in
  `src/engine/calendar/`.
- **Learn content** — 77 lessons / 74 quizzes / 427 questions. 51 came from
  `npx tsx scripts/import-curriculum.ts` → `src/content/curriculum.generated.ts`.
  **Never hand-edit the generated file.**
- **Companions** — the drawn rig `src/components/ui/creature/` is the ONLY
  companion art. `CompanionExpressions` shows one in three moods.
- **Export** — `src/export/` writes a real .xlsx with native charts, by hand.

## 4. Docs (open only when named)

`PREDICTION-ENGINE.md` · `FEATURES-AND-RESEARCH.md` · `DAY-SUGGESTIONS.md` ·
`ONBOARDING-AND-WALKTHROUGH.md` · `LEARN-REDESIGN-*.md` ·
`BETA-TESTING-GUIDE.md` · `LOTTIE-SOURCING.md` · `SESSION-CONTEXT.md`
