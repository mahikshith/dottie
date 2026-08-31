# Day-Suggestions v2 — competitor scan + engine design

**Status:** shipped on `design-v2` (⚠️ UNVERIFIED on device).
**Files:** `src/engine/calendar/day-suggestions.ts`,
`src/components/calendar/DayDetailSheet.tsx`, `app/(tabs)/calendar.tsx`.

## Why we rebuilt it

Owner feedback (post on-device test #2): "we need to come up with some
reasoning engine that shows some suggestions… we just can't be a static
app… look at Flo, Clue etc." The old day sheet was a phase label + one
suggestion per category, rotated by day-of-month. It read the same for 12
days straight — not differentiated from a plain calendar.

## Competitor scan (Aug 2026)

- **Flo** — 70-screen onboarding builds a rich profile up front. Home
  countdown to the next event; calendar-day tap shows 70+ symptoms + a
  "symptom patterns" feature that surfaces "worth mentioning to a doctor"
  patterns. Premium: daily insights cocreated with 120+ doctors.
  ([Design Critique · Pratt IXD](https://ixd.prattsi.org/2025/09/design-critique-flo-ios-app/) ·
   [Flo product page — tracking cycle](https://flo.health/product-tour/tracking-cycle) ·
   [Screensdesign UI breakdown](https://screensdesign.com/showcase/flo-period-pregnancy-tracker))
- **Clue** — the strongest "why is today the way it is" story: sub-phase
  resolution ("early luteal" vs "late luteal / PMS window"), a hormonal
  narrative ("estrogen is climbing, that's often why energy feels lighter"),
  a soft social/normalisation signal ("many report…"), and a "what to track
  today" hint.
  ([Hello Clue — Cycle Phase Insights](https://helloclue.com/articles/about-clue/discover-cycle-phase-insights-understand-your-body-feel-empowered) ·
   [Hello Clue — how to use Clue Plus](https://helloclue.com/articles/how-to-use-clue/how-to-use-clue-plus))
- **MyFLO (cycle-syncing)** — prescriptive phase-tuned food / workout /
  focus recommendations.
  ([Cycle syncing guide · Hello Magazine](https://www.hellomagazine.com/healthandbeauty/health-and-fitness/867257/cycle-syncing-guide/) ·
   [MyFLO app page · FLOliving](https://floliving.com/pages/app))
- **Natural Cycles** — home = single-glance Red/Green fertility status.
  ([Natural Cycles — how it works](https://www.naturalcycles.com/how-does-natural-cycles-work))

## What v2 adds

The public API is backward-compatible — every new input on
`DaySuggestionInput` is optional and every new output on `DaySuggestionSet`
is a new field. Existing callers that only read `suggestions[]` keep
working; DayDetailSheet opts into the rest.

1. **Sub-phase resolution.** `resolveSubPhase({phase, dayInCycle,
   daysUntilPredictedPeriod, isPeriodDay})` → one of 9 sub-phases spanning
   the classical 4. `menstrual_early / _late`, `follicular_early / _mid /
   _late`, `ovulation_day`, `luteal_early / _mid / _late_pms`.
2. **Hormone story per sub-phase.** One line, non-diagnostic, "tends to /
   often" framing — the piece Clue leans on.
3. **Culture line per sub-phase.** "Many report needing more sleep here" —
   normalisation without medicalisation.
4. **Suggestion `why` tag.** Every tip carries a 2-6 word reason
   ("aligns with rising estrogen", "insulin-friendly"). Rendered as a
   tiny caption under the suggestion so the tip doesn't read as arbitrary.
5. **Personal signals.** 0-3 nudges pulled from the user's OWN recent
   data: last-7d dominant-symptom pattern ("you've been logging headaches
   — pack a painkiller"), plus today's check-in (low mood / low energy /
   poor sleep / high stress each surface a specific supportive line).
   Never a diagnosis; always framed as "you tend to log X".
6. **Track prompts.** 2-4 "worth tracking today" chips per sub-phase,
   mirroring Clue's "what others in this window are tracking" hint. Inert
   visuals for now — tapping them to jump into a log form is a follow-up.
7. **Richer pools.** 4-5 items per phase × category so the day-seed
   rotation stays fresh through a whole phase, and sub-phase-specific
   extras layer one focused tip per sub-phase on top of the phase base.

Every set still carries the same disclaimer: "Gentle ideas, not medical
advice — take what helps, skip the rest." Same non-diagnostic discipline
as `engine/reports/condition-signals`.

## UI (DayDetailSheet)

Header chip now shows the SUB-PHASE ("Late luteal · PMS window") instead
of just the phase. A one-liner hormone story sits under the chip. Below
the "Your day" actions and note, the sheet renders:

- **For you today** — personal signals (only when there's data to show)
  in an accent-tinted card so they stand out.
- **For this phase** — companion line + culture line + 4-6 suggestions
  (each with its `why` caption in accent) + a "Worth tracking" chip row.

## What still to add

- **Track-prompt taps → log flow.** Right now chips are inert hints. Wire
  each chip to the matching log form (flow / symptom / mood / sleep) so
  the prompt is one tap from action.
- **Home screen "Today at a glance".** The home tab still reads
  generic — mirror Clue's daily narrative here (sub-phase chip + hormone
  story + one personal signal + one suggestion). Reuses the engine.
- **Predictor simulation harness.** Deferred from the last round. A tiny
  Node script that seeds fake cycle histories and prints the engine's
  predictions + suggestions across N days, so we can catch weirdness
  before device testing.
- **First-time user welcome pass.** Flo's 70-screen quiz builds a rich
  profile before the first Home paint. We should audit our onboarding to
  make sure the engine has what it needs (mode, conditions, last-period
  date, cycle length) before dropping the user on a "log your period"
  cold-start.
