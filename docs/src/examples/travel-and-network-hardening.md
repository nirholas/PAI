---
title: "Travel and network hardening: configuring PAI for hostile environments"
description: A step-by-step walkthrough of configuring PAI for journalism, activism, or travel across borders — MAC randomization, Tor bridges, disk-header backup, and a duress plan.
---

# Travel and network hardening: configuring PAI for hostile environments

**PAI was built for exactly this.** A full, private computer on a USB stick — a network identity that resets on every boot, an OS that runs entirely in RAM, and a recovery path you control. This guide turns PAI's defaults into a travel-ready profile you can rely on across borders and hotel wifi.

This guide assumes you have already completed
[getting-started.md](getting-started.md) and have a working PAI stick with
persistence. Here you will take that baseline and turn it into a
travel-ready profile: network identity that doesn't follow you, a
browser that doesn't leak, and a recovery plan that survives a
confiscated device.

This is not a guarantee of safety. Read
[../../SECURITY.md](../security.md) and
[../../PRIVACY.md](../PRIVACY.md) before relying on any of this in
a real threat scenario.

---

## What you'll build

- A PAI profile that randomizes its MAC on every boot
- Tor with bridge support for networks that block the public relays
- A Firefox profile with no saved cookies, history, or autofill
- A pre-staged LUKS header backup stored off-device
- A documented duress plan for the passphrase

**Time:** ~45 minutes.
**Prerequisites:** Tutorial 1 completed; a second storage device for
the header backup; a phone or separate machine to fetch bridges.

---

## Step 1 — Randomize your MAC address on boot

A static MAC follows you between coffee shops, airports, and hotel
networks. Randomizing it on every boot breaks that trail.

1. Unlock persistence and open a terminal.
2. Enable the NetworkManager randomization policy:

   ```sh
   sudo mkdir -p /etc/NetworkManager/conf.d
   printf '[device]\nwifi.scan-rand-mac-address=yes\n\n[connection]\nwifi.cloned-mac-address=random\nethernet.cloned-mac-address=random\n' \
     | sudo tee /etc/NetworkManager/conf.d/00-macrandomize.conf
   sudo systemctl restart NetworkManager
   ```

3. Confirm with `ip link show` — your wireless interface's MAC should
   differ from the hardware address printed on the device.

If the network refuses to associate after this, some captive portals
pin to MAC. Toggle randomization to `stable` for that one network
rather than disabling it globally.

---

## Step 2 — Configure Tor bridges for censored networks

Public Tor relays are blocked on many hotel, campus, and national
networks. Bridges route around that.

1. From a **different** device (your phone on cellular is ideal), fetch
   fresh bridges from the official Tor bridge distributor. Do **not**
   fetch them from the hostile network.
2. In PAI, open the Tor settings panel and paste the bridge lines into
   the bridges field. Save.
3. Toggle Tor on. The indicator may take 1–2 minutes on a bridged
   connection.

If Tor still won't bootstrap, see
[../troubleshooting.md](../advanced/troubleshooting.md#tor-wont-connect). Do not
fall back to a plain VPN thinking it is equivalent — it isn't.

---

## Step 3 — Strip the Firefox profile

Tutorial 1 gave you the PAI-hardened Firefox. For travel, go further:

1. In Firefox preferences, set history to **Never remember**.
2. Disable autofill for addresses and payment methods.
3. Remove every saved login. Use a password manager unlocked only
   inside persistence.
4. Install uBlock Origin from the PAI-local extension repository (not
   from AMO directly — you do not want to leak your identity fetching
   it). See [../installation.md](../installation.md) for the local
   path.

Test by visiting a fingerprinting probe (EFF's Cover Your Tracks works
well over Tor) and confirm the report matches other Tor Browser users,
not a unique fingerprint.

---

## Step 4 — Pre-stage a LUKS header backup off-device

If the stick is confiscated or corrupted, the header dies with it. Back
it up **before** you travel.

1. Attach a second storage device — ideally one you will not carry
   with you across borders.
2. Dump the header:

   ```sh
   sudo cryptsetup luksHeaderBackup /dev/sdX2 \
     --header-backup-file /media/other/pai-luks-header.img
   ```

3. Encrypt the backup itself with a different passphrase:

   ```sh
   gpg --symmetric --cipher-algo AES256 /media/other/pai-luks-header.img
   shred -u /media/other/pai-luks-header.img
   ```

4. Leave the encrypted header with someone you trust, or store it in a
   location you can reach remotely.

The header without your passphrase is not usable. The passphrase
without the header is not usable. You need both — which is exactly why
they should not travel together.

---

## Step 5 — Write a duress plan

A border officer who sees the USB can compel disclosure in some
jurisdictions. Decide **in advance** what you will do.

Options, each with tradeoffs:

- **Decoy persistence:** Initialize a second persistence volume with a
  different passphrase containing innocuous files. This is plausibly
  deniable only if the officer does not know LUKS supports multiple
  keyslots. Assume sophisticated adversaries do.
- **Leave it at home:** The safest duress plan is not carrying the
  sensitive stick across the border at all. Ship it ahead, or fetch
  material remotely once you arrive.
- **Destroy on demand:** Physically destroying the stick at the
  checkpoint is legal in fewer places than you might think. Do not
  assume it is safe where you are going.

Write your choice down before the trip. Decisions made at a checkpoint
under stress are worse than decisions made at a kitchen table.

---

## What you learned

- How to randomize your MAC so you don't build a network trail.
- How to use Tor bridges when public relays are blocked.
- How to strip Firefox of persistent identity.
- How to separate your encrypted volume from its header.
- Why the hardest part of travel OPSEC is the plan, not the tools.

---

## Next steps

- For threat-model context, read
  [../../SECURITY.md](../security.md#threat-model).
- For crypto-specific workflows, see
  [crypto-cold-signing.md](crypto-cold-signing.md).
- For a local AI workflow that stays on the device, see
  [local-ai-assistant.md](local-ai-assistant.md).
