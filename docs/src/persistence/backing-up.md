---
title: "Backing Up PAI Persistence — rsync, LUKS Headers, and Disaster Recovery"
description: "A complete backup strategy for PAI's encrypted persistence: file-level rsync backups, full partition images, LUKS header backups, cadence, testing, and restoring after disaster."
sidebar:
  label: "Backing up"
  order: 4
tableOfContents:
  minHeadingLevel: 2
  maxHeadingLevel: 3
head:
  - tag: meta
    attrs:
      property: "og:description"
      content: "A complete backup strategy for PAI's encrypted persistence: file-level rsync backups, full partition images, LUKS header backups, cadence, testing, and restoring after disaster."
  - tag: meta
    attrs:
      name: "keywords"
      content: "back up PAI persistence, LUKS backup, rsync encrypted USB, cryptsetup luksHeaderBackup, restore LUKS partition, PAI disaster recovery, 3-2-1 backup rule"
---


**Persistence lives on a single USB stick. USB sticks fail, get stolen, get washed with laundry, get bent in a pocket. Without a backup, a bad day turns into a permanent loss of every Ollama model you've pulled, every Open WebUI conversation, every saved Wi-Fi network, and every passphrase you stored in KeePassXC. This guide covers three layers of backup — LUKS header, file-level content, and full partition image — with cadence, storage, and restore procedures for each.** Back up or accept the risk. There is no middle ground with encrypted data.

In this guide:
- Why persistence backups matter more than regular file backups
- The three backup layers: LUKS header, file-level rsync, full partition image
- How to set up an encrypted backup USB (one-time)
- Routine file-level backups with `rsync` and a ready-to-use script
- Full partition imaging with `dd` for bit-exact snapshots
- LUKS header backups — five seconds of work that prevents the worst outcomes
- Cadence, storage, and the 3-2-1 rule applied to PAI
- Testing that the backup actually restores
- Full restore procedures after a lost or corrupted persistence stick

**Prerequisites**: A working PAI persistence setup per [creating persistence](creating-persistence.md). A second encrypted USB stick (or external drive) for backups. Comfortable with `sudo` and basic shell commands. For the "offsite" parts, a trusted external location or cloud storage account.

## Why persistence backups matter

Regular backup advice applies to PAI — but the stakes are different in two ways.

First, **encryption is unforgiving**. A backup of a regular filesystem is a backup of files you can read. A backup of a LUKS partition is a backup of an opaque blob that is worthless without the passphrase _and_ without the LUKS header that stores the key slots. Lose either, and the backup is as dead as the original.

Second, **PAI is a single-USB design**. A conventional laptop has its data spread across the main drive, cloud sync, recent work in `/tmp`, maybe a second drive. One failure rarely kills everything. PAI concentrates state onto one stick. One failure kills all of it.

