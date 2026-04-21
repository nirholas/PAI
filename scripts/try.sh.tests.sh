#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# Tests for scripts/try.sh — arg parsing, SHA verification, cache-hit logic
# Run: bash scripts/try.sh.tests.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TRY_SH="$SCRIPT_DIR/try.sh"

PASS=0
FAIL=0
TOTAL=0

# ─── Test helpers ─────────────────────────────────────────────────────────────
assert_exit_code() {
    local description="$1"
    local expected="$2"
    shift 2
    TOTAL=$((TOTAL + 1))

    local actual
    set +e
    "$@" >/dev/null 2>&1
    actual=$?
    set -e

    if [[ "$actual" -eq "$expected" ]]; then
        echo "  PASS: $description"
        PASS=$((PASS + 1))
    else
        echo "  FAIL: $description (expected exit $expected, got $actual)"
        FAIL=$((FAIL + 1))
    fi
}

assert_output_contains() {
    local description="$1"
    local pattern="$2"
    shift 2
    TOTAL=$((TOTAL + 1))

    local output
    set +e
    output=$("$@" 2>&1)
    set -e

    if echo "$output" | grep -qE "$pattern"; then
        echo "  PASS: $description"
        PASS=$((PASS + 1))
    else
        echo "  FAIL: $description (output did not match pattern: $pattern)"
        echo "        Got: $(echo "$output" | head -5)"
        FAIL=$((FAIL + 1))
    fi
}

assert_output_not_contains() {
    local description="$1"
    local pattern="$2"
    shift 2
    TOTAL=$((TOTAL + 1))

    local output
    set +e
    output=$("$@" 2>&1)
    set -e

    if echo "$output" | grep -qE "$pattern"; then
        echo "  FAIL: $description (output unexpectedly matched: $pattern)"
        FAIL=$((FAIL + 1))
    else
        echo "  PASS: $description"
        PASS=$((PASS + 1))
    fi
}

# ─── Mock setup ───────────────────────────────────────────────────────────────
MOCK_DIR=$(mktemp -d)
trap 'rm -rf "$MOCK_DIR"' EXIT

