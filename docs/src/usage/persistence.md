---
title: Persistence
description: What persistence is, when you want it, and how to use it day to day.
audience: everyone
sidebar_order: 3
---

# Persistence

By default, PAI forgets everything at shutdown. That's a feature:
no cookies, no history, no traces. Persistence is the opt-in that
lets you keep some things — your files, your Wi-Fi passwords, your
model weights — across reboots.

## When to enable persistence

Enable it if you want to:

- Keep downloaded Ollama models (so you don't re-download multi-GB
  weight files).
- Save browser bookmarks, GPG keys, or password databases.
- Use PAI as a daily workstation.

**Leave it off** if you want maximum deniability: a reboot erases
everything, and a seized device contains nothing recoverable beyond
the ISO itself.

## How it works

Persistence is a **second partition** on your USB stick, encrypted
with LUKS2, containing a list of paths that overlay on top of the
live system.

The defaults include:

- `/home` — your files and dotfiles.
- `/var/lib/ollama` — model weights.
- `/var/lib/tor` — Tor guard selection.
- NetworkManager connections — saved Wi-Fi.

Anything outside those paths still comes from the (read-only)
squashfs, so system integrity is preserved. Technical detail is in
[../architecture/storage.md](../architecture/storage.md).

## Creating persistence

On first boot, the welcome dialog offers to create a persistence
partition. Full step-by-step:
[../persistence/creating-persistence.md](../persistence/creating-persistence.md).

## Unlocking

Every subsequent boot asks for the LUKS passphrase before handing
off to the login session. See
[../persistence/unlocking.md](../persistence/unlocking.md).

## Backing up

The persistence volume is a LUKS container over ext4. Back it up
with `dd` for a bit-exact copy, or by mounting it and `rsync`ing
`/home`. See [../persistence/backing-up.md](../persistence/backing-up.md).

## Forgetting everything

To wipe persistence entirely: boot PAI, unmount the persistence
partition if it's open, and reformat the second partition. Or
reflash the USB from scratch.

## What persistence is not

- It is **not** an installer. PAI runs off the USB; the internal
  SSD is never touched.
- It is **not** encrypted by your login password. It's encrypted by
  the LUKS passphrase you set when you created it. Choose one that
  can resist offline cracking.
- It does **not** persist `/tmp`, `/var/log`, or installed apt
  packages. Those stay volatile on purpose.
