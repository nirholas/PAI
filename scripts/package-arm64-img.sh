#!/usr/bin/env bash
# Package a raw arm64 Pi image into the release artifacts consumed by
# scripts/gen-imager-manifest.mjs:
#   dist/pai-<version>-arm64.img.xz
#   dist/pai-<version>-arm64.img.json (sidecar)
#
# Usage:
#   scripts/package-arm64-img.sh <path-to-raw-img> [version]
#
# If [version] is omitted, reads website/src/data/release.json.

set -euo pipefail

RAW_IMG="${1:-}"
VERSION="${2:-}"

if [[ -z "$RAW_IMG" ]]; then
  echo "usage: $0 <raw.img> [version]" >&2
  exit 64
fi
if [[ ! -f "$RAW_IMG" ]]; then
  echo "not a file: $RAW_IMG" >&2
  exit 66
fi

cd "$(dirname "$0")/.."

if [[ -z "$VERSION" ]]; then
  VERSION=$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync("website/src/data/release.json","utf8")).version)')
fi

mkdir -p dist
BASE="pai-${VERSION}-arm64"
OUT_IMG="dist/${BASE}.img"
OUT_XZ="dist/${BASE}.img.xz"
OUT_META="dist/${BASE}.img.json"

echo "[package-arm64] copying raw image → ${OUT_IMG}"
cp -f "$RAW_IMG" "$OUT_IMG"

EXTRACT_SIZE=$(stat -c%s "$OUT_IMG")
EXTRACT_SHA=$(sha256sum "$OUT_IMG" | awk '{print $1}')

echo "[package-arm64] compressing with xz -T0 -6"
rm -f "$OUT_XZ"
xz -T0 -6 --keep --stdout "$OUT_IMG" > "$OUT_XZ"

DL_SIZE=$(stat -c%s "$OUT_XZ")
DL_SHA=$(sha256sum "$OUT_XZ" | awk '{print $1}')
RELEASE_DATE=$(date -u +%Y-%m-%d)

cat > "$OUT_META" <<EOF
{
  "extract_size": ${EXTRACT_SIZE},
  "extract_sha256": "${EXTRACT_SHA}",
  "image_download_size": ${DL_SIZE},
  "image_download_sha256": "${DL_SHA}",
  "release_date": "${RELEASE_DATE}"
}
EOF

echo "[package-arm64] wrote:"
echo "  ${OUT_XZ}  (${DL_SIZE} bytes, sha256=${DL_SHA})"
echo "  ${OUT_META}"
