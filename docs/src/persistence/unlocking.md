---
title: "Unlocking PAI Persistence — Daily Usage and Key Management"
description: "Daily usage of PAI's LUKS persistence: boot-time unlock, skipping for a clean session, changing and adding passphrases, checking status, editing persistence.conf, and recovering from errors."
sidebar:
  label: "Unlocking & daily use"
  order: 3
tableOfContents:
  minHeadingLevel: 2
  maxHeadingLevel: 3
head:
  - tag: meta
    attrs:
      property: "og:description"
      content: "Daily usage of PAI's LUKS persistence: boot-time unlock, skipping for a clean session, changing and adding passphrases, checking status, editing persistence.conf, and recovering from errors."
  - tag: meta
    attrs:
      name: "keywords"
      content: "unlock PAI persistence, LUKS passphrase change, cryptsetup luksChangeKey, LUKS key slots, pai-persistence status, edit persistence.conf, Debian live-boot persistence unlock"
---


**Once persistence is set up, every boot gives you a choice: enter the passphrase to resume your work, or skip it for a clean ephemeral session. This guide covers the day-to-day: the unlock prompt, when to skip, checking persistence state from a terminal, managing passphrases and LUKS key slots, editing `persistence.conf` to change what's persisted, and what to do when something goes wrong.** Persistence is designed to be a quiet, reliable layer — this guide is for the moments you need to interact with it directly.

In this guide:
- The boot-time unlock prompt and how to respond to it
- When to unlock and when to skip for a clean session
- Checking persistence state with `pai-persistence status` and the waybar indicator
- Changing your passphrase without losing data
- Adding a second passphrase (backup key, hardware token, emergency access)
- Editing `persistence.conf` to add, remove, or change persisted paths
- Troubleshooting unlock failures and recovering from edge cases
- Why there is no in-session lock, and what to do instead

**Prerequisites**: Persistence already set up per [creating persistence](creating-persistence.md). Comfortable running `sudo` commands in a terminal. No prior LUKS expertise required — every command is shown verbatim.

## The boot-time unlock prompt

Every boot with a persistence USB plugged in shows a prompt early in the boot sequence, **before** the graphical desktop loads. This is live-boot's initramfs prompt, not a PAI dialog — it looks like plain text on a text console:

```
Please unlock disk persistence:
```

Type your passphrase and press Enter. You won't see the characters — there's no echo and no asterisks, which is normal for Unix password prompts.

Three outcomes:

- **Correct passphrase** → LUKS unlocks, the bind-mounts are created, systemd starts, Sway loads, and the waybar shows **[💾 Persist]**.
- **Wrong passphrase** → you get two more tries. After the third failed attempt, live-boot gives up and boots ephemerally.
- **Skipped (press Enter on an empty line, or Esc depending on your hardware)** → live-boot boots ephemerally immediately, no retry.

!!! note

    The wrong-passphrase behavior is fail-open, not fail-closed. Three wrong tries gets you a clean PAI, not a lockout. This is the right default for a live system — you never want a bad passphrase attempt to make PAI unbootable.


## When to skip the unlock

Skipping gives you a **fully ephemeral PAI session** — exactly as if you never set up persistence. The encrypted partition stays closed. Nothing from the partition is mounted, nothing is readable, and no state from previous sessions is exposed.

Good reasons to skip:

- **Using PAI on a shared or borrowed machine.** You booted from someone else's computer — you don't want your models, history, or Wi-Fi to land on their RAM.
- **Maximum-privacy session.** Meeting a sensitive source, reviewing legal discovery, handling leaked material. A clean session is stronger than an unlocked one.
- **Troubleshooting.** A broken `persistence.conf` or a corrupted source directory can hang the boot — skipping takes persistence out of the equation so you can diagnose.
- **Lending your PAI USB to someone.** They boot without the passphrase and get a clean PAI; your data stays encrypted and unreadable.

Persistence is a per-boot decision. You can unlock on one boot and skip on the next without changing any configuration.

## Checking persistence state from a running PAI

Two ways, both reliable:

### The waybar indicator

When persistence is active, the waybar shows **[💾 Persist]**. When ephemeral, there's no badge (or a neutral indicator depending on your waybar config).

The indicator is driven by a single file:

```bash
# When persistence is active
ls -la /run/pai-persistence-active
# -rw-r--r-- 1 root root 0 ...

# When ephemeral
ls /run/pai-persistence-active
# ls: cannot access '/run/pai-persistence-active': No such file or directory
```

### The `pai-persistence status` command

From any terminal:

```bash
pai-persistence status
```

Expected output when active:

```
Persistence: ACTIVE
  /var/lib/ollama: persisted
  /var/lib/open-webui: persisted
  /etc/NetworkManager/system-connections: persisted
```

