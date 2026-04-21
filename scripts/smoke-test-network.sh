#!/bin/bash
# PAI network smoke test — supplementary to smoke-test.sh
#
# Requires internet. Verifies DNS, HTTPS, and that Ollama can reach the
# model registry. Use this to confirm network features work, e.g. after
# setting up wifi or before pulling a new model.
#
# Usage: bash smoke-test-network.sh
# Exit: 0 if all passed, 1 if any failed.

set -uo pipefail

if [ -t 1 ] && command -v tput >/dev/null 2>&1; then
    RED=$(tput setaf 1) GREEN=$(tput setaf 2) YELLOW=$(tput setaf 3)
    BOLD=$(tput bold) RESET=$(tput sgr0)
else
    RED='' GREEN='' YELLOW='' BOLD='' RESET=''
fi

PASS=0 FAIL=0

pass() { echo "${GREEN}✓${RESET} $1"; PASS=$((PASS + 1)); }
fail() { echo "${RED}✗${RESET} $1"; [ $# -gt 1 ] && echo "    ${RED}$2${RESET}"; FAIL=$((FAIL + 1)); }
section() { echo; echo "${BOLD}═══ $1 ═══${RESET}"; }

echo "${BOLD}PAI network smoke test${RESET}"
echo "Requires internet — will test DNS, HTTPS, and Ollama registry."

# ── DNS ─────────────────────────────────────────────────────────────────────
section "DNS"

if getent hosts cloudflare.com >/dev/null 2>&1; then
    pass "DNS resolves cloudflare.com"
else
    fail "DNS does not resolve cloudflare.com" "Check /etc/resolv.conf"
fi

# ── Basic internet ──────────────────────────────────────────────────────────
section "HTTPS reachability"

if curl -fsS --max-time 5 https://1.1.1.1/ >/dev/null 2>&1; then
    pass "HTTPS to 1.1.1.1 succeeds"
else
    fail "HTTPS to 1.1.1.1 fails" "Firewall? TLS chain? Check: curl -v https://1.1.1.1"
fi

# ── Ollama registry ─────────────────────────────────────────────────────────
section "Ollama registry"

if curl -fsS --max-time 5 "https://registry.ollama.ai/v2/" >/dev/null 2>&1; then
    pass "Ollama registry is reachable"
else
    fail "Ollama registry is not reachable" "Model pulls will fail"
fi

# ── Privacy mode compatibility ──────────────────────────────────────────────
section "Privacy mode status"

if [ -f /tmp/.pai-privacy-mode ]; then
    echo "${YELLOW}Note: Privacy Mode is ON.${RESET} All above checks ran through Tor."
    if curl --socks5 localhost:9050 -fsS --max-time 10 https://check.torproject.org/api/ip 2>/dev/null | grep -q '"IsTor":true'; then
        pass "Tor circuit confirmed by check.torproject.org"
    else
        fail "Privacy Mode is on but Tor check failed"
    fi
else
    echo "Privacy Mode is off. (Expected if you haven't run 'pai-privacy on')"
fi

# ── Summary ─────────────────────────────────────────────────────────────────
echo
echo "${BOLD}════════════════════════════════════════════════════════════${RESET}"
printf "  ${GREEN}%d passed${RESET}, ${RED}%d failed${RESET}\n" "$PASS" "$FAIL"
echo "${BOLD}════════════════════════════════════════════════════════════${RESET}"

[ "$FAIL" -eq 0 ]
