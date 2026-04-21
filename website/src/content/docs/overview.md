---
title: "PAI Overview"
description: "Complete overview of PAI — what it is, how it works, and how to use it."
section: "Reference"
order: 10
editPath: "README.md"
---

# 🔒 PAI 

![header](/branding/readme-header.svg)




---

## Try it in 30 seconds

```bash
# Linux / macOS
curl -fsSL https://pai.direct/try | bash
```

```powershell
# Windows
irm https://pai.direct/try.ps1 | iex
```

Launches PAI in a local VM. No USB, no reboot, no changes to your system.

---

## Quick Start

**Recommended — the auto-flasher detects removable drives and asks you to confirm before writing:**

```bash
# One-command download and flash (Linux/macOS):
curl -fsSL https://raw.githubusercontent.com/nirholas/pai/main/scripts/flash.sh | sudo bash
```

<details>
<summary>Or flash manually with <code>dd</code> (advanced)</summary>

> ⚠️ **`dd` writes raw bytes to whatever device you point it at — including your system disk — with no confirmation and no undo.** On most Linux systems `/dev/sda` is your internal drive, *not* your USB. If you are not 100% sure which device is your USB, use the auto-flasher above.

```bash
# Download the ISO
curl -LO https://get.pai.direct/pai-amd64.iso

# 1. Identify your USB device — do not skip this step
lsblk -d -o NAME,SIZE,MODEL,TRAN          # Linux: look for TRAN=usb
# diskutil list                           # macOS: look for "external, physical"

# 2. Flash — replace /dev/sdX with the USB device you just identified
sudo dd if=pai.iso of=/dev/sdX bs=4M status=progress && sync
```

</details>

Then reboot, select USB from your boot menu (F12/F2/DEL), and you're in.

