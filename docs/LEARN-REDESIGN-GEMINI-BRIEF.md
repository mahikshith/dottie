# Learn Tab Redesign — Research Brief for External Agents

**Purpose.** A self-contained pack to hand to Gemini (or any other
subagent) so it can research the Learn-tab redesign in parallel with our
own build work. Nothing here assumes access to the Dottie repo — every
fact the agent needs is inline.

**How to use.** Each numbered section below (§1 → §6) is a **standalone
prompt**. Pick the ones you want to farm out and paste them one-per-task
into Gemini. Read the "PROJECT CONTEXT" section first — you'll paste
that verbatim as the preamble to every task so the agent has grounding.

---

## PROJECT CONTEXT (paste as the preamble to every Gemini task)

You are researching and designing for **Dottie**, a warm, local-first
women's-health and cycle-tracking mobile app.

- **Stack.** React Native + Expo (managed), TypeScript strict, Zustand
  stores, expo-router, expo-sqlite + MMKV for local storage. Design
  language is "Mood Aurora" — glassmorphism + aurora colours on a dark
  ground; palette recolours with the user's logged mood.
- **User modes.** teen, adult, endocrine (irregular cycles). Perimenopause
  and birth-control modes are on the roadmap.
- **Values.**
  1. Non-diagnostic (never say "you have X"; always "you may notice /
     often reported / worth mentioning to a provider").
  2. Local-first — nothing leaves the phone.
  3. Warm + supportive tone. Companions are named animals (Blossom the
     bear, etc.). No shame, ever.
  4. Every interaction offers a "not sure / skip" path.

**What the LEARN TAB is today.**
- A vertical, winding "aurora tube" path map of lesson nodes for the
  currently-active user mode. Current node pulses; a small companion
  hops on it. Auto-scrolls to the user's current lesson on focus.
- A pace toggle at the top: `new` (guided, sequential locks), `basics`
  (unlocked, self-directed), `deep` (currently just unlocks the same
  lessons — the "deep" content promise isn't kept yet).
- Tapping a lesson opens a reader: sections (heading / paragraph /
  fact / tip / callout), a "Practice" step of interactive exercises
  (5 types: pairs, order, fill-blank, tap-diagram, tap-word), then a
  quiz. Companion reacts to the score.

**Content that exists.**
- Shipped (in the app right now): 3 paths — Cycle Basics (4 lessons),
  Puberty 101 (3), Hormones 101 (7). Roughly 18 lessons live.
- Available but not yet imported: a full curriculum with **24 paths /
  93 lessons / 279 exercises / 558 quiz questions**. Every lesson
  carries `difficulty: beginner | moderate | hard`. Every quiz
  question carries `level: beginner | moderate | hard`. **We
  currently strip both fields on import** — so the tiering exists in
  the source but is invisible to the app.

The 24 paths available are:
`cycle_basics`, `hormones_101`, `menstrual_phase`, `follicular_phase`,
`ovulation`, `luteal_pms`, `period_products`, `nutrition`, `movement`,
`sleep`, `mood_mental`, `pain_management`, `skin_hair`, `digestive`,
`sexual_health`, `fertility_awareness`, `contraception`,
`tracking_skills`, `red_flags`, `pcos`, `endometriosis`,
`thyroid_endocrine`, `perimenopause`, `teens`.

**Existing engine we can lean on.**
There is a `resolveSubPhase()` function that maps the user's cycle
position to one of 9 sub-phases:
`menstrual_early`, `menstrual_late`, `follicular_early`,
`follicular_mid`, `follicular_late`, `ovulation_day`,
`luteal_early`, `luteal_mid`, `luteal_late_pms`.

**The redesign asks (from the owner).**
1. **Phase-aware content** — show learning that matches the user's
   current cycle phase (e.g. surface luteal lessons in the PMS week).
2. **Difficulty tiering within a lesson** — some way to serve easy,
   medium, or hard content matched to the learner's ability.

**Research already done by our team** (findings to build on, not
duplicate):
- **Duolingo**: their engagement secret is (a) tiny lessons, (b)
  adaptive difficulty *within* a lesson (last exercises get harder if
  you ace the first ones), (c) generous streak psychology (+40%
  7-day-streak retention after they lowered the bar to "one lesson"
  counting).
- **Khan Academy**: adaptive by pace + recommended-next rather than
  mid-lesson difficulty jumps.
- **Peer-reviewed cycle × learning research** (real papers):
  motor learning consolidates better around ovulation than luteal
  ([Brain Sci 2020](https://doi.org/10.3390/brainsci10100696));
  category learning shifts across phases
  ([Sci Reports 2023](https://www.nature.com/articles/s41598-023-48628-x));
  attention networks vary across all 5 sub-phases
  ([bioRxiv 2019](https://www.biorxiv.org/content/10.1101/717264.full.pdf)).
  **Practical read:** the science supports "here's what's most
  relevant to learn about right now," but NOT "your brain is better
  today." Copy must stay gentle.

---

# §1 — UI/UX Research: Duolingo & peers, applied to Dottie

**Paste the PROJECT CONTEXT above, then this prompt to Gemini.**

## Prompt

You are a senior mobile UX designer with 10+ years of experience on
health, education, and gamified consumer apps. I need a rigorous UX
research report for a redesign of the "Learn" tab of Dottie (see
context above).

**Deliverable.** A structured report of ~2,000 words that includes:

1. **A comparative teardown** of the Learn / lesson-path UX of at least
   these 5 apps: Duolingo, Headspace, Calm, Clue, Flo. For each: how
   they structure their path map or session list; how they mark "the
   current step"; how they gate progression; how they celebrate
   completion; how they surface today-relevant content on the tab; how
   they handle "I don't know where to start" for a new user. Include
   screenshots where you can link them, and cite sources.

2. **A pattern catalogue** of 8–12 concrete UI patterns from those
   teardowns that could apply to Dottie's Learn tab. For each: a name,
   a one-line description, the app(s) that use it, and a note on
   whether it would fit Dottie's Mood-Aurora design language (dark
   glassmorphism, warm/supportive tone, no shame).

3. **Specific recommendations** for the Learn tab covering:
   - Should we keep the vertical path map, or move to something else
     (grid of chapters, horizontally-scrolling weeks, etc.)? Justify.
   - How should the "for you today" content live alongside the general
     path? (Different tab? Card at top? Inline highlights?)
   - How should difficulty tiering be exposed — before a lesson (pick
     your depth), during a quiz (adaptive), or via separate paths
     entirely?
   - What are the "small win" moments we should build (Duolingo's XP
     unpredictability, streak celebration, chapter-complete moments)?
   - Anti-patterns to avoid — where does Duolingo cross into "guilt
     dashboard" territory, and how do we not do that in a HEALTH app?

4. **A one-page "north star" description** of what the redesigned
   Learn tab should feel like in 60 seconds of use, in prose — as if
   you were describing it to the person about to build it.

**Constraints.**
- Non-diagnostic tone at all times. No "your brain works better on
  Tuesday."
- Must accommodate three modes (teen / adult / irregular) and future
  perimenopause / birth-control modes without a rewrite.
- Local-first: no server calls, no login. Content and progress live
  on the device.
- Reduce-Motion accessibility must be honoured (all animations must
  have a static fallback).

**What NOT to do.**
- Do not just describe Duolingo — apply it to Dottie.
- Do not recommend any pattern that requires cloud sync or a login.
- Do not repeat the peer-reviewed cycle-science claims as "your brain
  is different." Frame as "content relevance," not neuro-hacking.

**Format the output as Markdown.** Include a Sources section with
hyperlinks.

---

# §2 — Content Strategy: mapping the 24 curriculum paths to sub-phases

**Paste the PROJECT CONTEXT above, then this prompt.**

## Prompt

You are a health-content strategist with a background in menstrual
health (clinician-adjacent — think a level of rigour similar to a
public-health educator). I need you to design the content mapping for
Dottie's phase-aware Learn tab.

**Deliverable.** A structured plan that includes:

1. **A phase → curriculum path map.** For each of the 9 sub-phases
   (menstrual_early, menstrual_late, follicular_early,
   follicular_mid, follicular_late, ovulation_day, luteal_early,
   luteal_mid, luteal_late_pms), rank the 24 curriculum paths (see
   PROJECT CONTEXT for the full list) by relevance to that sub-phase.
   Format as a table. Cite reasoning (1-2 sentences per top-3 path per
   sub-phase, e.g. "menstrual_early: 1) pain_management — cramps peak
   day 1-2; 2) menstrual_phase — the lesson content matches lived
   experience today; 3) period_products — practical need today").

2. **Lesson-level recommendations.** For each sub-phase, name the
   TOP 3 individual lessons (from the ~93 available, guess by path +
   title patterns) that would be most useful to surface. Format as a
   table with columns: sub-phase, lesson title (your best guess),
   which path it lives in, why-it's-relevant reason.

3. **A copy pattern** for the "For today" spotlight card that:
   - Explains WHY the recommendation exists ("Because your period is
     likely near…") without over-claiming.
   - Handles the "no cycle data yet" case honestly.
   - Handles the "user picked 'Not sure'" mode.
   - Handles PCOS / irregular users where phase confidence is low.
   Give me 3–5 sentence variants for each situation.

4. **A difficulty-tiering content strategy.** For each lesson
   difficulty (beginner / moderate / hard), what SHOULD the content
   feel like? What's the reader's cognitive contract? Cite specific
   examples of good tiering from other health-education apps or
   textbooks (Osmosis, Bearable, etc.).

5. **A red-flag / safety list.** Which curriculum topics (e.g.
   red_flags, thyroid_endocrine, endometriosis, pcos) must ALWAYS
   include a "worth discussing with a provider" callout at the end?
   Which topics need extra care around teen users (who may be
   ages 11–18)?

**Constraints.**
- Non-diagnostic. Use "may notice / often reported / worth mentioning."
- Cite peer-reviewed sources or reputable clinical sites (Mayo,
  Cleveland Clinic, ACOG, NHS, WHO) where you make a factual claim.
- The reader can be a 14-year-old learning about her body for the first
  time, or a 42-year-old with PCOS who's already seen a specialist.
  Content strategy needs to hold across that range.

**What NOT to do.**
- Do not invent lesson titles that would obviously overlap or fight
  with existing ones (Cycle Basics 1-4 already exist).
- Do not recommend any content that would violate the non-diagnostic
  rule.
- Do not prescribe supplements, diets, or medications.

**Format as Markdown.** Include a Sources section.

---

# §3 — Technical Architecture: adaptive quiz + phase-aware selector

**Paste the PROJECT CONTEXT above, then this prompt.**

## Prompt

You are a senior React Native engineer with deep experience in
educational apps, adaptive learning systems, and pure-TypeScript engine
design (no framework lock-in). I need you to design the technical
architecture for two additions to Dottie's Learn tab.

**Deliverables.** A design document that includes:

### Deliverable A — Adaptive quiz engine

**Requirements.**
- Each quiz has 6 questions. Every question is tagged
  `level: 'beginner' | 'moderate' | 'hard'`.
- Start every quiz with 2 beginner questions.
- If the learner gets BOTH right → next 2 are moderate.
- If they ace those → last 2 are hard.
- If they miss any → stay at the current level.
- Score aggregates: harder questions worth more (propose the XP
  weighting).
- On the reader UI: a small "tier" pill visible above the question,
  updating as the learner climbs.
- Must degrade gracefully when a quiz has too few questions at a tier
  (e.g. only 1 hard question) — describe the fallback logic.

**Give me:**
1. A TypeScript interface for the engine's public surface (I want
   `pickNextQuestion(state)` / `recordAnswer(state, correct)` /
   `finalize(state)` — you decide the exact shape). Include full
   JSDoc comments.
2. Pseudocode for the state machine (or a real state diagram in
   Mermaid).
3. A test plan — what scenarios prove the engine works? Include
   at least 6 scenarios and what the expected output is for each.
4. Migration notes — the existing quiz-engine at
   `src/engine/content/quiz-engine.ts` picks questions randomly;
   how do we swap in the adaptive picker without breaking existing
   quiz screens?

### Deliverable B — Phase-aware lesson selector

**Requirements.**
- Given the user's current sub-phase (from `resolveSubPhase()`),
  return 1-3 lessons to feature in a "For today" card at the top of
  the Learn tab.
- Must fall back gracefully when: (a) no period logged yet, (b) user
  picked "Not sure" mode, (c) all phase-relevant lessons already
  completed.
- Should NOT surface a lesson the user has already completed unless
  everything else is done.
- Must NOT ignore condition modes — a PCOS user in luteal should get
  the PCOS + luteal-relevant lessons, not just luteal.

**Give me:**
1. A TypeScript interface for the selector — inputs (sub-phase,
   conditions, mode, progressMap) and outputs (ranked lesson list
   with a `why: string` field for each).
2. A ranking algorithm (pseudocode). How do you combine phase
   relevance, condition relevance, and completion state?
3. A test plan with 5+ scenarios (regular menstrual user, PCOS
   luteal user, teen user with no history, etc.). Expected top-3
   list for each.
4. A note on caching — the sub-phase changes daily; should the
   selector re-run per render or per day? What does memoization
   look like?

**Constraints.**
- Pure TypeScript. NO React Native imports (both engines must be
  runnable in the Node simulation harness we already have at
  `scripts/predictor-simulation.ts`).
- Backward compatible — additions, not replacements.
- Deterministic: same input → same output.

**What NOT to do.**
- Do not use any ML / LLM in the selector — this must run offline
  on-device instantly.
- Do not propose a solution that requires a database migration
  (existing lesson_progress table is fine as-is).

**Format as Markdown with code fences.** Include a section
"Open questions I need answered" if anything is ambiguous.

---

# §4 — Copy & Tone Research: how to talk about phase-based content

**Paste the PROJECT CONTEXT above, then this prompt.**

## Prompt

You are a UX writer / content designer with a specialisation in health
apps and inclusive language. I need you to write the microcopy palette
for Dottie's phase-aware Learn tab additions.

**The core writing problem.** The peer-reviewed research SUPPORTS
"today's phase is a useful frame for learning about your body" but does
NOT support "your brain works better today." How do we communicate the
former without accidentally implying the latter?

**Deliverables.**

1. **10 headline variants** for the "For today" spotlight card, in
   different tones (curious, warm, matter-of-fact, playful, gentle).
   Say why each one lands.

2. **A "when to use / when not to use" style guide** for the following
   phrase families. Include 3 examples of each done RIGHT and 3
   examples of each done WRONG:
   - "Your body is…"
   - "Right now you might…"
   - "Many people report…"
   - "You may notice…"
   - "This is a great day to…"
   - "Your brain / hormones are…"

3. **Empty-state copy** for the "For today" card in five situations:
   (a) new user with no cycle data, (b) user who picked "Not sure"
   mode, (c) irregular / PCOS user with low phase confidence, (d) all
   phase-relevant lessons already completed, (e) user in the middle
   of a period vs. anticipating one.

4. **Inclusive-language audit.** Review the current copy in the
   PROJECT CONTEXT for anything that assumes a she/her user, a
   cis-female user, or a user who wants pregnancy. Suggest gender-
   neutral rewrites where appropriate — WITHOUT losing the warm
   "you & me" personal voice.

5. **A tone rubric** — 5 traits Dottie's voice should always have, 5
   traits it should never have. Format as two columns.

**Constraints.**
- Non-diagnostic, always.
- Reading level: aimed at a bright 14-year-old (Flesch-Kincaid ~7),
  because the app serves teens too.
- Warm but never cloying. No "queen" or "girl-boss" energy.
- No "sacred cycle" mysticism — this is science-informed.

**Format as Markdown.** Include a Sources section for anything you
cite about health-app tone (Bearable, Clue's blog, NHS content style
guide, etc.).

---

# §5 — Motivational Framework: streaks, chapters, celebrations without shame

**Paste the PROJECT CONTEXT above, then this prompt.**

## Prompt

You are a behavioural designer with experience on both educational and
health apps. Duolingo's success is famously due to its gamification
(streaks, XP, gems, leagues) — but multiple studies and journalists
have documented how those same patterns cause guilt, anxiety, and
"streak dread." Dottie is a HEALTH app for a demographic that has
plenty of health-related guilt already. I need a motivational framework
that borrows the WIN of gamification without the SHAME.

**Deliverables.**

1. **A comparative table** of streak/motivation mechanics across
   Duolingo, Headspace, Calm, Bearable, and one other health app of
   your choice. Columns: streak mechanic, "streak recovery" allowance,
   push-notification pressure, monetisation link, documented user
   complaints about guilt.

2. **A design recommendation for Dottie's Learn-tab motivation.**
   Specifically:
   - Should Learn have its OWN streak, or share the app-wide check-in
     streak (which already exists)?
   - What's the right "streak forgiveness" policy for a health app?
     (Menstruating people have days they legitimately can't engage.)
   - How do we celebrate a "chapter complete" moment without it
     becoming a treadmill? Design the actual moment.
   - What XP amounts feel right for lesson / quiz / practice / chapter
     completion? Ground your numbers in a rationale.
   - How do we make LEARN feel rewarding without triggering "I've
     failed my streak" anxiety on rough days?

3. **Anti-patterns to avoid** — 5 specific things Duolingo does that
   we should NOT copy, with reasons. Include the "Duo bird crying"
   memes / TikToks as evidence if useful.

4. **Reduce-Motion + accessibility notes** — celebration moments
   should honour Reduce Motion. Describe how the celebration should
   degrade for that setting.

**Constraints.**
- Local-first — no leaderboards, no "your friends have longer streaks
  than you" — Dottie is intentionally not social.
- The existing app-wide streak (from the daily check-in) must not be
  broken or duplicated confusingly.
- Match the non-diagnostic, non-shaming tone of the rest of the app.

**Format as Markdown.**

---

# §6 — Meta: sanity-check the plan we already have

**Paste the PROJECT CONTEXT above, then this prompt.**

## Prompt

You are a mobile product manager with a critical eye. Below is the
build plan I'm about to greenlight for Dottie's Learn-tab redesign.
I want an adversarial read — what am I missing, what could go wrong,
what would you push back on?

**The plan (three phases, one commit each):**

- **Phase 1 — "Today's spotlight" card.** Adds a section at the top
  of Learn showing 1-3 lessons tuned to the user's current cycle
  sub-phase. Reuses the sub-phase resolver from our day-suggestion
  engine. Existing path map stays below unchanged.

- **Phase 2 — Adaptive quiz depth.** Every quiz question is tagged
  `level: beginner | moderate | hard`. Quiz starts easy; if the user
  aces the first 2, next 2 get harder; keeps climbing. A subtle
  "tier pill" shows above the current question. Higher-tier questions
  are worth more XP.

- **Phase 3 — Chapter framing.** Add chapter markers between paths
  on the map, a chapter-recap quiz at the end of each path, and a
  companion celebration moment on chapter completion. Best done
  after we've imported 5-10 more curriculum paths so chapters have
  bulk to justify the framing.

**Deliverable.** A critical review of ~1,000 words covering:

1. **What's genuinely missing** — features / interactions this plan
   overlooks that competitors nail.
2. **Ordering risks** — should Phase 1 / 2 / 3 be in this order? Why
   or why not?
3. **Scope creep risk** — where is Phase 1 likely to bleed into
   Phase 3 in practice?
4. **User-facing risks** — how could a real user get confused by
   this? Where does the mental model break?
5. **A 5-item pre-flight checklist** — what should we verify before
   shipping each phase to a device build?

**Constraints.**
- Assume the plan will be built exactly as described unless you
  push back.
- Assume the owner is one person who device-tests every ~week — so
  fast, small phases beat one big drop.

**Format as Markdown with clear headers.**

---

## Appendix — files an agent might reference if you extend the pack

These are paths inside the Dottie repo. If a Gemini agent asks for
"more code context", these are the files worth pasting:

- `app/(tabs)/learn.tsx` (757 lines — the current Learn tab)
- `src/content/learning-paths.ts` (shipped lessons + paths)
- `src/content/quizzes.ts` (shipped quizzes)
- `src/content/exercises.ts` (5 interactive exercise types)
- `src/engine/content/quiz-engine.ts` (current random-picker quiz engine)
- `src/engine/calendar/day-suggestions.ts` (has the `resolveSubPhase`
  logic we'd reuse for the phase-aware selector)
- `src/types/content.types.ts` (Lesson / Quiz / Exercise TypeScript
  types)
- `docs/dottie questions/dottie_curriculum.json` (the source curriculum
  with all 93 lessons + 558 quiz questions + difficulty tags)
- `docs/LEARN-REDESIGN-PROPOSAL.md` (our own internal proposal — the
  agent doesn't need to agree with it)
- `docs/DAY-SUGGESTIONS.md` (the sister engine — same design principles)

## How I'd farm this out

If I had 6 Gemini tabs open, I'd:

1. Send §1 (UX Research) + §5 (Motivational Framework) to two tabs in
   parallel — they're the biggest and both design-y.
2. Send §2 (Content Strategy) to a third tab in parallel — content-y,
   independent of the UX findings.
3. When §1 comes back, send §3 (Technical Architecture) with §1's
   pattern catalogue attached — the tech design gets sharper when it
   knows which UI patterns to support.
4. Send §4 (Copy) after §2 lands — copy leans on the content strategy.
5. Send §6 (Meta) last — it needs the other five outputs to critique.

Total wall-clock time if you parallelise well: ~1 hour of Gemini time,
~4 hours if you serialise.
