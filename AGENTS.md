# AGENTS.md

Operating notes for AI coding agents (Claude Code, Codex, Cursor, Copilot and others) working in this repository. Everything here is derived from the files actually in the tree, so trust it over guesses, and update it when the facts change.

## What this repository is

A complete private computer on a USB stick. PAI is a bootable Debian 12 Linux distro that runs Ollama locally on any x86_64 or ARM64 machine - full desktop, local AI, hardened networking, all in RAM. Plug in, boot in seconds, work anywhere, pull the stick and nothing stays behind. Your AI on your hardware, no cloud, no accounts. https://pai.direct

- Homepage: https://pai.direct
- Source: https://github.com/nirholas/PAI
- Primary language: Shell
- License: Other (see the LICENSE file)

## Repository layout

- `agents/`
- `arm64/`
- `aur-templates/`
- `branding/`
- `bucket-templates/`
- `config/`
- `desktop/`
- `docs/`
- `scripts/`
- `shared/`
- `skills/`
- `tap-templates/`
- `web/`
- `website/`
- `README.md`
- `LICENSE`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `CHANGELOG.md`
- `CLAUDE.md`

## Setup

No package manifest is checked in. Follow the installation steps in `README.md`.

## Commands

No build, test or lint scripts are declared in the tree. Verify changes by running the project as `README.md` describes.

## Conventions

- Read `CONTRIBUTING.md` before opening a pull request.
- User-visible changes get an entry in `CHANGELOG.md`.
- `CLAUDE.md` holds additional, more detailed operating rules; it takes precedence where the two overlap.
- Read the surrounding code before adding to it, and match its naming, file organisation and error-handling style.
- Keep `README.md` accurate: if a change alters behaviour, commands or configuration, update the docs in the same commit.
- Do not leave TODO comments, stub functions, placeholder data or commented-out code behind. Finish what you start or leave it out.
- Small, focused commits with a subject line that describes the change, not the act of committing.

## Where to raise things

- Bugs and feature requests: https://github.com/nirholas/PAI/issues
- Questions and ideas: https://github.com/nirholas/PAI/discussions
- Security issues: follow `SECURITY.md`, never a public issue.
