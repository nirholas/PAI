# CLAUDE.md

Project notes for Claude Code / Claude-based agents working on this repository.

## Project

**PAI** — bootable USB Linux distribution for private, offline AI. Debian 12 + Sway + Ollama.

## Repository layout

- `shared/` — hooks, scripts, and configs common to all editions and architectures
- `desktop/` — desktop edition (Sway + GUI); uses shared/ + edition-specific hooks
- `web/` — web/kiosk edition; uses shared/ + edition-specific hooks
- `arm64/` — parallel ARM64 build tree (mirrors root `config/` structure); not yet merged into the edition layout
- `scripts/` — ISO build and flash scripts
- `website/` — Astro-based project website
- `docs/` — documentation source
- `agents/` — agent prompts
- `skills/` — skill definitions
- `prompts/` — reusable prompts

### Build structure notes

The repo has two build paths that must be kept in sync:

1. **Edition builds** (`desktop/`, `web/`): parameterized by edition, target amd64. Pull hooks from `shared/` plus edition-specific overrides.
2. **ARM64 build** (`arm64/`): a near-copy of the root `config/` tree targeting arm64. Does not yet consume `shared/`, `desktop/`, or `web/` — changes to those must be manually mirrored here.

## Conventions

- License: GPL v3
- Commit style: short imperative subject, optional body
- Target platforms: AMD64 and ARM64

## When making changes

- Keep both AMD64 and ARM64 build paths in sync
- Update [CHANGELOG.md](CHANGELOG.md) for user-facing changes
- Run the website build locally before shipping website edits

## Cloud build infrastructure

PAI can be built on dedicated Google Cloud VMs (one amd64, one arm64).
See the operational runbook for recommended zones and machine types.

Full operational runbook — auth, start/stop, resize, rsync-and-build,
publish ISOs to GCS — lives in
[docs/src/ops-cloud-builders.md](docs/src/ops-cloud-builders.md). Read it
before touching the builders in a new session.

## Do not

- Add telemetry or network calls that run without user opt-in
- Rebrand away from "PAI" — the project name is final
- Introduce non-free software into the default image
