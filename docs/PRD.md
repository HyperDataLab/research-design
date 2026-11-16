# Research Design — PRD v0.1

Status: first baseline, 2026-11-16. Decisions in §9 were made by Claude after consulting the advisor, under the
owner's delegation of that date. The contract with Scientific Research Desktop is **proposed** (§6).

## 1. Problem

A writing project in the lab starts with reading and ends, months later, with results that must answer a
question. Between the two sits a plan that is usually spread over notes, a spreadsheet and somebody's memory:
which earlier papers measured what, what we expect, what we will run, how we will test it. Scientific Research
Desktop (SRD, `Scientific_Research_Desktop_PRD_Technical_Spec_v1.0`) runs and analyses experiments, but it
starts from datasets and MLflow runs; nothing tells it what was planned.

Research Design produces that plan and hands it over in a form SRD can read.

## 2. What existing tools do, and what is taken from them

A survey on 2026-11-16 checked official pages where they could be read. **Confirmed** items are the basis of
the design. **Unconfirmed** items are from general knowledge of the tools; they shaped the feature list but no
field or behaviour is copied from them until checked.

| Step                | Tool                                      | Feature taken                                                                                                            | Status      |
| ------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------- |
| Screening           | ASReview                                  | The person is the oracle: AI orders the candidates, the person decides; decisions can be validated by a second reviewer. | Confirmed   |
| Extraction          | Elicit                                    | A table with papers as rows and questions as columns, each cell backed by a quote.                                       | Unconfirmed |
| Discovery           | Litmaps, ResearchRabbit, Connected Papers | Start from seed papers and expand along citations.                                                                       | Unconfirmed |
| Review reporting    | Covidence, Rayyan                         | A reason for every exclusion; a PRISMA flow built from the log.                                                          | Unconfirmed |
| Structured results  | ORKG                                      | Comparing papers through reusable property templates.                                                                    | Unconfirmed |
| Structured results  | Papers with Code                          | Shut down in July 2025 (secondary sources). No public task-benchmark source is assumed.                                  | Confirmed   |
| Preregistration     | OSF Registries                            | The form depends on the kind of study (14 templates, among them Preregistration, Secondary Data, Simulation / ADEMP).    | Confirmed   |
| Preregistration     | AsPredicted                               | A short fixed form; once registered it cannot be edited.                                                                 | Confirmed   |
| Preregistration     | OSF Preregistration fields                | Study information, design plan, sampling plan, variables, analysis plan.                                                 | Unconfirmed |
| Power               | G\*Power                                  | A priori sample size tied to the chosen test.                                                                            | Partly      |
| Run matrix          | Weights & Biases sweeps                   | `metric { name, goal }` and a `parameters` block as the shape of a run configuration.                                    | Confirmed   |
| Run matrix          | Hydra multirun                            | A grid written as lists and ranges, expanded into runs.                                                                  | Confirmed   |
| Tracking vocabulary | MLflow                                    | Experiment, run, params, metrics with step, tags, datasets.                                                              | Confirmed   |
| Planning agents     | Google AI co-scientist                    | A plan is hypotheses, a research overview and experimental protocols; candidates are ranked, not accepted.               | Confirmed   |

What none of them was found to do, and this app does:

- One chain with stable ids: question → hypothesis → variable → metric → analysis → run-matrix cell, carried into
  the runner as MLflow tags and back with the results.
- A design's limits ("this design cannot support a causal claim") shown before the experiment, from Writing Bank.
- Baselines and metrics from the compared papers placed directly into the plan, with their sources.
- A plan package a runner can consume, and later a comparison of what ran against what was planned.

## 3. Users and the main flow

A researcher of the lab, signed in with a `@hyperdatalab.org` account, working on one **project**.

1. **Tìm bài báo.** Search by topic, expand from seed papers, decide include or exclude with a reason.
2. **Tập bài báo.** The included papers. Each gets its paper model from PaperLab and its PDF through Paper Fetch Hub.
3. **Bảng so sánh.** AI proposes, per paper: task, dataset, baseline, metric, design, reported result. The
   researcher approves cells; each approved cell is anchored to a sentence.
4. **Câu hỏi và giả thuyết.** Questions and hypotheses with stable ids, each linked to the gap it answers.
5. **Thiết kế nghiên cứu.** A design from Writing Bank, what it supports and cannot support, threats and mitigations.
6. **Đo lường.** Construct → variable → metric (key, unit, goal, aggregation) → protocol; datasets and benchmarks.
7. **Phân tích thống kê.** One pre-specified analysis per confirmatory hypothesis, in SRD's terms.
8. **Ma trận chạy.** Conditions × datasets × seeds, the MLflow experiment name, the tags each run carries.
9. **Gói kế hoạch.** The gate checklist, freeze, export. A later change is a new version with a deviation note.

