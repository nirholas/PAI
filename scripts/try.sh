#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# PAI — Try Private AI in a VM (Linux / macOS)
# Usage: curl -fsSL https://pai.direct/try | bash
#
# Downloads the latest PAI ISO, verifies SHA256, and launches it in QEMU
# with hardware-accelerated virtualization. No changes to your host OS.
#
# Examples:
#   bash scripts/try.sh                         # Default: 8 GiB RAM, 4 vCPUs
#   bash scripts/try.sh --ram 16384 --cpus 8    # More resources
#   bash scripts/try.sh --keep                  # Keep ISO after exit
#   bash scripts/try.sh --port 9090             # Forward to a different port
#   bash scripts/try.sh --headless              # No GUI, VNC access only
#   bash scripts/try.sh --no-kvm                # Force TCG (slow, for debugging)
#
# Exit codes:
#   0 — success
#   1 — user/validation error
#   2 — download/verify error
#   3 — QEMU launch error
#   4 — user cancelled at install prompt
set -euo pipefail

# ─── Constants ────────────────────────────────────────────────────────────────
readonly GITHUB_API="https://api.github.com/repos/nirholas/pai/releases/latest"
readonly QMP_SOCK="/tmp/pai-try-qmp.sock"
readonly MIN_RAM_MB=4096
readonly VERSION="1.0.0"

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ─── Helpers ──────────────────────────────────────────────────────────────────
die()     { echo -e "${RED}Error: $1${NC}" >&2; exit "${2:-1}"; }
info()    { echo -e "${CYAN}$1${NC}"; }
warn()    { echo -e "${YELLOW}$1${NC}"; }
success() { echo -e "${GREEN}$1${NC}"; }

usage() {
    cat <<'EOF'
PAI — Try Private AI in a VM

Usage: try.sh [OPTIONS]

Options:
  --iso-url <url>       Override ISO download URL (requires --sha256)
  --sha256 <hex>        Expected SHA256 hash (required with --iso-url)
  --ram <MB>            VM memory in MiB (default: 8192, minimum: 4096)
  --cpus <n>            Number of vCPUs (default: min(4, nproc/2))
  --port <N>            Host port forwarded to Open WebUI (default: 8080)
  --keep                Preserve cached ISO after exit
  --no-kvm              Force TCG on Linux (skip KVM)
  --no-hvf              Force TCG on macOS (skip HVF)
  --headless            No display window; prints VNC URL
  --force-low-ram       Allow RAM below 4 GiB (not recommended)
  --help                Show this help message
  --version             Show version

Examples:
  curl -fsSL https://pai.direct/try | bash
  bash scripts/try.sh --ram 16384 --cpus 8
  bash scripts/try.sh --keep --port 9090

Exit codes:
  0 — success
  1 — user/validation error
  2 — download/verify error
  3 — QEMU launch error
  4 — user cancelled
EOF
    exit 0
}

# ─── Defaults ─────────────────────────────────────────────────────────────────
OPT_ISO_URL=""
OPT_SHA256=""
OPT_RAM=8192
OPT_CPUS=""
OPT_PORT=8080
OPT_KEEP=false
OPT_NO_ACCEL=false
OPT_HEADLESS=false
OPT_FORCE_LOW_RAM=false

# ─── Argument parsing ─────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --iso-url)    OPT_ISO_URL="$2"; shift 2 ;;
        --sha256)     OPT_SHA256="$2"; shift 2 ;;
        --ram)        OPT_RAM="$2"; shift 2 ;;
        --cpus)       OPT_CPUS="$2"; shift 2 ;;
        --port)       OPT_PORT="$2"; shift 2 ;;
        --keep)       OPT_KEEP=true; shift ;;
        --no-kvm|--no-hvf|--no-whpx) OPT_NO_ACCEL=true; shift ;;
        --headless)   OPT_HEADLESS=true; shift ;;
        --force-low-ram) OPT_FORCE_LOW_RAM=true; shift ;;
        --help|-h)    usage ;;
        --version)    echo "try.sh $VERSION"; exit 0 ;;
        *)            die "Unknown option: $1" 1 ;;
    esac
done

# ─── Validate parameters ─────────────────────────────────────────────────────
if [[ -n "$OPT_ISO_URL" && -z "$OPT_SHA256" ]]; then
    die "--sha256 is required when --iso-url is specified" 1
