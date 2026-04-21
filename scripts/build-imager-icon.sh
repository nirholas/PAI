#!/usr/bin/env bash
# Build the 64×64 RGBA PNG shown by Raspberry Pi Imager in the OS picker.
#
# Source priority:
#   1. branding/favicon-128.png  — full-colour "PAI" brand mark (preferred).
#   2. pai.svg                   — repo-root wordmark (monochrome fallback).
#
# Output is deterministic: PNG date/time/text chunks are stripped so the file
# hashes identically across runs.

set -euo pipefail

cd "$(dirname "$0")/.."

OUT=website/public/imager/pai-icon.png
SRC_PNG=branding/favicon-128.png
SRC_SVG=pai.svg

mkdir -p "$(dirname "$OUT")"

if [[ -f "$SRC_PNG" ]]; then
    echo "[build-imager-icon] source: $SRC_PNG"
    convert "$SRC_PNG" \
        -resize 64x64 \
        -background none \
        -alpha on \
        -define png:exclude-chunks=date,time,tEXt,zTXt,iTXt \
        -strip \
        PNG32:"$OUT"
elif [[ -f "$SRC_SVG" ]]; then
    echo "[build-imager-icon] source: $SRC_SVG (fallback)"
    rsvg-convert -w 128 -h 128 "$SRC_SVG" | \
      convert - \
        -resize 64x64 \
        -background none \
        -alpha on \
        -define png:exclude-chunks=date,time,tEXt,zTXt,iTXt \
        -strip \
        PNG32:"$OUT"
else
    echo "[build-imager-icon] no source icon found (tried $SRC_PNG, $SRC_SVG)" >&2
    exit 66
fi

# Sanity check: refuse a blank / near-transparent result.
if command -v identify >/dev/null 2>&1; then
    DIMS=$(identify -format "%wx%h" "$OUT")
    if [[ "$DIMS" != "64x64" ]]; then
        echo "[build-imager-icon] unexpected dimensions: $DIMS" >&2
        exit 1
    fi
fi

echo "[build-imager-icon] wrote $OUT ($(stat -c%s "$OUT") bytes)"
