#!/usr/bin/env bash
# Merge a PR now, without waiting for CI. Owner's choice (2026-11-11): the gate before users is the deploy, not the
# merge. CI runs on main after the merge; a red main is fixed or reverted in the next commit, and scripts/deploy.sh
# refuses to deploy a commit whose CI is not green.
# PRs stacked on this one are retargeted to main first: deleting the head branch would otherwise close them.
# Usage: scripts/merge-pr.sh <pr-number>
set -euo pipefail

pr="${1:?usage: scripts/merge-pr.sh <pr-number>}"
head="$(gh pr view "$pr" --json headRefName -q .headRefName)"
for child in $(gh pr list --state open --base "$head" --json number -q '.[].number'); do
  gh pr edit "$child" --base main >/dev/null
  echo "PR $child retargeted to main."
done
gh pr merge "$pr" --merge --delete-branch
echo "PR $pr merged. CI runs on main; deploy only through scripts/deploy.sh."