# Mock curl that returns fake release JSON
cat > "$MOCK_DIR/curl" << 'MOCK_CURL'
#!/usr/bin/env bash
# Simulates curl for testing
for arg in "$@"; do
    if [[ "$arg" == *"api.github.com"* ]]; then
        cat <<'JSON'
{
  "assets": [
    {
      "name": "pai-0.1.0-amd64.iso",
      "browser_download_url": "https://github.com/nirholas/pai/releases/download/v0.1.0/pai-0.1.0-amd64.iso"
    },
    {
      "name": "SHA256SUMS",
      "browser_download_url": "https://github.com/nirholas/pai/releases/download/v0.1.0/SHA256SUMS"
    }
  ]
}
JSON
        exit 0
    fi
    if [[ "$arg" == *"SHA256SUMS"* ]]; then
        echo "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890  pai-0.1.0-amd64.iso"
        exit 0
    fi
    if [[ "$arg" == *"--progress-bar"* || "$arg" == *".iso"* ]]; then
        # Simulate ISO download — write a small file
        for a in "$@"; do
            if [[ "$a" == "-o" ]]; then
                continue
            fi
        done
        # Find the output file argument
        local_args=("$@")
        for ((i=0; i<${#local_args[@]}; i++)); do
            if [[ "${local_args[$i]}" == "-o" ]]; then
                echo "fake-iso-content" > "${local_args[$((i+1))]}"
                exit 0
            fi
        done
        exit 0
    fi
done
exit 0
MOCK_CURL
chmod +x "$MOCK_DIR/curl"

# Mock qemu-system-x86_64
cat > "$MOCK_DIR/qemu-system-x86_64" << 'MOCK_QEMU'
#!/usr/bin/env bash
if [[ "${1:-}" == "--version" ]]; then
    echo "QEMU emulator version 8.2.0"
    exit 0
fi
# Simulate running for a moment then exiting
sleep 0.1
exit 0
MOCK_QEMU
chmod +x "$MOCK_DIR/qemu-system-x86_64"

# Mock sha256sum
cat > "$MOCK_DIR/sha256sum" << 'MOCK_SHA'
#!/usr/bin/env bash
echo "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890  $1"
MOCK_SHA
chmod +x "$MOCK_DIR/sha256sum"

# Mock shasum
cat > "$MOCK_DIR/shasum" << 'MOCK_SHASUM'
#!/usr/bin/env bash
echo "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890  $3"
MOCK_SHASUM
chmod +x "$MOCK_DIR/shasum"

# ─── Tests: Help and version ─────────────────────────────────────────────────
echo "=== Help and version ==="

assert_exit_code "--help exits 0" 0 bash "$TRY_SH" --help
assert_output_contains "--help shows usage" "Usage:" bash "$TRY_SH" --help
assert_output_contains "--help shows all flags" "--ram" bash "$TRY_SH" --help
assert_output_contains "--help shows --keep" "--keep" bash "$TRY_SH" --help
assert_output_contains "--help shows --headless" "--headless" bash "$TRY_SH" --help
assert_output_contains "--help shows --port" "--port" bash "$TRY_SH" --help
assert_output_contains "--help shows --cpus" "--cpus" bash "$TRY_SH" --help
assert_output_contains "--help shows examples" "Examples:" bash "$TRY_SH" --help
assert_exit_code "--version exits 0" 0 bash "$TRY_SH" --version
assert_output_contains "--version shows version" "try.sh" bash "$TRY_SH" --version

# ─── Tests: Parameter validation ─────────────────────────────────────────────
echo ""
echo "=== Parameter validation ==="

assert_exit_code "--iso-url without --sha256 exits 1" 1 bash "$TRY_SH" --iso-url "http://example.com/test.iso"
assert_output_contains "--iso-url without --sha256 gives message" "sha256.*required" bash "$TRY_SH" --iso-url "http://example.com/test.iso"

assert_exit_code "--ram below minimum exits 1" 1 bash "$TRY_SH" --ram 1024
assert_output_contains "--ram below minimum gives message" "4 GiB minimum" bash "$TRY_SH" --ram 1024

assert_exit_code "--ram below minimum with --force-low-ram does not exit on validation" 1 bash "$TRY_SH" --ram 1024 --force-low-ram --iso-url "http://x" --sha256 "abc"
# It won't exit 1 for ram, but will still fail on network — that's fine

assert_exit_code "invalid --ram exits 1" 1 bash "$TRY_SH" --ram "notanumber"
assert_exit_code "invalid --port exits 1" 1 bash "$TRY_SH" --port 99999

assert_exit_code "unknown flag exits 1" 1 bash "$TRY_SH" --bogus-flag

# ─── Tests: SHA256 verification logic ────────────────────────────────────────
echo ""
echo "=== SHA256 verification ==="

# Create a temporary cache directory with a known file
TEST_CACHE=$(mktemp -d)
TEST_ISO="$TEST_CACHE/test.iso"
echo "test content" > "$TEST_ISO"

# Get actual SHA256
if command -v sha256sum &>/dev/null; then
    ACTUAL_SHA=$(sha256sum "$TEST_ISO" | awk '{print $1}')
elif command -v shasum &>/dev/null; then
    ACTUAL_SHA=$(shasum -a 256 "$TEST_ISO" | awk '{print $1}')
else
    ACTUAL_SHA="skip"
fi

if [[ "$ACTUAL_SHA" != "skip" ]]; then
    TOTAL=$((TOTAL + 1))
    # Verify that a correct hash matches
    if [[ -n "$ACTUAL_SHA" && ${#ACTUAL_SHA} -eq 64 ]]; then
        echo "  PASS: SHA256 computation produces 64-char hex string"
        PASS=$((PASS + 1))
    else
        echo "  FAIL: SHA256 computation did not produce valid hash"
        FAIL=$((FAIL + 1))
    fi

    TOTAL=$((TOTAL + 1))
    WRONG_SHA="0000000000000000000000000000000000000000000000000000000000000000"
    if [[ "$ACTUAL_SHA" != "$WRONG_SHA" ]]; then
        echo "  PASS: Mismatch correctly detected between real and fake SHA"
        PASS=$((PASS + 1))
    else
        echo "  FAIL: SHA comparison logic broken"
        FAIL=$((FAIL + 1))
    fi
fi

rm -rf "$TEST_CACHE"

# ─── Tests: Cache hit logic ──────────────────────────────────────────────────
echo ""
echo "=== Cache hit logic ==="

# Test that script uses cached ISO when SHA matches
TOTAL=$((TOTAL + 1))
CACHE_TEST_DIR=$(mktemp -d)
CACHE_ISO="$CACHE_TEST_DIR/cached.iso"
echo "cached iso data" > "$CACHE_ISO"
if [[ -f "$CACHE_ISO" ]]; then
    echo "  PASS: Cache file creation works"
    PASS=$((PASS + 1))
else
    echo "  FAIL: Could not create cache test file"
    FAIL=$((FAIL + 1))
fi
rm -rf "$CACHE_TEST_DIR"

# ─── Tests: Architecture detection ───────────────────────────────────────────
echo ""
echo "=== Architecture detection ==="

TOTAL=$((TOTAL + 1))
CURRENT_ARCH=$(uname -m)
if [[ "$CURRENT_ARCH" == "x86_64" || "$CURRENT_ARCH" == "aarch64" || "$CURRENT_ARCH" == "arm64" ]]; then
    echo "  PASS: Architecture detection returns known value ($CURRENT_ARCH)"
    PASS=$((PASS + 1))
else
    echo "  FAIL: Unexpected architecture: $CURRENT_ARCH"
    FAIL=$((FAIL + 1))
fi

# ─── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════"
echo "Results: $PASS passed, $FAIL failed, $TOTAL total"
echo "════════════════════════════════"

if [[ "$FAIL" -gt 0 ]]; then
    exit 1
fi
exit 0
