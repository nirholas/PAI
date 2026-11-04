#!/usr/bin/env bash
# Builds the PAI website and overlays the PAI Cloud platform into ./public.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
site="$here/../website"

cd "$site"
node scripts/build-content.mjs
node scripts/sync-flashers.mjs
node ../scripts/gen-imager-manifest.mjs --local
node ../scripts/validate-imager-manifest.mjs --no-network
NODE_OPTIONS=--max-old-space-size=3072 npx astro build

cd "$here"
rm -rf public
cp -r "$site/dist" public
cp -r platform public/platform
cp -r kit public/kit

# Add a PAI Cloud entry point to the site's home page.
link='<link rel="stylesheet" href="/platform/cloud-link.css"><a class="pai-cloud-link" href="/platform/">PAI Cloud &rarr;</a>'
grep -q 'pai-cloud-link' public/index.html || sed -i "s#</body>#${link}</body>#" public/index.html
echo "Built $(find public -type f | wc -l) files into $here/public"
