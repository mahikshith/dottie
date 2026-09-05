# 🌱 Dottie — Session Handoff

**Updated:** 2026-09-05 · DT22 complete, awaiting device round · branch `gemini-v2`
**Owner device:** Nothing Phone (Android). Not MIUI.

> This file + `CLAUDE.md` is everything. Do NOT re-explore the codebase.
> §1 is the open work. §2 is what to know before touching anything.

---

## 1. OPEN

**DT16 through DT22 are all done and pushed. Six device rounds are stacked in
the next APK.**

### Look at this FIRST, and it needs no APK
`docs/companion-preview.html` — every companion in every expression, rendered
from the same geometry the app draws (`npx tsx scripts/companion-preview.ts`
regenerates it). Review art there, never blind into a 25-minute build.

### Verify on the next APK — DT22
1. **A quiz opens.** The P0. Root cause was hydration: `populateStoresForUser`
   fires thirteen repo reads through one `Promise.all`, one rejection killed
   the lot, and the catch logged to a `__DEV__` console (invisible in the
   owner's build) while the app carried on with NO content engines. Every
   screen reading bundled content kept working; the quiz, which needs the
   engine, sat on its spinner forever. Now: hydration retries once and reports,
   the root layout shows its recovery screen with a working Try again, and the
   quiz screen builds its own engine from bundled content after 2.5s rather
   than waiting for one that is not coming. `test:quiz` walks all 74 quizzes.
2. **Add to circle, and Today's check-in.** Both were `presentation: 'modal'`,
   which on Android hands the screen ZERO safe-area insets — so the CTA sat
   under the nav bar and the check-in title ran through the status bar, while
   every padding expression was correct. Also killed the duplicate native
   header on add-to-circle.
3. **Phase colours.** Menstrual is rose-red, follicular cyan, ovulatory citron,
   luteal violet. Three of the old four were byte-identical to a mood palette
   colour. Check the legend against the mood map on Home.
4. **Every toggle**, including the onboarding "Nudges from me?" screen, which
   was still hand-rolled: its ON state filled the track with the accent and
   drew the thumb in 6% white, i.e. invisible.
5. **The companions are different people now.** Take the same quiz as Pip and
   as Nyx: different openers, different reactions, different faces, different
   idle motion, different streak thresholds. Same facts, verbatim.
6. **Medications** takes more than one type per plan.
7. **Cycle tab** has a reminders link directly under the legend.
8. **The export** has a Reminders sheet — built-in, custom and medication.

### Open
- `[P2]` App-store rollout groundwork.
- `[P4]` Learn tab auto-advance report — re-verify.
- Notification DELIVERY has still never been tested on a device.
  `expo-notifications` needs the dev build to actually fire; the toggles and
  persistence are verifiable by reading, delivery is not.
- Merging Practice and the quiz into one continuous run (owner's DT19
  suggestion). Deferred deliberately — structural, and not asked for again.
- Dead code: `confidence.ts` + `health-adjustments.ts` (747 lines). Also
  `PredictionInput.recentWeightChangeKg`, which nothing collects — deliberately
  NOT wired to a new check-in question (weight is not a thing to ask a
  cycle-tracking user for on a mood screen).
- The ESLint config predates v9 and `npm run lint` cannot run.

---

## 2. Before you touch anything

**Run `npm run test:all` before every commit.** 24 suites, includes
`tsc --noEmit`. It is the only gate — CI runs a subset.

**Push = APK.** Any push to `gemini-v2` builds one (~25 min, Actions →
Artifacts). The owner installs it by hand, so **a broken build costs them a
round.** Don't stack many rounds into one APK: DT8–DT14 went to a device
together and produced a white screen that took a whole session to chase.

**Three audits exist because rules that nothing checks are just comments.**
Each was added after the same bug came back for the third or fourth time:
- `audit:safearea` — every scrolling screen must pad both ends. Reported in
  DT3, DT6, DT7 and DT16; 20 screens were unprotected.
- `audit:ui` — every tappable has an onPress, AND no banned primitive is in
  the tree: `<Modal>` (rule 10) and `<Switch>` (rule 22). Comments are stripped
  before matching, so the prose explaining why not to use them still passes.
- `audit:colour` — no phase colour may sit within ΔE 18 of any mood colour
  (DT22 found three at ΔE 0.0), and phases stay ΔE 40 apart from each other.
- `test:quiz` — opens EVERY lesson's quiz through the real engine, answers it
  and finishes it. Nothing had ever done that, which is why a quiz that only
  ever showed a spinner could ship.
- `audit:silent` — rule 18. `__DEV__` is false in the owner's build, so
  `if (__DEV__) console.warn` in a catch is silence. The rule was written after
  DT15 and applied to a handful of sites; DT18 found **62** still in place.
- And in `test:creature`, the C8 block: the six geometry signals that made the
  companions read as insects. Every one of them failed on the old rig.

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
- **Companions** — `src/components/ui/creature/`. The art is DATA in
  `geometry.ts` (pure shapes, one source of truth); `CompanionCreature` maps it
  to react-native-svg and `scripts/companion-preview.ts` maps the same data to
  `docs/companion-preview.html`. 26 expressions in `expressions.ts`; limbs
  swing from tagged joints. The C8 block in `test:creature` guards the
  anti-insect rules — read that file's header before touching the drawing.
- **Export** — `src/export/` writes a real .xlsx with native charts, by hand.

## 4. Docs (open only when named)

`PREDICTION-ENGINE.md` · `FEATURES-AND-RESEARCH.md` · `DAY-SUGGESTIONS.md` ·
`ONBOARDING-AND-WALKTHROUGH.md` · `LEARN-REDESIGN-*.md` ·
`BETA-TESTING-GUIDE.md` · `LOTTIE-SOURCING.md` · `SESSION-CONTEXT.md`
