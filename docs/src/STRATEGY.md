# Strategy

> Related: [VISION.md](VISION.md) · [ROADMAP.md](roadmap.md) · [CHANGELOG.md](CHANGELOG.md)

How the vision becomes real, given that we are small, volunteer-run,
and resource-constrained.

## 1. Operating principles

- **The default boot path is sacred.** Every feature is judged by
  whether it helps or hurts a first-time user who just flashed an image
  and pressed power. Everything else is optional.
- **Fewer, better tools beat more tools.** We would rather ship one
  model manager that works than three that sort of work.
- **Reproducibility beats convenience.** A build that anyone can
  reproduce from source is worth a slower release cycle.
- **Boring technology by default.** Debian stable, well-known
  cryptography, standard filesystems. Novelty is a cost, paid only when
  it buys something the user can feel.
- **Offline is the test.** If a feature degrades meaningfully without
  a network, it does not belong in the default image.
- **Security is a property, not a feature.** Signed releases,
  reproducible builds, and audited update paths are non-negotiable.

## 2. Three-horizon plan

### H1 — now → 6 months

Goal: a stick you can hand to a stranger.

- Stable public ISO on both `amd64` and `arm64`.
- Signed releases with documented verification flow.
- Documentation complete for install, first boot, model download,
  recovery, and wipe.
- Measurable: install base > 10,000 verified downloads; median
  first-boot-to-first-prompt under 10 minutes on reference hardware.
- Zero known critical CVEs at release time.

### H2 — 6 → 18 months

Goal: a platform others can build on.

- First-party skill / agent ecosystem with a stable contract and
  signed skill packages.
- Model manager with a curated, verified model catalog (hash-pinned,
  licence-tagged).
- Graphical wallet UX for on-device key management.
- Community governance maturation: documented maintainer ladder, ADR
  process in steady use, security response playbook exercised at
  least once.
- Measurable: 25+ third-party skills published; < 48h median triage
  time on security reports.

### H3 — 18+ months

Goal: a category, not a project.

- Dedicated low-cost PAI hardware reference design (open schematic,
  commodity parts, target BOM under $100).
- Offline model-update distribution (sneakernet-friendly signed
  bundles for regions with poor connectivity).
- i18n across UI and documentation; accessibility audit passed.
- Plug-in ecosystem for peripherals (hardware tokens, cameras,
  sensors) with a stable ABI.

## 3. Resource model

- **People.** Volunteer maintainers. A documented ladder from
  contributor to maintainer. Succession is planned, not assumed.
- **Money.** Optional sponsorships and donations, disclosed publicly.
  Funds go, in priority order, to: (1) infrastructure (build, signing,
  mirrors), (2) security audits, (3) hardware for testing and CI.
  **Not** marketing, **not** conference junkets, **not** salaries
  without a community vote.
- **No VC.** Equity investment is incompatible with the mission.

## 4. Partnerships we seek

- Journalism organisations who issue field devices to reporters.
- Digital-rights NGOs (EFF, Privacy International, local equivalents).
- Universities, especially for independent security review and
  usability research.
- Privacy-respecting hardware vendors willing to ship reference
  hardware without bundled spyware.

We do not seek partnerships with entities whose business model depends
on collecting user data, regardless of brand or budget.

## 5. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Upstream Debian diverges or slows | Pin to stable; document the minimal patch set; be prepared to track a different base (e.g. a reproducible-Debian derivative) if required. |
| Ollama (or any single inference runtime) loses momentum | Keep the model-runner boundary abstract; support at least one alternative runtime in tree. |
| Legal pressure in certain jurisdictions | Distribute through multiple mirrors; keep builds reproducible so any party can verify and rehost; document the build from source path so the project survives takedowns. |
| Maintainer burnout | Ladder + succession plan; hard cap on on-call expectations; fund audits so volunteers are not the last line of defence. |
| Model licence drift (weights relicensed or withdrawn) | Catalog is hash-pinned; licences recorded at inclusion time; users can continue using what they have even if upstream changes terms. |
| Supply-chain attack on build infra | Reproducible builds; multi-party signing for releases; at least two independent mirrors. |

## 6. How to change this document

Material changes go through an ADR (Architecture Decision Record) in
`docs/adr/`. Open a PR with the ADR and the proposed diff to this
file. Merge requires two maintainer approvals and a 7-day comment
window. Minor edits (typos, link fixes) may be merged normally.
