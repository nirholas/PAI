#!/bin/sh
# SPDX-License-Identifier: GPL-3.0-or-later
# bootstrap-homebrew-tap.sh — One-time setup for the nirholas/homebrew-tap repo
#
# Prerequisites:
#   - gh CLI authenticated (`gh auth login`)
#   - git configured with push access to nirholas org
#
# This script:
#   1. Creates the github.com/nirholas/homebrew-tap repository
#   2. Populates it with Formula/pai.rb, README, and CI workflow
#   3. Pushes the initial commit
#
# Usage: ./scripts/maintenance/bootstrap-homebrew-tap.sh

set -e

REPO_OWNER="nirholas"
REPO_NAME="homebrew-tap"
FULL_REPO="${REPO_OWNER}/${REPO_NAME}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TAP_TEMPLATES="${PROJECT_ROOT}/tap-templates"
WORK_DIR=$(mktemp -d)

cleanup() {
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

printf 'Creating GitHub repository %s...\n' "$FULL_REPO"
gh repo create "$FULL_REPO" \
  --public \
  --description "Homebrew tap for PAI — private offline AI. brew install nirholas/tap/pai" \
  --clone=false || {
    printf 'Repository may already exist — continuing.\n'
  }

printf 'Cloning %s into %s...\n' "$FULL_REPO" "$WORK_DIR"
if ! gh repo clone "$FULL_REPO" "$WORK_DIR" 2>/dev/null; then
  printf 'ERROR: Could not clone %s — check gh auth and repo permissions\n' "$FULL_REPO" >&2
  exit 1
fi

cd "$WORK_DIR"

# Copy templates
printf 'Copying tap templates...\n'
mkdir -p Formula .github/workflows

if [ -d "$TAP_TEMPLATES" ]; then
  cp "$TAP_TEMPLATES/Formula/pai.rb" Formula/pai.rb
  cp "$TAP_TEMPLATES/.github/workflows/update-formula.yml" .github/workflows/update-formula.yml
  cp "$TAP_TEMPLATES/README.md" README.md
else
  printf 'ERROR: tap-templates/ not found at %s\n' "$TAP_TEMPLATES" >&2
  exit 1
fi

# Commit and push
git add -A
git commit -m "Initial tap setup

Formula for PAI CLI wrapper (flash, try, verify, doctor).
Auto-update workflow listens for repository_dispatch from main repo."

git branch -M main
git push -u origin main

printf '\n✓ Homebrew tap repository created: https://github.com/%s\n' "$FULL_REPO"
printf '\nNext steps:\n'
printf '  1. Add HOMEBREW_TAP_TOKEN secret to the main PAI repo\n'
printf '     (a PAT with repo scope that can dispatch to %s)\n' "$FULL_REPO"
printf '  2. Test with: brew tap %s/%s && brew install pai\n' "$REPO_OWNER" "tap"
printf '     i.e.: brew tap nirholas/tap && brew install pai\n'
