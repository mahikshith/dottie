# Dottie — Full App Audit + Gemini Analysis Brief

**Purpose.** A self-contained inventory of what Dottie IS today — every screen,
feature, engine, data path, user journey, and known-weakness — so that an
external agent (Gemini) can perform a deep, structured UX / product / systems
analysis without needing repo access.

**How to use.** Read the audit yourself; then paste **PART A (context)** + one
of the prompts in **PART B (analysis prompts)** into a Gemini tab. Six prompts
in PART B; run them in parallel or serial.

**Two non-negotiable analysis themes** the owner asked to be woven through
every prompt:

1. **Inclusive design** — Dottie serves people across many identities, life
   stages, and health conditions. Nothing should assume she/her, cis, fertile,
   able-bodied, tech-literate, English-first, or affluent. Blindspots on this
   axis are top-priority findings.
2. **Millions-of-users readiness** — this is a **local-first** app right now
   (great for privacy, hard for scale). What breaks at 10K, 100K, 1M installs?
   What patterns block scale? Where does the local-first tradeoff need honest
   revisiting?

---

# PART A — PROJECT CONTEXT (paste as preamble to every Gemini task)

## A.1 What Dottie is

A warm, local-first, non-diagnostic women's-health and cycle-tracking mobile
app. Currently on `design-v2` branch — an aurora / dark-glassmorphism visual
world. Companions (named animal spirit guides) recolour the whole UI to the
user's logged mood.

- **Platform.** React Native + Expo (managed, SDK 52), TypeScript strict.
  Android APK builds via GitHub Actions. iOS not yet built (no Apple dev
  account). Currently in owner + closed device-test rounds; ~device-test #3
  in progress at time of writing.
- **Storage.** `expo-sqlite` for cycle/symptom/checkin/community/sisterhood
  data; `react-native-mmkv` (encrypted) for flags + drafts + planning notes.
  **Nothing leaves the phone.** No server, no login, no account.
- **Distribution.** Beta build path; not on stores yet.

## A.2 Values / principles (compressed)

1. **Non-diagnostic, always.** "You may notice / many report / worth
   mentioning to a provider" — never "you have X."
2. **Local-first.** No cloud sync, no analytics, no ads. Privacy is the
   competitive moat, especially post-Roe.
3. **Warm + supportive tone.** Companion metaphor throughout. No shame, no
   girl-boss energy, no mysticism.
4. **Every question has a "not sure / skip"** — nothing gates on knowledge
   the user doesn't have.
5. **Approximate over precise.** "About a week ago" beats a date picker.
6. **Additive over replacing.** New features layer on top; existing paths
   don't change out from under users.

## A.3 Tech architecture (layers, top → bottom)

```
  App tabs + deep screens (expo-router)         ← UI
     │
  Zustand stores  ×12                            ← state
     │
  Repositories  ×8  (SQL + MMKV thin wrappers)  ← persistence
     │
  Pure TS engines  ×10  (predictor, day-suggestions, gamification, …)
     │
  Local SQLite  +  MMKV flags                    ← storage
```

Rule: engines have **no** React Native imports and are runnable in Node
(a simulation harness at `scripts/predictor-simulation.ts` proves this).

## A.4 Screen inventory (every screen the user can reach)

