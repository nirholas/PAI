---
title: "Try PAI in a local VM — no USB required"
description: "Run PAI instantly in a local VM using the try.sh / try.ps1 one-liner. Full offline AI in 30 seconds, no flashing, no reboot."
---

The fastest way to see PAI is in a local VM. This page walks through what the
one-liner does, the hardware it needs, and how the VM experience differs from
a real USB boot.

## One-liner

=== "Linux / macOS"

    ```bash
    curl -fsSL https://pai.direct/try | bash
    ```

=== "Windows"

    ```powershell
    irm https://pai.direct/try.ps1 | iex
    ```

## Requirements

- 8 GB RAM (4 GB minimum, pass `--ram 4096` and `--force-low-ram`)
- 5 GB free disk for the cached ISO
- CPU with virtualization extensions enabled in BIOS (VT-x/AMD-V)
- Linux: KVM access (user in the `kvm` group)
- macOS: any modern Intel or Apple Silicon Mac
- Windows: WHPX enabled (`Enable-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform`)

## What the script does

1. Downloads the latest PAI ISO from the GitHub release page.
2. Verifies its SHA256 against the release's `SHA256SUMS` file.
3. Caches the ISO so re-running is instant.
4. Installs QEMU if missing — asks first, never silently.
5. Launches QEMU with hardware acceleration, 8 GB RAM, 4 vCPUs.
6. Forwards `localhost:8080` on your host to Open WebUI inside the VM.
7. Cleans up the cached ISO on exit (pass `--keep` to preserve).

## Flags

| Flag | Default | Purpose |
|---|---|---|
| `--iso-url <url>` | latest release | Override the ISO download source |
| `--sha256 <hex>` | from SHA256SUMS | Required if `--iso-url` is set |
| `--ram <MB>` | 8192 | VM memory |
| `--cpus <n>` | min(4, nproc/2) | vCPU count |
| `--keep` | off | Don't delete the cached ISO |
| `--no-kvm` / `--no-hvf` / `--no-whpx` | off | Force TCG (debugging only) |
| `--headless` | off | No display; prints a VNC URL |
| `--port <N>` | 8080 | Host port forwarded to Open WebUI |

## VM vs USB — what's different

| | VM (`try.sh`) | USB (`flash.ps1` / `dd`) |
|---|---|---|
| Isolation from host | Shared kernel context via hypervisor | Fully separate boot, nothing touches host |
| AI speed | 80–90% of native | Native |
| GPU access | None by default | Direct (see GPU setup) |
| Setup time | 30 seconds | 3–8 minutes |
| Persists after shutdown | No | No (unless persistence layer configured) |
| Network privacy | Host's network stack | Isolated unless you configure otherwise |

For anything beyond evaluation, flash a USB.

## Troubleshooting

### "KVM not accessible"
Run: `sudo usermod -aG kvm $USER && newgrp kvm`. Log out and back in.

### "WHPX accelerator not available"
Run (Admin PowerShell): `Enable-WindowsOptionalFeature -Online -FeatureName HypervisorPlatform -All`. Reboot.

### Boot hangs at GRUB
Likely a TCG fallback. Check the terminal output — if you see "falling back to TCG", hardware acceleration is disabled. See the flags above to force acceleration or enable it in BIOS.

### Port 8080 already in use
Pass `--port 9090`. Open `http://localhost:9090` instead.

## Related

- [Installing and booting from USB](installing-and-booting.md) — the real deal
- [Building from source](../advanced/building-from-source.md)
- [System requirements](../general/system-requirements.md)
