# Research Design

> **Moved, 2026-11-17:** these features now live in PaperLab Projects (repository `HyperDataLab/paper-lab`, plan and
> status in its `docs/plans/RESEARCH_DESIGN_MIGRATION.md`). The owner decided this app is not built out on its own;
> no new work starts here. What the port was told: [docs/HANDOFF.md](docs/HANDOFF.md).

From a set of papers to a frozen experiment plan that Scientific Research Desktop can run.
HyperDataLab internal. UI in Vietnamese.

- What it is and the rules: [AGENTS.md](AGENTS.md)
- Spec: [docs/PRD.md](docs/PRD.md) · contracts: [docs/CONTRACTS.md](docs/CONTRACTS.md) · APIs between systems: [docs/API_REQUESTS.md](docs/API_REQUESTS.md) · progress: [docs/ROADMAP.md](docs/ROADMAP.md)
- UI contract: [DESIGN.md](DESIGN.md) · product intent: [PRODUCT.md](PRODUCT.md)

```bash
npm ci
npm run dev
npm run check
```

The plan contract is `src/core/plan/schema.ts`; `npm run schema:export` writes it to `schemas/`.
