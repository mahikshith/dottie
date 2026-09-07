"""
Does a learned model beat Dottie's Bayesian predictor — and WHEN?

We have no cohort data, so this cannot answer "how much better on real users".
What it CAN answer, decisively, is the question that actually drives the
architecture decision:

    Our model treats a person's cycle lengths as independent draws around
    their own mean. A sequence model (LSTM / transformer / GBM on lags) can
    only beat that if real cycles carry ORDER structure — autocorrelation,
    regimes, drift. So: across data-generating processes with and without
    that structure, how big is the prize?

Protocol (deliberately strict, because the repos we were pointed at are not):
  · subject-wise splits — a person is wholly in train or wholly in test
  · predict the NEXT cycle from the ones before it, walk-forward
  · same folds, same targets for every model
  · the Bayesian numbers come from the REAL shipped engine over a bridge
"""
import json, os, subprocess, numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.neural_network import MLPRegressor
from sklearn.linear_model import Ridge

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RNG = np.random.default_rng(20260907)
N_USERS, N_CYCLES, LAGS = 400, 14, 4

def cohort(kind, n_users=N_USERS, n=N_CYCLES):
    """Each user gets a personal mean and spread; `kind` sets the ORDER structure."""
    out = []
    for _ in range(n_users):
        mu = RNG.normal(29, 2.5)
        sd = {'regular': 1.0, 'typical': 2.5, 'variable': 5.0, 'pcos_like': 9.0}.get(kind, 2.5)
        if kind in ('ar1', 'regime', 'drift'):
            sd = 2.5
        if kind == 'ar1':
            # long cycles follow long ones — the classic thing an LSTM eats
            e, phi, seq = 0.0, 0.75, []
            for _ in range(n):
                e = phi * e + RNG.normal(0, sd * np.sqrt(1 - phi**2))
                seq.append(mu + e)
        elif kind == 'regime':
            # alternating calm / disrupted stretches (PCOS-ish, stress-ish)
            seq, hot = [], False
            for _ in range(n):
                if RNG.random() < 0.18: hot = not hot
                seq.append(RNG.normal(mu + (6 if hot else 0), sd * (2.2 if hot else 1)))
        elif kind == 'drift':
            # slow lengthening, as in perimenopause
            seq = [RNG.normal(mu + 0.45 * i, sd) for i in range(n)]
        else:
            seq = [RNG.normal(mu, sd) for _ in range(n)]
        out.append(np.clip(np.round(seq), 18, 60).astype(int).tolist())
    return out

def samples(users, min_hist=3):
    """Walk-forward: (user_index, history, target)."""
    rows = []
    for ui, seq in enumerate(users):
        for t in range(min_hist, len(seq)):
            rows.append((ui, seq[:t], seq[t]))
    return rows

def feats(hist):
    """Lag features + the summary stats any sane baseline would use."""
    lags = (hist[-LAGS:] + [hist[-1]] * LAGS)[-LAGS:]
    a = np.array(hist, float)
    return lags + [a.mean(), a[-3:].mean(), a.std() if len(a) > 1 else 0.0, len(a),
                   a[-1] - a[-2] if len(a) > 1 else 0.0]

def bayes(rows):
    """The REAL engine, over a bridge — not a re-implementation."""
    payload = [{'history': h, 'stated': int(round(np.mean(h[:3])))} for _, h, _ in rows]
    p = subprocess.run(['npx', 'tsx', 'scripts/research/bayes-bridge.ts'], input=json.dumps(payload),
                       capture_output=True, text=True, cwd=ROOT)
    if p.returncode != 0:
        raise SystemExit(p.stderr[-800:])
    return np.array([r['mean'] for r in json.loads(p.stdout)])

SC = 'scripts/research'
print(f"{'cohort':<12}{'n_test':>7}{'Bayes':>9}{'GBM':>9}{'MLP':>9}{'Ridge':>9}{'last':>9}{'best ML gain':>14}")
print('-' * 78)
for kind in ['regular', 'typical', 'variable', 'pcos_like', 'ar1', 'regime', 'drift']:
    users = cohort(kind)
    cut = int(0.7 * len(users))                      # SUBJECT-wise split
    tr, te = samples(users[:cut]), samples(users[cut:])
    Xtr = np.array([feats(h) for _, h, _ in tr]); ytr = np.array([y for _, _, y in tr])
    Xte = np.array([feats(h) for _, h, _ in te]); yte = np.array([y for _, _, y in te])

    mae = lambda p: float(np.mean(np.abs(p - yte)))
    res = {}
    res['Bayes'] = mae(bayes(te))
    res['GBM'] = mae(HistGradientBoostingRegressor(max_iter=300, random_state=0).fit(Xtr, ytr).predict(Xte))
    res['MLP'] = mae(MLPRegressor(hidden_layer_sizes=(64, 32), max_iter=800, random_state=0).fit(Xtr, ytr).predict(Xte))
    res['Ridge'] = mae(Ridge().fit(Xtr, ytr).predict(Xte))
    res['last'] = mae(np.array([h[-1] for _, h, _ in te]))          # naive "same as last"
    gain = res['Bayes'] - min(res['GBM'], res['MLP'], res['Ridge'])
    print(f"{kind:<12}{len(te):>7}{res['Bayes']:>9.2f}{res['GBM']:>9.2f}{res['MLP']:>9.2f}"
          f"{res['Ridge']:>9.2f}{res['last']:>9.2f}{gain:>+13.2f}d")
