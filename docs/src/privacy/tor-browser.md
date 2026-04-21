---
title: "Tor Browser on PAI — Anonymous Browsing with Fingerprint Protection"
description: "Using Tor Browser on PAI for anonymous web access. Covers setup, security levels, onion services, and how Tor Browser differs from Privacy Mode."
sidebar:
  label: "Tor Browser"
  order: 5
tableOfContents:
  minHeadingLevel: 2
  maxHeadingLevel: 3
head:
  - tag: meta
    attrs:
      property: "og:description"
      content: "Using Tor Browser on PAI for anonymous web access. Covers setup, security levels, onion services, and how Tor Browser differs from Privacy Mode."
  - tag: meta
    attrs:
      name: "keywords"
      content: "Tor Browser Linux", "anonymous browsing PAI", "PAI Tor Browser setup", "onion services"
---


Tor Browser is the gold standard for anonymous web browsing. Unlike routing regular Firefox through Tor, Tor Browser actively defends against fingerprinting, tracking, and deanonymization attacks that a plain browser cannot stop.

This guide covers using Tor Browser on PAI — when to reach for it instead of [Privacy Mode](privacy-mode-tor.md), how it's installed, and how to stay anonymous once you're using it.

In this guide:
- When to use Tor Browser instead of Privacy Mode
- Launching Tor Browser on PAI
- Security level settings — what each one protects against
- Using onion services (.onion addresses)
- Common anti-patterns that break anonymity
- Verifying you are, in fact, anonymous

**Prerequisites**: PAI booted, internet connection available.

## Tor Browser vs Privacy Mode — when to use each

Both use Tor, but they defend against different threats:

| | Privacy Mode | Tor Browser |
|---|---|---|
| Routes traffic through Tor | ✓ | ✓ |
| Hides your IP from websites | ✓ | ✓ |
| Hardens browser against fingerprinting | ✗ | ✓ |
| Disables JavaScript by default (highest setting) | ✗ | ✓ |
| Blocks common tracking vectors (canvas, fonts, audio) | ✗ | ✓ |
| Sandbox-isolated from the rest of the system | ✗ | Partial |
| Opens .onion addresses natively | Requires config | ✓ |
| Speed | Normal browsing speed | Slower due to hardening |

Use **Privacy Mode** when you want *privacy* — general protection during regular browsing, API calls, and app network use. It's good day-to-day hygiene.

Use **Tor Browser** when you want *anonymity* — specific sessions where being identifiable would cause real harm (research into sensitive topics, communicating with whistleblowers, accessing onion-only services).

!!! tip "Stack them"

    You can turn on Privacy Mode for general system traffic *and* use Tor Browser for the sensitive part. Tor Browser handles its own Tor circuit; Privacy Mode covers everything else on your system.


## Launching Tor Browser on PAI

PAI ships with `torbrowser-launcher` — Debian's wrapper that downloads and verifies Tor Browser on first use.


1. First launch — downloads Tor Browser from torproject.org:
   ```bash
   torbrowser-launcher
   ```
   Or: press `Alt+Shift+T` if your profile's `active.conf` binds it (the `full` profile does).

2. The launcher verifies the GPG signature of the download before running. This takes ~30 seconds and requires internet.

3. Once verified, Tor Browser opens. First run asks: **Connect** or **Configure**.
   - **Connect** — works on most networks
   - **Configure** — needed if your network blocks Tor (rare); uses pluggable transports / bridges

4. After connection, you land on the Tor Browser start page. You're now browsing through Tor.


On future launches, Tor Browser starts in 5-10 seconds — the download only happens once per session (live system wipes it on reboot unless persistence is enabled).

## The three security levels

Click the shield icon in Tor Browser's toolbar → Advanced Security Settings.

| Level | JavaScript | Fonts | Media | Use case |
|---|---|---|---|---|
| **Standard** | Enabled | Default | Allowed | Day-to-day anonymous browsing |
| **Safer** | Disabled on non-HTTPS sites | Some disabled | Click to play | Mixed — most sites work, fewer attack surfaces |
| **Safest** | Disabled everywhere | Monospace only | Disabled | Maximum protection — many sites will break |

!!! warning "Safer and Safest break sites on purpose"

    These levels disable features that modern sites assume. Most interactive
    sites (social media, SaaS apps) will be broken or read-only. That's the
    trade-off for less attack surface.


Default is Standard. Escalate only when your threat model calls for it.

## Onion services (.onion)

Onion services are sites reachable only through Tor. They provide end-to-end encryption without relying on certificate authorities, and they hide the server's IP from visitors (and vice versa).

Examples:
- **DuckDuckGo**: `https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion`
- **New York Times**: `https://www.nytimesn7cgmftshazwhfgzm37qxb44r64ytbb2dj3x62d2lljsciiyd.onion`
- **ProPublica**: `https://www.propub3r6espa33w.onion`
- **Archive.org**: via their site — not onion-only

Just paste a .onion URL into Tor Browser's address bar. If the site is reachable, it loads normally. No extra setup.

Tor Browser shows a purple circuit icon indicating you're visiting an onion service rather than a regular site.

## Getting the onion version of a site

Many mainstream sites offer .onion mirrors but don't advertise them prominently:

1. Visit the site normally in Tor Browser
2. Tor Browser auto-detects `.onion-location` HTTP headers and offers to switch
3. Or look for an ".onion" badge in the address bar

