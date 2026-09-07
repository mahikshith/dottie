# Dottie — Would a neural network predict better than our Bayesian model?

**Internal reference. Not user-facing.**
Written 2026-09-07 against commit `41e8889` on `gemini-v2`.

The owner sent three repositories and one question:

> "…whether we could combine the power of Bayes architecture with the neural
> networks, or we should move from Bayes into transformer architecture… we
> could set up Bayesian as a basic and all the machine learning models or
> neural network model transformer architecture as the advanced kind of a
> plan… or using lite transformer model or lstm based models via tensorflow
> lite could improve predictions right??"

It is a fair question and it deserved a measurement, not an opinion. So this
document is the measurement: the three repos read line by line, then seven
synthetic cohorts run through **the real shipped engine** and four learned
models under a protocol strict enough that the answer means something.

**The short answer.** A learned model beats our Bayesian predictor **only where
the cycle sequence carries ORDER structure** — autocorrelation or drift. Where
it does not, the two are within a rounding error of each other, and the naive
"same as last time" baseline is the only thing either of them beats
comfortably. Where a learned model does win, **a four-lag ridge regression wins
by as much as the neural net does**, which means the prize is linear and an
LSTM or a transformer is not what unlocks it. And every version of the win
needs **cohort training data we do not have and cannot collect** without
breaking the promise now printed on the welcome screen. The architecture is not
the bottleneck. The data is.

---

## 1. The three repositories

### 1.1 `Sreelakshmi393/MenstruMate` — `periods-model1.ipynb`

Predicts `EstimatedDayofOvulation` from the Kaggle FedCycle dataset
(1,665 rows, 12 columns). Three problems, in ascending order of seriousness.

**Target leakage.** The feature matrix is built as

```python
X = data.drop('EstimatedDayofOvulation', axis=1)
```

which leaves `LengthofCycle` and `LengthofLutealPhase` in `X`. In this dataset
the day of ovulation is *arithmetically* cycle length minus luteal phase
length. The model is being handed the answer and asked to subtract. Any
accuracy reported from that split describes the dataset's own arithmetic, not a
forecast.

**Subject leakage.** The split is `train_test_split(...)`, drawn at random over
rows. The dataset is longitudinal — the same `ClientID` contributes many
cycles — so the same woman's cycles land on both sides of the split. A model
that memorises "client 402's cycles are 31 days" scores well and has predicted
nothing.

**The app does not use the model.** The deployment cell loads `model.pkl` and
then returns `prediction = cycle_length` — the input, unchanged.

### 1.2 `chiomajaco6/MenstrualCyclePrediction`

The more serious of the two: a paper, a Django deployment, "twenty two (22)
machine learning algorithms" including XGBoost, CatBoost, LightGBM and a Keras
LSTM. Same dataset, and — verified in
`menstrual_cycle_prediction_system_using_hybrid_machine_learning_algorithms…py`
— the **same two defects**:

```python
ovulation_dataset = df[['CycleNumber', 'LengthofCycle', 'LengthofLutealPhase', …, 'EstimatedDayofOvulation']]
X = ovulation_dataset.drop('EstimatedDayofOvulation', axis=1)
y = ovulation_dataset['EstimatedDayofOvulation']
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.15, random_state=42)
```

`LengthofCycle` and `LengthofLutealPhase` are in the features; the split is
random rather than grouped by client. The README names MSE, RMSE, MAE, R², MAPE
and EVS as the metrics and reports **no numbers** for any of them.

Neither repo is evidence that ML beats a statistical model at this task. They
are evidence that ML can reproduce a subtraction.

### 1.3 `KaavinB/Wind-Prediction-LSTM-Federated-Learning`

Not a cycle repo at all — LSTM wind/energy forecasting with the **Flower**
federated-learning framework, no reported metrics. Its relevance is the
federated part, and it is real: federated learning is the one published
technique that could give us cohort training without a cohort database. It is
also, today, a Python/Flower server plus a client that trains on device. We
have neither, and §5 explains why the trade is worse than it looks.

---

## 2. Why the comparison had to be built rather than read

Our model treats a person's cycle lengths as **independent draws around her own
mean**, with the spread learned from her own history (`bayesian-predictor.ts`,
Normal-Inverse-Gamma on log length). A sequence model — LSTM, transformer, GBM
on lags — can only beat that if real cycles carry structure the mean-and-spread
view throws away: autocorrelation (a long cycle followed by another long one),
regimes (calm stretches and disrupted stretches), drift (slow lengthening).

