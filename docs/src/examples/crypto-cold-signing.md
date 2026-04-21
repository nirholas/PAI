---
title: "Crypto cold-signing: a disposable PAI session for hardware-wallet transactions"
description: A focused walkthrough of using PAI as an air-gapped or near-air-gapped signing environment with a hardware wallet, keeping your daily-driver OS out of the signing path entirely.
---

# Crypto cold-signing: a disposable PAI session for hardware-wallet transactions

The point of this guide is narrow: **sign a transaction on a machine
that has never browsed the web as you**, using PAI as the isolation
layer between your daily-driver OS and your keys.

Complete [getting-started.md](getting-started.md) first. This walkthrough
assumes you already have a working stick with persistence.

**Important:** Nothing here replaces the hardware wallet's own display
verification. If you stop reading the device screen, you lose the
protection. Also read
[../../SECURITY.md](../security.md#cryptocurrency-workflows) before
putting real value through this flow.

---

## What you'll build

- A minimal persistence volume dedicated only to signing — no email,
  no messaging, no browser history
- A udev rule that lets your hardware wallet talk to PAI without sudo
- A signing workflow for a single chain you use (the tutorial uses
  Bitcoin with a Coldcard or Trezor as the example; adapt for
  Ethereum/Solana by swapping the wallet software in Step 3)
- A verification habit that survives mistakes

**Time:** ~40 minutes the first time, ~5 minutes per signing after.

---

## Step 1 — Create a dedicated signing persistence volume

Re-using the persistence you set up in Tutorial 1 is fine for small
amounts. For anything you would not laugh off losing, initialize a
**second** PAI stick used only for signing.

1. Flash a second USB following
   [../USB-FLASHING.md](USB-FLASHING.md).
2. Boot it, initialize persistence with a **different** passphrase
   than your main stick.
3. Label the physical stick so you don't confuse them. A colored cap
   or a piece of tape is fine.

The point of the second stick is blast radius: if your research stick
is ever compromised, your signing stick is not.

---

## Step 2 — Set up hardware wallet USB access

Most hardware wallets need a udev rule so a non-root user can open the
device.

1. Plug the hardware wallet in and run `lsusb` to confirm PAI sees it.
2. Install the vendor's udev rules from PAI's local package mirror. Do
   not curl-pipe-bash vendor install scripts into a signing
   environment — fetch the rules as a file, read them, then copy:

   ```sh
   sudo cp ~/persist/vendor-rules/51-hw-wallet.rules /etc/udev/rules.d/
   sudo udevadm control --reload
   sudo udevadm trigger
   ```

3. Unplug and replug the wallet. `dmesg | tail` should show the device
   reattaching with the correct permissions.

If the wallet is not detected, see
[../troubleshooting.md](../advanced/troubleshooting.md#hardware-wallet-not-detected).

---

## Step 3 — Install and launch your signing software

The example uses a Bitcoin PSBT flow; substitute the wallet software
for your chain (Electrum, BitBoxApp, Rabby for EVM, etc.).

1. Install from the PAI-local mirror rather than downloading a binary
   from the web. This avoids a signing session where the signing
   software itself was fetched minutes earlier from an untrusted
   network.
2. Launch the app and connect the hardware wallet.
3. Verify the app shows the **same** xpub / address the hardware
   wallet displays on its screen. If they differ, stop. Something is
   wrong — either supply chain or user error, but don't sign through
   it.

---

## Step 4 — Sign a transaction (PSBT flow)

This flow assumes you construct the PSBT on another machine (watch-
only wallet on your daily driver) and bring it to PAI to sign.

1. Transfer the unsigned PSBT to PAI. A microSD shuttled between the
   watch-only machine and PAI is the cleanest path. A USB stick works
   too; network transfer defeats the point of this tutorial.
2. Open the PSBT in the signing app.
3. Read the destination address **on the hardware wallet's screen**.
   Not the laptop display. The laptop is the untrusted surface; the
   wallet screen is the trust root.
4. Confirm the amount, also on the wallet screen.
5. Approve. The signed PSBT is written back.
6. Transfer the signed PSBT back to the watch-only machine for
   broadcast. Power off PAI.

The signing machine never talks to a node. The node never sees your
keys. That separation is the whole point.

---

## Step 5 — Build a verification habit

Signing mistakes are almost always user errors, not software bugs.
Lock in the habit now while the stakes are low.

- Always read the **full** destination address on the hardware wallet
  screen, not the first and last four characters. Address-substitution
  malware targets exactly that shortcut.
- Do a test send of a trivial amount before a large one, even to an
  address you've used before. Paste buffers get compromised.
- Keep a paper log (or a file in persistence) of txids you signed.
  Future-you will want it.

---

## Step 6 — Back up the seed recovery, not the stick

The PAI stick holds **no secrets** about your crypto — the hardware
wallet does. Your backup plan is therefore:

- A metal seed backup, stored where water and fire will not reach it.
- A LUKS header backup of the PAI persistence volume (see Tutorial 2
  Step 4), in case you need to reconstruct the signing environment.
- A written description of which wallet software, version, and
  derivation path you used. In five years you will have forgotten.

Do **not** photograph the seed. Do **not** type it into PAI or any
computer. The seed exists on metal and on the wallet, nowhere else.

---

## What you learned

- Why a dedicated signing stick limits blast radius.
- How to get a hardware wallet talking to PAI without escalating
  privileges more than necessary.
- Why the hardware wallet screen — not the laptop — is the trust root.
- The PSBT shuttle pattern and why it beats a connected flow.
- What to back up (seed, header, wallet metadata) and what not to back
  up (the PAI stick itself).

---

## Next steps

- For travel hardening on the signing stick, see
  [travel-and-network-hardening.md](travel-and-network-hardening.md).
- For the full threat model this workflow assumes, see
  [../../SECURITY.md](../security.md#cryptocurrency-workflows).
- For the ethics of self-custody and what this workflow does **not**
  protect you from (coercion, social engineering, loss), see
  [../../ETHICS.md](../ETHICS.md).
