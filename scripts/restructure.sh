#!/usr/bin/env bash
set -euo pipefail

# ── PAI Repository Restructure ──────────────────────────────────────
# Reorganizes the repo into professional edition-based structure:
#
#   pai/
#   ├── shared/          ← Common hooks, scripts, services
#   ├── desktop/         ← PAI Desktop Edition (Sway)
#   ├── web/             ← PAI Web Edition (CTRL)
#   ├── arm64/           ← ARM64 variants
#   └── docs/, prompts/, scripts/
# ────────────────────────────────────────────────────────────────────

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

echo "═══════════════════════════════════════════════"
echo "  PAI Repo Restructure"
echo "═══════════════════════════════════════════════"

# ══════════════════════════════════════════════════
# 1. Create shared/ — hooks used by ALL editions
# ══════════════════════════════════════════════════
echo "[restructure] Creating shared/ directory..."
mkdir -p shared/hooks/live
mkdir -p shared/includes/etc/systemd/system
mkdir -p shared/includes/etc/profile.d
mkdir -p shared/includes/usr/local/bin
mkdir -p shared/includes/usr/share/backgrounds
mkdir -p shared/package-lists

# Shared hooks (architecture-independent, edition-independent)
for hook in \
    0100-install-ollama.hook.chroot \
    0450-mac-spoof.hook.chroot \
    0500-firewall.hook.chroot \
    0550-tor-config.hook.chroot \
    0600-configure-electrum.hook.chroot \
    0610-install-monero-wallet.hook.chroot \
    0650-install-ai-tools.hook.chroot \
    0710-install-dev-languages.hook.chroot \
    0730-install-git-tools.hook.chroot \
    0740-configure-terminal.hook.chroot \
    0750-configure-media.hook.chroot \
    0800-configure-networking-privacy.hook.chroot \
    0830-configure-encryption-privacy.hook.chroot \
    0840-configure-utilities.hook.chroot; do
    cp "config/hooks/live/$hook" "shared/hooks/live/$hook"
    echo "  ✓ shared/hooks/live/$hook"
done

# Plymouth theme is shared (same boot splash for all editions)
cp "config/hooks/live/0400-plymouth-theme.hook.chroot" "shared/hooks/live/0400-plymouth-theme.hook.chroot"
echo "  ✓ shared/hooks/live/0400-plymouth-theme.hook.chroot"

# Shared systemd services
cp config/includes.chroot_after_packages/etc/systemd/system/ollama.service shared/includes/etc/systemd/system/
cp config/includes.chroot_after_packages/etc/systemd/system/pai-mac-spoof.service shared/includes/etc/systemd/system/
cp config/includes.chroot_after_packages/etc/systemd/system/pai-persistence.service shared/includes/etc/systemd/system/
cp config/includes.chroot_after_packages/etc/systemd/system/pai-setup.service shared/includes/etc/systemd/system/
echo "  ✓ shared systemd services"

# Shared scripts
for script in pai-mac-spoof pai-privacy pai-waybar-privacy pai-persistence pai-transcribe pai-ssh-setup pai-setup; do
    cp "config/includes.chroot_after_packages/usr/local/bin/$script" "shared/includes/usr/local/bin/$script" 2>/dev/null || true
done
echo "  ✓ shared scripts"

