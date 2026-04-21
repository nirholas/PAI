---
title: Installation
description: Download, verify, flash, and boot PAI — with optional encrypted persistence.
order: 2
updated: 2026-04-17
---

# Installation

PAI is a **live USB operating system**, not a traditional install. You
write the ISO to a USB stick, boot from it, and optionally enable an
encrypted persistence container so your home directory, keys, and
wallets survive reboots. Nothing is written to the host computer's
internal drive unless you explicitly ask for it.

This page walks through hardware requirements, download and
verification, flashing on Linux / macOS / Windows, booting on real
hardware, and enabling persistence on first boot.

---

## 1. Hardware requirements

PAI is small (~2.5 GB ISO) but runs local LLMs, so the usable minimum
is set by Ollama, not the desktop.

### x86_64

| Tier        | CPU                              | RAM    | USB stick | Notes |
|-------------|----------------------------------|--------|-----------|-------|
| Minimum     | 64-bit x86 (2015+), 2 cores      | 4 GB   | 8 GB      | 1–3B models only, slow |
| Recommended | 4+ cores, AVX2                   | 8 GB   | 16 GB     | 7B models at usable speed |
| Tested      | Intel i5/i7 10th gen+, Ryzen 5/7 | 16 GB  | 32 GB USB 3.1+ | 13B models comfortable |

UEFI firmware is preferred. Legacy BIOS boot works but is not the
default test target.

### ARM64 SBC

PAI publishes a separate `arm64` ISO. Tested boards:

- Raspberry Pi 4 (4 GB / 8 GB) — reference target
- Raspberry Pi 5 (4 GB / 8 GB / 16 GB) — fastest SBC target
- Orange Pi 5 / 5 Plus (RK3588) — works, GPU unused
- Pine64 RockPro64 — boots, slower than RPi 5
- Radxa Rock 5B — works, community-tested

SBCs with less than 4 GB RAM can boot PAI but cannot load any useful
model. Use a class A2 microSD card or, better, a USB 3 SSD.

---

## 2. Download

Releases live on GitHub. Each release ships three files per edition and
architecture:

```
pai-<edition>-<version>-<arch>.iso
pai-<edition>-<version>-<arch>.iso.sha256
pai-<edition>-<version>-<arch>.iso.minisig
```

Latest ISOs are served from the PAI CDN:

```
https://get.pai.direct/pai-amd64.iso
https://get.pai.direct/pai-arm64.iso
```

Companion files (SHA-256 and signature) live at the same prefix:

```
https://get.pai.direct/pai-amd64.iso.sha256
https://get.pai.direct/pai-amd64.iso.asc
```

Pick the edition that matches your use case — see
[editions.md](editions.md). If unsure, start with `base`.

Download all three files to the same directory.

---

## 3. Verification

Verification answers two different questions. Run both checks.

### 3a. `sha256sum -c` — "did the download arrive intact?"

```
cd ~/Downloads
sha256sum -c pai-base-0.1.0-amd64.iso.sha256
```

Expected output:

```
pai-base-0.1.0-amd64.iso: OK
```

This proves the bytes on disk match the bytes the release workflow
hashed. It does **not** prove the release is genuine — a tampered
mirror would happily match its own checksum.

### 3b. `minisign -Vm` — "is this really from the PAI maintainers?"

> **v0.1.0 note:** minisign signatures are not published for v0.1.0.
> Integrity verification via `sha256sum` (step 3a) is the only
> verification step available on this release. Authenticity
> verification via `minisign` becomes available starting v0.2, once
> the release keypair is provisioned. The commands below describe the
> target workflow.

```
minisign -Vm pai-base-0.1.0-amd64.iso -P RWQ...paste-public-key-here...
```

Or, with the key pinned to a file:

```
minisign -Vm pai-base-0.1.0-amd64.iso -p pai-release.pub
```

Expected output:

```
Signature and comment signature verified
Trusted comment: pai base 0.1.0 amd64 built 2026-04-17
```

The PAI release public key is published at
[`SECURITY.md`](security.md) and mirrored in the repository root as
`pai-release.pub`. Pin it **once**, out of band, and reuse the pinned
copy for every future release.

If either check fails, stop. Do not flash the image.

---

## 4. Flashing — Linux

Identify the target device first. **This step is the one that deletes
data when you get it wrong.**

```
lsblk -d -o NAME,SIZE,MODEL,TRAN
```

Pick the removable device — typically `/dev/sdX` or `/dev/mmcblkX`.
Unmount any mounted partitions on it:

```
sudo umount /dev/sdX?*
```

Write the ISO:

```
sudo dd if=pai-base-0.1.0-amd64.iso of=/dev/sdX bs=4M conv=fsync status=progress
sync
```

Warnings:

- `of=` takes the **whole device**, not a partition (`/dev/sdb`, not
  `/dev/sdb1`).
- Typo-ing `/dev/sda` when you meant `/dev/sdb` will overwrite your
  system disk. Re-read `lsblk` output before pressing Enter.
- Do not use compressed copies (`.iso.gz`) with `dd` — decompress first.

For a guided alternative, GNOME Disks and KDE Partition Manager both
offer "Restore Disk Image" which wraps `dd` safely.

---

## 5. Flashing — macOS

List disks:

```
diskutil list
```

Find the external USB device — e.g. `/dev/disk4`. Unmount (do not
eject) so the block device stays available:

```
diskutil unmountDisk /dev/disk4
```

Write using the **raw** device (`rdisk`, not `disk`) — it is an order
of magnitude faster:

