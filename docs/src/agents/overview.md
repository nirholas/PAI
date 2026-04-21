---
title: Agents overview
description: How PAI structures agent instructions, personas, and skills for AI coding assistants and human contributors.
---

# Agents overview

This page is for users, contributors, and AI coding assistants (Claude,
Cursor, Copilot, custom harnesses) that use or extend PAI's agent
ecosystem.

It summarizes how PAI organises agent-facing instructions and points
into the authoritative root files. It does not duplicate them — when in
doubt, the root files win.

## Agent vs skill

- An **agent** is a role persona: a set of instructions describing who
  the caller is acting as (generalist contributor, docs writer, test
  engineer). Agents define voice, scope, hard rules, and acceptance
  checks for a class of work.
- A **skill** is a packaged capability: a small, declarative recipe in
  [`/skills/<name>/SKILL.md`](../../skills/) that tells an agent how to
  perform a specific task (e.g. flash a USB, generate release notes).
  Skills declare triggers, inputs, outputs, and guardrails.

An agent **is**; a skill **does**.

## The three layers

PAI's agent-facing guidance is layered. Each layer narrows scope and
overrides the one above it.

1. **Project-wide rules** — [`/AGENTS.md`](../../AGENTS.md) and
   [`/CLAUDE.md`](../../CLAUDE.md). Apply to every agent and every
   contributor, human or otherwise. Brand, security, commit hygiene.
2. **Role personas** — [`/agents/*-agent.md`](../../agents/). Inherit
   from `AGENTS.md` and specialise for one role (docs, tests, etc.).
   Add scope boundaries and role-specific acceptance checks.
3. **Skills** — [`/skills/<name>/SKILL.md`](../../skills/). Invoked by
   an agent to carry out a concrete task. The narrowest and most
   reviewable layer.

## Typical session start

An agent session in PAI usually starts like this:

1. Read [`/AGENTS.md`](../../AGENTS.md) for project-wide rules.
2. Load the matching persona from
   [`/agents/`](../../agents/) — default is
   [`agent.md`](../../agents/agent.md), specialise to `docs-agent.md` or
   `test-agent.md` when the task fits.
3. Scan the [skill catalog](./skill-catalog.md) to see if any packaged
   skill matches the request.
4. Do the work, honouring the strictest layer that applies.

## Security model

Agents run with **user privileges**. They do not get elevated access,
secret keys, or bypass paths. An agent editing the PAI repo is bound by
the same constraints as a human contributor:

- No committing secrets.
- No force-push on shared branches.
- No skipping hooks or commit signing (`--no-verify`, `--no-gpg-sign`).
- No telemetry, analytics, or phone-home code.

If a task would require elevated access, the agent must stop and ask.
See the "Hard rules" section in
[`/agents/agent.md`](../../agents/agent.md) for the full list.

## Related reading

- [`/AGENTS.md`](../../AGENTS.md) — project-wide rules.
- [`/agents/agent.md`](../../agents/agent.md) — base persona.
- [`/SKILLS.md`](../../SKILLS.md) — skills concept and root catalog.
- [`/TOOLS.md`](../TOOLS.md) — lower-level tools skills build on.
- [Agent registry](./agent-registry.md) — every persona that exists.
- [Skill catalog](./skill-catalog.md) — every skill that exists.
