# PAI ARM64 Build — Complete Guide

This is a **separate, independent copy** of PAI built for **ARM64 (aarch64)** — Apple Silicon Macs (M1/M2/M3/M4), Raspberry Pi 4/5, and other ARM64 hardware.

The original amd64 build at `/workspaces/addie/pai/` is **untouched**.

---

## What Changed from AMD64

| Component | AMD64 (original) | ARM64 (this copy) |
|-----------|-------------------|---------------------|
| Architecture | `--architectures amd64` | `--architectures arm64` |
| Kernel | `linux-image-amd64` | `linux-image-arm64` |
| Ollama binary | `ollama-linux-amd64` | `ollama-linux-arm64` |
| Go binary | `go*.linux-amd64.tar.gz` | `go*.linux-arm64.tar.gz` |
| GitHub CLI | `gh_*_linux_amd64.deb` | `gh_*_linux_arm64.deb` |
| Lazygit | `lazygit_*_Linux_x86_64` | `lazygit_*_Linux_arm64` |
| Feather Wallet | `linux.zip` (x86) | `linux-arm64.zip` or skip |
| GRUB | `grub-efi-amd64-bin` | `grub-efi-arm64-bin` |
| Dockerfile | `grub-pc-bin` + `isolinux` | `grub-efi-arm64-bin` only (no BIOS) |
| whisper.cpp | Default build | Same (builds natively) |

---

## Directory Structure

```
pai-arm64/
├── Dockerfile.build          # ARM64 Docker build env
├── build.sh                  # ARM64 lb config
├── README.md                 # This file
├── config/
│   ├── hooks/live/           # 18 hooks (ARM64 adapted)
│   ├── includes.chroot_after_packages/  # Same static files
│   └── package-lists/        # ARM64 package list
├── prompts/
│   └── BUILD-ARM64.md        # Build prompts
├── scripts/
│   ├── flash.sh
│   └── flash-usb.sh
└── output/                   # Built ISO lands here
```

---

## Build Command

```bash
cd /workspaces/addie/pai-arm64

# Build (requires ARM64 Docker or QEMU binfmt)
docker build -t pai-builder-arm64 -f Dockerfile.build .
docker run --privileged -v $(pwd)/output:/pai/output pai-builder-arm64

# Cross-build on x86 (requires binfmt registration):
docker run --rm --privileged multiarch/qemu-user-static --reset -p yes
docker build --platform linux/arm64 -t pai-builder-arm64 -f Dockerfile.build .
docker run --privileged --platform linux/arm64 -v $(pwd)/output:/pai/output pai-builder-arm64
```

---

## Testing on Apple Silicon

With UTM (native virtualization — fast!):
1. Download UTM from https://mac.getutm.app
2. Create new VM → **Virtualize** (not Emulate)
3. OS: Linux, select the ARM64 ISO
4. Architecture: aarch64 (default on Apple Silicon)
5. RAM: 4096 MB, Cores: 2+
6. Boot — should be fast since it's native ARM64
