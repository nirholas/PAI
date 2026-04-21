# Changelog

All notable changes to PAI are documented here.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **How to read this** — each released version lists user-visible changes grouped
> by type. If you just want to know whether it's safe to flash a newer ISO, skim
> the `Security` and `Removed` sections and consult [docs/src/MIGRATION.md](docs/src/MIGRATION.md)
> for the version transition you're making.

Release process is documented in [docs/src/RELEASE.md](docs/src/RELEASE.md).

## [Unreleased]

## [0.1.0] — 2026-04-20

First public release of PAI — a bootable USB Linux distribution for private,
offline AI. Flash the ISO to a USB stick, boot any recent amd64 or arm64
machine from it, and you have a self-contained Sway desktop with a local LLM
stack that runs entirely on-device.

### Added

#### Core system

- Bootable live-USB ISO images for `amd64` and `arm64`, built from Debian 12.
- Sway (Wayland tiling compositor) as the desktop environment.
- Waybar status bar with app launcher and status widgets (network, audio,
  battery, clock).
- `pai-settings` — a `wofi`-driven settings menu for quick access to common
  toggles and tools.

#### AI stack

- Ollama preinstalled with the `llama3.2:1b` model baked into the ISO so the
  system works end-to-end with zero network access on first boot.
- Open WebUI as the default chat interface, with PAI branding applied.
- **First-boot model picker** (`pai-model-picker`): detects RAM, suggests a
  size-matched Ollama model (`llama3.2:1b` / `llama3.2:3b` / `llama3:8b` /
  `mistral-nemo`), checks connectivity to `registry.ollama.ai`, and offers a
  one-click download with a zenity progress dialog. Skippable, idempotent via
  `~/.config/pai/.model-picked`, and offline-safe — falls back to the
  baked-in `llama3.2:1b` if there's no internet. Chosen model is written to
  `~/.config/pai/default-model` for Open WebUI and future logic to consume.

#### Privacy & security

- `pai-shutdown` — shutdown helper that wipes memory (zeroing free RAM)
  before powering off, so no residual model/chat state survives in DRAM.
- UFW firewall enabled by default with a default-deny inbound policy.
- MAC address randomization for WiFi and Ethernet interfaces on every boot.
- Optional Tor privacy mode — opt-in toggle that routes system traffic
  through Tor for users who need additional network-level privacy.

#### Encrypted persistence (opt-in)

- `pai-persistence`: first-boot wizard creates a LUKS2 (argon2id) partition
  on the USB stick that survives reboots. Persists Ollama models
  (`/var/lib/ollama`), Open WebUI history (`/var/lib/open-webui`), and WiFi
  credentials (`/etc/NetworkManager/system-connections`), with optional
  home-directory persistence. Offered automatically at the end of the
  first-boot wizard and re-runnable any time with `pai-persistence setup`.
- Waybar persistence indicator (`pai-waybar-persistence`) shows a badge when
  the encrypted persistence partition is active.

#### Crypto wallet toolkits

- Offline Solana wallet toolkit bundled at `/opt/pai-wallets/solana-wallet.html`
  (from `nirholas/solana-wallet-toolkit`). Launch with `$mod+Shift+S` in the
  crypto profile.
- Offline Ethereum/EVM wallet toolkit bundled at
  `/opt/pai-wallets/ethereum-wallet.html` (from
  `nirholas/ethereum-wallet-toolkit`). Launch with `$mod+Shift+E` in the
  crypto profile.
