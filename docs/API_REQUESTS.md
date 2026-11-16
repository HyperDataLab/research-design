# APIs between the lab's systems

The lab's systems exchange data through APIs (PRD D49). This file describes every API Research Design needs from
another system and the one it offers, in enough detail for the person in charge of that system to build it.
Paths and field names here are proposals: the system that owns an API has the last word on its shape, and this
app follows it.

Nothing in this file is built on the other side yet, and none of it has been sent. Files (a bank snapshot, a
paper model, a plan package) stay as the fallback when an API is not reachable.

## The links

| #   | From → to                         | What crosses                                   | Used by                                   | State today                                                                   |
| --- | --------------------------------- | ---------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------- |
| A   | Writing Bank → Research Design    | One release of six collections                 | Writing Bank screen, S7–S9 screens        | Planned there (`/bank/v1`); here a file is imported by hand                   |
| B   | PaperLab → Research Design        | Paper models and their experiment facts        | Bài báo (S2), Bảng so sánh (S5), S11, S12 | No API; paper models live in the browser of the person who made them          |
| C   | Research Design → Paper Fetch Hub | A DOI to queue, its state, a literature search | Tìm bài báo (S6), Bài báo                 | No API for another app; members write the Hub's database from its own web app |
| D   | SRD → Research Design             | A frozen plan and its package                  | SRD's project input                       | Plan list and plan read exist; the package endpoint does not                  |
| E   | Research Design → LLM router      | Chat completions for planning help             | S4, S12                                   | Exists (`docs/WORKER_API.md`, "AI calls"); nothing is asked                   |

Research Design downloads no PDF and runs no extraction on a paper (PRD D23). A PDF goes from the Hub to PaperLab;
that link belongs to those two systems and is not described here. What this app needs from it is one shared key:
the SHA-256 of the PDF, reported by the Hub (C2) and carried by PaperLab's paper model (B1).

## Rules every API in this file follows

These are the rules this app's own Worker already follows (`docs/WORKER_API.md`). An API that follows them needs no
special case in the caller.

- **Transport.** HTTPS, JSON in UTF-8, a version in the path (`/v1`). A breaking change gets a new path version.
- **Errors.** `{ "error": "<code>", "message": "<English sentence>" }` with the HTTP status. Codes used below:
  `unauthenticated` (401), `forbidden` (403), `not_found` (404, naming the unknown id), `bad_request` (400),
  `conflict` (409), `rate_limited` (429, with `Retry-After` in seconds), `internal` (500, no detail).
- **Caching.** Every `GET` of a document returns an `ETag`; `If-None-Match` with the same value answers `304` with
  no body. This app stores what it read and asks again only when a person asks (PRD D31).
- **Lists.** `{ items: [...], nextCursor: string | null }`; the caller passes `cursor` to continue. At most 100
  items a page unless said otherwise.
- **Time** is ISO 8601 UTC ending in `Z`. **Hashes** are lowercase hex SHA-256.
- **CORS.** The API answers the preflight and allows the origins of the lab apps that call it, and no others.
  Allowed request headers: `Authorization`, `Content-Type`, `If-None-Match`. Exposed: `ETag`, `Retry-After`.
- **Limits.** A limit per person, answered with `429`. This app never retries on its own more than once and never
  polls; a state is read again when a person opens or refreshes a screen.
- **A description.** An OpenAPI file, or a page like `docs/WORKER_API.md`, with one example per endpoint made of
  invented data.

## Who is calling (one decision for the owner)

Each system checks Firebase ID tokens of its own Firebase project today, so no system can call another. Three ways
to open that, in the order this app prefers them:

1. **Each API accepts the ID tokens of a short list of lab Firebase projects** (recommended). The caller is the
   person's browser, with the token they already hold. The provider checks Google's signature, that `aud` is on its
   list, that the account is a verified Google account of the lab's domain, and then applies its own roles. No
   secret is shared, every call carries a real person, and each system's person in charge can limit or refuse a
   caller. Cost: each provider keeps a list of project ids and of origins.
