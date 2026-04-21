#!/bin/bash
# SPDX-License-Identifier: GPL-3.0-or-later
# bootstrap-scoop-bucket.sh — One-time setup for the nirholas/scoop-pai repo
set -euo pipefail

REPO="nirholas/scoop-pai"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TEMPLATE_DIR="${ROOT}/bucket-templates/scoop"

echo "=== Bootstrap Scoop bucket: $REPO ==="

# 1. Create the repo
if gh repo view "$REPO" >/dev/null 2>&1; then
  echo "Repository $REPO already exists — skipping creation."
else
  echo "Creating $REPO..."
  gh repo create "$REPO" --public --description "Scoop bucket for PAI — private offline AI"
fi

# 2. Clone into a temp directory
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

gh repo clone "$REPO" "$WORK/scoop-pai"
cd "$WORK/scoop-pai"

# 3. Copy manifest
echo "Copying pai.json..."
cp "$TEMPLATE_DIR/pai.json" pai.json

# 4. Copy workflow
echo "Copying GitHub Actions workflow..."
mkdir -p .github/workflows
cp "$TEMPLATE_DIR/.github/workflows/update-formula.yml" .github/workflows/update-formula.yml

# 5. Create a minimal README
cat > README.md <<'EOF'
# scoop-pai

[Scoop](https://scoop.sh) bucket for [PAI](https://pai.direct) — private offline AI on a bootable USB.

## Usage

```powershell
scoop bucket add pai https://github.com/nirholas/scoop-pai
scoop install pai
```

## Updating

The manifest is updated automatically when a new PAI release is published.
EOF

# 6. Commit and push
git add -A
git commit -m "Initial Scoop bucket for PAI"
git push origin main

echo ""
echo "Done. Scoop bucket is live at https://github.com/$REPO"
echo ""
echo "Next steps:"
echo "  1. Create a SCOOP_BUCKET_TOKEN secret in the main PAI repo"
echo "     (fine-grained PAT with Contents: write on $REPO)"
echo "  2. Publish a PAI release — the update-scoop workflow will dispatch"
echo "     to this bucket automatically."
