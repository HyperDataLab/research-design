import { RUN_TAGS, type ExperimentPlan } from './schema';

const escape = (value: unknown): string =>
  String(value ?? '—')
    .replaceAll('\\', '\\\\')
    .replaceAll('|', '\\|')
    .replace(/\r\n|\r|\n/g, '<br>');
const list = (values: readonly (string | number)[]) => (values.length ? values.join(', ') : '—');
const ref = (value: { id: string; release: string } | null | undefined) =>
  value ? `${value.id} (release ${value.release}; draft)` : '—';
const record = (value: Record<string, string | number | boolean>) => JSON.stringify(value);
const table = (headers: string[], rows: unknown[][]) =>
  [headers, headers.map(() => '---'), ...rows].map((row) => `| ${row.map(escape).join(' | ')} |`).join('\n');

export function planMarkdown(plan: ExperimentPlan): string {
  const sections: string[] = [
    `# ${escape(plan.title)}`,
    `Plan ID: ${escape(plan.planId)}  \nVersion: ${plan.planVersion}  \nFrozen by: ${escape(plan.frozenBy)}  \nFrozen at: ${escape(plan.frozenAt)}  \nDeviation: ${escape(plan.deviation)}`,
  ];
  const add = (heading: string, headers: string[], rows: unknown[][]) =>
    sections.push(`## ${heading}\n\n${table(headers, rows)}`);
  const context = plan.context;
  if (context)
    add(
      'Questions',
      ['ID', 'Question', 'Gap', 'Hypotheses'],
      context.questions.map((q) => [q.id, q.text, q.gap, list(q.hypotheses)]),
    );
  add(
    'Hypotheses',
    ['ID', 'Kind', 'Statement', 'Claim type', 'Independent variables', 'Dependent variables'],
    plan.hypotheses.map((h) => [
      h.id,
      h.kind,
      h.statement,
      list(context?.claims.filter((c) => c.hypothesis === h.id).map((c) => c.claimType) ?? []),
      list(h.independent),
      list(h.dependent),
    ]),
  );
  if (context) {
    add(
      'Design and threats',
      ['Type', 'Name', 'Assignment or mitigation', 'Bank reference'],
      [
        ...(context.design
          ? [['Design', context.design.name, context.design.assignment, ref(context.design.bank)]]
          : []),
        ...context.threats.map((t) => ['Threat', t.name, t.mitigation, ref(t.bank)]),
      ],
    );
  }
  add(
    'Variables',
    ['ID', 'Name', 'Role', 'Construct', 'Metric', 'Levels'],
    plan.variables.map((v) => [
      v.id,
      v.name,
      v.role,
      list(context?.constructs.filter((c) => c.variable === v.id).map((c) => c.construct) ?? []),
      v.metric,
      list(v.levels),
    ]),
  );
  add(
    'Metrics',
    ['ID', 'Name', 'Key', 'Unit', 'Goal', 'Aggregation', 'Protocol', 'Bank reference', 'Followed protocol'],
    plan.metrics.map((m) => [
      m.id,
      m.name,
      `\`${m.key}\``,
      m.unit,
      m.goal,
      m.aggregation,
      m.protocol,
      ref(m.bank),
      list(context?.metricProtocols.filter((p) => p.metric === m.id).map((p) => ref(p.protocol)) ?? []),
    ]),
  );
  add(
    'Datasets',
    ['ID', 'Name', 'Source', 'Version', 'Split', 'SHA-256', 'Benchmark'],
    plan.datasets.map((d) => [d.id, d.name, d.source, d.version, d.split, d.sha256, ref(d.benchmark)]),
  );
  add(
    'Conditions',
    ['ID', 'Name', 'Baseline', 'Parameters'],
    plan.conditions.map((c) => [c.id, c.name, c.baseline ? 'Yes' : 'No', record(c.params)]),
  );
  const r = plan.runMatrix;
  add(
    'Run matrix',
    ['Field', 'Value'],
    [
      ['Experiment name', r.mlflowExperiment],
      ['Conditions', list(r.conditions)],
      ['Datasets', list(r.datasets)],
      ['Seeds', list(r.seeds)],
      ['Expected runs', r.expectedRuns],
      ['Justification', r.sampleSizeJustification],
      ['Run tags', Object.values(RUN_TAGS).join(', ')],
    ],
  );
  add(
    'Analyses',
    [
      'ID',
      'Hypothesis',
      'Method',
      'Variables',
      'Conditions (in order)',
      'Alpha',
      'Correction',
      'Missing policy',
      'Assumptions',
      'Parameters',
    ],
    plan.analyses.map((a) => [
      a.id,
      a.hypothesis,
      a.method,
      list(a.variables),
      list(a.conditions),
      a.alpha,
      a.correction,
      a.missingPolicy,
      list(a.assumptions),
      record(a.parameters),
    ]),
  );
  if (context)
    add(
      'Sources',
      ['Title', 'DOI', 'Source hash'],
      context.sources.map((s) => [s.title, s.doi, s.sourceHash]),
    );
  return `${sections.join('\n\n')}\n`;
}
