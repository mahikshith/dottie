# 🧪 Type-check Handoff — resume here next session

> Branch **`design-v2`**. **✅ DONE (2026-08-30): `npx tsc --noEmit` is CLEAN — 0 errors (was 99).**
> `eas.json` created. The remaining Phase-0 steps need the owner's Expo account — see the bottom.
> (The fix log below is kept for reference; all 99 are resolved.)

## Environment / commands (IMPORTANT)

- Node 24.19.0 installed via winget; **new shells don't have it on PATH**. Every command:
  ```powershell
  $env:Path = "C:\Program Files\nodejs;" + $env:Path
  Set-Location "C:\Users\mahik\Desktop\dottie\dottie"
  npx tsc --noEmit
  ```
- `npm install` already done (node_modules present). If it needs redoing and hits ERESOLVE:
  it was fixed by pinning **`lottie-react-native` to `7.1.0`** (was `^7.1.0`, which resolved to
  7.5.0 and demanded React 19). Keep it pinned.

## Fixes ALREADY applied (do not redo)

1. **`src/content/questions.ts`** — escaped 8 apostrophes in single-quoted strings (Don't,
   body's, she's, that's, you're, it's) at lines ~750/783/905/1171/1206/1278/1330/1383. Cleared
   61 syntax errors.
2. **`src/types/content.types.ts`** — widened `TrackedMetric` union to all 27 metrics used by
   questions.ts (flow, hydration, stress, cycle_length, appetite, bbt, cervical_mucus,
   confidence, motivation, pain_tolerance, period_prediction, period_prep, phase_awareness,
   pms, productivity, reflection, exercise, focus, etc.). Cleared 25.
3. **`tsconfig.json`** — added `"module": "esnext"` (dynamic imports; cleared 7 TS1323).
4. **`src/constants/typography.ts`** — `fontVariant: ['tabular-nums'] as const` →
   `as ('tabular-nums')[]` (×2). Cleared readonly-fontVariant errors.
5. **`src/engine/content/index.ts`** — fixed barrel re-export names:
   `classifySymptomCluster`→`detectSymptomCluster`, `CohortProvider`→`CohortContentProvider`,
   `ContentType`→`CohortContentType` (+ alias `CohortContentType as ContentType`).
6. **`src/engine/content/companion-dialogue.ts`** — added `export type TimeOfDay = 'morning' |
   'afternoon' | 'evening' | 'night';` and used it in getTimeOfDay's return.
7. **`src/engine/prediction/phase-calculator.ts`** — import path `../types/cycle.types` →
   `../../types/cycle.types`.
8. **`app/lesson/[id].tsx`** — removed bad `LessonSection` import from cycle.types and the
   leftover `void LessonSection;` hack (LessonSectionType from content.types is the real one).
9. **`src/services/feedback-transport.ts`** — `import('expo-mail-composer')` →
   `import('expo-mail-composer' as string)` (module intentionally not installed).
10. **`src/engine/sisterhood/index.ts`** — `void ShadowCheckIn;` → `export type { ShadowCheckIn };`.
11. **Gamification undefined guards** (noUncheckedIndexedAccess):
    - `levels.ts`: `JOURNEY_PHASES[...length-1]!`; `... ?? LEVEL_DEFINITIONS[0]!`;
      `let current = LEVEL_DEFINITIONS[0]!`; `return LEVEL_DEFINITIONS[index+1] ?? null`.
    - `xp.ts`: `let currentLevel = LEVEL_DEFINITIONS[0]!`; `return LEVEL_DEFINITIONS[index+1] ?? null`.
12. **`app/(tabs)/home.tsx`** — `{q.text}` → `{q.companionText}` (RenderedQuestion has no `.text`).
13. **awardXp source fix** — `awardXp('quiz_complete', …)` is invalid (that's a *gem* source).
    `app/exercise/[lessonId].tsx` → `'lesson_complete'`; `app/quiz/[id].tsx` → `'quiz_pass'`.
    (`earnGems('quiz_complete')` stays — valid GemSource.)

## Remaining 36 errors + exact fix plan

### A. TS1117 duplicate object keys — 28 errors (7 screens) — the bulk
Each is a **duplicated `StyleSheet.create` key** (came from Phase-2 polish appending styles).
They appear in **adjacent pairs**. For each: open the file, look at the flagged line to get the
key name, `grep -n "  <keyName>:" file` to find BOTH definitions, and **delete the redundant one**
(JS uses the LAST occurrence at runtime, so prefer keeping the later/polished value and removing
the earlier duplicate — but eyeball the two values; if identical, remove either).
Lines:
- `app/(community)/new-post.tsx`: 465,466 · 506,507 · 605,606
- `app/(community)/post/[id].tsx`: 816,817
- `app/(profile)/doctor-report.tsx`: 306,307 · 404,405
- `app/(sisterhood)/add-member.tsx`: 970,971 · 999,1000 · 1025,1026 · 1077,1078 · 1137,1138
- `app/(sisterhood)/member/[id].tsx`: 783,784
- `app/(sisterhood)/shadow-log/[id]/period.tsx`: 358,359 · 432,433

### B. Eight one-offs
1. **`app/(tabs)/home.tsx:105`** TS2554 — `getTimeGreeting()` now REQUIRES a `TimeOfDay` arg.
   Fix: `getTimeGreeting(getTimeOfDay())`. Ensure `getTimeOfDay` is imported from
   `@engine/content` (or wherever getTimeGreeting comes from) in home.tsx.
2. **`app/(tabs)/calendar.tsx:185,215`** TS2345 — `phaseForDate(iso, lastPeriodStart, userHealth)`
   where `userHealth: HealthProfile | undefined`, but the 3rd param wants
   `{averageCycleLength: number; averagePeriodLength: number} | null | undefined` and
   `HealthProfile.averageCycleLength/averagePeriodLength` are `number | null`. **Preferred fix:**
   find `phaseForDate` (grep) and loosen its 3rd param to accept `number | null` fields (coalesce
   to defaults 28/5 inside), OR normalize at both call sites:
   `phaseForDate(iso, lastPeriodStart, userHealth ? { averageCycleLength: userHealth.averageCycleLength ?? 28, averagePeriodLength: userHealth.averagePeriodLength ?? 5 } : null)`.
3. **`src/engine/content/quiz-engine.ts:232`** TS2345 — passing `'quiz'` where `CohortContentType`
   expected (`daily_decode|questions|tips|predictions|phase_weather`). Read line 232; likely the
   wrong arg to a resolver/provider call. Either use the correct existing member or, if quizzes
   really are cohort content, add `'quiz'` to `CohortContentType` in
   `src/engine/content/content-resolver.ts`. Inspect before choosing.
4. **`src/content/remote/content-bundle.ts:77`** TS2554 — a call is missing its 2nd argument.
   Read line 77, find the callee's signature, pass the missing arg.
5. **`src/engine/prediction/health-adjustments.ts:338`** TS2532 — object possibly undefined.
   Add a guard / `?.` / non-null assert if provably safe.
6. **`src/components/beta/VersionBadge.tsx:138`** TS2769 — no overload matches. Read line 138
   (likely a StyleSheet/Animated/Date call with a wrong-typed arg).
7. **`src/components/ui/CompanionLottie.tsx:58`** TS2322 — `LottieAsset` not assignable to
   LottieView `source` (`string | AnimationObject | {uri} | undefined`). Cast/adapt the asset to
   the expected shape, or narrow `LottieAsset`.

## ✅ Type-check DONE — next: Android dev build (needs the owner's Expo account)
`npx tsc --noEmit` → **0 errors**. `eas.json` created (the `development` profile builds a
dev-client `.apk`). `app.json` already has `android.package = com.dottie.app`.

Remaining steps — the **owner** runs these (they need a **free Expo account**; Claude may not
create accounts or log in). Prepend PATH first each shell:
`$env:Path = "C:\Program Files\nodejs;" + $env:Path` then from the repo:
1. `npx eas-cli login` — sign in / create the free Expo account.
2. `npx eas-cli init` — links the project, writes `extra.eas.projectId` into app.json.
3. `npx eas-cli build --profile development --platform android` — cloud-builds the dev `.apk`.
4. Install the `.apk` on an Android phone → `npx expo start --dev-client` → scan the QR.

Notes:
- MMKV + Lottie need this dev build (won't run in Expo Go).
- `expo-notifications` is a dependency but NOT yet in `app.json` `plugins` — verify whether it
  needs the config plugin before shipping notifications.
- App icon is DONE (`docs/LOGO-IDENTITY-BRIEF.md`). Nothing is runtime-verified yet.
- Commit only when the owner asks. `docs/_tsc-remaining.txt` scratch file has been deleted.
