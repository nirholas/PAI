---
title: "Install PAI on Raspberry Pi with Raspberry Pi Imager"
description: "Add PAI to Raspberry Pi Imager's OS list and flash the official PAI arm64 image to an SD card or USB drive for Pi 4, Pi 5, Pi 400, and Pi Zero 2 W."
sidebar:
  label: "Raspberry Pi Imager"
  order: 2
head:
  - tag: meta
    attrs:
      property: "og:description"
      content: "Add PAI to Raspberry Pi Imager's OS list and flash the official PAI arm64 image to a Raspberry Pi."
  - tag: meta
    attrs:
      name: "keywords"
      content: "Raspberry Pi PAI, PAI arm64, Raspberry Pi Imager custom OS, offline AI Raspberry Pi, private AI Pi 5"
---


Raspberry Pi Imager is the easiest way to install PAI on a Raspberry Pi. This guide walks you through adding PAI's custom repository to Imager, picking the right Pi image, and booting your first session. **[Experimental — arm64]**

**The fast path:** a Pi 5 with 8 GB of RAM plus an SD card or USB drive, and you have a private, self-contained AI computer for under $100 — small enough to slip into a travel bag, powerful enough to run modern small models locally. Experimental here means "arm64 images are still catching up to amd64 feature parity"; the basic boot-and-chat path works well today.

In this guide:
- Supported and unsupported Pi models
- Adding the PAI custom repository to Raspberry Pi Imager
- Enabling USB boot on Pi 4 (EEPROM update)
- Verifying the manifest against the GitHub release mirror
- What first boot looks like — with and without a display
- Realistic AI inference performance on each Pi
- Headless / SSH access, persistence on SD cards, troubleshooting

## Supported hardware

| Pi model | Support | RAM | Notes |
|---|---|---|---|
| Raspberry Pi 5 (4 GB / 8 GB / 16 GB) | Recommended | 4–16 GB | Fastest CPU; native USB 3.0 and PCIe for NVMe |
| Raspberry Pi 4 (4 GB / 8 GB) | Supported | 4–8 GB | Works well; older units need an EEPROM update for USB boot |
| Raspberry Pi 400 | Supported | 4 GB | Same SoC as Pi 4 in a keyboard form factor |
| Raspberry Pi Zero 2 W | Minimal | 512 MB | Tiny models only; best used headlessly — see below |
| Raspberry Pi 3B / 3B+ | Not supported | 1 GB | 32-bit boot ROM cannot load the arm64 image |
| Raspberry Pi 2 / 1 | Not supported | — | Pre-arm64 silicon |
| Compute Module 4 / 5 | Untested | varies | Same silicon as Pi 4/5; boot config differs (eMMC variant, dtoverlays) |

## Prerequisites

