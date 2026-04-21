# Installing PAI CLI on Arch Linux

The `pai` command-line tool is available from the
[Arch User Repository (AUR)](https://aur.archlinux.org/packages/pai-cli).
It provides `pai flash`, `pai try`, and `pai verify` commands for
downloading, flashing, and verifying PAI ISOs.

## Install with an AUR helper

Using [yay](https://github.com/Jguer/yay):

```bash
yay -S pai-cli
```

Or [paru](https://github.com/Morganamilo/paru):

```bash
paru -S pai-cli
```

## Install manually

```bash
git clone https://aur.archlinux.org/pai-cli.git
cd pai-cli
makepkg -si
```

## Bleeding-edge (git) version

For the latest development version tracking `main`:

```bash
yay -S pai-cli-git
```

!!! warning
    `pai-cli-git` tracks the tip of the `main` branch and may contain
    untested changes. Use `pai-cli` (stable) for production use.

`pai-cli-git` conflicts with `pai-cli` — only one can be installed at a
time.

## Upgrade

```bash
yay -Syu pai-cli
```

Or for the git package:

```bash
yay -Syu pai-cli-git
```

## Remove

```bash
yay -R pai-cli
# or
yay -R pai-cli-git
```

## Usage

After installation, the `pai` command is available system-wide:

```bash
pai help          # Show available commands
pai flash         # Download and flash the latest PAI ISO to USB
pai try           # Launch PAI in a QEMU virtual machine
pai verify        # Verify ISO integrity
```

## Optional dependencies

The PKGBUILD declares these as optional:

- **qemu-full** — required for `pai try` (launches PAI in a VM)
- **ovmf** — UEFI firmware for QEMU
- **util-linux** — provides `lsblk`, used by `pai flash` to list drives

Install them with:

```bash
sudo pacman -S qemu-full ovmf util-linux
```
