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
| Structured results  | Papers with Code                          | Shut down in July 2025 (secondary sources). No public task-benchmark source is assumed.                                  | Unconfirmed |
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

1. **Tìm bài báo.** Ask Paper Fetch Hub to search by topic or expand from seed papers; decide include or exclude with a reason.
2. **Tập bài báo.** The included papers. Each gets its paper model from PaperLab and its PDF through Paper Fetch Hub.
3. **Bảng so sánh.** Per paper: task, dataset, baseline, metric, design, reported result, as extracted by
   PaperLab. The researcher approves cells; each cell is anchored to a sentence.
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

| ID     | Requirement                                                      | Acceptance                                                            | P   |
| ------ | ---------------------------------------------------------------- | --------------------------------------------------------------------- | --- |
| FR-201 | Import a `paper-model.json`; unknown `schemaVersion` is refused. | Validated against `schemas/vendor/paper-model-v1.schema.json`.        | P0  |
| FR-202 | Add a paper by DOI and record include / exclude with a reason.   | The log lists every decision with account and time.                   | P0  |
| FR-203 | Ask Paper Fetch Hub for a search by topic or from seed papers.   | This app calls no scholarly source itself; results name their source. | P1  |
| FR-204 | Request a PDF through Paper Fetch Hub's queue.                   | No publisher site is contacted by this app.                           | P1  |
| FR-205 | PRISMA-style flow figure from the decision log.                  | Counts equal the log.                                                 | P2  |

### M3 Comparison

