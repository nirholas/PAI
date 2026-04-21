---
title: Data Flow
description: Traced flows for boot, persistence creation, AI inference, private browsing, crypto transactions, and shutdown — with persist / leaves / wipe markers.
order: 3
updated: 2026-04-17
---

# Data Flow

Each section below traces a single end-to-end flow. The markers are:

- **[persist]** — data is written to the LUKS persistence overlay and
  survives reboot.
- **[leaves]** — data crosses the device boundary (network, display,
  removable media).
- **[wipe]** — data is dropped or actively scrubbed.

See [overview.md](overview.md) for the static picture and
[components.md](components.md) for the subsystems named below.

## 1. Boot sequence

```mermaid
sequenceDiagram
    participant User
    participant FW as Firmware (UEFI)
    participant GRUB
    participant Kern as Kernel + initramfs
    participant Disk as USB medium
    participant SD as systemd
    participant Greet as greetd
    User->>FW: power on
    FW->>Disk: read EFI partition
    Disk-->>FW: shim + GRUB EFI binary
    FW->>GRUB: hand off
    GRUB->>Disk: load kernel + initrd
    Disk-->>GRUB: images
    GRUB->>Kern: boot with cmdline
    Kern->>Disk: mount squashfs (ro)
    Kern->>Disk: probe for LUKS persistence
    alt Persistence present
        Kern->>User: prompt passphrase
        User-->>Kern: passphrase
        Kern->>Disk: cryptsetup open, mount overlay upper
    else Amnesic
        Kern->>Kern: tmpfs upper
    end
    Kern->>SD: switch_root, start default.target
    SD->>SD: MAC randomise, UFW, Tor (opt)
    SD->>Greet: start greetd
    Greet->>User: login prompt
```

- **[persist]** only `/home`, `/var/lib`, NetworkManager connections,
  Tor state, Ollama models (if persistence unlocked).
- **[leaves]** nothing yet — networking is brought up with a randomised
  MAC and a default-deny firewall before any user code runs.
- **[wipe]** tmpfs upper is empty on every amnesic boot; initramfs is
  discarded after `switch_root`.

## 2. First-boot persistence creation

```mermaid
sequenceDiagram
    participant User
    participant Tool as setup-persistence.sh
    participant Disk as USB free space
    participant LUKS as cryptsetup
    participant Kern as kernel / overlay
    User->>Tool: run "Setup persistence"
    Tool->>Disk: create partition `pai-persist`
    Tool->>User: prompt passphrase (twice)
    User-->>Tool: passphrase (in RAM only)
    Tool->>LUKS: luksFormat --type luks2 --pbkdf argon2id
    LUKS->>Disk: write LUKS2 header + keyslot
    Tool->>LUKS: luksOpen pai-persist
    Tool->>Kern: mkfs.ext4, write persistence.conf
    Tool->>Kern: remount overlay with new upper
    Tool-->>User: done, reboot recommended
```

- **[persist]** LUKS2 header, keyslot, `persistence.conf`,
  `ext4` superblock — all on the USB medium.
- **[leaves]** nothing. Passphrase is read from the local keyboard and
  never written or transmitted.
- **[wipe]** passphrase buffer is freed after `cryptsetup`; argon2
  working memory is zeroed by the library.

## 3. AI inference

```mermaid
sequenceDiagram
    participant User
    participant UI as chat frontend
    participant API as Ollama (127.0.0.1:11434)
    participant FS as ~/.ollama (persist overlay)
    participant GPU as CPU / GPU
    User->>UI: types prompt
    UI->>API: POST /api/chat
    API->>FS: read model weights (mmap)
    FS-->>API: tensors
    API->>GPU: forward pass
    GPU-->>API: token stream
    API-->>UI: SSE tokens
    UI-->>User: rendered reply
    UI->>FS: append conversation (if saved)
```

- **[persist]** model weights under `~/.ollama/models`; conversation
  history only if the user explicitly saves it.
- **[leaves]** nothing — the firewall blocks Ollama from binding or
  reaching any interface other than loopback.
- **[wipe]** KV cache in RAM is released when the session ends;
  unsaved conversations vanish on logout.

## 4. Private browsing

```mermaid
sequenceDiagram
    participant User
    participant FF as Firefox (policies)
    participant TOR as tor (127.0.0.1:9050)
    participant Guard as Tor guard relay
    participant Exit as Tor exit relay
    participant Dest as destination server
    User->>FF: request https://example
    FF->>TOR: SOCKS5 CONNECT example:443
    TOR->>Guard: build circuit
    Guard->>Exit: extend circuit
    Exit->>Dest: TCP + TLS to example:443
    Dest-->>Exit: TLS bytes
    Exit-->>TOR: stream
    TOR-->>FF: bytes
    FF-->>User: render
```

- **[persist]** nothing by default. Firefox profile is under the
  overlay; with persistence it keeps bookmarks and logins, without it
  the profile is thrown away at reboot.
- **[leaves]** encrypted traffic to the Tor guard (ISP sees only "this
  IP talks to Tor"), and the final TLS stream from the exit to the
  destination.
- **[wipe]** cache, cookies, history on Firefox exit (policy-enforced
  in amnesic mode).

## 5. Crypto transaction

```mermaid
sequenceDiagram
    participant User
    participant Wallet as Electrum / Monero CLI
    participant Seed as seed + keys (persist overlay)
    participant TOR as tor SOCKS
    participant Node as remote node (onion)
    participant Mempool as network mempool
    User->>Wallet: compose transaction
    Wallet->>Seed: load private key
    Seed-->>Wallet: key material (RAM)
    Wallet->>Wallet: sign transaction (offline-equivalent)
    Wallet->>TOR: SOCKS5 to onion node
    TOR->>Node: deliver signed tx
    Node->>Mempool: relay
    Mempool-->>Node: confirmations
    Node-->>Wallet: status via Tor
    Wallet-->>User: confirmation shown
```

- **[persist]** seed, xpub/xpriv, wallet db under
  `~/.bitcoin`, `~/.electrum`, `~/.bitmonero` — always behind LUKS.
- **[leaves]** only the **signed** transaction, carried via Tor to an
  onion endpoint. No IP, no seed, no unsigned key material leaves the
  device.
- **[wipe]** private key buffers are zeroed by the wallet after
  signing; RAM is dropped at shutdown (§ 6).

## 6. Shutdown

```mermaid
sequenceDiagram
    participant User
    participant SD as systemd
    participant Sess as Sway session
    participant Ovl as overlayfs
    participant LUKS
    participant Kern as kernel
    User->>SD: poweroff
    SD->>Sess: SIGTERM, then SIGKILL
    Sess-->>SD: exit
    SD->>Ovl: unmount overlays
    SD->>LUKS: cryptsetup close pai-persist
    SD->>Kern: sync, optional fstrim on persist partition
    Kern->>Kern: drop caches, zero free pages
    SD->>Kern: poweroff
    Kern-->>User: machine off
```

- **[persist]** whatever has already been written by running processes
  is flushed by `sync` and then sealed when LUKS closes.
- **[leaves]** nothing — network is torn down before filesystems.
- **[wipe]** tmpfs upper (if amnesic), page cache, swap (PAI disables
  swap by default), and — with `fstrim` — freed blocks on the
  persistence partition if the USB controller honours TRIM. DRAM
  contents decay once power is removed; PAI does not attempt to defend
  against cold-boot attacks on unlocked RAM.