### Tabs (5)
| Tab | Route | What it does |
| --- | --- | --- |
| **Home / Today** | `app/(tabs)/home.tsx` | Greeting, mood-log row (recolours palette), day glow ring, "Today at a glance" card (sub-phase, hormone story, top personal signal, top tip, track chips), Phase Weather card, Dottie Predicts deck, Daily Decode card, phase questions. |
| **Cycle / Calendar** | `app/(tabs)/calendar.tsx` | Month grid with phase-colored day cells, phase summary, week-ahead strip (when there's cycle data), legend, day-detail popover (magnifies from tap origin), "Care for a loved one →" Sisterhood bridge. |
| **Learn** | `app/(tabs)/learn.tsx` | Winding aurora "tube trail" of lesson nodes across paths, pulsing "you're here" ring, hopping companion, pace toggle (new/basics/deep), auto-scroll to current lesson on focus. 3 paths / ~18 lessons shipped. |
| **Circle / Community** | `app/(tabs)/community.tsx` | Feed of anonymous or named posts in 6 topic-based spaces (First Period Support, PCOS Warriors, Fitness & Phases, Cycle & Mental Health, Nutrition & Cravings, General Support). Filter chips (Trending/New/Most hugs/Most answered). "+" opens new-post. |
| **You / Profile** | `app/(tabs)/profile.tsx` | Companion + identity, mode badge, stats grid (streak/XP/gems/badges), level bar, settings list (Sisterhood, Doctor Report, Ghost Mode, Privacy, Medications, Reminders, "Show me around again", Theme, Export). |

### Deep screens
| Group | Screens |
| --- | --- |
| **(onboarding)** — 7 screens | welcome → mode-select (regular / just started / irregular / **not sure**) → **conditions** (multi-select PCOS/endo/thyroid/PMDD/pill/nothing/prefer-not-say) → companion-select → cycle-setup (bucket chips: few days / week or two / about a month / longer / not sure, + escape hatch to type a precise number) → **reminders** opt-in (daily check-in / period heads-up / hydration) → ready. |
| **(community)** | new-post (space + body + moderation preview + anonymous toggle) · post/[id] (post + replies + compact reply composer). |
| **(sisterhood)** | circle (dashboard, member cards, phase-sync banners) · add-member (multi-step wizard) · member/[id] · shadow-log/[id]/period · shadow-log/[id]/check-in · shadow-log/[id]/transfer. |
| **(profile)** — 5 sub-screens | doctor-report · ghost-mode · medications · privacy · reminders. |
| **(modals)** | daily-checkin (full mood + energy + sleep + stress + symptoms + mood-word) · checkin-recap · streak-celebration · level-up · beta-feedback · ghost-lock (PIN entry) · decoy-home (fake "Garden Notes" app for snoopers). |
| **root** | index (routing) · _layout (AuroraProvider, ErrorBoundary, AppLockGate, AppDialogHost, WalkthroughOverlay). |

## A.5 Feature inventory (what the app can do)

**Core loop**
- One-tap mood log on Home (5-point scale, palette recolours from tap origin)
- Full daily check-in modal (mood, energy, sleep, stress on 5-point scales;
  mood-word picker; symptom chips with severity)
- Log a period day (multiple ways: tap-log on calendar, "Mark as period" in
  day sheet, via Sisterhood shadow-log for a loved one)
- Log symptoms (physical, emotional, skin, energy, sleep clusters)
- Answer phase-responsive questions on Home

**Prediction + insight**
- Bayesian predictor (Normal-Inverse-Gamma → Student-t) on-device
- Phase weather (ambient "the vibe of the day") card
- Dottie Predicts (deck of insight cards personalized from logs)
- Symptom↔cycle correlation insights
- Day suggestions v2 with sub-phase, hormone story, personal signals

**Content / Learn**
- Winding path-map of lessons across paths (3 shipped, 21 available in
  curriculum)
- Lesson reader (sections: heading/paragraph/fact/tip/callout)
- Interactive exercises (5 types: pairs, order, fill-blank, tap-diagram,
  tap-word)
- Quizzes (~6 questions each, tier-tagged but not yet used)
- Companion score reactions (mind-blown → warm hug)
- XP + gems per lesson/quiz/exercise
- OTA content updater seam (no backend wired)

**Gamification**
- Streaks (daily check-in based)
- XP (~13 levels)
- Gems currency
- Badges (Beta Pioneer live; others queued)
- Celebrations (streak milestones, level-up, badge-earned)

**Community ("The Circle")**
- 6 topic-scoped spaces
- Anonymous or named posts (with spirit-alias when anon)
- Hugs (like) + reports (3+ reports auto-hides post)
- Reply threads
- Client-side moderation (self-harm/medical/personal-info flags with
  gentle "nudge" copy, never silent block)

**Sisterhood (Circle for loved ones)**
- Care for a "shadow member" (someone without their own Dottie)
- Log period days / check-ins on their behalf
- Phase-sync banners ("you and Priya are both in luteal today")
- Care nudges (pre-written warm messages)
- Transfer profile to real Dottie account (code-based handoff)

**Privacy & safety**
- **Ghost Mode** — PIN-locked; can disguise app as "Garden Notes"; can route
  a wrong PIN to a plant-journal decoy; can wipe on panic PIN
- **Privacy screen** (trust + delete-my-data)
- **Doctor Report** — one-tap clinician-ready summary; NON-diagnostic
  condition-signal "worth discussing" flags

**Notifications**
- Local expo-notifications scheduler (daily check-in, period heads-up,
  hydration, medication reminders)
- Discrete lock-screen copy option (safe to see in public)

**Onboarding v2**
- 7-screen funnel; every step skippable
- Conditions screen fills `healthConditions` (the fix for silent engines)
- First-run walkthrough (7-step coach-mark tour, Skip/Next/Done)
- "Show me around again" on Profile to replay

## A.6 Engine layer (pure TS, no RN imports)

| Engine | File | Role |
| --- | --- | --- |
| Bayesian predictor | `src/engine/prediction/bayesian-predictor.ts` + `predictor.ts` | Predicts next period date, confidence, window from cycle history + profile |
| Phase calculator | `src/engine/prediction/phase-calculator.ts` | Day → phase + dayInCycle |
| Day suggestions v2 | `src/engine/calendar/day-suggestions.ts` | Sub-phase, hormone story, culture line, personal signals, tips w/ why-tags, track chips |
| Dottie Predicts | `src/engine/predicts/dottie-predicts.ts` | Personalized insight deck |
| Symptom↔cycle | `src/engine/predicts/symptom-correlations.ts` | Detects "headaches around this window" patterns |
| Content resolver | `src/engine/content/content-resolver.ts` | Picks daily decode / questions based on phase + recent symptoms |
| Quiz engine | `src/engine/content/quiz-engine.ts` | Currently random-picker; adaptive redesign proposed |
| Lesson engine | `src/engine/content/lesson-engine.ts` | Progress tracking |
| Exercise engine | `src/engine/content/exercise-engine.ts` | Grading + companion reaction for 5 exercise types |
| Gamification | `src/engine/gamification/*.ts` (5 files) | Streak, XP, gems, levels, badges |
| Community moderation | `src/engine/community/moderation.ts` | Client-side flags + gentle nudge messages |
| Sisterhood | `src/engine/sisterhood/index.ts` | MemberView projection (privacy-filtered), phase-sync detection, care-nudge selection, transfer-code generation |
| Doctor report | `src/engine/reports/doctor-report.ts` | Clinician summary generation |
| Condition signals | `src/engine/reports/condition-signals.ts` | Non-diagnostic "worth mentioning" pattern detection |
| Phase weather | `src/engine/phase-weather/aggregator.ts` | Ambient card data |

## A.7 State layer

12 Zustand stores (index in `src/stores/index.ts`):

- `useUserStore` — user + companion + hydration
- `useCycleStore` — cycles, predictions, symptoms, today's check-in
- `useGamificationStore` — streak, XP, gems, badges
- `useContentStore` — today's decode, questions
- `usePhaseWeatherStore` — ambient card
- `usePredictsStore` — insight deck
- `useReportStore` — cached doctor report
- `useCommunityStore` — feed cache, hugs/reports state
- `useSisterhoodStore` — circle, members, care nudges
- `useBetaFeedbackStore` — feedback drafts + history
- `useGhostModeStore` (in `src/security/`) — PIN + config + lock state
- `useWalkthroughStore` (in `src/walkthrough/`) — coach-mark step index

## A.8 Data model (SQLite + MMKV)

**SQLite** (~11 tables):
users · cycle_entries · cycle_records · symptom_logs · daily_check_ins ·
question_answers · predictions · prediction_errors · gamification_state ·
lesson_progress · community_posts · community_replies · community_hugs ·
community_reports · sisterhood_* (circles / members / shadow entries /
nudges / transfer codes / phase-sync events) · beta_feedback.

**MMKV** (~30 keyed flags/drafts):
onboarding.complete/at/draft · user.current_id · features.* ·
ghost.pin_hash / salt / panic_hash / panic_wipe / disguise / decoy_route ·
beta.pioneer_awarded/at · app.last_opened_at / daily_reset_date /
content_version / db_initialized_at · ui.theme_override / reduced_motion /
haptics_enabled · companion.type · calendar.day_plans · learn.level ·
content.remote_bundle · notifications.reminder_prefs · meds.plans ·
ux.sisterhood_explainer_seen · ux.walkthrough_seen.

## A.9 Design system

- **Aurora tokens** (`src/theme/aurora-static.ts`): dark ground (#0C0A16),
  ink text ramp, glass tints, edge borders, accent teal, accent2 violet,
  gold, rose, success, error.
- **Mood palettes** (5): Radiance / Meadow / Nocturne (default) / Twilight /
  Ember — the whole UI recolours to the user's logged mood via `AuroraProvider`.
- **Phase hues** (constant across moods): menstrual (rose), follicular (mint),
  ovulatory (peach), luteal (violet).
- **Shared primitives** (`src/components/ui/`):
  - `PressableScale` — spring-press + haptic tap
  - `GradientButton` — coral→peach pill
  - `GradientFab` — floating "+"
  - `BreathingView` — infinite breathe (companion mascots)
  - `PopOnChange` — number pop (streak/gems)
  - `GlassCard` — translucent panel
  - `AuroraBackground` — SVG radial blooms + drift + re-bloom on palette change
  - `GlowRing` — self-drawing SVG progress ring
  - `ClayButton` — gradient + sheen mood key
  - `AuroraTabBar` — icons-only tab bar (rectangle removed per test #2)
  - `CompanionLottie` — Lottie-when-available, breathing-emoji fallback
- **Motion.** Reanimated (UI thread), 60fps, Reduce-Motion aware everywhere.
  Spring form `{duration, dampingRatio}` per animate-expo skill.

## A.10 User modes + companions

**Modes:** `teen` · `adult` · `endocrine` (irregular) — plus roadmap:
perimenopause, birth-control-pill.

**Companions** (6): fox · bunny · butterfly · cat · owl · blossom (bear).
Each has an accent color + phase greetings + Lottie art placeholder.

## A.11 Known state on `design-v2` (device-test #3 pending)

Everything above has been unified on `design-v2` and is in the APK now on
the owner's phone. Prior test-#2 issues (Sisterhood crash, Ghost Mode crash,
tab-bar rectangle, cream nav chrome flashing over the notch, Community
composer clumsiness) all fixed. Not yet re-verified on device.

Outstanding (roadmap):
- Perimenopause mode (engine work + UI)
- Birth-control mode (cycle-suppression aware)
- Learn tab redesign (proposal in `docs/LEARN-REDESIGN-PROPOSAL.md`;
  brief in `docs/LEARN-REDESIGN-GEMINI-BRIEF.md`)
- Import remaining 21 curriculum paths
- Automated tests (Jest/Vitest) — simulation harness exists but no
  regression suite
- iOS build path
- Cloud sync / accounts (not planned; local-first is a value)

## A.12 Explicit blindspots the owner already worries about

- **Inclusivity of gender language.** Copy audit was proposed in the
  onboarding doc but not executed.
- **Accessibility.** Screen reader, dynamic type, high-contrast — never
  audited.
- **Non-English localisation.** English-only today.
- **Low-end Android.** Tested on 1 owner phone; render performance on
  cheap devices unknown.
- **Data loss / device swap.** Local-first means: lose the phone, lose
  the data. No cloud backup.
- **Teen safety.** 11-year-olds may install this. Ghost Mode was designed
  for adult privacy; teen protection is a different threat model.
- **Post-Roe legal risk.** Sisterhood + community + doctor-report each
  create data surfaces that could be subpoenaed if ever cloud-synced.
- **Perimenopause / BC / trans users.** Product roadmap acknowledges
  each, but current UI actively assumes a menstruating adult.

---

# PART B — GEMINI ANALYSIS PROMPTS

## B.1 — Comprehensive UX audit + heuristic evaluation

**Paste PART A above, then this prompt.**

You are a principal UX researcher with 15 years across health, education, and
consumer-social products. You do heuristic evaluations for a living. I need a
rigorous end-to-end UX audit of Dottie against Nielsen Norman heuristics,
Apple HIG, and Material 3 — **applied to what the app IS today, not what it
could be.**

**Deliverable — a ~3,000-word audit** containing:

1. **Screen-by-screen heuristic pass.** For each of the 5 tabs + the
   onboarding funnel + 3 deepest sub-flows (calendar day sheet, Ghost Mode
   setup, Sisterhood add-member wizard), evaluate against:
   - Visibility of system status
   - Match with real-world mental models
   - User control + freedom (undo, back, dismiss)
   - Consistency + standards
   - Error prevention + recovery
   - Recognition rather than recall
   - Flexibility + efficiency
   - Aesthetic + minimalist design
   - Help users diagnose + recover from errors
   - Help + documentation
   Rate each heuristic 1-5 with a one-sentence justification.

2. **Cognitive walkthrough of 4 first-time user journeys:**
   - 14-year-old at menarche, first tracker ever
   - 32-year-old regular cycler switching from Flo (has 5 years of data
     she can't import)
   - 28-year-old newly-diagnosed PCOS user
   - 46-year-old in perimenopause (mode doesn't exist yet — will she stay?)
   For each: what's the first jarring moment? First delight? First
   confusion? First "I'm out" trigger?

3. **Anti-pattern flags.** Where does Dottie currently do something a
   competing app (Flo, Clue, Wenly, Bearable) does BETTER? Where does
   Dottie do something BETTER than the competition? Cite specifics.

4. **Design-system consistency check.** Same interaction, same tap
   affordance, same spacing, same haptic — everywhere. Find at least 3
   inconsistencies from the inventory in PART A.

5. **Inclusivity blindspots (mandatory).** Enumerate at least 10 assumptions
   the current UI/copy makes about the user (see PART A §A.12 for the
   owner's known concerns) and propose neutral rewrites or design fixes.

6. **A prioritised fix-list** — 10 highest-leverage improvements ordered
   by (impact × ease). Format as a table.

**Format as Markdown. Cite sources for any specific claim about a competitor.**

---

## B.2 — Systems / scale readiness (millions of users)

**Paste PART A above, then this prompt.**

You are a mobile platform engineer with experience scaling consumer apps from
0 → 10M+ installs. Dottie is intentionally **local-first**: SQLite on device,
MMKV for flags, no server, no login. That's great for privacy — and
potentially crippling for growth. I need a scale-and-systems review.

**Deliverable — a ~2,500-word technical report** covering:

1. **What breaks at scale in the current design.** For each of:
   1K users · 10K · 100K · 1M · 10M
   what starts to hurt? (Support load, content update velocity, community
   moderation, doctor-report iteration, prediction-model drift, etc.)

2. **The local-first tradeoff scorecard.** For each capability we can't
   offer as a local-first app, what's the honest cost + workaround?
   - Cross-device sync / device swap
   - Long-term backup
   - Partner sharing (Sisterhood needs it)
   - Federated learning to improve the predictor
   - Analytics / crash reporting
   - Real community (needs a server for content-mod at scale)
   - Server-side ML

3. **The "acceptable compromise" architecture.** Design a hybrid where
   the DEFAULT stays local + privacy-first, but users can opt in per-feature
   to a minimal cloud component. What's the least-cloud viable? What's
   the CRDT / encryption model? Who holds the keys?

4. **Content-delivery at scale.** The Learn curriculum has 93 lessons +
   558 quiz questions. Content updates should not require an app-store
   release. Design the OTA content pipeline (we already have a seam at
   `src/content/remote/*` but no backend). Options: EAS Update, a CDN JSON
   with a version number, a headless CMS. Recommend one with tradeoffs.

5. **Community moderation at scale.** Client-side flags don't scale past
   ~a few hundred active posters. Design a moderation pipeline for
   100K MAU that respects Dottie's non-cloud stance where possible.

6. **Cost model.** At 100K MAU, what does the cheapest viable hybrid
   architecture cost per month? At 1M MAU? Include CDN, moderation,
   crash reporting, hosted content updates. Assume aggressive freeloading
   from free-tier services where legal.

7. **Legal / compliance blindspots.** Post-Roe US, GDPR EU, HIPAA-adjacent
   ambiguity, App Store policies for period trackers. What legal
   surprises await at 1M installs? Cite recent enforcement (e.g. Flo $59.5M
   FTC settlement).

**Format as Markdown with headers per section.**

---

## B.3 — Inclusive design + accessibility audit

**Paste PART A above, then this prompt.**

You are an accessibility + inclusive-design specialist. Two overlapping asks:
(1) accessibility (WCAG 2.2 AA on mobile: touch targets, contrast, screen
reader, dynamic type, reduce-motion, cognitive load); (2) inclusion (who does
the current UI + copy exclude?).

**Deliverable — a ~2,500-word audit** with:

1. **WCAG 2.2 AA checklist against Dottie's inventory.** Enumerate the
   likely failing criteria based on the screen list in PART A and your
   experience with similar RN+Expo apps. For each: which screen(s)
   probably fail, why, what to fix.

2. **Screen-reader walkthrough** of the 5 tabs. What does VoiceOver /
   TalkBack say? Where would the announcement be broken, redundant, or
   miss the point (custom SVG icons, GlowRing, AuroraTabBar, the
   walkthrough overlay)?

3. **Dynamic type.** The design uses a `Typography.preset.*` scale. What
   happens at 200% type? Which screens re-flow gracefully? Which break
   (fixed-height rows, `numberOfLines={1}` clipping, glass cards)?

4. **Reduced motion.** Aurora backgrounds, breathing companion, glow ring,
   spring press, entrance stagger, mood-reveal, walkthrough animations —
   which honour `useReducedMotion` and which slipped through?

5. **Inclusive-language audit** of the copy patterns visible in the
   inventory (companion greetings, phase weather labels, Sisterhood
   framing, "care for a loved one," gendered assumptions in modes,
   fertility-centric wording in Ovulation content). At least 20 specific
   copy findings with proposed rewrites.

6. **Demographic blindspots.** Who is the current app NOT for?
   - Trans men / non-binary people who menstruate
   - Post-menopausal users
   - Users on hormonal birth control (mode doesn't exist)
   - Users who don't want children (fertility framing)
   - Users who want children right now (Dottie doesn't emphasise
     fertility windows)
   - Users with disabilities (motor, cognitive, low-vision, blind, deaf)
   - Users in low-connectivity or shared-device homes
   - Non-English speakers
   - Users with religious/cultural sensitivities around menstruation
   For each: what would inclusion look like?

7. **Teen safety carve-out.** Ghost Mode was built for adult privacy from
   a partner / parent. But the Teen mode implies 11-18-year-olds may use
   the app. What teen-specific safety design would you add? (School
   snooping, parental control expectations, self-harm content in
   community, sexual health questions from young users.)

8. **Recommendation matrix.** 15 fixes ranked by (inclusive impact × ease).

**Format as Markdown. Cite WCAG criteria numerically where relevant.**

---

## B.4 — Product strategy + differentiation

**Paste PART A above, then this prompt.**

You are a product strategist advising the founder. Dottie is entering a
market with Flo (~200M downloads), Clue (~12M paying subs), Wenly, Bearable,
Stardust, Natural Cycles, and a growing wave of AI-first entrants. **Where
does Dottie win, and where should it walk away from a fight?**

**Deliverable — a ~2,000-word product-strategy memo** with:

1. **Positioning statement** — who is Dottie's ideal user in 2026 and 2027?
   Not a persona in the abstract — the specific person for whom Dottie is
   materially better than the alternative.

2. **Defensible moats.** Enumerate all the things Dottie has that
   competitors don't or can't easily copy. Rate each on stickiness.
   (Local-first privacy? Sisterhood? Companion metaphor? Ghost Mode?
   Honest non-diagnostic tone? Doctor Report?)

3. **The two most-dangerous competitors** in 12 and 24 months. What are
   they doing that Dottie should worry about? What's their weakness
   Dottie can exploit?

4. **The 3 features to double down on** vs. **the 3 features to consider
   killing** — based on user value per unit of maintenance cost.

5. **The pivot risk.** If the app can't reach 100K MAU in 24 months
   local-first, at what point does the local-first bet need to be
   revisited? What are the tripwires?

6. **Monetisation.** Dottie is free / no ads. That can't be true forever.
   Design 3 monetisation options ranked by fit with Dottie's values.
   For each: pricing model, features gated, expected conversion, moral
   risk (health-app freemium ethics).

7. **Go-to-market for the first 10K users.** No paid ads assumption.
   Where do the first 10K real users come from? (Reddit? TikTok health-ed?
   Doctor / clinic referrals? Reproductive-rights orgs? Word of mouth
   from the Sisterhood loop?)

**Format as Markdown. Reference specific competitor moves you cite.**

---

## B.5 — Data model + engine review

**Paste PART A above, then this prompt.**

You are a senior backend / data engineer who reviews mobile-app data models
professionally. Dottie's inventory (PART A §A.6–A.8) lists 12 stores, ~11
SQLite tables, ~30 MMKV keys, and ~15 pure-TS engines. Look for design smells
that will bite as the app grows.

**Deliverable — a ~2,000-word technical review** covering:

1. **Data-model smells.** Enumerate at least 8 concerns:
   - Denormalisation risks (companion type in both SQLite AND MMKV)
   - Missing indexes / query patterns that won't scale
   - Data types / precision issues
   - Migration risk (any additive change on `design-v2` since MVP?)
   - Backup / restore story (there isn't one)
   - Foreign-key discipline (SQLite defaults off unless PRAGMA set)
   - MMKV vs SQLite splits that look arbitrary
   - Encryption story (MMKV has an encryption key IN SOURCE)

2. **Engine layer review.** Given the engines list in §A.6 — which are
   properly pure (Node-testable) and which have hidden UI dependencies?
   Where would you refactor for clarity?

3. **State-management review.** 12 Zustand stores is a lot. Any that
   should merge? Any selector patterns that will bite (Zustand v5 already
   burned us once with `selectMemberViewsOrdered` — where else could that
   pattern lurk)?

4. **Predictor model quality.** The Bayesian predictor is Normal-Inverse-
   Gamma → Student-t. Is that the right choice for menstrual-cycle length
   distribution? What academic critiques would apply? Should we consider
   a hierarchical Bayesian generative model (Urteaga et al. MLR 2021)?

5. **Content pipeline.** Lessons + quizzes live in TS files under
   `src/content/`. That means every content edit ships an app update.
   The OTA seam at `src/content/remote/*` is dormant. Design the schema
   version + validation story for content updates. Compare to how
   Duolingo / Khan Academy ship content updates.

6. **Recommendations.** 8 concrete refactors ordered by (risk-reduction × ease).

**Format as Markdown with code snippets where they clarify.**

---

## B.6 — Adversarial critique (the "what am I missing" prompt)

**Paste PART A above, then this prompt.**

You are a skeptical senior product / eng leader reviewing this project for
the first time. Everything in PART A was written by people who care about the
product. I need the OUTSIDE view — what would a stranger, or a jaded
reviewer, or an angry user, say about Dottie today?

**Deliverable — an adversarial critique of ~1,500 words** with:

1. **The 5 things a jaded App Store reviewer would call out** in a
   1-star review. Be specific and unkind.

2. **The 5 things a health professional would say are irresponsible.**
   (Non-diagnostic disclaimers are good — where do they fall short?
   Sisterhood-logging someone else's cycle — is that ethical? Doctor
   Report — could a clinician actually use it, or is it noise?)

3. **The 5 things a security / privacy researcher would flag** as
   naive.

4. **The 5 things a designer trained in Duolingo / Headspace would call
   amateur** about the current UI.

5. **The 5 things a founder in year 2 would regret building** with the
   benefit of hindsight from Flo / Clue's mistakes.

6. **The 5 things that would kill this product in the market** if left
   unaddressed 12 months from now.

For each: rate how likely it is to actually matter (1-5).

**Constraints.**
- Be brutal but fair. No strawmen.
- Cite specifics from PART A, not generic complaints.
- Acknowledge when a concern is a value-tradeoff, not a mistake
  (local-first vs cross-device, for example).

**Format as Markdown with a summary "biggest risks" list at the end.**

---

# PART C — Suggested farm-out order

If you have 4–6 Gemini tabs, run them like this:

1. **In parallel:** B.1 (UX audit) + B.3 (Inclusive/a11y) + B.6 (Adversarial).
   These are independent and won't cross-contaminate.
2. **After B.1 lands:** B.4 (Product strategy) with B.1's fix-list attached
   — strategy gets sharper knowing which UX weaknesses are worst.
3. **In parallel with B.4:** B.2 (Scale readiness) + B.5 (Data / engine
   review). Both need only the inventory in PART A.
4. **Optional consolidation pass:** after all 6 come back, hand the six
   outputs back to a 7th Gemini tab and ask for a synthesis + prioritised
   90-day roadmap.

Total wall-clock if parallelised well: ~90 minutes.

---

# PART D — Appendix (files in the repo that agents could ask for)

If a Gemini agent wants extended code context, these are the paths worth
providing:

- `app/(tabs)/*.tsx` — the 5 tabs
- `app/(onboarding)/*.tsx` — the 7-step funnel
- `src/engine/prediction/bayesian-predictor.ts` — the predictor math
- `src/engine/calendar/day-suggestions.ts` — the day-sheet engine
- `src/engine/reports/doctor-report.ts` + `condition-signals.ts`
- `src/engine/sisterhood/index.ts` — privacy-filtering logic
- `src/engine/community/moderation.ts` — client-side content moderation
- `src/security/ghost-mode-store.ts` — PIN + lock + panic
- `src/database/schema.ts` — the 11-table SQLite DDL
- `src/database/storage.ts` — 30 MMKV keys
- `src/theme/palettes.ts` + `aurora-static.ts` — design tokens
- `docs/HANDOFF.md` — running project log
- `docs/DAY-SUGGESTIONS.md` — the sub-phase engine design
- `docs/LEARN-REDESIGN-PROPOSAL.md` — Learn-tab plan
- `docs/LEARN-REDESIGN-GEMINI-BRIEF.md` — this doc's sister brief for Learn
- `scripts/predictor-simulation.ts` — the Node harness proving engines are pure

# PART E — Consolidation prompt (paste this LAST to a 7th tab)

You now have six analyses of the Dottie mobile app (paste all six as
attachments). Your task:

1. Deduplicate concerns that show up in more than one analysis.
2. Rank the CONSOLIDATED concern list by (severity × likelihood × ease
   of fix), where severity is user or business impact and likelihood
   is how soon it starts hurting.
3. Produce a **90-day roadmap** that groups the top 20 concerns into
   Now (0–30 days) · Next (30–60) · Later (60–90).
4. Flag any DISAGREEMENTS between the six analyses — where two agents
   contradict each other, name the tension and give your call.
5. Write a 3-sentence "the honest state of Dottie" summary a founder
   could paste into a board update.

**Format as a Markdown report ready to hand to an engineering team.**
