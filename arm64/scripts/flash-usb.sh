#!/usr/bin/env bash
set -euo pipefail

# ── Flash PAI ISO to USB ──────────────────────────────────────────────
# Usage: sudo ./scripts/flash-usb.sh /dev/sdX
# ──────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ISO="$SCRIPT_DIR/pai.iso"

if [[ $# -lt 1 ]]; then
    echo "Usage: sudo $0 /dev/sdX"
    echo ""
    echo "Available USB drives:"
    lsblk -d -o NAME,SIZE,MODEL,TRAN | grep -E 'usb|removable' || lsblk -d -o NAME,SIZE,MODEL
    exit 1
fi

DEVICE="$1"

if [[ $EUID -ne 0 ]]; then
    echo "ERROR: Requires root. Run: sudo $0 $*"
    exit 1
fi

if [[ ! -f "$ISO" ]]; then
    echo "ERROR: $ISO not found. Run ./build.sh first."
    exit 1
fi

if [[ ! -b "$DEVICE" ]]; then
    echo "ERROR: $DEVICE is not a block device."
    exit 1
fi

# Safety check — don't flash to a mounted partition
if mount | grep -q "$DEVICE"; then
    echo "WARNING: $DEVICE appears to be mounted. Unmounting..."
    umount "${DEVICE}"* 2>/dev/null || true
fi

echo ""
echo "════════════════════════════════════════════"
echo "  Target: $DEVICE"
echo "  Source: $ISO ($(du -h "$ISO" | cut -f1))"
echo "════════════════════════════════════════════"
echo ""
echo "  THIS WILL ERASE ALL DATA ON $DEVICE"
echo ""
read -rp "  Type YES to continue: " CONFIRM

if [[ "$CONFIRM" != "YES" ]]; then
    echo "Aborted."
    exit 0
fi

echo "Flashing..."
dd if="$ISO" of="$DEVICE" bs=4M status=progress oflag=sync

echo ""
echo "Done. You can now boot from $DEVICE."
sync