2. **One Firebase project for sign-in across the lab apps.** The simplest check, but every existing app has to move
   its sign-in.
3. **Worker to Worker with a shared secret**, the caller's Worker passing the person's email in a header. It hides
   the browser from the provider, but the provider has to trust an email it cannot verify, and a secret must be
   kept in two places.

This app is written for option 1 and needs from the owner: the id of its Firebase project (not created yet) and
the hosting origins, to give to the other three systems. A provider whose database rules need a token of its own
project (the Hub today) writes on the caller's behalf inside its API and records the caller's email.

SRD is a desktop app. It signs in with Google and sends the ID token like any other caller; which Firebase project
it signs in to is part of the same decision.

## A. Writing Bank → Research Design

The bank plans `/bank/v1` (its backlog items Q6, Q7, C5, N4). This app needs two reads from it. Writing Bank
accepted this shape on 2026-11-17 with the changes written in below; it is not built yet, and going live waits for
the owner.

### A1. `GET /bank/v1/release`

The newest release, without its content. Read when a person opens the Writing Bank screen and presses "Kiểm tra bản
mới".

```json
{ "release": "2026.11.2", "date": "2026-11-16T00:00:00Z", "notes": "…" }
```

`release` is the bank's own identifier (C5), `YYYY.MM.N`, made when the bank is built; the same content never gets
two identifiers. `date` is the build time.

### A2. `GET /bank/v1/snapshot`

One release of the collections this app reads, in one answer. Query: `collections` (comma-separated; this app asks
for `designs,threats,claim-types,metrics,protocols,benchmarks`) and optional `release` (default: the newest; a
release that is no longer served answers `404 not_found` naming it; the bank serves the newest three). An unknown
name in `collections` answers `400 bad_request` naming it.

```json
{
  "format": "writing-bank-snapshot",
  "formatVersion": 1,
  "release": "2026.11.2",
  "date": "2026-11-16T00:00:00Z",
  "includesDrafts": true,
  "aliases": { "rd.old-id": "rd.new-id" },
  "collections": {
    "designs": [],
    "threats": [],
    "claim-types": [],
    "metrics": [],
    "protocols": [],
    "benchmarks": []
  }
}
```

- The `ETag` is `"<release>"`. The entries are the bank's own records, unchanged; this app reads the fields below and
  ignores the rest, so the bank can add fields freely.
- `aliases` maps an id that was renamed to its new id. Re-pinning a reference follows it; an id that is neither in
  the release nor in `aliases` stays flagged for a person to resolve.
- `includesDrafts` is true while the release contains entries the bank has not published. Today every entry of the bank is a draft; the owner decided on 2026-11-17 (in the Writing Bank chat, as that session reports) that the API serves drafts too. This app shows the mark on
  the Writing Bank screen and keeps showing each entry's `status`.
- A person triggers the read ("Lấy bản mới"); the answer is stored as the project's `bank` document and every screen
  reads that copy. Nothing calls the bank per field or per keystroke.
- Size today is well under 2 MiB. If a release grows past that, one request per collection with the same `release`
  is acceptable.

Fields this app reads. A field that is renamed or removed breaks a screen, so those are the ones to announce:

| Collection    | Fields                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `designs`     | `id` (`rd.*`), `name`, `family`, `definition`, `assignment`, `causalLicence`, `supports`, `cannotSupport`, `threats`, `status`              |
| `threats`     | `id` (`vt.*`), `name`, `type`, `mechanism`, `mitigation`, `status`                                                                          |
| `claim-types` | `id` (`ct.*`), `name`, `definition`, `status`                                                                                               |
| `metrics`     | `id` (`met.*`), `name`, `aliases`, `family`, `definition`, `unit`, `direction`, `maxClaim`, `doesNotSupport`, `requiredReporting`, `status` |
| `protocols`   | `id` (`mp.*`), `name`, `purpose`, `procedure`, `report`, `metrics`, `status`                                                                |
| `benchmarks`  | `id` (`bm.*`), `name`, `task`, `metrics`, `protocol`, `lifecycle`, `knownFlaws`, `url`, `status`                                            |

