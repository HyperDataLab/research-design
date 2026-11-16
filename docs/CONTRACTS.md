# Contracts

Who owns what, where the files are, and what this app has asked of the other systems.

## Owned by this app: ExperimentPlanPackage v1 (proposed)

- Source of truth: `src/core/plan/schema.ts` (Zod). Generated files: `schemas/experiment-plan-v1.schema.json`,
  `schemas/experiment-plan-manifest-v1.schema.json`, and a valid example, `schemas/experiment-plan-v1.example.json`.
- Package: a ZIP with `manifest.json` (file list with SHA-256), `plan.json`, and `plan.md` for people.
- A consumer validates `plan.json`, refuses an unknown `schemaVersion`, and checks the hashes.
- The gate a plan passed before it was frozen is `validatePlan` (PP-01..PP-10), described in `AGENTS.md`.

How it maps onto SRD's objects:

| Plan                           | SRD                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| `runMatrix.mlflowExperiment`   | MLflow experiment (M02)                                                             |
| `conditions[].params`          | MLflow run params                                                                   |
| `metrics[].key`, `aggregation` | MLflow metric key; how a run's history becomes one value                            |
| `datasets[]`                   | `AnalysisDataset.source`, `hash`                                                    |
| `analyses[]`                   | `AnalysisSpecification`: method, variables, parameters, assumptions, missing_policy |
| `RUN_TAGS` on each run         | `EvidenceLink.run_refs`, found by tag                                               |

Run tags, set by the runner on every MLflow run of the plan: `plan.id`, `plan.version`,
`plan.condition_id`, `plan.dataset_id`, `plan.seed`.

### Requests to SRD (not yet sent)

1. Accept a plan package as an input of a project (new requirement next to FR-103).
2. Create the MLflow experiment from `runMatrix` and check finished runs against the grid by tag.
3. Pre-fill `AnalysisSpecification` from `analyses[]`, and mark an analysis that differs from the plan.
4. Keep `plan_id`, `plan_version`, `hypothesis_id` and `metric_id` in `StatisticalResult` and in the public
   provenance of the `PublicationPackage`.

## Vendored, read-only

| File                                        | Owner    | Used for                                            |
| ------------------------------------------- | -------- | --------------------------------------------------- |
| `schemas/vendor/paper-model-v1.schema.json` | PaperLab | Validating imported papers; sentence `key` anchors. |

Copied from `HyperDataLab/paper-lab` at commit `1a70680` (`main`) on 2026-11-16. To update: copy the new file from PaperLab, never edit it here.

The paper model has sections, blocks, sentences, annotations and triples. It has no field for a paper's
datasets, baselines, metrics or design; this app extracts those itself and anchors them to `sentences[].key`.

### Requests to PaperLab

None. If the paper model later carries experiment facts, FR-301 reads them instead of extracting.

## Writing Bank

Read from a pinned release: `designs`, `threats`, `metrics`, `protocols`, `benchmarks`. Until the bank's
`/bank/v1` API is live, a release is a snapshot of those collections stored with the project.

### Requests to Writing Bank

1. A release identifier on every export (already planned there as C5).
2. Accept this app's Firebase ID tokens on `/bank/v1` (planned there for "the writing project").
