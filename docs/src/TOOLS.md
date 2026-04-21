# Tools

This document catalogs the **tools** available in the PAI ecosystem — both
the build-time utilities that produce the ISO and the runtime software
that ships on the installed system.

In PAI's context, a **tool** is any build-time or runtime capability an
agent (human or AI) can invoke to accomplish work. The build system
itself is driven by agents following the prompts in [prompts/](prompts/);
see [AGENTS.md](AGENTS.md) for how those agents operate.

---

## Build-time tools

These tools run on the builder's machine (or inside the build container)
to produce the PAI ISO. They are not present on the shipped system unless
re-installed explicitly.

| Tool | Purpose | Where invoked | Docs |
|------|---------|---------------|------|
| `debootstrap` | Bootstraps a minimal Debian/Ubuntu root filesystem that becomes the base of the live system | Early in [prompts/BUILD-FULL-AMD64.md](prompts/BUILD-FULL-AMD64.md) | [manpages.debian.org/debootstrap](https://manpages.debian.org/debootstrap) |
| `chroot` | Enters the bootstrapped filesystem so subsequent `apt`, config, and customization steps run in the target environment | Nearly every `prompts/NN-*.md` that installs packages | [manpages.debian.org/chroot](https://manpages.debian.org/chroot) |
| `squashfs-tools` (`mksquashfs`) | Compresses the customized root filesystem into the read-only `filesystem.squashfs` carried on the ISO | [prompts/06-build-iso.md](prompts/06-build-iso.md), [prompts/21-final-build.md](prompts/21-final-build.md) | [github.com/plougher/squashfs-tools](https://github.com/plougher/squashfs-tools) |
| `xorriso` | Assembles the final hybrid ISO image (UEFI + BIOS bootable) | [prompts/06-build-iso.md](prompts/06-build-iso.md), [prompts/21-final-build.md](prompts/21-final-build.md) | [gnu.org/software/xorriso](https://www.gnu.org/software/xorriso/) |
| `minisign` | Signs release artifacts so downloaders can verify authenticity | Release workflow, [SECURITY.md](security.md) | [jedisct1.github.io/minisign](https://jedisct1.github.io/minisign/) |
| `sha256sum` | Generates checksums published alongside every ISO | Release workflow | [manpages.debian.org/sha256sum](https://manpages.debian.org/sha256sum) |
| `ShellCheck` | Lints the chroot scripts referenced by build prompts | CI, pre-commit | [shellcheck.net](https://www.shellcheck.net/) |
| Docker build images | Reproducible build environment so any contributor can produce a byte-identical ISO | Top of [prompts/BUILD-FULL-AMD64.md](prompts/BUILD-FULL-AMD64.md) | See repo `Dockerfile` |

---

## Runtime tools

These tools ship on the ISO and are available to end users the moment
they boot. Each group maps to one or more `prompts/NN-*.md` files that
document exactly what gets installed and how.

### AI
| Tool | Purpose | Prompt |
|------|---------|--------|
| `ollama` | Local LLM runtime — models run on-device, no cloud calls | [prompts/03-fix-ollama-cpu-only.md](prompts/03-fix-ollama-cpu-only.md), [prompts/16-ai-tools-suite.md](prompts/16-ai-tools-suite.md) |
| `model-manager` | PAI utility to download, list, and prune local models | [prompts/04-model-manager.md](prompts/04-model-manager.md) |
| AI crypto analysis tooling | On-device market analysis using local models | [prompts/18-ai-crypto-analysis.md](prompts/18-ai-crypto-analysis.md) |

### Privacy
| Tool | Purpose | Prompt |
|------|---------|--------|
| `tor` | Routes selected traffic through the Tor network | [prompts/11-tor-privacy-mode.md](prompts/11-tor-privacy-mode.md) |
| `ufw` | Default-deny host firewall | [prompts/06-firewall-hardening.md](prompts/06-firewall-hardening.md) |
| `macchanger` | Randomizes MAC on each boot | [prompts/05-mac-spoofing.md](prompts/05-mac-spoofing.md) |
| `mat2` | Strips metadata from documents, images, and media | [prompts/32-encryption-privacy.md](prompts/32-encryption-privacy.md) |

### Crypto
| Tool | Purpose | Prompt |
|------|---------|--------|
| `bitcoin-cli` | Bitcoin Core CLI wallet and RPC client | [prompts/12-bitcoin-wallet.md](prompts/12-bitcoin-wallet.md) |
| `monero-wallet-cli` | Monero CLI wallet | [prompts/15-monero-wallet.md](prompts/15-monero-wallet.md) |
| `electrum` | Lightweight Bitcoin wallet | [prompts/12-bitcoin-wallet.md](prompts/12-bitcoin-wallet.md) |
| Crypto dashboard + price ticker | System-level price feed and portfolio view | [prompts/14-crypto-price-ticker.md](prompts/14-crypto-price-ticker.md), [prompts/17-crypto-dashboard.md](prompts/17-crypto-dashboard.md) |

### Dev
| Tool | Purpose | Prompt |
|------|---------|--------|
| `git` + GitHub tooling | Version control and forge integration | [prompts/25-git-github-tools.md](prompts/25-git-github-tools.md) |
| VS Code | Default graphical editor | [prompts/22-vscode.md](prompts/22-vscode.md) |
| Language toolchains | Python, Node.js, Go, Rust, and others preinstalled | [prompts/23-dev-languages.md](prompts/23-dev-languages.md) |
| Terminal enhancements | Modern shell, prompt, and CLI utilities | [prompts/26-terminal-enhancements.md](prompts/26-terminal-enhancements.md) |

### Utilities
General user-facing applications — file managers, archivers, media
players, productivity apps, communication clients, and more. The full
catalog lives in [prompts/33-utilities.md](prompts/33-utilities.md) and
related prompts:

- [prompts/27-music-player.md](prompts/27-music-player.md)
- [prompts/28-ssh-remote-access.md](prompts/28-ssh-remote-access.md)
- [prompts/29-networking-privacy.md](prompts/29-networking-privacy.md)
- [prompts/30-communication.md](prompts/30-communication.md)
- [prompts/31-productivity-editing.md](prompts/31-productivity-editing.md)
- [prompts/24-flatpak-appstore.md](prompts/24-flatpak-appstore.md)

---

## How to propose a new tool

1. **Open an Issue** describing the tool, why it belongs in PAI, and
   which category it fits (build-time, AI, privacy, crypto, dev, utility).
   Flag any licensing, telemetry, or network-call concerns up front — see
   [ETHICS.md](ETHICS.md) and [PRIVACY.md](PRIVACY.md).
2. **Open a PR** that adds:
   - A new `prompts/NN-<name>.md` build prompt (follow the authoring
     rules in [PROMPTS.md](PROMPTS.md)).
   - The matching chroot script or config changes.
   - An entry in this file under the appropriate section.
   - An update to [prompts/INDEX.md](prompts/INDEX.md) if a new numbered
     step is introduced.
3. Ensure the build still produces a reproducible ISO. See
   [CONTRIBUTING.md](https://github.com/nirholas/pai/blob/main/CONTRIBUTING.md) for the full workflow.

For the agents that review and act on these proposals, see
[AGENTS.md](AGENTS.md).
