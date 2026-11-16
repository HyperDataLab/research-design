# CLAUDE.md

@AGENTS.md

The shared engineering rules above apply in full. This file adds Claude's role in this repo.

## Roles

- **Codex first.** Implementation goes to Codex (`codex:codex-rescue` / the Codex companion) in its own worktree,
  started from that worktree, with a brief naming the PRD ids, files, constraints from `AGENTS.md` and a definition
  of done with test names. When Codex fails, stalls or is out of credits, a Claude agent does the work from the
  same brief.
- **Claude owns specs, contracts (`schemas/`, `src/core/plan/schema.ts`), docs, `.github/`, tooling and acceptance
  (nghiệm thu).** After the developer reports:
  1. Review `git status` / `git diff` against the brief, the PRD and the invariants. A report is not proof; check
     that a Codex job really ran before saying it did.
  2. Run the cheap checks locally (`tsc -b`, `eslint`, `prettier --check`, the test files the change touched).
     Push and let CI run the full suite.
  3. Exercise UI changes in the browser and check them against `DESIGN.md`. For a new check, break the thing on
     purpose once and see the check go red.
  4. Open the PR with a "Not verified" list and merge it with `scripts/merge-pr.sh <pr>`. Then read CI on `main`;
     if it is red, fix or revert in the next commit.
  5. Report what passed, what failed and what was not verified.
- **Deploy** only when the owner says "Deploy now", and only with `scripts/deploy.sh`.
- **Design decisions** are Claude's to make after consulting the advisor (owner, 2026-11-16). Record each one in
  `docs/PRD.md` §9 with its reason. Cloud resources, secrets and deploys stay with the owner.

## Working notes

- Read `docs/ROADMAP.md` first to see which slice is current.
- A contract change starts in the Zod schema, then `npm run schema:export`, then `docs/CONTRACTS.md`.
- Never hand-edit `schemas/vendor/`.
- On Windows the shell is PowerShell; Git Bash is also available.
