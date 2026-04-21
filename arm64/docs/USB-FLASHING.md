# PAI — USB Flashing Guide

## Overview

PAI is a bootable Debian 12 live USB with Sway, Ollama, and a local Chat UI. This document covers every method for getting the PAI ISO onto a USB drive — from the simplest to the most automated.

---

## Table of Contents

1. [Browser-Based Flashing — Why It Doesn't Work (Yet)](#browser-based-flashing)
2. [Option 1: Stream Directly from Cloud to USB](#option-1-stream-directly-from-cloud-to-usb)
3. [Option 2: Download ISO + Flash Manually](#option-2-download-iso--flash-manually)
4. [Option 3: One-Command Auto-Flasher Script](#option-3-one-command-auto-flasher-script)
5. [Option 4: GitHub Releases + Landing Page](#option-4-github-releases--landing-page)
6. [Option 5: Windows — `flash.ps1` (recommended) + Rufus graphical alternative](#option-5-rufus-windows)
7. [Platform-Specific Instructions](#platform-specific-instructions)
8. [Safety Warnings](#safety-warnings)
9. [Architecture Notes](#architecture-notes)

---

## Browser-Based Flashing

### The Dream

A website where users plug in a USB drive, click "Flash", and PAI writes directly to the drive — no downloads, no tools, no terminal.

### Why It's Not Possible Today

**WebUSB API** (supported in Chrome/Edge) allows websites to communicate with USB devices, but it **cannot write to USB mass storage devices**. The operating system kernel maintains exclusive control over mass storage block devices, preventing any browser API from accessing raw blocks.

| Technology | Can Flash USB? | Why / Why Not |
|---|---|---|
| **WebUSB API** | No | OS kernel claims mass storage devices exclusively. Works for specialized devices (Arduino, etc.) but not bulk storage. |
| **Web Serial API** | No | Designed for serial devices (COM ports), not USB drives. |
| **File System Access API** | No | Can read/write files on the user's filesystem, but cannot write raw blocks to a device. |
| **Chrome Extensions** | Partially | Google's Chromebook Recovery Utility does this as a Chrome extension — but it uses native messaging and platform-specific binaries under the hood. Not a pure web solution. |

### The Fundamental Limitation

USB mass storage devices are claimed by the OS kernel the moment they're plugged in. The kernel mounts a filesystem driver on top of the raw block device, and no browser sandbox can bypass this. Writing an ISO requires **raw block-level access** (`/dev/sdX` on Linux, `\\.\PhysicalDriveN` on Windows), which is a privileged operation that browsers intentionally cannot perform.

### What We Can Do Instead

Build a **web-based experience** that gets as close as possible:
- Auto-detect the user's OS
- Provide a copy-paste one-liner or a tiny downloadable flasher
- Host the ISO on a CDN/GitHub Releases for fast delivery

---

## Option 1: Stream Directly from Cloud to USB

**No ISO file touches your local disk.** The ISO streams over HTTPS directly into the USB block device.

### Prerequisites
- A running PAI server (Codespace, VPS, or local) serving the ISO over HTTP
- Terminal access on the machine with the USB drive

### Setup — Start the ISO Server

On the machine hosting the ISO:
```bash
cd /path/to/output && python3 -m http.server 8888
```

Or, if using GitHub Releases:
```
https://github.com/nirholas/pai/releases/latest/download/pai.iso
```

### Flash — Linux
```bash
# Identify your USB device
lsblk

# Stream and flash (replace /dev/sdX with your USB device)
curl -L https://YOUR-ISO-URL/live-image-amd64.hybrid.iso | sudo dd of=/dev/sdX bs=4M status=progress
sync
```

### Flash — macOS
```bash
# Identify your USB device
diskutil list

# Unmount it first
diskutil unmountDisk /dev/diskN

# Stream and flash (use rdiskN for raw speed)
curl -L https://YOUR-ISO-URL/live-image-amd64.hybrid.iso | sudo dd of=/dev/rdiskN bs=4m
sync
```

### Flash — Windows (PowerShell as Admin)
```powershell
# Find your USB disk number
Get-Disk

# Stream directly
curl.exe -L "https://YOUR-ISO-URL/live-image-amd64.hybrid.iso" -o \\.\PhysicalDriveX
```

> **Note:** On Windows, this method is less reliable. Use `flash.ps1` (Option 5), which is the recommended Windows path — the graphical Rufus alternative is also documented there.

---

## Option 2: Download ISO + Flash Manually

The traditional approach. Download the ISO, then write it to USB.

### Download

**From GitHub Releases (when available):**
```bash
curl -LO https://github.com/nirholas/pai/releases/latest/download/pai.iso
```

**From a Codespace:**
```bash
# Inside the Codespace, start a file server:
cd /workspaces/addie/pai-minimal/output && python3 -m http.server 8888

# Then open the forwarded port URL in your browser (VS Code Ports tab)
# and click the ISO filename to download
```

### Flash — Linux
```bash
# Identify USB device
lsblk

# Write ISO (replace /dev/sdX)
sudo dd if=pai.iso of=/dev/sdX bs=4M status=progress
sync
```

### Flash — macOS
```bash
diskutil list
diskutil unmountDisk /dev/diskN
sudo dd if=pai.iso of=/dev/rdiskN bs=4m
sync
```

### Flash — Windows
Run `irm https://pai.direct/flash.ps1 | iex` in an elevated PowerShell (recommended — see [Option 5](#option-5-rufus-windows)). Graphical alternatives: the Rufus graphical tool, [Etcher](https://etcher.balena.io/), or the `dd` equivalent in WSL.

---

## Option 3: One-Command Auto-Flasher Script

A single `curl | bash` command that downloads the ISO, detects USB drives, lets the user pick one, and flashes it.

### Usage
```bash
curl -fsSL https://pai.direct/flash | sudo bash
```

Or from GitHub:
```bash
curl -fsSL https://raw.githubusercontent.com/nirholas/pai/main/scripts/flash.sh | sudo bash
```

### What the Script Does

1. Detects the OS (Linux/macOS)
2. Lists available removable USB drives
3. Prompts the user to select a drive
4. Confirms the selection (shows drive size/model as a safety check)
5. Downloads the latest ISO from GitHub Releases
6. Writes it to the selected drive with `dd`
7. Runs `sync` to ensure all data is flushed

See [`scripts/flash.sh`](../scripts/flash.sh) for the implementation.

### Security Notes

- The script requires `sudo` because writing to block devices is a privileged operation
- Users should **always inspect scripts before piping to bash**: `curl -fsSL https://pai.direct/flash | less`
- The script only writes to the user-selected device — it never auto-detects and flashes without confirmation

---

## Option 4: GitHub Releases + Landing Page

The most scalable distribution method. No server required.

### GitHub Releases

1. Upload the ISO as a release asset on [nirholas/pai](https://github.com/nirholas/pai)
2. GitHub hosts files up to **2GB for free** per release
3. Gives users a permanent, versioned download URL:
   ```
   https://github.com/nirholas/pai/releases/latest/download/pai.iso
   ```

### Landing Page (GitHub Pages / Vercel / Netlify)

A simple website at `pai.direct` (or similar) that:

1. **Auto-detects the visitor's OS** via `navigator.userAgent`
2. **Shows the appropriate instructions:**
   - **Linux**: One-liner `curl | dd` command, pre-filled with the download URL
   - **macOS**: Same, with macOS-specific device paths (`/dev/rdiskN`)
   - **Windows**: The PowerShell one-liner `irm https://pai.direct/flash.ps1 | iex`, with a graphical Rufus alternative collapsed below
3. **Provides the auto-flasher script** as a second option
4. **Shows system requirements**: 2GB+ USB drive, x86_64 machine

### Landing Page Mockup

```
┌─────────────────────────────────────────────┐
│                                             │
│           🔒 PAI                │
│   Private AI on a bootable USB drive        │
│                                             │
│   ┌─────────────────────────────────────┐   │
│   │ We detected you're on: Linux        │   │
│   │                                     │   │
│   │ One-command flash:                  │   │
│   │ ┌─────────────────────────────────┐ │   │
│   │ │ curl -fsSL https://pai.direct/     │ │   │
│   │ │ flash | sudo bash              │ │   │
│   │ └──────────────────────── [Copy]──┘ │   │
│   │                                     │   │
│   │ Or download the ISO (912 MB):       │   │
│   │         [ Download PAI ]            │   │
│   └─────────────────────────────────────┘   │
│                                             │
│   Requirements: 2GB+ USB · x86_64 PC       │
│   Source: github.com/nirholas/pai           │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Option 5: Windows — `flash.ps1` (recommended) and the Rufus graphical alternative

### `flash.ps1` — PowerShell one-liner (recommended)

Open **PowerShell as Administrator** and run:

```powershell
irm https://pai.direct/flash.ps1 | iex
```

`flash.ps1` downloads the latest PAI ISO, verifies its SHA256, lets you pick your USB drive, and writes it raw — no extra tools required. Requires Windows 10 (build 17763) or newer and PowerShell 5.1+.

#### Verify before run (advanced)

```powershell
$url = 'https://pai.direct/flash.ps1'
irm "$url.sha256" -OutFile flash.ps1.sha256
irm $url -OutFile flash.ps1
Get-FileHash flash.ps1 -Algorithm SHA256
# Compare the printed hash to flash.ps1.sha256, then:
powershell -ExecutionPolicy Bypass -File .\flash.ps1
```

### Rufus graphical tool (alternative)

The [Rufus graphical tool](https://github.com/pbatard/rufus) is a free, open-source alternative for users who prefer a GUI. It works with any ISO.

#### Steps

1. Download the Rufus graphical tool from [rufus.ie](https://rufus.ie/) (or `winget install Rufus.Rufus`)
2. Download the PAI ISO from GitHub Releases
3. Open the Rufus graphical tool
4. **Device**: Select your USB drive
5. **Boot selection**: Click "SELECT" → choose the PAI ISO
6. **Partition scheme**: GPT (for UEFI) or MBR (for legacy BIOS)
7. Click **START** — choose **Write in DD Image mode** when prompted
8. Wait for completion, then boot from the USB

### Rufus — portable alternative

The Rufus graphical tool also comes as a portable `.exe` — no installation needed. Users can download it alongside the ISO and run it directly.

---

## Platform-Specific Instructions

### Linux

```bash
# 1. Identify your USB drive
lsblk -d -o NAME,SIZE,MODEL,TRAN | grep usb

# 2. Unmount if mounted
sudo umount /dev/sdX*

# 3. Flash (choose one):

# Option A: Download then flash
curl -LO https://github.com/nirholas/pai/releases/latest/download/pai.iso
sudo dd if=pai.iso of=/dev/sdX bs=4M status=progress && sync

# Option B: Stream directly (no local file)
curl -L https://github.com/nirholas/pai/releases/latest/download/pai.iso | sudo dd of=/dev/sdX bs=4M status=progress && sync

# Option C: Auto-flasher
curl -fsSL https://raw.githubusercontent.com/nirholas/pai/main/scripts/flash.sh | sudo bash
```

### macOS

```bash
# 1. Identify your USB drive
diskutil list

# 2. Unmount
diskutil unmountDisk /dev/diskN

# 3. Flash (use rdiskN for 10-20x faster writes)
curl -L https://github.com/nirholas/pai/releases/latest/download/pai.iso | sudo dd of=/dev/rdiskN bs=4m && sync

# 4. Eject
diskutil eject /dev/diskN
```

### Windows

Open **PowerShell as Administrator** and run (recommended):

```powershell
irm https://pai.direct/flash.ps1 | iex
```

Graphical alternative — the Rufus tool:

1. Download the [PAI ISO](https://github.com/nirholas/pai/releases/latest/download/pai.iso)
2. Download the [Rufus graphical tool](https://rufus.ie/)
3. Run the Rufus graphical tool → Select USB → Select ISO → Start (choose **DD Image mode**)
4. Reboot and select USB from boot menu (usually F12/F2/DEL at startup)

### Chromebook (via Linux/Crostini)

```bash
# Enable Linux (Settings → Advanced → Developers → Linux → Turn On)
# Then use the Linux terminal:
curl -fsSL https://raw.githubusercontent.com/nirholas/pai/main/scripts/flash.sh | sudo bash
```

---

## Safety Warnings

⚠️ **`dd` will destroy all data on the target device. There is no undo.**

Before flashing:
1. **Back up** any important data on the USB drive
2. **Triple-check** the device name — `dd` to the wrong device will erase that disk (including your OS drive)
3. **Verify device size** — your USB drive should match the expected size in `lsblk`/`diskutil`
4. **Unmount** the device before writing — do NOT write to a mounted device
5. **Use `sync`** after `dd` to ensure all data is flushed before removing the drive

### How to Identify Your USB Drive

| OS | Command | What to Look For |
|---|---|---|
| Linux | `lsblk -d -o NAME,SIZE,MODEL,TRAN` | `TRAN` column shows `usb` |
| macOS | `diskutil list` | `(external, physical)` label |
| Windows | `Get-Disk` | `Bus Type: USB` |

---

## Architecture Notes

### Why a Hybrid ISO?

The PAI ISO is built as a **hybrid ISO** (`live-image-amd64.hybrid.iso`), meaning it can be:
- **Burned to a DVD/CD** (standard ISO 9660)
- **Written to a USB drive** (raw `dd` — contains a valid MBR/GPT partition table)
- **Booted in a VM** (attach as virtual optical drive)

This is handled automatically by `live-build` with the `--binary-image iso-hybrid` setting.

### Why Not Use Etcher/Ventoy/etc.?

You can! PAI works with any ISO-to-USB tool:
- [Etcher](https://etcher.balena.io/) — GUI, cross-platform, open-source
- [Ventoy](https://ventoy.net/) — multi-ISO USB, just copy the ISO file
- [USBImager](https://bztsrc.gitlab.io/usbimager/) — minimal GUI, 300KB
- `dd` — no install needed, available on every Unix system

We recommend `dd` or the auto-flasher script because they require zero additional software.

### ISO Size

| Build | Size | Packages |
|---|---|---|
| Minimal | ~912 MB | ~20 packages (Sway, Firefox, Ollama, networking) |
| Full | ~4-6 GB | 100+ packages (Tor, crypto wallets, dev tools, media) |

The minimal build fits on any USB drive 2GB or larger. The full build requires a 64GB+ disk to build and 8GB+ USB to flash.
