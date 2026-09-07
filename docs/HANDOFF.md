# 🌱 Dottie — Session Handoff

**Updated:** 2026-09-06 · DT24–DT27 complete, awaiting device round · branch `gemini-v2`
**Owner device:** Nothing Phone (Android). Not MIUI.

> This file + `CLAUDE.md` is everything. Do NOT re-explore the codebase.
> §1 is the open work. §2 is what to know before touching anything.

---

## 1. OPEN

**DT16 through DT29 are done and pushed.**

### Look at this FIRST, and it needs no APK
`docs/companion-preview.html` — every companion in every expression, from the
same geometry the app draws (`npx tsx scripts/companion-preview.ts`). Review
art there, never blind into a 25-minute build.

### Verify on the next APK — DT24
1. **Mark ONE day.** Only that day goes solid. The estimated bleed around it
   is a paler wash, and the legend now separates "Period · you logged" from
   "Menstrual (est.)". They were the same rose, which is why one tap looked
   like it had claimed the week.
2. **Quick log.** The ⚡ chip above the grid turns every past day into a
   one-tap toggle — no sheet, no Done. The mode is remembered. Tap it off and
   the day sheet behaves exactly as before.
3. **A stale calendar goes quiet.** More than a week past the expected cycle
   the grid stops colouring and says why, instead of painting every month
   luteal from one old anchor.
4. **Ovulation and fertile together.** The ovulation day keeps the fertile
   fill and adds a bright ring plus a corner pip, so a day that is both reads
   as both.
5. **Onboarding.** Picking "a week or two" now names the exact date it will
   record, and says the shaded days around it are an estimate. Six reminder
   options instead of three, and Home links to the full page.

### Verify on the next APK — DT25
6. **The calendar in words.** Under the grid, a chip toggles the colour key
   for a dated list of the month: "29–31 Aug · 3 days · Luteal", with what
   the phase means under it. The grid stays the default; the choice is
   remembered. Logged runs are badged RECORDED BY YOU, everything else
   ESTIMATED, and a stretch past the grace says nothing is estimated there.
   The list REPLACES the key rather than stacking under it, so the
   week-ahead strip below does not move (the owner's overlap note).
   It cannot disagree with the grid: `dayMark()` in
   `src/engine/calendar/day-marks.ts` is the only thing that decides what a
   day is, and `test:ranges` checks the list against the grid cell for cell
   over 200 random months.

### Verify on the next APK — DT26 / DT27
7. **The companions were redrawn.** Each species has its own build now — a
   leggy fawn, a squat barn owl (no more teddy ears), a slim cat. Bigger heads,
   bigger eyes. And the motion has weight: they crouch before a jump, land
   heavy, and their ears and tails lag a beat behind the body.
   `docs/companion-preview.html` shows every one without a build.
8. **Welcome screen.** The first screen now carries the three claims —
   on device, no account, works in airplane mode — above "Let's Get Started",
   and the 🩷 emoji that stood in for a companion is the drawn rig.
9. **Learn path.** Nodes 62 → 88px and checkpoints every four lessons. The
   companions I scattered down the gutters in DT27 are GONE — they made the
   tab scroll like treacle (see below) and overlapped the labels.
10. **Streak week.** The celebration now shows the seven-day strip with the
   live run in a capsule — built only from days the app actually holds.

### DT28 — the lag, and the fox nobody chose
- **Learn scroll jank: fixed.** One `CompanionCreature` is ~10 <Svg> surfaces
  (a layer per limb group) plus six Reanimated loops. Six per path, every path
  mounted in one ScrollView — well over a hundred animated SVG surfaces during
  a gesture. Removed. The trail keeps only the hopping companion on the current
  node, which carries meaning rather than decoration. **If the cast ever comes
  back it must be ONE static Svg per creature, no rig.** The node model and the
  trail geometry are memoised now, and `PathTrail` is `memo`'d with a stable
  `openLesson`, so a scroll no longer rebuilds ninety nodes.
- **Welcome screen shows the app ICON, not a companion.** The companion is
  chosen three screens later; leading with one told the user their pick was
  already made. Five claims now, and the screen scrolls so the CTA can never
  land under the nav bar.

### DT29 — the prediction round
The owner's line was "the entire app logistics depends upon the prediction",
and the reference doc's own §9 was the to-do list.
- **Two dead parameters are live.** `age` was read by the prior and written by
  NO screen, ever. `recentWeightChangeKg` needed a history and the profile held
  one snapshot. Both now have a source; weight is dated readings in
  `Storage.weightLog`.
- **Stress and sleep are a 7-day average**, which is what `PredictionInput`
  always claimed. They were today's single check-in, or nothing.
- **Every condition explains itself** — what it is, why we ask, what it does to
  the maths — behind a `?` on its own row, because ticking is the expensive
  action and finding out should not require it.
- **`about-you` is now the editable profile.** Age, cycle length, weight,
  height, conditions. Saving re-runs the forecast and reports the confidence
  before → after.
- **You → "How your forecast works"** — the confidence broken down, what the
  median and ± actually mean, every input including the ignored ones, and a
  ranked list of what would sharpen it. `test:improve` pins that the advice
  never promises past the biological ceiling.

### Still owed on the prediction (DT29 deferred)
- **Measured signals (LH test, waking temperature, cervical fluid).** The
  reference doc names these as the ONLY way past the variance floor, and the
  transparency screen now tells the user we do not collect them. That promise
  is a debt: engine + logging surface + fertile-window re-anchor.
- **`confidence.ts` and `health-adjustments.ts` (747 lines) are still dead.**
  Wire the 5-factor confidence in (it includes logging freshness and past
  accuracy, which the live 3-line heuristic ignores) or delete them.
- `predictionErrors` is still computed, stored, passed in and ignored.
- The add-to-circle condition picker has NOT been moved to `ConditionRow`, so a
  sister's conditions still have no explainer.

### Still owed from DT27
- The streak strip is only on the celebration modal. Duolingo's real trick is
  that the streak is visible EVERY day, not just on the day it fires — a
  compact strip on Home is the obvious next move.
- Section headers on the Learn path (Duolingo's coloured "SECTION 2, UNIT 4"
  banner) are not built.

### Open
- `[P2]` App-store rollout groundwork.
- `[P4]` Learn tab auto-advance report — re-verify.
- Notification DELIVERY still untested on a device — `expo-notifications`
  needs the dev build to actually fire.
- The owner's DT24 log shows a 30-second JS stall on app foreground
  (`js-thread-stalled ms=30937`) right after a background→foreground
  transition. It happened once and did not recur in the same session; if it
  shows up again, that is the next P0 and the diagnostics screen has the trail.
- Merging Practice and the quiz into one run (owner's DT19 suggestion).
  Deferred deliberately — structural, and not asked for again.
- Dead code: `confidence.ts` + `health-adjustments.ts` (747 lines).
- `PredictionInput.recentWeightChangeKg` is read by the model and collected by
  nothing; the transparency panel says so.
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
  (DT22 found three at ΔE 0.0), phases stay ΔE 40 apart, AND the opaque marks
  the grid actually paints stay ≥ ΔE 22 apart with every day number ≥ 4.5:1 on
  its fill. The second half exists because DT22's version passed while the
  screen was still wrong: it measured tokens, the grid drew 14% alpha.
- `test:transparency` — the prediction disclosure matches the predictor,
  including the inputs it ignores.
- `test:phase` — the predictor keeps counting past a late period, and anything
  DRAWING a phase stops at the grace period. The regression is a month of days
  60+ past a stale anchor: it must colour nothing.
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