- A Raspberry Pi from the supported list
- A microSD card (16 GB or larger) **or** a USB 3.0 drive (Pi 4/5 with USB boot enabled)
- The official Pi power supply — under-voltage is the single most common cause of flash errors, unstable boots, and thermal throttling
- A computer with Raspberry Pi Imager installed from [raspberrypi.com/software](https://www.raspberrypi.com/software/)
- An internet connection on the flashing computer (Imager downloads the ~2 GB image from PAI's release mirror)

!!! note

    Raspberry Pi Imager **1.8.5 or newer** is required. The PAI manifest uses the `os_list_v3` schema; earlier Imager versions silently fall back or reject it. Imager will prompt you to update if yours is out of date.


## Add PAI to Raspberry Pi Imager

1. Launch Raspberry Pi Imager.
2. Open the repository editor — click the gear icon (macOS: top-right; Linux/Windows: bottom) or press **Ctrl+Shift+X**.
3. Enable **"Use custom repository"**.
4. Paste this URL: `https://pai.direct/imager.json`
5. Click **OK**. Imager reloads the OS list.
6. Click **CHOOSE OS**. Scroll to **"PAI — Private AI"** near the top.
7. Click **CHOOSE STORAGE** and pick your SD card or USB drive.
8. Click **NEXT**. When Imager asks about **OS Customization** (Wi-Fi, SSH, hostname presets), click **No** — those presets target Raspberry Pi OS and do not apply to PAI. Wi-Fi and SSH are configured inside PAI after first boot.
9. Confirm the write. Imager downloads the image, writes it to the card, and reads it back to verify. This takes 3–10 minutes depending on card speed.
10. Wait for the "Write Successful" dialog before removing the card.
11. Insert the card (or USB drive) into the Pi and power on.

## Enable USB boot on a Pi 4

Pi 4 units shipped before mid-2020 have an EEPROM bootloader that only recognises the SD card at boot. To boot PAI from a USB SSD or flash drive on an older Pi 4, update the EEPROM first:

1. Flash Raspberry Pi OS to a microSD card and boot your Pi 4 from it.
2. Open a terminal and update the EEPROM to the latest stable release:
   ```bash
   sudo rpi-eeprom-update -a
   sudo reboot
   ```
3. Run `sudo raspi-config`. Under **Advanced Options → Bootloader Version**, choose **Latest**. Under **Advanced Options → Boot Order**, choose **USB Boot** (or **USB first, then SD**).
4. Shut down, remove the SD card, and plug in the USB drive flashed with PAI.

Pi 5 and Pi 400 support USB boot out of the box; no EEPROM steps are required.

## Verify the manifest before flashing

Raspberry Pi Imager verifies the SHA256 of the image automatically after writing it. To verify that the manifest itself (which tells Imager what URL and hash to use) has not been tampered with in transit or on the CDN, compare the live manifest at `pai.direct` against the mirror attached to the GitHub release:

=== "Linux"
    ```bash
    curl -fsSL https://pai.direct/imager.json | sha256sum
    curl -fsSL https://github.com/nirholas/pai/releases/latest/download/imager.json | sha256sum
    ```
=== "macOS"
    ```bash
    curl -fsSL https://pai.direct/imager.json | shasum -a 256
    curl -fsSL https://github.com/nirholas/pai/releases/latest/download/imager.json | shasum -a 256
    ```
=== "Windows (PowerShell)"
    ```powershell
    Invoke-WebRequest https://pai.direct/imager.json `
      -OutFile pai-live.json
    Invoke-WebRequest https://github.com/nirholas/pai/releases/latest/download/imager.json `
      -OutFile pai-release.json
    Get-FileHash pai-live.json, pai-release.json -Algorithm SHA256
    ```

Both hashes should be identical. If they differ, **do not flash** — open an issue at [github.com/nirholas/pai/issues](https://github.com/nirholas/pai/issues) with the two hashes and the date/time you ran the check.

## Expected first boot

=== "Pi 5, Pi 4, Pi 400"
    The Pi boots into Sway (Wayland), Ollama starts on `localhost:11434`, and Firefox opens Open WebUI at `localhost:8080`. Typical boot times:

    - **Pi 5 + USB 3.0 SSD**: 20–30 seconds
    - **Pi 5 + Class 10 microSD**: 30–60 seconds
    - **Pi 4 + Class 10 microSD**: 45–90 seconds

    You'll land at an auto-login Sway session. Connect to Wi-Fi from the waybar NetworkManager applet. Open a terminal with **Alt+Return**.
=== "Pi Zero 2 W"
    The Pi Zero 2 W has 512 MB of RAM. The full Sway desktop plus Ollama plus even the 1B baseline model will not fit comfortably — expect heavy swap, OOM-kills, or a failed desktop start.

    Recommended path on Zero 2 W:

    1. Flash PAI as normal.
    2. Power on without a display attached.
    3. SSH in from another machine on the same network (see [Headless and SSH access](#headless-and-ssh-access)) and use `ollama` directly from the terminal.
    4. Pull a sub-1B model — e.g. `ollama pull tinyllama:1.1b-chat-v1-q2_K` or smaller — instead of the baked-in `llama3.2:1b`.

    Treat the Zero 2 W as a proof-of-concept footprint for text-only workflows, not a daily driver.

## Performance expectations

Inference on a Pi is slower than on a laptop, and much slower than on a GPU. Approximate ranges for the baked-in `llama3.2:1b` model, short prompts, CPU only:

| Platform | Tokens/sec (approx.) | Usable for |
|---|---:|---|
| Modern laptop, 8 GB RAM, CPU only | 15–40 | Comfortable interactive chat |
| Raspberry Pi 5, 8 GB | 5–10 | Short prompts, non-streaming use |
| Raspberry Pi 4, 8 GB | 2–5 | Background tasks, batch Q&A |
| Raspberry Pi Zero 2 W | <1 | Very short prompts only |

Numbers are order-of-magnitude — actual speed depends on quantization, prompt length, thermal headroom, and background load. Passive heatsinks are fine for short sessions; a fan-cooled case keeps a Pi 5 out of thermal throttling during longer runs. Larger models (`3b`, `7b`) will run on a Pi 5 with 8 GB+ RAM but at a fraction of the 1B model's speed.

## Persistence on SD cards

PAI's optional [encrypted persistence layer](../persistence/introduction.md) writes to the boot device. On an SD card that has a few practical implications:

- **SD card wear.** Each model download and every chat message written to persistent storage produces writes. Consumer SD cards are rated for tens of thousands of write cycles, which is fine for casual use, but a USB 3.0 SSD lasts dramatically longer under heavy load.
- **Capacity.** Persistence grows to fill free space at setup time. Use 32 GB or larger if you plan to pull anything bigger than the baked-in 1B model.
- **Speed.** SD card random I/O is significantly slower than SSD. Model load times and WebUI database writes will feel the difference.

On a Pi 4 (with EEPROM updated) or a Pi 5, keeping PAI on a USB 3.0 SSD and leaving the SD slot empty gives the best I/O and longest device life.

## Headless and SSH access

PAI targets desktop use and does not enable SSH by default. To run a Pi headlessly:

1. Boot PAI once with a display and keyboard attached.
2. Open a terminal (**Alt+Return**) and enable the SSH service:
   ```bash
   sudo systemctl enable --now ssh
   ```
3. Set a password for the default `user` account so remote login has something to authenticate against:
   ```bash
   sudo passwd user
   ```
4. Find the Pi's IP on the LAN:
   ```bash
   ip -4 addr show
   ```
5. From another machine, connect:
   ```bash
   ssh user@<pi-ip>
   ```

With [persistence](../persistence/introduction.md) enabled, the SSH service state and password survive reboot. Without persistence, repeat steps 2–3 on each boot.

Setting up fully headless *before first boot* (equivalent to Raspberry Pi OS's "headless provisioning") is not supported by the current Imager manifest — PAI's image does not read the boot-partition config Raspberry Pi OS uses.

## Troubleshooting

### "The manifest could not be loaded"
Imager hit a network error. Open `https://pai.direct/imager.json` in a browser — you should see JSON. If the URL works in a browser but Imager rejects it, update Imager to 1.8.5 or newer (`os_list_v3` schema support is required).

### PAI doesn't appear in the OS list after adding the repo
Quit and relaunch Imager. The custom repo cache is loaded at startup.

### "No space left on device" while writing
Your card is smaller than the image requires. The PAI arm64 image needs roughly 8 GB free; use a 16 GB card or larger.

### Rainbow screen, then nothing
The Pi's EEPROM is too old to load the kernel. Boot Raspberry Pi OS, run `sudo rpi-eeprom-update -a`, reboot, then retry PAI.

### Pi 4 won't boot from USB
See [Enable USB boot on a Pi 4](#enable-usb-boot-on-a-pi-4). Pi 4 units with the original 2019 bootloader only see the SD slot at boot.

### Black screen after the Pi logo
Most often an under-voltage issue. Use the official Pi 5 (5 V / 5 A) or Pi 4 (5 V / 3 A) supply. Third-party supplies that advertise the right amperage but ship with under-spec cables regularly fail to sustain current under load. Check `vcgencmd get_throttled` after boot — anything non-zero indicates a power or thermal event.

### Wi-Fi not working after boot
PAI ships the firmware for the Pi's onboard Broadcom Wi-Fi chip. If Wi-Fi still fails, run `dmesg | grep -i brcm` — missing or mismatched firmware is the typical cause on brand-new Pi revisions released after the PAI image was built. Update to a newer PAI image, or install the current `firmware-brcm80211` package manually if you have persistence enabled.

### Imager's "OS Customization" dialog asked for Wi-Fi and SSH settings
Those presets target Raspberry Pi OS specifically and are ignored by PAI. Click **No** (or **Skip**). PAI handles Wi-Fi and SSH after boot — see [Headless and SSH access](#headless-and-ssh-access).

### `vcgencmd get_throttled` reports a non-zero value
Power or thermal event. The bit fields are documented in `vcgencmd get_throttled`; common causes: under-voltage (bad power supply or cable), over-temperature (no airflow / case sealed), or ARM frequency capped. Address the underlying hardware before blaming PAI.

## Frequently asked questions

### Do I need the Imager repo if I already downloaded the .img.xz?
No. Imager's "Use custom image" option flashes any local `.img.xz` directly. The custom repo exists for discovery — users who don't know a PAI image exists find it in Imager's OS list.

### Can I use Raspberry Pi Imager from Raspberry Pi OS itself?
Yes. Imager runs on Pi OS and can flash a second card or USB drive. Useful if you want to prepare a PAI drive from an existing Pi.

### Does this work on a Compute Module?
Untested. CM4 and CM5 share silicon with Pi 4 and Pi 5 respectively, so the image should boot, but CM carrier boards differ in display, network, and storage wiring. CM4 variants without eMMC need their own boot-selection jumper. File an issue if you try it and we'll update the table.

### Can I run PAI on a Pi 4 with 2 GB of RAM?
Technically yes, but with heavy caveats. The baked-in `llama3.2:1b` uses roughly 1.3 GB at rest and more under load. On a 2 GB Pi 4 you'll see swapping during inference and occasional OOM. Prefer a 4 GB or 8 GB Pi 4, or use the Pi 5.

### Is the SD card "amnesic" like a USB stick?
The amnesic property is about RAM state, not the boot device. Chat, downloaded models, and browser state live in RAM and disappear on shutdown — unless you opt in to [persistence](../persistence/introduction.md). The image on the card itself stays put until you flash something else over it.

### Can I dual-boot PAI and Raspberry Pi OS on one card?
No. PAI uses the entire device. Use a second card or a USB drive if you want both installed.

### Does PAI support the Pi Camera or the GPIO header?
Camera and GPIO work at the kernel level, but PAI doesn't ship the userspace tools (`libcamera-apps`, `pigpio`, etc.) out of the box. Install them inside PAI if you need them, with [persistence](../persistence/introduction.md) so the install survives reboot.

## Related documentation

- [Installing and booting PAI from USB](installing-and-booting.md) — the PC and Mac path
- [System requirements](../general/system-requirements.md) — full CPU compatibility table
- [Building from source](../advanced/building-from-source.md) — build your own arm64 image
- [Troubleshooting](../advanced/troubleshooting.md) — general boot, display, and network fixes
- [Persistence introduction](../persistence/introduction.md) — opting in to encrypted persistent storage
