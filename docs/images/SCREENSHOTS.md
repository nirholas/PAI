# Screenshot assets

These images need to be captured in UTM (or another VM) and committed here.

## Required screenshots

| Filename | What to capture |
|---|---|
| `desktop.png` | Full PAI desktop: Sway + waybar across the top, Open WebUI open in Firefox covering most of the screen. Show a short conversation in progress. Capture at 1280×800 or 1440×900. |
| `pai-settings.png` | The pai-settings menu open (launched with Alt+S). Show all menu items visible. |
| `first-boot.png` | The pai-welcome screen shown on first boot (the greeter/splash that appears before the user dismisses it). |
| `open-webui-chat.png` | A close-up of Open WebUI with a multi-turn conversation in progress — model responding to a prompt. No personal or identifying text in the conversation. |

## Capture instructions (UTM on macOS)

1. Download the latest PAI ISO from the [releases page](https://github.com/nirholas/pai/releases/latest)
2. Open UTM → Create a New Virtual Machine → Emulate → Other
3. Select Boot from ISO, pick the PAI ISO
4. Set RAM to 4 GB, 2+ CPU cores, x86_64
5. Start the VM
6. Once booted, use UTM's Screenshot function (Window → Screenshot) to capture each screen
7. Save as PNG, rename to match the filenames above, and commit to this directory

## Usage in docs

- `desktop.png` — referenced from `README.md` and `docs/src/using-pai.md`
- `pai-settings.png` — referenced from `docs/src/using-pai.md`
- `first-boot.png` — referenced from `docs/src/getting-started.md`
- `open-webui-chat.png` — referenced from `docs/src/using-pai.md`