Expected output when ephemeral but a persistence partition exists:

```
Persistence: OFF (session is ephemeral)
  Note: a persistence partition exists but was not mounted at boot.
  Ensure the kernel cmdline includes: persistence persistence-encryption=luks
```

Expected output when no persistence partition is detected:

```
Persistence: OFF (session is ephemeral)
```

### Which paths are actually bind-mounted?

```bash
# Show all bind-mounts into the live-boot persistence tree
findmnt | grep persistence
```

Expected output with the default layout:

```
/var/lib/ollama                         /run/live/persistence/...[ollama-models]    ext4  rw,relatime,...
/var/lib/open-webui                     /run/live/persistence/...[webui-data]       ext4  rw,relatime,...
/etc/NetworkManager/system-connections  /run/live/persistence/...[wifi-creds]       ext4  rw,relatime,...
```

## Changing your passphrase

Changing the passphrase rewrites only the LUKS header — it does **not** re-encrypt the data, because LUKS uses an intermediate master key. The operation is fast (a few seconds) and safe.


1. **Find the persistence partition's device path.** From a running PAI with persistence unlocked:

    ```bash
    lsblk -o NAME,LABEL,MOUNTPOINT | grep -E 'persistence|MOUNTPOINT'
    ```

    Expected output (example — yours may show `sdb2`, `sdc2`, etc.):

    ```
    NAME    LABEL        MOUNTPOINT
    sdb
    └─sdb2  persistence  /run/live/persistence/luks-...
    ```

    The partition you want is the one whose LABEL is `persistence`.

2. **Run `luksChangeKey`:**

    ```bash
    sudo cryptsetup luksChangeKey /dev/sdb2
    ```

    You'll be prompted:

    ```
    Enter passphrase to be changed:  [type current passphrase]
    Enter new passphrase:            [type new passphrase]
    Verify passphrase:               [retype new passphrase]
    ```

3. **Wait for "Key slot N updated."** The command prints which key slot was rewritten. That's the confirmation the change took.

4. **Next boot, use the new passphrase.** The old passphrase no longer works. There is no cool-off period and no "both accepted for a while" — the change is atomic.


!!! tip

    Change your passphrase on a calm afternoon, not right before a trip. Make the change, shut down, boot back in with the new passphrase while you're still in a situation to recover if you made a typo. Never travel with a just-changed passphrase you haven't boot-tested.


## Adding a second passphrase (multi-slot setup)

LUKS supports **eight key slots**. You can store multiple valid passphrases, any of which unlocks the same partition. Useful patterns:

- **Daily + emergency.** A muscle-memory daily passphrase, plus a long random one stored in a safe.
- **Personal + trusted-party.** A passphrase you control, plus one held by a lawyer, spouse, or executor for duress or incapacitation scenarios.
- **Short-term delegate.** A temporary passphrase for a collaborator, removed when the project ends.

To add a new key slot:

```bash
# Prompted for: any existing valid passphrase, then the new passphrase twice.
sudo cryptsetup luksAddKey /dev/sdb2
```

To list all key slots:

```bash
sudo cryptsetup luksDump /dev/sdb2 | grep -E '^Keyslots:|^  [0-9]:'
```

Expected output:

```
Keyslots:
  0: luks2
  1: luks2
```

Each slot number is an independent passphrase. Slot numbers are assigned in the order slots are created.

To remove a specific passphrase:

```bash
# Prompted for the passphrase you want to remove.
sudo cryptsetup luksRemoveKey /dev/sdb2
```

!!! warning

    You cannot remove the last remaining key slot. LUKS requires at least one active slot — attempting to remove the last one fails with "Slot N is the only active keyslot." This is a safety feature: it prevents you from accidentally locking yourself out.


To remove a slot by number (when you know the slot but not the passphrase that unlocks it):

```bash
# Prompted for any existing passphrase to authorize the deletion.
sudo cryptsetup luksKillSlot /dev/sdb2 1
```

## Editing `persistence.conf` to change what's persisted

The `persistence.conf` file lives at the root of the encrypted partition. From a running PAI with persistence unlocked, the file is accessible at:

```bash
# Find the live-boot persistence mount
ls /run/live/persistence/
# Expected: a single directory named luks-<uuid>

# The conf is at its root
sudo cat /run/live/persistence/luks-*/persistence.conf
```

Editing is a plain-text operation:

```bash
sudo nano /run/live/persistence/luks-*/persistence.conf
```

The format — one line per persisted path:

```
<target-absolute-path>  source=<subdir-relative-to-partition-root>
```

Lines starting with `#` are comments. Blank lines are allowed.

### Common edits

**Enable home-directory persistence:**

