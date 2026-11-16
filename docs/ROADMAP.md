# Roadmap

One slice per PR. A slice is done when its acceptance line holds in CI and, for a screen, in the browser.

## Done

| Slice | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S0    | Repo, tooling, shell with the planned screens, plan contract v1 with its gate and tests, docs.                                                                                                                                                                                                                                                                                                                                                                      |
| S1    | Worker: auth, projects, documents, items and frozen plans on R2 (`docs/WORKER_API.md`), tests WK-01..WK-12. Not deployed; never run in the Workers runtime.                                                                                                                                                                                                                                                                                                         |
| S2    | Sign-in (Google, lab domain; dev sign-in on the dev server), Dự án list with create, rename, archive, and the project page at `/p/<id>`. Tests PJ-01..PJ-15. Real Google sign-in not exercised: no Firebase project yet.                                                                                                                                                                                                                                            |
| S2b   | Thành viên on the project page: the owner adds and removes members by email; others see the list. Tests MB-01..MB-08. The dev server has one account, so the non-owner view is covered by tests only. Known limit: two owners' tabs changing members at the same moment can overwrite each other (the project PATCH has no version check).                                                                                                                          |
| S3    | Tập bài báo at `/p/<id>/corpus`: add papers, include / exclude with a reason, decision log, import of a PaperLab paper model validated against the vendored schema; project layout route; saves that re-apply on a version conflict. Tests PA-01..PA-17, CO-01..CO-15.                                                                                                                                                                                              |
| S4    | AI calls through the Worker: consent, reservation against a daily token budget, ledger without text, strict request; Cài đặt screen with consent and usage. Only for this app's planning help. Tests LM-01..LM-15, LC-01..LC-14. The dev server answers with a fixed text and reaches no model. Never run against a real router.                                                                                                                                    |
| S7    | Câu hỏi và giả thuyết, Thiết kế nghiên cứu and the project's Writing Bank screen: the editable draft (`src/core/draft`), a bank snapshot imported from a file and pinned by its hash, the design checks DS-01..DS-05, the threat register. Tests DR, DS, BK, QH, RD. Exercised in the browser with a snapshot of the real bank; no AI call.                                                                                                                         |
| S8    | Đo lường at `/p/<id>/measurement`: variables, metrics, datasets and conditions in the draft; metrics and datasets picked from the bank snapshot; the chain line (hypothesis → variable → metric) here and on Câu hỏi và giả thuyết; chain checks CH-01..CH-09 that mirror the freeze gate; one list of bank references for DS-05, re-pin and the replace confirmation. Tests MO, CH, BR, ME. Exercised in the browser with a snapshot of the real bank; no AI call. |

## Next

| Slice | What                                                                                            | Requirements          | Done when                                                      |
| ----- | ----------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------- |
| S5    | Reader for experiment facts from the paper model (after PaperLab publishes them; see CONTRACTS) | FR-301, FR-302        | A fact whose sentence key is missing cannot be approved.       |
| S6    | Bảng so sánh                                                                                    | FR-303                | Approve, edit, reject, bulk approve; history kept.             |
| S9    | Phân tích thống kê; Ma trận chạy                                                                | FR-501, FR-502        | Run count shown; P1 methods marked.                            |
| S10   | Gói kế hoạch: gate, freeze, export, new version                                                 | FR-503..506           | ZIP hashes match; frozen version is read-only.                 |
| S11   | Requests to Paper Fetch Hub: search and PDF queue (after the Hub offers them; see CONTRACTS)    | FR-203, FR-204        | This app calls no scholarly source or publisher.               |
| S12   | Bank matching, counts, AI suggestions, runner stubs                                             | FR-304, 305, 405, 507 | Suggestions cite their cells; stub grid equals `expectedRuns`. |

## Owner steps (not done by agents)

0. GitHub Actions did not start jobs for the organisation's private repos (billing, seen 2026-11-16). This repo
   was made public that day and its CI runs; the private lab repos are still affected.
1. Create the Firebase project (suggested id `hyperdatalab-research-design`), enable Google sign-in, add
   `.firebaserc`.
2. On the lab's Cloudflare account: decide the Worker name (suggested `researchdesign-worker`), bind the shared
   bucket `paper-fetch` with the prefix `researchdesign/`, set the LLM key with `wrangler secret put`.
3. Send the requests in `docs/CONTRACTS.md` to whoever owns SRD, PaperLab and Paper Fetch Hub. S5, S6 and S11
   wait for PaperLab and the Hub.
4. Say "Deploy now" when a version should go live.

The Firebase project id and the Worker hostname in `firebase.json` (CSP) and `worker/wrangler.toml` are the suggested
names; they are confirmed only when the owner creates the resources.
