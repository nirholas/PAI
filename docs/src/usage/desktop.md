---
title: The PAI desktop
description: Sway, waybar, launchers, and the keyboard-driven basics of moving around the PAI desktop.
audience: new-to-linux
sidebar_order: 2
---

# The PAI desktop

PAI uses **Sway**, a tiling window manager. Windows snap to a grid,
most actions are keyboard-driven, and nothing follows you around.

## The short version

- `Super` = the Windows / Command key.
- `Super + Enter` = open a terminal.
- `Super + D` = open the application launcher (fuzzel).
- `Super + Shift + Q` = close the focused window.
- `Super + 1..9` = switch to workspace 1 through 9.

The full list is in
[../reference/keyboard-shortcuts.md](../reference/keyboard-shortcuts.md).

## The status bar (waybar)

The top bar shows, left to right:

- Workspace numbers.
- Currently focused window title.
- **Tor** indicator (on / off / bootstrapping).
- **Ollama** indicator (running / stopped / model loaded).
- MAC-spoof status.
- Battery, network, clock.

Clicking most modules opens a quick-action menu.

## The launcher

Press `Super + D` and type. `fuzzel` fuzzy-matches installed apps.
Entries are grouped by subsystem (AI, Privacy, Crypto, Dev, Apps).

## Notifications and screen lock

- `mako` handles notifications; they're discreet by design. No
  lock-screen notifications.
- `swaylock` locks the screen. Idle lock kicks in after 5 minutes
  (configurable under `~/.config/sway/config` once persistence is
  on).

## Files

- **Thunar** is the default file manager (`Super + E`).
- Right-click any file for **encrypt**, **shred**, or **sign**
  context actions. See [../apps/encrypting-files-gpg.md](../apps/encrypting-files-gpg.md)
  and [../apps/secure-delete.md](../apps/secure-delete.md).

## First time on Sway?

If you've never used a tiling WM, start with
[../first-steps/desktop-basics.md](../first-steps/desktop-basics.md).
It's a gentle tour with screenshots.

## Customising

Your Sway config is read from `~/.config/sway/config` if it exists
(persistence required). The shipped defaults live under
`/etc/sway/config.d/` and persist through reboots because they're
part of the squashfs root.
