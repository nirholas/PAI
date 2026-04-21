---
title: Security architecture
description: Trust boundaries, hardening, and the defences PAI provides at each layer.
order: 8
updated: 2026-04-20
---

# Security architecture

**PAI's security model is layered, explicit, and verifiable.** The trust boundary is a physical object you hold. Every defence on this page is either stock Debian hardening you can audit against upstream, or a small, specific PAI addition documented here. No black boxes, no proprietary magic, no surprises.

This page describes the defences PAI provides. For the adversary
model and what is explicitly out of scope, see
[threat-model.md](threat-model.md).

## Trust boundary

The trust boundary is the **physical USB device + its LUKS
passphrase**. Anything outside that boundary — the host firmware,
the user's habits, the network — is untrusted.

## Layered defences

### At rest

- **Squashfs root** is read-only. Even a compromised session cannot
  write to system files; modifications vanish at reboot.
- **LUKS2 persistence** (argon2id KDF, 4096-byte sector size)
  protects user data if the device is seized.
- **No swap file by default** to avoid leaking memory-resident
  secrets to disk.

### In memory

- `sysctl` hardening: `kernel.dmesg_restrict`, `kernel.kptr_restrict`,
  `kernel.yama.ptrace_scope`, `net.ipv4.tcp_syncookies`, and the
  usual rp_filter / martian-log settings.
- **Shutdown zeroes RAM** where supported by the kernel option
  (`mem_sleep_default=s2idle`, `init_on_free=1`).

### In transit

- Default-deny firewall (see [network.md](network.md)).
- MAC randomisation before first packet.
- Optional Tor routing with kill-switch.

### In the session

- Firefox ships with a policy file disabling telemetry, Pocket,
  Normandy, and third-party cookies by default.
- `greetd` re-launches Sway on logout; no fallback to a TTY that
  could expose unauthenticated shells.
- `swaylock` for screen-lock; idle-lock enabled out of the box.

## Hardening posture

PAI's posture is **stand on proven ground**: inherit the hardening of the wider Debian ecosystem, add only what PAI's specific use case requires, and keep every addition reviewable by a single person in an afternoon. This is a deliberate trust strategy — it means every byte of PAI's security story is auditable against upstream, with no bespoke layer you have to take on faith.

PAI follows the principle of **lean on upstream, don't reinvent**:

- The kernel is stock Debian with distro-provided mitigations.
- AppArmor profiles from Debian stable apply as shipped.
- We do not ship a custom LSM, custom allocator, or custom syscall
  filter. Additions are reviewed against the threat model
  ([threat-model.md](threat-model.md)), not added speculatively.

## Signing and verification

- ISO images are signed. See [../USB-FLASHING.md](../USB-FLASHING.md)
  for how to verify the signature before flashing.
- Debian package sources use the stock Debian keyring with Tor as the
  transport when privacy mode is on.

## User-facing security guides

- [PRIVACY.md](../PRIVACY.md) — PAI's privacy policy.
- [security.md](../security.md) — reporting security issues.
- [apps/encrypting-files-gpg.md](../apps/encrypting-files-gpg.md),
  [apps/password-management.md](../apps/password-management.md),
  [apps/secure-delete.md](../apps/secure-delete.md).
