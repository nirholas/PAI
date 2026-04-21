---
title: Basic Usage
description: A friendly tour of PAI for people new to Linux — desktop, Wi-Fi, browsing, AI, wallets, persistence, and safe shutdown.
audience: new-to-linux
sidebar_order: 1
---

# Basic Usage

This guide walks you from "I just booted PAI" to "I can do real work"
without assuming any prior Linux experience. For deeper flows see
[advanced.md](./advanced.md); for commands see [cli.md](./cli.md); for
system tweaks see [configuration.md](../configuration.md).

---

## 1. The desktop tour

PAI boots into **Sway**, a tiling Wayland compositor. That means
windows snap into place automatically instead of floating.

- **The bar** (bottom of screen) shows: workspaces, active window
  title, Tor status, network, battery, clock, and the AI indicator.
- **The launcher** opens with `Super + d` (the Super key is usually
  the Windows/Command key). Type a program name and hit Enter.
- **Workspaces** are virtual desktops numbered 1–9. Switch with
  `Super + 1`..`Super + 9`. Move the focused window to another
  workspace with `Super + Shift + <number>`.
- **Moving windows**: focus with `Super + h/j/k/l` (left/down/up/right),
  move with `Super + Shift + h/j/k/l`. Close with `Super + Shift + q`.
- **Split direction**: `Super + b` for horizontal, `Super + v` for
  vertical — the next window you open will tile that way.
- **Fullscreen**: `Super + f`. **Float a window**: `Super + Shift + space`.

If you get lost, press `Super + Shift + c` to reload the config and
`Super + Shift + e` to exit the session.

---

## 2. Connecting to Wi-Fi

Click the network icon in the bar, or press `Super + n` to open the
network menu.

1. Select your SSID from the list.
2. Enter the password.
3. Wait for the green checkmark.

### What MAC spoofing does

By default, PAI randomizes your network card's hardware address (the
**MAC address**) every time it connects. This prevents a café,
airport, or hotel from recognizing your laptop across visits. It does
**not** hide your traffic — for that, use Tor.

You can toggle spoofing in the network menu, or at the command line
with `nmcli connection modify ... 802-11-wireless.cloned-mac-address`
(see [cli.md](./cli.md#nmcli)).

---

## 3. Opening a browser privately

PAI ships with a hardened Firefox-based browser as the default.

- Launch it from the bar or with `Super + Enter, firefox`.
- The **Tor button** in the toolbar routes that tab through the Tor
  network. You'll see the status flip to a small onion when active.
- **Bookmarks** are kept on the persistent volume if you enabled it
  (see §6). Otherwise they vanish at shutdown — that's the point of
  a live session.

A few private-browsing habits worth forming:

- Close the browser fully between unrelated tasks. A fresh session
  resets cookies and fingerprinting entropy.
- Don't log into personal accounts over Tor and then non-Tor in the
  same session — correlation becomes trivial.
- The default search engine is DuckDuckGo; swap it in Preferences if
  you prefer another.

---

## 4. Talking to your AI

PAI's whole point is that the AI lives on your laptop.

1. Open a terminal: `Super + Enter`.
2. Run: `ollama run llama3.2`
3. Wait a few seconds for the model to load into memory.
4. Type your prompt. Press Enter. Read the answer.

Exit with `Ctrl + d` or `/bye`.

### Prompting tips

- **Be specific.** "Write me a 5-line shell script that lists the 10
  largest files in my home directory" beats "help with shell."
- **Give the model a role.** "You are an experienced Linux sysadmin.
  Explain…" steers style and depth.
- **Iterate.** If the first answer is off, tell the model what's
  wrong instead of starting over.
- **Smaller models are faster but less accurate.** `llama3.2` (3B) is
  great for quick Q&A; for harder tasks try a larger model — see
  [advanced.md §1](./advanced.md#1-running-larger-models).

---

## 5. Sending and receiving crypto

PAI includes wallet GUIs for Bitcoin, Monero, and Ethereum. Open them
from the launcher (type `wallet`).

**Before you do anything with real funds, read this twice:**

- **Live mode vs persistent mode matters.** In a live (non-persistent)
  session, any wallet you create is destroyed at shutdown — including
  the seed phrase. If you don't write the seed down on paper before
  shutting down, **your coins are gone forever**.
- **Persistent mode** saves the wallet to the encrypted persistent
  volume. Losing the passphrase to that volume is equivalent to
  losing the seed.
- For meaningful amounts, use **cold signing**: keep the keys on an
  offline PAI install or a hardware wallet, and broadcast from a
  different machine. See [advanced.md §7](./advanced.md#7-crypto-advanced).

Receiving is safe in any mode — generate an address, share it, done.
**Sending** is where the rules above matter.

---

## 6. Saving your work

By default, PAI is **amnesic**: every reboot starts from a clean
slate. That's a feature, not a bug.

If you want some things to survive reboot, enable **persistence**:

1. From the launcher, run `persistence-setup`.
2. Choose a passphrase (long, memorable, written down somewhere safe).
3. Pick what to persist: wallets, dotfiles, browser bookmarks,
   downloaded models, SSH keys.

**What persistence saves:** the directories you explicitly opt into.

**What persistence does NOT save:**
- System logs (wiped on shutdown by design).
- Browser history from non-persistent profiles.
- Shell history (unless you persist `~/.bash_history`).
- Anything written to `/tmp`, `/var/tmp`, or `/run`.

Treat persistence as "I deliberately want this to survive" — not as
a general-purpose home directory.

---

## 7. Shutting down safely

Three ways to end a session, with very different consequences.

- **Reboot** (`Super + Shift + r` or `systemctl reboot`): restarts the
  machine normally. Persistent data survives; RAM is cleared by the
  reboot itself.
- **Poweroff** (`Super + Shift + p` or `systemctl poweroff`): shuts
  down cleanly. Same guarantees as reboot, plus the machine is off.
- **Leave-no-trace RAM wipe**: PAI overwrites RAM with zeros on
  shutdown to defeat cold-boot attacks. This is the default — you
  don't need to enable anything. If you yank the power cord instead,
  you skip the wipe. Don't do that unless you have to.

For the paranoid: after poweroff, wait ~30 seconds before moving the
laptop. DRAM decays slowly enough that quick physical access to the
chips can still recover keys for a short window.

---

## Where to go next

- [advanced.md](./advanced.md) — larger models, headless use, Tor
  hidden services, cold signing.
- [cli.md](./cli.md) — compact command reference.
- [configuration.md](../configuration.md) — tweak the bar, keybinds,
  firewall, and more.
