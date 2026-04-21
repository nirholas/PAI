---
title: Email and PGP
description: Sign and encrypt messages with GPG on PAI, with Thunderbird and Enigmail already wired up.
audience: privacy-conscious users
sidebar_order: 6
---

# Email and PGP

PAI ships a full PGP toolchain — GnuPG, Kleopatra, and a preconfigured
Thunderbird — so you can sign and encrypt mail without downloading
extensions and without trusting a webmail client.

## Managing keys

Open **Kleopatra** from the launcher (`Super + D`, then type "kleopatra").
From there you can:

- Generate a new GPG key pair (RSA-4096 or Ed25519).
- Import an existing key from a `.asc` file.
- Export your public key to share.
- Publish to a keyserver (WKD is preferred over SKS).

Private keys live in `~/.gnupg`, which is on the persistence volume
when persistence is unlocked. They're protected at rest by LUKS2
*and* by the GPG passphrase.

## Signing and encrypting files

Right-click any file in Thunar and choose **Encrypt**, **Sign**, or
**Decrypt / Verify**. A signed file gets a `.asc` or `.sig`
sidecar; an encrypted file becomes `<name>.gpg`.

Full walkthrough in
[../apps/encrypting-files-gpg.md](../apps/encrypting-files-gpg.md).

## Email

Thunderbird is installed and ready. On first launch:

1. Add your email account (IMAP or OAuth — OAuth goes through Tor
   if Tor is on).
2. In **Account Settings → End-to-End Encryption**, import your GPG
   key or generate a new one.
3. Compose a message. The padlock and pen icons toggle encryption
   and signing.

## Verifying a signed message you received

- For inline signatures (`-----BEGIN PGP SIGNED MESSAGE-----`),
  Thunderbird verifies automatically if you have the sender's key.
- For attachments, right-click and choose **Decrypt / Verify**.
- From the terminal: `gpg --verify message.sig message.txt`.

If you don't have the sender's public key, fetch it through WKD or
a keyserver: `gpg --auto-key-locate wkd --locate-keys alice@example.com`.

## Best practices

- Keep your primary key offline; use subkeys on PAI for day-to-day
  operations. See the Debian wiki page on subkeys.
- Back up `~/.gnupg` the same way you back up the rest of
  persistence (see [../persistence/backing-up.md](../persistence/backing-up.md)).
- Use a hardware token (YubiKey, Nitrokey) if you're at the level
  where that matters — PAI supports them out of the box.

## What this doesn't protect

PGP protects message contents. It does not protect metadata: who
you mailed, when, and from where. Route mail through Tor (see
[../privacy/privacy-mode-tor.md](../privacy/privacy-mode-tor.md))
if metadata matters.
