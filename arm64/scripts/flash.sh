#!/usr/bin/env bash
# PAI Auto-Flasher — Download and flash PAI ISO to a USB drive
# Usage: curl -fsSL https://raw.githubusercontent.com/nirholas/pai/main/scripts/flash.sh | sudo bash
set -euo pipefail

RELEASE_URL="https://github.com/nirholas/pai/releases/latest/download/pai.iso"
ISO_NAME="pai.iso"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

die() { echo -e "${RED}Error: $1${NC}" >&2; exit 1; }
info() { echo -e "${CYAN}$1${NC}"; }
warn() { echo -e "${YELLOW}$1${NC}"; }
success() { echo -e "${GREEN}$1${NC}"; }

# --- Root check ---
if [[ $EUID -ne 0 ]]; then
    die "This script must be run as root. Use: sudo bash $0"
fi

echo -e "${BOLD}"
echo "╔═══════════════════════════════════════╗"
echo "║       PAI — PAI Flasher         ║"
echo "║   Private AI on a bootable USB drive  ║"
echo "╚═══════════════════════════════════════╝"
echo -e "${NC}"

# --- Detect OS ---
OS="$(uname -s)"
case "$OS" in
    Linux)  info "Detected OS: Linux" ;;
    Darwin) info "Detected OS: macOS" ;;
    *)      die "Unsupported OS: $OS. Use Linux or macOS." ;;
esac

# --- List USB drives ---
info "\nScanning for USB drives...\n"

declare -a DEVICES=()
declare -a DEVICE_INFO=()

if [[ "$OS" == "Linux" ]]; then
    while IFS= read -r line; do
        dev=$(echo "$line" | awk '{print $1}')
        size=$(echo "$line" | awk '{print $2}')
        model=$(echo "$line" | awk '{$1=$2=$3=""; print $0}' | xargs)
        if [[ -n "$dev" ]]; then
            DEVICES+=("/dev/$dev")
            DEVICE_INFO+=("$dev  ${size}  ${model}")
        fi
    done < <(lsblk -d -n -o NAME,SIZE,TRAN,MODEL | grep 'usb' | awk '{print $1, $2, $4, $5, $6, $7}')
elif [[ "$OS" == "Darwin" ]]; then
    while IFS= read -r line; do
        dev=$(echo "$line" | awk '{print $1}')
        if diskutil info "$dev" 2>/dev/null | grep -q "Removable Media.*Yes"; then
            size=$(diskutil info "$dev" | grep "Disk Size" | awk -F'(' '{print $1}' | awk '{print $3, $4}')
            model=$(diskutil info "$dev" | grep "Device / Media Name" | cut -d: -f2 | xargs)
            DEVICES+=("$dev")
            DEVICE_INFO+=("$dev  ${size}  ${model}")
        fi
    done < <(diskutil list | grep '^/dev/disk' | awk '{print $1}')
fi

if [[ ${#DEVICES[@]} -eq 0 ]]; then
    die "No USB drives found. Plug in a USB drive and try again."
fi

echo -e "${BOLD}Found USB drives:${NC}\n"
for i in "${!DEVICE_INFO[@]}"; do
    echo -e "  ${BOLD}[$((i+1))]${NC} ${DEVICE_INFO[$i]}"
done

# --- Select drive ---
echo ""
read -rp "Select drive number to flash [1-${#DEVICES[@]}]: " choice

if ! [[ "$choice" =~ ^[0-9]+$ ]] || [[ "$choice" -lt 1 ]] || [[ "$choice" -gt ${#DEVICES[@]} ]]; then
    die "Invalid selection: $choice"
fi

TARGET="${DEVICES[$((choice-1))]}"
TARGET_INFO="${DEVICE_INFO[$((choice-1))]}"

# --- macOS: use raw disk for speed ---
if [[ "$OS" == "Darwin" ]]; then
    RAW_TARGET="${TARGET/disk/rdisk}"
else
    RAW_TARGET="$TARGET"
fi

# --- Confirm ---
echo ""
warn "╔══════════════════════════════════════════════════╗"
warn "║  WARNING: ALL DATA ON THIS DEVICE WILL BE LOST  ║"
warn "╚══════════════════════════════════════════════════╝"
echo ""
echo -e "  Target: ${RED}${BOLD}${TARGET_INFO}${NC}"
echo ""
read -rp "Type 'YES' to confirm: " confirm

if [[ "$confirm" != "YES" ]]; then
    echo "Aborted."
    exit 0
fi

# --- Unmount ---
info "\nUnmounting $TARGET..."
if [[ "$OS" == "Linux" ]]; then
    umount "${TARGET}"* 2>/dev/null || true
elif [[ "$OS" == "Darwin" ]]; then
    diskutil unmountDisk "$TARGET" 2>/dev/null || true
fi

# --- Download and flash ---
info "\nDownloading PAI ISO and flashing to $TARGET..."
info "Source: $RELEASE_URL\n"

if command -v curl &>/dev/null; then
    curl -L --progress-bar "$RELEASE_URL" | dd of="$RAW_TARGET" bs=4M 2>&1
elif command -v wget &>/dev/null; then
    wget -q --show-progress -O - "$RELEASE_URL" | dd of="$RAW_TARGET" bs=4M 2>&1
else
    die "Neither curl nor wget found. Install one and try again."
fi

# --- Sync ---
info "\nSyncing..."
sync

# --- Done ---
echo ""
success "╔═══════════════════════════════════════╗"
success "║         PAI flashed successfully!     ║"
success "╚═══════════════════════════════════════╝"
echo ""
info "Next steps:"
echo "  1. Remove the USB drive"
echo "  2. Plug it into the target machine"
echo "  3. Boot from USB (usually F12/F2/DEL at startup)"
echo "  4. PAI will auto-login → Sway → Firefox → Chat UI"
echo ""
