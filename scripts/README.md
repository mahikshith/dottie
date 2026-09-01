# scripts/

Offline TypeScript utilities that run under Node (via `tsx`).

## `predictor-simulation.ts` — end-to-end engine dry-run

Feeds curated fake cycle histories through the Bayesian predictor
(`src/engine/prediction/*`) and the v2 day-suggestion engine
(`src/engine/calendar/day-suggestions.ts`), then prints a readable report
so we can eyeball whether the two engines behave sensibly across the
scenarios that matter — without waiting for a device build.

**Run all scenarios:**

```
npm run simulate
```

**Just one scenario:**

```
npm run simulate -- --scenario pcos
```

Valid keys: `regular`, `pcos`, `cold_start`, `teen_sparse`, `thyroid`,
`endo`, `stressful_week`, `perimenopause_drift`.

**See the learning curve (does the posterior actually improve?):**

```
npm run simulate -- --learning
```

Feeds cycles one at a time and prints prediction error + confidence at
each step. Handy for sanity-checking after any predictor change.

### What each scenario is checking

| Scenario | What we're watching |
| --- | --- |
| `regular` | Textbook fit — high confidence, small ±window, tight prediction. |
| `pcos` | Confidence drops, window widens, `pcos_uncertainty` factor kicks in, prediction chip carries the "windows can shift with PCOS" softener. |
| `cold_start` | No cycles — falls back to the population prior. Widest window. Does not crash. |
| `teen_sparse` | Age < 16, only 2 cycles → confidence penalised, `teen_variability` factor appears. |
| `thyroid` | Slight confidence hit, day sheet surfaces thyroid-friendly food/movement tips. |
| `endo` | Recent-cramps symptom cluster → the "cramps" personal signal fires; endo-friendly comfort/movement lines appear. |
| `stressful_week` | High-stress + poor-sleep check-in → predictor mean-shifts, and the day sheet's personal signals name it. |
| `perimenopause_drift` | Cycles lengthening over time → predictor tracks the drift; `perimenopause_consideration` factor appears. |

### Non-goals

- Automated regression testing — use Jest/Vitest for that later.
- Model tuning — the harness only PRINTS what the current engine does.
- Any React Native / UI code — engines are pure TS, harness runs in Node.
