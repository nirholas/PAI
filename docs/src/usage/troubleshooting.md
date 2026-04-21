---
title: Troubleshooting
description: Quick index for common problems. Deep-dives live under Advanced.
audience: everyone
sidebar_order: 10
---

# Troubleshooting

The symptoms below link into the full
[../advanced/troubleshooting.md](../advanced/troubleshooting.md)
reference. Start here if you want a quick pointer; go there for the
detailed walk-through.

## Won't boot

- **Nothing happens when I select the USB in the boot picker** —
  firmware didn't pick up the ISO. Re-flash, or try the other
  architecture ISO.
- **Black screen after GRUB** — pick the "safe graphics" entry.
- **Kernel panic on boot** — often an old machine without PAE or an
  incompatible RAID mode. Switch BIOS RAID from RST to AHCI.
- **T2 Macs / Apple Silicon** — use the Mac-specific path in
  [../first-steps/starting-on-mac.md](../first-steps/starting-on-mac.md).

See
[../advanced/troubleshooting.md#boot-problems](../advanced/troubleshooting.md).

## Wi-Fi doesn't work

- **No networks listed** — the firmware for your Wi-Fi chipset
  isn't loaded. Check `dmesg | grep -i firmware`. Most chips are
  covered; Broadcom sometimes needs extra.
- **Connects but no internet** — check the firewall. If strict Tor
  mode is on and Tor failed to bootstrap, the kill-switch is
  working as designed. Disable strict mode or restart Tor.

## AI / Ollama issues

- **"Model not found"** — pull it first: `ollama pull llama3.2`.
- **Runs CPU-only on an NVIDIA machine** — the proprietary driver
  isn't installed. See
  [../advanced/gpu-setup.md](../advanced/gpu-setup.md).
- **Out of RAM** — pick a smaller model. See
  [../ai/choosing-a-model.md](../ai/choosing-a-model.md).

## Persistence issues

- **"LUKS volume not detected"** — the partition label must be
  `pai-persist`. Recreate if it was renamed.
- **Forgot the passphrase** — there is no recovery. That's the
  design.

## Hardware wallet not recognised

- udev rules shipped in the ISO cover the common vendors. If your
  device is new, check `lsusb`; if it's there, you may need to
  logout/login or add yourself to the `plugdev` group (only needed
  in persistence-on sessions).

## Where to get help

- [../reference/faq.md](../reference/faq.md) — frequently asked.
- [../KNOWN_ISSUES.md](../KNOWN_ISSUES.md) — known-broken things we
  haven't fixed yet.
- GitHub Issues: [nirholas/pai](https://github.com/nirholas/pai/issues).
