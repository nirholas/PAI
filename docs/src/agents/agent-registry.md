---
title: Agent registry
description: Index of every role persona under /agents/ with status, model hints, and a short role summary.
---

# Agent registry

Every file under [`/agents/`](../../agents/) defines a role persona. This
page lists them. The persona files themselves are authoritative; this
page is a pointer.

See [Agents overview](./overview.md) for how personas fit alongside
project-wide rules and skills.

## Registry

| File | Role | Model hint | Status | Link |
| ---- | ---- | ---------- | ------ | ---- |
| `agent.md` | Base persona — generalist contributor | any | stable | [/agents/agent.md](../../agents/agent.md) |
| `docs-agent.md` | Documentation writer and maintainer | any | stable | [/agents/docs-agent.md](../../agents/docs-agent.md) |
| `test-agent.md` | Test designer, author, and runner | any | stable | [/agents/test-agent.md](../../agents/test-agent.md) |

`Model hint` reflects the `model:` field in each file's frontmatter.
`any` means the persona is not tuned for a specific model family.

## Personas

### `agent.md` — base persona

A generalist contributor to PAI. Reads code before editing, makes small
surgical changes, and leaves the repo in a state another contributor
can pick up. All other personas inherit from this file and so inherit
its hard rules (brand, secrets, no-telemetry, no force-push, no
hook-skipping).

### `docs-agent.md` — documentation

Writes and maintains PAI's documentation so a new contributor can land
in the repo and understand what PAI is, how to build it, and how to
contribute — without reading the source. Owns `/README.md`, `/docs/**`,
`/prompts/documentation/**`, and root-level `*.md` files. Enforces a
style guide (sentence-case headings, no emoji, Oxford commas, active
voice, 80-column wrap) and a banned-adjective list.

### `test-agent.md` — tests and CI

Designs, writes, and runs tests across five layers: build smoke, boot,
unit, integration, and security. Treats a failing test as information,
not an obstacle — fixes go in the code, not in the assertion. Owns the
flaky-test policy (immediate quarantine, 14-day SLA) and the CI
boundaries (headless, no network by default, under 30 minutes,
deterministic, idempotent).

## How agents are invoked

PAI does **not** ship a runtime that launches personas. Invocation is
up to the calling agent host — Claude Code, Cursor, a custom harness,
or a human reading the file. PAI just provides the instructions.

A typical host flow:

1. Host reads [`/AGENTS.md`](../../AGENTS.md) for project-wide rules.
2. Host picks the persona under [`/agents/`](../../agents/) that best
   matches the task (or defaults to `agent.md`).
3. Host concatenates, or otherwise composes, those instructions into
   its system prompt.
4. The agent proceeds, consulting the [skill catalog](./skill-catalog.md)
   when a packaged capability fits.

## Proposing a new persona

To add a role persona:

1. Copy [`/agents/agent.md`](../../agents/agent.md) to
   `/agents/<role>-agent.md`. Kebab-case, lowercase, `-agent` suffix.
2. Set frontmatter:
   ```yaml
   ---
   name: <role>-agent
   inherits: /agents/agent.md
   model: any
   ---
   ```
   Required fields: `name`, `inherits`, `model`.
3. Keep the section numbering from `agent.md`. Override sections as
   needed; do not delete them silently.
4. Add a **Scope** section listing the paths the role owns.
5. Add an **Acceptance checks** section with concrete, runnable checks.
6. Link back to [`/AGENTS.md`](../../AGENTS.md) and to sibling
   personas.
7. Add a row to the registry table on this page.
8. Open a PR. Reviewers will check that the persona does not overlap
   another role's scope and that its acceptance checks are executable.
