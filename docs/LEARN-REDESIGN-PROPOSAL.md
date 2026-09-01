# Learn Tab — Redesign Proposal

**Status:** proposal. Owner asked for research + creative options on two
ideas: (1) show exercises based on the user's current cycle phase, and
(2) support easy/medium/hard within a lesson. This doc lays out what
competitors do, what the research actually says, three concrete design
options, and a recommended blend. Nothing built yet — feedback first.

## What we have today

- **Path map** (`app/(tabs)/learn.tsx`, 757 lines) — a winding aurora
  "tube trail" of lesson nodes with the current node pulsing, a hopping
  companion, auto-scroll to the current node on focus.
- **Pace toggle** (`Storage.learnLevel`) — `new` (guided, sequential
  locks) / `basics` (unlocked, self-directed) / `deep` (unlocked, harder
  content promised — but currently just unlocks the same lessons).
- **Content shipped** — 3 of 24 curriculum paths: Cycle Basics (4
  lessons), Puberty 101 (3), Hormones 101 (7). Roughly ~18 lessons live,
  each with quiz + optional interactive exercises.
- **Content available** — the full curriculum in
  `docs/dottie questions/dottie_curriculum.json` has **24 paths / 93
  lessons / 279 exercises / 558 quiz questions**, and — crucially —
  every lesson carries `difficulty: beginner/moderate/hard` and every
  quiz question carries `level: beginner/moderate/hard`. **We just
  aren't using either field yet.**

Full path list from the curriculum: `cycle_basics`, `hormones_101`,
`menstrual_phase`, `follicular_phase`, `ovulation`, `luteal_pms`,
`period_products`, `nutrition`, `movement`, `sleep`, `mood_mental`,
`pain_management`, `skin_hair`, `digestive`, `sexual_health`,
`fertility_awareness`, `contraception`, `tracking_skills`,
`red_flags`, `pcos`, `endometriosis`, `thyroid_endocrine`,
`perimenopause`, `teens`.

That last group is important — we have entire paths already written for
each phase (`menstrual_phase`, `follicular_phase`, etc.) which makes
owner's idea (1) *very* feasible.

## Research — what actually works

### Duolingo
- **Tiny lessons** — 30-60 second exercises, not 20-minute reads.
- **Progressive disclosure** — introduce, repeat, vary, then recall.
- **Adaptive difficulty within a lesson** — if you're acing the first
  exercises, the last few get harder in real time.
- **Streak psychology** — after they let "one lesson" count for streaks
  (used to require the full daily goal), 7-day-streak retention went
  up 40%. Their whole system is built on "small wins that add up."
- **Variable reward schedule** — XP is unpredictable per lesson, which
  keeps engagement past the "expected value."

