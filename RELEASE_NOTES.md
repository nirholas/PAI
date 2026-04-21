# PAI 0.1.0 — First Public Release

PAI is a bootable USB Linux distribution for private, offline AI. Flash it to a
USB drive, boot any x86_64 or ARM64 machine from it, and get a full desktop with
a local LLM running — no installation, no cloud, no tracking.

## What ships in 0.1.0

- **Bootable live USB** for both `x86_64` and `ARM64` (including Apple Silicon
  via UTM)
- **Sway desktop** with Waybar — app launcher, quick-launch buttons, settings menu
- **Ollama + Open WebUI** — fully offline, PAI-branded, auto-starts on boot
- **llama3.2:1b baked into the ISO** — works without internet access
- **pai-settings** menu — launch terminal, configure Tor, manage services
- **Privacy mode** — Tor routing toggle built in
- **Sway profile keybindings** — `Alt+B` Firefox/Open WebUI, `Alt+E` Thunar,
  `Alt+D` wofi launcher

## Known limitations

- **No persistence yet** — changes don't survive reboot; see the
  [persistence roadmap](prompts/roadmap/04-persistence-layer.md)
- **No automatic model picker** — you select the model in Open WebUI manually;
  auto-selection is planned for 0.2 ([roadmap](prompts/roadmap/03-model-picker-at-first-boot.md))
- **Bigger models need internet** — llama3.2:1b is baked in; pulling anything
  larger requires a network connection after boot
- **No release signing yet** — minisign signatures are planned; verify via
  SHA256SUMS in the meantime

## Hardware tested

- M3 MacBook Pro via UTM (arm64 and amd64)
- Google Cloud amd64 + arm64 builder VMs

## Downloading the ISO

ISOs are hosted on Cloudflare at `get.pai.direct` (GitHub releases have a 2 GB
asset limit; our ISOs are ~8–9 GB):

| File | Link |
|------|------|
| `pai-amd64.iso` | <https://get.pai.direct/pai-amd64.iso> |
| `pai-arm64.iso` | <https://get.pai.direct/pai-arm64.iso> |
| `SHA256SUMS` | attached to this release |

**Download with curl:**
```
curl -LO https://get.pai.direct/pai-amd64.iso
curl -LO https://get.pai.direct/pai-arm64.iso
```

**Verify checksums:**
```
sha256sum -c SHA256SUMS
```

## Roadmap

The `prompts/roadmap/` directory in the repo contains the full sprint plan for
upcoming milestones — persistence, model picker, first-boot UX polish, and more.

## Announcement

Please don't announce until you've confirmed it boots on real hardware (not just
a VM). Check [CONTRIBUTING.md](CONTRIBUTING.md) for how to report issues.
