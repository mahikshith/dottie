/**
 * Dottie — harness runner
 *
 * The scaffolding the simulated-user run sits on: a step runner with a
 * WATCHDOG, an assertion recorder, and a report.
 *
 * ─── WHY A WATCHDOG IS THE POINT ────────────────────────────────────
 *
 *  The worst bug this project has shipped was an infinite loop in
 *  `cycle.repo.ts` that wedged the JS thread forever (device-test-7). A test
 *  suite that simply `await`s each step would have HUNG on it rather than
 *  failing — indistinguishable from a slow CI box, and easy to kill and ignore.
 *
 *  So every step races a timer. A step that overruns is reported as a HANG,
 *  with its name, and the run continues to the next step. That turns "the app
 *  freezes when you do X" from a mystery into a line of output.
 *
 *  It cannot interrupt a truly synchronous spin (nothing in a single-threaded
 *  runtime can), so the harness also runs under a hard process-level deadline:
 *  if the whole run stops making progress, the parent reports which step was in
 *  flight. `npm run test:app` wires that up.
 */

export type Severity = 'fail' | 'hang' | 'error';

export interface Finding {
  severity: Severity;
  step: string;
  detail: string;
}

export interface StepResult {
  name: string;
  ms: number;
  status: 'ok' | 'fail' | 'hang' | 'error';
}

const C = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
};

export class Harness {
  readonly findings: Finding[] = [];
  readonly steps: StepResult[] = [];
  private currentStep = '(none)';
  private assertions = 0;
  private actName = '';

  /** Default per-step budget. Generous: we are catching hangs, not slowness. */
  constructor(private readonly stepTimeoutMs = 5000) {}

  act(name: string): void {
    this.actName = name;
    console.log(`\n${C.cyan('━━━')} ${C.bold(name)} ${C.cyan('━'.repeat(Math.max(3, 56 - name.length)))}`);
  }

  /** Run one simulated interaction. Never throws; records what happened. */
  async step(name: string, fn: () => Promise<void> | void): Promise<boolean> {
    this.currentStep = name;
    const started = Date.now();
    let timer: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        Promise.resolve().then(fn),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new HangError(`no result after ${this.stepTimeoutMs}ms`)),
            this.stepTimeoutMs
          );
        }),
      ]);
      const ms = Date.now() - started;
      this.steps.push({ name, ms, status: 'ok' });
      console.log(`  ${C.green('✓')} ${name} ${C.dim(`${ms}ms`)}`);
      return true;
    } catch (err) {
      const ms = Date.now() - started;
      const hang = err instanceof HangError;
      const severity: Severity = hang ? 'hang' : 'error';
      this.steps.push({ name, ms, status: hang ? 'hang' : 'error' });
      const detail = err instanceof Error ? err.message : String(err);
      this.findings.push({ severity, step: `${this.actName} › ${name}`, detail });
      console.log(
        `  ${C.red(hang ? '⏱ HANG' : '✗ THREW')} ${name} ${C.dim(`${ms}ms`)}\n      ${C.red(detail)}`
      );
      if (!hang && err instanceof Error && err.stack) {
        const frame = err.stack.split('\n').find((l) => l.includes('/src/'));
        if (frame) console.log(`      ${C.dim(frame.trim())}`);
      }
      return false;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** An expectation about what the user should now be seeing. */
  expect(label: string, cond: boolean, detail?: string): boolean {
    this.assertions++;
    if (cond) {
      console.log(`      ${C.green('·')} ${C.dim(label)}`);
      return true;
    }
    this.findings.push({
      severity: 'fail',
      step: `${this.actName} › ${this.currentStep}`,
      detail: `${label}${detail ? ` — ${detail}` : ''}`,
    });
    console.log(`      ${C.red('✗')} ${label}${detail ? C.dim(` — ${detail}`) : ''}`);
    return false;
  }

  note(text: string): void {
    console.log(`      ${C.dim(text)}`);
  }

  get assertionCount(): number {
    return this.assertions;
  }

  /** Final summary. Returns the process exit code. */
  report(): number {
    const slow = [...this.steps].sort((a, b) => b.ms - a.ms).slice(0, 5);

    console.log(`\n${C.cyan('━━━')} ${C.bold('SUMMARY')} ${C.cyan('━'.repeat(48))}`);
    console.log(`  steps run:   ${this.steps.length}`);
    console.log(`  assertions:  ${this.assertions}`);
    console.log(`  slowest:     ${slow.map((s) => `${s.name} ${s.ms}ms`).join(', ')}`);

    if (this.findings.length === 0) {
      console.log(`\n${C.green('✓ Simulated user run clean — no hangs, throws or failed expectations.')}`);
      return 0;
    }

    const byKind = (k: Severity) => this.findings.filter((f) => f.severity === k);
    console.log(`\n${C.red(`✗ ${this.findings.length} finding(s)`)}`);
    for (const kind of ['hang', 'error', 'fail'] as Severity[]) {
      const items = byKind(kind);
      if (items.length === 0) continue;
      const label = kind === 'hang' ? 'HANGS (the app would freeze here)' : kind === 'error' ? 'THROWN ERRORS' : 'WRONG BEHAVIOUR';
      console.log(`\n  ${C.yellow(label)}`);
      items.forEach((f, i) => console.log(`   ${i + 1}. ${C.bold(f.step)}\n      ${f.detail}`));
    }
    return 1;
  }
}

export class HangError extends Error {}
