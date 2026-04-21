# Browser Installer

PAI's browser installer at [pai.direct/flash-web](https://pai.direct/flash-web) lets you download, verify, and prepare a PAI USB drive without installing any tools first.

## What it does

1. **Detects your OS** — Windows, macOS, or Linux — and checks browser capabilities.
2. **Downloads the PAI ISO** directly to your machine with real-time progress.
3. **Verifies SHA256** in-browser using a streaming hash (no buffering the entire file).
4. **Generates a one-liner** precisely tailored to your OS and the verified ISO path.
5. **Offers copy-and-run** — paste the command in your terminal and the ISO is flashed.

## What it does NOT do

- It does **not** write directly to USB in most cases. Browsers cannot access block devices via standard APIs.
- It does **not** collect any telemetry, analytics, or error logs. Everything runs locally.
- The ISO is downloaded directly from GitHub Releases to your browser — PAI's servers never see the file.

## WebUSB write (experimental)

On **Chromium-based browsers** (Chrome, Edge, Brave), an experimental "In-Browser WebUSB Write" option is available. This attempts to write the ISO directly to a USB drive using the WebUSB API.

### OS compatibility

| OS | WebUSB Write Status |
|---|---|
| Linux | Most likely to work. The OS is more permissive about releasing USB devices. |
| Windows | Requires the USB drive to be unmounted/ejected first. May fail if Windows holds the driver. |
| macOS | Hit-and-miss. macOS aggressively claims mass-storage devices. |

### Requirements

- Chromium-based browser (Chrome, Edge, Brave, Opera)
- User must explicitly opt in via an "I understand this is experimental" checkbox
- The USB device must not be in use by the OS

If WebUSB fails at any step, the installer falls back to the Quick (copy-paste) method.

## Privacy

- **No telemetry.** The page does not log visits, funnel steps, or errors to any server.
- **No CDN calls.** All JavaScript and CSS is bundled. The only network request at runtime is the ISO download from GitHub.
- **Offline-capable.** Once loaded, the page is cached by a service worker so you can use it even if your connection drops mid-flow.

## Browser support

| Browser | Quick (copy-paste) | WebUSB Write |
|---|---|---|
| Chrome / Edge (last 2 versions) | ✅ | ✅ (experimental) |
| Firefox (last 2 versions) | ✅ | ❌ (API not available) |
| Safari (last 2 versions) | ✅ | ❌ (API not available) |

## Troubleshooting

### "SHA256 support: Not available"

Your browser does not support Web Workers. Update to a modern browser (Chrome, Firefox, Safari, or Edge released in the last 2 years).

### "Streaming downloads: Not supported"

Your browser does not support the Streams API. This is required for downloading large files without buffering. Update your browser.

### Download blocked by corporate proxy

If your network blocks downloads from `github.com`, download the ISO manually from the [Releases page](https://github.com/nirholas/pai/releases) and use `flash.sh --local-iso` or `flash.ps1 -LocalIso` directly.

### File System Access API unsupported

On Firefox and Safari, the page falls back to a standard `<a download>` trigger. The file will be saved to your default Downloads folder. You may need to confirm the download in your browser.

### WebUSB: "Your OS is holding the USB driver"

Close any File Explorer, Finder, or file manager window that shows the USB drive. On Windows, right-click the drive in Explorer and choose "Eject." On Linux, run `sudo umount /dev/sdX*` first. Then retry.

### WebUSB: no bulk OUT endpoint found

The selected device may not be a standard USB mass storage device, or its interface descriptors are non-standard. Use the Quick (copy-paste) method instead.
