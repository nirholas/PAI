# Raspberry Pi Imager — live end-to-end QA

This is a **human-in-the-loop** check performed during release QA. Raspberry
Pi Imager is a Qt desktop app; its UI cannot be driven from CI, so this
walkthrough exists to confirm that the manifest we publish is actually
picked up and renders correctly in the real tool.

Automated coverage (`scripts/smoke-test-flashers.sh`) verifies:

- `https://pai.direct/imager.json` returns HTTP 200 with
  `Content-Type: application/json`.
- The live manifest passes `scripts/validate-imager-manifest.mjs`.
- `https://pai.direct/imager/pai-icon.png` returns HTTP 200 with
  `Content-Type: image/png`.

What the automated tests **cannot** verify is that Imager parses the
manifest and surfaces PAI in its picker. That is this checklist.

## Prerequisites

- Imager **1.8.5 or newer** (older builds predate `os_list_v3`).
  Download: https://www.raspberrypi.com/software/
- A Pi 4 / Pi 5 / Pi 400 (only needed for step 5; steps 1–4 can be done
  on any machine that can run Imager).
- A spare SD card or USB drive (only needed for step 5).

## Steps

1. **Install Imager.** Launch it from the Start menu / Applications /
   your distro's launcher.

2. **Open the repository picker.**
   - Windows / Linux: press `Ctrl+Shift+X`.
   - macOS: press `Cmd+Shift+X`.
   - Or click the gear icon and choose **Advanced options**.

3. **Add PAI as a custom repository.**
   - Click **"Use custom repository"**.
   - Paste `https://pai.direct/imager.json`.
   - Click **OK**.

4. **Confirm PAI appears in the OS list.**
   - Open the OS picker (the "Choose OS" button on the main screen).
   - Scroll to find an entry named **"PAI — Private AI"**.
   - The PAI brand icon (triangular mark on transparent background)
     should render next to the name. If the icon is missing and shows
     Imager's default fallback glyph, flag it — the `icon` URL or the
     `Content-Type` header is wrong.
   - Click the entry. Confirm the description reads:
     **"Debian + Sway + Ollama · Private, offline AI on a bootable Pi"**.
   - Imager should show the expected download size (the
     `image_download_size` from the manifest, human-formatted). Compare
     to `release/pai-<version>-arm64.img.xz` size — these must match.

5. **(Optional — only during final release QA) Actually flash it.**
   - Select a spare SD card or USB drive as the destination.
   - Click **"Write"** and confirm.
   - Imager downloads the `.img.xz` from the GitHub release URL,
     decompresses it, writes it, and verifies SHA256. Confirm all three
     stages finish green.
   - Move the SD card / USB to the Pi. Boot. Confirm:
     - Sway comes up.
     - Network connects.
     - `ollama --version` reports the expected version.

## Failure triage

- **PAI does not appear in the picker** → the manifest failed to load.
  Check the Imager log (`~/.cache/Raspberry Pi/Imager.log` on Linux,
  `%LOCALAPPDATA%\Raspberry Pi\Imager\Imager.log` on Windows). Common
  causes: JSON parse error, unsupported `os_list` schema version,
  `Content-Type` not `application/json`.
- **Icon is a grey placeholder** → the `icon` URL returned the wrong
  `Content-Type` (must be `image/png`) or is 404. Re-check the
  `/imager/pai-icon.png` header block in `website/vercel.json`.
- **"Failed to verify image" after download** → the SHA256 in the
  manifest does not match the `.img` decompressed from the `.img.xz`
  on the release page. Regenerate the sidecar via
  `scripts/package-arm64-img.sh` and re-run `gen-imager-manifest.mjs`.
- **"Failed to download image"** → the `url` field in the manifest
  points at a GitHub release that doesn't have the asset. Likely the
  post-release workflow ran before the arm64 build finished uploading.

## Sign-off

Paste the following into the release issue / PR when done:

```
Imager live QA (v<version>)
- [ ] Step 3: custom repository accepted
- [ ] Step 4: PAI entry visible with correct icon + description + size
- [ ] Step 5: flash + boot verified on <Pi model> (optional)
QA by: <github-handle>
Date: <YYYY-MM-DD>
```
