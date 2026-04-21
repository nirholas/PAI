# PAI Roadmap

This is the public roadmap for PAI. It is intentionally ambitious: PAI
starts as a bootable live USB and grows into a full, installable
operating system and then a platform for private, local AI.

The roadmap is a direction, not a contract. Scope and dates will shift
as contributors, reality, and priorities evolve. Track open work in the
[GitHub Projects board](https://github.com/nirholas/pai/projects) and
tagged issues (`roadmap:phase-1`, `roadmap:phase-2`, `roadmap:phase-3`).

See also: [CHANGELOG.md](CHANGELOG.md) · [CONTRIBUTING.md](CONTRIBUTING.md) ·
[ETHICS.md](ETHICS.md)

---

## Vision

PAI is the default way to run capable AI privately: on hardware you
own, with no network dependency, no telemetry, no account, and no
lock-in. Over time, PAI becomes:

1. **The best private-AI live USB** — something you can hand to anyone
   and have it work in minutes.
2. **An installable, full operating system** — a first-class
   alternative to Pop!_OS, Fedora, or NixOS for people who want AI
   natively integrated.
3. **A platform for private AI applications** — a stable base that
   developers build AI-native tools on, with a clear SDK and package
   channel.

---

## Phase 1 — Announcement-ready (now → v0.2)

Goal: a polished first impression. Anyone who boots v0.2 should *feel*
the difference between PAI and "Ollama on a USB."

**In progress / planned:**

- [x] First-boot model picker — detects RAM, suggests a model, offers
  one-click download when online
- [x] Opt-in encrypted persistence wizard (LUKS2 + Argon2id)
- [x] Waybar persistence indicator
- [ ] **`pai-status`** — privacy dashboard CLI + Waybar applet:
  Ollama state, loaded model, VRAM/RAM, outbound connections, firewall
  state, one-click privacy-mode toggle
- [ ] **Hardware-aware model recommender** (`scripts/recommend-model.sh`) —
  extract the sizing logic from the picker so other tools can reuse it
- [ ] Unified launcher / home screen — one landing page for Chat,
  Files, Models, Terminal, Docs, Status
- [ ] First-boot polish — welcome screen, guided tour, links to docs
- [ ] ARM64 build job in CI (currently amd64 only)
- [ ] shellcheck + yamllint + website-build validation in CI
- [ ] Build-script deduplication between amd64 and arm64

**Announcement gates:**

- [ ] v0.1.0 booted and demoed on at least 3 real hardware
  configurations (Intel laptop, AMD laptop, ARM64 board)
- [ ] [ROADMAP.md](ROADMAP.md), [ETHICS.md](ETHICS.md), and
  [docs/src/MIGRATION.md](docs/src/MIGRATION.md) published
- [ ] GitHub Projects board live with "good first issue" and
  "help wanted" labels across 10–15 tasks
- [ ] Community channel (Discord / Matrix) linked from README and
  website
- [ ] Demo video showing boot → first-boot wizard → `pai-status` →
  local model usage

---

## Phase 2 — Community & installable OS (months 1–3 post-announce)

Goal: turn motion into momentum. PAI becomes usable as a primary OS,
not just a live USB.

**Core product:**

- [ ] **Local skill/agent runtime** (`pai-agent`) — daemon that
  exposes the [skills/](skills/) and [agents/](agents/) directories
  to Ollama via tool-use API, invocable from OpenWebUI and the
  unified launcher. This is PAI's distinguishing layer.
- [ ] **`pai-install`** — TUI installer for persistent on-disk
  install (debootstrap + PAI overlay). Full-disk LUKS optional.
  Pre-Calamares, intentionally minimal.
- [ ] **`pai-update`** — signed offline update channel. Reads a
  minisign-verified tarball from USB or local path; applies delta.
  Opt-in "check over Tor" path.
- [ ] Voice loop — whisper.cpp (STT) + piper (TTS) wired to the
  launcher and OpenWebUI.

**Community & contribution:**

- [ ] Hardware compatibility list (HCL) — community-tested devices
  with known-good / known-broken status
- [ ] Translation infrastructure — externalise user-visible strings;
  start with en-US as source, accept community translations
- [ ] Contributor onboarding: 30-minute setup guide → first-PR path
- [ ] Weekly or biweekly maintainer office hours
- [ ] Design system doc — color palette, typography, component
  language — before UI PRs start landing from new contributors

**Governance:**

- [ ] MAINTAINERS.md: at least one additional active maintainer
  (three-month contribution track + lazy consensus, per existing
  policy)
- [ ] First community-contributed feature merged
- [ ] First community-contributed ARM64 hardware support PR merged

---

## Phase 3 — Platform (months 4–12)

Goal: PAI stops being "a distro" and starts being "a platform."

**OS trajectory:**

- [ ] **Calamares installer** — full GUI installer for
  out-of-the-box full-disk install with encryption wizard
- [ ] **PAI package overlay** (`packages.pai.direct`) — apt repo with
  PAI-specific packages layered on top of Debian stable
- [ ] Signed OS updates over Tor (opt-in) as a supplement to
  offline update channel
- [ ] Hardware support expansion: NVIDIA/AMD GPU passthrough,
  NPU detection (Intel/Qualcomm), Apple Silicon via Asahi

**App ecosystem:**

- [ ] **PAI app format** — define what a "PAI app" is (sandboxed,
  declares model requirements, declares network policy,
  declares skill dependencies)
- [ ] **PAI Developer SDK** — libraries and CLI for building apps
  that use local Ollama + PAI skills natively
- [ ] Developer portal + docs site for app authors
- [ ] First five first-party PAI apps (notes, research assistant,
  terminal assistant, voice memos, code helper)

---

## Phase 4 — Ecosystem (year 2+)

Goal: PAI is a credible base for derivatives and certified hardware.

- [ ] "PAI Certified" program for laptops / devices shipping with
  verified hardware support out of the box
- [ ] Derivative editions (AI-native security distro, AI-native
  creative workstation, airgapped enterprise edition)
- [ ] PAI Foundation / governance model if community is large enough
  to warrant formal structure
- [ ] Federated model / skill sharing (still offline-first, but
  optional trusted-peer sync)

---

## Principles that do not change across phases

1. **No telemetry. Ever.** Not "anonymous." Not "opt-in by default."
   Not "just for debugging." The answer is no.
2. **Offline-first.** Every new feature must work with zero network.
   Network is an optional enhancement, not a requirement.
3. **GPLv3 stays.** No enterprise edition that removes privacy
   features behind a paywall.
4. **User owns the stack.** No account system. No remote kill switch.
   No phone-home updater.
5. **Honest threat model.** We document where PAI fails as clearly as
   where it succeeds. See [SECURITY.md § Known weaknesses](SECURITY.md#known-weaknesses).

---

## How to contribute to the roadmap

- **Comment on existing roadmap issues** — add use-cases, constraints,
  or implementation notes
- **Open a "Roadmap suggestion" issue** (template in
  `.github/ISSUE_TEMPLATE/`) — propose something new, with the
  phase you think it belongs in and why
- **Just build it** — roadmap items without an owner are up for
  grabs. Post in the issue to claim one before starting.

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch, commit, and PR
conventions.

---

*Last reviewed: 2026-04-20.*
