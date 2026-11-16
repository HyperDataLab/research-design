## Why

## What changed

## How it was verified

- [ ] `npm run typecheck`, `npm run lint`, `npm run format:check` locally
- [ ] Tests touched by the change run locally; `npm run check` in CI
- [ ] Checked in the browser (screens / notes below)
- [ ] For a new check: broken on purpose once and seen red

## Invariants (AGENTS.md)

- [ ] AI output is a candidate; nothing is approved or frozen without a signed-in person
- [ ] Every extracted fact is anchored to a paper-model sentence key
- [ ] A frozen plan is not edited; a change is a new version with a deviation note
- [ ] Contract schemas changed only through `npm run schema:export`; `schemas/vendor/` untouched
- [ ] Prompt changed: `PROMPT_VERSIONS` bumped
- [ ] UI follows DESIGN.md

## Not verified / follow-ups