fi

if ! [[ "$OPT_RAM" =~ ^[0-9]+$ ]]; then
    die "--ram must be a positive integer (MiB)" 1
fi

if [[ "$OPT_RAM" -lt "$MIN_RAM_MB" && "$OPT_FORCE_LOW_RAM" != true ]]; then
    die "4 GiB minimum recommended for Ollama; pass --force-low-ram to override" 1
fi

if ! [[ "$OPT_PORT" =~ ^[0-9]+$ ]] || [[ "$OPT_PORT" -lt 1 || "$OPT_PORT" -gt 65535 ]]; then
    die "--port must be between 1 and 65535" 1
fi

# ─── Detect OS and architecture ──────────────────────────────────────────────
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$ARCH" in
    x86_64|amd64)
        ARCH="amd64"
        QEMU_BIN="qemu-system-x86_64"
        ;;
    aarch64|arm64)
        die "ARM64 support for try.sh is not yet available.\nFor Raspberry Pi, use the RPi Imager path:\n  https://github.com/nirholas/pai/tree/main/arm64" 1
        ;;
    *)
        die "Unsupported architecture: $ARCH" 1
        ;;
esac

case "$OS" in
    Linux)  PLATFORM="linux" ;;
    Darwin) PLATFORM="macos" ;;
    *)      die "Unsupported OS: $OS. Use Linux or macOS." 1 ;;
esac

# ─── Compute CPU count ────────────────────────────────────────────────────────
if [[ -z "$OPT_CPUS" ]]; then
    if [[ "$PLATFORM" == "linux" ]]; then
        NPROC=$(nproc 2>/dev/null || echo 4)
    else
        NPROC=$(sysctl -n hw.ncpu 2>/dev/null || echo 4)
    fi
    HALF_PROCS=$((NPROC / 2))
    OPT_CPUS=$((HALF_PROCS < 4 ? HALF_PROCS : 4))
    [[ "$OPT_CPUS" -lt 1 ]] && OPT_CPUS=1
fi

if ! [[ "$OPT_CPUS" =~ ^[0-9]+$ ]] || [[ "$OPT_CPUS" -lt 1 ]]; then
    die "--cpus must be a positive integer" 1
fi

# ─── Cache directory ──────────────────────────────────────────────────────────
if [[ "$PLATFORM" == "linux" ]]; then
    CACHE_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/pai"
elif [[ "$PLATFORM" == "macos" ]]; then
    CACHE_DIR="$HOME/Library/Caches/pai"
fi
mkdir -p "$CACHE_DIR"

# ─── Banner ───────────────────────────────────────────────────────────────────
echo -e "${BOLD}"
echo "╔════════════════════════════════════════════╗"
echo "║       PAI — Try Private AI in a VM        ║"
echo "║  No USB, no reboot, no changes to your OS ║"
echo "╚════════════════════════════════════════════╝"
echo -e "${NC}"

# ─── Resolve ISO URL and SHA256 ───────────────────────────────────────────────
if [[ -z "$OPT_ISO_URL" ]]; then
    info "Fetching latest release info from GitHub..."
    RELEASE_JSON=$(curl -fsSL "$GITHUB_API" 2>/dev/null) || die "Failed to fetch release info from GitHub API" 2

    if command -v jq &>/dev/null; then
        # Preferred: robust JSON parsing with jq
        OPT_ISO_URL=$(echo "$RELEASE_JSON" | jq -r '[.assets[] | select(.name | test("amd64.*\\.iso$"))] | first | .browser_download_url // empty')
        if [[ -z "$OPT_ISO_URL" ]]; then
            OPT_ISO_URL=$(echo "$RELEASE_JSON" | jq -r '[.assets[] | select(.name | test("\\.iso$"))] | first | .browser_download_url // empty')
        fi
        SHA256SUMS_URL=$(echo "$RELEASE_JSON" | jq -r '[.assets[] | select(.name == "SHA256SUMS")] | first | .browser_download_url // empty')
    else
        # Fallback: grep/sed (works without jq but fragile with unusual filenames)
        OPT_ISO_URL=$(echo "$RELEASE_JSON" | grep -o '"browser_download_url"[[:space:]]*:[[:space:]]*"[^"]*amd64[^"]*\.iso"' | head -1 | sed 's/.*"browser_download_url"[[:space:]]*:[[:space:]]*"//;s/"$//')
        if [[ -z "$OPT_ISO_URL" ]]; then
            OPT_ISO_URL=$(echo "$RELEASE_JSON" | grep -o '"browser_download_url"[[:space:]]*:[[:space:]]*"[^"]*\.iso"' | head -1 | sed 's/.*"browser_download_url"[[:space:]]*:[[:space:]]*"//;s/"$//')
        fi
        SHA256SUMS_URL=$(echo "$RELEASE_JSON" | grep -o '"browser_download_url"[[:space:]]*:[[:space:]]*"[^"]*SHA256SUMS"' | head -1 | sed 's/.*"browser_download_url"[[:space:]]*:[[:space:]]*"//;s/"$//')
    fi

    if [[ -z "$OPT_ISO_URL" ]]; then
        die "No ISO asset found in the latest release" 2
    fi

    if [[ -n "$SHA256SUMS_URL" ]]; then
        SHA256SUMS_CONTENT=$(curl -fsSL "$SHA256SUMS_URL" 2>/dev/null) || die "Failed to download SHA256SUMS" 2
        ISO_FILENAME=$(basename "$OPT_ISO_URL")
        OPT_SHA256=$(echo "$SHA256SUMS_CONTENT" | grep -F "$ISO_FILENAME" | awk '{print $1}')
    fi

    if [[ -z "$OPT_SHA256" ]]; then
        die "Could not find SHA256 hash for the ISO" 2
    fi
