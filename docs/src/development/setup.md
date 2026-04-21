---
title: Development Setup
description: Get from a fresh checkout to a booted PAI image in one afternoon.
audience: new contributors
last_reviewed: 2026-04-17
---

# Development Setup

This guide walks a new contributor from a bare host to a first successful
build and a booted artifact. If any step fails, jump to
[Common setup failures](#10-common-setup-failures) before filing an issue.

## 1. Supported host OS

| Host                | Native build | Docker build |
|---------------------|--------------|--------------|
| Debian 12 (bookworm)| ✅            | ✅            |
| Ubuntu 22.04/24.04  | ✅            | ✅            |
| Fedora / Arch / macOS / WSL2 | ❌ | ✅ (preferred) |

Anything non-Debian-family should use the [Docker path](#7-docker-based-build).
You need ~20 GB free disk and at least 8 GB RAM (16 GB recommended for
parallel builds). ARM64 builds on x86 hosts add ~5 GB for QEMU user-mode
binaries.

## 2. Install host tooling

On a Debian/Ubuntu host:

```bash
sudo apt update
sudo apt install -y \
  debootstrap squashfs-tools xorriso isolinux syslinux-common \
  grub-pc-bin grub-efi-amd64-bin mtools dosfstools \
  qemu-system-x86 qemu-system-arm qemu-user-static binfmt-support \
  shellcheck bats git curl jq ca-certificates
```

`sudo` is required for `debootstrap`, loop-mounts, and chroot operations.
If you don't have passwordless sudo, you'll be prompted mid-build.

For the Docker path you only need `docker` (or `podman` with a `docker`
symlink) and `git`.

## 3. Clone the repo

```bash
git clone https://github.com/nirholas/pai.git
cd pai
# or via SSH:
git clone git@github.com:nirholas/pai.git
```

There are no git submodules today. If you see `.gitmodules` in the future,
add `--recurse-submodules` to the clone, or run
`git submodule update --init --recursive` after.

## 4. Install commit hooks

Hooks run ShellCheck and markdownlint before every commit. They are
optional but strongly recommended — CI runs the same checks.

```bash
pip install --user pre-commit
pre-commit install
# sanity check:
pre-commit run --all-files
```

If you don't want `pre-commit`, you can run the checks manually:

```bash
shellcheck $(git ls-files '*.sh')
npx markdownlint-cli '**/*.md' --ignore node_modules
```

## 5. First build — AMD64

```bash
sudo ./build.sh
```

- **Expected duration:** 20–40 min on a warm cache, 60–90 min cold.
- **Expected artifact:** `out/pai-amd64-<date>.iso` (~1.2 GB).
- **Log:** `out/build.log` — tail it in another terminal.

Smoke-test the ISO:

```bash
qemu-system-x86_64 -enable-kvm -m 4G -cdrom out/pai-amd64-*.iso
```

See [BUILD-FULL-AMD64.md](../../BUILD-FULL-AMD64.md) for every flag.

## 6. First build — ARM64

On an ARM64 host (Apple Silicon via Linux VM, Ampere, Pi 5):

```bash
sudo ./arm64/build.sh
```

On an x86 host, enable QEMU user-mode emulation first:

```bash
sudo apt install -y qemu-user-static binfmt-support
sudo update-binfmts --enable qemu-aarch64
sudo ./arm64/build.sh
```

Artifact: `out/pai-arm64-<date>.img`. Cross-builds take roughly 2× as long
as native.

## 7. Docker-based build

The reproducible path. Same input always produces the same output bytes.

```bash
docker build -t pai-builder -f Dockerfile.build .
docker run --rm --privileged \
  -v "$PWD":/src -w /src \
  pai-builder ./build.sh
```

`--privileged` is required for loop devices and chroot. If your
corporate policy forbids it, use `--cap-add SYS_ADMIN --device /dev/loop-control`.

## 8. Booting the artifact in QEMU

**x86_64:**

```bash
qemu-system-x86_64 \
  -enable-kvm -m 4G -smp 2 \
  -cdrom out/pai-amd64-*.iso \
  -boot d -vga virtio
```

**aarch64:**

```bash
qemu-system-aarch64 \
  -machine virt -cpu cortex-a72 -m 4G -smp 2 \
  -bios /usr/share/qemu-efi-aarch64/QEMU_EFI.fd \
  -drive if=none,file=out/pai-arm64-*.img,id=hd0 \
  -device virtio-blk-device,drive=hd0 \
  -nographic
```

For headless CI, add `-display none -serial mon:stdio`.

## 9. Iterating quickly

- **Skip unchanged layers:** `SKIP_DEBOOTSTRAP=1 ./build.sh` reuses the
  base rootfs tarball in `cache/`.
- **Reuse apt cache:** `APT_CACHE_DIR=./cache/apt ./build.sh` persists
  packages between runs — cuts 5–10 min from rebuilds.
- **Iterate on one chroot script:** run it directly against a mounted
  rootfs with `sudo chroot cache/rootfs bash -x scripts/chroot/10-foo.sh`.
- **Docker BuildKit cache:** `DOCKER_BUILDKIT=1 docker build …` with a
  `--cache-from` registry image short-circuits most steps.

## 10. Common setup failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| `debootstrap: command not found` | Missing host tooling | Re-run the apt install line in §2 |
| `GPG error: … NO_PUBKEY` | Stale apt keyring | `sudo apt install -y debian-archive-keyring ubuntu-keyring && sudo apt update` |
| `No space left on device` mid-squashfs | Disk full in `/tmp` or `out/` | Point `TMPDIR=` at a larger volume; need ~10 GB free |
| `E: Couldn't download packages` | Transient mirror blip | Retry; set `DEBIAN_MIRROR=https://deb.debian.org/debian` |
| `exec format error` during arm64 chroot | `binfmt_misc` not registered | `sudo update-binfmts --enable qemu-aarch64`; verify `/proc/sys/fs/binfmt_misc/qemu-aarch64` exists |
| Docker build: `operation not permitted` on mount | Missing `--privileged` | Add it, or the `SYS_ADMIN` cap pair in §7 |
| QEMU boots to black screen | Missing UEFI firmware | `sudo apt install ovmf qemu-efi-aarch64` |

Still stuck? See [CONTRIBUTING.md](../../CONTRIBUTING.md) for where to
ask, and [KNOWN_ISSUES.md](../KNOWN_ISSUES.md) for open regressions.