So the question "is a neural net better" is really: **how big is that prize,
and does it take a neural net to collect it?** That can be answered without a
cohort, by generating cohorts where the structure is present and absent by
construction and measuring the gap.

**The protocol** (`scripts/research/ml_vs_bayes.py`):

- **Subject-wise splits.** 400 simulated users per cohort, 70/30 by *person* —
  a person is wholly in train or wholly in test. This is the check both repos
  skip.
- **Walk-forward targets.** Every sample is (history so far → the next cycle),
  from 3 cycles of history up to 13. No future information anywhere.
- **The real engine.** The Bayesian column is not a re-implementation. It is
  our shipped `buildPopulationPrior` + `posteriorPredictiveCycleLength`, called
  over a stdin bridge (`scripts/research/bayes-bridge.ts`) so Python compares
  against what is actually installed on the owner's phone.
- **Same folds, same targets, four learned models**: HistGradientBoosting
  (the family the repos use), an MLP, a ridge regression on four lags plus
  summary stats, and the naive "next cycle = last cycle".
- **The prior gets what the app would have.** Each Bayesian call is given a
  reported cycle length (the mean of that user's first three cycles, standing
  in for what she would have typed at onboarding), age 30, no conditions —
  the same shape of input `predictor.ts` builds on a real phone.
- Error is **mean absolute error in days** — the number a user would feel.

**What we could not do.** Get real data. The FedCycle CSV is not committed to
either repo, and Kaggle and the Marquette study page are both blocked by this
environment's egress proxy. So every number below is measured on synthetic
cohorts. That is a real limit and it is stated plainly — but note what the
synthetic design buys: because we *chose* which cohorts carry order structure,
the result is not "ML gains X on our data", it is **"ML gains X exactly where
order structure exists, and nothing where it does not"**, which is the
architectural answer.

---

## 3. The measurement

400 users × 14 cycles per cohort · 1,320 test predictions each · MAE in days ·
lower is better. `best ML gain` is Bayes minus the best of the three learned
models — positive means the learned model won.

```
cohort       n_test    Bayes      GBM      MLP    Ridge     last  best ML gain
------------------------------------------------------------------------------
regular        1320     0.92     1.04     0.93     0.92     1.14        +0.00d
typical        1320     2.12     2.26     2.10     2.08     2.79        +0.04d
variable       1320     4.32     4.60     4.31     4.24     5.75        +0.08d
pcos_like      1320     7.00     7.44     6.97     6.78     8.94        +0.22d
ar1            1320     1.74     1.52     1.38     1.36     1.41        +0.38d
regime         1320     4.08     4.28     3.96     3.90     4.75        +0.17d
drift          1320     2.90     2.38     2.13     2.12     2.74        +0.77d
```

The cohorts: `regular` / `typical` / `variable` / `pcos_like` are i.i.d. draws
around a personal mean with spread 1.0 / 2.5 / 5.0 / 9.0 days. `ar1` has lag-1
autocorrelation φ=0.75. `regime` flips between calm and disrupted stretches.
`drift` lengthens by 0.45 days per cycle, as in perimenopause.

**Five things fall straight out of that table.**

1. **Where cycles are i.i.d., there is nothing to win.** +0.00, +0.04, +0.08,
   +0.22 days. The largest of those is five hours, on the cohort whose error is
   already seven days — a 3% improvement on a number nobody experiences as
   precise. No architecture fixes that, because there is no signal to extract:
   if the next length is an independent draw, the best possible forecast is the
   person's own mean, which is exactly what we compute.

2. **On the steadiest users we are already optimal.** `regular`: Bayes 0.92,
   ridge 0.92, MLP 0.93. A model trained on 280 other people cannot beat a
   conjugate update on your own eight cycles when your cycles are steady. It is
   worth sitting with that for a second, because it is the whole answer in one
   row.

3. **Where order structure exists, the prize is real but modest.** +0.38 days
   on autocorrelation, +0.77 on drift. Worth having. Not transformative — and
   both are cases our model is *structurally* blind to, so this is the honest
   upper bound on what any sequence model could add.

4. **The prize is linear.** Ridge on four lags beats the gradient-booster in
   **all seven** cohorts and matches or beats the MLP in all seven (0.92 vs
   0.93, 2.08 vs 2.10, 4.24 vs 4.31, 6.78 vs 6.97, 1.36 vs 1.38, 3.90 vs 3.96,
   2.12 vs 2.13). A hundred-parameter linear model captures everything the
   neural network does. **This is the finding that kills the LSTM/transformer
   plan**: capacity is not the constraint, so buying more capacity buys
   nothing. A transformer would arrive at the same 2.12.