fi

ISO_FILENAME=$(basename "$OPT_ISO_URL")
ISO_PATH="$CACHE_DIR/$ISO_FILENAME"

info "ISO: $ISO_FILENAME"
info "SHA256: $OPT_SHA256"

# ─── Check cache ─────────────────────────────────────────────────────────────
NEED_DOWNLOAD=true
if [[ -f "$ISO_PATH" ]]; then
    info "Found cached ISO at $ISO_PATH — verifying..."
    if [[ "$PLATFORM" == "linux" ]]; then
        CACHED_SHA=$(sha256sum "$ISO_PATH" | awk '{print $1}')
    else
        CACHED_SHA=$(shasum -a 256 "$ISO_PATH" | awk '{print $1}')
    fi

    if [[ "$CACHED_SHA" == "$OPT_SHA256" ]]; then
        success "Cache hit — SHA256 verified."
        NEED_DOWNLOAD=false
    else
        warn "Cached ISO SHA256 mismatch — re-downloading."
        rm -f "$ISO_PATH"
    fi
fi

# ─── Download ISO ─────────────────────────────────────────────────────────────
if [[ "$NEED_DOWNLOAD" == true ]]; then
    info "Downloading PAI ISO..."
    if ! curl --progress-bar -fL -o "$ISO_PATH" "$OPT_ISO_URL"; then
        rm -f "$ISO_PATH"
        die "Download failed. Check your network connection and retry." 2
    fi

    # Verify SHA256
    info "Verifying SHA256..."
    if [[ "$PLATFORM" == "linux" ]]; then
        DL_SHA=$(sha256sum "$ISO_PATH" | awk '{print $1}')
    else
        DL_SHA=$(shasum -a 256 "$ISO_PATH" | awk '{print $1}')
    fi

    if [[ "$DL_SHA" != "$OPT_SHA256" ]]; then
        rm -f "$ISO_PATH"
        die "Download corrupted — SHA256 mismatch. Please retry." 2
    fi
    success "SHA256 verified."
fi

# ─── Check / Install QEMU ────────────────────────────────────────────────────
install_qemu_linux() {
    if [[ ! -f /etc/os-release ]]; then
        die "Cannot detect Linux distribution. Please install QEMU manually:\n  sudo apt-get install qemu-system-x86 qemu-utils" 1
    fi

    # shellcheck source=/dev/null
    source /etc/os-release
    local distro_id="${ID:-unknown}"

    local -a cmd=()
    local cmd_display=""
    case "$distro_id" in
        debian|ubuntu|linuxmint|pop)
            cmd=(sudo apt-get install -y qemu-system-x86 qemu-utils ovmf)
            ;;
        fedora|rhel|centos|rocky|alma)
            cmd=(sudo dnf install -y qemu-kvm qemu-system-x86 edk2-ovmf)
            ;;
        arch|manjaro|endeavouros)
            cmd=(sudo pacman -S --noconfirm qemu-full edk2-ovmf)
            ;;
        opensuse*|sles)
            cmd=(sudo zypper install -y qemu-x86 qemu-tools ovmf)
            ;;
        *)
            die "Unsupported distro '$distro_id'. Please install qemu-system-x86 manually." 1
            ;;
    esac
    cmd_display="${cmd[*]}"

    echo ""
    warn "QEMU is not installed. PAI needs it to run the VM."
    echo -e "Install command: ${BOLD}${cmd_display}${NC}"
    echo ""
    read -rp "Install QEMU now? [Y/n] " answer
    case "${answer:-Y}" in
        [Yy]|[Yy]es|"") ;;
        *) die "QEMU installation cancelled." 4 ;;
    esac

    "${cmd[@]}" || die "QEMU installation failed." 3
}