```ini
# Change:
#/home/pai                                  source=home

# To:
/home/pai                                   source=home
```

Then create the source directory before rebooting:

```bash
sudo mkdir -p /run/live/persistence/luks-*/home
```

**Add a custom persisted path:**

```ini
# Example: persist a projects dir
/home/pai/projects                          source=projects
```

```bash
sudo mkdir -p /run/live/persistence/luks-*/projects
```

**Remove a persisted path:**

Comment out the line or delete it. The source directory on the partition is _not_ deleted — the data remains on disk until you wipe it manually.

!!! warning

    Changes to `persistence.conf` take effect on the **next reboot**, not immediately. Live-boot reads the config during initramfs. Until you reboot, the live bind-mounts are whatever they were at boot time.


### Forcing writes to disk before reboot

Before you reboot after editing `persistence.conf` (or generally, when you want to be sure a save is on disk), flush writes explicitly:

```bash
# Fsync all persisted paths and print a per-path size report
sudo pai-save
```

Expected output:

```
pai-save: flushing persistence to disk
  PATH                                             USED
  /var/lib/ollama                                  1.4G
  /var/lib/open-webui                             84M
  /etc/NetworkManager/system-connections           12K
```

`pai-save` is also invoked automatically by `pai-save-on-shutdown.service` before the system halts, so a clean `pai-shutdown` always flushes persistence. Running it by hand is useful if you plan to pull the USB without a clean shutdown.

## Why there is no in-session lock command

A question that comes up: "Can I lock persistence without rebooting?" The short answer is **no, and this is deliberate**.

Live-boot's bind-mounts into `/var/lib/ollama`, `/var/lib/open-webui`, and the other persisted paths are held by system services that started during boot. Unmounting them from under Ollama, Open WebUI, and NetworkManager would break those services and leave the filesystem in an inconsistent state. There's no safe way to "lock" the LUKS volume while those services are running against it.

The PAI answer: **if you need to end a persistent session, reboot.**

```bash
pai-shutdown
```

A clean shutdown flushes writes via `pai-save`, stops services in the right order, unmounts the bind-mounts, and closes the LUKS container. Power on again and you either unlock for another persistent session, or skip for a clean one.

