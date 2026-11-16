# Contracts

Who owns what, where the files are, and what this app has asked of the other systems. The APIs between the
systems (endpoints, fields, errors, who may call) are described in `docs/API_REQUESTS.md`; the requests below name
the section of that file that spells each one out.

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

### The `context` block (optional for SRD)

`questions` (with the `gap` each answers), `design`, `threats`, `sources` (the project's included papers:
title, DOI, the paper model's source hash), `claims` (hypothesis → Writing Bank claim type), `constructs`
(variable → the concept it stands for), `metricProtocols` (metric → the bank protocol followed). References in
it are checked by PP-02 like any other. A reader that only runs the plan can ignore the whole block.

### The package

A ZIP with `manifest.json`, `plan.json` and `plan.md`, stored without compression. `manifest.json` lists the
other two files with the SHA-256 of their bytes. `plan.json` is the frozen plan exactly as the Worker stored it.

### Requests to SRD (not yet sent)

1. Accept a plan package as an input of a project (new requirement next to FR-103).
2. Create the MLflow experiment from `runMatrix` and check finished runs against the grid by tag.
3. Pre-fill `AnalysisSpecification` from `analyses[]`, and mark an analysis that differs from the plan.
4. Keep `plan_id`, `plan_version`, `hypothesis_id` and `metric_id` in `StatisticalResult` and in the public
   provenance of the `PublicationPackage`.
5. Name the keys `AnalysisSpecification.parameters` takes for each method (tails, equal variances, effect
   size…). Until then a plan carries them as free name/value pairs (PRD D40).
6. Say whether SRD reads a plan over the network or from a file, and how it signs in
   (`docs/API_REQUESTS.md`, section D).

## Vendored, read-only

| File                                             | Owner    | Used for                                                                                                |
| ------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------- |
| `schemas/vendor/paper-model-v1.schema.json`      | PaperLab | Validating imported papers; sentence `key` anchors.                                                     |
| `schemas/vendor/experiment-facts-v1.schema.json` | PaperLab | Experiment facts of a paper (`paperlab-experiment-facts` v1), for Bảng so sánh. No reader is built yet. |

Copied from `HyperDataLab/paper-lab` at commit `1a70680` (`main`) on 2026-11-16. The experiment-facts schema and its synthetic
example (`schemas/vendor/experiment-facts-v1.example.json`) were copied at commit `5de309d` on 2026-11-17.
`schemas/vendor/paper-model-v1.example.json` is PaperLab's own synthetic example (`examples/paper-model.example.json`,
same commit); it is the test fixture. This repo is public: no real paper model and no paper text is committed.

The import validates a file with a validator built from the vendored JSON Schema itself
(`src/core/papers/paperModel.ts`), so it checks exactly what PaperLab publishes. `document.source.sha256` is
treated as an opaque string: it may be null and its format is PaperLab's. To update: copy the new file from PaperLab, never edit it here.

The paper model has sections, blocks, sentences, annotations and triples. It has no field for a paper's
datasets, baselines, metrics or design; this app extracts those itself and anchors them to `sentences[].key`.

### Requests to PaperLab

1. **Experiment facts in the paper model** (not yet sent). This app does not extract from papers (PRD D23). It
   needs, per paper, facts of these kinds: `task`, `dataset`, `baseline`, `metric`, `design`, `result`. Each fact:
   the kind, a value as text, for a result also the number, unit, metric and dataset it belongs to, the sentence
   `key` it rests on, and the annotation run that produced it. Suggested home: a new annotation scheme or a
   `knowledge.experiment` block in a new schema version. Until PaperLab publishes it, Bảng so sánh has no data.
2. **Published paper models on PaperLab's server** (not yet sent), so that a project reads them through an API
   instead of an exported file.

As an API: `docs/API_REQUESTS.md`, section B.

## Paper Fetch Hub

This app has no link to the Hub (PRD D50). PaperLab calls the Hub; this app reads PaperLab's published paper
models. The two requests once listed here (a DOI queue for other apps, a search) are withdrawn and were never sent.

## Writing Bank

Read from a pinned release: `designs`, `threats`, `claim-types`, `metrics`, `protocols`, `benchmarks`. Until the
bank's `/bank/v1` API is live, a release is a snapshot of those collections stored with the project as its `bank`
document.

- **The file.** `node scripts/make-bank-snapshot.mjs <writing-bank checkout> [out]` writes
  `{ format: "writing-bank-snapshot", formatVersion: 1, source, collections }`, the entries copied unchanged from
  the bank's seed. A member imports it on the project's Writing Bank screen. Today this app does not fetch the bank
  (see "Online use" below).
- **The release** is `sha256:` plus the first 16 hex digits of the hash of the file's bytes. Every bank reference
  in a draft or a plan names it. `source` (the bank's commit and date) is for people and is not trusted.
- **Online use.** The snapshot is the only way bank content reaches a screen (PRD D31). Once `/bank/v1` is live
  the snapshot is fetched through it on a person's action and stored; nothing calls the bank per field.
- **Reading.** `src/core/bank/snapshot.ts` reads only the fields the screens use and ignores the rest; `metrics`,
  `protocols` and `benchmarks` are kept whole for Đo lường. The bank's schemas are not restated here.
- **Private content.** Writing Bank is a private repository and this one is public. A snapshot file is git-ignored
  (`*.local.json`); tests, fixtures and the dev server use invented entries only.
- **What the design check uses.** `designs[].supports` (claim type ids), `cannotSupport` (text, shown only),
  `assignment`, `causalLicence`, `threats` (ids into `threats`). Designs with `assignment: "either"` leave the
  choice to the person.

### Requests to Writing Bank

1. A release identifier on every export (already planned there as C5).
2. Accept this app's Firebase ID tokens on `/bank/v1` (planned there for "the writing project").
3. An official snapshot export of the six collections above, carrying the release identifier, to replace
   `scripts/make-bank-snapshot.mjs`.

As an API: `docs/API_REQUESTS.md`, section A.

## Known limits of the stored documents

- The account and time in a project's decision log are written by the client. A member could write a false
  entry; the Worker checks membership, not the content of a document.
- Importing a paper model writes the item first and the paper list second. A failure in between leaves an item
  no paper points to; it is overwritten by the next import for that paper and otherwise ignored.
