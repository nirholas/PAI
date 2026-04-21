# Changelog

All notable changes to PAI are documented here.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **How to read this** — each released version lists user-visible changes grouped
> by type. If you just want to know whether it's safe to flash a newer ISO, skim
> the `Security` and `Removed` sections and consult [docs/src/MIGRATION.md](MIGRATION.md)
> for the version transition you're making.

Release process is documented in [docs/src/RELEASE.md](RELEASE.md).

## [Unreleased]

### Added

- Raspberry Pi Imager custom repository at `https://pai.direct/imager.json`.
  Users can now add PAI to Imager's OS picker and flash to a Pi SD/USB in three
  clicks — no manual `.img.xz` download required.
- First-boot model picker (`pai-model-picker`, roadmap task 03): detects RAM, suggests a size-matched Ollama model (`llama3.2:1b` / `llama3.2:3b` / `llama3:8b` / `mistral-nemo`), checks connectivity to `registry.ollama.ai` up front, and offers a one-click download with a zenity progress dialog. Skippable, idempotent via `~/.config/pai/.model-picked`, and offline-safe — shows a friendly message and falls back to the baked-in `llama3.2:1b` if there's no internet. Chosen model is written to `~/.config/pai/default-model` for Open WebUI (and future logic) to consume. Invoked from `pai-welcome` on first boot; can be re-run any time.
- **Opt-in encrypted persistence** (`pai-persistence`): first-boot wizard creates a LUKS2 (argon2id) partition on the USB stick that survives reboots. Persists Ollama models (`/var/lib/ollama`), Open WebUI history (`/var/lib/open-webui`), and WiFi credentials (`/etc/NetworkManager/system-connections`), with optional home-directory persistence. Setup is offered automatically at the end of the first-boot wizard and can be re-run any time with `pai-persistence setup`.
- Waybar persistence indicator (`pai-waybar-persistence`): shows a badge when the encrypted persistence partition is active.
- `parted` and `zenity` added to the ARM64 package list (required by `pai-persistence setup`).

### Changed

### Deprecated

### Removed

### Fixed

- Login MOTD persistence indicator: previously probed `/mnt/persistence` (a path
  nothing ever mounts) and referenced a `.last-save` marker no tool writes, so
  it reported "NOT ACTIVE" even with persistence enabled and suggested a manual
  unlock command that is not needed (live-boot handles LUKS at boot). MOTD now
  uses the same `/run/pai-persistence-active` signal as the waybar indicator
  and reports usage from the bind-mounted `/var/lib/ollama`.

### Security

## [0.1.0] — 2026-04-20

First public release of PAI — a bootable USB Linux distribution for private,
offline AI. Flash the ISO to a USB stick, boot any recent amd64 or arm64
machine from it, and you have a self-contained Sway desktop with a local LLM
stack that runs entirely on-device.

### Added

- **Bootable live-USB ISO images** for `amd64` and `arm64`, built from Debian 12.
- **Ollama preinstalled** with the `llama3.2:1b` model baked into the ISO so the
  system works end-to-end with zero network access on first boot.
- **Open WebUI** as the default chat interface, with PAI branding and theming
  applied out of the box.
- **Sway** (Wayland tiling compositor) as the desktop environment.
- **Waybar** status bar with an app launcher and status widgets (network, audio,
  battery, clock).
- **`pai-settings`** — a `wofi`-driven settings menu for quick access to common
  toggles and tools.
- **`pai-shutdown`** — a shutdown helper that wipes memory (zeroing free RAM)
  before powering off, so no residual model/chat state survives in DRAM.
- **UFW firewall** enabled by default with a default-deny inbound policy.
- **MAC address randomization** for WiFi and Ethernet interfaces on every boot.
- **Optional Tor privacy mode** — opt-in toggle that routes system traffic
  through Tor for users who need additional network-level privacy.
- **Documentation site** under [docs/src/]() covering installation,
  USB flashing, privacy posture, known issues, roadmap, and the cloud-builder
  operational runbook.

### Security

- **Ollama pinned to v0.21.0** with SHA256 verification during the ISO build,
  so builds are reproducible and tamper-evident against upstream changes.
- Default-deny inbound firewall (UFW).
- MAC address randomization enabled by default.

### Known limitations

- **No persistence.** Every boot starts from the image; downloaded models and
  chat history are lost on shutdown. An opt-in encrypted persistence layer is
  planned for v0.2 (see [prompts/roadmap/04-persistence-layer.md](prompts/roadmap/04-persistence-layer.md)).
- **No first-boot model picker.** The ISO ships with `llama3.2:1b` regardless
  of host RAM. A hardware-aware picker is planned (see
  [prompts/roadmap/03-model-picker-at-first-boot.md](prompts/roadmap/03-model-picker-at-first-boot.md)).
- **No signed shims for Secure Boot.** Users on Secure Boot machines must
  either disable it or add a MOK manually.
- **Open WebUI authentication is disabled.** PAI is designed as a
  single-user live system where the only person with access is the person
  holding the USB stick. Do not expose the Open WebUI port over a network.

## Links

- [Release runbook](RELEASE.md)
- [Upgrade / migration guide](MIGRATION.md)
- [Project roadmap](prompts/roadmap/)

[Unreleased]: https://github.com/nirholas/pai/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/nirholas/pai/releases/tag/v0.1.0
