---
title: Boot chain
description: Firmware to session — UEFI, shim, GRUB, kernel, initramfs, systemd.
order: 6
updated: 2026-04-20
---

# Boot chain

The overview in [overview.md](overview.md#boot-chain) gives the
five-line summary. This page walks each stage.

## 1. Firmware

The firmware (UEFI on modern hardware, legacy BIOS on older x86) is
asked — by the user in the boot picker — to load from the USB medium.
Under UEFI, it reads the EFI system partition and executes
`EFI/BOOT/BOOTX64.EFI` (AMD64) or `EFI/BOOT/BOOTAA64.EFI` (ARM64).

Secure Boot, when enabled, requires a signed bootloader. PAI ships
`shim` which is signed by Microsoft's UEFI CA and in turn loads the
signed GRUB image.

## 2. GRUB

GRUB reads `grub.cfg` baked into the ISO. The menu offers:

- **Default** — normal boot.
- **Safe graphics** — `nomodeset`, useful on bleeding-edge GPUs.
- **Memtest** — memtest86+.

The kernel command line on the default entry is roughly:

```
boot=live components persistence persistence-encryption=luks quiet splash
```

`boot=live` tells the initramfs to look for a squashfs. `persistence`
enables the persistence search. `persistence-encryption=luks`
restricts persistence to LUKS volumes.

## 3. Kernel + initramfs

The Linux kernel loads, hardware detection runs, and the initramfs is
mounted. The initramfs (built by live-boot) is responsible for:

1. Finding the live medium (by label `PAI_LIVE`).
2. Mounting the squashfs at `/lib/live/mount/rootfs/` read-only.
3. Scanning attached block devices for a LUKS volume labelled
   `pai-persist` and, if found, prompting for the passphrase.
4. Setting up the overlayfs stack (see [storage.md](storage.md)).
5. Switching root into the merged view and handing off to systemd.

If no persistence volume exists or the user declines to unlock,
the upper layer is a tmpfs and the system boots in amnesic mode.

## 4. systemd

systemd takes over at the switch-root and brings up targets in order:

| Stage              | Notable units                                                |
| ------------------ | ------------------------------------------------------------ |
| Early              | `mac-randomize.service`, `ufw.service`                       |
| Network            | `NetworkManager.service`, `systemd-timesyncd` (or Tor-NTP)   |
| Optional privacy   | `tor.service` (if enabled at boot or by user)                |
| AI                 | `ollama.service` (user scope, on session start)              |
| Session            | `greetd.service` → Sway                                      |

Firewall and MAC randomisation come up **before** any network unit,
so the machine never exposes its hardware MAC or accepts inbound
traffic during boot.

## ARM64 differences

- Bootloader is `BOOTAA64.EFI`; the shim chain is the same.
- GRUB uses the same `grub.cfg`, parameterised by architecture.
- Some ARM64 boards need a device tree passed via GRUB. The ISO
  carries DTBs for the boards listed in [general/system-requirements.md](../general/system-requirements.md).

## Troubleshooting

Boot problems — black screen, no EFI entry, kernel panic —
are covered in [advanced/troubleshooting.md](../advanced/troubleshooting.md).
