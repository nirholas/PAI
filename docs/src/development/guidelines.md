---
title: Development Guidelines
description: Opinions on how code lands in PAI — layout, style, commits, and review triggers.
audience: contributors
last_reviewed: 2026-04-17
---

# Development Guidelines

These are the conventions PAI enforces in review. They are opinionated on
purpose: a build system that produces bit-identical artifacts has no room
for stylistic drift.

## 1. Repo layout

```
pai/
├── build.sh                 # AMD64 top-level build orchestrator
├── arm64/build.sh           # ARM64 counterpart (mirror structure)
├── Dockerfile.build         # reproducible builder image
├── scripts/
│   ├── chroot/              # runs *inside* the target rootfs, numbered
│   ├── host/                # runs on the builder, never in chroot
│   └── lib/                 # shared bash helpers, sourced only
├── prompts/                 # LLM prompts used to regenerate docs/agents
├── agents/                  # agent role definitions (see AGENTS.md)
├── skills/                  # reusable Claude Code skills
├── tests/                   # bats tests + fixtures
├── docs/                    # end-user and contributor docs
├── website/                 # Astro site, deployed separately
└── out/                     # build artifacts (gitignored)
```

Keep this shape. New top-level directories need a maintainer sign-off;
see [CONTRIBUTING.md](../../CONTRIBUTING.md).

## 2. Bash conventions

Every script starts with:

```bash
#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'
```

Rules the reviewer will check:

- **Quote everything.** `"$var"`, `"$@"`, `"${arr[@]}"`. Unquoted
  expansions are rejected unless the unquoting is the point (rare).
- **`printf`, not `echo -e`.** `echo -e` is non-portable across
  `/bin/sh` implementations and has burned us before.
- **ShellCheck clean.** Zero warnings on `shellcheck -x script.sh`.
  Disable with `# shellcheck disable=SCxxxx` only with a one-line reason.
- **Functions are `snake_case`**, locals are declared `local`, globals
  are `SCREAMING_SNAKE` and defined at the top of the file.
- **Argument parsing** uses a `while` + `case` loop with long options
  (`--arch=arm64`). No positional flag hacks. `--help` is mandatory.
- **No `cd` without `pushd`/`popd`** or a subshell `(cd … && …)`. The
  build spans dozens of scripts and silent CWD drift is a nightmare.
- **Traps.** Any script that creates a temp dir or mount registers a
  `trap cleanup EXIT INT TERM`.

## 3. Python conventions

Where PAI uses Python (build helpers, agent glue):

- **Version pin:** Python 3.11, declared in `pyproject.toml`.
- **Formatter + linter:** `ruff format` and `ruff check`. No black, no
  flake8, no isort — ruff owns all three.
- **Type hints everywhere.** Public functions are `mypy --strict` clean.
- **Entry points** live in `pai.cli:main` and are exposed via
  `[project.scripts]` in `pyproject.toml`, not ad-hoc shebang scripts.
- No `requirements.txt`; dependencies live in `pyproject.toml` with
  upper bounds on major versions.

## 4. Astro / TS for `website/`

- **Linter:** `eslint` with `eslint-plugin-astro` and
  `@typescript-eslint`. `npm run lint` before pushing.
- **Accessibility:** `astro check` + `axe-core` in Playwright smoke
  tests. Any new interactive component needs a keyboard path.
- **Component location:** shared UI in `website/src/components/`,
  page-specific UI stays co-located with the page.
- **Content collections:** docs and changelog are Astro content
  collections — see `website/src/content.config.ts`. Don't hand-roll
  markdown loaders.

## 5. Commit style

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(arm64): add Pi 5 device tree overlay

The Pi 5 ships with a newer BCM2712 that the default dtb doesn't
match. Ship a vendor dtb and wire it into the EFI stub. Fixes a boot
hang on power-on.

Refs: #482
Co-authored-by: Jane Doe <jane@example.com>
```

- Subject ≤ 72 chars, imperative mood, no trailing period.
- Body wraps at 72 columns. Explain *why*, not *what*.
- Breaking changes: `feat!:` or a `BREAKING CHANGE:` footer.
- Co-author trailer exactly as above — CI validates the format.

## 6. PR size

**Small, please.** A good PR is ≤ 400 lines diff and does one thing.

If the change must be big (new architecture support, top-level refactor):

1. Open a tracking issue with the design sketch.
2. Land preparatory refactors as independent PRs.
3. Use a **stacked series** — each PR depends on the previous, each is
   reviewable on its own. Tools: `git town`, `graphite`, or plain
   branch-per-PR.

Reviewers will push back on mega-PRs even if the code is good.

## 7. Adding a new build step

Every new step is four artifacts:

1. **Prompt file** in `prompts/<area>/<step>.md` — the LLM-generated
   origin of the step, checked in for reproducibility.
2. **Chroot or host script** in `scripts/chroot/NN-<name>.sh` (numbered
   to fix ordering) or `scripts/host/<name>.sh`.
3. **Bats test** in `tests/<name>.bats` — covers happy path and the
   most likely failure mode.
4. **Docs update** — either a new page under `docs/` or a section in an
   existing guide. A step that isn't documented doesn't exist.

## 8. Dependency hygiene

Reproducibility is load-bearing. Therefore:

- **Pin versions** in anything checksummed into the image:
  `debootstrap --include=foo=1.2.3-1`, apt preferences files, exact git
  SHAs for `go install`/`cargo install`.
- **Prefer Debian packages** over `curl … | sh`. If a vendor only
  ships curl-bash, wrap it in a script that verifies a checksum and
  pins the version.
- **Checksum everything downloaded** — SHA-256 minimum, GPG signature
  where available. `wget --no-check-certificate` is never allowed.
- **No silent upgrades.** `apt-get install` in chroot scripts uses
  `--no-install-recommends` and lists every package explicitly.

## 9. Security review triggers

Tag a maintainer with the security role (`@maintainers-security` — see
[MAINTAINERS.md](../MAINTAINERS.md)) on any PR that:

- Touches cryptographic code, keyring imports, or signature verification.
- Adds a network-reachable service to the base image.
- Adds or modifies sudoers, PAM, or polkit policy.
- Changes the boot path (initramfs, GRUB/systemd-boot, kernel cmdline).
- Introduces a new dependency that isn't in the Debian main archive.
- Modifies the build provenance chain or SBOM generation.

See [SECURITY.md](../security.md) for the disclosure process and
[AGENTS.md](../../AGENTS.md#security-reviewer) for what the security
role actually reviews.
