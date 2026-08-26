# `assets/lottie/` — illustrated companion animations

Drop Lottie `.json` files here, then wire each one into
[`src/content/companion-lottie.ts`](../../src/content/companion-lottie.ts) (one
line per animation). Nothing else in the app needs to change — every screen
renders companions through `<CompanionLottie>`, which uses the emoji
spirit-animal until the art is wired.

## Naming convention

```
<companion>-<state>.json        fox-idle.json · bunny-celebrate.json
moment-<name>.json              moment-confetti.json · moment-hydration.json
```

Companions: `fox bunny butterfly cat owl blossom`
States: `idle celebrate encourage cozy proud sad`
Moments: `confetti hydration heart streak_flame level_up quiz_perfect`

## Add a file (example)

```ts
// src/content/companion-lottie.ts
fox: {
  idle:      require('../../assets/lottie/fox-idle.json'),
  celebrate: require('../../assets/lottie/fox-celebrate.json'),
},
```

Metro bundles `.json` via `require()` automatically — no `app.json` change
needed. **Never** `require()` a path before the file exists (it breaks the build).

## Before committing art

See [`docs/LOTTIE-SOURCING.md`](../../docs/LOTTIE-SOURCING.md) for the full
inventory, size/loop specs, the **Lottie Simple License** terms, and the
attribution ledger to fill in per file.
