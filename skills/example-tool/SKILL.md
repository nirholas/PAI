---
name: example-tool
description: A template skill demonstrating the PAI SKILL.md format.
version: 0.1.0
triggers:
  - when the user asks how to author a new skill
  - when an agent needs a template to copy
inputs:
  - name: target_name
    type: string
    required: true
    description: kebab-case name of the new skill
outputs:
  - a new directory under /skills/ with a populated SKILL.md
constraints:
  - must not commit secrets
  - must pass scripts/validate-skills.sh
examples:
  - prompt: "Create a skill that flashes a USB with the latest ISO"
    expected: "/skills/flash-usb/ with SKILL.md filled in"
---

# example-tool

A reference implementation of the PAI `SKILL.md` convention. Copy this
directory as a starting point for any new skill.

Related docs: [../../SKILLS.md](../../SKILLS.md),
[../SKILL.md](../SKILL.md), [../../AGENTS.md](../../AGENTS.md),
[../../TOOLS.md](../../TOOLS.md).

## 1. Purpose

`example-tool` exists so that contributors and agents have a known-good
template to copy when creating a new PAI skill. It is not intended to
perform useful work on its own — its value is that every field is
populated, every required section exists, and the structure is easy to
adapt.

## 2. Instructions

When this skill is triggered, the agent should:

1. Ask the user for `target_name` if it was not provided. The name must
   be kebab-case, lowercase, and not already present under `/skills/`.
2. Create the directory `/skills/<target_name>/`.
3. Copy `/skills/example-tool/SKILL.md` to
   `/skills/<target_name>/SKILL.md`.
4. Update the YAML frontmatter in the new file:
   - Set `name` to `<target_name>`.
   - Rewrite `description`, `triggers`, `inputs`, `outputs`,
     `constraints`, and `examples` for the new skill.
   - Reset `version` to `0.1.0`.
5. Rewrite the body sections (Purpose, Instructions, Guardrails,
   Example session, Testing, Changelog) to describe the new skill.
6. Add a row for the new skill to the catalog table in
   [../../SKILLS.md](../../SKILLS.md) and
   [../SKILL.md](../SKILL.md).
7. Run `scripts/validate-skills.sh` if it exists; otherwise prompt the
   reviewer to validate by hand.
8. Open a pull request.

## 3. Guardrails

The agent MUST NOT:

- Overwrite an existing skill directory without explicit user approval.
- Commit credentials, API tokens, or any file listed in `.gitignore`.
- Declare triggers so broad that the skill would activate for unrelated
  requests (e.g., `"any request"`).
- Skip the catalog update in [../../SKILLS.md](../../SKILLS.md) — a
  skill that is not in the catalog is effectively invisible.
- Increase `version` beyond `0.1.0` on initial creation.

## 4. Example session

```
User:  I want to add a skill that generates release notes from a git range.
Agent: I'll use example-tool as a template. Skill name: generate-release-notes?
User:  Yes.
Agent: Created /skills/generate-release-notes/SKILL.md from the template,
       updated frontmatter (name, triggers, inputs for git_range), rewrote
       the body, and added a row to SKILLS.md and skills/SKILL.md.
       Ready for review.
```

## 5. Testing this skill

Manual-test steps:

1. From a clean checkout, invoke the skill with `target_name=test-skill`.
2. Verify `/skills/test-skill/SKILL.md` exists and its frontmatter
   `name` is `test-skill`.
3. Verify new rows appear in both [../../SKILLS.md](../../SKILLS.md)
   and [../SKILL.md](../SKILL.md).
4. Run `scripts/validate-skills.sh` (if present) and confirm exit 0.
5. `git status` should show only the new skill directory and the two
   catalog edits — nothing else.
6. Revert the test changes before committing.

## 6. Changelog

- `0.1.0` — Initial template skill.
