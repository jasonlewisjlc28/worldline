#!/bin/bash
# Pull the latest collaborator changes from GitHub into this working copy.
# Run at the start of each session: bash scripts/sync.sh
set -e
git fetch origin main
git status -sb
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  git stash push -m "sandbox-autostash" || true
  git merge --ff-only origin/main
  echo "Synced to origin/main."
else
  echo "Already up to date."
fi