## 4. Functional requirements

Priorities: P0 is the path to a frozen package; P1 makes it faster; P2 is later.

### M1 Project and accounts

| ID     | Requirement                                                          | Acceptance                                                   | P   |
| ------ | -------------------------------------------------------------------- | ------------------------------------------------------------ | --- |
| FR-101 | Sign in with Google, `@hyperdatalab.org` only.                       | Another domain is refused by the Worker, not only by the UI. | P0  |
| FR-102 | Create, rename, archive a project; a project belongs to its members. | A non-member gets 403 from the Worker.                       | P0  |
| FR-103 | Projects and their documents are stored through the Worker on R2.    | Reload on another machine shows the same state.              | P0  |

### M2 Literature

| ID     | Requirement                                                      | Acceptance                                                     | P   |
| ------ | ---------------------------------------------------------------- | -------------------------------------------------------------- | --- |
| FR-201 | Import a `paper-model.json`; unknown `schemaVersion` is refused. | Validated against `schemas/vendor/paper-model-v1.schema.json`. | P0  |
| FR-202 | Add a paper by DOI and record include / exclude with a reason.   | The log lists every decision with account and time.            | P0  |
| FR-203 | Search scholarly sources by topic and expand from seed papers.   | Results deduplicated by DOI; source named per result.          | P1  |
| FR-204 | Request a PDF through Paper Fetch Hub's queue.                   | No publisher site is contacted by this app.                    | P1  |
| FR-205 | PRISMA-style flow figure from the decision log.                  | Counts equal the log.                                          | P2  |

### M3 Comparison

| ID     | Requirement                                                               | Acceptance                                                       | P   |
| ------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------- | --- |
| FR-301 | AI extracts experiment facts per paper as candidates.                     | Each has prompt and model version; none is approved by the AI.   | P0  |
| FR-302 | Each fact is anchored to a sentence `key` computed from its quote.        | An unanchored fact cannot be approved.                           | P0  |
| FR-303 | Comparison table: papers × fact kinds, approve one or many, edit, reject. | Editing an approved cell keeps the earlier value in its history. | P0  |
| FR-304 | Match an extracted metric or design to a Writing Bank entry.              | The match is a suggestion; the release is recorded.              | P1  |
| FR-305 | "Used in N papers" counts for baselines, datasets and metrics.            | Counts use approved cells only.                                  | P1  |

### M4 Design

| ID     | Requirement                                                               | Acceptance                                                  | P   |
| ------ | ------------------------------------------------------------------------- | ----------------------------------------------------------- | --- |
| FR-401 | Questions and hypotheses with stable ids and kind.                        | Renaming does not change the id.                            | P0  |
| FR-402 | Choose a design; show `supports` and `cannotSupport` from the bank.       | A hypothesis the design cannot support is flagged.          | P0  |
| FR-403 | Threat register: threat, mitigation, bank reference.                      | Threats of the chosen design are offered, not imposed.      | P0  |
| FR-404 | Variables, metrics, datasets and conditions, linked as a chain.           | A broken link is named on the object.                       | P0  |
| FR-405 | AI suggests hypotheses, metrics and threats from the approved comparison. | Suggestions are candidates and cite the cells they rest on. | P1  |

### M5 Plan

| ID     | Requirement                                                            | Acceptance                                                 | P   |
| ------ | ---------------------------------------------------------------------- | ---------------------------------------------------------- | --- |
| FR-501 | Analyses in SRD's terms; P1 methods are marked "SRD chưa hỗ trợ".      | PP-08.                                                     | P0  |
| FR-502 | Run matrix as an explicit grid with the run count shown.               | PP-03.                                                     | P0  |
| FR-503 | Gate checklist PP-01..PP-09 with links to the objects at fault.        | `validatePlan` output is what the screen shows.            | P0  |
| FR-504 | Freeze: a person, a version, a time; then read-only.                   | A frozen version cannot be written again (Worker refuses). | P0  |
| FR-505 | Export a ZIP: `manifest.json`, `plan.json`, a readable `plan.md`.      | Hashes in the manifest match the files.                    | P0  |
| FR-506 | New version from a frozen one, with a required deviation note.         | PP-09.                                                     | P0  |
| FR-507 | Generate runner stubs: an MLflow tagging snippet and a Hydra/W&B grid. | Tags equal `RUN_TAGS`; cell count equals `expectedRuns`.   | P1  |
| FR-508 | A priori sample-size helper for the P0 tests.                          | Checked against published tables.                          | P2  |
| FR-509 | Import SRD's `PublicationPackage` and compare it with the plan.        | Needs SRD to keep plan ids in its results (§6).            | P2  |