What changes here when A is live: the release of a project's bank becomes the bank's identifier instead of the hash
of an imported file. A draft pinned to a hash release shows its bank references as out of date (DS-05) once, and a
person re-pins them.

## B. PaperLab → Research Design

Today a paper model exists only in the browser of the person who analysed the paper, and moves as an exported JSON
file. PaperLab's Worker keeps PDFs and GROBID output, not paper models. So this request is larger than an endpoint:
**PaperLab would keep a finished paper model on its server**, published by the person in charge of that paper.
Until then this app keeps importing the file.

### B1. `GET /v1/papers`

Paper models that have been published. Query: `doi`, `sourceSha256`, `updatedSince`, `cursor`. Read when a person
opens "Thêm bài báo từ PaperLab" in a project.

```json
{
  "items": [
    {
      "paperId": "…",
      "title": "…",
      "doi": "10.1234/example",
      "sourceSha256": "…",
      "schemaVersion": "paper-model-v1",
      "updatedAt": "2026-11-16T09:00:00Z",
      "publishedBy": "person@lab",
      "experimentFacts": "none"
    }
  ],
  "nextCursor": null
}
```

`paperId` is PaperLab's stable id for the paper. `doi` and `sourceSha256` may be null. `experimentFacts` is `none`,
`candidate` (made by a model, not reviewed) or `reviewed`.

### B2. `GET /v1/papers/:paperId/model`

The paper model exactly as PaperLab's published schema describes it (`schemas/vendor/paper-model-v1.schema.json`
here is a copy), with an `ETag`. This app validates it with that schema and stores it in the project; a newer
`ETag` is shown as "PaperLab có bản mới" and replaced only when a person agrees.

### B3. Experiment facts

The facts Bảng so sánh shows, one row per paper. This app does not extract them (PRD D23). Either inside the paper
model in a new schema version (preferred: one read, one schema) or as `GET /v1/papers/:paperId/experiment-facts`:

```json
{
  "paperId": "…",
  "modelEtag": "…",
  "run": { "id": "…", "promptVersion": "…", "model": "…", "at": "2026-11-16T09:00:00Z" },
  "reviewedBy": null,
  "facts": [
    {
      "id": "f-1",
      "kind": "result",
      "value": "92.4",
      "number": 92.4,
      "unit": "%",
      "metric": "f-3",
      "dataset": "f-2",
      "condition": "f-4",
      "sentenceKeys": ["s-0042"],
      "status": "candidate"
    }
  ]
}
```

- `kind`: `task`, `dataset`, `baseline`, `method`, `metric`, `design`, `sample`, `result`.
- `value` is the text as the paper states it. A `result` also has `number` and `unit`, and points to the facts of
  kind `metric`, `dataset` and `baseline` or `method` it belongs to (`metric`, `dataset`, `condition`).
- `sentenceKeys` are `sentences[].key` of the paper model at `modelEtag`. A fact with no sentence is not sent.
- `status`: `candidate` or `accepted` (a person in PaperLab confirmed it). This app shows which is which and never
  turns a candidate into an accepted fact.

### B4. `POST /v1/papers/:paperId/experiment-facts/requests`

Asks PaperLab to produce the facts of a paper that has none. Body `{ "note": "…" }`. Answer `202` with
`{ "requestId", "state" }`, where `state` is `requested`, `running`, `done` or `declined`; a second request for the
same paper returns the first. PaperLab's person in charge decides when and whether it runs. The state is also
readable through `experimentFacts` in B1.

## C. Research Design → Paper Fetch Hub

The Hub's web app writes its database directly; its Worker has three routes, all about files. Another app needs
these.

### C1. `POST /v1/requests`

