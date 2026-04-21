# OG Images

Place 1200×630 PNG files here — one per app plus `default.png` and `home.png`.

| File | Used by |
|------|---------|
| `home.png` | `/` homepage |
| `default.png` | Any app without a dedicated image |
| `flash.png` | `/apps/flash` |
| `docs.png` | `/apps/docs` |
| `security.png` | `/apps/security` |
| `verify.png` | `/apps/verify` |
| `about.png` | `/apps/about` |

## Generation (Path B, post-launch)

Use `satori` + an Astro endpoint at `src/pages/og/[app].png.ts` to
generate images at build time from an HTML template.

Template design: dark background (`#0a0a0a`), PAI logo top-left,
app title large center, one-line description below, subtle pixel grid.
