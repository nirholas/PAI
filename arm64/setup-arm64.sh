#!/usr/bin/env bash
set -euo pipefail

# ── PAI ARM64 Setup Script ──────────────────────────────────────────
# Copies unchanged files from the original pai (amd64) and
# creates the ARM64-specific files.
#
# Usage: bash setup-arm64.sh
# ────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Resolve paths relative to script location so it works from any checkout.
SRC="$(cd "$SCRIPT_DIR/.." && pwd)"
DST="$SCRIPT_DIR"

echo "═══════════════════════════════════════════════"
echo "  PAI ARM64 Setup — Copying from amd64 source"
echo "═══════════════════════════════════════════════"

# ── Copy unchanged hooks ──────────────────────────────────────────
echo "[setup] Copying architecture-independent hooks..."
mkdir -p "$DST/config/hooks/live"

for hook in \
    0200-install-open-webui.hook.chroot \
    0300-configure-desktop.hook.chroot \
    0350-auto-login.hook.chroot \
    0400-plymouth-theme.hook.chroot \
    0450-mac-spoof.hook.chroot \
    0500-firewall.hook.chroot \
    0550-tor-config.hook.chroot \
    0600-configure-electrum.hook.chroot \
    0650-install-ai-tools.hook.chroot \
    0740-configure-terminal.hook.chroot \
    0750-configure-media.hook.chroot \
    0800-configure-networking-privacy.hook.chroot \
    0830-configure-encryption-privacy.hook.chroot \
    0840-configure-utilities.hook.chroot; do
    cp "$SRC/config/hooks/live/$hook" "$DST/config/hooks/live/$hook"
    echo "  ✓ $hook"
done

# ── Copy includes.chroot_after_packages (all architecture-independent) ──
echo "[setup] Copying static files (includes.chroot_after_packages)..."
cp -r "$SRC/config/includes.chroot_after_packages" "$DST/config/"

# ── Copy scripts ──────────────────────────────────────────────────
echo "[setup] Copying scripts..."
mkdir -p "$DST/scripts"
cp "$SRC/scripts/flash.sh" "$DST/scripts/"
cp "$SRC/scripts/flash-usb.sh" "$DST/scripts/"

# ── Copy docs ─────────────────────────────────────────────────────
echo "[setup] Copying docs..."
cp -r "$SRC/docs" "$DST/"

# ── Copy LICENSE ──────────────────────────────────────────────────
cp "$SRC/LICENSE" "$DST/" 2>/dev/null || true

# ── Make everything executable ────────────────────────────────────
chmod +x "$DST/build.sh"
chmod +x "$DST/config/hooks/live/"*.hook.chroot
chmod +x "$DST/scripts/"*.sh
find "$DST/config/includes.chroot_after_packages/usr/local/bin/" -type f -exec chmod +x {} + 2>/dev/null || true

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✓ ARM64 setup complete!"
echo ""
echo "  ARM64-specific files already in place:"
echo "    - Dockerfile.build (grub-efi-arm64-bin)"
echo "    - build.sh (--architectures arm64)"
echo "    - config/package-lists/pai.list.chroot (linux-image-arm64)"
echo "    - config/hooks/live/0100-install-ollama.hook.chroot (arm64 binary)"
echo "    - config/hooks/live/0610-install-monero-wallet.hook.chroot (arm64 check)"
echo "    - config/hooks/live/0710-install-dev-languages.hook.chroot (arm64 URLs)"
echo "    - config/hooks/live/0730-install-git-tools.hook.chroot (arm64 URLs)"
echo ""
echo "  To build: cd $DST && docker build -t pai-arm64 -f Dockerfile.build ."
echo "            docker run --privileged -v \$(pwd)/output:/pai/output pai-arm64"
echo "═══════════════════════════════════════════════"
