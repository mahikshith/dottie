# 🦊 Dottie — Lottie Character Sourcing Brief

> The illustrated, animated spirit companions (Duolingo-style) for the reimagined
> **Learn Quest** and **Calendar Planner**. This brief is what an artist,
> a marketplace search, or a future session needs to source and wire the art.
> **Last updated:** 2026-08-27 · design-v2 · ⚠️ pipeline written, art not yet sourced.

Concept references (published artifacts):
- Learn Quest — https://claude.ai/code/artifact/55ed5962-a5ba-497f-91bc-f753d250c7a5
- Calendar Planner — https://claude.ai/code/artifact/7b2dfab6-4069-4b4f-a51b-b9e7fc7831d9

---

## 0. TL;DR

- The **pipeline is built and drop-in**: put a `.json` in `assets/lottie/`, add one
  line to `src/content/companion-lottie.ts`, done. Screens already call
  `<CompanionLottie type state />` and fall back to the **emoji** spirit-animal
  until art lands — so we ship now and upgrade later with zero call-site changes.
- **`lottie-react-native` (Apache-2.0)** is already a dependency. It needs a native /
  dev build to render (same as MMKV) — fine, we already require one.
- The **one real dependency** is the art itself. Recommendation below.

## 1. The recommendation (style consistency > free grab-bag)

Dottie has **six** branded companions with defined personalities. Pulling six random
free animations from six different artists will look *inconsistent* — the opposite of
premium. Two good options, in order:

1. **Commission one matched set** (best): a single illustrator does all six animals in
   one style, each with the states below. Predictable, on-brand, owns the IP outright.
   Budget the six idle + celebrate states first; add the rest later.
2. **Adopt ONE cohesive free/paid pack** that already contains multiple animals in a
   single style (e.g. a "cute animals" pack), and map our six companions onto the
   closest members. Cheaper, faster, but constrains character choice and personality.

Avoid mixing single free animations across artists for the six heroes. Free single
assets **are** fine for the shared **moments** (confetti, hydration, heart) where style
consistency matters less.

## 2. Asset inventory

### Companions (6 animals × states) — `<companion>-<state>.json`
`fox` (Luna) · `bunny` (Pip) · `butterfly` (Mira) · `cat` (Nyx) · `owl` (Sage) · `blossom` (Dottie)

| State | Loop? | Where it plays | Priority |
|---|---|---|---|
| `idle` | loop | path-map node, hero, profile | **P0** — ship first |
| `celebrate` | one-shot | correct answer, lesson/quiz win | **P0** |
| `encourage` | one-shot/loop | start of an exercise | P1 |
| `cozy` | loop | menstrual/luteal care, hydration nudge | P1 |
| `proud` | one-shot | streak / level-up / badge | P2 |
| `sad` | one-shot | wrong answer / broken streak (soft, never punishing) | P2 |

Minimum viable set = **6 × {idle, celebrate}** = 12 files. Everything else degrades
gracefully to `idle` or the emoji.

### Shared moments — `moment-<name>.json`
| File | Loop? | Where |
|---|---|---|
| `moment-confetti` | one-shot | quiz pass, path badge |
| `moment-hydration` | loop | the "sip water" nudge |
| `moment-heart` | one-shot | care nudge / hug |
| `moment-streak_flame` | loop | streak celebration modal |
| `moment-level_up` | one-shot | level-up modal |
| `moment-quiz_perfect` | one-shot | 100% score |

## 3. Technical specs

- **Format:** Bodymovin **`.json`** (or `.lottie`). Prefer `.json` for the simple
  `require()` path. Keep each file **≤ ~120 KB** (large JSON = jank on low-end Android).
- **Canvas:** square, designed ~**512×512**, transparent background.
- **Frame rate:** 30 or 60 fps; keep idle loops short (2–4 s) and seamless.
- **Loops:** `idle`/`cozy`/`hydration`/`streak_flame` must loop cleanly; `celebrate`
  etc. are one-shots (`loop={false}`).
- **No embedded raster** if avoidable (keep it vector) — smaller + crisper.
- **Reduce-Motion:** `CompanionLottie` already pauses to the first frame, so ship a
  readable first frame.
- **Test on a real device** (esp. mid-range Android) — cannot be verified in this
  no-Node environment.

## 4. Licensing (read before committing anything)

- **`lottie-react-native`** — Apache-2.0. ✅ commercial use fine.
- **LottieFiles "free" assets** — **Lottie Simple License**: download, reproduce,
  modify, distribute, **including commercially**; **no attribution required**. BUT:
  - Any **modification is a derivative work under the same license** — keep the license
    terms with it. Fine for in-app use; just don't relicense.
  - You may **not** scrape/compile LottieFiles assets to build a **competing** service.
- **Premium / marketplace** assets — per-item license; read each. Commissioned art —
  make sure the contract **assigns IP to you** (or a broad commercial license).
- Even where attribution isn't required, **keep the ledger below** for our own audit.

## 5. Candidate sources (starting points — verify + preview each)

> ⚠️ Cannot preview these here (no device). Treat as leads to review, not picks.

- LottieFiles — animal category: https://lottiefiles.com/category/animal/animations
- LottieFiles — "cute animals" pack (matched style): https://lottiefiles.com/marketplace/welcome-cute-animals
- LottieFiles — cartoon mascot (free): https://lottiefiles.com/free-animations/cartoon-mascot
- LottieFiles — example free fox: https://lottiefiles.com/9477-fox
- LottieFiles — success confetti / checkmark: https://lottiefiles.com/free-animations/success-confetti · https://lottiefiles.com/free-animations/success-checkmark
- License basics: https://lottiefiles.com/page/license · https://help.lottiefiles.com/hc/en-us/articles/45243303062681-Commercial-Use-Attribution
- Other libraries to compare: IconScout Lottie, Lordicon (animated icons, good for moments), or commission via Dribbble/Upwork.

## 6. Attribution & license ledger (fill in per committed file)

| File | Source URL | Author | License | Notes |
|---|---|---|---|---|
| _(none sourced yet)_ | | | | |

## 7. Wiring checklist (per file)

1. Preview it on device; confirm loop/first-frame/size.
2. Confirm license; add a row to §6.
3. Save as `assets/lottie/<companion>-<state>.json` (naming in the assets README).
4. Add one line to `src/content/companion-lottie.ts`.
5. `npm run type-check`; device feel-check via `<CompanionLottie>`.