When a site supports it, visiting the onion version is strictly better for anonymity — even your Tor exit node can't see what you're doing.

## Anti-patterns — how to lose your anonymity

Tor Browser's protections stop at the browser boundary. You can easily defeat them by:

- **Logging into identifying accounts**: signing into your Gmail in Tor Browser links that session to you, regardless of the Tor circuit
- **Downloading files and opening them outside Tor Browser**: a PDF can call home when opened in a non-Tor app
- **Enabling browser plugins**: most require your identity (Adobe Flash, Java) or leak your real IP
- **Maximizing the window**: Tor Browser deliberately starts at a fixed size to avoid fingerprinting. Resizing the window makes your browser uniquely identifiable
- **Using a rare language / keyboard layout**: if your browser says "accept English-US" but you're one of 50 people browsing in Esperanto, you stand out
- **Torrenting**: BitTorrent protocols bypass the browser and reveal your real IP. Never torrent over Tor.

## Tutorial: Verify you're actually anonymous

### Goal
Confirm Tor Browser is routing you correctly and hiding your real IP.

### What you need
- Tor Browser launched and connected
- Your real IP (get it from `curl https://ipinfo.io/ip` in a regular terminal — but not through Privacy Mode!)


1. In Tor Browser, visit https://check.torproject.org/ — Should say "Congratulations. This browser is configured to use Tor."

2. Visit https://ipinfo.io — The IP shown should NOT match your real IP.

3. Visit https://amiunique.org — Click "View my browser fingerprint."
   - Tor Browser should be classified as "common" rather than "unique"
   - Browser string should match common Tor Browser values
   - Screen resolution should match the fixed default (1000×1000 or similar)

4. Visit https://browserleaks.com/webrtc — WebRTC should show "Disabled" or not reveal your real IP. Tor Browser disables WebRTC by default.

5. Visit https://coveryourtracks.eff.org — Full fingerprinting audit.


### What just happened

You proved your browser presents a generic Tor Browser fingerprint rather than a unique identifiable signature. Combined with the Tor circuit, you're now part of a crowd of Tor users, not a unique individual.

## New identity / new circuit

Tor Browser has two "reset" options in its menu:

- **New Circuit for this Site**: gives the current tab a different Tor path to the same site. Useful if a circuit is slow.
- **New Identity**: closes all tabs, clears state, starts fresh with a new circuit. Use between unrelated browsing sessions to avoid linking activity.

Keyboard shortcut for New Identity: `Ctrl+Shift+U`.

## Tor Browser on a live system

Since PAI is a live system (unless persistence is enabled):

- Bookmarks, history, cookies — all vanish on shutdown
- Downloaded files vanish unless saved to an external drive
- Tor Browser itself re-downloads on next boot (via `torbrowser-launcher`)

With persistence (Task 04 / v0.2), Tor Browser can save your bookmarks and keep the downloaded binary across reboots. Even then, clear history between unrelated sessions.

## Frequently asked questions

### Is Tor Browser already installed?
PAI ships `torbrowser-launcher`, which downloads and GPG-verifies Tor Browser the first time you run it. On a live boot without internet on first run, the download happens the first time you connect. Download is ~100 MB.

### Can I use Tor Browser without Privacy Mode enabled?
Yes. Tor Browser runs its own Tor instance. Privacy Mode is system-wide Tor routing; Tor Browser is browser-level. They're independent.

### Is Tor Browser just Firefox?
It's a heavily patched Firefox with anti-fingerprinting changes, NoScript preinstalled, and a Tor backend. Many Firefox features are intentionally disabled.

### Can websites detect I'm using Tor?
Yes, easily — there's a public list of Tor exit nodes. Some sites block Tor, some show captchas, some limit functionality. This is expected, not a Tor failure.

### Will Tor Browser slow down my other apps?
No. Tor Browser runs its own Tor daemon on a separate port. It doesn't affect other apps. Only Privacy Mode routes everything system-wide.

### How do I bookmark sites?
Same as Firefox (Ctrl+D). But on a live system without persistence, bookmarks don't survive reboot. With persistence, they do.

### Can I use my regular email or social media in Tor Browser?
Yes, but logging in links that identity to your Tor session. For full anonymity, use throwaway accounts created inside Tor Browser. Never log into the same account from Tor Browser and regular Firefox — that cross-links identities.

### What if my ISP blocks Tor?
Some countries / workplaces block Tor connections. Configure Tor Browser to use a bridge (a non-public Tor entry point) via the launcher's Configure option. Pluggable transports (obfs4, snowflake) disguise Tor traffic to look like ordinary HTTPS.

### Does Tor make my internet slower?
Yes, usually. Each request goes through three Tor nodes, often across continents. Expect latency of 1-5 seconds and reduced bandwidth. This is intrinsic to Tor, not a PAI issue.

## Related documentation

- [**Privacy Mode (Tor system-wide)**](privacy-mode-tor.md) — System-level Tor routing for all apps
- [**Privacy Introduction**](introduction-to-privacy.md) — PAI's overall privacy model
- [**Offline Mode**](offline-mode.md) — When even Tor isn't paranoid enough
- [**Warnings and Limitations**](../general/warnings-and-limitations.md) — What PAI can and can't protect
- [Tor Project — official Tor Browser manual](https://tb-manual.torproject.org/)
