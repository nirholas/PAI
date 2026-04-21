---
title: Configuration
description: Per-user configuration inside PAI persistence — Sway, Ollama, Tor, DNS, wallets, and more.
order: 3
updated: 2026-04-17
---

# Configuration

PAI ships with working defaults for everything on this page. This
document is for when you want to change something — a different Ollama
model, a Tor bridge, a new Waybar layout — without breaking the ability
to pull upstream updates later.

The guiding rule: **system defaults live on the read-only live image;
your overrides live in persistence and always win.** Re-flashing the
USB does not touch your overrides.

---

## 1. What lives where

Three layers stack at runtime:

| Layer              | Location              | Writable? | Survives reflash? |
|--------------------|-----------------------|-----------|-------------------|
| Live image (RO)    | `/usr`, `/etc` (base) | No        | Replaced          |
| Overlay (tmpfs)    | in-RAM diff           | Yes       | No — lost on reboot |
| Persistence (LUKS) | `/home/pai`, `/etc/pai-persist` | Yes | **Yes** |

Concretely:

- `/home/pai/` — your home directory. Dotfiles, wallets, notes, ollama
  models, chat history — all here.
- `/home/pai/.config/` — user configs for Sway, Waybar, Firefox,
  Electrum, Monero GUI, etc.
- `/etc/pai-persist/` — system-level overrides applied on every boot.
  Put files here when a user config isn't enough (network, firewall,
  DNS).
- `/usr/share/pai/defaults/` — read-only copies of every shipped
  default. Use as reference; never edit in place.

When a config exists in both `/usr/share/pai/defaults/` and your home
directory, the home version wins.

---

## 2. Sway / Waybar / wallpaper

The canonical shipped defaults are defined in:

- [prompts/07-wallpaper-theme.md](../prompts/07-wallpaper-theme.md) —
  wallpaper, colour palette, GTK theme.
- [prompts/08-waybar-ollama-status.md](../prompts/08-waybar-ollama-status.md) —
  Waybar modules, including the live Ollama status indicator.

### Overriding without breaking updates

Do **not** edit `/usr/share/pai/defaults/sway/config`. Instead, create
`~/.config/sway/config.d/99-local.conf` — Sway loads everything in
`config.d/` in lexical order, so `99-local.conf` runs last and
overrides earlier bindings.

Example — swap the terminal and add a binding:

```
set $term alacritty
bindsym $mod+Return exec $term
bindsym $mod+Shift+f exec firefox
```

For Waybar, copy the shipped config once and edit the copy:

```
mkdir -p ~/.config/waybar
cp /usr/share/pai/defaults/waybar/{config,style.css} ~/.config/waybar/
```

Reload with `swaymsg reload` (Sway) or `pkill -SIGUSR2 waybar`
(Waybar).

Wallpaper: drop an image into `~/.config/pai/wallpaper.png`. The
startup script picks it up automatically; no swaybg edits required.

---

## 3. Ollama

Models are stored under `~/.ollama/models/`, which lives in
persistence. Expect ~4 GB per 7B quantised model.

### Adding a model

```
ollama pull llama3.2:3b
ollama pull qwen2.5:7b
```

### Removing a model

```
ollama list
ollama rm <name>
```

### GPU note

PAI defaults to **CPU-only** inference — the live image does not bundle
proprietary GPU drivers, and detection varies too widely across USB
boots to rely on. See
[prompts/03-fix-ollama-cpu-only.md](../prompts/03-fix-ollama-cpu-only.md)
for the patch that disables GPU auto-detection.

To opt in to GPU where your hardware supports it, export
`OLLAMA_GPU=1` in `~/.config/pai/env` — but expect first-boot failures
on unsupported hosts. Fall back with `OLLAMA_GPU=0`.

### Threads and context

Set via environment in `~/.config/pai/env`:

