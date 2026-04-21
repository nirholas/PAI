---
title: Testing
description: What runs where — local, CI, and manual tests for PAI.
audience: contributors
last_reviewed: 2026-04-17
---

# Testing

PAI has three tiers of tests: **local** (seconds), **CI** (minutes to an
hour), and **manual** (a human with hardware before a release tag). Know
which tier you're in before you start debugging a red check.

## 1. Test matrix

| PR touches              | ShellCheck | markdownlint | bats unit | QEMU boot | Hardware smoke |
|-------------------------|:----------:|:------------:|:---------:|:---------:|:--------------:|
| `*.md` only             | –          | ✅           | –         | –         | –              |
| `website/` only         | –          | ✅           | –         | –         | –              |
| `scripts/` or `*.sh`    | ✅         | –            | ✅        | ✅ (amd64)| –              |
| `scripts/chroot/*`      | ✅         | –            | ✅        | ✅ (both) | –              |
| `arm64/`                | ✅         | –            | ✅        | ✅ (arm64)| –              |
| Kernel / initramfs      | ✅         | –            | ✅        | ✅ (both) | ✅ (release)   |
| Release tag             | ✅         | ✅           | ✅        | ✅ (both) | ✅             |

Docs-only PRs deliberately skip the heavy matrix — the `paths-filter`
step in CI routes them.

## 2. Running tests locally

```bash
# Shell
shellcheck $(git ls-files '*.sh')

# Docs
npx markdownlint-cli '**/*.md' --ignore node_modules --ignore website

# Bats
bats tests/

# Link checker (docs)
npx lychee --offline --no-progress 'docs/**/*.md' '*.md'

# Boot smoke (amd64, ~2 min)
./tests/boot-smoke.sh out/pai-amd64-*.iso
```

Run the same thing CI runs with `./tests/run-all.sh` — it wraps the
above and matches CI exit semantics.

## 3. Writing a new test

Bats tests live in `tests/` and mirror the script name:
`scripts/chroot/30-locale.sh` → `tests/30-locale.bats`.

Template:

```bash
#!/usr/bin/env bats

load 'lib/test_helper'

setup() {
  ROOTFS="$(mktemp -d)"
  fixture_rootfs "$ROOTFS"    # helper in tests/lib/
}

teardown() {
  rm -rf "$ROOTFS"
}

@test "locale: sets en_US.UTF-8 by default" {
  run scripts/chroot/30-locale.sh "$ROOTFS"
  [ "$status" -eq 0 ]
  grep -q 'LANG=en_US.UTF-8' "$ROOTFS/etc/default/locale"
}

@test "locale: respects PAI_LOCALE override" {
  PAI_LOCALE=de_DE.UTF-8 run scripts/chroot/30-locale.sh "$ROOTFS"
  [ "$status" -eq 0 ]
  grep -q 'LANG=de_DE.UTF-8' "$ROOTFS/etc/default/locale"
}
```

Rules:

- One `.bats` file per script under test.
- Test names start with the subject: `"locale: …"`, `"grub: …"`.
- Fixtures go in `tests/fixtures/` — never write into the real repo.
- No network calls. No `sudo`. No `/tmp` assumptions — use `mktemp`.

## 4. Integration tests in CI

CI (GitHub Actions) runs the full matrix on every PR.

- **Secrets:** signing keys and the release-bucket token are stored as
  repository secrets; only jobs on `refs/tags/v*` can read them.
- **Artifacts:** ISOs and images are uploaded as workflow artifacts
  with a 14-day retention. The QEMU serial log is attached on failure.
- **Retries:** network-flaky steps (apt, GitHub releases) retry twice
  with exponential backoff. Everything else fails fast.
- **Timeouts:** each job has an explicit `timeout-minutes`. Full-build
  jobs are capped at 90 min — longer means a bug, not a slow runner.
- **Concurrency:** PRs cancel superseded runs via
  `concurrency.cancel-in-progress`. Main and tag builds never cancel.

## 5. Flaky-test policy

From [`agents/test-agent.md`](../../agents/test-agent.md):

1. A failing test is **never** disabled to unblock a merge. If the
   failure is unrelated to the PR, open an issue and bisect.
2. A test that fails once in ~200 runs without a bisect-able cause
   gets marked `@flaky` and auto-retried up to 2× in CI. It also gets
   an issue with the `flaky` label and an owner.
3. Any test `@flaky` for more than 30 days is either fixed or
   removed — no permanent flakes.
4. Three consecutive `@flaky` retries that all fail are a real
   failure, not flake. CI treats them that way.

## 6. Manual test checklist

Run this on real hardware before tagging a release. Check off each box
in the release PR description.

- [ ] Boot ISO on one real x86_64 laptop (UEFI + Secure Boot on).
- [ ] Boot ISO on one real x86_64 desktop (legacy BIOS).
- [ ] Boot image on Raspberry Pi 4 **and** Pi 5.
- [ ] Boot image on one non-Pi ARM64 board (Rock 5B or Ampere).
- [ ] USB install path: flash, boot, persist a file, reboot, file survives.
- [ ] Network: wired and Wi-Fi both acquire DHCP without manual config.
- [ ] Audio: play a file through default output.
- [ ] Display: external monitor hotplug works.
- [ ] Suspend/resume on laptop.
- [ ] Shut down cleanly (no hang, no filesystem errors on next boot).
- [ ] First-boot setup wizard completes end-to-end.
- [ ] `pai --version` matches the tag.

Results go in the release PR and are archived in
[RELEASE.md](../RELEASE.md).

## 7. Performance regressions

Build-time and boot-time regressions have their own tracker. See
[BENCHMARKS.md](../../BENCHMARKS.md) for baselines and how to record a
new run. A PR that regresses build time by >10% or boot time by >20%
needs a note in the description explaining why it's worth it.
