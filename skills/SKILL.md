---
name: pai-skills-root
description: Index of all PAI skills.
version: 0.1.0
---

# PAI Skills — Root Index

This file is the machine-readable index of every skill shipped in PAI.
Agents scan `/skills/*/SKILL.md` at session start and use this file as
the canonical list of what is available.

For the human-facing overview of the skill convention, see
[../SKILLS.md](../SKILLS.md). For how agents consume skills, see
[../AGENTS.md](../AGENTS.md). For the underlying primitives skills are
built from, see [../TOOLS.md](../TOOLS.md).

## Catalog

| Name | Description | Status | Link |
| ---- | ----------- | ------ | ---- |
| `example-tool` | Template skill demonstrating the PAI `SKILL.md` format. | stable | [example-tool/SKILL.md](example-tool/SKILL.md) |

## How skills are discovered by agents

At session start, an agent should:

1. Enumerate every `SKILL.md` under `/skills/` (excluding this root
   index itself).
2. Parse the YAML frontmatter of each file.
3. Build an in-memory registry keyed by `name`, with `triggers` used to
   match user intent.
4. When a user request matches one or more triggers, the agent loads
   the full `SKILL.md` body and follows its instructions.

Agents MUST NOT invoke a skill whose `SKILL.md` failed to parse or
whose frontmatter is incomplete. Report the problem to the user
instead.