```
sudo dd if=pai-base-0.1.0-amd64.iso of=/dev/rdisk4 bs=4m status=progress
sync
diskutil eject /dev/disk4
```

If `dd` prints `Resource busy`, re-run `diskutil unmountDisk`. If
macOS's "disk is not readable" popup appears mid-write, click
**Ignore**, not Eject or Initialize.

---

## 6. Flashing — Windows

### `flash.ps1` — PowerShell one-liner (recommended)

Open **PowerShell as Administrator** and run:

```powershell
irm https://pai.direct/flash.ps1 | iex
```

`flash.ps1` downloads the latest PAI ISO, verifies its SHA256, lets you pick your USB drive, and writes it raw. Requires Windows 10 (build 17763) or newer and PowerShell 5.1+.

### Rufus (graphical alternative)

1. Download the Rufus graphical tool 4.x from https://rufus.ie.
2. Insert the USB stick.
3. Pick the PAI ISO. The Rufus graphical tool detects it as a hybrid ISO and
   prompts for write mode — **choose "Write in DD Image mode"**. ISO mode
   will not boot.
4. Partition scheme: GPT for UEFI targets, MBR for legacy.
5. Start. The graphical Rufus tool wipes the drive and writes the image.

### BalenaEtcher

1. Download from https://etcher.balena.io.
2. Select the ISO, select the USB stick, click Flash.
3. Etcher uses DD mode by default; no extra configuration needed.

Windows Disk Management does **not** work — it cannot write hybrid
ISOs. Ignore any "you need to format the disk" prompts after flashing;
Windows cannot read the Linux filesystem.

---

## 7. Booting

Plug the USB stick in before powering on. Enter the firmware boot menu
with the vendor-specific shortcut:

| Vendor           | Boot menu key      | Firmware setup key |
|------------------|--------------------|--------------------|
| Dell             | F12                | F2                 |
| HP               | F9                 | Esc then F10       |
| Lenovo ThinkPad  | F12                | F1                 |
| Lenovo IdeaPad   | F12 or Novo button | F2                 |
| Acer             | F12                | F2                 |
| ASUS             | F8 (laptop) / F11  | Del                |
| MSI              | F11                | Del                |
| Samsung          | F12                | F2                 |
| Apple Intel Mac  | Option (⌥)         | —                  |
| Generic desktop  | F12 or F8          | Del or F2          |

### UEFI vs legacy BIOS

PAI ships a hybrid image that boots both. On UEFI systems choose the
USB entry prefixed `UEFI:` — you'll get the Sway desktop with proper
resolution and faster early boot. Legacy/CSM boot still works for
older machines.

### Secure Boot

**Disable Secure Boot for now.** PAI's kernel and signed shim chain is
on the roadmap but not shipping in 0.1.x. If the machine refuses to
boot the USB, Secure Boot is almost always the cause — enter firmware
setup and disable it, or switch to "Other OS" mode.

### ARM64 SBCs

For Raspberry Pi, write the `arm64` ISO to a microSD or USB SSD, insert
it, and power on — the firmware picks up the image automatically. For
Orange Pi / Rock boards, you may need to flash the vendor's U-Boot to
SPI first; see [troubleshooting.md](advanced/troubleshooting.md).

---

## 8. Enabling persistence

By default PAI runs entirely in RAM — reboot erases everything.
Persistence stores your home directory, wallets, keys, and config in
an encrypted LUKS container on spare space of the same USB stick.

On first boot, PAI's welcome screen asks whether to enable persistence.
If you say yes:

1. Pick a passphrase. **Minimum 6 diceware words** (≈77 bits). Shorter
   passphrases are rejected by the setup script. See
   [prompts/10-encrypted-persistence.md](../prompts/10-encrypted-persistence.md)
   for the container layout and KDF parameters.
2. Choose container size — default is all remaining free space on the
   USB stick after the live-image partition.
3. Wait for format + key derivation (Argon2id, deliberately slow — 30s
   to 2 min on modern hardware).
4. The container mounts at `/home/pai` on subsequent boots after you
   enter the passphrase.

The passphrase is not recoverable. Write it down on paper and store it
somewhere you'd store a house key.

If you skip persistence at first boot, you can enable it later by
running `sudo pai-persistence-setup` from a terminal.

---

## 9. Upgrading

Upgrades are **re-flash, not in-place**:

1. Download the new ISO + signatures and verify (steps 2–3 above).
2. `dd` the new ISO over the live-image partition of the same stick,
   or flash a second stick and migrate.
3. Boot. PAI detects the existing persistence container, prompts for
   your passphrase, and mounts it — your home directory, wallets, and
   settings carry over unchanged.

Persistence format is versioned. Breaking changes are announced in
[MIGRATION.md](MIGRATION.md) with an explicit migration path; minor
releases are backward-compatible.

---

## 10. Uninstalling

There is nothing installed on the host — pull the USB stick out and
the machine boots its normal OS on next power-on.

To dispose of a PAI stick that held persistence, overwrite it before
handing it on:

```
sudo shred -v -n 1 -z /dev/sdX
```

`-n 1 -z` does one random pass plus a final zero pass — enough for
flash media, where multi-pass shred doesn't buy you anything because
of wear levelling. For stronger guarantees, physically destroy the
stick.

---

## 11. Troubleshooting installation

Boot fails, black screen, Wi-Fi missing, persistence prompt never
appears — see [troubleshooting.md](advanced/troubleshooting.md) for the full
decision tree. When opening an issue, include the output of
`lsblk`, the exact vendor/model of the USB stick, and the first ten
lines of `dmesg` after the failure.
