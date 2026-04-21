#!/usr/bin/env bash
# Smoke-test the canonical flasher URLs on pai.direct and on the latest
# GitHub release:
#   • https://pai.direct/flash.ps1                              (Vercel asset)
#   • https://pai.direct/flash.sh                               (Vercel asset)
#   • https://github.com/<repo>/releases/download/<tag>/flash.ps1
#   • https://github.com/<repo>/releases/download/<tag>/flash.sh
# For each URL we verify: reachability, first-line fingerprint (SPDX for
# .ps1, bash shebang for .sh), Content-Type: text/plain, and SHA256
# integrity against the sibling .sha256 file.
#
# Also smoke-tests the Raspberry Pi Imager manifest (imager.json + icon).
#
# Exits non-zero on any mismatch. Safe to invoke from CI on
# `release: { types: [published] }` or manually after a deploy.

set -euo pipefail

SITE_BASE="${PAI_SITE_BASE:-https://pai.direct}"
REPO="${PAI_REPO:-nirholas/pai}"

FAILED=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail() { echo "[smoke] FAIL: $*" >&2; FAILED=1; }
pass() { echo "[smoke] ok:   $*"; }

assert_spdx_header() {
  local path="$1" label="$2"
  # PowerShell files start with <# ... #> comment-based help; the SPDX line
  # may not be on line 1.  Check the first 100 lines for it.
  if head -n100 "$path" | grep -q '^# SPDX-License-Identifier\|^[[:space:]]*SPDX-License-Identifier'; then
    pass "$label contains SPDX header"
  else
    fail "$label does not contain SPDX header in first 100 lines"
  fi
}

# Match "#!/usr/bin/env bash" or "#!/bin/bash" on the first line (shell flasher).
assert_bash_shebang() {
  local path="$1" label="$2"
  local first
  first="$(head -n1 "$path" || true)"
  if [[ "$first" == \#!*bash* ]]; then
    pass "$label first line is bash shebang"
  else
    fail "$label first line is not a bash shebang (got: ${first:0:80})"
  fi
}

assert_content_type_text() {
  local url="$1" label="$2"
  local ct
  ct="$(curl -fsSIL "$url" | awk -F': ' 'tolower($1)=="content-type"{print $2}' | tr -d '\r' | tail -n1)"
  if [[ "$ct" == text/plain* ]]; then
    pass "$label Content-Type=$ct"
  else
    fail "$label Content-Type is not text/plain (got: $ct)"
  fi
}

verify_sha256() {
  local file="$1" sha_url="$2" label="$3"
  local expected
  if ! expected="$(curl -fsSL "$sha_url" | awk '{print $1}')"; then
    fail "$label could not fetch $sha_url"
    return
  fi
  local actual
  actual="$(sha256sum "$file" | awk '{print $1}')"
  if [[ "$expected" == "$actual" ]]; then
    pass "$label sha256 matches ($actual)"
  else
    fail "$label sha256 mismatch (expected=$expected actual=$actual)"
  fi
}

# check_flasher <url> <sha_url> <local_tmp> <first-line-kind:spdx|shebang> <label>
check_flasher() {
  local url="$1" sha_url="$2" file="$3" kind="$4" label="$5"

  echo "[smoke] fetching $url"
  if ! curl -fsSL "$url" -o "$file"; then
    fail "$label not reachable at $url"
    return
  fi
  pass "$label reachable"

  case "$kind" in
    spdx)    assert_spdx_header "$file" "$label" ;;
    shebang) assert_bash_shebang    "$file" "$label" ;;
    *)       fail "$label unknown first-line kind: $kind" ;;
  esac
  assert_content_type_text "$url" "$label"
  verify_sha256 "$file" "$sha_url" "$label"
}

# ── 1. Website static assets ─────────────────────────────────────────────────
check_flasher \
  "$SITE_BASE/flash.ps1" \
  "$SITE_BASE/flash.ps1.sha256" \
  "$TMP/site-flash.ps1" \
  spdx \
  "site flash.ps1"

check_flasher \
  "$SITE_BASE/flash.sh" \
  "$SITE_BASE/flash.sh.sha256" \
  "$TMP/site-flash.sh" \
  shebang \
  "site flash.sh"

# ── 2. Release assets (pinned to latest tag) ─────────────────────────────────
TAG=""
if ! command -v gh >/dev/null 2>&1; then
  echo "[smoke] WARN: gh CLI not installed — skipping release-asset checks"
elif ! TAG="$(gh release view --repo "$REPO" --json tagName -q .tagName 2>&1)"; then
  echo "[smoke] WARN: gh release view failed for $REPO — skipping release-asset checks"
  echo "[smoke]       (output: ${TAG:0:120})"
  TAG=""
fi

if [[ -z "$TAG" ]]; then
  echo "[smoke] WARN: no gh/tag found — skipping release-asset check"