| ID     | Requirement                                                               | Acceptance                                                                  | P   |
| ------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------------- | --- |
| FR-301 | Read the experiment facts PaperLab extracted for a paper.                 | This app runs no extraction; a fact keeps PaperLab's run and model version. | P0  |
| FR-302 | Each fact is anchored to a sentence `key` of its paper model.             | A fact whose key is not in the model cannot be approved.                    | P0  |
| FR-303 | Comparison table: papers × fact kinds, approve one or many, edit, reject. | Editing an approved cell keeps the earlier value in its history.            | P0  |
| FR-304 | Match an extracted metric or design to a Writing Bank entry.              | The match is a suggestion; the release is recorded.                         | P1  |
| FR-305 | "Used in N papers" counts for baselines, datasets and metrics.            | Counts use approved cells only.                                             | P1  |

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
| FR-503 | Gate checklist PP-01..PP-10 with links to the objects at fault.        | `validatePlan` output is what the screen shows.            | P0  |
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
| FR-605 | AI calls are limited to this app's own planning help (`LLM_FEATURES`).    | A call for another purpose is refused by the Worker.    | P0  |

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

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                             | Reason                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Own repo, same shell and tokens as Writing Bank.                                                                                                                                                                                                                                                                                                                                                     | The lab's apps stay alike; the shell is proven.                                                                                               |
| D2  | Firebase Hosting + Auth, one Worker on the shared R2 bucket under `researchdesign/`.                                                                                                                                                                                                                                                                                                                 | Same operations as the sibling apps.                                                                                                          |
| D3  | This app owns and publishes the plan contract; SRD vendors it.                                                                                                                                                                                                                                                                                                                                       | The producer knows the plan; same pattern as PaperLab's paper model.                                                                          |
| D4  | The normative plan is small; reasons sit in an optional `context` block.                                                                                                                                                                                                                                                                                                                             | SRD's spec is itself a proposal; a small contract is easier to agree on.                                                                      |
| D5  | Plan ids reach results through MLflow run tags.                                                                                                                                                                                                                                                                                                                                                      | SRD reads MLflow only through its SDK; tags are the one channel that survives.                                                                |
| D6  | The run matrix is an explicit grid. No search method, no early stopping.                                                                                                                                                                                                                                                                                                                             | Confirmatory runs are pre-specified; tuning is a different activity.                                                                          |
| D7  | Bank references are optional and pinned to a release.                                                                                                                                                                                                                                                                                                                                                | Every bank entry is a draft and `/bank/v1` is not live.                                                                                       |
| D8  | The LLM is called through the Worker with a ledger and a daily budget.                                                                                                                                                                                                                                                                                                                               | Cost is measured per account and the key never reaches a browser. Differs from PaperLab on purpose.                                           |
| D9  | Cross-paper comparison lives here.                                                                                                                                                                                                                                                                                                                                                                   | PaperLab analyses one paper at a time by the owner's decision.                                                                                |
| D10 | Power calculation, PRISMA figure and per-design forms are deferred.                                                                                                                                                                                                                                                                                                                                  | A justification field is enough to freeze a first plan.                                                                                       |
| D11 | Extraction follows the paper model as it is now; the importer rejects other versions.                                                                                                                                                                                                                                                                                                                | The owner said the paper model is close to stable; a version bump is then one visible change.                                                 |
| D12 | The Worker runs the schema and the gate when a plan is frozen.                                                                                                                                                                                                                                                                                                                                       | The freeze is the one step that must not depend on the client being honest or up to date.                                                     |
| D14 | The project id is in the URL (`/p/<projectId>/…`); storage only remembers the last one.                                                                                                                                                                                                                                                                                                              | Links are shareable and two tabs can hold two projects.                                                                                       |
| D15 | Local development uses a dev-only sign-in and the Worker's handler inside the Vite dev server.                                                                                                                                                                                                                                                                                                       | No Firebase project exists yet; the real client and the real handler are still exercised. It is excluded from production builds.              |
| D16 | A paper has an id local to its project; paper models and facts are stored under that id.                                                                                                                                                                                                                                                                                                             | The source hash in a paper model may be null and its format is PaperLab's.                                                                    |
| D17 | A paper model is validated with a validator built from PaperLab's published JSON Schema.                                                                                                                                                                                                                                                                                                             | The check is exactly the contract, with nothing restated here.                                                                                |
| D18 | A change to a shared document is a pure function; on a version conflict the client re-reads and re-applies it.                                                                                                                                                                                                                                                                                       | Two people screening papers must not block each other.                                                                                        |
| D19 | Papers are never deleted from a project, only excluded with a reason.                                                                                                                                                                                                                                                                                                                                | The decision log stays complete.                                                                                                              |
| D20 | Budget is reserved before an AI call and settled after it.                                                                                                                                                                                                                                                                                                                                           | Parallel calls must not all pass on the same stale total; a failed settle over-counts instead of missing a paid call.                         |
| D21 | The model, the router address and the key exist only in the Worker's environment; the client's request is strict.                                                                                                                                                                                                                                                                                    | Nothing a browser sends can change what is called or what it costs beyond the cap. The repository is public.                                  |
| D22 | The token budget counts the UTC day, per account.                                                                                                                                                                                                                                                                                                                                                    | One simple clock for a Worker; shown on Cài đặt.                                                                                              |
| D23 | This app fetches no document and runs no extraction on papers. Paper Fetch Hub fetches; PaperLab extracts; each has a person in charge. This app sends requests and reads results.                                                                                                                                                                                                                   | Owner, 2026-11-16: projects must not call APIs and fetch documents freely.                                                                    |
| D24 | This app may call a model only for its own planning help, through the Worker, with consent, a ledger and a daily budget. Without the Worker's secrets no call is possible.                                                                                                                                                                                                                           | Owner, 2026-11-16: allowed, with a budget. Whoever holds the secrets controls it.                                                             |
| D13 | Paper models and facts are stored one object per paper.                                                                                                                                                                                                                                                                                                                                              | A paper model is large, and members working on different papers must not collide.                                                             |
| D25 | The editable plan is its own loose document (`src/core/draft/schema.ts`); the frozen plan is built from it at freeze time.                                                                                                                                                                                                                                                                           | A plan in progress has empty lists and missing links, which the frozen contract rightly refuses.                                              |
| D26 | A hypothesis carries a claim type from the bank (`ct.*`), chosen by the person. A design is checked against it: a claim type outside the design's `supports` is flagged (DS-01). `cannotSupport` is shown as text and matched by nothing. The claim type, a question's gap and its papers live in the draft only; whether the frozen plan's `context` carries them is decided with the freeze (S10). | The bank states what a design supports in claim types; the plan's hypothesis `kind` is a different axis. Matching free text would be a guess. |
| D27 | The design checks (DS-01..DS-05) are warnings on the draft, shown on the screens. They are not rules of the Worker's freeze gate.                                                                                                                                                                                                                                                                    | They need the bank snapshot, and bank references are optional (D7).                                                                           |
| D28 | A Writing Bank snapshot is a file made from a checkout of the bank and imported per project; its release is the hash of that file. Today this app does not fetch the bank (D31 says how that changes).                                                                                                                                                                                               | The bank has no release identifier and no API yet; a content hash pins exactly what was read (D7, D23).                                       |
| D29 | Ids of questions, hypotheses and threats are numbered from counters kept in the draft; a number is never reused.                                                                                                                                                                                                                                                                                     | FR-401: renaming does not change an id, and a deleted id must not come back meaning something else.                                           |
| D30 | A question's gap is free text plus links to papers of the project.                                                                                                                                                                                                                                                                                                                                   | The comparison table (S6) waits for PaperLab; the link to a gap must not wait with it.                                                        |
| D31 | Writing Bank is read from the project's stored snapshot: every field that comes from the bank is filled from it, and no screen calls the bank per field. When the bank's `/bank/v1` is live, the snapshot is fetched through that API by a person's action (import, refresh) and kept; a file import remains for working offline.                                                                    | Owner, 2026-11-16: use the bank's API for the fields that suit it, and do not go online often.                                                |
| D32 | Đo lường owns variables, metrics, datasets and conditions; Ma trận chạy only selects among them.                                                                                                                                                                                                                                                                                                     | FR-404 names all four; the run matrix is a grid over objects that already exist.                                                              |
| D33 | The chain checks (CH-01..) repeat on the draft what the freeze gate will refuse (PP-04, PP-06, a hypothesis without a dependent variable) and add what a draft can lack (an empty key, unit, goal, aggregation, protocol, source). They are warnings on the object.                                                                                                                                  | A chain that is clean on the screen must not fail the freeze on these points.                                                                 |
| D34 | From the bank, a metric takes its name, its unit when the bank has one, and its goal when the bank's direction maps to one; `descriptive` leaves the goal to the person. The MLflow key, the aggregation and the protocol are always the person's. A metric's `maxClaim` and `doesNotSupport` are shown as text and checked against nothing.                                                         | Half the bank's metrics have no unit and a third have no direction to optimise; `maxClaim` is not the claim-type vocabulary.                  |
| D35 | A variable's construct and a metric's bank protocol live in the draft only, with D26's fields, until the freeze (S10) decides. A metric the bank lists without a unit still needs one in the plan: the person writes its scale ("tỉ lệ 0–1"), and the field says so.                                                                                                                                 | The frozen plan has no field for them.                                                                                                        |
| D36 | An object that something else refers to cannot be deleted; the refusal names what refers to it.                                                                                                                                                                                                                                                                                                      | Same rule as questions in S7: no silent broken links.                                                                                         |
| D37 | The run count is computed from the grid's three lists and is never stored in the draft; the frozen plan's `expectedRuns` is written from it at freeze time.                                                                                                                                                                                                                                          | A stored number can disagree with the lists (PP-03); a computed one cannot.                                                                   |
| D38 | The checks of Phân tích thống kê (AN-01..) and Ma trận chạy (RM-01..) repeat on the draft what the freeze gate refuses or warns about (PP-02, 03, 05, 07, 08, 10) and add what a draft can lack. Nothing else is a rule: advice on statistics is not checked.                                                                                                                                        | A clean draft must freeze; a rule the gate does not have would make "clean" mean something else.                                              |
| D39 | "More than one condition and no baseline" is checked on the grid (RM-03), as PP-07 does, and no longer on all conditions (CH-09 is withdrawn).                                                                                                                                                                                                                                                       | A baseline outside the grid passed one check and failed the other.                                                                            |
| D40 | An analysis's parameters are free name/value pairs, like a condition's.                                                                                                                                                                                                                                                                                                                              | SRD's `AnalysisSpecification.parameters` names no keys per method; a request to SRD asks for them.                                            |
| D41 | The grid lists at most 200 seeds, written as numbers or ranges (`0-4`). The preview shows the count and the first cells, with the three tags known before the freeze (`plan.condition_id`, `plan.dataset_id`, `plan.seed`); `plan.id` and `plan.version` are set at freeze time.                                                                                                                     | A confirmatory grid is written out, not searched; the plan's id does not exist before the freeze.                                             |

## 10. Open questions

1. Is "Scientific Writing Web" in SRD's spec the Firebase project `paper-writing`?
2. Will SRD accept the plan package and keep plan ids in its `StatisticalResult` and `EvidenceLink`?
3. Which model and router serve the Worker's AI calls is set by whoever holds the Worker's secrets; without them no call is made.
4. Cloudflare AI Gateway for the ledger instead of our own: not evaluated.
