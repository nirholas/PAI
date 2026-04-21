---
title: Skills
---



Skills are packaged, reusable capabilities that AI agents in PAI can
invoke on a user's behalf. Each skill is a small directory containing a
`SKILL.md` file that declares what the skill does, when it should be
triggered, what inputs it expects, and the exact instructions an agent
should follow when using it.

Examples of PAI skills include:

- `flash-usb` — prepare a bootable USB drive with the latest PAI ISO.
- `audit-persistence` — inspect system services for unexpected
  persistence mechanisms.
- `generate-release-notes` — produce release notes from a git range.

## Why PAI has skills

PAI is an agent-forward project. Without a shared convention, every
agent would reinvent how it performs common tasks, and users would have
no way to review what an agent is actually going to do. Skills give us:

- **Reviewability** — a skill's behavior is declared in a file, not
  hidden in a prompt. Contributors can read it and comment in a PR.
- **Testability** — skills have examples and guardrails, so they can be
  exercised and validated.
- **Scope** — a skill declares its inputs, outputs, and constraints, so
  an agent cannot silently broaden what it does.

See also: [AGENTS.md](AGENTS.md) for how agents discover and run skills,
and [TOOLS.md](TOOLS.md) for the lower-level tools skills are composed
from.

## Directory layout

```
/skills/
  SKILL.md                    # root index (this catalog, machine-readable)
  <skill-name>/
    SKILL.md                  # required — metadata + instructions
    README.md                 # optional — long-form human docs
    examples/                 # optional — sample inputs/outputs
    scripts/                  # optional — helper scripts the skill calls
```

Skill names are kebab-case, lowercase, and describe a single capability.

## Catalog

| Name | Description | Status | Link |
| ---- | ----------- | ------ | ---- |
| `example-tool` | Template skill demonstrating the PAI `SKILL.md` format. | stable | [skills/example-tool/SKILL.md](skills/example-tool/SKILL.md) |

The machine-readable index lives at
[skills/SKILL.md](skills/SKILL.md) and is what agents scan at session
start.

## Authoring a new skill

1. Copy [skills/example-tool/](skills/example-tool/) to
   `skills/<your-skill-name>/`.
2. Update the YAML frontmatter in `SKILL.md`: `name`, `description`,
   `version`, `triggers`, `inputs`, `outputs`, `constraints`, `examples`.
3. Rewrite the body sections (Purpose, Instructions, Guardrails, Example
   session, Testing, Changelog) for your skill.
4. Add a row to the catalog table above and to
   [skills/SKILL.md](skills/SKILL.md).
5. Open a PR. Reviewers will check that the frontmatter is complete and
   that the guardrails are appropriate for what the skill does.

## Validation

A future `scripts/validate-skills.sh` will lint every
`skills/*/SKILL.md` to verify:

- YAML frontmatter parses and contains all required keys.
- `name` matches the directory name.
- `version` is a valid semver string.
- `triggers`, `inputs`, `examples` are non-empty.
- The body contains the required section headers.

Until that script lands, reviewers check these by hand.
