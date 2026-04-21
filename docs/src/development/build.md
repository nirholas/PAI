---
title: Building PAI
description: How the ISO is actually built — chroot, live-build, squashfs, and the amd64 / arm64 split.
audience: contributors
last_reviewed: 2026-04-20
---

# Building PAI

If you just want an ISO to flash, grab one from the releases page.
This document is for people who want to build or modify the image.

## The build in one diagram

```
prompts/*   →   scripts/*.sh          ↘
                                       live-build (lb build)
config/*    →   chroot overlay        ↗           ↓
                                              squashfs
                                                  ↓
                                              ISO (hybrid)
```

The per-step prompts under `prompts/` are the **source of truth**
for what goes in the image. The `scripts/` directory turns each
prompt into a shell action runnable inside the chroot. `live-build`
orchestrates the chroot, installs packages, applies the overlay,
and produces the ISO.

## Quick start (AMD64)

```
git clone https://github.com/nirholas/pai
cd pai
./build.sh
```

This launches the [Dockerfile.build](https://github.com/nirholas/pai/blob/main/Dockerfile.build)
container, which has live-build and all needed tooling.

Full detail: [../advanced/building-from-source.md](../advanced/building-from-source.md).

## ARM64

```
cd arm64
./build.sh
```

ARM64 builds run on ARM64 hosts. A cross-build is possible with
`binfmt_misc` but slow. In practice we build on the dedicated ARM64
cloud builder — see [../ops-cloud-builders.md](../ops-cloud-builders.md).

## Build in the cloud

The project maintains two always-provisioned GCP builders (AMD64
and ARM64). If you have access, rsync your working tree and run
the same `./build.sh`. Runbook:
[../ops-cloud-builders.md](../ops-cloud-builders.md).

## What happens inside

1. `lb config` stages a chroot environment from Debian stable.
2. Packages from `config/package-lists/` are installed.
3. Hooks under `config/hooks/live/` run inside the chroot: firewall
   rules, Ollama install, MAC spoofing dispatcher, GRUB theme, and
   so on.
4. The overlay under `config/includes.chroot_after_packages/` is
   copied in.
5. `mksquashfs` builds the read-only root.
6. `xorriso` stitches the ISO together with the boot partitions.

## CI

ISO builds also run through GitHub Actions. See
[ci-cd.md](ci-cd.md).

## Releasing a build

Tagging, signing, and publishing live in [release.md](release.md).

## Debugging a failed build

- Re-run with `DEBUG=1 ./build.sh` to keep the chroot on failure.
- `sudo systemd-nspawn -D chroot` to poke around inside.
- Known pitfalls live in [debugging.md](debugging.md).
