---
title: Roadmap
---



> Related: [VISION.md](VISION.md) · [STRATEGY.md](STRATEGY.md) · [CHANGELOG.md](CHANGELOG.md)

## 1. Legend

- `[shipped]` — released and available in a tagged version.
- `[in-progress]` — actively being worked on for the current milestone.
- `[planned]` — committed to a specific upcoming milestone.
- `[considering]` — on the table, not yet committed.

Status here reflects intent, not completion. Shipped items live in
[CHANGELOG.md](CHANGELOG.md).

## 2. Current milestone — v0.2.0

- `[in-progress]` Stable public ISO for `amd64` and `arm64` with parity
  of hooks and first-boot behaviour.
- `[in-progress]` Signed releases and documented verification flow
  (checksums, signing key fingerprints, rehosting instructions).
- `[planned]` First-boot wizard: locale, keymap, model selection,
  persistence decision.
- `[planned]` Documentation pass: install, first boot, model download,
  recovery, wipe, troubleshooting.
- `[planned]` Reproducible build pipeline, documented end to end.
- `[planned]` Security response playbook published (SECURITY.md
  referenced, escalation path defined).
- `[planned]` Baseline telemetry audit: confirm and document that no
  outbound connections occur on default boot.

## 3. Next milestone — v0.3.0

- `[planned]` Model manager with a hash-pinned, licence-tagged
  catalog.
- `[planned]` Skill/agent contract v1 with signed skill packages.
- `[planned]` Graphical wallet UX for on-device key management.
- `[planned]` Governance maturation: documented maintainer ladder,
  ADR index, first post-mortem template.
- `[considering]` Secondary inference runtime in tree, behind a
  runtime-selection flag.
- `[considering]` Encrypted persistence volume with a documented
  key-recovery story.

## 4. Longer-term — unversioned

### Skill ecosystem
- `[considering]` Third-party skill registry with signed publishing.
- `[considering]` Sandbox model for skills (capability-scoped).
- `[considering]` Skill review guidelines and a reviewer rotation.

### Hardware
- `[considering]` Low-cost PAI hardware reference design (open
  schematic, BOM target under $100).
- `[considering]` Validated compatibility list for commodity SBCs and
  laptops.
- `[considering]` Hardware token integration (FIDO2, smartcards) for
  on-device key storage.

### i18n
- `[considering]` UI string extraction and translation workflow.
- `[considering]` Priority locales driven by contributor interest,
  not market size.

### Accessibility
- `[considering]` Screen-reader support in the first-boot wizard.
- `[considering]` High-contrast and large-text defaults selectable
  at first boot.
- `[considering]` Formal accessibility audit before v1.0.

### Enterprise hardening
- `[considering]` Fleet-friendly image customisation (without adding
  telemetry).
- `[considering]` Air-gapped update bundles for regulated
  environments.
- `[considering]` Third-party security audit, results published in
  full.

## 5. Won't-do list

These are explicit anti-features. They will not be added, regardless
of demand or funding.

- Telemetry of any kind, including "anonymised" or "opt-out".
- Cloud sync enabled by default. Sync, if it exists, is user-driven,
  user-hosted, and off unless configured.
- Paid tiers gating core functionality.
- Mandatory accounts or online activation.
- Third-party advertising, tracking pixels, or analytics SDKs.
- Bundled proprietary binaries without source and a reproducible
  build path.
- "Lawful access" hooks, key escrow, or backdoors by any other name.

## 6. How this roadmap is updated

- Reviewed at every release. Items shipped move to
  [CHANGELOG.md](CHANGELOG.md); items slipped are re-dated with a
  note.
- Adjusted between releases via PR to this file. Non-trivial
  additions or removals require maintainer review, per the process
  in [STRATEGY.md](STRATEGY.md#6-how-to-change-this-document).
- Community proposals welcome as issues labelled `roadmap`.