install_qemu_macos() {
    local brew_bin=""
    if [[ -x /opt/homebrew/bin/brew ]]; then
        brew_bin="/opt/homebrew/bin/brew"
    elif [[ -x /usr/local/bin/brew ]]; then
        brew_bin="/usr/local/bin/brew"
    fi

    if [[ -z "$brew_bin" ]]; then
        die "Homebrew is required to install QEMU on macOS.\nInstall it first: https://brew.sh" 1
    fi

    echo ""
    warn "QEMU is not installed. PAI needs it to run the VM."
    echo -e "Install command: ${BOLD}brew install qemu${NC}"
    echo ""
    read -rp "Install QEMU now? [Y/n] " answer
    case "${answer:-Y}" in
        [Yy]|[Yy]es|"") ;;
        *) die "QEMU installation cancelled." 4 ;;
    esac

    "$brew_bin" install qemu || die "QEMU installation failed." 3
}

if ! command -v "$QEMU_BIN" &>/dev/null; then
    if [[ "$PLATFORM" == "linux" ]]; then
        install_qemu_linux
    else
        install_qemu_macos
    fi

    # Re-check after install
    if ! command -v "$QEMU_BIN" &>/dev/null; then
        die "QEMU still not found after install. Check your PATH." 3
    fi
fi

# ─── Verify QEMU version ─────────────────────────────────────────────────────
QEMU_VERSION_OUTPUT=$("$QEMU_BIN" --version 2>/dev/null || true)
if ! echo "$QEMU_VERSION_OUTPUT" | grep -q "^QEMU emulator version"; then
    die "Unexpected QEMU output. Is '$QEMU_BIN' a valid QEMU binary?" 3
fi

