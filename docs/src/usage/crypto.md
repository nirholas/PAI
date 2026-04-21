---
title: Crypto on PAI
description: Self-custody wallets, cold signing, and how to use PAI as a hardware-wallet-grade offline workstation.
audience: crypto-users
sidebar_order: 5
---

# Crypto on PAI

PAI is built to be a **cold-signing workstation**. You can run it
air-gapped, sign a transaction offline, and move just the signed
blob back to an online machine.

## What's included

| Tool              | Purpose                              |
| ----------------- | ------------------------------------ |
| Bitcoin Core      | Full-node capable BTC wallet         |
| Electrum          | Lightweight BTC wallet with hardware-wallet and multisig support |
| Monero CLI + GUI  | XMR wallet with view-only support    |

Wallet state lives under `/home`, which is on the persistence
volume when persistence is unlocked. See
[../persistence/introduction.md](../persistence/introduction.md).

## Cold signing workflow

1. Boot PAI with network disabled (or in
   [privacy/offline-mode.md](../privacy/offline-mode.md)).
2. Open the wallet, load a watch-only wallet file exported from
   your online machine.
3. Import the unsigned PSBT (Bitcoin) or unsigned transaction
   (Monero) via USB.
4. Sign.
5. Export the signed transaction back to USB; broadcast from an
   online machine.

A full walkthrough is in
[examples/crypto-cold-signing.md](../examples/crypto-cold-signing.md).

## Key storage

- **GPG keys** and passphrase databases: use
  [apps/password-management.md](../apps/password-management.md) or
  [apps/encrypting-files-gpg.md](../apps/encrypting-files-gpg.md).
- **Wallet seed phrases**: store offline, on paper or metal. PAI
  does not and cannot back these up for you.
- Persistence protects the wallet file at rest with LUKS2
  (argon2id). Lose the LUKS passphrase and the funds are gone.

## Hardware wallets

Ledger, Trezor, and Coldcard USB devices are supported out of the
box. udev rules ship with the ISO. See
[reference/keyboard-shortcuts.md](../reference/keyboard-shortcuts.md)
for quick launches.

## What PAI doesn't do

- Recover your seed. Not possible. That's the point.
- Broadcast for you. PAI is the **signer**, not the network node.
- Protect against an unlocked machine left unattended. Always lock
  the screen or shut down.
