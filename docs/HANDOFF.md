# 🌱 Dottie — Session Handoff

**Updated:** 2026-09-04 · DT16 complete, awaiting device round · branch `gemini-v2`
**Owner device:** Nothing Phone (Android). Not MIUI.

> This file + `CLAUDE.md` is everything. Do NOT re-explore the codebase.
> §1 is the open work. §2 is what to know before touching anything.

---

## 1. OPEN

**All ten DT16 items are done and pushed.** Waiting on a device round.

### Verify first on the next APK (all reasoned, none seen rendered)
1. **The companion redraw.** Owls got folded wings; Mira the butterfly became
   a deer. Neither has been looked at on a screen — the whole point was that
   they read as insects, so this is the one to eyeball first.
2. **The status veil.** Now exactly `insets.top`, opaque, no fade tail.
   Content should pass under the status bar cleanly with nothing dimmed
   mid-screen.
3. **Tab switches.** No scene animation at all now — the white glitch at the
   bottom should be gone.
4. **Select a sister on Cycle.** Every panel below the grid should be hers,
   and shared predicted days should glow gold.

### Open
- `[DT16]` The **quiz** carries the conversation now (`reactTo` drives its
  feedback panel). Owner wants it "funny, interactive, expressive" — today
  it is only the rotating opener + streak line. Worth more.
- `[DT17]` Liquid glass: **evaluated, answer is no.** rdev/liquid-glass-react
  is web DOM (CSS backdrop-filter + SVG feDisplacementMap); callstack's is
  iOS 26+ / Xcode 26 / RN 0.80+ and we are on RN 0.76.9 with an Android
  device. Depth should come from AuroraTabBar instead — no new dependency.
- `[P2]` App-store rollout groundwork.
- `[P4]` Learn tab auto-advance report — re-verify.
- Dead code: `confidence.ts` + `health-adjustments.ts` (747 lines, nothing
  imports them). Wire in or delete.

---

## 2. Before you touch anything

**Run `npm run test:all` before every commit.** 23 suites, includes
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