Adds a DOI to the queue in the caller's name. Body `{ "doi": "10.1234/example", "note": "…" }`. The Hub normalises
the DOI by its own rule. Answer `201` (new paper) or `200` (already known; the caller is added as a requester) with
the object of C2. `400 bad_request` for a string that is not a DOI. One DOI a call; this app sends at most 20 in a
row on a person's action.

### C2. `GET /v1/papers/:doiKey` and `POST /v1/papers/status`

The state of one paper, or of up to 50 (`{ "doiKeys": [] }` → `{ "items": [] }`, unknown keys left out).

```json
{
  "doiKey": "…",
  "doi": "10.1234/example",
  "title": null,
  "status": "queued",
  "needsHumanReason": null,
  "failureCode": null,
  "sha256": null,
  "requestCount": 1,
  "updatedAt": "2026-11-16T09:00:00Z",
  "doneAt": null
}
```

`status`, `needsHumanReason` and `failureCode` are the Hub's own values. `sha256` is the hash of the stored PDF once
`status` is `done`; this app uses it to find the paper in PaperLab (B1, `sourceSha256`). This app never asks the Hub
for the PDF.

### C3. `POST /v1/search`

A literature search run by the Hub with the lab's sources. Body:

```json
{
  "query": "…",
  "seedDois": ["10.1234/example"],
  "direction": "both",
  "yearFrom": 2020,
  "yearTo": null,
  "limit": 25,
  "cursor": null
}
```

At least one of `query` and `seedDois`. `direction` (`references`, `citations`, `both`) applies to seeds. `limit` up
to 50. Answer:

```json
{
  "items": [
    {
      "doi": "10.1234/example",
      "title": "…",
      "authors": ["…"],
      "year": 2024,
      "venue": "…",
      "abstract": null,
      "citedByCount": 12,
      "openAccess": true,
      "source": "…",
      "hub": { "doiKey": "…", "status": "done" }
    }
  ],
  "nextCursor": null
}
```

`source` names the index the record came from. `hub` is null for a paper the Hub does not know. A result without a
DOI may be returned with `doi: null`; this app shows it and cannot queue it. Searches are made on a person's action,
one at a time, and the result a person keeps is stored in the project with the reason for including or excluding
each paper.

## D. SRD → Research Design

This app is the provider. Rules and objects are in `docs/WORKER_API.md`; the caller must be a member of the project.

| Endpoint                                      | State    | Answer                                                      |
| --------------------------------------------- | -------- | ----------------------------------------------------------- |
| `GET /v1/projects`                            | exists   | The caller's projects.                                      |
| `GET /v1/projects/:id/plans`                  | exists   | `{ versions: [{ version, frozenAt, frozenBy }] }`.          |
| `GET /v1/projects/:id/plans/:version`         | exists   | The frozen plan (`schemas/experiment-plan-v1.schema.json`). |
| `GET /v1/projects/:id/plans/:version/package` | to build | The package ZIP: `manifest.json`, `plan.json`, `plan.md`.   |

The package is built in the browser today, from code that has no browser dependency (`src/core/plan`). The package
endpoint will run the same code in the Worker, so a ZIP from either place has the same three files and hashes. It
is built when SRD confirms it reads plans over the network; until then a person downloads the ZIP and opens it in
SRD. A frozen version never changes, so its `ETag` is permanent.

Nothing flows back from SRD to this app. If SRD later reports which runs of a plan exist, that is a new link and a
new section here.

## What each owner would do

- **Owner of the lab:** choose how callers are identified (above); create this app's Firebase project so its id and
  origins can be given to the other systems; send sections A, B, C and D to the people in charge.
- **Writing Bank:** A1, A2, and this app's project id on the list of accepted callers.
- **PaperLab:** a server-side home for published paper models; B1, B2; then B3 and B4.
- **Paper Fetch Hub:** C1, C2; then C3.
- **SRD:** say whether it reads plans over the network or from a file, and how it signs in.
- **Research Design:** clients for A, B and C behind the screens that exist, each added when its API answers; the
  package endpoint of D.
