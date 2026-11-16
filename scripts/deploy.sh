#!/usr/bin/env bash
# Deploy Research Design from main, only when CI passed on that exact commit.
# Merges do not wait for CI, so this is the gate before anything reaches users.
# Run only when the owner says "Deploy now". Usage: scripts/deploy.sh [--with-worker]
# The Firebase project and the Worker are created by the owner (docs/ROADMAP.md, "Owner steps"); until
# .firebaserc exists this script refuses to run.
set -euo pipefail

with_worker=false
[ "${1:-}" = "--with-worker" ] && with_worker=true

if [ ! -f .firebaserc ]; then
  echo "No .firebaserc: the Firebase project has not been set up yet. Not deploying." >&2
  exit 1
fi
if [ "$(git rev-parse --abbrev-ref HEAD)" != "main" ]; then
  echo "Not on main. Check out main first." >&2
  exit 1
fi
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Uncommitted changes in tracked files. Not deploying." >&2
  exit 1
fi
git pull -q --ff-only origin main
sha="$(git rev-parse HEAD)"

state="$(gh run list --branch main --commit "$sha" --workflow CI --limit 1 --json conclusion,status \
  -q '.[0] | if .status == "completed" then .conclusion else .status end')"
if [ "$state" != "success" ]; then
  echo "CI on main ${sha:0:7} is '${state:-missing}', not success. Not deploying." >&2
  exit 1
fi

if [ "$with_worker" = true ]; then
  who="$(cd worker && npx wrangler whoami 2>&1)"
  if ! grep -q "phuong@hyperdatalab.org" <<<"$who"; then
    echo "wrangler is not signed in as the lab's Cloudflare account. Not deploying the worker." >&2
    exit 1
  fi
  (cd worker && npx wrangler deploy)
fi
npm run build
npx firebase deploy --only hosting
echo "Deployed ${sha:0:7}$([ "$with_worker" = true ] && echo ' with the worker')."
