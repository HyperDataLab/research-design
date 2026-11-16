import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { examplePlan } from './examplePlan';
import { runnerStubs } from './runnerStubs';
import { RUN_TAGS, type ExperimentPlan } from './schema';

type Grid = Record<string, (string | number)[]>;

function hydraGrid(text: string): Grid {
  return Object.fromEntries(
    [...text.matchAll(/^ {6}(\w+): (.+)$/gm)].map((match) => [
      match[1],
      JSON.parse(`[${JSON.parse(match[2]!)}]`) as (string | number)[],
    ]),
  );
}

function wandbGrid(text: string): Grid {
  return Object.fromEntries(
    [...text.matchAll(/^ {2}(\w+): \{values: (.+)\}$/gm)].map((match) => [
      match[1],
      JSON.parse(match[2]!) as (string | number)[],
    ]),
  );
}

function combinations(grid: Grid): (string | number)[][] {
  return (grid.condition_id ?? []).flatMap((condition) =>
    (grid.dataset_id ?? []).flatMap((dataset) => (grid.seed ?? []).map((seed) => [condition, dataset, seed])),
  );
}

function oneCell(): ExperimentPlan {
  const plan = examplePlan();
  plan.runMatrix.conditions = [plan.runMatrix.conditions[0]!];
  plan.runMatrix.datasets = [plan.runMatrix.datasets[0]!];
  plan.runMatrix.seeds = [0];
  plan.runMatrix.expectedRuns = 1;
  return plan;
}

describe('runner stubs', () => {
  it('RS-01 emits precisely the contract tag keys', () => {
    const { python } = runnerStubs(examplePlan());
    const keys = [...python.text.matchAll(/^ {8}"(plan\.[^"]+)":/gm)].map((match) => match[1]);
    expect(keys).toEqual(Object.values(RUN_TAGS));
  });

  it('RS-02 expands both grids into exactly the plan cells', () => {
    for (const plan of [examplePlan(), oneCell()]) {
      const result = runnerStubs(plan);
      expect(result.cells).toBe(plan.runMatrix.expectedRuns);
      const expected = combinations({
        condition_id: plan.runMatrix.conditions,
        dataset_id: plan.runMatrix.datasets,
        seed: plan.runMatrix.seeds,
      });
      for (const grid of [hydraGrid(result.hydra.text), wandbGrid(result.wandb.text)]) {
        expect(Object.keys(grid)).toEqual(['condition_id', 'dataset_id', 'seed']);
        expect(combinations(grid)).toEqual(expected);
        expect(combinations(grid)).toHaveLength(result.cells);
      }
    }
    const invalid = oneCell();
    invalid.runMatrix.expectedRuns = 2;
    expect(() => runnerStubs(invalid)).toThrow('expectedRuns');
  });

  it('RS-03 preserves awkward literals and does not sweep condition parameters', () => {
    const plan = oneCell();
    const values = ['a"quote', 'back\\slash', 'a: b', 'yes', '007', 'Tiếng Việt'];
    plan.runMatrix.conditions = values;
    plan.runMatrix.expectedRuns = values.length;
    plan.conditions[0]!.params = { awkward: values.join(' | '), enabled: true, count: 7 };
    const result = runnerStubs(plan);
    for (const value of values) {
      expect(result.python.text).toContain(JSON.stringify(value));
      expect(result.wandb.text).toContain(JSON.stringify(value));
      expect(JSON.parse(result.hydra.text.match(/^ {6}condition_id: (.+)$/m)![1]!)).toContain(
        JSON.stringify(value),
      );
    }
    expect(result.python.text).toContain('"enabled": True');
    expect(result.python.text).toContain('"count": 7');
    expect(Object.keys(hydraGrid(result.hydra.text))).toEqual(['condition_id', 'dataset_id', 'seed']);
    expect(Object.keys(wandbGrid(result.wandb.text))).toEqual(['condition_id', 'dataset_id', 'seed']);
    expect(combinations(hydraGrid(result.hydra.text))).toEqual(combinations(wandbGrid(result.wandb.text)));
  });

  it('RS-04 emits the first dependent metric only when its goal is supported', () => {
    const plan = examplePlan();
    expect(runnerStubs(plan).wandb.text).toContain('metric:\n  name: "test/accuracy"\n  goal: maximize');
    plan.metrics[0]!.goal = 'target';
    expect(runnerStubs(plan).wandb.text).not.toContain('metric:');
  });

  it('RS-05 is deterministic and names each file', () => {
    const first = runnerStubs(examplePlan());
    expect(first).toEqual(runnerStubs(examplePlan()));
    expect([first.python.fileName, first.hydra.fileName, first.wandb.fileName]).toEqual([
      'tag_run.py',
      'plan_grid.yaml',
      'plan_sweep.yaml',
    ]);
  });

  const python = ['python', 'python3'].find((command) => spawnSync(command, ['--version']).status === 0);
  it.skipIf(!python)('RS-06 emits Python that parses', () => {
    const dir = mkdtempSync(join(tmpdir(), 'runner-stubs-'));
    try {
      const path = join(dir, 'tag_run.py');
      writeFileSync(path, runnerStubs(examplePlan()).python.text, 'utf8');
      execFileSync(python!, [
        '-c',
        'import ast,sys; ast.parse(open(sys.argv[1], encoding="utf-8").read())',
        path,
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
