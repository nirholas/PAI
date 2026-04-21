# Accessibility

## 1. Commitment

Accessibility is not an afterthought in PAI. We aspire to meet **WCAG 2.2
Level AA** for the project website and to provide meaningful accessibility
on the desktop for users with visual, auditory, motor, and cognitive
disabilities. Privacy tools are not truly private if only some people can
use them — inclusivity is a first-class goal, not a later milestone.

We will not claim compliance we have not verified. This document tracks
both what works today and what does not.

## 2. Current state — honest

PAI runs on Sway (Wayland). Accessibility on Wayland is historically
weaker than on X11, and we want to be upfront about that:

- **Screen readers**: Orca has partial support on Wayland. Many GUI
  applications still depend on AT-SPI paths that were X11-first. Users
  who depend on a screen reader should expect rough edges and are
  encouraged to test before committing to PAI as a daily driver.
- **Keyboard navigation**: strong. Sway is keyboard-first by design,
  and almost every workflow in PAI can be driven without a pointer.
- **High-contrast themes and wallpapers**: available. See
  [prompts/07-wallpaper-theme.md](prompts/07-wallpaper-theme.md) for
  the theming system and contrast tokens.
- **Magnification**: `wl-zoom` and compositor-level zoom bindings work
  but are less polished than X11 equivalents.
- **Braille displays**: untested. We would welcome a contributor who
  can validate brltty on our image.

If you rely on assistive technology and PAI falls short, please file an
issue — we treat these as high priority (see section 9).

## 3. Keyboard-only usage

Everything in PAI can be driven from the keyboard:

- **Application launcher**: `Super+D` opens the launcher; type, arrow
  keys, Enter.
- **Window tiling**: `Super+H/J/K/L` to move focus, `Super+Shift+H/J/K/L`
  to move windows, `Super+1..9` to switch workspaces.
- **Browser**: Firefox's built-in Caret Browsing (`F7`) and tab/shift-tab
  focus cycling are fully functional.
- **Wallets**: all supported wallets expose keyboard shortcuts for
  transaction signing, address copy, and seed-phrase entry.
- **Terminal-first fallback**: every GUI action in PAI has a
  command-line equivalent, so users who prefer or require a pure
  keyboard workflow are never forced into the pointer.

A full keybinding reference lives in the user documentation.

## 4. Visual

- **Font scaling**: system-wide scale factor via compositor, plus
  per-app zoom in the browser and terminal.
- **High-contrast theme toggle**: ships with the image; bound to a
  configurable keyboard shortcut.
- **Color-blind friendly palettes**: theming system avoids red/green
  as the sole signal for state. Status indicators also use shape or
  text where possible.
- **Reduced motion**: honored at the compositor, website, and
  application level where the underlying toolkit exposes it.

## 5. Auditory

- **Visual indicators alongside sounds**: system notifications are
  never audio-only. Every beep has an on-screen counterpart.
- **Captions for documentation video**: required. Any video added to
  the docs or website must ship with a caption track; videos without
  captions are not accepted in review.

## 6. Motor

Available via the underlying Linux accessibility stack:

- **Sticky keys**, **slow keys**, **bounce keys** — configurable per
  user.
- **Click assist** / dwell-click for users who cannot reliably click.
- **Pointer acceleration and deceleration** — tunable; the default
  favors predictability over speed.
- **On-screen keyboard**: `wvkbd` is available for touch and
  single-switch users.

## 7. Cognitive

- **Plain-language documentation**: short sentences, active voice,
  one idea per paragraph where possible.
- **Predictable layouts**: the website and docs use a consistent
  navigation pattern so users do not have to relearn the interface
  page to page.
- **No time-pressured flows**: setup, wallet use, and recovery do not
  impose artificial timeouts beyond what the underlying crypto
  requires.

## 8. Website accessibility

The project website is an Astro site under [website/](website/).

- **Semantic HTML**: components use proper landmark elements
  (`<main>`, `<nav>`, `<aside>`) and heading hierarchy.
- **Alt text**: required on every image. PRs that add images without
  alt text are not merged.
- **Color contrast**: target is WCAG 2.2 AA (4.5:1 body, 3:1 large
  text). Contrast is checked manually today; automated auditing
  (axe-core or pa11y in CI on every PR touching the website or docs)
  is tracked in [ROADMAP.md](roadmap.md) Phase 1 · *shellcheck + yamllint + website-build validation in CI*.
- **Focus indicators**: visible and not suppressed by theme overrides.
- **Keyboard traps**: none. If you find one, file an issue.

## 9. Reporting accessibility issues

File a GitHub issue using the bug report template and apply the
`a11y` label. Maintainers treat these as high priority. If the issue
is sensitive or personal, email the maintainers (see
[MAINTAINERS.md](MAINTAINERS.md)) rather than filing publicly.

When reporting, please include:

- the assistive technology you use,
- the compositor/app where the problem occurs,
- what you expected vs. what happened.

## 10. Roadmap

Planned accessibility work — screen-reader validation passes,
CI contrast audits, braille-display testing, on-screen keyboard
refinement — is tracked in [ROADMAP.md](roadmap.md) under the
**Accessibility** heading. Contributions are welcome; see
[CONTRIBUTING.md](https://github.com/nirholas/pai/blob/main/CONTRIBUTING.md).
