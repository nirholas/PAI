---
title: "Architecture"
description: "PAI system architecture — build layout, boot sequence, services, and component overview."
section: "Reference"
order: 2
editPath: "docs/architecture.md"
---

# PAI — System Architecture

## Overview

PAI is a bootable Debian 12 live USB designed as an **AI-first, privacy-hardened workstation**. It combines a local LLM engine (Ollama), a browser-based chat interface, and a locked-down Wayland desktop into a single ISO. Nothing leaves the device by default.

Three editions share a common build foundation:

- **Desktop** (amd64) — Sway tiling compositor + Waybar + Firefox; the default image.
- **Web** (amd64) — CTRL web-OS running under Cage/kiosk; lighter footprint.
- **ARM64** — Sway edition compiled for Apple Silicon / Raspberry Pi; currently built from a parallel tree (see [Build System](#build-system)).

```
┌───────────────────────────────────────────────────────────────┐
│                        PAI Live USB                           │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              Desktop (Sway / Wayland)                   │  │
│  │                                                         │  │
│  │   ┌─────────────────┐     ┌─────────────────────────┐   │  │
│  │   │  Firefox ESR    │────►│  PAI Chat UI  (:8080)   │   │  │
│  │   │  auto-opens URL │     │  static HTML/JS, served │   │  │
│  │   │  at login       │     │  by python3 http.server │   │  │
│  │   └─────────────────┘     └───────────┬─────────────┘   │  │
│  │                                       │ REST            │  │
│  │   ┌───────────────────────────────────▼─────────────┐   │  │
│  │   │  Ollama (:11434, localhost)                     │   │  │
│  │   │  CPU-only inference — Llama, Mistral, Phi, …    │   │  │
│  │   └─────────────────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌──────────────┐ ┌───────────────┐ ┌──────────────────────┐  │
│  │ UFW firewall │ │ MAC randomize │ │ Tor transparent      │  │
│  │ deny inbound │ │ every boot    │ │ proxy (opt-in)       │  │
│  └──────────────┘ └───────────────┘ └──────────────────────┘  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │       LUKS2 Encrypted Persistence (opt-in)              │  │
│  │  Models, chat history, WiFi, optionally /home/pai       │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

## Repository Layout

```
pai/
├── shared/                 # Common to all editions (amd64 editions today)
│   ├── hooks/live/         # 16 numbered chroot hooks
│   ├── includes/           # Files injected into the ISO rootfs
│   │   ├── etc/systemd/    # Services (ollama, mac-spoof, persistence, …)
│   │   ├── etc/pai/        # persistence.conf.example, defaults
│   │   └── usr/local/bin/  # pai-* scripts
│   └── package-lists/      # pai-base.list.chroot
│
├── desktop/                # Desktop Edition (Sway + Waybar + Firefox)
│   ├── config/hooks/live/  # 4 edition-specific hooks (overrides shared by name)
│   ├── config/includes.chroot_after_packages/
│   ├── config/package-lists/pai-desktop.list.chroot
│   ├── Dockerfile.build
│   └── build.sh            # Merges shared/ + desktop/config/ → ISO
│
├── web/                    # Web Edition (CTRL web-OS under Cage/kiosk)
│   ├── config/hooks/live/  # 3 edition-specific hooks
│   ├── config/package-lists/pai-web.list.chroot
│   ├── Dockerfile.build
│   └── build.sh
│
├── arm64/                  # ARM64 edition (parallel tree — see note below)
├── config/                 # Legacy monolithic tree used by the ARM64 build
├── scripts/                # ISO build + flash utilities
├── website/                # Astro-based project site
├── docs/                   # Documentation source (rendered into website/)
└── agents/ skills/ prompts/   # Repo tooling, not bundled in ISOs
```

> **ARM64 is still a parallel, unmerged tree.** `arm64/` and the root-level `config/` mirror each other and do not yet consume `shared/`. Changes to shared hooks or scripts must be mirrored by hand until the ARM64 path is migrated onto the edition-based layout.

## Build System

ISOs are built with Debian `live-build` inside a privileged Docker container. Each edition has its own entry point.

| Edition | Entry point           | Dockerfile                 | Sources consumed                |
| ------- | --------------------- | -------------------------- | ------------------------------- |
| Desktop | `desktop/build.sh`    | `desktop/Dockerfile.build` | `shared/` + `desktop/config/`   |
| Web     | `web/build.sh`        | `web/Dockerfile.build`     | `shared/` + `web/config/`       |
| ARM64   | root `build.sh`       | `arm64/Dockerfile.build`   | root `config/` (monolithic)     |

### Edition assembly (Desktop / Web)

`desktop/build.sh` and `web/build.sh` assemble a `live-build` config tree by overlaying the edition on top of `shared/`:

1. Copy `shared/hooks/live/*.hook.chroot` → working `config/hooks/live/`.
2. Copy edition-specific `config/hooks/live/*.hook.chroot` on top; filenames collide by number, so an edition hook with the same prefix **overrides** the shared one.
3. Copy `shared/includes/` and the edition's `config/includes.chroot_after_packages/` into the chroot tree.
4. Merge `shared/package-lists/pai-base.list.chroot` with the edition's list.
5. Run `lb config && lb build` to produce the ISO.

### Typical invocation

```bash
# Desktop
docker build -t pai-desktop -f desktop/Dockerfile.build .
docker run --privileged -v "$(pwd)/output:/pai/output" pai-desktop
# → output/pai-desktop.iso (~900 MB – 1.2 GB)
```

See [docs/ops-cloud-builders.md](./ops-cloud-builders.md) for the cloud-builder runbook (`pai-builder` / `pai-builder-arm` VMs in GCP).

## Boot Flow

```
BIOS / UEFI
  └─► GRUB (from ISO)
        └─► Linux kernel + initramfs (live-boot)
              ├── live-boot: if a LUKS "persistence" partition is
              │              detected on the USB, prompt for the
              │              passphrase and bind-mount each path
              │              from persistence.conf over the live FS
              └─► systemd
                    ├── pai-mac-spoof.service     → randomize MAC
                    ├── ollama.service            → LLM server on :11434
                    ├── open-webui.service        → Chat UI on :8080
                    ├── pai-persistence.service   → verify bind-mounts,
                    │                                write /run/pai-persistence-active
                    ├── ufw                       → deny inbound
                    └── getty + auto-login (pai)
                          └─► Sway (Wayland compositor)
                                ├── Waybar (privacy + persistence + crypto modules)
                                └─► Firefox ESR → http://localhost:8080
```

## Components

### 1. Ollama — local LLM engine

- **Port:** `11434`, bound to localhost; UFW blocks external reach anyway.
- **User:** dedicated `ollama` system user.
- **Model store:** `/var/lib/ollama/` (persisted by default).
- **Service:** `ollama.service`, simple type, restart-on-failure.
- **Models:** any GGUF — Llama 3, Mistral, Phi, Gemma, CodeLlama, etc.
- **CPU-only** in the default image. No GPU drivers are shipped, to keep the ISO compact and portable.

### 2. PAI Chat UI (desktop + web editions, port 8080)

A **deliberately minimal** static chat client served directly from the ISO:

- Files live at `/opt/pai-chat/` (plain HTML/CSS/JS).
- `open-webui.service` runs `python3 -m http.server 8080` from that directory.
- The browser talks to Ollama at `http://localhost:11434` via fetch.
- No database, no accounts, no telemetry. Chat state is whatever the browser stores locally.

The service is named `open-webui.service` for historical reasons; it is **not** the upstream Open WebUI project.

### 3. PAI UI (ARM64 only — `pai-ui.service`, port 3210)

The ARM64 tree ships a heavier Next.js-based interface at `/opt/pai-ui/`, started by `pai-ui.service`:

```ini
ExecStart=/usr/bin/node .next/standalone/server.js
Environment=PORT=3210
Environment=OLLAMA_PROXY_URL=http://localhost:11434
```

This service does **not** exist in the Desktop or Web editions today. If and when ARM64 is migrated onto `shared/`, one of these two interfaces will become the default across editions.

### 4. Desktop — Sway (Wayland)

| Component     | Role                                              |
| ------------- | ------------------------------------------------- |
| Sway          | Tiling Wayland compositor (i3-compatible config)  |
| Waybar        | Status bar (privacy, persistence, crypto, system) |
| Foot          | Terminal emulator                                 |
| Firefox ESR   | Default browser — auto-opens the chat UI          |
| Swaylock      | Screen lock                                       |
| PCManFM       | File manager                                      |
| Mousepad      | Text editor                                       |

Default keybindings: `Alt+Enter` (terminal), `Alt+F4` (close), `Alt+L` (lock), `Alt+1/2/3` (workspaces).

The Web edition swaps Sway+Waybar for Cage + CTRL web-OS and drops the terminal, status bar, and most GUI extras.

### 5. Privacy layer

All privacy features are staged at build time; some are opt-in at runtime.

| Feature                       | State at boot              | Control                          |
| ----------------------------- | -------------------------- | -------------------------------- |
| MAC address randomization     | **On** (every boot)        | NetworkManager + `pai-mac-spoof` |
| UFW firewall (deny inbound)   | **On**                     | Always on                        |
| Tor transparent proxy + DNS   | **Off**                    | `sudo pai-privacy on`/`off`      |

Privacy mode off:
```
app → system resolver → internet (direct)
```

Privacy mode on:
```
app → iptables → Tor TransPort (9040) → Tor network → internet
DNS → Tor DNSPort (5353)
```

### 6. Persistence layer

The root filesystem is a read-only squashfs — anything written to `/` disappears on shutdown. Persistence is provided by an **optional** encrypted partition on the same USB stick.

**Setup (first time):** `sudo pai-persistence setup` (wraps `pai-persistence-setup`).

- Lists eligible drives (excludes the boot USB, refuses drives that are mounted or < 1 GiB).
- Requires a typed-path confirmation before any destructive action.
- Creates a new partition in the free space, LUKS2 / argon2id-formats it, writes an ext4 filesystem labelled `persistence`, drops `persistence.conf`.

**At boot:** `live-boot` (initramfs) prompts for the LUKS passphrase on the console, opens the partition, reads `persistence.conf`, and bind-mounts each listed target over the live filesystem. There is no "restore" step — bind-mounts route writes directly into the encrypted partition for the whole session.

**State marker:** `pai-persistence.service` runs `pai-persistence unlock` early in user-space, verifies the bind-mounts, and writes `/run/pai-persistence-active`. Waybar (`pai-waybar-persistence`), the login MOTD, and `pai-save` all key off that file.

**Manual flush:** `pai-save` parses the active `persistence.conf`, calls `sync -f` on each persisted mount, and reports per-path usage.

**Auto-save at shutdown:** `pai-save-on-shutdown.service` runs `pai-save` before `shutdown.target` / `reboot.target` / `halt.target`, gated on `ConditionPathExists=/run/pai-persistence-active` (no-op on ephemeral boots).

**Default persisted paths** (from `shared/includes/etc/pai/persistence.conf.example`):

| Path                                     | Contents                         | State       |
| ---------------------------------------- | -------------------------------- | ----------- |
| `/var/lib/ollama`                        | Downloaded Ollama models         | enabled     |
| `/var/lib/open-webui`                    | Chat UI data                     | enabled     |
| `/etc/NetworkManager/system-connections` | Saved WiFi networks              | enabled     |
| `/home/pai`                              | Dotfiles, shell history, data    | opt-in      |
| `/var/log`                               | System logs                      | opt-in      |

## Build Hook Pipeline

Hooks run inside the `lb chroot` stage in numerical order. Shared hooks ship for every edition; edition-specific hooks override by filename prefix.

### Shared (`shared/hooks/live/`)

| #    | Hook                                  | Purpose                                              |
| ---- | ------------------------------------- | ---------------------------------------------------- |
| 0100 | install-ollama                        | Download Ollama binary, create user, enable service  |
| 0400 | plymouth-theme                        | Boot splash                                          |
| 0450 | mac-spoof                             | NetworkManager MAC randomization                     |
| 0500 | firewall                              | UFW: deny inbound, allow loopback, enable on boot    |
| 0550 | tor-config                            | Pre-configure Tor (inactive)                         |
| 0600 | configure-electrum                    | Bitcoin wallet setup                                 |
| 0610 | install-monero-wallet                 | Monero wallet setup                                  |
| 0650 | install-ai-tools                      | Extra AI utilities                                   |
| 0710 | install-dev-languages                 | Python / Node / Rust / Go runtimes                   |
| 0730 | install-git-tools                     | Git, Git LFS, SSH                                    |
| 0740 | configure-terminal                    | Shell prompt, aliases, theme                         |
| 0750 | configure-media                       | PipeWire, media players                              |
| 0800 | configure-networking-privacy          | DNS, hostname, network hardening                     |
| 0830 | configure-encryption-privacy          | GPG + disk-encryption tooling                        |
| 0840 | configure-utilities                   | System utilities, convenience scripts                |
| 0900 | configure-persistence                 | Persistence services, sudoers, MOTD                  |

### Desktop-only (`desktop/config/hooks/live/`)

| #    | Hook                   | Purpose                                               |
| ---- | ---------------------- | ----------------------------------------------------- |
| 0200 | install-open-webui     | Stage `/opt/pai-chat/` + enable `open-webui.service`  |
| 0300 | configure-desktop      | Sway config, Waybar, wallpaper                        |
| 0350 | auto-login             | Getty auto-login on tty1 → Sway                       |
| 0400 | plymouth-theme         | Overrides shared hook with desktop-specific splash    |

### Web-only (`web/config/hooks/live/`)

| #    | Hook                   | Purpose                                               |
| ---- | ---------------------- | ----------------------------------------------------- |
| 0200 | install-ctrl-webos     | Install CTRL web-OS                                   |
| 0300 | configure-kiosk        | Cage / kiosk config, minimal Wayland                  |
| 0350 | auto-login             | Auto-login into the kiosk session                     |

### ARM64 (`config/hooks/live/`, parallel tree)

Mirrors shared + desktop but adds model pre-pull (`0150-prepull-ollama-models`), an ARM64 profile system (`0050-install-profile-system`), and extra wallet tooling (`0620-install-wallet-toolkits`). Since ARM64 does not consume `shared/`, these hooks are maintained separately.

## Systemd Services

| Service                          | Where                  | Role                                                    |
| -------------------------------- | ---------------------- | ------------------------------------------------------- |
| `ollama.service`                 | shared                 | Ollama LLM server on `:11434`                           |
| `pai-mac-spoof.service`          | shared                 | Randomize MAC on every boot (oneshot)                   |
| `pai-persistence.service`        | shared                 | Verify LUKS bind-mounts, set state marker (oneshot)     |
| `pai-save-on-shutdown.service`   | shared                 | Auto-sync persisted dirs before shutdown (oneshot)      |
| `pai-setup.service`              | shared                 | First-boot initialization (oneshot)                     |
| `open-webui.service`             | desktop / arm64        | Chat UI — static files via `python3 -m http.server`     |
| `pai-ui.service`                 | arm64 only             | Next.js PAI UI on `:3210`                               |
| `pai-profile.service`            | arm64 only             | Profile initializer (runs before Ollama + Chat UI)      |

## Bundled `pai-*` Scripts

Installed under `/usr/local/bin/` from `shared/includes/…/usr/local/bin/` unless noted.

| Script                  | Purpose                                                             |
| ----------------------- | ------------------------------------------------------------------- |
| `pai-persistence`       | Persistence lifecycle: `setup`, `unlock`, `status`, `save`          |
| `pai-persistence-setup` | Interactive wizard invoked by `pai-persistence setup`               |
| `pai-save`              | Sync persisted mounts now                                           |
| `pai-privacy`           | `on` / `off` / `status` — toggle Tor transparent proxy              |
| `pai-mac-spoof`         | Force MAC randomization (also invoked by the service)               |
| `pai-ssh-setup`         | Generate SSH keys, configure agent                                  |
| `pai-transcribe`        | Local speech-to-text via Whisper                                    |
| `pai-waybar-privacy`    | Waybar module — current privacy state                               |
| `pai-waybar-persistence`| Waybar module — persistence state                                   |
| `pai-waybar-crypto`     | Waybar module — crypto price ticker (desktop edition only)          |

The ARM64 tree adds edition-local scripts: `pai-launcher`, `pai-model-picker`, `pai-models`, `pai-recommend-model`, `pai-memory-wipe`, `pai-profile-init`, `pai-settings`, `pai-shutdown`, `pai-welcome`, `pai-waybar-ollama`, `pai-status`, `pai-waybar-status`, plus `pocket-ai-setup`.

## Editions at a Glance

| Aspect           | Desktop                      | Web                                 | ARM64                                  |
| ---------------- | ---------------------------- | ----------------------------------- | -------------------------------------- |
| Arch             | amd64                        | amd64                               | arm64                                  |
| Build path       | `desktop/build.sh`           | `web/build.sh`                      | root `build.sh` (monolithic `config/`) |
| Sources          | `shared/` + `desktop/config/`| `shared/` + `web/config/`           | `config/` only                         |
| Compositor       | Sway (tiling)                | Cage / Sway fallback (kiosk)        | Sway (tiling)                          |
| Status bar       | Waybar                       | none                                | Waybar                                 |
| Terminal         | Foot                         | none                                | Foot                                   |
| Browser          | Firefox ESR                  | Firefox ESR fullscreen              | Firefox ESR                            |
| AI interface     | Chat UI (`:8080`)            | CTRL web-OS + Chat UI (`:8080`)     | Chat UI (`:8080`) + PAI UI (`:3210`)   |
| TorBrowser       | yes                          | no                                  | no (unavailable on arm64)              |
| Model pre-pull   | no                           | no                                  | yes (hook `0150`)                      |

## Network Ports

All ports listed are bound to localhost; UFW denies inbound on every interface.

| Port  | Service            | Editions              |
| ----- | ------------------ | --------------------- |
| 11434 | Ollama             | all                   |
| 8080  | PAI Chat UI        | desktop, web, arm64   |
| 3210  | PAI UI (Next.js)   | arm64 only            |
| 9040  | Tor TransPort      | all, privacy-mode on  |
| 5353  | Tor DNSPort        | all, privacy-mode on  |

## Technology Stack

| Layer             | Technology                                   |
| ----------------- | -------------------------------------------- |
| Base OS           | Debian 12 (Bookworm)                         |
| Build             | Debian `live-build` inside Docker            |
| Compositor        | Sway (Wayland) / Cage (web edition)          |
| Terminal          | Foot                                         |
| Browser           | Firefox ESR                                  |
| LLM engine        | Ollama (CPU inference)                       |
| Chat UI           | Static HTML/JS served by `python3 -m http.server` |
| PAI UI (arm64)    | Next.js (Node runtime)                       |
| Audio             | PipeWire + WirePlumber                       |
| Firewall          | UFW (iptables)                               |
| Anonymity         | Tor                                          |
| Encryption        | LUKS2 / dm-crypt, argon2id                   |
| Crypto wallets    | Electrum (BTC), Monero CLI/GUI               |

## Do-Not Rules

These are load-bearing for the project's identity:

- No telemetry or network calls that run without user opt-in.
- No rebranding away from "PAI".
- No non-free software in the default image.

## Licenses

- PAI system integration: **GPL v3**
- Ollama: MIT
- Debian packages: various (GPL, LGPL, BSD, MIT)
