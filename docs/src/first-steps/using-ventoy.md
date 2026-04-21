---
title: "How to boot PAI from a Ventoy USB drive (no wipe, multiple ISOs)"
description: "Use Ventoy to boot PAI from a USB drive without wiping it. Keep multiple ISOs on one stick, upgrade PAI by dragging the new ISO, and preserve other files on the drive."
sidebar:
  label: "Using Ventoy"
  order: 3
head:
  - tag: meta
    attrs:
      property: "og:description"
      content: "Boot PAI from a Ventoy USB without wiping it. Keep multiple ISOs on one stick and upgrade by dragging the new file."
  - tag: meta
    attrs:
      name: "keywords"
      content: "Ventoy PAI, PAI multiboot USB, Ventoy offline AI, Ventoy ISO boot, PAI upgrade USB"
---


[Ventoy](https://www.ventoy.net) turns a USB drive into a multi-boot menu. Instead of flashing PAI onto the whole stick (which wipes the drive), you install Ventoy once, then drop `pai-<version>-amd64.iso` onto the drive like a regular file. Boot from the USB and Ventoy shows a menu listing every ISO on the drive.

This is the best option if you want to:

- Keep files already on the USB (documents, music, other ISOs).
- Upgrade PAI by dragging the new ISO on top of the old one — no re-flashing.
- Carry PAI, a Linux installer, a rescue tool, and a Windows installer on one stick.

## How Ventoy differs from flashing

| | Flash (`flash.ps1` / `dd` / graphical Rufus alternative) | Ventoy |
|---|---|---|
| USB gets wiped | Yes, every time | Once, during Ventoy install |
| Replacing the ISO | Re-flash the whole drive | Drag-and-drop the new `.iso` |
| Multiple ISOs | One per drive | Unlimited (up to drive size) |
| Other files on the drive | Erased | Preserved in the exFAT data partition |
| Verified boot integrity | Direct — the drive is the ISO | Indirect — Ventoy chain-loads the ISO |
| Secure Boot support | Requires signed shims | Built-in since Ventoy 1.0.76 — one-time MokManager enrollment on first boot |

!!! note

    Ventoy is extra software running between your firmware and PAI. The ISO itself isn't modified — PAI boots identically to how it would from a flashed drive — but the Ventoy bootloader is on the drive. For maximum-assurance deployments (threat model: "attacker has physical access to the USB"), flash directly instead.


## Install Ventoy on your USB drive

=== "Windows"
    1. Download Ventoy for Windows from [ventoy.net/en/download.html](https://www.ventoy.net/en/download.html). Extract the ZIP.
    2. Plug in your USB drive (16 GB or larger recommended; 8 GB minimum).
    3. Run `Ventoy2Disk.exe` as Administrator.
    4. Pick your USB drive from the **Device** dropdown. Double-check the drive letter and size — this step erases the drive.
    5. Click **Install**. Confirm both warnings. Installation takes about 30 seconds.
    6. After installation, File Explorer shows a drive labeled **Ventoy** with about 1 MB used.
=== "Linux"
    1. Download the Linux tarball from [ventoy.net/en/download.html](https://www.ventoy.net/en/download.html). Extract it:

       ```bash
       tar -xf ventoy-*.tar.gz
       cd ventoy-*
       ```

    2. Find your USB device:

       ```bash
       lsblk -d -o NAME,SIZE,MODEL,TRAN | grep usb
       ```

    3. Install (replace `sdX` with your actual device — NOT a partition like `sdX1`):

       ```bash
       sudo ./Ventoy2Disk.sh -i /dev/sdX
       ```

       Expected output ends with `Install Ventoy to /dev/sdX successfully`.

    4. Eject and re-plug the drive so the kernel re-reads the partition table.
=== "macOS"
    Ventoy does not ship a native macOS installer. Two workarounds:

    - **Run Ventoy from a Linux VM or live USB** — install Ventoy onto your target drive from a separate Linux session. UTM + a small Linux VM works well; see [Starting PAI on a Mac](starting-on-mac.md) for UTM setup.
    - **Flash PAI directly instead** — if Ventoy is too awkward on macOS, follow the [dd flashing instructions](installing-and-booting.md#how-to-flash-the-pai-iso-to-a-usb-drive) for macOS.

    We'll update this guide if a native Ventoy macOS build ships.

## Copy the PAI ISO to the Ventoy drive

1. Download `pai-<version>-amd64.iso` from the [releases page](https://github.com/nirholas/pai/releases).

2. Verify its SHA256 against `SHA256SUMS` (see [Installing and booting → Verify the SHA256](installing-and-booting.md#how-to-verify-the-sha256-checksum)).

3. Open the Ventoy drive in your file manager. You'll see a single partition labeled **Ventoy**, nearly empty.

4. Drag `pai-<version>-amd64.iso` onto the drive. Copying takes 1–3 minutes on USB 3.0, longer on USB 2.0.

5. (Optional) Add more ISOs to the same drive — e.g., Debian installer, SystemRescue, Tails. They'll all appear in the Ventoy boot menu.

6. Eject the drive safely when the copy completes.

!!! tip

    You can organize ISOs into folders — Ventoy scans subdirectories automatically. `PAI/`, `Rescue/`, `Installers/` all work.


## Boot PAI via Ventoy

1. Plug the Ventoy drive into the target machine.
2. Power on and tap the boot menu key (see the [vendor key table](installing-and-booting.md#boot-menu-and-bios-keys-by-vendor)).
3. Select the Ventoy USB. Ventoy's own boot menu appears — a list of every ISO on the drive.
4. Use arrow keys to select `pai-<version>-amd64.iso`. Press **Enter**.
5. Choose **Boot in normal mode** at the Ventoy sub-menu (the default).
6. PAI's GRUB menu loads. From here, boot is identical to a directly flashed drive.

## Upgrade PAI without re-flashing

This is Ventoy's best feature. When a new PAI release lands:

1. Download the new `pai-<new-version>-amd64.iso`.
2. Verify its SHA256.
3. Drag it onto the Ventoy drive.
4. (Optional) Delete the old ISO to save space, or keep it for rollback.
5. Boot the Ventoy drive. The new ISO shows up in the menu.

No re-flashing, no wiped drives, no lost persistence partitions.

## Using PAI persistence with Ventoy

!!! warning "Planned for PAI v0.2"

    Persistence is not yet available in PAI v0.1.0 — see [Creating persistence](../persistence/creating-persistence.md). The options below describe how the Ventoy workflow will work once persistence ships.


PAI's encrypted [persistence layer](../persistence/creating-persistence.md) stores your data on a LUKS-encrypted ext4 partition labeled `persistence` — the label Debian live-build looks for. With a directly flashed drive, PAI creates this partition on the same USB stick. With Ventoy, you have two choices:

### Option 1 — Persistence on a second USB drive

Plug two drives into the target machine: the Ventoy drive (for booting) and a second drive containing the persistence partition. PAI detects the persistence partition by label, not by drive, so this works without configuration.

Pros: full flexibility, Ventoy drive stays general-purpose. Cons: two drives to keep track of.

### Option 2 — Persistence on the Ventoy drive's data partition

Ventoy leaves most of the drive as exFAT for ISO storage. You can shrink the exFAT partition and create a third partition labeled `persistence` using any partitioning tool (GParted, `parted`, Disk Management). PAI's setup will put LUKS on top and format it ext4.

Pros: one drive. Cons: Ventoy may complain if its layout changes; re-installing Ventoy erases the partition.

Persistence setup instructions live in [Creating persistence](../persistence/creating-persistence.md).

## Troubleshooting

### Ventoy menu appears but PAI doesn't boot
- Try **Boot in grub2 mode** from Ventoy's sub-menu instead of normal mode. Some firmware prefers it.
- Confirm the ISO's SHA256 matches — a corrupted copy will fail mid-boot.
- If you see `error: file '/live/vmlinuz' not found`, the copy is corrupt. Delete the ISO from the drive and re-copy.

### Ventoy menu doesn't appear at all
- Secure Boot: Ventoy supports SB since 1.0.76, but some firmware rejects the MokManager enrollment screen. Disable Secure Boot in BIOS as a workaround on those machines.
- Fast Boot: disable in BIOS. Many firmwares skip USB enumeration with Fast Boot on.
- The Ventoy install may have silently failed. Re-install Ventoy and confirm the drive is partitioned as expected (`lsblk` on Linux should show two partitions: a small VTOYEFI and the large exFAT data partition).

### "Verification failed" inside PAI's GRUB
PAI doesn't currently sign its GRUB config. This message is usually from Ventoy's Secure Boot verification layer. Either disable Secure Boot or use Ventoy's "Skip SB verification" option in its sub-menu.

### Persistence partition not detected
Confirm the partition label is exactly `persistence` (case-sensitive — Debian live-build's hardcoded label). On Linux, after unlocking LUKS: `sudo e2label /dev/mapper/<name> persistence`. If the partition isn't LUKS-encrypted yet, label it before `pai-persistence-setup` runs, or just let the setup script create it from scratch.

## Frequently asked questions

### Is Ventoy safe to use with PAI?
Yes. Ventoy is open-source (GPLv3) and widely audited. It doesn't modify the ISO — it chain-loads it using a small shim bootloader. The PAI system that boots is byte-identical to a directly flashed boot.

### Does Ventoy slow down PAI?
Boot adds ~2 seconds for Ventoy's menu. Once PAI starts, performance is identical to a flashed drive.

### Can I use Ventoy with the arm64 PAI image?
Ventoy has experimental arm64 support but we haven't qualified it end-to-end. For Raspberry Pi, use [Raspberry Pi Imager](using-raspberry-pi-imager.md) instead.

### Does Ventoy affect PAI's privacy model?
No. Once PAI boots, nothing on the USB is written to unless you explicitly set up persistence. Ventoy's presence doesn't introduce network calls, telemetry, or any state that leaks from PAI back to the host.

### Can Ventoy boot the PAI ISO from an internal hard drive?
Yes. Ventoy installs on any block device, including internal SSDs. The setup is identical — the limitation is that you have to pick the Ventoy drive at every boot, which the firmware may or may not make easy.

### What Ventoy version do I need?
Any recent release works. Secure Boot has been built in since Ventoy 1.0.76, and the 1.1.x series is the current stable line — use the newest release from [ventoy.net/en/download.html](https://www.ventoy.net/en/download.html). The installed version is shown in the `Ventoy2Disk` window title (Windows) and in the banner `Ventoy2Disk.sh` prints on startup (Linux). Re-running the installer with the **Update** option refreshes the on-disk bootloader in place without touching your ISOs.

## Related documentation

- [Installing and booting PAI from USB](installing-and-booting.md) — the direct-flash path
- [Raspberry Pi Imager guide](using-raspberry-pi-imager.md) — the Pi path
- [Creating persistence](../persistence/creating-persistence.md) — encrypted data across reboots
- [Troubleshooting boot issues](../advanced/troubleshooting.md)
