---
title: Architecture Diagrams
---

# Architecture Diagrams

Visual references for PAI's architecture. All diagrams are authored in
Mermaid so they stay diffable alongside the rest of the docs.

## System overview

End-to-end view from removable boot medium to a running session.
See the textual walkthrough in [overview.md](overview.md).

```mermaid
flowchart TD
    USB[USB medium] --> BOOT[UEFI / BIOS firmware]
    BOOT --> GRUB[GRUB menu]
    GRUB --> KERNEL[Linux kernel + initramfs]
    KERNEL --> SQUASH[squashfs root, read-only]
    SQUASH --> PCHK{persistence partition?}
    PCHK -- yes --> LUKS[cryptsetup luksOpen pai-persist]
    PCHK -- no  --> TMPFS[tmpfs upperdir]
    LUKS --> OVERLAY[overlayfs: /home, /var/lib/ollama, NM connections]
    TMPFS --> OVERLAY
    OVERLAY --> SYSD[systemd multi-user.target]
    SYSD --> SESSION[sway session]
    SESSION --> AI[AI: Ollama, Open WebUI]
    SESSION --> PRIV[Privacy: Tor, UFW, MAC spoof, Firefox policies]
    SESSION --> TOOLS[Tools: Feather wallet, Electrum, dev CLIs]
```

## Component graph

Process-level view of the services that start by default. See
[components.md](components.md) for per-service reference.

```mermaid
flowchart LR
    subgraph Base
      DEB[Debian 12 bookworm]
    end
    subgraph Session
      SWAY[Sway WM]
      WAYBAR[Waybar]
      MAKO[mako notifications]
    end
    subgraph AI
      OLL[ollama.service]
      WEBUI[open-webui.service]
    end
    subgraph Privacy
      TOR[tor.service]
      UFW[ufw.service]
      MAC[pai-mac-spoof.service]
    end
    subgraph Persistence
      PP[pai-persistence.service]
      SAVE[pai-save-on-shutdown.service]
    end
    DEB --> SWAY
    SWAY --> WAYBAR
    WAYBAR --> OLL
    WAYBAR --> PP
    OLL --> WEBUI
    PP --> OLL
```

## Data flow

Request path for a local LLM interaction and for a Tor-routed web
request. See [data-flow.md](data-flow.md) for the full narrative.

```mermaid
sequenceDiagram
    actor U as User
    participant B as Browser / Open WebUI
    participant O as Ollama (localhost:11434)
    participant D as Disk (overlay / persistence)
    U->>B: prompt in chat UI
    B->>O: POST /api/chat (loopback only)
    O->>D: read model weights (mmap)
    O-->>B: token stream
    B-->>U: rendered tokens
    Note over B,O: No network egress for local inference.
```

```mermaid
sequenceDiagram
    actor U as User
    participant F as Firefox (Tor profile)
    participant T as tor.service (SOCKS 9050)
    participant N as Tor network
    participant S as Destination site
    U->>F: open URL
    F->>T: SOCKS5 CONNECT
    T->>N: three-hop circuit
    N->>S: TLS handshake
    S-->>N: response
    N-->>T: response
    T-->>F: response
    F-->>U: rendered page
```

## Persistence unlock

How a persisted session reaches "ACTIVE" at boot time.

```mermaid
stateDiagram-v2
    [*] --> Boot
    Boot --> CheckCmdline
    CheckCmdline --> live_boot_unlock: kernel cmdline has\npersistence persistence-encryption=luks
    CheckCmdline --> Ephemeral: no persistence flag
    live_boot_unlock --> AwaitPassphrase
    AwaitPassphrase --> Mount: LUKS open OK
    AwaitPassphrase --> Ephemeral: cancelled / wrong passphrase
    Mount --> OverlayReady: overlayfs mounts ready
    OverlayReady --> pai_persistence_service: systemd unit runs pai-persistence unlock
    pai_persistence_service --> Active: /run/pai-persistence-active written
    Active --> [*]
    Ephemeral --> [*]
```

## Contributing diagrams

- Keep source authored in Mermaid inside the same `.md` file that
  references the diagram — diffs show architectural intent alongside
  prose changes.
- For exported SVG assets, store them next to the document and check
  the source fence in too.
- Prefer small, composable diagrams over a single mega-diagram. Each
  page here owns one conceptual layer.