QEMU_VERSION=$(echo "$QEMU_VERSION_OUTPUT" | head -1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
QEMU_MAJOR=$(echo "$QEMU_VERSION" | cut -d. -f1)
if [[ "$QEMU_MAJOR" -lt 6 ]]; then
    warn "QEMU version $QEMU_VERSION detected (< 6.0). Some features may not work correctly."
fi

# ─── Acceleration setup ───────────────────────────────────────────────────────
ACCEL_ARGS=()
ACCEL_NAME="TCG (no acceleration)"

if [[ "$OPT_NO_ACCEL" == true ]]; then
    warn "Hardware acceleration disabled by user. VM will be slow."
    ACCEL_ARGS=(-accel tcg)
elif [[ "$PLATFORM" == "linux" ]]; then
    # Check KVM
    if [[ -e /dev/kvm ]]; then
        if [[ -w /dev/kvm ]]; then
            ACCEL_ARGS=(-accel kvm)
            ACCEL_NAME="KVM"
        else
            echo ""
            warn "KVM is available but /dev/kvm is not writable by your user."
            warn "Add yourself to the kvm group:"
            echo -e "  ${BOLD}sudo usermod -aG kvm \$USER && newgrp kvm${NC}"
            echo ""
            die "Cannot use KVM without group membership. Fix above or pass --no-kvm for slow TCG mode." 3
        fi
    else
        warn "KVM not available (/dev/kvm missing). Falling back to TCG — VM will be very slow (10×+ slower)."
        ACCEL_ARGS=(-accel tcg)
    fi
elif [[ "$PLATFORM" == "macos" ]]; then
    # HVF is available on modern macOS with signed QEMU
    if sysctl -n kern.hv_support 2>/dev/null | grep -q "1"; then
        ACCEL_ARGS=(-accel hvf)
        ACCEL_NAME="HVF"
    else
        warn "Hypervisor.framework not available. Falling back to TCG — VM will be very slow."
        warn "If SIP is disabled or you're on an old macOS, HVF may not work."
        ACCEL_ARGS=(-accel tcg)
    fi
fi

info "Acceleration: $ACCEL_NAME"

# ─── Display setup ────────────────────────────────────────────────────────────
DISPLAY_ARGS=()
if [[ "$OPT_HEADLESS" == true ]]; then
    DISPLAY_ARGS=(-display none -vnc :0)
else
    if [[ "$PLATFORM" == "linux" ]]; then
        DISPLAY_ARGS=(-display "gtk,show-cursor=on")
    elif [[ "$PLATFORM" == "macos" ]]; then
        DISPLAY_ARGS=(-display "cocoa,show-cursor=on")
    fi
fi

# ─── Build QEMU command ──────────────────────────────────────────────────────
QEMU_CMD=(
    "$QEMU_BIN"
    "${ACCEL_ARGS[@]}"
    "-cpu" "host"
    "-smp" "$OPT_CPUS"
    "-m" "${OPT_RAM}M"
    "-cdrom" "$ISO_PATH"
    "-boot" "d"
    "-nic" "user,model=virtio-net-pci,hostfwd=tcp::${OPT_PORT}-:8080"
    "-usb" "-device" "usb-tablet"
    "-audiodev" "none,id=noaudio"
    "${DISPLAY_ARGS[@]}"
    "-qmp" "unix:${QMP_SOCK},server,nowait"
)

# ─── Cleanup ──────────────────────────────────────────────────────────────────
QEMU_PID=""

cleanup() {
    # Send QMP quit if socket exists
    if [[ -S "$QMP_SOCK" ]]; then
        # QMP requires a capabilities negotiation then quit
        (echo '{"execute":"qmp_capabilities"}'; sleep 0.2; echo '{"execute":"quit"}') | \
            socat - "UNIX-CONNECT:${QMP_SOCK}" 2>/dev/null || true
    fi

    # Wait briefly for QEMU to exit
    if [[ -n "$QEMU_PID" ]] && kill -0 "$QEMU_PID" 2>/dev/null; then
        local i=0
        while kill -0 "$QEMU_PID" 2>/dev/null && [[ $i -lt 10 ]]; do
            sleep 0.3
            i=$((i + 1))
        done
        # Force kill if still running
        if kill -0 "$QEMU_PID" 2>/dev/null; then
            kill -9 "$QEMU_PID" 2>/dev/null || true
        fi
    fi

    rm -f "$QMP_SOCK"

    echo ""
    if [[ "$OPT_KEEP" == true ]]; then
        info "ISO preserved at: $ISO_PATH"
    else
        rm -f "$ISO_PATH"
        # Remove cache dir if empty
        rmdir "$CACHE_DIR" 2>/dev/null || true
        info "Cached ISO removed."
    fi

    echo ""
    success "Goodbye. Flash a real USB any time with:"
    if [[ "$PLATFORM" == "linux" ]]; then
        echo "  curl -fsSL https://pai.direct/flash | sudo bash"
    else
        echo "  curl -fsSL https://pai.direct/flash | bash"
    fi
}

trap cleanup EXIT INT TERM

# ─── Launch QEMU ─────────────────────────────────────────────────────────────
info "Launching PAI VM (${OPT_RAM} MiB RAM, ${OPT_CPUS} vCPUs)..."
echo ""

"${QEMU_CMD[@]}" &
QEMU_PID=$!

echo ""
echo -e "► PAI is booting in a VM window."
echo -e "► In about 30 seconds, open ${BOLD}http://localhost:${OPT_PORT}${NC} in your browser to"
echo -e "  access Open WebUI. (The same URL works from inside the VM too.)"
echo -e "► Close the VM window or press Ctrl+C in this terminal to quit."
echo -e "► Nothing is written to your host. The ISO is cached at:"
echo -e "  ${CYAN}${ISO_PATH}${NC}"
if [[ "$OPT_KEEP" != true ]]; then
    echo -e "  (pass --keep to preserve it)"
fi

if [[ "$OPT_HEADLESS" == true ]]; then
    echo ""
    info "Headless mode — connect via VNC at localhost:5900"
fi

# Wait for QEMU to exit
wait "$QEMU_PID" 2>/dev/null || true
QEMU_PID=""
