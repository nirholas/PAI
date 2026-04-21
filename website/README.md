# PAI Website

OS-style website for [PAI](../README.md) — a fake PAI desktop in the browser with draggable windowed apps.

## Quick start

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output → dist/
npm run preview  # serve dist/
npm run lint     # eslint + prettier check
```

## Directory map

```
website/
├── public/
│   ├── fonts/           # local fonts (PixelOperator.woff2, etc.)
│   ├── logo/            # pai-logo.png, favicon-*.png, favicon.ico
│   └── wallpapers/      # default.svg (and future wallpaper variants)
└── src/
    ├── layouts/
    │   └── Shell.astro  # full-viewport shell: topbar / desktop / dock slots
    ├── pages/
    │   └── index.astro  # desktop index
    ├── shell/
    │   ├── reset.css    # CSS reset
    │   └── tokens.css   # design tokens (@font-face, :root vars)
    └── styles/
        └── global.css   # import order: reset → tokens → tailwind
```

## How to add an app

> This section will be filled in by prompt `01f`. Placeholder:
>
> 1. Create `src/apps/<AppName>/` with an `index.astro` page and an icon.
> 2. Register the app in `src/shell/apps.ts` (id, title, icon, defaultSize).
> 3. The window manager (added in `01c`) picks it up automatically.

## Design tokens

All colors, spacing, radii, z-indices, and fonts live in [`src/shell/tokens.css`](src/shell/tokens.css). Do not hardcode values elsewhere — reference CSS custom properties instead.

The pixel font (`PixelOperator`) is declared via `@font-face` in tokens.css. Place `PixelOperator.woff2` in `public/fonts/` to activate it; headings fall back to monospace until then.