- Offline BIP39 mnemonic seed phrase generator bundled at
  `/opt/pai-wallets/bip39.html` (Ian Coleman's `bip39-standalone.html`).
  Launch with `$mod+Shift+9` in the crypto profile.
- All three wallet toolkits appear in the PAI App Store under the Crypto
  category.

#### Installation & flashing

- `pai` CLI wrapper (`scripts/pai`) — POSIX shell multi-command launcher
  providing `pai flash`, `pai try`, `pai verify`, `pai update`, `pai version`,
  `pai doctor`, and `pai help`.
- Windows PAI CLI (`scripts/pai.ps1`) with `pai.cmd` shim — PowerShell mirror
  of the POSIX `pai` with identical subcommands.
- Windows PowerShell one-liner flasher (`scripts/flash.ps1`):
  `irm https://pai.direct/flash.ps1 | iex` downloads, verifies, and flashes
  PAI to a USB drive — no Rufus, no extra tools.
- `try.sh` / `try.ps1` one-liner that launches PAI in a local VM. Users can
  evaluate PAI in 30 seconds without flashing a USB or rebooting. Available
  at `https://pai.direct/try` and `https://pai.direct/try.ps1`.
- Browser-based install assistant at `/flash-web` — guided stepper that
  detects the user's OS, downloads and SHA256-verifies the PAI ISO
  in-browser, generates a tailored one-liner command, and offers an
  experimental WebUSB direct-write path for Chromium users. No telemetry,
  fully offline-capable after first load.
- `flash.sh --local-iso PATH` and `flash.ps1 -LocalIso PATH` flags to skip
  download and flash a pre-downloaded ISO.
- Ventoy support: PAI can be booted from a Ventoy multi-boot USB drive
  without re-flashing. See [docs/src/first-steps/using-ventoy.md](docs/src/first-steps/using-ventoy.md).
- Raspberry Pi Imager custom repository at `https://pai.direct/imager.json`.
  Add PAI to Imager's OS picker and flash to a Pi SD/USB in three clicks —
  no manual `.img.xz` download required.

#### Package managers

- Homebrew tap: `brew install nirholas/tap/pai` on macOS and Linux.
- Scoop bucket:
  `scoop bucket add pai https://github.com/nirholas/scoop-pai && scoop install pai`.
- Winget manifest: `winget install PAI.PAI`.
- Arch Linux AUR packages (`pai-cli`, `pai-cli-git`): `yay -S pai-cli`.
- `pai-cli-<version>.zip` release asset containing the Windows CLI bundle
  (`pai.ps1`, `pai.cmd`, `flash.ps1`, `try.ps1`).

#### Documentation

- Documentation site under [docs/src/](docs/src/) covering installation, USB
  flashing, privacy posture, known issues, roadmap, and the cloud-builder
  operational runbook.

### Security

- Ollama pinned to v0.21.0 with SHA256 verification during the ISO build, so
  builds are reproducible and tamper-evident against upstream changes.
- Default-deny inbound firewall (UFW).
- MAC address randomization enabled by default.

### Known limitations

- **No signed shims for Secure Boot.** Users on Secure Boot machines must
  either disable Secure Boot or add a MOK manually.
- **Open WebUI authentication is disabled.** PAI is designed as a
  single-user live system where the only person with access is the person
  holding the USB stick. Do not expose the Open WebUI port over a network.
- **PowerShell flashers are not Authenticode-signed yet.** The public
  one-liner (`irm … | iex`) works because piped input bypasses Windows'
  ExecutionPolicy, but users who save `flash.ps1` to disk and run it under
  `AllSigned` or `RemoteSigned` policy will see a signature failure.
  Authenticode signing via SignPath is planned for v0.2. See
  [scripts/TODO-signing.md](scripts/TODO-signing.md) for status.
- **ISO minisign signatures are not published yet.** Release artifacts
  ship with a SHA-256 checksum (`*.iso.sha256`) for integrity, but the
  minisign detached-signature workflow is not yet live — the release
  captain's hardware-token-backed keypair will be provisioned for v0.2.
  Users can verify integrity of v0.1.0 downloads with `sha256sum`; full
  authenticity verification via `minisign` becomes available starting
  v0.2. Documentation referencing `minisign.pub` describes the target
  workflow for v0.2 and later.

## Links

- [Release runbook](docs/src/RELEASE.md)
- [Upgrade / migration guide](docs/src/MIGRATION.md)
- [Project roadmap](prompts/roadmap/)

[Unreleased]: https://github.com/nirholas/pai/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/nirholas/pai/releases/tag/v0.1.0
