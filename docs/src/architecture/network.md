---
title: Network architecture
description: Firewall, MAC randomisation, Tor integration, and kill-switch semantics.
order: 7
updated: 2026-04-20
---

# Network architecture

PAI's network posture is **default-deny**. The system can reach the
outside world, but only through paths that the user has explicitly
enabled.

## Firewall

PAI uses **UFW** (which wraps nftables) with a deny-by-default
policy. Built-in rules allow:

- Outbound DHCP and DNS on link-local.
- Outbound Tor SOCKS and control (loopback only).
- NTP over Tor.
- Explicitly allow-listed LAN services when the user opts in.

No inbound rules are open by default. The Ollama API is also bound
to loopback (see [ai-stack.md](ai-stack.md)), giving defence in
depth.

Firewall configuration lives in the chroot hook that builds the
ISO. See the build system: [../development/build.md](../development/build.md).

## MAC address anonymisation

On every interface-up event, a NetworkManager dispatcher replaces
the hardware MAC with a random locally-administered address. This
happens **before** any packet leaves the machine.

- The randomisation is persistent within a session and re-rolls at
  each reconnect, so a long-running connection to the same network
  stays stable.
- A user-visible indicator in waybar shows when the active interface
  is spoofed.
- See [privacy/mac-address-anonymization.md](../privacy/mac-address-anonymization.md)
  for user-facing details.

## Tor integration

Tor is optional and off by default. When enabled:

- `tor.service` comes up and opens a SOCKS listener on `127.0.0.1:9050`.
- Firefox, the package manager, and the crypto wallets are pre-configured
  to route through it.
- NTP is forced through Tor to avoid leaking time-based correlation.
- A waybar module shows the Tor circuit status.

See [privacy/privacy-mode-tor.md](../privacy/privacy-mode-tor.md) for
the user-facing flow.

## Kill switch

In **strict privacy mode**, the firewall refuses all non-loopback
traffic unless `tor.service` is active and healthy. If Tor dies or
fails to bootstrap, the machine falls silent rather than leaking in
clear. Recovery: restart Tor or disable strict mode.

## What the network stack does not do

- DNS-over-HTTPS to a remote resolver. Lookups go through Tor when
  Tor is on, and through the local DHCP-assigned resolver otherwise.
- IPv6 privacy extensions are enabled; stable IPv6 identifiers are
  suppressed.
- No WireGuard or OpenVPN is installed by default — a VPN is a
  trust-shift, not a privacy win, and the user should bring their
  own if they need one.