!!! tip

    Thinking about threat model: the "lock mid-session" question usually comes from a concern about screen-unlocked exposure. The stronger answer is to lock the **screen** (Sway's lock command) and/or to never step away from an unlocked PAI. Locking the LUKS volume wouldn't help — the data is already decrypted in RAM and in kernel caches until the next reboot.


## Errors at unlock

### "No key available with this passphrase"

The passphrase you typed doesn't match any active key slot. Common causes:

- **Typo.** Try once more, slowly.
- **Keyboard layout mismatch.** Live-boot's initramfs uses a US layout by default. If your passphrase contains non-US characters (e.g., `£`, `é`, `ñ`), try typing as if your keyboard were US. Once PAI is running, consider changing the passphrase to ASCII-only to avoid this class of problem.
- **Caps Lock.** Initramfs has no Caps Lock indicator. Try both on and off.
- **Whitespace.** A trailing space or a non-breaking space (accidentally pasted) is invisible but counts.

After three failures, PAI boots ephemerally. You can try again on the next boot.

### "No key available" (all slots gone)

All eight key slots have been removed. This is only possible via `cryptsetup luksKillSlot` or a corrupted header. Data is unrecoverable without a header backup. See [backing up persistence](backing-up.md) for how header backups prevent this.

### "Device not found" / "No persistence partition detected"

Live-boot didn't see a partition labeled `persistence`. Causes:

- **USB stick not plugged in.** Check the physical port and try a different one.
- **USB stick plugged in after boot started.** Live-boot looks for persistence early in boot; a stick added late isn't detected. Reboot with it already inserted.
- **Partition label was changed.** Run `sudo e2label /dev/sdb2 persistence` to restore it (from a running PAI session).
- **Kernel cmdline doesn't include `persistence persistence-encryption=luks`.** This is set in PAI's GRUB config — if you've customized the bootloader, check it still includes both options.

### "fsck failed"

Live-boot runs `fsck` against the ext4 filesystem automatically after LUKS unlock. If it fails, live-boot refuses to mount. From a running PAI with the partition closed:

```bash
# Open the partition manually
sudo cryptsetup luksOpen /dev/sdb2 persist-rescue

# Run a full fsck
sudo fsck.ext4 -f -y /dev/mapper/persist-rescue

# Close
sudo cryptsetup luksClose persist-rescue
```

If fsck reports unrecoverable damage, restore from backup (see [backing up persistence](backing-up.md)).

### Unlock succeeded but files are missing

The LUKS volume opened, the filesystem mounted, but data you expected is gone. Most common cause: you edited `persistence.conf` and forgot to reboot (live-boot reads it once at boot). A less common cause: the source directory on the partition was deleted manually. Both are recoverable — fix the config, reboot, check `pai-persistence status`.

## Advanced: inspecting the LUKS header

To see the full details of the LUKS container:

```bash
sudo cryptsetup luksDump /dev/sdb2
```

Output includes:

- LUKS version (should be `2`)
- Cipher (`aes-xts-plain64`)
- Key size
- Each active key slot with its KDF (should be `argon2id`), memory cost, and time cost
- The partition UUID

This is the authoritative source of truth for how your persistence is encrypted. Save a copy when you set up (see [backing up persistence](backing-up.md)).

## Frequently asked questions

### Can I unlock persistence from a running PAI session without rebooting?
Not into the live-boot bind-mounts. Live-boot only integrates persistence during initramfs — you can't retroactively mount persisted paths over services that are already running against the RAM versions. You _can_ manually `cryptsetup luksOpen` the partition and mount it somewhere else to read its contents, but it won't be "active persistence" until the next reboot.

### How do I change my passphrase?
Run `sudo cryptsetup luksChangeKey /dev/sdb2` from a PAI session with persistence unlocked. You'll be prompted for the current passphrase once and the new one twice. The change takes effect immediately — the old passphrase stops working right away, and the new one works at the next boot.

### Can I add a backup passphrase in case I forget the main one?
Yes. Run `sudo cryptsetup luksAddKey /dev/sdb2`. LUKS supports up to eight independent passphrases. Store the backup passphrase somewhere physically separate from your usual passphrase storage (different room, different building, a safe deposit, a trusted friend).

### What if I forget my passphrase?
The data is unrecoverable without the passphrase or a header backup that contains a slot you still remember. LUKS is designed so that even the developers cannot help you — there is no master key, no recovery service, and no reset. This is the property that makes LUKS safe against coercion; it's also what makes it unforgiving. Back up.

### Does the unlock prompt appear in the graphical interface?
No. The prompt appears in the initramfs text console, before any graphics are loaded. This is normal for LUKS unlocks — the kernel doesn't have graphics drivers that early in boot. You'll see a plain text line and type blind.

### What happens if I pull the USB while PAI is running?
Writes in flight may be lost and the filesystem may be left inconsistent. `fsck` will usually recover it on the next boot, but you risk corrupting Ollama's model cache or Open WebUI's SQLite database. Always `pai-shutdown` before removing the USB. If you've pulled it by accident and the next boot's unlock fails with an fsck error, see the "fsck failed" section above.

### Can I unlock persistence on a different PAI USB (different boot stick)?
Yes. The persistence partition is independent of the boot USB. Plug both into a different PAI boot USB (same or newer PAI version), and the unlock flow is identical. This is how you upgrade PAI without losing your persisted state: reflash the boot USB, keep the persistence USB, reboot.

### Is there a way to lock the LUKS volume mid-session?
Not safely. Live-boot's bind-mounts are held by active services; unmounting them breaks those services. The correct way to "lock" is to `pai-shutdown` — a clean shutdown flushes writes, stops services, unmounts, and closes the LUKS container. The next boot either unlocks or skips; there's no middle state by design.

### How can I see exactly which paths are currently persisted?
Run `pai-persistence status` for a human-readable summary, or `pai-save --list` for the raw list, or `findmnt | grep persistence` for the full mount table. All three read from the effective `persistence.conf` that live-boot applied during this boot.

### Can I rename a persisted path on the fly?
Not without a reboot. `persistence.conf` is read once at boot. To rename, edit the config, reboot, and the new mapping takes effect. Moving the underlying data on the partition itself is a separate matter — if you rename the source directory in `persistence.conf` but not on disk, the next boot creates an empty directory under the new name instead of finding your old data.

### What if two USBs labeled `persistence` are plugged in?
Live-boot uses the first one it finds. The second is ignored. For a two-stick setup (e.g., "work" and "personal" persistence volumes), plug in only the one you want at boot time.

## Related documentation

- [**Persistence introduction**](introduction.md) — How persistence works
  and when to use it
- [**Creating persistence**](creating-persistence.md) — Initial setup with
  the `pai-persistence-setup` wizard
- [**Backing up persistence**](backing-up.md) — Protecting against USB loss
  and header corruption
- [**Shutting down**](../first-steps/shutting-down.md) — Clean shutdown with
  `pai-shutdown` and why it matters for persistence
- [**Troubleshooting**](../advanced/troubleshooting.md) — Boot and unlock
  issues that aren't persistence-specific
- [**Introduction to PAI privacy**](../privacy/introduction-to-privacy.md) —
  How persistence fits into the PAI threat model
