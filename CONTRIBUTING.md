# Contributing to PAI

Thanks for wanting to improve PAI. This guide covers everything from filing
a bug to landing a build-script change. Please read it before opening a PR.

---

## 1. Before You Start

1. Read [`docs/src/agents/overview.md`](docs/src/agents/overview.md) for AI-agent
   conventions used in this repo.
2. Read [`docs/src/architecture/overview.md`](docs/src/architecture/overview.md) to understand
   how the live-image is assembled.
3. Read [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) — it applies to all
   spaces under this project.
4. Search [open issues](https://github.com/nirholas/pai/issues) for a
   duplicate before filing a new one.

---

## 2. Ways to Contribute

| What | How |
|---|---|
| Bug reports | Open an issue with the `bug` template |
| Build-script improvements | PR against `config/hooks/live/` or `arm64/chroot-steps/` |
| New pre-installed apps | See §8 below |
| Documentation | Edits to `docs/`, `README.md`, or this file |
| Website | Changes under `website/` |
| Translations | Open an issue first to coordinate locale files |
| Funding | See [`governance.md`](docs/src/governance.md) §7 |
| Spreading the word | Star the repo, write a blog post, tell a friend |

---

## 3. Dev Environment Setup

**Required OS:** Debian 12 (Bookworm) or Ubuntu 22.04+.

```bash
# Core build dependencies
sudo apt-get install -y \
  debootstrap live-build squashfs-tools xorriso \
  grub-pc-bin grub-efi-amd64-bin syslinux \
  shellcheck git

# Docker (for reproducible builds — strongly recommended)
# Follow the official Docker install guide for your distro, then:
sudo usermod -aG docker $USER
```

Build instructions:

- **AMD64**: [`docs/src/advanced/building-from-source.md`](docs/src/advanced/building-from-source.md)
- **ARM64**: [`arm64/README.md`](arm64/README.md)

> **Tip:** Use the Docker build path (`Dockerfile.build`) when you need
> byte-for-byte reproducibility. The host-native path is faster for quick
> iteration.

---

## 4. Branching Model

| Branch prefix | Purpose |
|---|---|
| `main` | Always release-ready. No direct pushes. |
| `feat/<kebab-name>` | New feature or pre-installed app |
| `fix/<kebab-name>` | Bug fix |
| `docs/<kebab-name>` | Documentation-only change |
| `chore/<kebab-name>` | Dependency bumps, CI, tooling |

Branch off `main`, keep branches short-lived, rebase before opening a PR.

---

## 5. Commit Style

PAI uses [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(<optional scope>): <imperative summary under 72 chars>

[optional body — wrap at 72 chars]

Fixes #123
```

**Types:** `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `build`

**Rules:**
- Imperative mood: "add X", not "added X" or "adds X".
- Reference issue numbers in the footer (`Fixes #N`, `Refs #N`).
- One logical change per commit; squash "wip" commits before opening a PR.

---

## 6. Pull Request Checklist

Before marking a PR ready for review, confirm:

- [ ] Single, focused change — unrelated fixes go in separate PRs
- [ ] Manual-test notes included (what you booted, what you verified)
- [ ] Docs updated if behaviour changed
- [ ] No generated artifacts committed (ISOs, squashfs images, `*.iso`,
      `output/`)
- [ ] `shellcheck` passes on any modified scripts
- [ ] CI is green

Fill in the PR description template. A good description saves review
round-trips.

---

## 7. Build-Script Hygiene

All shell scripts must follow these rules:

```bash
#!/usr/bin/env bash
set -euo pipefail
```

- **ShellCheck clean:** run `shellcheck <script>` before committing.
- **No unchecked network calls:** if a script downloads anything, verify
  with a checksum (sha256sum or gpg signature).
- **Idempotent where possible:** re-running the script on an already-built
  chroot should not error or produce duplicate entries.
- **No hardcoded paths** outside of well-known Debian FHS locations.
- Use `apt-get` (not `apt`) in chroot scripts for stable, scriptable output.

---

## 8. Adding a Pre-Installed App

Every new app needs two things:

### 8a. A prompt doc

Create `prompts/NN-<app-name>.md` (where `NN` is the next available number):

```markdown
# NN — <App Name>

## Purpose
One sentence on why this app belongs in PAI.

## Package / source
- apt: `package-name`  OR  upstream URL + checksum

## Chroot hook
`arm64/chroot-steps/NN-<app-name>.sh`

## AMD64 hook
`config/hooks/live/NN-<app-name>.sh`

## Verification
How to confirm the app works after boot.
```

### 8b. A chroot/hook script

**Template (`arm64/chroot-steps/NN-<app>.sh`):**

```bash
#!/usr/bin/env bash
set -euo pipefail

# Install <app>
apt-get install -y --no-install-recommends <package>

# Post-install configuration (if any)
```

Mirror the same logic in `config/hooks/live/NN-<app>.sh` for the AMD64
live-build path.

**Checklist for new apps:**
- [ ] Package verified against Debian repos or upstream with checksum
- [ ] App launches without network access (offline-first)
- [ ] No autostart daemons added without explicit user opt-in
- [ ] Privacy implications documented in the prompt doc

---

## 9. Reviewing Others' PRs

Maintainers and contributors are both welcome to review. When you do:

- **Be specific.** "This will fail if the chroot is non-standard" is useful;
  "this looks wrong" is not.
- **Distinguish blocking from non-blocking.** Prefix suggestions with
  `nit:` if they are style preferences, not correctness issues.
- **Test when you can.** A review that includes "tested on X hardware/QEMU"
  carries more weight.
- **Be kind.** Assume good faith. People contributing their time deserve
  respectful feedback.

Approve only when you are genuinely satisfied. "LGTM" without reading the
diff is worse than no review.

---

## 10. Release Cadence

See [`docs/src/RELEASE.md`](docs/src/RELEASE.md) for versioning policy and
release checklist. Releases follow a roughly quarterly cadence unless a
critical security fix warrants an out-of-band patch.

---

*Questions? Open an issue or ping [@nirholas](https://github.com/nirholas)
in a discussion.*
