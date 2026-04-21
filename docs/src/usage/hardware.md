---
title: Hardware on PAI
description: What works, what doesn't, and how to check your machine before you flash.
audience: new users
sidebar_order: 7
---

# Hardware on PAI

PAI is a general-purpose Debian-based live distro, so most hardware
from the last decade works. A few things are worth knowing before
you flash.

## Quick compatibility check

If you have **any** of:

- A 64-bit CPU (Intel Core i3/i5/i7 from 2013 onwards, Ryzen,
  Apple Silicon via UTM, Raspberry Pi 4/5, typical ARM servers).
- 8 GB RAM minimum (16 GB recommended for larger LLMs).
- A USB 3.0 port (USB 2.0 works but is slow).

…PAI will almost certainly boot. For the exhaustive list, see
[../general/system-requirements.md](../general/system-requirements.md).

## GPU support

| GPU                    | Status         | Notes                                  |
| ---------------------- | -------------- | -------------------------------------- |
| Intel integrated       | Works          | Mesa drivers                           |
| AMD (recent)           | Works          | Mesa + ROCm for Ollama                 |
| NVIDIA (proprietary)   | Extra step     | See [../advanced/gpu-setup.md](../advanced/gpu-setup.md) |
| Apple Silicon (bare)   | No             | Boot PAI under UTM instead             |

Without a GPU, Ollama runs CPU-only — slower, but everything works.

## Peripherals

- **Keyboard / mouse / trackpad**: anything USB or PS/2. Bluetooth
  needs pairing after boot.
- **Wi-Fi**: any card Debian stable supports. Broadcom and some
  Realtek chips need the non-free firmware, which is included in
  the PAI image.
- **Webcams / microphones**: work, but they're blacklisted at
  udev level by default. Re-enable per session in
  [../apps/](../apps/) settings.

## Hardware wallets

Ledger, Trezor, Coldcard, Keystone, and Jade all work via USB.
udev rules ship with the ISO.

## Unsupported / known bad

- Machines with **Intel VMD RAID** enabled in BIOS. Switch to AHCI.
- Some **Surface Pro** tablets need `iomem=relaxed` on the kernel
  cmdline.
- T2-era Macs (2018–2020) need a specific boot flow, covered in
  [../first-steps/starting-on-mac.md](../first-steps/starting-on-mac.md).

## Running in a VM

If bare-metal doesn't work or you want a sandbox, run PAI inside
UTM, VirtualBox, VMware, Hyper-V, or QEMU/KVM. See
[../advanced/running-in-a-vm.md](../advanced/running-in-a-vm.md).

## USB medium

- Use a **USB 3.0** stick of at least **16 GB**. Larger is fine;
  persistence will grow to fill the extra space.
- Cheap no-brand sticks will work but wear out fast. PAI is
  append-heavy when persistence is on.
- Flashing instructions: [../USB-FLASHING.md](../USB-FLASHING.md).
