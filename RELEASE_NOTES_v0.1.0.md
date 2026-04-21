# PAI 0.1.0 — first public release

PAI is a bootable USB Linux distribution that gives you a private, offline AI
workstation in about a minute. Flash the ISO to any 16 GB+ USB stick, boot
your laptop from it, and you land in a Sway desktop with Ollama and Open WebUI
already running — a local LLM, a chat UI, and a hardened Debian 12 base, with
no installation, no cloud account, and no network calls you didn't ask for. If
you ever want to go back to your regular OS, pull out the USB. That's it.

## Downloads

ISOs are hosted on Cloudflare at `get.pai.direct` — they're ~8–9 GB, which is
over GitHub's 2 GB per-asset limit, so they can't live on the release page
itself. Only `SHA256SUMS` is attached to the GitHub release for convenience.

| Artifact | URL |
|----------|-----|
| `pai-amd64.iso` | <https://get.pai.direct/pai-amd64.iso> |
| `pai-arm64.iso` | <https://get.pai.direct/pai-arm64.iso> |
| `SHA256SUMS`    | <https://get.pai.direct/SHA256SUMS> |

## What works today

- Boots on amd64 and arm64 hardware from a USB stick (tested under UTM on
  Apple Silicon and on cloud amd64/arm64 builders).
- **Ollama** preinstalled with `llama3.2:1b` baked into the image — you can
  chat with a local model on first boot with zero network access.
- **Open WebUI** with PAI branding as the default chat interface.
- **Sway** (Wayland tiling compositor) desktop environment.
- **Waybar** status bar with an app launcher plus network, audio, battery,
  and clock widgets.
- **`pai-settings`** wofi menu for common toggles.
- **`pai-shutdown`** clears free memory before powering off so model and chat
  state don't linger in DRAM.
- **UFW firewall** with default-deny inbound, **MAC address randomization**
  on every boot, and an **optional Tor privacy mode** for network-level
  anonymity.
- Extensive documentation under [`docs/src/`](docs/src/) covering install,
  USB flashing, privacy posture, known issues, and the roadmap.

## Known limitations

- **No persistence.** Every boot starts fresh — models you download and chats
  you save are gone at shutdown. Fix is scoped for v0.2.
- **No first-boot model picker.** The ISO ships one model (`llama3.2:1b`);
  a RAM-aware picker is on the roadmap.
- **No signed Secure Boot shims.** Disable Secure Boot or add a MOK manually
  to boot on machines that enforce it.
- **Open WebUI auth is disabled.** PAI is a single-user live system by design
  — don't expose the Open WebUI port on a network you don't control.

Roadmap preview: see [`prompts/roadmap/`](prompts/roadmap/) for what's
planned next (persistence, first-boot polish, model picker, v0.2 scope).
No ETAs — ships when ready.

## Verification

After downloading, check the SHA256 of the ISO against `SHA256SUMS`:

```bash
curl -LO https://get.pai.direct/pai-amd64.iso
curl -LO https://get.pai.direct/SHA256SUMS
sha256sum -c SHA256SUMS --ignore-missing
```

You should see `pai-0.1.0-amd64.iso: OK` (or `-arm64.iso: OK`).

## Quick start

See [`docs/src/quickstart.md`](docs/src/quickstart.md) for the flash-and-boot
walkthrough, and [`docs/src/USB-FLASHING.md`](docs/src/USB-FLASHING.md) for
per-OS flashing instructions (Linux, macOS, Windows).

## Reporting bugs

Please file issues on the [GitHub issue tracker](https://github.com/nirholas/pai/issues).
When reporting a boot/hardware problem, include:

- Host make and model, CPU arch (amd64 / arm64)
- Whether Secure Boot was on or off
- Relevant lines from `journalctl -b` if you can reach a shell
- The exact ISO filename and its SHA256

Security issues — please email `contact@pai.direct` rather than filing a
public issue. See [SECURITY.md](SECURITY.md) for the full policy.
