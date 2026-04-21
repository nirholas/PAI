# Acknowledgments

PAI stands on the shoulders of giants. Every project listed below is
credited under its own license; PAI does not relicense any of them. Where
a project is bundled in the PAI distribution, its full license text travels
with the binary it applies to.

> `CREDITS.md` is an accepted alias for this file. This file
> (`ACKNOWLEDGMENTS.md`) is the canonical one — if both exist, prefer this.

## Upstream projects

### Base OS

- **Debian** — the foundational GNU/Linux distribution PAI is assembled on.
  License: various (mostly GPL/LGPL/BSD/MIT). <https://www.debian.org/>

### Desktop

- **Sway** — Wayland compositor providing the default PAI desktop session.
  License: MIT. <https://swaywm.org/>
- **wlroots** — modular Wayland compositor library powering Sway.
  License: MIT. <https://gitlab.freedesktop.org/wlroots/wlroots>
- **Waybar** — status bar used by the PAI desktop.
  License: MIT. <https://github.com/Alexays/Waybar>

### AI

- **Ollama** — local LLM runtime PAI ships for offline inference.
  License: MIT. <https://ollama.com/>
- **llama.cpp** — inference engine underpinning much of the local model
  stack. License: MIT. <https://github.com/ggerganov/llama.cpp>
- **Hugging Face model authors** — the creators of the open-weights models
  PAI optionally downloads. Licenses vary per model.
  <https://huggingface.co/>

### Privacy

- **The Tor Project** — anonymity network used by PAI's optional Tor
  integration. License: BSD 3-Clause. <https://www.torproject.org/>
- **UFW (Uncomplicated Firewall)** — default firewall front-end.
  License: GPL-3.0. <https://launchpad.net/ufw>
- **macchanger** — MAC address randomization utility.
  License: GPL-2.0. <https://github.com/alobbs/macchanger>

### Crypto

- **Bitcoin Core** — reference Bitcoin node and wallet.
  License: MIT. <https://bitcoincore.org/>
- **Monero** — privacy-preserving cryptocurrency node and wallet.
  License: BSD 3-Clause. <https://www.getmonero.org/>
- **Electrum** — lightweight Bitcoin wallet.
  License: MIT. <https://electrum.org/>

### Build

- **debootstrap** — bootstraps the Debian base used to assemble PAI.
  License: GPL-2.0. <https://wiki.debian.org/Debootstrap>
- **squashfs-tools** — builds the compressed root filesystem for the ISO.
  License: GPL-2.0. <https://github.com/plougher/squashfs-tools>
- **xorriso** — authors the bootable ISO image.
  License: GPL-3.0. <https://www.gnu.org/software/xorriso/>
- **minisign** — signs and verifies release artifacts.
  License: ISC. <https://jedisct1.github.io/minisign/>

### Website

- **Astro** — framework powering the PAI website.
  License: MIT. <https://astro.build/>
- **Tailwind CSS** — utility-first styling used across the site.
  License: MIT. <https://tailwindcss.com/>

### Inspiration

These projects shaped how PAI thinks about privacy-focused operating
systems. PAI does not include their code, but owes them intellectual debt.

- **Tails** — <https://tails.net/>
- **Qubes OS** — <https://www.qubes-os.org/>
- **GrapheneOS** — <https://grapheneos.org/>
- **Kodachi** — <https://www.digi77.com/linux-kodachi/>

## Financial sponsors

<!-- TODO: add financial sponsors here as they come on board. -->
_None yet. If you are interested in sponsoring PAI, please open an issue._

## Individual thanks

<!-- TODO: add named individuals who provided design, legal, or moral support. -->
_Placeholder for individuals who contributed design, legal, or moral
support outside the commit history._