```
OLLAMA_NUM_THREAD=6        # default: all physical cores
OLLAMA_NUM_CTX=4096        # default: 2048
OLLAMA_KEEP_ALIVE=30m      # how long to hold a model in RAM
```

Context above 8k on 7B models typically needs 16 GB RAM.

---

## 4. Tor

Tor runs as a system service but is **off by default**. The canonical
wiring is described in
[prompts/11-tor-privacy-mode.md](../prompts/11-tor-privacy-mode.md).

### Toggle Tor-only mode

```
pai-tor on      # route all traffic through Tor (transparent proxy + DNS)
pai-tor off     # back to direct networking
pai-tor status  # current state
```

When on, UFW rejects non-Tor egress. Clearnet leaks are blocked at the
firewall, not just at the application layer.

### Bridges and obfs4

Edit `/etc/pai-persist/tor/bridges.conf`:

```
UseBridges 1
ClientTransportPlugin obfs4 exec /usr/bin/obfs4proxy
Bridge obfs4 <ip>:<port> <fingerprint> cert=<cert> iat-mode=0
```

Get fresh bridges from https://bridges.torproject.org. Restart after
edits: `sudo systemctl restart tor`.

### Common pitfalls

- WebRTC can leak your real IP even through Tor. PAI's Firefox policy
  disables it — do not re-enable unless you understand the tradeoff.
  See [prompts/03-firefox-policies.md](../prompts/03-firefox-policies.md).
- System time skew breaks Tor silently. If bootstrap stalls, check
  `timedatectl`.
- `.onion` resolution requires Tor DNS (`127.0.0.1:5353` by default).
  If DNS is overridden (section 5), make sure Tor's resolver is still
  in the chain.

---

## 5. DNS

The default resolver is **systemd-resolved** pointing at Quad9
(9.9.9.9) with DNS-over-TLS enabled. Switch by editing
`/etc/pai-persist/resolved.conf.d/10-upstream.conf`:

```
[Resolve]
DNS=1.1.1.1#cloudflare-dns.com 1.0.0.1#cloudflare-dns.com
DNSOverTLS=yes
DNSSEC=allow-downgrade
```

Options:

- **Quad9** (default) — filters known malware domains.
- **Cloudflare 1.1.1.1** — fastest in most regions, no filtering.
- **Local Unbound** — validating recursive resolver, no upstream trust.
  Install via `sudo apt install unbound` (requires persistence) and
  point `DNS=127.0.0.1` once it's running.
- **DNSCrypt** — `sudo apt install dnscrypt-proxy`; point resolved at
  `127.0.2.1`.

Apply changes with `sudo systemctl restart systemd-resolved`.

When Tor-only mode is on, DNS goes through Tor regardless of the
above — these settings apply to the clearnet path.

---

## 6. Networking

### Wi-Fi profiles

NetworkManager stores profiles under `/etc/NetworkManager/system-connections/`,
which is bind-mounted into persistence. Profiles saved in the GUI
survive reboots automatically.

### MAC spoofing policy

By default, PAI randomises MAC addresses per-connection — see
[prompts/05-mac-spoofing.md](../prompts/05-mac-spoofing.md). Override
per-interface in `/etc/pai-persist/NetworkManager/conf.d/mac.conf`:

```
[device]
wifi.scan-rand-mac-address=yes

[connection]
wifi.cloned-mac-address=stable   # or: random, preserve, permanent
ethernet.cloned-mac-address=stable
```

`stable` is useful on captive-portal networks that track devices by MAC
across sessions.

### UFW custom rules

UFW ships locked down — see
[prompts/06-firewall-hardening.md](../prompts/06-firewall-hardening.md).
Add persistent custom rules in `/etc/pai-persist/ufw/user.rules.d/`:

```
# /etc/pai-persist/ufw/user.rules.d/10-dev.rules
# Allow a local dev server on :3000 only from loopback
sudo ufw allow from 127.0.0.1 to any port 3000
```

PAI re-applies these on boot.

---

## 7. Wallets

