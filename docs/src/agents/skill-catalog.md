---
title: Skill catalog
description: Every skill under /skills/ with when-to-invoke and when-not-to-invoke guidance, plus authoring instructions.
---

# Skill catalog

A **skill** is a packaged, declarative capability an agent can invoke
on behalf of a user. The authoritative list is the root
[`/SKILLS.md`](../../SKILLS.md) catalog and the machine-readable index
at [`/skills/SKILL.md`](../../skills/SKILL.md). This page is for
readers browsing the docs site and adds richer "when to use" guidance.

See [Agents overview](./overview.md) for how skills relate to personas.

## Catalog

| Name | Description | Maturity | Link |
| ---- | ----------- | -------- | ---- |
| `example-tool` | Template skill demonstrating the PAI `SKILL.md` format. | stable | [/skills/example-tool/SKILL.md](../../skills/example-tool/SKILL.md) |

### `example-tool`

A reference implementation of the PAI `SKILL.md` convention. Copy this
directory as a starting point for any new skill. It is not intended to
do useful work on its own — its value is that every field is populated
and every required section exists.

- **Inputs**:
  - `target_name` (string, required) — kebab-case name of the new
    skill; must not already exist under `/skills/`.
- **Outputs**:
  - A new directory under `/skills/<target_name>/` with a populated
    `SKILL.md`.
  - A new row in [`/SKILLS.md`](../../SKILLS.md) and
    [`/skills/SKILL.md`](../../skills/SKILL.md).
- **When to invoke**:
  - The user asks to create a new skill.
  - An agent needs a known-good template to copy.
  - A contributor is scaffolding a skill as part of a larger PR and
    wants the frontmatter and section layout pre-populated.
- **When NOT to invoke**:
  - The task is a one-off shell command or a plain code edit — no
    skill is warranted.
  - A skill with the same capability already exists; extend it
    instead of forking.
  - The proposed `target_name` collides with an existing directory
    under `/skills/`.
  - The caller cannot clearly describe triggers, inputs, outputs, and
    guardrails yet. Write those down first; then scaffold.
- **Full spec**:
  [/skills/example-tool/SKILL.md](../../skills/example-tool/SKILL.md)

## Authoring new skills

Step-by-step. `/skills/example-tool/` is the template.

1. **Copy the template**: `cp -r skills/example-tool skills/<your-skill-name>/`.
   Names are kebab-case, lowercase, and describe a single capability.
2. **Update the YAML frontmatter** in the new `SKILL.md`:
   - Set `name` to `<your-skill-name>` (must match the directory).
   - Reset `version` to `0.1.0`.
   - Rewrite `description`, `triggers`, `inputs`, `outputs`,
     `constraints`, and `examples` for the new skill.
3. **Rewrite the body sections**: Purpose, Instructions, Guardrails,
   Example session, Testing, Changelog. Do not leave template text.
4. **Register** the skill by adding a row to both catalogs:
   - [`/SKILLS.md`](../../SKILLS.md) — human-readable.
   - [`/skills/SKILL.md`](../../skills/SKILL.md) — machine-readable.
   - This page — add a row to the table above and a section with
     inputs, outputs, and when/when-not-to-invoke lists.
5. **Validate**: run `scripts/validate-skills.sh` if it exists. Until
   it lands, reviewers check frontmatter and section headers by hand.
6. **Open a PR**. Reviewers check frontmatter completeness and that
   the guardrails are appropriate for the skill's blast radius.

## Skill maturity levels

Every skill declares a maturity level. The level sets expectations for
stability, not quality — an `experimental` skill can be well-written
and a `stable` skill can still have bugs.

- **`experimental`** — newly added. API and behavior may change
  without notice.
  - Acceptance: frontmatter parses; body has the required sections;
    at least one worked example.
- **`beta`** — API is mostly stable; known callers exist.
  - Acceptance: all `experimental` criteria, plus a test or manual
    test plan; any breaking change is called out in the changelog.
- **`stable`** — API is stable; breaking changes require a major
  version bump and a migration note.
  - Acceptance: all `beta` criteria, plus passing validation (when
    `scripts/validate-skills.sh` exists), at least one non-template
    caller, and guardrails reviewed for blast radius.
- **`deprecated`** — scheduled for removal.
  - Acceptance: `description` starts with `DEPRECATED:` and names the
    replacement skill (if any); removal date recorded in the
    changelog; catalog entries still present until removal.

Promote a skill by opening a PR that updates the maturity field in the
frontmatter, the row in [`/SKILLS.md`](../../SKILLS.md), and the row
on this page. Demotions (including to `deprecated`) follow the same
process.
