# Roadmap

One slice per PR. A slice is done when its acceptance line holds in CI and, for a screen, in the browser.

## Done

| Slice | What                                                                                                                                                        |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S0    | Repo, tooling, shell with the planned screens, plan contract v1 with its gate and tests, docs.                                                              |
| S1    | Worker: auth, projects, documents, items and frozen plans on R2 (`docs/WORKER_API.md`), tests WK-01..WK-12. Not deployed; never run in the Workers runtime. |

## Next

| Slice | What                                                            | Requirements           | Done when                                                       |
| ----- | --------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------- |
| S2    | Sign-in and project list                                        | FR-101, FR-102         | A member sees their projects after reload.                      |
| S3    | Tập bài báo: paper-model import, decisions log                  | FR-201, FR-202         | A v1 model imports; another version is refused with its reason. |
| S4    | Worker LLM proxy, consent, ledger, budget                       | FR-601..604            | A call over budget is refused; the ledger shows it.             |
| S5    | Fact extraction and anchoring (core) with fixtures              | FR-301, FR-302, FR-605 | Unanchored facts cannot be approved; cache hit makes no call.   |
| S6    | Bảng so sánh                                                    | FR-303                 | Approve, edit, reject, bulk approve; history kept.              |
| S7    | Câu hỏi và giả thuyết; Thiết kế nghiên cứu with a bank snapshot | FR-401..403            | A hypothesis the design cannot support is flagged.              |
| S8    | Đo lường; the chain view                                        | FR-404                 | A broken link is named on the object.                           |
| S9    | Phân tích thống kê; Ma trận chạy                                | FR-501, FR-502         | Run count shown; P1 methods marked.                             |
| S10   | Gói kế hoạch: gate, freeze, export, new version                 | FR-503..506            | ZIP hashes match; frozen version is read-only.                  |
| S11   | Search and seed expansion; Paper Fetch Hub request              | FR-203, FR-204         | Deduplicated results with their source.                         |
| S12   | Bank matching, counts, AI suggestions, runner stubs             | FR-304, 305, 405, 507  | Suggestions cite their cells; stub grid equals `expectedRuns`.  |

## Owner steps (not done by agents)

0. **GitHub Actions does not start jobs for the organisation** ("recent account payments have failed or your
   spending limit needs to be increased", seen 2026-11-16 on this repo and on writing-bank). Until billing is
   fixed, CI has never run here and `scripts/deploy.sh` refuses to deploy.
1. Create the Firebase project (suggested id `hyperdatalab-research-design`), enable Google sign-in, add
   `.firebaserc`.
2. On the lab's Cloudflare account: decide the Worker name (suggested `researchdesign-worker`), bind the shared
   bucket `paper-fetch` with the prefix `researchdesign/`, set the LLM key with `wrangler secret put`.
3. Send the four requests in `docs/CONTRACTS.md` to whoever owns SRD.
4. Say "Deploy now" when a version should go live.
