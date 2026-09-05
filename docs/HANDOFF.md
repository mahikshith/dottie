# 🌱 Dottie — Session Handoff

**Updated:** 2026-09-05 · DT21 complete, awaiting device round · branch `gemini-v2`
**Owner device:** Nothing Phone (Android). Not MIUI.

> This file + `CLAUDE.md` is everything. Do NOT re-explore the codebase.
> §1 is the open work. §2 is what to know before touching anything.

---

## 1. OPEN

**DT16, DT18, DT19, DT20 and DT21 are all done and pushed. Five device rounds
are stacked in the next APK** — most of it has never been seen rendered.

### Look at this FIRST, and it needs no APK
`docs/companion-preview.html` — open it in a browser. Every companion in every
expression, rendered from the same geometry the app draws
(`npx tsx scripts/companion-preview.ts` regenerates it). This exists because the
companions were called insects in three rounds and each fix was shipped blind
in a 25-minute build. **Review art there, not on the phone.**

### Verify on the next APK — DT21
1. **Every toggle in the app.** `AuroraSwitch` replaced React Native's
   `<Switch>` everywhere (Reminders, Medications, Diagnostics, Ghost Mode).
   The off state must be a visibly EMPTY track with the knob at the left —
   that was the whole complaint. Ghost Mode is the cream screen: it passes
   `surface="light"`, so check its off track is visible there too.
2. **Reminders.** Three groups now — every day / around your cycle / your own.
   Exact times on the check-in and hydration nudges, a 1–5 day lead on the
   heads-up, the did-it-start check, phase changes, a weekly recap, and
   user-written reminders at any time. The cycle group is disabled until a
   prediction exists. Nothing here has ever been delivery-tested on a device:
   `expo-notifications` needs the dev build to actually fire.
3. **The mood map toggle.** 48pt row, 10pt slop, a labelled Show/Hide pill
   instead of a bare caret — and the duplicated "Your mood map" title inside
   the panel is gone.
4. **Companion picker** (onboarding + Profile → companion). ONE companion per
   card, cycling eight moods with the mood named underneath. Never three.
5. **Today → Cycle.** The calendar's entrance is opacity-only now; the page
   should not visibly assemble itself from the bottom.
6. **Follicular is blue** (`#4FB8FF`), not the accent teal. Check the calendar
   legend and the mood map on Home no longer share a green.
7. **Quiz "Try again"** sits on an opaque footer with its own tinted fill —
   nothing should scroll through it.

### Open
- `[P2]` App-store rollout groundwork.
- `[P4]` Learn tab auto-advance report — re-verify.
- Merging Practice and the quiz into one continuous run (owner's DT19
  suggestion). Deferred deliberately — it is a structural change to the learn
  flow, not a fix, and it was not asked for again.
- Dead code: `confidence.ts` + `health-adjustments.ts` (747 lines, nothing
  imports them). Wire in or delete.
- `buildLessonScript` in `dialogue.ts` is still unrendered by any screen —
  kept and tested deliberately (the lesson chat was reverted in DT16), but it
  is dead weight until something wants a scripted conversation.
- The ESLint config predates v9 and `npm run lint` cannot run. `test:all` does
  not depend on it, so this is cosmetic — but it means no linting at all.

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
