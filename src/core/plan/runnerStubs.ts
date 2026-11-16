import { RUN_TAGS, type ExperimentPlan } from './schema';

type Scalar = string | number | boolean;

function pythonLiteral(value: Scalar): string {
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  return JSON.stringify(value);
}

function comment(value: string): string {
  return value.replace(/[\r\n\u2028\u2029]/g, ' ');
}

/** Produce editable runner files from a frozen plan; the files are never executed here. */
export function runnerStubs(plan: ExperimentPlan): {
  python: { fileName: string; text: string };
  hydra: { fileName: string; text: string };
  wandb: { fileName: string; text: string };
  cells: number;
} {
  const { conditions, datasets, seeds, expectedRuns } = plan.runMatrix;
  const cells = conditions.length * datasets.length * seeds.length;
  if (cells !== expectedRuns) throw new Error('Run matrix cell count does not match expectedRuns');

  const header = `# generated from plan ${comment(plan.planId)} version ${plan.planVersion}; a starting point, edit freely; the five tags must stay as they are\n`;
  const params = plan.conditions
    .map(
      (condition) =>
        `    ${pythonLiteral(condition.id)}: {${Object.entries(condition.params)
          .map(([key, value]) => `${pythonLiteral(key)}: ${pythonLiteral(value)}`)
          .join(', ')}},`,
    )
    .join('\n');
  const python = `${header}import mlflow\n\nPLAN_ID = ${pythonLiteral(plan.planId)}\nPLAN_VERSION = ${plan.planVersion}\nCONDITION_PARAMS = {\n${params}\n}\nCONDITIONS = ${JSON.stringify(conditions)}\nDATASETS = ${JSON.stringify(datasets)}\nSEEDS = ${JSON.stringify(seeds)}\n\n\ndef run_tags(condition_id, dataset_id, seed):\n    if condition_id not in CONDITIONS or dataset_id not in DATASETS or seed not in SEEDS:\n        raise ValueError("Cell is not in the plan's run matrix")\n    return {\n        ${pythonLiteral(RUN_TAGS.planId)}: str(PLAN_ID),\n        ${pythonLiteral(RUN_TAGS.planVersion)}: str(PLAN_VERSION),\n        ${pythonLiteral(RUN_TAGS.condition)}: str(condition_id),\n        ${pythonLiteral(RUN_TAGS.dataset)}: str(dataset_id),\n        ${pythonLiteral(RUN_TAGS.seed)}: str(seed),\n    }\n\n\ndef start_run(condition_id, dataset_id, seed):\n    tags = run_tags(condition_id, dataset_id, seed)\n    mlflow.set_experiment(${pythonLiteral(plan.runMatrix.mlflowExperiment)})\n    run = mlflow.start_run()\n    mlflow.set_tags(tags)\n    mlflow.log_params(CONDITION_PARAMS[condition_id])\n    return run\n\n${plan.metrics.map((metric) => `# Log metric ${comment(metric.key)} (aggregation: ${metric.aggregation})`).join('\n')}\n`;

  // Hydra parses each sweep as its own override expression after YAML decoding.
  const expressions = [
    conditions.map((value) => JSON.stringify(value)).join(','),
    datasets.map((value) => JSON.stringify(value)).join(','),
    seeds.join(','),
  ];
  const names = ['condition_id', 'dataset_id', 'seed'];
  const command = names.map((name, index) => `${name}=${expressions[index]}`).join(' ');
  const hydra = `${header}# python train.py -m ${comment(command)}\nhydra:\n  sweeper:\n    params:\n${names.map((name, index) => `      ${name}: ${JSON.stringify(expressions[index])}`).join('\n')}\n`;

  const firstMetricId = plan.variables.find(
    (variable) => variable.role === 'dependent' && variable.metric,
  )?.metric;
  const metric = plan.metrics.find((item) => item.id === firstMetricId);
  const metricBlock =
    metric && metric.goal !== 'target'
      ? `metric:\n  name: ${JSON.stringify(metric.key)}\n  goal: ${metric.goal}\n`
      : '';
  const wandb = `${header}method: grid\n${metricBlock}parameters:\n  condition_id: {values: ${JSON.stringify(conditions)}}\n  dataset_id: {values: ${JSON.stringify(datasets)}}\n  seed: {values: ${JSON.stringify(seeds)}}\n`;
  return {
    python: { fileName: 'tag_run.py', text: python },
    hydra: { fileName: 'plan_grid.yaml', text: hydra },
    wandb: { fileName: 'plan_sweep.yaml', text: wandb },
    cells,
  };
}