> **Windows?** Open PowerShell as Administrator and run:
>
> ```powershell
> irm https://pai.direct/flash.ps1 | iex
> ```
>
> The script downloads the latest ISO, verifies its SHA256, lets you pick your USB drive, and writes it raw — no Rufus, no extra tools. See [Flash to USB — Windows](#windows) below for a graphical alternative.
>
> **Want to try it in a VM first?** Download the ISO + [UTM](https://mac.getutm.app/) (macOS) or any QEMU/VirtualBox/VMware host. Create a new VM, attach the ISO as a CD/DVD, give it 4 GB+ RAM, and boot — no USB flashing required.

### Homebrew (macOS / Linux)

```bash
brew install nirholas/tap/pai
```

See [docs.pai.direct/advanced/homebrew](https://docs.pai.direct/advanced/homebrew).

---

## What is PAI?

PAI is a **bootable live USB operating system** built on Debian 12 that gives you a private, portable AI workstation. Plug it into any x86_64 PC, boot from USB, and you have:

- **An offline AI assistant** running locally via [Ollama](https://ollama.com/) — no cloud, no API keys, no data leaving your machine
- **A privacy-hardened environment** with MAC spoofing, firewall, and Tor integration
- **A complete desktop** with Sway (Wayland), Firefox ESR, and essential tools
- **Zero installation** — nothing touches the host machine's hard drive

Like [Tails](https://tails.net/) is to privacy-focused browsing, **PAI is to private AI**. It combines the amnesic, leave-no-trace philosophy of Tails with the power of local large language models.

### The Problem

Every major AI service — ChatGPT, Claude, Gemini — requires sending your prompts, documents, and conversations to remote servers operated by third parties. You have no control over:

- **Who reads your data** — your prompts are processed on hardware you don't own
- **How long it's stored** — retention policies change, breaches happen
- **Who it's shared with** — training data pipelines, government requests, partnerships
- **Where it goes** — cross-border data transfers, jurisdictional exposure

Even "private" or "enterprise" tiers ultimately require trust in a corporation's infrastructure and policies.

### The Solution

PAI eliminates the entire trust chain:

| | Cloud AI | PAI |
|---|---|---|
| **Where your prompts go** | Remote servers | Nowhere — stays on your hardware |
| **Who can read them** | The provider, their employees, subprocessors | Only you |
| **Network required** | Always | Never (fully offline) |
| **Traces left behind** | Server logs, training data, analytics | None — RAM is wiped on shutdown |
| **Cost** | $20–200/month | Free forever |
| **Data jurisdiction** | Wherever their servers are | Wherever you are |

Your conversations exist only in RAM while PAI is running. Shut down, and they're gone. No logs, no history, no server-side copies. The machine doesn't even know PAI was there.

---

## How It Works

```
┌──────────────────────────────────────────────────────────┐
│                      YOUR COMPUTER                       │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │                   PAI (Live USB)                 │    │
│  │                                                  │    │
│  │  ┌─────────┐  ┌──────────┐  ┌─────────────────┐  │    │
│  │  │  Sway   │  │ Firefox  │  │   Terminal      │  │    │
│  │  │(desktop)│  │   ESR    │  │   (foot)        │  │    │
│  │  └────┬────┘  └─────┬────┘  └────────┬────────┘  │    │
│  │       │             │                │           │    │
│  │       │      ┌──────▼──────┐         │           │    │
│  │       │      │  Chat UI    │         │           │    │
│  │       │      │ :8080       │         │           │    │
│  │       │      └──────┬──────┘         │           │    │
│  │       │             │                │           │    │
│  │       │      ┌──────▼──────┐         │           │    │
│  │       │      │   Ollama    │         │           │    │
│  │       │      │  (LLM API)  │         │           │    │
│  │       │      │  :11434     │         │           │    │
│  │       │      └─────────────┘         │           │    │
│  │       │                              │           │    │
│  │  ┌────▼──────────────────────────────▼────────┐  │    │
│  │  │          Linux Kernel (Debian 12)          │  │    │
│  │  │  UFW ─ Tor ─ WireGuard ─ MAC Spoofing      │  │    │
│  │  └────────────────────────────────────────────┘  │    │
│  └──────────────────────────────────────────────────┘    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐    │
│  │         Host OS (untouched — not mounted)        │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

PAI boots entirely into RAM from the USB drive. The host machine's hard drive is **never mounted, read, or written to**. When you shut down, all memory is cleared. The host operating system resumes as if nothing happened.

---

## Architecture

### Boot Sequence

```
USB plugged in → BIOS/UEFI selects USB → GRUB/ISOLINUX loads kernel
    → Debian live-boot mounts squashfs from USB
    → systemd starts services:
        1. MAC address randomization (pai-mac-spoof.service)
        2. UFW firewall (deny incoming, allow outgoing, localhost only)
        3. Ollama LLM server (localhost:11434)
        4. Chat UI web server (localhost:8080)
        5. NetworkManager (Wi-Fi/Ethernet)
    → Auto-login on tty1 → Sway (Wayland) launches
    → Firefox ESR opens to localhost:8080 (Chat UI)
```

### Build System

PAI is built using [Debian live-build](https://live-team.pages.debian.net/live-manual/), the same toolchain used by Debian, Tails, and Kali Linux. The build process:

1. **Bootstrap** — debootstraps a minimal Debian 12 root filesystem
2. **Chroot** — installs packages and runs hook scripts inside the chroot:
   - `0100` — Installs Ollama (with GPU lib cleanup for CPU-only operation)
   - `0200` — Deploys Chat UI + systemd services
   - `0300` — Configures Sway desktop environment
   - `0350` — Sets up passwordless auto-login
   - `0400` — Plymouth boot splash
   - `0450` — MAC address spoofing service
   - `0500` — UFW firewall hardening
   - `0550` — Tor transparent proxy (opt-in)
   - `0600` — Electrum Bitcoin wallet
   - `0610` — Monero wallet
   - `0650` — AI tools suite
   - `0710` — Development languages
   - `0730` — Git tools
   - `0740` — Terminal enhancements
   - `0750` — Media applications
   - `0800` — Network privacy tools
   - `0830` — Encryption (GnuPG, LUKS)
   - `0840` — System utilities
3. **Cleanup** — strips GPU libs (~2GB), docs, man pages, non-English locales, caches
4. **Binary** — compresses the filesystem into squashfs, generates hybrid ISO

### ISO Variants

| Build | Size | Packages | Disk Required |
|---|---|---|---|
| **Minimal** | ~912 MB | ~20 packages (Sway, Firefox, Ollama, networking) | 32 GB |
| **Full** | ~4–6 GB | 100+ packages (all hooks enabled) | 64 GB+ |

The minimal build is the current default. It boots in under 30 seconds and runs Ollama + Chat UI with ~1.5 GB of free RAM on a 4 GB machine.

---

## Privacy & Security Model

PAI implements defense-in-depth across multiple layers. The goal is not just privacy but **operational security** — making it difficult for an adversary to determine what you did, when, or where.

### Layer 1: Amnesic by Design

Like Tails, PAI is **amnesic**. It runs entirely from RAM and the read-only squashfs on the USB drive.

- **No hard disk access** — the host machine's drives are never mounted
- **RAM-only operation** — all state exists only in volatile memory
- **Clean shutdown** — powering off clears all RAM, destroying:
  - Chat history and AI conversations
  - Downloaded files and browser history
  - Wi-Fi credentials and network logs
  - Every keystroke and mouse movement

There is no forensic residue. The machine returns to its pre-boot state.

> **Future**: Optional encrypted persistent storage (LUKS) on the USB drive for saving models and configuration across sessions.

### Layer 2: Network Anonymity

| Feature | Implementation | Default State |
|---|---|---|
| **MAC spoofing** | `macchanger` via `pai-mac-spoof.service` | ✅ Active on every boot |
| **Firewall** | `ufw` — deny incoming, allow outgoing, localhost only | ✅ Active on every boot |
| **Tor routing** | Transparent proxy via `tor` + `iptables` | ⬡ Opt-in (`sudo pai-privacy on`) |
| **DNS privacy** | Tor DNS resolution when privacy mode is active | ⬡ Opt-in |
| **Wi-Fi randomization** | NetworkManager `cloned-mac-address=random` | ✅ Active on every boot |

**MAC spoofing** randomizes your hardware address on every boot. The access point, ISP, and any local network observer sees a different device each time. Combined with Tor, your traffic is encrypted through three relays — no single relay knows both your identity and your destination.

**Firewall** denies all incoming connections by default. Ollama and the Chat UI listen only on `localhost` — they are not accessible from the network, even on the local subnet.

### Layer 3: Local-Only AI

The AI runs **entirely on-device** using [Ollama](https://ollama.com/). No tokens, no API keys, no cloud dependencies.

- **Model execution**: CPU-only (GPU libs stripped to save space)
- **Model storage**: Pulled into RAM or persistent storage on first use
- **Network**: Ollama never phones home. It binds to `127.0.0.1:11434`
- **Supported models**: Any GGUF-compatible model — Llama 3.1, Mistral, Phi-3, Gemma, Qwen, DeepSeek, etc.
- **Chat UI**: Lightweight HTML interface served by Python's `http.server` on `localhost:8080`

The trade-off is speed — CPU inference on a laptop is 5–20 tokens/sec depending on the model and hardware. A 7B parameter model runs comfortably on 8 GB RAM. For faster inference, use a machine with more cores or AVX-512 support.

### Layer 4: Hardened Defaults

```
┌─────────────────────────────────────────────┐
│              Security Defaults              │
├─────────────────────────────────────────────┤
│ ✓ MAC randomized on every boot              │
│ ✓ Firewall: deny incoming, localhost only   │
│ ✓ No SSH server enabled by default          │
│ ✓ GPG configured with SHA-512 + AES-256     │
│ ✓ Tor pre-configured (opt-in activation)    │
│ ✓ WireGuard available for VPN tunnels       │
│ ✓ LUKS available for encrypted volumes      │
│ ✓ No telemetry, no analytics, no phoning    │
│   home — ever                               │
│ ✓ Firefox ESR with hardened policies        │
│ ✓ Automatic memory wipe on shutdown         │
└─────────────────────────────────────────────┘
```

### Threat Model

**PAI protects against:**
- Network surveillance (MAC spoofing + Tor + encrypted DNS)
- Forensic analysis of the host machine (amnesic, no disk writes)
- Cloud AI data harvesting (all inference is local)
- Tracking across sessions (new MAC, clean browser, no cookies)
- Local network attacks on AI services (firewall blocks all incoming)

**PAI does NOT protect against:**
- Physical keyloggers or hardware implants on the host machine
- Compromised BIOS/UEFI firmware
- Shoulder surfing or screen recording
- Adversaries who control your ISP and the exit node simultaneously (Tor limitation)
- Cold boot attacks on RAM (mitigated by full shutdown, not sleep)
- A compromised USB drive (verify ISO checksums before flashing)

This is not a silver bullet. PAI raises the cost of surveillance significantly, but determined nation-state adversaries with physical access to your hardware can still compromise you. For maximum security, use PAI on hardware you control and trust, on a network you manage, with Tor enabled.

---

## Included Software

### AI & Productivity

| Software | Purpose |
|---|---|
| [Ollama](https://ollama.com/) | Local LLM inference engine — runs Llama, Mistral, Phi, Gemma, etc. |
| Chat UI | Lightweight web interface for conversing with Ollama models |
| Firefox ESR | Privacy-focused web browser with hardened policies |
| PCManFM | Lightweight file manager |
| Mousepad | Simple text editor |
| File Roller | Archive manager (zip, tar, gzip) |

### Privacy & Security

| Software | Purpose |
|---|---|
| [Tor](https://www.torproject.org/) | Anonymous communication — transparent proxy mode |
| [UFW](https://wiki.ubuntu.com/UncomplicatedFirewall) | Firewall — deny incoming by default |
| [macchanger](https://github.com/alobbs/macchanger) | MAC address randomization |
| [WireGuard](https://www.wireguard.com/) | Modern VPN tunneling |
| [GnuPG](https://gnupg.org/) | OpenPGP encryption and signing |
| [LUKS/cryptsetup](https://gitlab.com/cryptsetup/cryptsetup) | Disk encryption |
| [Electrum](https://electrum.org/) | Lightweight Bitcoin wallet |
| Monero Wallet | Private cryptocurrency wallet |

### Desktop Environment

| Software | Purpose |
|---|---|
| [Sway](https://swaywm.org/) | Wayland tiling compositor (i3-compatible) |
| [foot](https://codeberg.org/dnkl/foot) | Fast, lightweight Wayland terminal |
| [Waybar](https://github.com/Alexays/Waybar) | Status bar for Sway |
| [swaylock](https://github.com/swaywm/swaylock) | Screen locker |
| [xwayland](https://wayland.freedesktop.org/xserver.html) | X11 compatibility layer |

### Development

| Software | Purpose |
|---|---|
| [Git](https://git-scm.com/) + [Git LFS](https://git-lfs.com/) | Version control |
| OpenSSH | SSH client and server |
| Python 3 | Scripting runtime |
| curl, wget, htop, jq | Essential CLI utilities |

### Networking

| Software | Purpose |
|---|---|
| NetworkManager | Wi-Fi and Ethernet management |
| wpasupplicant | WPA/WPA2 authentication |
| wireless-tools | Wi-Fi diagnostics |

---

## Flash to USB

### Requirements

- **USB drive**: 2 GB minimum (8 GB+ recommended for downloading models)
- **Target machine**: x86_64 (Intel or AMD, 64-bit)
- **RAM**: 2 GB minimum, 4 GB+ recommended for AI inference

### Method 1: Auto-Flasher Script (Linux/macOS)

The auto-flasher downloads the ISO, detects USB drives, and writes it — one command:

```bash
curl -fsSL https://raw.githubusercontent.com/nirholas/pai/main/scripts/flash.sh | sudo bash
```

The script will:
1. Detect your OS
2. Scan for removable USB drives
3. Show you the options and ask you to confirm
4. Stream the ISO directly to the drive (no local file needed)

> **Always inspect scripts before piping to bash**: `curl -fsSL https://raw.githubusercontent.com/nirholas/pai/main/scripts/flash.sh | less`

### Method 2: Manual Download + dd (Linux)

```bash
# Find your USB device
lsblk -d -o NAME,SIZE,MODEL,TRAN | grep usb

# Unmount if mounted
sudo umount /dev/sdX*

# Flash
sudo dd if=pai.iso of=/dev/sdX bs=4M status=progress && sync
```

### Method 3: Manual Download + dd (macOS)

```bash
diskutil list                          # Find your USB
diskutil unmountDisk /dev/diskN        # Unmount it
sudo dd if=pai.iso of=/dev/rdiskN bs=4m && sync   # rdisk = raw (10-20x faster)
diskutil eject /dev/diskN              # Safe to remove
```

### Windows

Open **PowerShell as Administrator** and run:

```powershell
irm https://pai.direct/flash.ps1 | iex
```

The `flash.ps1` script downloads the latest ISO, verifies its SHA256, lets you pick your USB drive, and writes it raw. Requires Windows 10 (build 17763) or later and PowerShell 5.1+.

<details>
<summary>Prefer Winget?</summary>

```powershell
winget install PAI.PAI
pai flash
```

Ships with Windows 10/11. Gives you the `pai` command with `flash`, `try`, `verify`, and more.

</details>

<details>
<summary>Prefer Scoop?</summary>

```powershell
scoop bucket add pai https://github.com/nirholas/scoop-pai
scoop install pai
pai flash
```

</details>

<details>
<summary>Prefer a graphical tool? Use Rufus (alternative)</summary>

1. Download the [PAI ISO](https://get.pai.direct/pai-amd64.iso)
2. Download the [Rufus graphical tool](https://rufus.ie/) (free, open-source, portable — no install needed)
3. Open the Rufus graphical tool → select your USB → select the ISO → click **START**. When prompted, choose **Write in DD Image mode**.
4. Reboot, select USB from boot menu (F12/F2/DEL)

</details>

<details>
<summary>Verify the flasher before running (advanced)</summary>

```powershell
$url = 'https://pai.direct/flash.ps1'
irm "$url.sha256" -OutFile flash.ps1.sha256
irm $url -OutFile flash.ps1
Get-FileHash flash.ps1 -Algorithm SHA256
# Compare the printed hash against flash.ps1.sha256, then:
powershell -ExecutionPolicy Bypass -File .\flash.ps1
```

</details>

### Raspberry Pi

> **⚠️ ARM64 image pending.** The Raspberry Pi Imager manifest is published
> but the first ARM64 `.img.xz` is still in testing for v0.1.0. Once it
> ships, the steps below will work end-to-end. Track progress at
> <https://github.com/nirholas/pai/issues?q=raspberry+pi+image>.

1. Install [Raspberry Pi Imager](https://www.raspberrypi.com/software/).
2. Open Imager, press Ctrl+Shift+X, enable "Use custom repository", paste `https://pai.direct/imager.json`, click OK.
3. Select **PAI — Private AI** from the OS list and flash.

Planned support: Pi 5, Pi 4, Pi 400, Pi Zero 2 W. See [docs](https://docs.pai.direct/first-steps/using-raspberry-pi-imager) for details.

### Ventoy (no-wipe alternative)

Prefer to keep files on your USB drive? Install [Ventoy](https://www.ventoy.net) once, then drag `pai-*-amd64.iso` onto the drive. Full guide: [docs.pai.direct/first-steps/using-ventoy](https://docs.pai.direct/first-steps/using-ventoy).

### Method 5: Stream from Cloud (No Download)

Flash directly without saving the ISO to disk:

```bash
curl -L https://get.pai.direct/pai-amd64.iso \
  | sudo dd of=/dev/sdX bs=4M status=progress && sync
```

### Safety

> ⚠️ **`dd` writes raw bytes to a device. Writing to the wrong device will erase it permanently.**
>
> Always verify your USB device with `lsblk` (Linux) or `diskutil list` (macOS) before flashing. Look for the correct size and `usb` transport type.

### Package Managers

<details>
<summary>Arch Linux (AUR)</summary>

```bash
yay -S pai-cli
# or bleeding-edge:
yay -S pai-cli-git
```

</details>

---

## Build from Source

### Prerequisites

- Docker (with `--privileged` support)
- 32 GB disk space (minimal build) or 64 GB+ (full build)
- ~10 minutes build time (minimal)

### Build

```bash
git clone https://github.com/nirholas/pai.git
cd pai

# Build the Docker image
docker build -f Dockerfile.build -t pai-builder .

# Build the ISO
docker run --privileged --rm \
  -v "$PWD/output:/output" \
  pai-builder

# ISO appears at output/live-image-amd64.hybrid.iso
ls -lh output/*.iso
```

### Build Architecture

```
Dockerfile.build
├── debian:bookworm-slim (base)
├── live-build, debootstrap, squashfs-tools, xorriso
├── grub-pc-bin, grub-efi-amd64-bin
├── isolinux, syslinux-common
└── mtools, dosfstools, ca-certificates, curl, python3

build.sh (runs inside container)
├── lb config (Debian bookworm, amd64, hybrid ISO)
├── lb bootstrap (debootstrap minimal rootfs)
├── lb chroot (install packages + run hooks)
│   ├── config/package-lists/pai.list.chroot
│   └── config/hooks/live/0100–0840-*.hook.chroot
├── Cleanup (strip GPU libs, docs, locales, caches)
└── lb binary (squashfs → ISO)
```

### Customizing the Build

**Add packages**: Edit `config/package-lists/pai.list.chroot`

**Add a build hook**: Create `config/hooks/live/NNNN-description.hook.chroot` (must be executable)

**Include files in the ISO**: Place them under `config/includes.chroot_after_packages/` — the directory structure maps 1:1 to the root filesystem:
```
config/includes.chroot_after_packages/
├── etc/
│   └── systemd/system/my-service.service   → /etc/systemd/system/my-service.service
└── usr/
    └── local/bin/my-script                 → /usr/local/bin/my-script
```

### Hook Reference

| Hook | What It Does |
|---|---|
| `0100-install-ollama` | Installs Ollama binary, pre-creates `ollama` user, strips CUDA/ROCm/Vulkan GPU libs |
| `0200-install-open-webui` | Deploys HTML Chat UI, creates systemd services for Ollama + Chat UI |
| `0300-configure-desktop` | Sway config: Alt+Return=terminal, Alt+d=launcher, waybar, dark theme |
| `0350-auto-login` | Creates `user` with passwordless sudo, auto-login tty1 → sway |
| `0400-plymouth-theme` | Boot splash screen |
| `0450-mac-spoof` | MAC randomization on every boot via NetworkManager + systemd service |
| `0500-firewall` | UFW: deny incoming, allow outgoing, localhost-only for services |
| `0550-tor-config` | Tor transparent proxy — opt-in via `sudo pai-privacy on` |
| `0600-configure-electrum` | Bitcoin wallet with sane defaults (dark theme, auto-connect) |
| `0610-install-monero-wallet` | Monero wallet installation |
| `0650-install-ai-tools` | Additional AI/ML tools |
| `0710-install-dev-languages` | Development language runtimes |
| `0730-install-git-tools` | Git, Git LFS, SSH configuration |
| `0740-configure-terminal` | Terminal enhancements and shell configuration |
| `0750-configure-media` | Media players and codecs |
| `0800-configure-networking-privacy` | Advanced network privacy settings |
| `0830-configure-encryption-privacy` | GnuPG (SHA-512/AES-256 defaults), LUKS configuration |
| `0840-configure-utilities` | System utilities and CLI tools |

---

## User Experience

### What Happens When You Boot

1. **Plug in USB** → select USB from boot menu (F12/F2/DEL at POST)
2. **GRUB loads** → PAI kernel + squashfs decompresses into RAM (~15 sec)
3. **Auto-login** → you arrive at a Sway desktop immediately (no password)
4. **Firefox opens** → pointed at `localhost:8080` (Chat UI)
5. **Chat with AI** → select a model, download it once, and start talking

### Keyboard Shortcuts (Sway)

| Shortcut | Action |
|---|---|
| `Alt + Return` | Open terminal (foot) |
| `Alt + D` | Application launcher |
| `Alt + F4` | Close window |
| `Alt + L` | Lock screen |
| `Alt + Arrow Keys` | Move focus |
| `Alt + Shift + Arrow Keys` | Move windows |
| `Alt + 1-9` | Switch workspace |

### Privacy Commands

```bash
# Enable Tor privacy mode (routes all traffic through Tor)
sudo pai-privacy on

# Disable Tor privacy mode
sudo pai-privacy off

# Check current MAC address
ip link show | grep ether

# Pull an AI model
ollama pull llama3.1

# Chat from the terminal
ollama run llama3.1 "Explain quantum computing in simple terms"
```

---

## Comparisons

### PAI vs Tails

| Feature | Tails | PAI |
|---|---|---|
| **Primary purpose** | Anonymous browsing | Private local AI |
| **Tor integration** | Always-on | Opt-in |
| **AI capabilities** | None | Full local LLM (Ollama) |
| **Desktop** | GNOME | Sway (lighter) |
| **Base** | Debian (custom) | Debian 12 Bookworm |
| **Amnesic** | Yes | Yes |
| **ISO size** | ~1.9 GB | ~912 MB (minimal) |

### PAI vs Running Ollama on Your OS

| Feature | Ollama on Host | PAI |
|---|---|---|
| **Traces left** | Chat logs, model cache, shell history, browser data | None |
| **Network isolation** | You must configure it | Built-in (UFW + MAC spoofing) |
| **Portability** | Tied to one machine | Any x86_64 PC |
| **Forensics resistance** | None | Full (RAM-only) |
| **Setup time** | Install Docker/Ollama, configure firewall, etc. | Boot from USB |

---

## Roadmap

PAI's public roadmap lives in [ROADMAP.md](ROADMAP.md) — a four-phase plan
from polished live USB (v0.2) to installable OS to developer platform.

**Landing in v0.2:**

- First-boot model picker that detects RAM + GPU and suggests the best fit
- Opt-in encrypted persistence (LUKS2 + Argon2id) with a first-boot wizard
- `pai-status` — a privacy/health CLI plus Waybar applet (Ollama, firewall,
  MAC spoof, Tor, outbound connections, persistence state)
- `shellcheck` + `yamllint` + website-build validation in CI
- ARM64 build path alongside amd64

See also: [ETHICS.md](ETHICS.md) — the project's position on dual-use,
scope, and maintainer commitments.

---

## Project Structure

```
pai/
├── Dockerfile.build            # Docker image for building the ISO
├── build.sh                    # Main build script (runs inside Docker)
├── config/
│   ├── hooks/live/             # Build hooks (0100–0840), run in chroot
│   ├── includes.chroot_after_packages/  # Files copied into the rootfs
│   │   ├── etc/                # System configs (systemd, firefox, profile.d)
│   │   ├── opt/                # Application data (chat UI)
│   │   └── usr/                # Binaries and scripts (pai-*, wallpaper)
│   └── package-lists/
│       └── pai.list.chroot   # APT packages to install
├── docs/
│   ├── USB-FLASHING.md         # Comprehensive flash guide
│   └── LANDING-PAGE.md         # Landing page design spec
├── prompts/                    # Build prompts and design docs (00–33)
├── scripts/
│   └── flash.sh                # Auto-flasher: download + detect USB + dd
├── .github/
│   └── workflows/build.yml     # CI build pipeline
├── LICENSE                     # GPL v3
└── README.md                   # This file
```

---

## Contributing

PAI is open source under the [GNU General Public License v3](LICENSE).

Before contributing, please read:

- [CONTRIBUTING.md](CONTRIBUTING.md) — branch, commit, and PR conventions
- [ETHICS.md](ETHICS.md) — what the project will and won't build, and why
- [ROADMAP.md](ROADMAP.md) — where the project is heading
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — community standards

### How to Contribute

1. **Report bugs**: Open an [issue](https://github.com/nirholas/pai/issues)
2. **Add a tool**: Create a new hook in `config/hooks/live/` — use the existing hooks as templates
3. **Improve privacy**: Submit hardening improvements or new privacy features
4. **Test on hardware**: Boot PAI on different machines and report compatibility
5. **Improve documentation**: Fix errors, add guides, translate

### Development Workflow

```bash
# Fork and clone
git clone https://github.com/YOUR-USERNAME/pai.git
cd pai

# Make changes to hooks, package lists, or configs

# Build and test
docker build -f Dockerfile.build -t pai-builder .
docker run --privileged --rm -v "$PWD/output:/output" pai-builder

# Test the ISO in QEMU
qemu-system-x86_64 -cdrom output/live-image-amd64.hybrid.iso -m 4096 -enable-kvm

# Submit a PR
git add -A && git commit -m "Add feature X" && git push origin main
```

---

## Technical References

### Why Debian 12?

- **Stability** — Bookworm is a stable release with 5 years of security updates
- **live-build toolchain** — first-class support for generating live ISOs
- **Package ecosystem** — 59,000+ packages available via APT
- **Track record** — Tails, Kali, and Parrot are all Debian-based for the same reasons

### Why Sway?

- **Wayland-native** — no X11 security issues (X11 allows any app to keylog any other app)
- **Minimal footprint** — ~50 MB RAM vs ~300 MB for GNOME
- **Tiling** — keyboard-driven workflow, no mouse needed
- **i3-compatible config** — familiar to Linux power users

### Why Ollama?

- **Simple API** — `ollama pull model && ollama run model`
- **GGUF support** — runs quantized models efficiently on CPU
- **No dependencies** — single binary, no Python, no CUDA runtime
- **Model library** — Llama, Mistral, Phi, Gemma, Qwen, CodeLlama, DeepSeek, and hundreds more

### Why Not Open WebUI?

Open WebUI is excellent but requires ~1.2 GB of Node.js dependencies and a Python backend. For a minimal live USB where every megabyte counts, a lightweight HTML chat interface served by Python's built-in `http.server` achieves the same UX at a fraction of the size.

---

## FAQ

**Q: Can I save my AI conversations across reboots?**
A: Not yet. PAI is amnesic by default — everything is wiped on shutdown. Encrypted persistent storage is on the roadmap.

**Q: What AI models can I run?**
A: Any model supported by Ollama — Llama 3.1, Mistral, Phi-3, Gemma, Qwen, DeepSeek, CodeLlama, and more. Use `ollama pull <model>` to download.

**Q: How much RAM do I need for AI?**
A: 4 GB minimum for small models (Phi-3 Mini). 8 GB for 7B parameter models. 16 GB+ for 13B+ models.

**Q: Does PAI touch my hard drive?**
A: No. PAI runs entirely from RAM and the USB drive. Your host OS's hard drive is never mounted.

**Q: Can I use PAI on a Mac?**
A: On Intel Macs, yes — boot from USB via Option key at startup. Apple Silicon (M1/M2/M3) is not supported yet (ARM64 build is on the roadmap).

**Q: Is this like Tails?**
A: Similar philosophy — amnesic, live USB, privacy-focused. But PAI's primary goal is **private local AI**, not anonymous browsing. PAI includes Tor as opt-in; Tails routes everything through Tor by default.

**Q: Can I install PAI permanently on a hard drive?**
A: Not currently. PAI is designed as a live system. Persistent installation may be supported in the future.

**Q: How is this different from just installing Linux + Ollama?**
A: Portability and amnesia. PAI leaves no trace on the machine, requires no installation, and works on any x86_64 PC you can boot from USB. It's the difference between a tent and a house — one you carry with you.

---

## License

PAI is free software released under the [GNU General Public License v3.0](LICENSE).

You are free to use, modify, and distribute PAI. All included software retains its respective license (Debian packages are DFSG-compliant, Ollama is MIT-licensed).

---


