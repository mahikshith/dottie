# Dottie — every screen

41 screens across 7 stacks. Companion doc: `docs/DESIGN.md` (the system they
are all built from). Line counts are a rough proxy for how much lives in each.

```
app/
├── index.tsx ─────────── boot router: onboarded? → (tabs) : (onboarding)
├── (onboarding)/ ─────── 6 screens, one path, no branches
├── (tabs)/ ───────────── 5 tabs: Today · Cycle · Learn · Circle · You
├── lesson → quiz → exercise  the learning stack
├── (profile)/ ────────── 10 screens behind the You tab
├── (sisterhood)/ ─────── 5 screens behind the Circle tab
├── (community)/ ──────── 2 screens behind the Circle tab
└── (modals)/ ─────────── 6 sheets that can appear over anything
```

---

## 1. Onboarding — `app/(onboarding)/` · 6 screens

The whole flow is one line; there are no branches and nothing is required
except the cycle question.

| # | Screen | What it does | Design notes |
|---|---|---|---|
| 1 | `welcome` (242) | The pitch: app icon, then five claims — on device, no account, works in airplane mode, no ads, export any time — above "Let's Get Started" | The claims moved HERE from a splash screen: a 1–2s splash is not where anyone reads a privacy promise. Scrolls, so the CTA can never land under the nav bar |
| 2 | `mode-select` (186) | Full / Ghost mode | Ghost is chosen before any data exists, on purpose |
| 3 | `conditions` (331) | PCOS, thyroid, endo… multi-select | Each row is a `ConditionRow` carrying *what it is, why we ask, what it does to the maths* (rule 34). A row you can't understand is a row people guess at |
| 4 | `cycle-setup` (363) | Last period + usual cycle length | "a week or two ago" names the exact date it will record, and says the shaded days are an estimate |
| 5 | `reminders` (363) | Six reminder types | Was three; the app had more to offer than it asked about |
| 6 | `ready` (213) | Done | Sets `onboardingComplete` |

*(The companion picker used to sit between 3 and 4. Removed at DT31 — the flow
now goes conditions → cycle-setup.)*

---

## 2. The five tabs — `app/(tabs)/`

### Today — `home.tsx` (912)
The hero row (a mood-reactive `MoodEmoji` + greeting on the left, the day ring
on the right, both on one baseline), the phase bar, streak and gems, a quick
mood row, the check-in CTA, the mood map, and the "Dottie predicts" card.
Tapping the ring opens the calendar — the owner kept trying it, so it works.

### Cycle — `calendar.tsx` (2,713 — the biggest screen in the app)
A swipeable month grid, one person at a time (yours, or a sister's). Under it:
the legend, a toggle that swaps the colour key for a **dated list in words**
("29–31 Aug · 3 days · Luteal"), the week-ahead strip, the prediction
explainer, the science charts and a reminders shortcut.
The grid, the list and the screen reader all read `dayMark()` — one precedence
chain (rule 33), so the key can never lie about the map. A ⚡ quick-log chip
turns every past day into a one-tap toggle.

### Learn — `learn.tsx` (1,075)
A Duolingo-style path: 88px nodes on a curving trail, checkpoints every four
lessons, a "you are here" marker that hops on the current node, per-path
progress, and today's spotlight card. The node model and trail are memoised
and `PathTrail` is `memo`'d — DT28's treacle scroll was ~100 animated SVG
surfaces mounted at once.

### Circle — `community.tsx` (716) *(the Sisterhood/Community tab)*
The shared feed and the entry to both `(sisterhood)` and `(community)`.

### You — `profile.tsx` (590)
Level, streak and stats up top, then every settings row: About you,
Transparency, Reminders, Medications, Export, Doctor report, Privacy, Ghost
Mode, Diagnostics, About this build, Walkthrough replay.

---

## 3. The learning stack

| Screen | What it does |
|---|---|
| `lesson/[id]` (643) | The READER — sections, cards, images, then Practice / Quiz. Deliberately not a chat (reverted at DT16) |
| `quiz/[id]` (1,236) | Where the conversation lives: a lead-in line before each question, an answer reaction after it, the explanation on right AND wrong, two attempts then the answer, and a score result that never grins at a 1-of-3 |
| `exercise/[lessonId]` (321) | Drag/match/order practice with the same feedback discipline |

---

## 4. You → `app/(profile)/` · 10 screens

| Screen | What it does |
|---|---|
| `about-you` (354) | **The one place** age, cycle length, weight, height and conditions live — all editable. Saving re-runs the model and shows confidence before → after (rule 34) |
| `prediction-transparency` (359) | What the forecast uses, what it does NOT use, what the median and the ± actually mean, and a ranked list of what would sharpen it — which never promises past the biological ceiling |
| `reminders` (744) | Period-linked, daily and custom reminders with real times |
| `medications` (422) | Multi-type medication tracking with its own reminders |
| `export-data` (331) | A real .xlsx with native charts, written by hand |
| `doctor-report` (413) | A printable summary for an appointment |
| `privacy` (204) | What is stored, where, and what leaves the phone (nothing) |
| `ghost-mode` (723) | The decoy app, the PIN, and how to get back out |
| `diagnostics` (269) | The shareable, redacted event trail — no raw dates |
| `about-build` (133) | Version, commit, build date |

---

## 5. Circle → `app/(sisterhood)/` · 5 screens

`circle` (490) the roster · `add-member` (1,195 — the longest flow: name, age,
conditions, privacy level, then a celebration) · `member/[id]` (895) her
profile and cycle · `shadow-log/[id]/check-in` (304) logging FOR someone ·
`shadow-log/[id]/transfer` (603) handing the log over when she gets her own
phone. Sister period days are logged on the ONE calendar via
`/(tabs)/calendar?logFor=` (rule 17) — there is no second date picker anywhere.

## 6. Circle → `app/(community)/` · 2 screens

`new-post` (617) and `post/[id]` (899) — named or anonymous, with the
moderation and safety copy that goes with it.

---

## 7. Modals — `app/(modals)/` · 6

`daily-checkin` (575) the full check-in · `checkin-recap` (310) what it
learned · `streak-celebration` (216) with the seven-day strip · `level-up`
(205) · `ghost-lock` (40) and `decoy-home` (34) — the two halves of Ghost Mode
· `beta-feedback` (50).

None of these is a React Native `<Modal>` (rule 10), and none uses
`presentation: 'modal'` (rule 24) — they are `SHEET_PRESENTATION` routes and
`showAppDialog()` surfaces.

---

## 8. Where the screens keep their state

- **Zustand v5** stores in `src/stores/` — user, cycle, content, gamification,
  community, beta-feedback, walkthrough. Selectors must never return a fresh
  array/object (rule 11).
- **expo-sqlite** for anything with history; **MMKV** (`Storage.*`) for
  preferences, drafts and the weight log.
- Engines in `src/engine/` are pure and unit-tested: `prediction/`, `calendar/`,
  `learn/`, `content/`, `gamification/`, `insight/`.

---

*Written 2026-09-11 on `gemini-v2`. Counts from the working tree at DT31.*
