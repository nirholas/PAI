#!/usr/bin/env bash
set -euo pipefail

echo "Cleaning previous build..."
lb clean --purge 2>/dev/null || true

lb config \
    --mode debian \
    --distribution bookworm \
    --parent-mirror-bootstrap http://deb.debian.org/debian \
    --parent-mirror-chroot-security http://deb.debian.org/debian-security \
    --mirror-bootstrap http://deb.debian.org/debian \
    --mirror-chroot-security http://deb.debian.org/debian-security \
    --archive-areas "main contrib non-free non-free-firmware" \
    --bootappend-live "boot=live components splash persistence persistence-encryption=luks locales=en_US.UTF-8 keyboard-layouts=us hostname=pai username=pai user-fullname=PAI live-config.user-default-groups=audio,cdrom,dialout,floppy,video,plugdev,netdev,powerdev,scanner,bluetooth,debian-tor,sudo,render,input" \
    --architectures amd64 \
    --binary-images iso-hybrid \
    --memtest none \
    --apt-indices false \
    --apt-secure false \
    --cache false \
    --iso-application "PAI" \
    --iso-publisher "PAI" \
    --iso-volume "PAI"

echo ""
echo "════════════════════════════════════════════"
echo "  Building PAI live ISO..."
echo "════════════════════════════════════════════"
echo ""

lb bootstrap

echo "[pai] Cleaning chroot apt lists to avoid Docker overlay GPG errors..."
rm -rf chroot/var/lib/apt/lists/*
mkdir -p chroot/var/lib/apt/lists/partial

lb chroot

echo "[pai] Freeing disk space before binary stage..."
# Remove apt caches (huge space savings)
rm -rf chroot/var/cache/apt/archives/*.deb
rm -rf chroot/var/cache/apt/archives/partial/*
rm -rf chroot/var/lib/apt/lists/*
mkdir -p chroot/var/lib/apt/lists/partial

# Remove docs, man pages, locale data we don't need
rm -rf chroot/usr/share/doc/*
rm -rf chroot/usr/share/man/*
rm -rf chroot/usr/share/info/*
# Remove non-English locales (find-based, no extglob needed)
find chroot/usr/share/locale/ -maxdepth 1 -mindepth 1 -type d ! -name 'en' ! -name 'en_US' -exec rm -rf {} + 2>/dev/null || true
find chroot/usr/share/i18n/locales/ -maxdepth 1 -mindepth 1 ! -name 'en_US' ! -name 'POSIX' -exec rm -rf {} + 2>/dev/null || true

# Remove build caches
rm -rf chroot/tmp/*
rm -rf chroot/var/tmp/*
rm -rf chroot/root/.cache/*

# Remove live-build download cache (already installed)
rm -rf cache/packages.chroot/ cache/packages.binary/ cache/contents.chroot/

# Remove whisper.cpp source (binary already built)
rm -rf chroot/opt/whisper.cpp/.git chroot/opt/whisper.cpp/samples chroot/opt/whisper.cpp/tests

# Remove nvidia firmware blobs (not needed for live USB, saves ~800MB)
rm -rf chroot/usr/lib/firmware/nvidia/

# Remove Ollama GPU libs (CPU-only live USB, saves ~2GB+)
rm -rf chroot/usr/local/lib/ollama/cuda_v12/
rm -rf chroot/usr/local/lib/ollama/cuda_v13/
rm -rf chroot/usr/local/lib/ollama/mlx_cuda_v13/
rm -rf chroot/usr/local/lib/ollama/vulkan/
rm -rf chroot/usr/local/lib/ollama/rocm/

# Remove Go/Rust download caches
rm -rf chroot/opt/cargo/registry/cache/*
rm -rf chroot/root/.rustup/tmp/*

# Remove nodesource apt repo cache
rm -rf chroot/var/cache/apt/srcpkgcache.bin chroot/var/cache/apt/pkgcache.bin

# Remove ALL caches (lb binary copies chroot anyway)
rm -rf cache/

# Show space before binary stage
echo "[pai] Disk usage after cleanup:"
df -h / | tail -1
du -sh chroot/ || true

lb binary