5. **Our model earns its place against the naive baseline.** Bayes beats
   "next = last" in six of seven cohorts, by 1.9 days on `pcos_like` and 1.4 on
   `variable`. The one loss is `ar1` — by construction the cohort where the
   last value is the most informative thing in the world.

### 3b. A bug worth recording, because it changed the answer

The first run of this experiment had the bridge passing the reported cycle
length under a mistyped option name. TypeScript would have caught it; `tsx`
does not type-check, so it ran, the property was silently ignored, and **every
Bayesian prediction used the population mean instead of the user's own stated
average**. The corrected numbers above differ from that run in a way that
matters:

| cohort | Bayes, no stated average | Bayes, with it |
|---|---|---|
| regular | 1.09 | **0.92** |
| typical | 2.10 | 2.12 |
| variable | 4.23 | 4.32 |
| pcos_like | 6.82 | 7.00 |
| ar1 | 1.80 | 1.74 |
| drift | 3.06 | 2.90 |

The entire apparent ML win on `regular` (+0.18 days) was our own bug. And the
sign flips for the irregular cohorts: a self-reported average **helps a steady
user and slightly hurts a very irregular one**, because for a 9-day-spread body
a three-cycle self-report is a noisier anchor than the population mean is.
That is a live engine finding, not an ML one — it is item 3 in §6. It is also
the reason this document reports the corrected run: `type-check` is part of
`test:all`, and research code that skips it can invent its own conclusions.

---

## 4. Could we take the prize without a cohort? (the hybrid)

If the win comes from drift and lag-1 structure, both of those can in principle
be estimated **from one person's own history**, on device, in a dozen lines of
TypeScript — no training set, no runtime, no privacy cost. So we built it
(`scripts/research/hybrid2.py`): a drift term from the slope of the recent
cycles, shrunk by the t-statistic of that slope, plus an AR(1) pull toward the
last cycle shrunk by sample size, capped at ±4 days. Weak evidence → weight
near zero → the prediction is untouched.

```
cohort          Bayes   hybrid   best ML  ML prize    kept
------------------------------------------------------------
regular          0.92     0.93      0.92     +0.00     —
typical          2.12     2.13      2.08     +0.04     —
variable         4.32     4.42      4.24     +0.08  -120%
pcos_like        7.00     7.11      6.78     +0.22   -47%
ar1              1.74     1.55      1.36     +0.38    50%
regime           4.08     4.07      3.90     +0.17     6%
drift            2.90     2.77      2.12     +0.77    16%
------------------------------------------------------------
mean             3.30     3.28
```

It recovers **50% of the autocorrelation prize and 16% of the drift prize** —
and pays for it by making `variable` 0.10 days worse and `pcos_like` 0.11 days
worse. Mean MAE across the seven: **3.30 → 3.28**, which is noise. Read as a
trade it is worse than the mean suggests: it takes accuracy from the irregular
bodies, who have the least of it and need it most, and gives it to the drifting
ones. That is not a trade this app makes, and a 0.02-day mean on synthetic data
is nowhere near the bar for touching the number a person plans her month around.

**Why it fails is the important part.** By the time a user has 8 logged cycles,
the sampling error on her own lag-1 autocorrelation is roughly ±0.35 and on her
own drift slope is a similar fraction of the slope itself. Any shrinkage weak
enough to collect the real trend also amplifies noise for the person who has
none, and the second group is much larger than the first. The cohort-trained
models do better precisely because they learn the trend coefficient from 280
*other* people and apply it with confidence. **The prize is not locked behind
architecture. It is locked behind other people's data.** Which is the one thing
Dottie has promised, on its own welcome screen, never to collect.

---

## 5. So: TensorFlow Lite, LSTM, transformer, basic/advanced tiers?

**No, and not because of squeamishness about ML — because of the table.**

- **The gain does not exist without cohort data.** Every positive number in §3
  comes from a model trained on 280 other users. On-device-only, the same
  structure yields the §4 wash.
- **The gain that does exist is linear.** Ridge ≥ MLP in every cohort, ridge >
  GBM in every cohort. Shipping a transformer to collect a linear effect is
  paying a runtime, a bundle and a reviewability cost for arithmetic.
- **The runtime cost is not nominal for us.** TFLite means a native module on
  an Expo managed build — a config plugin, a prebuild, and a hard collision
  with rule 7 (never import a native module at module scope on the boot path).
  Several megabytes of APK for ≤0.8 days of accuracy in the cohorts that have
  structure and ~0.0 in the ones that do not.