### M6 AI use and cost

| ID     | Requirement                                                               | Acceptance                                              | P   |
| ------ | ------------------------------------------------------------------------- | ------------------------------------------------------- | --- |
| FR-601 | Every LLM call goes through the Worker; the key is a Worker secret.       | No key in the bundle, in storage or in logs.            | P0  |
| FR-602 | Privacy consent before the first call; asked again when provider changes. | No request leaves without a recorded consent.           | P0  |
| FR-603 | Usage ledger: account, project, feature, model, prompt version, tokens.   | The Settings screen shows today's and this month's use. | P0  |
| FR-604 | Daily budget per account; a batch shows its estimate before it starts.    | A call over budget is refused with a clear message.     | P0  |
| FR-605 | Extraction cached by paper hash and prompt version.                       | Re-running an unchanged paper makes no LLM call.        | P0  |

## 5. Data model

Types live in Writing Bank; instances live here.

- **Project**: members, title, pinned bank release.
- **Paper**: metadata, decision (include / exclude, reason), paper-model hash.
- **Fact**: paper, kind (`task`, `dataset`, `baseline`, `metric`, `design`, `result`), value, quote, sentence
  key, state (`candidate`, `approved`, `rejected`), prompt and model version, optional bank reference.
- **Plan draft**: the objects of `src/core/plan/schema.ts`, editable.
- **Plan version**: a frozen `plan.json`, immutable.
- **Usage record**: one per LLM call.

## 6. Contracts

Detailed in `docs/CONTRACTS.md`.

- **In:** `paper-model.json` v1 (PaperLab owns it). Writing Bank release (the bank owns it).
- **Out:** `ExperimentPlanPackage` v1 (this app owns it; **proposed**, SRD has not agreed to it yet).
- **Later in:** SRD's `PublicationPackage`.

## 7. Non-functional

- Runs on Firebase Hosting + Auth and one Cloudflare Worker with R2; no other server.
- No PDF and no paper text is stored outside the lab's bucket.
- WCAG 2.2 AA. Vietnamese UI.
- A project with 50 papers opens its comparison table in under 2 s on the lab's laptops (target, unmeasured).

## 8. Out of scope

Running experiments, statistics, figures and tables (SRD). Writing the manuscript. Single-paper analysis
(PaperLab). Curating designs and metrics (Writing Bank). Fetching PDFs from publishers (Paper Fetch Hub).
Hyperparameter search.

## 9. Decisions

| #   | Decision                                                                              | Reason                                                                                              |
| --- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| D1  | Own repo, same shell and tokens as Writing Bank.                                      | The lab's apps stay alike; the shell is proven.                                                     |
| D2  | Firebase Hosting + Auth, one Worker on the shared R2 bucket under `researchdesign/`.  | Same operations as the sibling apps.                                                                |
| D3  | This app owns and publishes the plan contract; SRD vendors it.                        | The producer knows the plan; same pattern as PaperLab's paper model.                                |
| D4  | The normative plan is small; reasons sit in an optional `context` block.              | SRD's spec is itself a proposal; a small contract is easier to agree on.                            |
| D5  | Plan ids reach results through MLflow run tags.                                       | SRD reads MLflow only through its SDK; tags are the one channel that survives.                      |
| D6  | The run matrix is an explicit grid. No search method, no early stopping.              | Confirmatory runs are pre-specified; tuning is a different activity.                                |
| D7  | Bank references are optional and pinned to a release.                                 | Every bank entry is a draft and `/bank/v1` is not live.                                             |
| D8  | The LLM is called through the Worker with a ledger and a daily budget.                | Cost is measured per account and the key never reaches a browser. Differs from PaperLab on purpose. |
| D9  | Cross-paper comparison lives here.                                                    | PaperLab analyses one paper at a time by the owner's decision.                                      |
| D10 | Power calculation, PRISMA figure and per-design forms are deferred.                   | A justification field is enough to freeze a first plan.                                             |
| D11 | Extraction follows the paper model as it is now; the importer rejects other versions. | The owner said the paper model is close to stable; a version bump is then one visible change.       |

## 10. Open questions

1. Is "Scientific Writing Web" in SRD's spec the Firebase project `paper-writing`?
2. Will SRD accept the plan package and keep plan ids in its `StatisticalResult` and `EvidenceLink`?
3. Which model and router serve the Worker's LLM proxy (9router, as in PaperLab, or another)?
4. Cloudflare AI Gateway for the ledger instead of our own: not evaluated.
