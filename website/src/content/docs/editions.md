---
title: "Editions"
description: "PAI Desktop, Web, and ARM64 edition differences."
section: "Reference"
order: 11
editPath: "docs/editions.md"
---

# PAI — Edition Architecture

PAI ships as **separate ISOs**, one per edition — the same approach used by Ubuntu (Desktop, Server, IoT), Fedora (Workstation, Server, CoreOS), and Debian (GNOME, KDE, XFCE).

## Directory Layout

```
pai/
├── shared/                          ← Common to ALL editions
│   ├── hooks/live/                  ← 14 shared hooks
│   │   ├── 0100-install-ollama
│   │   ├── 0450-mac-spoof
│   │   ├── 0500-firewall
│   │   ├── 0550-tor-config
│   │   ├── 0600-configure-electrum
│   │   ├── 0610-install-monero-wallet
│   │   ├── 0650-install-ai-tools
│   │   ├── 0710-install-dev-languages
│   │   ├── 0730-install-git-tools
│   │   ├── 0740-configure-terminal
│   │   ├── 0750-configure-media
│   │   ├── 0800-configure-networking-privacy
│   │   ├── 0830-configure-encryption-privacy
│   │   └── 0840-configure-utilities
│   ├── includes/                    ← Shared systemd, scripts, configs
│   └── package-lists/               ← Base package list
│
├── desktop/                         ← PAI Desktop Edition (Sway)
│   ├── config/hooks/live/
│   │   ├── 0200-install-open-webui  ← Chat UI server
│   │   ├── 0300-configure-desktop   ← Sway, Waybar, keybindings
│   │   ├── 0350-auto-login          ← TTY → Sway
│   │   └── 0400-plymouth-theme      ← Boot splash
│   ├── config/package-lists/        ← sway, waybar, foot, torbrowser
│   ├── Dockerfile.build
│   └── build.sh
│
├── web/                             ← PAI Web Edition (CTRL)
│   ├── config/hooks/live/
│   │   ├── 0200-install-ctrl-webos  ← CTRL web desktop + PAI Chat app
│   │   ├── 0300-configure-kiosk     ← Firefox kiosk (cage or sway fallback)
│   │   └── 0350-auto-login          ← TTY → cage/kiosk
│   ├── config/package-lists/        ← minimal Wayland (no waybar)
│   ├── Dockerfile.build
│   └── build.sh
│
├── arm64/                           ← ARM64 variants (Apple Silicon)
│   ├── Dockerfile.build
│   ├── build.sh
│   └── config/hooks/live/           ← ARM64-specific hooks
│
├── config/                          ← Original monolithic config (preserved)
├── docs/
├── prompts/
└── scripts/
```

## Editions

### Desktop Edition (Sway)
The original PAI experience. Full tiling Wayland desktop with:
- **Sway** window manager + **Waybar** status bar
- **Open WebUI**-style chat served by Python http.server
- Keyboard shortcuts for all apps (Alt+Return, Alt+B, etc.)
- Tor Browser, Electrum, Feather Wallet, media player

**Build:**
```bash
docker build -f desktop/Dockerfile.build -t pai-desktop .
docker run --privileged -v "$PWD/output:/pai/output" pai-desktop
```

### Web Edition (CTRL)
A browser-based desktop powered by [CTRL](https://github.com/nirholas/CTRL):
- **CTRL** web OS (HTML/CSS/JS) as the primary desktop
- **Firefox kiosk** mode — full-screen browser pointing at localhost
- **Cage** Wayland compositor for true kiosk (sway fallback)
- PAI Chat integrated as a CTRL app
- Lighter footprint (no waybar, no tiling WM config)

**Build:**
```bash
docker build -f web/Dockerfile.build -t pai-web .
docker run --privileged -v "$PWD/output:/pai/output" pai-web
```

### ARM64 Edition
For Apple Silicon Macs (M1/M2/M3). Based on the Desktop Edition with architecture-specific adaptations:
- ARM64 kernel, Ollama ARM64 binary, Go ARM64, Feather Wallet ARM64
- No torbrowser-launcher (not available for ARM64)
- Uses GRUB EFI for ARM64 boot

**Build:**
```bash
docker build --platform linux/arm64 -f arm64/Dockerfile.build -t pai-arm64 .
docker run --privileged --platform linux/arm64 -v "$PWD/output:/pai/output" pai-arm64
```

## Shared Components

All editions include these 14 hooks and their associated services/configs:

| Hook | What it does |
|------|-------------|
| `0100-install-ollama` | Local LLM inference engine |
| `0450-mac-spoof` | MAC address randomization |
| `0500-firewall` | UFW firewall rules |
| `0550-tor-config` | Tor network configuration |
| `0600-configure-electrum` | Bitcoin wallet |
| `0610-install-monero-wallet` | Monero wallet (Feather) |
| `0650-install-ai-tools` | whisper.cpp, AI utilities |
| `0710-install-dev-languages` | Go, Rust, Python, Node.js |
| `0730-install-git-tools` | git, gh CLI, lazygit |
| `0740-configure-terminal` | Shell config, aliases |
| `0750-configure-media` | PipeWire audio, media tools |
| `0800-configure-networking-privacy` | Network privacy settings |
| `0830-configure-encryption-privacy` | GnuPG, encryption tools |
| `0840-configure-utilities` | General utilities |

## Build Process

Each edition's `build.sh`:
1. Copies shared hooks + includes from `shared/`
2. Copies edition-specific hooks from `<edition>/config/hooks/`
3. Copies both shared + edition-specific package lists
4. Runs `lb config` + `lb bootstrap` + `lb chroot` + `lb binary`
5. Outputs ISO to `output/`

Edition-specific hooks use the **same numbering** (0200, 0300, 0350) so they naturally replace each other — the Desktop Edition's `0300-configure-desktop` is a completely different file from the Web Edition's `0300-configure-kiosk`.
