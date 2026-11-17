# Handoff to PaperLab

On 2026-11-17 the owner decided, in the PaperLab chat, that Research Design is not built out as a separate app and
that its planning features become part of PaperLab's Project (`_coord/requests/005`; plan in paper-lab,
`docs/plans/RESEARCH_DESIGN_MIGRATION.md`). This file is what the port needs to know. No new slice starts here.
`main` is at `6413d1f`, CI green on that commit, no open pull request.

## No user data

Nothing was ever deployed. There is no Firebase project (`.firebaserc` does not exist), no Worker, no R2 object
written by this app, no secret. Every project, draft and frozen plan that ever existed lived in the dev server's
memory. Nothing needs migrating.

## What is verified, per slice

"Tests" means automated tests on `main` (341 app tests, 32 Worker tests). "Browser" means exercised by hand on the
dev server with its in-memory API and dev sign-in. Nothing below was ever run with real Google sign-in, on the
Workers runtime, against R2, or against a real model.

| Slice | Code                                                         | Tests | Browser                                                  | Not verified, known limits                                                                                                                                          |
| ----- | ------------------------------------------------------------ | ----- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S0    | `core/plan` (contract, `validatePlan` PP-01..PP-10)          | yes   | through S10                                              | The contract was never sent to SRD; SRD has agreed to nothing in it.                                                                                                |
| S1–S2 | projects, papers, paper-model import (`core/papers`)         | yes   | yes                                                      | Not moved. Import writes the item first and the list second (CONTRACTS, "Known limits").                                                                            |
| S2b   | members                                                      | yes   | owner view only                                          | Not moved. The non-owner view was never looked at.                                                                                                                  |
| S3–S4 | Worker: auth, documents with ETag, LLM proxy, budget, ledger | yes   | consent and a test call, fake router only                | Not moved. Never run on Workers.                                                                                                                                    |
| S7    | questions, hypotheses, design, threats; checks DS-01..DS-05  | yes   | yes                                                      | —                                                                                                                                                                   |
| S8    | variables, metrics, datasets, conditions; checks CH-01..08   | yes   | yes                                                      | CH-09 was withdrawn (became RM-03).                                                                                                                                 |
| S9    | analyses and run grid; checks AN-01..07, RM-01..03           | yes   | yes                                                      | Analysis parameters are free name/value pairs until SRD names its keys (D40).                                                                                       |
| S10   | gate, freeze, package ZIP, runner stubs                      | yes   | two freezes, ZIP hashes checked by an independent reader | The 409 path only in tests. Stubs parse (Python `ast`, YAML) but never ran under Hydra, W&B or MLflow. Copy and download buttons of the stubs drawer only in tests. |
| S5    | bank release, aliases, drafts mark; facts core; two clients  | yes   | bank screen with a bank-cut file                         | Both HTTP clients never got an accepted token, so no real read happened. "Thêm từ PaperLab" was never looked at in a browser and its list is unstyled.              |
| S6    | Bảng so sánh, decisions per fact                             | yes   | with the vendored examples                               | A decision over several papers is validated for all, then written one paper at a time. After "Loại" the reason field stays open.                                    |
| S12   | bank matching, counts, AI suggestions                        | yes   | fake router only                                         | No real model ever answered. A metric suggestion is added with a key slugged from its first words. Design facts cannot be matched: PaperLab sends none yet.         |

Other limits worth knowing:

- Counts split a value into two lines while only some papers have a confirmed bank match for it. That is on purpose
  (no silent merge by name) and reads oddly.
- The suggestions drawer's content has no inner padding (seen in the browser); other drawers built the same way
  were not rechecked. Bảng so sánh's drawer has padding.
- The dates on the Writing Bank screen ("Ngày phát hành") are raw ISO strings, and "Nguồn:" is empty for a bank-cut
  file.
- When the machine is short of memory the test step needs `--maxWorkers=2`.

## Invariants a port must keep

1. **One gate.** A draft is mapped with `draftToPlan` and checked with `validatePlan`; the screen and the place that
   freezes run the same code. Do not grow a second validator for the UI.
2. **A frozen version never changes** and a version number is never reused. Here the Worker enforced it (it wrote
   `frozenBy` and `frozenAt` itself, answered 409 on a repeat and 422 on a blocked plan). A local Dexie record has
   no such guard: the port needs its own (write once, refuse an existing version, set who and when in the
   repository, not in the caller).
3. **The draft stays the working copy** after a freeze (D46). A frozen plan is never turned back into a draft, and a
   new version is refused while the draft maps to the same content as the last one. From version 2 a deviation note
   is required.
4. **The package's hashes are over the exact bytes written** (D47): each file is serialised once, those bytes are
   hashed and those bytes are stored.
