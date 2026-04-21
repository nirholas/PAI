#!/bin/bash
# PAI v0.1.0 smoke test
#
# Runs inside a booted PAI session to verify every critical feature works.
# No internet required for this script (see smoke-test-network.sh for the
# internet-dependent companion).
#
# Usage: bash smoke-test.sh
# Exit: 0 if all passed, 1 if any failed.

set -uo pipefail

# ── Colors ──────────────────────────────────────────────────────────────────
if [ -t 1 ] && command -v tput >/dev/null 2>&1; then
    RED=$(tput setaf 1)
    GREEN=$(tput setaf 2)
    YELLOW=$(tput setaf 3)
    BOLD=$(tput bold)
    RESET=$(tput sgr0)
else
    RED='' GREEN='' YELLOW='' BOLD='' RESET=''
fi

# ── Counters ────────────────────────────────────────────────────────────────
PASS=0
FAIL=0
WARN=0
FAILED_TESTS=()

# ── Helpers ─────────────────────────────────────────────────────────────────
pass() {
    echo "${GREEN}✓${RESET} $1"
    PASS=$((PASS + 1))
}

fail() {
    echo "${RED}✗${RESET} $1"
    [ $# -gt 1 ] && echo "    ${RED}${2}${RESET}"
    FAIL=$((FAIL + 1))
    FAILED_TESTS+=("$1")
}

warn() {
    echo "${YELLOW}⚠${RESET} $1"
    [ $# -gt 1 ] && echo "    ${YELLOW}${2}${RESET}"
    WARN=$((WARN + 1))
}

section() {
    echo
    echo "${BOLD}═══ $1 ═══${RESET}"
}

# ── Banner ──────────────────────────────────────────────────────────────────
cat <<EOF
${BOLD}
╔════════════════════════════════════════════════════════════╗
║  PAI v0.1.0 smoke test                                     ║
║  Verifies the live system boots correctly and services    ║
║  are healthy. No internet required.                        ║
╚════════════════════════════════════════════════════════════╝${RESET}

EOF

# ── 1. System ───────────────────────────────────────────────────────────────
section "System"

KERNEL=$(uname -r)
ARCH=$(uname -m)
RAM_GB=$(awk '/MemTotal/ {printf "%.1f", $2/1024/1024}' /proc/meminfo)
DISK_TMPFS=$(df -h /tmp 2>/dev/null | awk 'NR==2 {print $2}')

echo "  Kernel: $KERNEL"
echo "  Arch:   $ARCH"
echo "  RAM:    ${RAM_GB} GB"
echo "  /tmp:   $DISK_TMPFS (tmpfs)"

if [[ "$ARCH" == "x86_64" || "$ARCH" == "aarch64" ]]; then
    pass "Architecture is supported"
else
    fail "Unexpected architecture: $ARCH" "PAI supports x86_64 and aarch64"
fi

if systemctl is-system-running --quiet 2>/dev/null || systemctl is-system-running 2>/dev/null | grep -q -E "running|degraded"; then
    pass "systemd is operational"
else
    fail "systemd is not fully running" "Check systemctl list-units --failed"
fi

# ── 2. Services ─────────────────────────────────────────────────────────────
section "Services"

check_service() {
    local name=$1
    local required=${2:-true}
    if systemctl is-active --quiet "$name" 2>/dev/null; then
        pass "$name is active"
    else
        if [ "$required" = "true" ]; then
            local status
            status=$(systemctl is-active "$name" 2>&1 || true)
            fail "$name is NOT active" "Status: $status"
        else
            warn "$name is not active (optional)"
        fi
    fi
}

check_service "ollama"
check_service "open-webui"
check_service "NetworkManager" false
check_service "tor" false

# ── 3. Scripts and permissions ──────────────────────────────────────────────
section "Scripts (executable bit + presence)"

EXPECTED_SCRIPTS=(
    /usr/local/bin/pai-welcome
    /usr/local/bin/pai-shutdown
    /usr/local/bin/pai-settings
    /usr/local/bin/pai-privacy
    /usr/local/bin/pai-models
    /usr/local/bin/pai-memory-wipe
    /usr/local/bin/pai-mac-spoof
    /usr/local/bin/pai-profile-init
    /usr/local/bin/pai-waybar-ollama
    /usr/local/bin/pai-waybar-crypto
    /usr/local/bin/pai-waybar-privacy
)

for script in "${EXPECTED_SCRIPTS[@]}"; do
    if [ -f "$script" ]; then
        if [ -x "$script" ]; then
            pass "$(basename "$script") exists and is executable"
        else
            fail "$(basename "$script") is NOT executable" "chmod +x $script"
        fi
    else
        fail "$(basename "$script") is MISSING" "Expected at $script"
    fi
done

# ── 4. Config files ─────────────────────────────────────────────────────────
section "Config files"

check_file() {
    local path=$1
    if [ -f "$path" ]; then
        pass "$path exists"
    else
        fail "$path MISSING"
    fi
}

check_file "/etc/pai/open-webui.env"
check_file "/etc/sway/profile.d/active.conf"
check_file "/etc/skel/.config/sway/config"
check_file "/etc/skel/.config/waybar/config"
check_file "/etc/skel/.config/waybar/style.css"

# ── 5. AI stack ─────────────────────────────────────────────────────────────
section "AI stack"

if curl -fsS --max-time 3 http://localhost:11434/api/tags >/dev/null 2>&1; then
    pass "Ollama API responds on :11434"

    MODEL_JSON=$(curl -fsS --max-time 3 http://localhost:11434/api/tags 2>/dev/null)
    MODEL_COUNT=$(echo "$MODEL_JSON" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('models',[])))" 2>/dev/null || echo "0")

    if [ "$MODEL_COUNT" -gt 0 ]; then
        pass "Ollama has $MODEL_COUNT model(s) installed"
        if echo "$MODEL_JSON" | grep -q "llama3.2:1b"; then
            pass "Baked-in model llama3.2:1b is present"
        else
            warn "Baked-in model llama3.2:1b not found" "Available: $(echo "$MODEL_JSON" | python3 -c "import sys,json; print(', '.join(m['name'] for m in json.load(sys.stdin).get('models',[])))" 2>/dev/null)"
        fi
    else
        fail "Ollama has zero models installed" "Expected at least llama3.2:1b baked in"
    fi
else
    fail "Ollama API does NOT respond on :11434" "Check: systemctl status ollama && journalctl -u ollama -n 30"
fi

if curl -fsS --max-time 3 http://localhost:8080/ >/dev/null 2>&1; then
    pass "Open WebUI responds on :8080"
else
    fail "Open WebUI does NOT respond on :8080" "Check: systemctl status open-webui"
fi

# ── 6. Desktop ──────────────────────────────────────────────────────────────
section "Desktop"

if pgrep -x sway >/dev/null 2>&1; then
    pass "Sway is running"
else
    warn "Sway is not running" "Expected if this script runs before login"
fi

if pgrep -x waybar >/dev/null 2>&1; then
    pass "Waybar is running"
else
    warn "Waybar is not running"
fi

# Waybar custom scripts return valid JSON
for wscript in pai-waybar-ollama pai-waybar-privacy pai-waybar-crypto; do
    if command -v "$wscript" >/dev/null 2>&1; then
        OUTPUT=$("$wscript" 2>&1) || true
        if [ -n "$OUTPUT" ] && echo "$OUTPUT" | python3 -c "import sys,json; json.load(sys.stdin)" >/dev/null 2>&1; then
            pass "$wscript produces valid JSON"
        elif [ -z "$OUTPUT" ]; then
            # pai-waybar-privacy outputs empty when privacy mode is off
            if [ "$wscript" = "pai-waybar-privacy" ]; then
                pass "$wscript produces expected empty output (privacy mode off)"
            else
                fail "$wscript produces empty output"
            fi
        else
            fail "$wscript output is not valid JSON" "Got: $OUTPUT"
        fi
    fi
done

# ── 7. Network ──────────────────────────────────────────────────────────────
section "Network"

if command -v ufw >/dev/null 2>&1; then
    if ufw status 2>/dev/null | grep -qi "status: active"; then
        pass "UFW firewall is active"
    else
        warn "UFW firewall is NOT active" "ufw status shows inactive"
    fi
else
    warn "ufw command not found"
fi

if ip link show | grep -q "state UP"; then
    # Look at MAC address to verify spoofing (doesn't prove it, but checks format)
    MAC=$(ip link show | awk '/link\/ether/ {print $2; exit}')
    if [ -n "$MAC" ]; then
        pass "Network interface is up (MAC: $MAC)"
    fi
else
    warn "No network interface is up" "Expected if testing offline / no cable connected"
fi

# ── 8. Privacy tooling ──────────────────────────────────────────────────────
section "Privacy tooling"

for bin in tor torsocks macchanger cryptsetup gpg keepassxc; do
    if command -v "$bin" >/dev/null 2>&1; then
        pass "$bin is installed"
    else
        fail "$bin is NOT installed"
    fi
done

# ── 9. Baked-in model files (filesystem check) ──────────────────────────────
section "Baked-in model on filesystem"

if [ -d /usr/share/ollama/.ollama/models ]; then
    MODEL_SIZE=$(du -sh /usr/share/ollama/.ollama/models 2>/dev/null | awk '{print $1}')
    if [ -n "$MODEL_SIZE" ]; then
        pass "Model directory exists ($MODEL_SIZE on disk)"
    else
        fail "Model directory exists but appears empty"
    fi
else
    warn "Ollama system model dir not at /usr/share/ollama/.ollama/models" "May be stored elsewhere; check ollama list result above"
fi

# ── Summary ─────────────────────────────────────────────────────────────────
TOTAL=$((PASS + FAIL + WARN))
echo
echo "${BOLD}════════════════════════════════════════════════════════════${RESET}"
printf "  ${GREEN}%d passed${RESET}, ${RED}%d failed${RESET}, ${YELLOW}%d warnings${RESET} (%d total)\n" "$PASS" "$FAIL" "$WARN" "$TOTAL"
echo "${BOLD}════════════════════════════════════════════════════════════${RESET}"

if [ "$FAIL" -gt 0 ]; then
    echo
    echo "${RED}${BOLD}Failed tests:${RESET}"
    for t in "${FAILED_TESTS[@]}"; do
        echo "  - $t"
    done
    echo
    echo "For debugging:"
    echo "  journalctl -b -p err        # boot-time errors"
    echo "  systemctl list-units --failed"
    echo "  systemctl status ollama open-webui"
    exit 1
fi

echo
echo "${GREEN}${BOLD}All critical checks passed.${RESET} PAI is healthy."
exit 0