else
  REL_BASE="https://github.com/$REPO/releases/download/$TAG"

  check_flasher \
    "$REL_BASE/flash.ps1" \
    "$REL_BASE/flash.ps1.sha256" \
    "$TMP/release-flash.ps1" \
    spdx \
    "release flash.ps1 ($TAG)"

  check_flasher \
    "$REL_BASE/flash.sh" \
    "$REL_BASE/flash.sh.sha256" \
    "$TMP/release-flash.sh" \
    shebang \
    "release flash.sh ($TAG)"
fi

# ── 3. Raspberry Pi Imager manifest ──────────────────────────────────────────
IMAGER_URL="$SITE_BASE/imager.json"
ICON_URL="$SITE_BASE/imager/pai-icon.png"
IMAGER_FILE="$TMP/imager.json"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMMITTED_MANIFEST="$REPO_ROOT/website/public/imager.json"

echo "[smoke] fetching $IMAGER_URL"
if curl -fsSL "$IMAGER_URL" -o "$IMAGER_FILE"; then
  pass "imager.json reachable"

  IMAGER_CT="$(curl -fsSIL "$IMAGER_URL" | awk -F': ' 'tolower($1)=="content-type"{print $2}' | tr -d '\r' | tail -n1)"
  if [[ "$IMAGER_CT" == application/json* ]]; then
    pass "imager.json Content-Type=$IMAGER_CT"
  else
    fail "imager.json Content-Type is not application/json (got: $IMAGER_CT)"
  fi

  # After a successful deploy the live manifest equals the committed file
  # byte-for-byte. Diff them so we catch stale CDN caches or bad deploys,
  # then run the schema validator against the committed copy.
  if [[ -f "$COMMITTED_MANIFEST" ]]; then
    if diff -q "$IMAGER_FILE" "$COMMITTED_MANIFEST" >/dev/null 2>&1; then
      pass "live imager.json matches committed copy"
    else
      fail "live imager.json differs from committed website/public/imager.json"
    fi
  fi
  if command -v node >/dev/null 2>&1; then
    if ( cd "$REPO_ROOT" && node scripts/validate-imager-manifest.mjs ); then
      pass "imager.json passes validator"
    else
      fail "imager.json failed validator"
    fi
  else
    echo "[smoke] WARN: node not available — skipping manifest schema check"
  fi
else
  fail "imager.json not reachable at $IMAGER_URL"
fi

echo "[smoke] checking $ICON_URL"
ICON_STATUS="$(curl -fsSIL -o /dev/null -w '%{http_code}' "$ICON_URL" || echo 000)"
if [[ "$ICON_STATUS" == "200" ]]; then
  pass "imager icon reachable ($ICON_STATUS)"
  ICON_CT="$(curl -fsSIL "$ICON_URL" | awk -F': ' 'tolower($1)=="content-type"{print $2}' | tr -d '\r' | tail -n1)"
  if [[ "$ICON_CT" == image/png* ]]; then
    pass "imager icon Content-Type=$ICON_CT"
  else
    fail "imager icon Content-Type is not image/png (got: $ICON_CT)"
  fi
else
  fail "imager icon not reachable at $ICON_URL (status: $ICON_STATUS)"
fi

# ── try.sh / try.ps1 ────────────────────────────────────────────────
echo ""
echo "[smoke] ── try.sh / try.ps1 ──────────────────────────────────"

# Full checks via check_flasher (SHA256, first-line fingerprint, Content-Type)
check_flasher \
  "$SITE_BASE/try.sh" \
  "$SITE_BASE/try.sh.sha256" \
  "$TMP/site-try.sh" \
  shebang \
  "site try.sh"

check_flasher \
  "$SITE_BASE/try.ps1" \
  "$SITE_BASE/try.ps1.sha256" \
  "$TMP/site-try.ps1" \
  spdx \
  "site try.ps1"

# Verify the /try rewrite serves the same content as /try.sh
echo "[smoke] checking /try rewrite matches /try.sh"
curl -fsSL "$SITE_BASE/try" -o "$TMP/try-rewrite.sh" 2>/dev/null || true
if [[ -f "$TMP/site-try.sh" ]] && diff -q "$TMP/try-rewrite.sh" "$TMP/site-try.sh" >/dev/null 2>&1; then
  pass "/try rewrite matches /try.sh"
else
  fail "/try rewrite does NOT match /try.sh"
fi

# Release assets for try scripts
if [[ -n "$TAG" ]]; then
  check_flasher \
    "$REL_BASE/try.sh" \
    "$REL_BASE/try.sh.sha256" \
    "$TMP/release-try.sh" \
    shebang \
    "release try.sh ($TAG)"

  check_flasher \
    "$REL_BASE/try.ps1" \
    "$REL_BASE/try.ps1.sha256" \
    "$TMP/release-try.ps1" \
    spdx \
    "release try.ps1 ($TAG)"
fi

if (( FAILED )); then
  echo "[smoke] FAILED"
  exit 1
fi
echo "[smoke] all checks passed"