Three wallets ship pre-installed: Bitcoin Core, Monero GUI, and
Electrum. First-run is covered in
[prompts/12-bitcoin-wallet.md](../prompts/12-bitcoin-wallet.md) and
[prompts/15-monero-wallet.md](../prompts/15-monero-wallet.md).

### First run

- **Electrum** — creates a BIP39 seed. Write the 12 words on paper.
  Never photograph, never paste into a cloud notes app.
- **Bitcoin Core** — full node is disabled by default (pruned mode
  only). Flip in `~/.bitcoin/bitcoin.conf` if you have the disk.
- **Monero GUI** — uses a remote node by default. For full privacy,
  run a local `monerod` — needs ~180 GB of persistence.

### Backup discipline

Wallet files live at:

- Electrum: `~/.electrum/wallets/`
- Bitcoin: `~/.bitcoin/wallets/`
- Monero: `~/Monero/wallets/`

All three sit inside persistence — losing the USB stick = losing the
wallet unless you also have the seed. Backup order of preference:

1. Paper seed phrase, stored offline.
2. Second PAI stick with the same persistence passphrase, created via
   `pai-persistence-clone`.
3. Encrypted export to external media (`gpg --symmetric` with a
   different passphrase than the persistence key).

Never put seed phrases into cloud sync, password managers that sync,
or screenshots.

---

## 8. Extensions & bookmarks

Firefox is managed by a system policy file — see
[prompts/13-crypto-extensions-bookmarks.md](../prompts/13-crypto-extensions-bookmarks.md)
for the canonical bookmark set and extension list.

The shipped policy lives at `/usr/lib/firefox-esr/distribution/policies.json`.
To add your own without losing the shipped entries, drop extensions
into `~/.mozilla/firefox/*/extensions/` and bookmarks via the Firefox
UI — user-level bookmarks merge with policy-defined ones.

To add an extension system-wide and persist it across profiles, place
the `.xpi` into `/etc/pai-persist/firefox/extensions/` and add its ID
to `/etc/pai-persist/firefox/policies.d/99-local.json`:

```json
{
  "policies": {
    "ExtensionSettings": {
      "uBlock0@raymondhill.net": { "installation_mode": "force_installed" }
    }
  }
}
```

---

## 9. Keyboard & locale

Chosen at first boot via the welcome screen. The selection is written
to:

- `/etc/pai-persist/locale.conf` — `LANG`, `LC_*`
- `/etc/pai-persist/vconsole.conf` — TTY keymap
- `~/.config/sway/config.d/00-keyboard.conf` — Sway keymap (e.g.
  `xkb_layout de`)

Change later with `pai-locale` (runs the same picker) or by editing
the files directly and rebooting.

---

## 10. Autostart

User-level autostart uses XDG `.desktop` files:

```
~/.config/autostart/my-thing.desktop
```

Minimum content:

```
[Desktop Entry]
Type=Application
Name=My Thing
Exec=/home/pai/bin/my-thing
X-GNOME-Autostart-enabled=true
```

For Sway-specific autostart (no `.desktop` wrapper), add `exec` lines
to `~/.config/sway/config.d/99-local.conf`:

```
exec --no-startup-id /home/pai/bin/my-thing
```

System-wide autostart requires a systemd user unit in
`~/.config/systemd/user/`, enabled with `systemctl --user enable`.

---

## 11. Reset to defaults

To wipe **one user config** without destroying persistence:

```
# Example: reset Sway only
rm -rf ~/.config/sway
cp -r /usr/share/pai/defaults/sway ~/.config/
swaymsg reload
```

To wipe **all user configs** but keep wallets, keys, and documents:

```
pai-reset-config       # moves ~/.config to ~/.config.bak-<date>
```

To wipe **the entire persistence container** (no recovery):

```
sudo pai-persistence-destroy
```

This zeroes the LUKS header. The wallet seed phrase on paper is your
last line of defence — if you don't have it, your coins are gone.
