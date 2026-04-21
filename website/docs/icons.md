# PAI Icon Style Guide

## Specification

- **Format**: SVG (source), PNG 64×64 (production export)
- **Canvas**: 64×64 px, transparent or solid background
- **Rendering**: `shape-rendering: crispEdges` / `image-rendering: pixelated`
- **Style**: Pixel-art, 1–2 brand colors per icon, nearest-neighbour scale

## Brand Palette

| Role      | Hex       | Usage                        |
|-----------|-----------|------------------------------|
| Red       | `#D62828` | Danger / Flash / action apps |
| Blue      | `#1B4FFF` | Info / About / Verify        |
| Pink      | `#EC4899` | Chat / social                |
| Yellow    | `#D97706` | Security / warnings          |
| Dark      | `#18181B` | Terminal / system            |
| Green     | `#16A34A` | Docs / Changelog             |
| Teal      | `#0F766E` | Files / neutral              |
| Purple    | `#7C3AED` | Hardware / advanced          |

## Current Icons (v1 stubs)

These are placeholder tiles — solid color + first letter in Courier New. Contributions to replace them with proper pixel art are welcome.

| App        | File              | Color     | Target art               |
|------------|-------------------|-----------|--------------------------|
| about      | `about.svg`       | `#1B4FFF` | Info circle pixel-art    |
| docs       | `docs.svg`        | `#16A34A` | Open book                |
| flash      | `flash.svg`       | `#D62828` | USB stick / lightning    |
| terminal   | `terminal.svg`    | `#18181B` | `>_` prompt              |
| chat       | `chat.svg`        | `#EC4899` | Speech bubble            |
| security   | `security.svg`    | `#D97706` | Shield / lock            |
| verify     | `verify.svg`      | `#0891B2` | Checkmark / seal         |
| hardware   | `hardware.svg`    | `#7C3AED` | CPU / chip               |
| press      | `press.svg`       | `#BE185D` | Camera / press badge     |
| changelog  | `changelog.svg`   | `#059669` | Scroll / list            |
| faq        | `faq.svg`         | `#E11D48` | `?` mark                 |
| files      | `files.svg`       | `#0F766E` | Folder                   |

## Contributing an Icon

1. Work at **64×64 px** on a pixel grid.
2. Use a transparent background unless the icon needs a solid tile treatment.
3. Limit to **2 colors** from the brand palette above (plus white/black for shading).
4. Export as **SVG** with `shape-rendering="crispEdges"` on the root `<svg>`.
5. Also export a **PNG** at 64×64 — this is what ships in production (`public/icons/<name>.png`).
6. When switching from stub to production PNG, update the `icon` field in [`src/shell/apps.js`](../src/shell/apps.js) from `.svg` → `.png`.
7. Open a PR with both the `.svg` source and the `.png` export.

## SVG Icon Template

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"
     shape-rendering="crispEdges">
  <!-- 4px pixel grid: work in 4×4 blocks -->
  <!-- Replace rectangles below with your pixel art -->
  <rect x="0"  y="0"  width="4" height="4" fill="#1B4FFF"/>
  <!-- ... -->
</svg>
```

## What NOT to contribute

- Lucide, Heroicons, or other generic icon libraries — off-brand.
- Icons at sizes other than 64×64.
- Anti-aliased or vector-smooth art — pixel-perfect only.
- More than 3 distinct colors per icon.
