#!/usr/bin/env bash
set -euo pipefail

# ── PAI Web Edition — Build Script ───────────────────────────────────
# Assembles the live-build config from shared/ + web/ components,
# then builds the ISO.
#
# Run via Docker:
#   docker build -f web/Dockerfile.build -t pai-web .
#   docker run --privileged -v "$PWD/output:/pai/output" pai-web
# ──────────────────────────────────────────────────────────────────────

echo "═══════════════════════════════════════════════"
echo "  PAI Web Edition — ISO Build"
echo "═══════════════════════════════════════════════"

echo "[pai-web] Cleaning previous build..."
lb clean --purge 2>/dev/null || true

# ── Assemble hooks from shared/ + web/
echo "[pai-web] Assembling build config..."
mkdir -p config/hooks/live
mkdir -p config/package-lists
mkdir -p config/includes.chroot_after_packages

# Copy shared hooks
if [ -d "shared/hooks/live" ]; then
    cp shared/hooks/live/*.hook.chroot config/hooks/live/
    echo "[pai-web] ✓ Shared hooks copied"
fi

# Copy web-specific hooks (overrides shared if same name)
if [ -d "web/config/hooks/live" ]; then
    cp web/config/hooks/live/*.hook.chroot config/hooks/live/
    echo "[pai-web] ✓ Web hooks copied"
fi

# Copy shared package list
if [ -d "shared/package-lists" ]; then
    cp shared/package-lists/*.list.chroot config/package-lists/
    echo "[pai-web] ✓ Shared package list copied"
fi

# Copy web package list
if [ -d "web/config/package-lists" ]; then
    cp web/config/package-lists/*.list.chroot config/package-lists/
    echo "[pai-web] ✓ Web package list copied"
fi

# Copy shared includes
if [ -d "shared/includes" ]; then
    cp -r shared/includes/* config/includes.chroot_after_packages/
    echo "[pai-web] ✓ Shared includes copied"
fi

# Copy web includes
if [ -d "web/config/includes.chroot_after_packages" ]; then
    cp -r web/config/includes.chroot_after_packages/* config/includes.chroot_after_packages/
    echo "[pai-web] ✓ Web includes copied"
fi

# List assembled hooks
echo ""
echo "[pai-web] Assembled hooks:"
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
    --apt-secure true \
    --cache false \
    --iso-application "PAI Web Edition" \
    --iso-publisher "PAI" \
    --iso-volume "PAI-WEB"

echo ""
echo "════════════════════════════════════════════"
echo "  Building PAI Web Edition live ISO..."
echo "════════════════════════════════════════════"
echo ""

lb bootstrap

echo "[pai-web] Cleaning chroot apt lists..."
rm -rf chroot/var/lib/apt/lists/*
mkdir -p chroot/var/lib/apt/lists/partial

lb chroot

echo "[pai-web] Freeing disk space before binary stage..."
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
echo "  ✓ PAI Web Edition ISO built!"
echo "═══════════════════════════════════════════════"

# Copy output
mkdir -p output
cp -v .build/*.iso output/ 2>/dev/null || cp -v *.iso output/ 2>/dev/null || true
ls -lh output/
