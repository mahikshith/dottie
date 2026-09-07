/** Runs the REAL Dottie engine over sequences on stdin, so the ML comparison
 *  is against what actually ships, not a re-implementation of it. */
import '../harness/bootstrap';
import { buildPopulationPrior, posteriorPredictiveCycleLength } from '../../src/engine/prediction/bayesian-predictor';

let raw = '';
process.stdin.on('data', (d) => (raw += d));
process.stdin.on('end', () => {
  const rows: { history: number[]; stated: number }[] = JSON.parse(raw);
  const prior = (stated: number) =>
    buildPopulationPrior({ reportedCycleLength: stated, age: 30, conditions: [] });
  const out = rows.map((r) => {
    // history is oldest-first from the generator; the engine wants recent-first
    const recentFirst = [...r.history].reverse();
    const p = posteriorPredictiveCycleLength(recentFirst, prior(r.stated));
    return { mean: p.mean, std: p.std };
  });
  process.stdout.write(JSON.stringify(out));
});
