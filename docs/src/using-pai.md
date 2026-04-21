---
title: Using PAI
description: A practical guide to the PAI desktop — waybar, keyboard shortcuts, Open WebUI, and the main PAI commands.
updated: 2026-04-19
---

# Using PAI

This page covers day-to-day use: what you see on screen, how to navigate the desktop, and how to get the most out of the AI interface.

---

## The desktop at a glance

PAI runs [Sway](https://swaywm.org/), a tiling Wayland compositor. The screen has two zones:

- **Waybar** — a thin status bar along the top edge
- **Workspace** — everything else; windows tile automatically

At first boot, Firefox opens to `localhost:8080` (Open WebUI). That's your primary AI interface.

![PAI desktop — Sway + waybar + Open WebUI](../images/desktop.png)

---

## Waybar

The top bar is laid out left-to-right:

| Left side | |
|---|---|
| PAI logo | Click to open the app launcher |
| 🌐 Browser | Firefox ESR |
| 💻 Terminal | foot terminal emulator |
| 📁 Files | Thunar file manager |
| 📝 Editor | Mousepad text editor |
| Ollama indicator | Green = model loaded and responding; yellow = idle; red = not running |

| Right side | |
|---|---|
| Media player | Currently playing track (artist – title) |
| BTC / XMR | Live crypto prices (fetched via Tor when privacy mode is on) |
| Network | Wi-Fi signal %, or Ethernet, or Disconnected |
| CPU % | Processor load |
| RAM % | Memory used |
| HH:MM | Clock |
| ⚙ Settings | Opens the PAI settings menu |

Click any left-side icon to launch that application. The Ollama indicator updates every five seconds.

---

## Keyboard shortcuts

PAI uses `Alt` (not `Super`) as the modifier key to avoid conflicts with X11 applications running under XWayland.

### Windows and workspaces

| Shortcut | Action |
|---|---|
| `Alt + Return` | Open terminal |
| `Alt + D` | App launcher (wofi) |
| `Alt + F4` | Close focused window |
| `Alt + L` | Lock screen |
| `Alt + S` | PAI settings menu |
| `Alt + Shift + E` | Shutdown menu |
| `Alt + ← / → / ↑ / ↓` | Move focus between windows |
| `Alt + Shift + ← / → / ↑ / ↓` | Move focused window |
| `Alt + 1 / 2 / 3` | Switch to workspace |
| `Alt + Shift + 1 / 2 / 3` | Move window to workspace |
| `Alt + R` | Enter resize mode (arrow keys to resize, Esc to exit) |

### Screenshots

| Shortcut | Action |
|---|---|
| `Print` | Screenshot of full screen (saved to `~/Screenshots/`) |
| `Shift + Print` | Select a region to capture |

### Media keys

Volume, brightness, and media playback keys on your keyboard work as expected.

---

## Open WebUI

Open WebUI (`localhost:8080`) is the primary interface for chatting with local models.

![Open WebUI chat](../images/open-webui-chat.png)

### Selecting a model

The model selector is in the top-left corner of the chat view. PAI ships with **Llama 3.2** and **Mistral** pre-pulled. To add more, see [models.md](models.md).

### Starting a conversation

Type in the message box at the bottom and press `Enter` (or click the send button). The response streams token-by-token from the local Ollama server — no network request leaves your machine.

### No login required

PAI disables authentication in Open WebUI (`WEBUI_AUTH=False`). There is no login screen. This is intentional — the service only listens on `localhost`, so no other machine on the network can reach it.

### Clearing history

Conversations are stored in RAM only. They disappear when you shut down PAI, unless you have persistence enabled. To clear history within a session, use the **New Chat** button or delete individual conversations from the sidebar.

---

## The terminal

Open a terminal with `Alt + Return`. The default shell is bash.

Key PAI commands available in the terminal:

| Command | What it does |
|---|---|
| `ollama list` | Show downloaded models |
| `ollama pull <model>` | Download a new model |
| `ollama run <model>` | Chat with a model in the terminal |
| `sudo pai-privacy on` | Enable Tor transparent proxy |
| `sudo pai-privacy off` | Disable Tor |
| `pai-settings` | Open the settings menu |

See [models.md](models.md) for a full list of available models and RAM requirements.

---

## PAI settings

Press `Alt + S` or click the ⚙ icon in waybar to open the settings menu. It's a
two-level menu — pick a category on the top level to open a submenu. Cancel a
submenu (Escape) to return to the top.

### System
- **Date & Time** — timezone picker, manual clock set, NTP toggle
  (`pai-settings-datetime`).
- **Keyboard** — layout picker (us, gb, de, fr, es, it, pt, ru, jp, dvorak,
  colemak). Writes `~/.config/sway/config.d/10-keyboard.conf` and reloads sway.
- **Mouse & Touchpad** — tap-to-click, natural scroll, pointer speed.
- **Power** — screen-off / lock timeouts and lid-close behaviour via
  `swayidle`.
- **Display** — `wdisplays` GUI for resolution and arrangement.
- **Sound** — `pavucontrol`.
- **About** — PAI version, kernel, CPU, RAM, GPU, disk, uptime.

### Network
- **Wi-Fi / Wired** — `nm-connection-editor`.
- **Bluetooth** — `blueman-manager`.
- **Firewall status** — `sudo ufw status verbose` in a terminal.
- **Tor / Privacy mode** — front door to `pai-privacy`.

### Privacy & Security
- **Privacy mode** — MAC spoof + Tor toggle.
- **Passwords** — KeePassXC.
- **Encryption** — Kleopatra (GPG).
- **Persistence** — wraps `pai-persistence`.

### AI / Ollama
- **Pick default model** — `pai-recommend-model`.
- **Pull a model** — curated list plus free-form entry
  (`pai-settings-pull-model`).
- **Open Web UI** — opens `http://localhost:8080`.
- **GPU / status** — `pai-status` in a terminal.

### Appearance
- **GTK theme** — `lxappearance`.
- **Wallpaper** — pick from `/usr/share/backgrounds/` or choose a file.

### Apps & Defaults
- **Browse installed apps** — `wofi --show drun`.
- **Default apps** — set default browser, mail, editor, file manager, image,
  video, audio, PDF handlers (`pai-settings-default-apps`).
- **Accessibility** — cursor size, high-contrast theme, magnifier, sticky-keys
  hint.

### Storage & Devices
- **Disks** — GNOME Disks.
- **Printers** — `system-config-printer` (CUPS).
- **Files** — Thunar.

### Users & Login
- Change the live user's password. On a live system without persistence the
  change is lost at reboot — the dialog says so.

### Updates
- On a live-only boot: explains updates can't persist.
- With persistence active: `apt update` / `apt upgrade` in a foot terminal.

### Advanced
- **Processes** — `lxtask`.
- **Terminal** — `foot`.

---

## Screen locking

The screen locks automatically after **10 minutes** of inactivity (swaylock). The display turns off after **15 minutes**. Press any key or move the mouse to wake it.

To lock manually: `Alt + L`.

There is no password set by default on the live system. If you want a lock-screen password, set one with `passwd` in the terminal before locking.
