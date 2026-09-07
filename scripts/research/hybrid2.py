"""
The shippable hybrid: drift and lag-1 structure, each SHRUNK to its own
evidence, so a person with no trend is left completely alone.

  · drift  — slope of the recent cycles, shrunk by the t-statistic of that
             slope. Weak evidence → weight ~0 → the prediction is untouched.
  · AR(1)  — pull toward the last cycle by the user's own lag-1
             autocorrelation, again shrunk by sample size.

Both are computed from ONE user's own history: no cohort, no training set,
no native runtime. Everything here is a dozen lines of arithmetic that would
sit inside the existing engine in TypeScript.
"""
import numpy as np
from sklearn.linear_model import Ridge
from sklearn.ensemble import HistGradientBoostingRegressor
exec(open('scripts/research/ml_vs_bayes.py').read().split("SC = ")[0])
SC = 'scripts/research'

def correction(hist, w=8, cap=2.0):
    h = np.array(hist[-w:], float)
    n = len(h)
    if n < 4:
        return 0.0
    # ── drift, shrunk by the t-stat of the slope ────────────────────
    x = np.arange(n)
    slope, intercept = np.polyfit(x, h, 1)
    resid = h - (slope * x + intercept)
    dof = n - 2
    se = np.sqrt((resid @ resid) / dof / ((x - x.mean()) @ (x - x.mean()))) if dof > 0 else np.inf
    t = slope / se if se > 0 and np.isfinite(se) else 0.0
    w_drift = t**2 / (t**2 + 4.0)          # |t|=2 → 0.5,  |t|=4 → 0.8
    drift = float(np.clip(slope, -cap, cap)) * w_drift
    # ── lag-1 pull, shrunk by sample size ───────────────────────────
    d = h - h.mean()
    denom = float(d @ d)
    phi = float((d[:-1] @ d[1:]) / denom) if denom > 1e-9 else 0.0
    phi = float(np.clip(phi, -0.9, 0.9)) * (n / (n + 4.0))
    ar = phi * (h[-1] - h.mean())
    return float(np.clip(drift + ar, -4.0, 4.0))

print(f"{'cohort':<12}{'Bayes':>9}{'hybrid':>9}{'best ML':>10}{'ML prize':>10}{'kept':>8}")
print('-' * 60)
tot_b = tot_h = 0.0
for kind in ['regular', 'typical', 'variable', 'pcos_like', 'ar1', 'regime', 'drift']:
    users = cohort(kind)
    cut = int(0.7 * len(users))
    tr, te = samples(users[:cut]), samples(users[cut:])
    Xtr = np.array([feats(h) for _, h, _ in tr]); ytr = np.array([y for _, _, y in tr])
    Xte = np.array([feats(h) for _, h, _ in te]); yte = np.array([y for _, _, y in te])
    mae = lambda p: float(np.mean(np.abs(p - yte)))
    b = bayes(te)
    corr = np.array([correction(h) for _, h, _ in te])
    ml = min(mae(Ridge().fit(Xtr, ytr).predict(Xte)),
             mae(HistGradientBoostingRegressor(max_iter=300, random_state=0).fit(Xtr, ytr).predict(Xte)))
    mb, mh = mae(b), mae(b + corr)
    prize = mb - ml
    kept = f'{(mb - mh) / prize * 100:>6.0f}%' if prize > 0.05 else '     —'
    tot_b += mb; tot_h += mh
    print(f'{kind:<12}{mb:>9.2f}{mh:>9.2f}{ml:>10.2f}{prize:>+10.2f}{kept}')
print('-' * 60)
print(f"{'mean':<12}{tot_b/7:>9.2f}{tot_h/7:>9.2f}")