- **A regressor gives a number; we ship an interval.** The whole prediction UI
  — the ±, the confidence figure, the DT29 explainer that now teaches what a
  median and a spread *mean* — comes from a posterior predictive
  *distribution*. A point-estimate net gives no ± at all; getting one back
  needs quantile heads or conformal calibration, i.e. more machinery to reach
  what the conjugate model hands us in closed form.
- **It would break the disclosure.** Rule 31: `what-we-use.ts` is the one
  description of the forecast's inputs, and `test:transparency` pins it to the
  code. A learned model's inputs are its weights. We would have to either stop
  making that promise or make a vaguer one — and the promise is worth more to
  this app than 0.2 of a day.
- **A "basic vs advanced" tier is the worst version of all of it.** Two models
  means two answers, and the day they disagree the user learns that at least
  one of the numbers we have been showing her was the worse one. Dottie shows
  one forecast and explains it.

**Federated learning** (repo 1.3) is the only route that could resolve the data
problem in principle: train across devices, share gradients, never ship a
cycle. It is also a server we do not run, a client that trains on a phone
battery, a real re-identification literature around gradient leakage, and — per
§3 — a ≤0.8 day prize in the cohorts where it applies. Worth revisiting **only**
if Dottie ever has a population and the measurement is re-run on it.

---

## 6. What is actually worth doing instead

Ranked by measured or structural value, all of it on-device TypeScript inside
the existing engine.

1. **Detect drift and say so — widen the ±, do not move the median.**
   §4 shows we cannot reliably *correct* a personal trend from 8 cycles, but
   the same t-statistic is more than enough to *notice* one. A person whose
   cycles are lengthening deserves "your last few cycles have been getting
   longer, so this window is wider than usual" far more than she deserves a
   0.13-day-better point estimate. Detection is the honest half of the prize,
   it costs nothing, and unlike the correction it cannot make anyone's number
   worse.
2. **Measured signals — LH, BBT, cervical fluid** (already owed in `HANDOFF`
   §1). Note what both repos were actually predicting: the day of ovulation.
   An LH surge *observes* it. One logged positive test relocates the fertile
   window by more than any sequence model in this document moves anything.
3. **Reconsider how hard the reported average anchors the prior for an
   irregular body.** §3b: with a 9-day spread, a self-reported average is a
   worse anchor than the population mean (7.00 vs 6.82 MAE), and with a 1-day
   spread it is much better (0.92 vs 1.09). The prior currently takes the
   reported figure at face value in both cases. Weighting it by the spread the
   user's own logs reveal is a dozen lines in `buildPopulationPrior`, and it is
   measurable with the harness that is already committed.
4. **Use `predictionErrors`.** We record how wrong each forecast turned out and
   then ignore it. A person's own measured track record is the least
   speculative calibration signal we have, and it needs no cohort.
5. **Delete or wire `confidence.ts` and `health-adjustments.ts`** — both dead,
   both plausible-looking, both a trap for the next reader.

**The acceptance bar for any of it**, and for any future ML proposal: measured
on subject-wise splits, walk-forward, against the real engine over the bridge;
**≥ 0.5 day MAE improvement, no cohort made worse**, and the result must still
be describable in `what-we-use.ts`.

---

## 7. Re-running this with real data

The scripts are committed under `scripts/research/` precisely so this is a
half-hour job the day a real dataset exists.

```bash
pip install numpy pandas scikit-learn
python3 scripts/research/ml_vs_bayes.py     # the table in §3
python3 scripts/research/hybrid2.py         # the table in §4
```

To swap in real data, replace `cohort()` in `ml_vs_bayes.py` with a loader that
returns **one list of cycle lengths per person, oldest first** — everything
downstream (the subject-wise split, the walk-forward sampler, the bridge) is
already agnostic to where the sequences came from. Four things must not be
relaxed while doing it, because three of them are what the repos got wrong and
the fourth is what we got wrong:

- split by **person**, never by row;
- never let a feature contain the target's arithmetic (`LengthofCycle` and
  `LengthofLutealPhase` are not features when predicting the ovulation day);
- compare against the **real engine**, not a re-implementation —
  `bayes-bridge.ts` exists so there is no excuse;
- run `npm run type-check` over the bridge before believing a number (§3b).

If the real numbers look like §3, this document stands and the answer stays no.
If a real cohort shows a ≥ 0.5 day gap that a ridge cannot close, that is the
day to reopen the runtime question — and even then the first thing to try is
the ridge, on device, in TypeScript, with its coefficients written down where
`what-we-use.ts` can describe them.
