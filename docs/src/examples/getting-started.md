---
title: "Getting started: build a private research workstation on a USB stick"
description: A guided, end-to-end walkthrough of installing PAI to a USB, unlocking persistence, pulling a local LLM, configuring Tor and Firefox, and backing up your encrypted volume header.
---

# Getting started: build a private research workstation on a USB stick

This is a single, followable story. Do it in order. By the end you will
have a portable, encrypted workstation that runs a local LLM, browses
the web through Tor, and keeps your notes in a persistent volume you can
unlock on any supported machine.

If you get stuck at any step, consult
[../troubleshooting.md](../advanced/troubleshooting.md) and
[../../KNOWN_ISSUES.md](../KNOWN_ISSUES.md).

---

## What you'll build

A bootable USB stick containing:

- A hardened Sway-based Linux session that runs from RAM
- A LUKS-encrypted persistence volume for your notes, models, and
  browser state
- A local LLM pulled via Ollama
- A Firefox profile routed through Tor for research
- A note-taking setup whose data survives reboots

**Time:** ~30 minutes, not counting model download.
**Cost:** One USB stick (32 GB minimum; 64 GB recommended).

---

## What you'll need

**Hardware:**

- USB 3.x stick, 32 GB or larger (64 GB if you want to pull a
  mid-sized model)
- A machine that can boot from USB (x86_64 or ARM64 depending on the
  image you choose)
- Keyboard, display, and a way to connect to the internet

**Software:**

- The PAI image matching your hardware, downloaded from the official
  source
- A flashing tool — on Windows the PAI `flash.ps1` PowerShell one-liner is
  recommended; `dd`, `balenaEtcher`, or the graphical Rufus alternative also
  work
- The published checksum/signature for the image

**Recommended before you start:**

- Close anything with unsaved work on the host machine.
- Pick a strong passphrase for persistence and write it down somewhere
  safe until you've committed it to memory.

![placeholder: hardware checklist photo — USB stick, laptop, phone for checksum](#)

---

## Step 1 — Flash and verify

1. Compute the checksum of the downloaded image and compare it against
   the published value. If it does not match exactly, **stop** and
   re-download. See [../installation.md](../installation.md#verifying-the-image)
   for the exact commands.
2. Verify the signature with the PAI signing key. An image that matches
   the checksum but not the signature is a red flag.
3. Flash the image to your USB stick using the flow in
   [../USB-FLASHING.md](USB-FLASHING.md). Double-check the target
   device path — flashing over the wrong disk will destroy it.

![placeholder: terminal screenshot of sha256 match](#)

You should now have a USB stick that the firmware recognizes as a
bootable device.

---

## Step 2 — First boot and persistence

1. Plug the stick into the target machine and boot into the firmware
   menu (usually `F12`, `F9`, or `Option`). Select the USB device.
2. At the PAI boot menu, choose **PAI (live + persistence setup)**.
3. When the desktop appears, open the **Persistence** app from the
   launcher. It will offer to initialize a new encrypted volume on the
   remaining free space of the stick.
4. Enter a strong passphrase. Confirm it. The tool will create a LUKS2
   volume and format it.
5. Reboot, select **PAI (unlock persistence)**, and enter your passphrase
   at the pre-boot prompt. (If you hit a keyboard-layout mismatch here,
   see [../troubleshooting.md](../advanced/troubleshooting.md#persistence-wont-unlock).)

![placeholder: persistence unlock prompt](#)

From now on, anything you save under `~/persist/` (and opt-in
directories like `~/.ollama` and `~/.mozilla`) survives reboots.

---

## Step 3 — Pull a model with Ollama

1. Confirm you're online. The network applet should show a connection.
2. Open a terminal and run `ollama ps`. It should start the daemon and
   show an empty table.
3. Pick a model that fits your hardware. For a laptop with 16 GB RAM and
   no discrete GPU, start small:

   ```sh
   ollama pull llama3.2:3b-instruct-q4_K_M
   ```

4. When the pull finishes, try it:

   ```sh
   ollama run llama3.2:3b-instruct-q4_K_M "Say hello in three languages."
   ```

If throughput feels painful, see
[../troubleshooting.md](../advanced/troubleshooting.md#ollama-is-extremely-slow).

![placeholder: ollama run output](#)

The model weights live under `~/.ollama`, which is linked into your
persistence volume by default. You won't have to re-download on next
boot.

---

## Step 4 — Enable Tor and set up a research bookmark

1. Open the network panel and toggle **Tor** on. Wait for the indicator
   to turn green. This can take 10–60 seconds; longer on restricted
   networks.
2. Launch Firefox. Visit `about:policies` and confirm the PAI hardening
   policy is loaded (you should see entries for tracking protection,
   disabled telemetry, and the Tor SOCKS proxy).
3. Navigate to a research starting point you'll reuse — for example a
   preferred search frontend or an academic index. Bookmark it.
4. Right-click the bookmark toolbar and pin the bookmark so it survives
   across sessions.

If Tor won't connect, see
[../troubleshooting.md](../advanced/troubleshooting.md#tor-wont-connect). If
Firefox is missing the policy, see
[../troubleshooting.md](../advanced/troubleshooting.md#firefox-wont-start--wrong-policy).

![placeholder: Firefox with Tor indicator](#)

---

## Step 5 — Configure a local note-taking app with persistence

PAI ships with a simple Markdown notes tool and editors like `nvim` and
`micro`. Pick whichever you prefer — the instructions below generalize.

1. Create your notes directory **inside persistence**:

   ```sh
   mkdir -p ~/persist/notes
   ln -s ~/persist/notes ~/notes
   ```

2. Open your editor and save a file to `~/notes/first-session.md`. Write
   a sentence.
3. Reboot, unlock persistence, and confirm the file is still there.

If you skip the symlink and save directly to `~`, you will lose the
notes on next reboot — the live home is tmpfs by design.

![placeholder: notes directory listing after reboot](#)

---

## Step 6 — Back up your persistence header

The LUKS header is tiny but irreplaceable. Without it, your passphrase
cannot unlock the volume. Back it up **now**, while everything works.

1. Identify the persistence partition (usually the second partition on
   your USB stick):

   ```sh
   lsblk
   ```

2. Dump the header to a file on a **separate** storage device — not the
   same USB stick:

   ```sh
   sudo cryptsetup luksHeaderBackup /dev/sdX2 \
     --header-backup-file /media/other/pai-luks-header.img
   ```

3. Store the backup somewhere private. Anyone with the header **and**
   your passphrase can unlock the data. Anyone with just the header
   cannot.

If you later corrupt the header, restore with `luksHeaderRestore` using
the same file.

![placeholder: luksHeaderBackup output](#)

---

## What you learned

- How to verify, flash, and boot a PAI image safely.
- How to initialize and unlock an encrypted persistence volume.
- How to pull and run a local model with Ollama, respecting your
  hardware's limits.
- How to browse through Tor with a hardened Firefox profile.
- How to keep notes that survive reboots — and why naïvely saving to
  `~` does not.
- Why backing up the LUKS header is the single most important recovery
  step.

---

## Next steps

- Walk through more scenarios in
  [real-world-use-cases.md](real-world-use-cases.md).
- Review the architecture overview at
  [../architecture.md](../architecture/overview.md) to understand what's running
  under the hood.
- Read [../../SECURITY.md](../security.md) and
  [../../PRIVACY.md](../PRIVACY.md) to understand the threat model
  you're now inside.
- If something breaks, [../troubleshooting.md](../advanced/troubleshooting.md) is
  organized by symptom. Beyond that,
  [../../SUPPORT.md](../../SUPPORT.md) tells you how to file a report.