Sources:
- [Duolingo case study · growth.design](https://growth.design/case-studies/duolingo-user-retention)
- [Adaptive lessons · Duolingo blog](https://blog.duolingo.com/keeping-you-at-the-frontier-of-learning-with-adaptive-lessons/)
- [Duolingo UX breakdown · Medium](https://medium.com/design-bootcamp/duolingo-redefining-language-learning-with-seamless-ux-9d61c1fd1541)

### Khan Academy
- Adaptive by **pace + path selection** rather than mid-lesson difficulty
  jumps. Recommends what to study next based on where you've struggled.
- ~120M users on this pattern; it's a proven model at scale.

Sources:
- [Adaptive learning examples · Mindstamp](https://mindstamp.com/blog/adaptive-learning-examples)

### The science on phase-based learning (this is the interesting bit)
There's real, peer-reviewed evidence that different cognitive tasks
land differently across the cycle:

- **Motor learning** consolidates BETTER during the ovulation window
  than the luteal window (`Brain Sciences, 2020`).
- **Category learning** (rule-based) shifts between follicular and
  luteal phases (`Scientific Reports, 2023`).
- **Attention networks** vary across all 5 sub-phases
  (`bioRxiv 2019`).
- **Body awareness** scores are lower in luteal than follicular
  (Frontiers in Endocrinology).

Sources:
- [Motor learning & memory consolidation across cycle · Brain Sciences 2020](https://doi.org/10.3390/brainsci10100696)
- [Learning exceptions to category rules across the menstrual cycle · Scientific Reports 2023](https://www.nature.com/articles/s41598-023-48628-x)
- [Attentional networks during the menstrual cycle · bioRxiv](https://www.biorxiv.org/content/10.1101/717264.full.pdf)
- [Avoidance learning across the menstrual cycle · Frontiers 2020](https://www.frontiersin.org/journals/endocrinology/articles/10.3389/fendo.2020.00231/full)

**Practical read for us:** we shouldn't over-claim ("your brain is
DIFFERENT today!" — that's not what the research says). But it does
mean **surfacing menstrual-phase content during menstruation, luteal
content in the PMS window, etc., is defensible** — not just "learn
whatever" but "here's what will land right now."

---

## Three design options

### Option A — Phase-aware "Today's spotlight" *(owner's idea #1)*

Add a **single new section at the top of the Learn tab**: 1-3 lessons
tuned to today's sub-phase (from the same engine we built for the day
sheet).

**Menstrual today** → surfaces from `path_menstrual_phase`: "What
happens during your period", "Reading your flow color", "The case
for rest", + `path_pain_management` for cramps.

**Follicular** → `path_follicular_phase` + `path_movement` + a
"Fresh starts / motivation" lesson.

**Ovulation** → `path_ovulation`: "What is ovulation", "The fertile
window", "Signs you're ovulating".

**Luteal / PMS** → `path_luteal_pms`: "Welcome to luteal", "PMS
what's really going on", "Understanding PMDD", "Cravings & appetite
shifts".

The existing path map stays below — this is additive, not a
replacement. The "For today" spotlight is what makes Learn feel alive
day-to-day rather than a static book.

**Effort:** small (~1 session). Reuses `resolveSubPhase()` from the
day-suggestion engine and the pathId → lesson map that already exists.

**Risks:** if the user doesn't have a period logged yet, spotlight
falls back to "here's where to start" (Cycle Basics path 1). Same
honesty rule as the calendar has.

### Option B — Adaptive quiz depth (owner's idea #2, done Duolingo-style)

The curriculum already tags every question with `level: beginner /
moderate / hard`. **Right now we strip that field on import and pick
questions randomly.** Instead:

1. Every quiz starts with 2 beginner questions.
2. If you get both right → next 2 are moderate.
3. If you ace those → last 2 are hard.
4. If you miss any → stay at the current level.
5. Score aggregates across all 6, with harder questions worth more XP.

This is exactly what Duolingo's "adaptive lessons" do — real-time
difficulty change within a single lesson. The user experiences ONE
quiz that quietly matches their ability.

**Effort:** medium (~1 session). Requires the exercise engine to
route by `level`, plus the quiz-render UI showing a subtle
"tier climbing" affordance (e.g. a small ring around question number
that fills brighter for higher-tier).

**Bonus:** we already have 558 tiered questions in the curriculum
JSON — this immediately puts them to work.

### Option C — Chapter framing (Duolingo-style path structure)

Right now the path map is one long tube of lesson nodes. Duolingo
groups every 5-10 lessons into a **unit / chapter**, with:

- A visual break (companion sits on a "chapter marker" node)
- A chapter recap quiz drawn from all lessons in it
- Chapter completion unlocks a companion animation moment

For Dottie, chapters map naturally to the 24 curriculum paths — each
path IS a chapter. So this is less a UI overhaul and more:

- Prominent chapter markers between paths on the map
- Chapter-recap quiz at the end of each path (draws 3-5 questions
  across all lessons in it)
- A "you finished Hormones 101!" celebration moment (companion
  animation + gems + a stamped badge on the path card)

**Effort:** medium-large (~1-2 sessions). Bigger visual change but
lower content authoring cost.

---

## My recommended blend (build order)

Do all three, in the order that ships value fastest:

**Phase 1 — Option A "For today" spotlight** *(1 session)*
The smallest change with the biggest "the app feels alive" payoff.
Directly answers owner's idea #1. Ships one new component + a call
into the sub-phase resolver we already have.

**Phase 2 — Option B adaptive quiz** *(1 session)*
Directly answers owner's idea #2. Unlocks the tiered content the
curriculum already carries. `learn.deep` finally means something —
not just "unlock", but "harder questions."

**Phase 3 — Option C chapter framing** *(1-2 sessions)*
The polish + completion-moment layer. Best done AFTER we've
imported more paths (so there are actual chapters to celebrate).
Ideally combined with importing 5-10 more curriculum paths so the
map has enough to justify the chapter framing.

## Trade-offs / things to be careful about

- **Don't over-claim on the phase science.** The research supports
  "here's what's most relevant to log/learn about right now," NOT
  "your brain works better this week." Keep the copy in "For today"
  gentle — "Might land well right now" not "your brain is optimized
  for this."
- **Adaptive quiz needs a graceful "same tier" behaviour.** If we're
  short on hard questions for a lesson, degrade to moderate silently
  — don't leave the last two slots empty.
- **The path map is already good.** Don't rebuild it just for
  chapters — layer chapter markers on top of what's there. The
  aurora tube + hopping companion is a signature.
- **"Deep" pace today is a lie.** It unlocks the trail but doesn't
  change what you see. Phase 2 fixes this without needing more
  content per lesson — same lesson, adaptive quiz depth.

## Open questions I'd like your call on

1. **Phase-lock or phase-suggest?** For "For today" — should we
   ORDER-prefer phase-relevant lessons (they float to the top) or
   ONLY show them (until dismissed)? I'd suggest suggest, not lock.
2. **Show tier while quizzing?** A little "beginner → moderate → hard"
   pill above the question that changes as you climb? Or invisible?
   I'd suggest visible-but-subtle — makes the difficulty ramp feel
   earned.
3. **Chapter recap — required or optional?** Duolingo makes them
   required to unlock the next unit; that gates progression. For a
   health app I lean OPTIONAL (users have very different appetites
   for testing) but marked as "recommended".
4. **Content import cadence.** Phase 3 (chapters) is best after
   importing more paths from the curriculum. Do 2-3 paths per
   commit, or one big batch?
5. **When?** After device-test #3 comes back green, or start
   Phase 1 in parallel while owner tests?

## Files this touches when built

- `src/engine/learn/` (new) — the sub-phase → recommended-lessons map.
- `src/components/learn/TodaySpotlightCard.tsx` (new, Phase 1).
- `src/components/learn/ChapterMarker.tsx` (new, Phase 3).
- `src/engine/content/quiz-engine.ts` — extend to read `level` per
  question (Phase 2).
- `src/content/quizzes.ts` — restore the `level` field on imported
  Hormones 101 questions (currently stripped).
- `app/(tabs)/learn.tsx` — add the spotlight section at top; add
  chapter markers between paths.
- `app/quiz/[id].tsx` — show tier pill (Phase 2).

## Next step

Owner picks: **A now, B soon, C later** — or a different order — or
different open-question answers, and I build.
