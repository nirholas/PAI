#!/usr/bin/env bash
set -euo pipefail

# ── PAI Desktop Edition — Build Script ───────────────────────────────
# Assembles the live-build config from shared/ + desktop/ components,
# then builds the ISO.
#
# Run via Docker:
#   docker build -f desktop/Dockerfile.build -t pai-desktop .
#   docker run --privileged -v "$PWD/output:/pai/output" pai-desktop
# ──────────────────────────────────────────────────────────────────────

echo "═══════════════════════════════════════════════"
echo "  PAI Desktop Edition — ISO Build"
echo "═══════════════════════════════════════════════"

echo "[pai-desktop] Cleaning previous build..."
lb clean --purge 2>/dev/null || true

# ── Assemble hooks from shared/ + desktop/
echo "[pai-desktop] Assembling build config..."
mkdir -p config/hooks/live
mkdir -p config/package-lists
mkdir -p config/includes.chroot_after_packages

# Copy shared hooks
if [ -d "shared/hooks/live" ]; then
    cp shared/hooks/live/*.hook.chroot config/hooks/live/
    echo "[pai-desktop] ✓ Shared hooks copied"
fi

# Copy desktop-specific hooks (overrides shared if same name)
if [ -d "desktop/config/hooks/live" ]; then
    cp desktop/config/hooks/live/*.hook.chroot config/hooks/live/
    echo "[pai-desktop] ✓ Desktop hooks copied"
fi

# Copy shared package list
if [ -d "shared/package-lists" ]; then
    cp shared/package-lists/*.list.chroot config/package-lists/
    echo "[pai-desktop] ✓ Shared package list copied"
fi

# Copy desktop package list
if [ -d "desktop/config/package-lists" ]; then
    cp desktop/config/package-lists/*.list.chroot config/package-lists/
    echo "[pai-desktop] ✓ Desktop package list copied"
fi

# Copy shared includes
if [ -d "shared/includes" ]; then
    cp -r shared/includes/* config/includes.chroot_after_packages/
    echo "[pai-desktop] ✓ Shared includes copied"
fi

# Copy desktop includes
if [ -d "desktop/config/includes.chroot_after_packages" ]; then
    cp -r desktop/config/includes.chroot_after_packages/* config/includes.chroot_after_packages/
    echo "[pai-desktop] ✓ Desktop includes copied"
fi

# List assembled hooks
echo ""
echo "[pai-desktop] Assembled hooks:"
ls -1 config/hooks/live/
echo ""

# ── Configure live-build
lb config \
    --mode debian \
    --distribution bookworm \
    --parent-mirror-bootstrap http://deb.debian.org/debian \
    --parent-mirror-chroot-security http://deb.debian.org/debian-security \
    --mirror-bootstrap http://deb.debian.org/debian \
    --mirror-chroot-security http://deb.debian.org/debian-security \
    --archive-areas "main contrib non-free non-free-firmware" \
    --bootappend-live "boot=live components splash locales=en_US.UTF-8 keyboard-layouts=us" \
    --architectures amd64 \
    --binary-images iso-hybrid \
    --memtest none \
    --apt-indices false \
    --apt-secure false \
    --cache false \
    --iso-application "PAI Desktop Edition" \
    --iso-publisher "PAI" \
    --iso-volume "PAI-DESKTOP"

echo ""
echo "════════════════════════════════════════════"
echo "  Building PAI Desktop Edition live ISO..."
echo "════════════════════════════════════════════"
echo ""

lb bootstrap

echo "[pai-desktop] Cleaning chroot apt lists..."
rm -rf chroot/var/lib/apt/lists/*
mkdir -p chroot/var/lib/apt/lists/partial

lb chroot

echo "[pai-desktop] Freeing disk space before binary stage..."
rm -rf chroot/var/cache/apt/archives/*.deb
rm -rf chroot/var/cache/apt/archives/partial/*
rm -rf chroot/var/lib/apt/lists/*
mkdir -p chroot/var/lib/apt/lists/partial
rm -rf chroot/usr/share/doc/*
rm -rf chroot/usr/share/man/*
rm -rf chroot/usr/share/info/*
find chroot/usr/share/locale/ -maxdepth 1 -mindepth 1 -type d ! -name 'en' ! -name 'en_US' -exec rm -rf {} + 2>/dev/null || true
find chroot/usr/share/i18n/locales/ -maxdepth 1 -mindepth 1 ! -name 'en_US' ! -name 'POSIX' -exec rm -rf {} + 2>/dev/null || true
rm -rf chroot/tmp/*
rm -rf chroot/var/tmp/*
rm -rf chroot/root/.cache/*
rm -rf cache/packages.chroot/ cache/packages.binary/ cache/contents.chroot/
rm -rf chroot/opt/whisper.cpp/.git chroot/opt/whisper.cpp/samples chroot/opt/whisper.cpp/tests
rm -rf chroot/usr/lib/firmware/nvidia/
rm -rf chroot/usr/local/lib/ollama/cuda_v12/
rm -rf chroot/usr/local/lib/ollama/cuda_v13/
rm -rf chroot/usr/local/lib/ollama/mlx_cuda_v13/
rm -rf chroot/usr/local/lib/ollama/vulkan/
rm -rf chroot/usr/local/lib/ollama/rocm/
rm -rf chroot/opt/cargo/registry/cache/*
rm -rf chroot/root/.rustup/tmp/*

lb binary

echo ""
echo "═══════════════════════════════════════════════"
echo "  ✓ PAI Desktop Edition ISO built!"
echo "═══════════════════════════════════════════════"

# Copy output
mkdir -p output
cp -v .build/*.iso output/ 2>/dev/null || cp -v *.iso output/ 2>/dev/null || true
ls -lh output/