# Shared profile.d
cp config/includes.chroot_after_packages/etc/profile.d/* shared/includes/etc/profile.d/ 2>/dev/null || true
echo "  ✓ shared profile.d"

# Shared wallpaper
cp config/includes.chroot_after_packages/usr/share/backgrounds/pai-wallpaper.svg shared/includes/usr/share/backgrounds/ 2>/dev/null || true

# Shared Firefox config
mkdir -p shared/includes/etc/firefox-esr/policies
cp config/includes.chroot_after_packages/etc/firefox-esr/policies/policies.json shared/includes/etc/firefox-esr/policies/ 2>/dev/null || true
mkdir -p shared/includes/usr/lib/firefox-esr/defaults/pref
cp config/includes.chroot_after_packages/usr/lib/firefox-esr/defaults/pref/autoconfig.js shared/includes/usr/lib/firefox-esr/defaults/pref/ 2>/dev/null || true
cp config/includes.chroot_after_packages/usr/lib/firefox-esr/firefox.cfg shared/includes/usr/lib/firefox-esr/ 2>/dev/null || true

# Shared desktop entries
mkdir -p shared/includes/usr/share/applications
cp config/includes.chroot_after_packages/usr/share/applications/* shared/includes/usr/share/applications/ 2>/dev/null || true

# Shared base package list (everything except desktop-specific packages)
cat > shared/package-lists/pai-base.list.chroot <<'EOF'
# ── PAI Base Packages (shared across all editions) ──

# Core system
firmware-linux-free

# Browser
firefox-esr

# Networking
network-manager
network-manager-gnome
wireless-tools
wpasupplicant
wireguard-tools

# Privacy / Security
ufw
tor
torsocks
macchanger
cryptsetup

# Git tools
git
git-lfs
openssh-client
openssh-server

# Utilities
curl
wget
unzip
htop
pcmanfm
mousepad

# Python (for chat server)
python3

# Audio
pipewire
pipewire-pulse
wireplumber

# Theming
adwaita-icon-theme

# Fonts
fonts-noto-core

# Boot splash
plymouth
fonts-noto-color-emoji

# AI utilities
jq
alsa-utils

# Media
ffmpeg
playerctl

# Cryptocurrency
electrum

# Terminal enhancements
tmux
fzf
ripgrep
fd-find
bat
tree
neofetch

# Developer tools
make
pkg-config
libssl-dev
python3-pip
python3-venv

# Networking & Privacy
onionshare

# Encryption
gnupg
EOF
echo "  ✓ shared package list"


# ══════════════════════════════════════════════════
# 2. Create desktop/ — PAI Desktop Edition (Sway)
# ══════════════════════════════════════════════════
echo ""
echo "[restructure] Creating desktop/ edition..."
mkdir -p desktop/config/hooks/live
mkdir -p desktop/config/package-lists
mkdir -p desktop/config/includes.chroot_after_packages

# Desktop-specific hooks
cp config/hooks/live/0200-install-open-webui.hook.chroot desktop/config/hooks/live/
cp config/hooks/live/0300-configure-desktop.hook.chroot desktop/config/hooks/live/
cp config/hooks/live/0350-auto-login.hook.chroot desktop/config/hooks/live/
cp config/hooks/live/0400-plymouth-theme.hook.chroot desktop/config/hooks/live/
echo "  ✓ desktop hooks"

# Desktop-specific packages
cat > desktop/config/package-lists/pai-desktop.list.chroot <<'EOF'
# ── PAI Desktop Edition — Additional Packages ──

# Kernel
linux-image-amd64

# Wayland desktop
sway
foot
waybar
swaybg
swaylock
swayidle
wlr-randr
xwayland
dbus-x11

# Desktop apps
file-roller
audacious
audacious-plugins
mousepad

# Tor Browser (x86 only)
torbrowser-launcher
EOF
echo "  ✓ desktop package list"

# Desktop-specific includes
cp -r config/includes.chroot_after_packages/opt desktop/config/includes.chroot_after_packages/ 2>/dev/null || true
mkdir -p desktop/config/includes.chroot_after_packages/etc/systemd/system
cp config/includes.chroot_after_packages/etc/systemd/system/open-webui.service desktop/config/includes.chroot_after_packages/etc/systemd/system/
mkdir -p desktop/config/includes.chroot_after_packages/usr/local/bin
cp config/includes.chroot_after_packages/usr/local/bin/pai-waybar-crypto desktop/config/includes.chroot_after_packages/usr/local/bin/ 2>/dev/null || true
echo "  ✓ desktop includes"

# Desktop Dockerfile & build script — already created in desktop/
# (desktop/Dockerfile.build and desktop/build.sh are edition-aware)

echo "  ✓ desktop build files (pre-created)"


# ══════════════════════════════════════════════════
# 3. Summary
# ══════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════"
echo "  ✓ Restructure complete!"
echo ""
echo "  shared/ — 15 hooks, base packages, systemd services, scripts"
echo "  desktop/ — Sway desktop (4 hooks, desktop packages, build files)"
echo "  web/ — Created separately (CTRL web desktop)"
echo ""
echo "  Original files at config/ are UNTOUCHED."
echo "═══════════════════════════════════════════════"
