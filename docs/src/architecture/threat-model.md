---
title: Threat model
description: The adversaries PAI defends against, the ones it doesn't, and the explicit assumptions.
order: 10
updated: 2026-04-20
---

# Threat model

PAI is a **privacy-first offline AI workstation** on a USB stick.
This page spells out the adversary model behind that sentence.

## Assets

1. **User data** on the persistence volume (documents, chat
   history, wallet keys, Wi-Fi passwords).
2. **Session state** in RAM (decryption keys, browser cookies,
   crypto-wallet state).
3. **User identity / correlation signals** (MAC address, typing
   patterns, account logins, time-zone, DNS lookups).

## Adversaries PAI defends against

### Passive network observer

Someone on the café Wi-Fi or the user's ISP watching packets.

**Defences**: MAC randomisation, Tor option with kill-switch,
HTTPS-only, no telemetry, DNS routed through Tor when enabled.
See [network.md](network.md).

### Forensic recovery after seizure

Device is found, powered off, and imaged.

**Defences**: LUKS2 persistence, no swap, squashfs root means no
"last-used files" in system paths, volatile logs.

### Cross-session correlation

Multiple visits to the same network or the same site should not
be trivially linkable.

**Defences**: amnesic-by-default session, MAC re-roll, browser
profile reset on shutdown (unless the user opts in to persisting
it), Tor circuits per destination.

### Compromised packages from the internet

A user who would otherwise `curl | bash` something sketchy.

**Defences**: read-only root means a post-boot compromise is
limited to the upper layer; reboot recovers. Package sources are
pinned to Debian stable and the ISO's signing key chain.

## Adversaries PAI does not defend against

Being explicit about this is the point of a threat model.

- **Malicious firmware / UEFI rootkit**: the firmware is below PAI.
  Secure Boot helps but is not a complete defence.
- **DMA attacks** (Thunderbolt, PCIe, FireWire) with an attacker in
  physical range while the machine is unlocked.
- **Hardware keyloggers / screen recorders**: physical tampering
  with the host.
- **Coerced disclosure** of the LUKS passphrase.
- **Active targeting by a well-resourced adversary**: PAI raises
  the cost of dragnet surveillance; it is not a full counter-intel
  platform.
- **Users who disable the firewall, run random binaries, or paste
  secrets into a cloud LLM**. The stack cannot save a user from
  their own choices.

## Explicit assumptions

- The user verifies ISO signatures before flashing.
- The user chooses a LUKS passphrase strong enough to resist offline
  cracking.
- The host machine's firmware is trusted *enough* — PAI doesn't
  protect against a compromised BMC or Intel ME.
- Physical custody of the USB stick is maintained. "Evil maid"
  attacks against an unattended live USB are not fully mitigated.

## Reporting security issues

See [../security.md](../security.md). For the privacy policy,
see [../PRIVACY.md](../PRIVACY.md). The broader philosophy is in
[../PHILOSOPHY.md](../PHILOSOPHY.md).
