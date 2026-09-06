# 🌱 Dottie — Session Handoff

**Updated:** 2026-09-06 · DT23 complete, awaiting device round · branch `gemini-v2`
**Owner device:** Nothing Phone (Android). Not MIUI.

> This file + `CLAUDE.md` is everything. Do NOT re-explore the codebase.
> §1 is the open work. §2 is what to know before touching anything.

---

## 1. OPEN

**DT16 through DT23 are done and pushed. The owner's DT23 verdict on the last
build: "everything looks completely fine, I don't see any kind of major
issues" — the four items below are what they raised.**

### Look at this FIRST, and it needs no APK
`docs/companion-preview.html` — every companion in every expression, from the
same geometry the app draws (`npx tsx scripts/companion-preview.ts`). Review
art there, never blind into a 25-minute build.

### Verify on the next APK — DT23
1. **The calendar in bright light.** Every mark is now OPAQUE — composited over
   the aurora ground in `src/theme/blend.ts` — so a day's colour no longer
   depends on which bloom is behind it. The old fills were 14% alpha, i.e. 86%
   background; that is why the phase and the aurora looked the same, and why
   the DT22 colour audit could pass while the screen looked wrong. Marks are
   ≥ ΔE 57 apart as drawn and every day number clears 4.5:1 on its fill.
2. **Home asks the mood ONCE.** The question deck now takes what the check-in
   already holds and drops anything duplicating it; the two mood questions in
   the defaults were replaced with ones the app cannot answer for itself.
3. **The conditions list.** Nineteen entries, each with its own icon, one
   shared list behind onboarding and add-to-circle. Nine new options
   (perimenopause, postpartum, breastfeeding, fertility treatment, menstrual
   migraine, anaemia, chronic pelvic pain…), each marked for whether it
   changes the forecast.
4. **"What shapes this forecast"** at the bottom of the science, on your
   calendar AND a sister's, collapsed by default. It lists every input, what
   it does, whether it is filled in — and the ones the model does NOT read
   (height, weight, activity, mood). Same disclosure as a sheet in the export.

### Open
- `[P2]` App-store rollout groundwork.
- `[P4]` Learn tab auto-advance report — re-verify.
- Notification DELIVERY has still never been tested on a device;
  `expo-notifications` needs the dev build to actually fire.
- Merging Practice and the quiz into one continuous run (owner's DT19
  suggestion). Deferred deliberately — structural, and not asked for again.
- Dead code: `confidence.ts` + `health-adjustments.ts` (747 lines). Note that
  `health-adjustments.ts` implements stress/sleep adjustments the predictor
  does its own simpler version of — deleting it is safe, but read both first.
- `PredictionInput.recentWeightChangeKg` is read by the model and collected by
  nothing. The transparency panel says so out loud, which is the honest state;
  wiring it would mean asking for weight, which is not a question this app
  should put on a mood screen without a reason.
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
