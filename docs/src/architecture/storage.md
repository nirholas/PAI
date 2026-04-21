---
title: Storage layout
description: Squashfs root, overlayfs, LUKS persistence, and where user data actually lives.
order: 9
updated: 2026-04-20
---

# Storage layout

PAI runs as a **live system with an optional encrypted overlay**.
Understanding the storage model is the key to understanding what
survives a reboot and what doesn't.

## The three layers

```
┌──────────────────────────────────────────────┐
│  Merged view at /  (what user-space sees)    │
├──────────────────────────────────────────────┤
│  Upper: tmpfs OR LUKS persistence volume     │ ← writes go here
├──────────────────────────────────────────────┤
│  Lower: squashfs on the ISO (read-only)      │ ← never changes
└──────────────────────────────────────────────┘
```

- **Lower layer**: the squashfs shipped on the ISO. Every package,
  config file, and asset captured at build time. Strictly read-only.
- **Upper layer**: either a tmpfs (amnesic mode, disappears at
  shutdown) or the LUKS-encrypted persistence partition mounted at
  `/lib/live/mount/persistence`.
- **Merged view**: overlayfs combines the two and presents the
  union at `/`.

Writes go to the upper layer. Reads hit the upper first and fall
through to the lower. This is why installing a package in a
running PAI works but vanishes at reboot unless persistence is
mounted and the path is in the persistence list.

## The persistence volume

Format: **LUKS2** with argon2id KDF and a 4096-byte sector size.
Label: `pai-persist`. Inside is an ext4 filesystem containing a
`persistence.conf`:

```
/home        union
/var/lib     union
/etc/NetworkManager/system-connections    union
/var/lib/tor    union
/var/lib/ollama union
```

Each listed path is bind-mounted from the persistence volume on top
of the overlay, so writes there land on encrypted storage and
survive reboots.

See [../persistence/introduction.md](../persistence/introduction.md),
[../persistence/creating-persistence.md](../persistence/creating-persistence.md),
and [../persistence/unlocking.md](../persistence/unlocking.md).

## What survives, what doesn't

| Path                         | Persistent? | Notes                            |
| ---------------------------- | ----------- | -------------------------------- |
| `/home`                      | yes         | User files, dotfiles             |
| `/var/lib/ollama`            | yes         | Model weights                    |
| `/var/lib/tor`               | yes         | Tor state; guard selection       |
| NetworkManager connections   | yes         | Known Wi-Fi, saved PSKs          |
| `/tmp`, `/var/tmp`           | **no**      | tmpfs                            |
| `/var/log`                   | **no**      | volatile by design               |
| `/etc` (general)             | **no**      | comes from squashfs              |
| Anything installed via `apt` | **no**      | unless `/var/cache/apt` is added |

## Storage on ARM64

Same overlay model. Some ARM64 boards boot from eMMC rather than
USB; the ISO handles both, and `pai-persist` is searched on all
attached block devices regardless.

## Back-ups

The persistence volume is a plain LUKS container. Back up by
`dd`ing the partition, or by opening it and `rsync`ing
`/home` somewhere else. See
[../persistence/backing-up.md](../persistence/backing-up.md).