!!! danger

    A LUKS volume with a corrupted header is unrecoverable. A LUKS volume with a known passphrase but an intact header is recoverable in five seconds. Back up the header. See the [LUKS header backup](#layer-1-luks-header-backup) section below — it takes seconds, the file is 16 MB, and it's the single highest-leverage backup you can make.


## The three layers of backup

| Layer | What it protects | Size | Speed | Frequency |
|---|---|---|---|---|
| LUKS header backup | Loss of key slots, header corruption | ~16 MB | Seconds | Once at setup + after every passphrase change |
| File-level rsync backup | Daily work, selective restore | Size of data | Minutes | Daily or weekly |
| Full partition image | Bit-exact recovery, worst-case restore | Size of partition | 10+ minutes | Monthly or before risky changes |

You want all three eventually. Start with the header backup today — it's too small and too important to skip.

## Layer 1: LUKS header backup

The LUKS header is a small region at the start of the partition that stores the cipher parameters, the KDF parameters, and the eight key slots. Without it, the encrypted data is permanently unreadable even if you know the passphrase. With it, you can recover from an accidental `luksKillSlot`, a failed `luksChangeKey`, or physical damage to the header region.

### Back up the header

From a running PAI with persistence unlocked (or at least detected):

```bash
# Identify the persistence partition
lsblk -o NAME,LABEL | grep persistence

# Back up the header to a file (replace /dev/sdb2 with your partition)
sudo cryptsetup luksHeaderBackup /dev/sdb2 \
    --header-backup-file ~/luks-header-backup.img
```

The output file is typically 16 MB — small enough to attach to an encrypted email, stash in a password manager, or keep on a different USB. The header contains the key slots but **not** the passphrases themselves and **not** any file data.

!!! warning

    A LUKS header backup lets you restore key slots and reset passphrases if the on-disk header is corrupted. Anyone with the header file _and_ a passphrase can unlock the partition. Treat the header file as sensitive — do not leave it unprotected, and be especially careful if you've ever used a weak passphrase that might be guessable.


### Restore a corrupted header

If the LUKS header is damaged (rare, but possible from a failing USB controller or an interrupted `cryptsetup` operation):

```bash
sudo cryptsetup luksHeaderRestore /dev/sdb2 \
    --header-backup-file /path/to/luks-header-backup.img
```

After restore, your original passphrases work again. Data on the partition is untouched — only the header was rewritten.

### When to refresh the header backup

Refresh the header backup after any of these:

- `cryptsetup luksChangeKey` (you changed a passphrase)
- `cryptsetup luksAddKey` (you added a backup passphrase)
- `cryptsetup luksRemoveKey` or `luksKillSlot` (you removed a passphrase)
- Any other operation that modifies key slots

Without a refresh, the backup header has stale key slots — restoring it would revert your slot changes.

## Layer 2: file-level backups with rsync

File-level backups are the workhorse. They are fast after the first run (rsync only copies changes), support partial restore (you can grab one file), and compress well because most of your data is already compact.

The target is an **encrypted** backup USB — a second USB stick formatted with its own LUKS container. This keeps the backup as private as the original.

### One-time setup: encrypted backup USB

Plug in the intended backup USB (a separate physical stick, not the PAI persistence stick). Identify it carefully:

```bash
# List block devices — confirm the backup USB's device path
lsblk
```

!!! danger

    The next commands **erase everything** on the target device. Verify the device path three times before running them. `/dev/sdc` is usually not the PAI boot USB or the persistence USB, but hardware ordering can change — check every time.


Format the backup USB as a LUKS container:

```bash
# Replace /dev/sdc with YOUR backup device path (verified via lsblk)
BACKUP_DEV=/dev/sdc

# 1. Create a LUKS2 container (different passphrase from persistence — optional
#    but recommended for compromise isolation)
sudo cryptsetup luksFormat --type luks2 --pbkdf argon2id "$BACKUP_DEV"

# 2. Open it
sudo cryptsetup luksOpen "$BACKUP_DEV" pai-backup

# 3. Create the filesystem inside
sudo mkfs.ext4 -L pai-backup /dev/mapper/pai-backup

# 4. Mount it
sudo mkdir -p /mnt/backup
sudo mount /dev/mapper/pai-backup /mnt/backup
```

Your backup USB is ready. It will stay closed when not in use and only opens when you mount it for a backup or restore.

### Routine backup

Each time you want to back up the current state of persistence:

```bash
# Open and mount the backup USB
sudo cryptsetup luksOpen /dev/sdc pai-backup
sudo mount /dev/mapper/pai-backup /mnt/backup

# Copy persisted data to the backup — --delete keeps the backup in sync
# with the source (deletes from the backup things that were removed from the source)
sudo rsync -aAHXv --delete \
    /run/live/persistence/luks-*/ \
    /mnt/backup/persistence/

# Also copy the LUKS header backup (refreshed if needed)
sudo cryptsetup luksHeaderBackup /dev/sdb2 \
    --header-backup-file /mnt/backup/luks-header-backup.img

# Unmount and close
sudo umount /mnt/backup
sudo cryptsetup luksClose pai-backup
```

Expected timing:

- **First run**: minutes to hours depending on data size (Ollama models dominate).
- **Subsequent runs**: seconds to minutes because rsync only copies changes.

### A ready-to-use backup script

Save this as `~/bin/pai-backup.sh` (in your persisted home directory, or on the backup USB itself):

```bash
#!/usr/bin/env bash
# pai-backup.sh — rsync PAI persistence to an encrypted backup USB
# Usage: sudo pai-backup.sh /dev/sdc   (where /dev/sdc is the backup USB)

set -euo pipefail

BACKUP_DEV="${1:-}"
[[ -b "$BACKUP_DEV" ]] || { echo "Usage: $0 /dev/sdX"; exit 1; }

[[ -f /run/pai-persistence-active ]] \
    || { echo "Persistence is not active — nothing to back up."; exit 1; }

MAPPER=pai-backup
MOUNT=/mnt/backup
SRC=$(ls -d /run/live/persistence/luks-*/ | head -1)
PERSIST_PART=$(findmnt -n -o SOURCE "$SRC" | sed 's|^/dev/mapper/||')
PERSIST_PART=$(lsblk -nrpo NAME,LABEL \
    | awk '$2=="persistence"{print $1; exit}')

trap 'umount "$MOUNT" 2>/dev/null || true
      cryptsetup close "$MAPPER" 2>/dev/null || true' EXIT

echo "→ Opening backup USB $BACKUP_DEV"
cryptsetup open "$BACKUP_DEV" "$MAPPER"
mkdir -p "$MOUNT"
mount "/dev/mapper/$MAPPER" "$MOUNT"

echo "→ Flushing persistence writes to disk"
pai-save

echo "→ rsyncing persistence contents"
rsync -aAHX --delete --info=progress2 "$SRC" "$MOUNT/persistence/"

echo "→ Refreshing LUKS header backup"
cryptsetup luksHeaderBackup "$PERSIST_PART" \
    --header-backup-file "$MOUNT/luks-header-backup.img"

echo "→ Syncing writes"
sync

echo "✓ Backup complete"
```

Make it executable:

```bash
chmod +x ~/bin/pai-backup.sh
```

Run it whenever you want a backup:

```bash
sudo ~/bin/pai-backup.sh /dev/sdc
```

## Layer 3: full partition image

A bit-exact image of the LUKS partition. Larger and slower than a file backup, but useful for two cases:

1. **Forensic-grade snapshot** — reproduce the partition byte-for-byte at restore time.
2. **Belt-and-suspenders** — a complete fallback when the file-level backup gets corrupted.

```bash
# Persistence partition MUST be closed (not open) for a consistent image
sudo cryptsetup close persistence || true   # OK if not open

# Identify the partition
lsblk -o NAME,LABEL | grep persistence
# Suppose it's /dev/sdb2

# Image to a file on the backup USB
sudo cryptsetup luksOpen /dev/sdc pai-backup
sudo mount /dev/mapper/pai-backup /mnt/backup
sudo dd if=/dev/sdb2 of=/mnt/backup/persistence-full.img \
    bs=4M status=progress conv=sync,noerror
sudo sync
sudo umount /mnt/backup
sudo cryptsetup luksClose pai-backup
```

Restore by writing the image back to the target partition:

```bash
sudo dd if=/mnt/backup/persistence-full.img of=/dev/sdb2 \
    bs=4M status=progress conv=sync,noerror
sudo sync
```

!!! warning

    `dd` is unforgiving. `if=` and `of=` reversed will overwrite your backup with garbage. Always verify the command with your eyes before pressing Enter. Consider using `conv=fsync` for extra safety, and always run a test restore on a scratch partition before trusting the backup.


## How often to back up

Back up on a schedule AND on triggers:

**Schedule**:
- **Daily** if you use PAI as a daily driver — models, chat history, and documents accumulate fast.
- **Weekly** if you use PAI occasionally — enough to catch a bad USB before it dies.
- **After every important session** — a long research session, a document draft, a new model pulled.

**Triggers** (back up before each):
- Changing the persistence passphrase
- Adding or removing key slots
- Editing `persistence.conf` in non-trivial ways
- Upgrading to a new PAI version (reflashing the boot USB)
- Travel with the PAI USB (theft risk)

Set a calendar reminder. Untested backups are theory; unscheduled backups are good intentions.

## The 3-2-1 rule, applied to PAI

The classic backup rule:

> **3** copies of your data, **2** different types of media, **1** off-site.

How this maps to PAI:

```
Copy 1: your active persistence USB  (the original)
Copy 2: an encrypted backup USB in a drawer  (2nd medium or 2nd stick)
Copy 3: encrypted cloud backup OR backup at a trusted 2nd location  (off-site)
```

The backup is already LUKS-encrypted, so cloud storage is viable: even if the provider is compromised or subpoenaed, they get ciphertext. Services like rsync.net, Backblaze B2, or a friend's NAS work equally well — what matters is that the off-site copy is in a different physical place than the other two.

!!! tip

    For the off-site copy, consider one of these patterns that doesn't require trusting a cloud provider:
    - A second encrypted USB kept at a family member's house, refreshed on visits
    - A safe deposit box containing an encrypted USB and a sealed envelope with the LUKS header
    - A trusted attorney with a chain-of-custody agreement for the off-site stick


## Testing your backup (the part everyone skips)

A backup you have never restored is not a backup. It is a hope.

Test the restore path at least once, on a scratch USB, before you need it for real:


1. **Plug in a scratch USB** (any old stick you don't care about, at least as big as the persistence partition).

2. **Partition and restore the image:**

    ```bash
    # Suppose the scratch stick is /dev/sdz
    sudo dd if=/mnt/backup/persistence-full.img of=/dev/sdz2 \
        bs=4M status=progress
    ```

    (You may need to create a partition on the scratch USB first with `parted`.)

3. **Attempt to open the restored LUKS container with your backup passphrase:**

    ```bash
    sudo cryptsetup luksOpen /dev/sdz2 test-restore
    sudo mkdir /mnt/test
    sudo mount /dev/mapper/test-restore /mnt/test
    ls /mnt/test
    ```

    You should see the source subdirectories (`ollama-models`, `webui-data`, etc.).

4. **Verify a specific file is readable:**

    ```bash
    sudo ls /mnt/test/ollama-models/
    sudo head /mnt/test/webui-data/config.json
    ```

5. **Clean up:**

    ```bash
    sudo umount /mnt/test
    sudo cryptsetup luksClose test-restore
    ```


If any of these steps fails, the backup is broken — find out now, not when your primary USB dies.

## Restoring after a disaster

You've lost your persistence USB (or it's physically broken). You have a backup. Here's the restore path.


1. **Get a replacement USB stick.** Same size or larger than the one you lost.

2. **Boot PAI** from your PAI boot USB (unrelated to the persistence USB — the boot USB is unaffected by a persistence loss).

3. **Run the setup wizard** to create a new persistence partition on the replacement USB:

    ```bash
    pai-persistence setup
    ```

    Use **the same passphrase** you used on the lost USB — this makes the restore painless.

4. **Don't reboot yet.** The new partition is formatted but empty. Continue to restore the contents.

5. **Open the replacement partition and the backup USB simultaneously:**

    ```bash
    # Open the fresh replacement (suppose /dev/sdb2 — check with lsblk)
    sudo cryptsetup luksOpen /dev/sdb2 persist-restore
    sudo mkdir -p /mnt/persist-restore
    sudo mount /dev/mapper/persist-restore /mnt/persist-restore

    # Open the backup USB
    sudo cryptsetup luksOpen /dev/sdc pai-backup
    sudo mount /dev/mapper/pai-backup /mnt/backup
    ```

6. **Rsync the backup contents into the replacement:**

    ```bash
    sudo rsync -aAHXv --delete \
        /mnt/backup/persistence/ \
        /mnt/persist-restore/
    sync
    ```

7. **Clean up:**

    ```bash
    sudo umount /mnt/persist-restore
    sudo umount /mnt/backup
    sudo cryptsetup luksClose persist-restore
    sudo cryptsetup luksClose pai-backup
    ```

8. **Reboot and unlock.** At the boot prompt, enter your passphrase. Everything should be back: Ollama models, chat history, saved Wi-Fi.


!!! note

    If you used a different passphrase on the new partition (because you intentionally wanted a fresh one), the restore still works — the data is copied in plaintext by rsync, not by the LUKS container. Only the passphrase you use at boot changes.


## Tutorial: your first persistence backup

**Goal**: Create an encrypted backup USB, back up your current persistence, and verify the backup is readable.

**What you need**:
- A running PAI with persistence unlocked
- A second USB stick (spare — its contents will be erased)
- 10–20 minutes


1. **Plug in the spare USB.** Identify its device path:

    ```bash
    lsblk
    ```

    Look for a new entry (e.g., `sdc`). Confirm it's the right one — it should NOT be labeled `persistence` and should NOT be the PAI boot USB.

2. **Format it as a LUKS container:**

    ```bash
    BACKUP_DEV=/dev/sdc   # replace with YOUR device
    sudo cryptsetup luksFormat --type luks2 --pbkdf argon2id "$BACKUP_DEV"
    sudo cryptsetup luksOpen "$BACKUP_DEV" pai-backup
    sudo mkfs.ext4 -L pai-backup /dev/mapper/pai-backup
    sudo mkdir -p /mnt/backup
    sudo mount /dev/mapper/pai-backup /mnt/backup
    ```

3. **Flush persistence writes:**

    ```bash
    sudo pai-save
    ```

4. **Back up the LUKS header:**

    ```bash
    # Identify the persistence partition
    PERSIST=$(lsblk -nrpo NAME,LABEL | awk '$2=="persistence"{print $1}')
    sudo cryptsetup luksHeaderBackup "$PERSIST" \
        --header-backup-file /mnt/backup/luks-header-backup.img
    ```

5. **Rsync the contents:**

    ```bash
    SRC=$(ls -d /run/live/persistence/luks-*/ | head -1)
    sudo rsync -aAHX --info=progress2 "$SRC" /mnt/backup/persistence/
    ```

6. **Verify:**

    ```bash
    sudo du -sh /mnt/backup/persistence/
    sudo ls /mnt/backup/persistence/
    sudo ls -lh /mnt/backup/luks-header-backup.img
    ```

7. **Close cleanly:**

    ```bash
    sudo umount /mnt/backup
    sudo cryptsetup luksClose pai-backup
    ```


**What just happened?** You created a LUKS-encrypted backup USB, flushed in-flight writes from persistence to disk, saved the LUKS header (insurance against header corruption), and copied the live persistence contents file-by-file into the backup. The backup is encrypted end-to-end: it's safe to leave in a drawer, mail to another location, or upload as-is to cloud storage.

**Next**: schedule a repeat. A backup you run once is a test. A backup you run weekly is protection.

## Common mistakes

- **Unencrypted backups.** A plaintext rsync of persistence defeats the whole point. Always back up into a LUKS container or to an already-encrypted medium.
- **No header backup.** File data is useless if the LUKS header dies. Back up the header; it's 16 MB.
- **One backup drive.** When it dies (and it will), you have nothing. Two drives in different physical locations.
- **Never testing.** The single most common backup failure is "we had backups but they didn't restore." Test.
- **Backing up while editing.** Open databases (KeePassXC with the DB open, Open WebUI mid-write) can land mid-transaction in the backup. Close apps that write frequently before you back up, or accept the minor risk — `rsync` is usually good enough for most file types.
- **Confusing header backups with password backups.** A header backup doesn't store passphrases. Losing your passphrase is separate from losing your header. Both need to be managed.

## Cross-platform access to PAI backups

The backup format is standard Linux — LUKS + ext4:

=== "From another PAI"
Plug in the backup USB, `sudo cryptsetup luksOpen /dev/sdX pai-backup`, mount, read or restore. Identical to any PAI-internal operation.
=== "From another Linux"
Any modern Linux has `cryptsetup` and ext4 support. `sudo cryptsetup luksOpen /dev/sdX pai-backup; sudo mount /dev/mapper/pai-backup /mnt`. Debian, Ubuntu, Fedora, Arch — all work without extra packages.
=== "From macOS"
Native macOS cannot read LUKS or ext4. The realistic options are: (1) run a Linux VM (UTM, Parallels, VMware Fusion) and pass the USB through, (2) use VeraCrypt as the backup format instead (cross-platform but a different tool), or (3) boot PAI from a second USB on the Mac and use it to read the backup.
=== "From Windows"
No native support for LUKS or ext4. Use a Linux VM (WSL2 doesn't expose raw USB by default — use VirtualBox or VMware with USB passthrough), or boot PAI from a second USB, or keep an ext4-compatible tool like `Linux File Systems for Windows` for the ext4 layer and cryptsetup in WSL for the LUKS layer (complex; the VM approach is simpler).

!!! tip

    To help your future self, write a plaintext INDEX.txt file inside the encrypted backup listing what's in each directory. When you come back to a six-month-old backup, the index reminds you what you saved and why.


## Frequently asked questions

### Do I need to back up while persistence is locked, or can I back up while it's unlocked?
Either works, but they back up different things. Unlocked (running PAI with persistence active): use `rsync` on `/run/live/persistence/luks-*/` for a file-level backup. Locked (from another machine or a fresh ephemeral PAI): use `dd` on the partition for a full image. File-level is more useful day to day; image backup is useful for a forensic snapshot.

### How often should I back up?
Daily if PAI is your daily driver. Weekly for occasional use. Always before risky operations like passphrase changes, boot-USB upgrades, or travel.

### What's the single most important backup step?
Back up the LUKS header. It's 16 MB, takes seconds, and is the difference between "my key slots got corrupted but I recovered" and "everything is gone." Run `sudo cryptsetup luksHeaderBackup /dev/sdb2 --header-backup-file ~/luks-header-backup.img` now.

### Is it safe to store a backup in cloud storage?
Yes, if the backup is already LUKS-encrypted. You're uploading ciphertext; the provider cannot read it. This is true as long as you didn't also upload the passphrase. Don't upload the passphrase.

### Can I back up to a network drive instead of a USB?
Yes. `rsync` over SSH to a network target works identically — replace the local mount path with `user@host:/path`. The remote target should be encrypted (LUKS, ZFS with encryption, or the filesystem-level equivalent on the network OS). An unencrypted network drive is not a safe target for PAI backups.

### My persistence USB and backup USB use the same passphrase. Is that OK?
Functional but not ideal. If someone compromises your passphrase, both are exposed. Use different passphrases when you can — the backup USB isn't boot-critical, so you can use a random-generated passphrase stored only in your password manager.

### How do I know if my backup is corrupted?
Test it. Mount the backup, read files, verify a sample restores cleanly (run a small Ollama model from the backup's `ollama-models` directory on a scratch PAI session). Corruption that's too subtle to notice by eye will still surface when you try to use the data.

### What if I forget my backup USB's passphrase?
Same problem as forgetting the persistence passphrase: the data is unrecoverable. This is why some people keep a separate password manager entry specifically for backup USB passphrases, and why the backup USB's passphrase can reasonably be longer and more complex than the persistence one (you type it less often).

### Can I back up incrementally so only changes are transferred?
Yes — `rsync` is incremental by default. The first backup is slow because it transfers everything. Subsequent backups only transfer changed files. For very large Ollama models, set `rsync`'s `--inplace` flag if you want to modify in place instead of rewriting the whole file on change.

### Does the backup include my persistence passphrase?
No. The passphrase is never stored on disk — even on the live partition. Only the key slots (derived from the passphrase via argon2id) are stored. The backup contains those key slots but not the passphrase itself. If you lose the passphrase, the backup is as unrecoverable as the original.

### Should I keep multiple generations of backups?
Yes, for extra safety. A simple scheme: daily rotating to the same backup USB (one copy), plus a monthly snapshot to a different stick (kept off-site). A more paranoid scheme: daily rsync snapshots using `rsync --link-dest` to deduplicate between generations.

### How do I securely destroy an old backup when I'm done with it?
The LUKS container makes this easier than for plaintext backups: `sudo cryptsetup erase /dev/sdX` wipes the key slots, rendering the ciphertext unreadable in seconds. After that, a physical destruction pass (break the USB stick, burn it, shred it) is optional but recommended for highly sensitive data. See [secure delete](../apps/secure-delete.md) for the general approach.

## Related documentation

- [**Persistence introduction**](introduction.md) — What persistence is and
  why it lives on a single USB
- [**Creating persistence**](creating-persistence.md) — Initial setup (this
  guide assumes you've done that)
- [**Unlocking persistence**](unlocking.md) — Managing passphrases and key
  slots — note every change means a fresh header backup
- [**Secure delete**](../apps/secure-delete.md) — Disposing of old backup
  drives safely
- [**Encrypting files with GPG**](../apps/encrypting-files-gpg.md) — A
  complementary per-file encryption layer for especially sensitive items
- [**Warnings and limitations**](../general/warnings-and-limitations.md) —
  The threat models PAI does and doesn't defend against
