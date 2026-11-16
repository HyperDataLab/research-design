# AGENTS.md

Shared rules for every coding agent and every human contributor. UI rules are in `DESIGN.md`; the spec is
`docs/PRD.md`; the contracts with other systems are in `docs/CONTRACTS.md`; what is built is in `docs/ROADMAP.md`.

## What this is

**Research Design**: a single-page React + TypeScript + Vite app in which a researcher starts a writing project:
collect and compare papers, state questions and hypotheses, choose a research design, plan measurement and
analysis, lay out the runs, and freeze a versioned **experiment plan package**. That package is the input of
Scientific Research Desktop (SRD), the local app that runs experiments (MLflow) and statistics (Pingouin).

The UI is in Vietnamese. Plan content, extracted facts, code, identifiers and commit messages are English.

## Systems around it

| System                      | What this app does with it                                                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- |
| PaperLab                    | Imports its `paper-model.json`, one per paper, including the facts it extracted. This app extracts nothing. |
| Writing Bank                | Reads designs, threats, claim types, metrics, protocols and benchmarks from a pinned snapshot.              |
| Paper Fetch Hub             | Fetches documents and runs searches. This app only asks it; it contacts no publisher or scholarly source.   |
| Scientific Research Desktop | Reads the experiment plan package this app publishes.                                                       |

## Hard constraints

- **Static app; the only server code is the Worker** (`worker/`, Cloudflare Worker on R2). Sign-in is Firebase
  Auth, Google accounts ending in `@hyperdatalab.org`. No other server, no secret in the bundle.
- **Lab infrastructure lives on the lab's accounts.** Cloudflare and Firebase belong to
  `phuong@hyperdatalab.org`. Before any `wrangler` command that changes something, run `npx wrangler whoami` and
  stop when it shows another account. Creating cloud resources, setting secrets and deploying are the owner's
  actions unless the owner says otherwise.
- **This app fetches no document and extracts nothing from papers.** Paper Fetch Hub and PaperLab do that, each
  with a person in charge; this app sends requests and reads results (owner, 2026-11-16).
- **The LLM is reached only through the Worker.** The key is a `wrangler secret`. The browser never holds it.
- **Vendored contracts are read-only.** Files under `schemas/vendor/` change only by copying a new version from
  the system that owns them. A change this app needs is written into `docs/CONTRACTS.md` as a request.
- No new runtime dependency without saying why in the PR.

## Architecture

```
schemas/                 published contracts (generated) and schemas/vendor/ (read-only copies)
src/
  app/                   shell: router, sidebar, module registry
  modules/<module>/      one folder per screen; index.ts is its ModuleDefinition
  core/                  pure logic, no React, no browser APIs  <- most tests live here
    plan/                the experiment plan: Zod schema, freeze gate, run tags
  shared/
    ui/                  design-system primitives (see DESIGN.md)
worker/                  auth, projects, documents and frozen plans on R2 (docs/WORKER_API.md); the LLM proxy
                         with the usage ledger is slice S4
```

- **Dependency direction:** `app -> modules -> shared -> core`. ESLint enforces it for `core` and `shared`.
- **Adding a screen** = `src/modules/<id>/index.ts` + its entry in `src/app/modules.ts`. Planned screens sit in
  `src/modules/planned.ts` until a slice builds them.
- **Zod schemas are the single source of truth.** Objects are strict. Stored documents, LLM output, imports and
  the plan package are all parsed through them. `schemas/*.json` is generated: `npm run schema:export`.

## Invariants (tests enforce them as they are built)

1. **AI output is a candidate.** Extraction, suggestions and drafts are stored as `candidate` with the prompt
   and model version. Only a signed-in person approves, and only a person freezes a plan.
2. **Every extracted fact is anchored.** A fact taken from a paper carries the paper model's sentence `key`.
   Offsets and keys are computed by code from quoted text, never taken from the LLM. A fact that cannot be
   anchored cannot be approved.
3. **Reported numbers stay with their paper.** A result extracted from a paper is that paper's claim. It is
   never merged into a leaderboard or shown without its source.
4. **A frozen plan is immutable.** A change is a new `planVersion` with a `deviation` note (PP-09).
5. **The freeze gate is `core/plan/validatePlan.ts`** (rules PP-01..PP-10). Blocking issues stop the freeze;
   warnings are shown and may be accepted.
6. **Ids are stable.** Hypothesis, variable, metric, dataset, condition and analysis ids do not change between
   versions of a plan; SRD's results are traced back through them and through the MLflow run tags (`RUN_TAGS`).
7. **Bank references are pinned.** A reference names the bank release it was read from. Draft bank entries are
   labelled as drafts wherever they are shown.
8. **Prompts are versioned** (`PROMPT_VERSIONS`). A changed prompt gets a new version.
9. **Nothing is sent to the LLM before privacy consent is recorded**, and every call is written to the usage
   ledger.

## Token budget

Three different things are called tokens here; each has one home.

- **LLM tokens.** Every call goes through the Worker, which records account, feature, model, prompt version and
  input/output tokens, and refuses a call beyond the account's daily budget. The UI shows what a batch will
  cost before it starts. Calls are only for this app's own planning help; extraction from papers is PaperLab's.
- **Agent tokens (building this repo).** Design, schemas and acceptance stay with the lead model. Implementation
  slices go to Codex. Searching, bulk content and mechanical edits go to the cheapest model that can do them.
  One slice per task, a brief that names files and tests, no fan-out without the owner asking.
- **Design tokens.** `src/app/theme.css`, described in `DESIGN.md`. A test rejects raw colours and sizes.

## Coding standards

- TypeScript `strict`, `noUncheckedIndexedAccess`; no `any`. React 19 function components.
- Files up to about 300 lines. Comments explain why. Prettier and ESLint pass with zero warnings.
- **Encoding: UTF-8 without BOM, LF.** On Windows never write source or data files with PowerShell
  redirection; use the editor or a Node script.
- Tests: Vitest, next to the code. `core/` targets 90 % line coverage. Test names carry the rule id (`PP-03`).
- The LLM is mocked in tests with recorded fixtures. Tests never call the network.

## Commands

```bash
npm run dev            # Vite dev server
npm run typecheck      # tsc -b
npm run lint           # eslint . --max-warnings 0
npm run format         # prettier --write .
npm test               # vitest run
npm run schema:export  # regenerate schemas/*.json from the Zod schemas
npm run build          # tsc -b && vite build
npm run check          # everything CI runs, in order
```

Definition of done: `npm run check` green **in CI**; new behaviour has tests; docs updated. Locally, run the
cheap checks (`typecheck`, `lint`, `format:check`) and the test files you touched. Report a command's exit code,
never the tail of its output. A flaky test is a defect and is fixed at its cause.

## Working on Windows

- PowerShell blocks the npm `.ps1` shims: use `npm.cmd` / `npx.cmd` (or Git Bash).
- Codex writes only inside the folder it starts in: start it from the worktree it works on.
- Keep one slice per task; an agent that stops early reports what is left.

## Git

- Short branches off `main`; Conventional Commits. Never commit `.env*.local`, keys or PDFs.
- Merge with `scripts/merge-pr.sh <pr>`. Merges do not wait for CI; CI runs on `main` after the merge, and a red
  `main` is fixed or reverted in the next commit.
- Deploy only with `scripts/deploy.sh` (add `--with-worker` when `worker/` changed), which refuses a `main`
  commit whose CI run is not green.