5. **Ids are never reused.** The draft keeps counters (`next`); deleting `h-3` never frees `h-3`. Anything that
   something else refers to cannot be deleted (in-use refusals).
6. **New fields get defaults** so that stored drafts, bank documents and facts items written earlier still parse.
7. **The plan's `context` block is optional for SRD** and its references are still checked (PP-02). S12 added no
   field to the plan; keep AI suggestions and bank matches out of it.
8. **Bank references name their release.** A bank-cut file is stored under the bank's release only after its
   `contentHash` is recomputed from the raw file and found equal (D51). Re-pin follows `aliases` (chain of at most
   10, stops on a cycle), also for a hypothesis's claim type. A stale reference is flagged (DS-05), never silently
   repaired.
9. **Facts are read-only** (D52): value, anchors and status are shown as they came; the only thing added is the
   project's decision. "Dùng" is refused when no anchor of the fact is found in the paper model held. `replaceFacts`
   keeps decisions and matches of facts that still exist and reports the ones it dropped.
10. **Matching is exact** after normalising, by name or alias; a match is stored only when a person confirms an
    offered one (D54).
11. **Suggestions** (D55): only facts decided "dùng" are sent, as kind, value and paper title; citations outside
    what was sent are removed; a suggestion with none left is dropped; nothing enters the draft without a person's
    action through the existing operations.
12. **Vendored schemas are never edited**, and generated schema files are regenerated, not hand-edited.
13. Test names carry the rule ids (`PP-`, `DS-`, `CH-`, `AN-`, `RM-`, `FR-`, `DR-`, `WF-`); keep them when porting.

## Which decisions are the owner's rules

Said by the owner, in their words or by a direct answer:

- **D23, D50.** This app fetched no document and ran no extraction, and never called Paper Fetch Hub; PaperLab is the
  caller of the Hub. Inside PaperLab these stop constraining the planning part, as your plan says.
- **D24.** "Có, có hạn mức": a model may be called for planning help only, with a budget. The plan drops the daily
  cap; that changes an answer the owner gave, so it is theirs to confirm, not ours to drop.
- **D49.** The lab's systems talk to each other through APIs.
- **The bank API serves draft entries too** (said in the Writing Bank chat, 2026-11-17).
- Repository rules: synthetic fixtures only in a public repository, no real paper text; lab cloud resources only on
  the lab's own account; deploy only on the owner's word; commits from the lab address.

Not the owner's words (Claude's reading or Claude's own decision, free to revisit):

- **D31** (bank content only through the stored snapshot, fetched on a person's action) is a reading of "hạn chế
  việc thường xuyên lên online".
- **D55's rule that nothing from Writing Bank goes to the router** is Claude's caution because that repository is
  private; the owner has not ruled on it either way.
- Everything else in D25–D48 and D51–D54 is design decided here after consulting the advisor.

## On the port/drop map

Agreed, with these points:

1. **Paper ids.** `core/draft` and the plan's `context.sources` refer to papers by this app's ids (`p-` plus 12 hex),
   made in `core/papers`, which is not moved. The port needs a mapping to PaperLab's paper ids, and
   `draftToPlan(draft, meta, papers)` needs PaperLab's papers in the shape it reads (title, DOI, source hash).
2. **Freeze.** See invariant 2: the guard lived in the Worker, which is not moved.
3. **`modelEtag`.** `staleModel` compares the facts' `modelEtag` with the held model's HTTP ETag after stripping
   quotes and `W/`. With a local provider both sides come from `contentEtag`; keep one function for both.
4. **Who decided.** Decisions, matches and frozen versions record an email. Local-first PaperLab must still have
   one to record, or the fields need a defined value.
5. **D24**, above.
6. **Request 001 changes hands.** The bank client here (`shared/bank/bankApi.ts`, never run against the live API) is
   not moved; PaperLab becomes the bank's consumer and should say so in request 001. Request 002's routes stay for
   SRD.
7. **SRD.** The contract requests in `docs/CONTRACTS.md` were never sent. Whoever owns the plan contract after M1
   owns sending them.

## Where things are

- Spec and decisions: `docs/PRD.md` (decisions D1–D55 in section 9). Contracts: `docs/CONTRACTS.md`,
  `docs/API_REQUESTS.md`. UI patterns: `DESIGN.md`. What each slice built: `docs/ROADMAP.md`. Worker: `docs/WORKER_API.md`.
- Pure core, with tests beside each file: `src/core/{plan,draft,bank,facts,suggest}`.
- The prompt of the suggestions is in `src/core/suggest/suggest.ts` (`plan_suggestion@1`).
