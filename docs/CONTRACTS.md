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

Copied from `HyperDataLab/paper-lab` at commit `1a70680` (`main`) on 2026-11-16.
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

## Paper Fetch Hub

This app fetches nothing itself (PRD D23). PDFs reach PaperLab through the Hub; this app only needs to ask.

### Requests to Paper Fetch Hub (not yet sent)

1. A way for a signed-in lab member of another lab app to add a DOI to the Hub's queue and read its state.
2. A search by topic or from seed papers, run by the Hub with the lab's sources, returning metadata with DOIs.

## Writing Bank

Read from a pinned release: `designs`, `threats`, `claim-types`, `metrics`, `protocols`, `benchmarks`. Until the
bank's `/bank/v1` API is live, a release is a snapshot of those collections stored with the project as its `bank`
document.

- **The file.** `node scripts/make-bank-snapshot.mjs <writing-bank checkout> [out]` writes
  `{ format: "writing-bank-snapshot", formatVersion: 1, source, collections }`, the entries copied unchanged from
  the bank's seed. A member imports it on the project's Writing Bank screen. This app never fetches the bank.
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

## Known limits of the stored documents

- The account and time in a project's decision log are written by the client. A member could write a false
  entry; the Worker checks membership, not the content of a document.
- Importing a paper model writes the item first and the paper list second. A failure in between leaves an item
  no paper points to; it is overwritten by the next import for that paper and otherwise ignored.
