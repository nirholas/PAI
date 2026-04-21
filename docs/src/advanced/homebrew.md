# Homebrew (macOS / Linux)

Install the PAI CLI tools via [Homebrew](https://brew.sh) for easy access
to the flasher, VM launcher, and ISO verifier.

## Install

```bash
brew install nirholas/tap/pai
```

Or as two separate steps:

```bash
brew tap nirholas/tap
brew install pai
```

## Subcommands

| Command | Description |
|---------|-------------|
| `pai flash` | Flash PAI to a USB drive interactively |
| `pai try` | Launch PAI in a local VM (requires QEMU) |
| `pai verify <iso>` | Verify a downloaded ISO's SHA256 checksum |
| `pai update` | Check for a newer PAI release |
| `pai version` | Print CLI version and latest PAI release |
| `pai doctor` | Check prerequisites (QEMU, curl, sha256sum, KVM/HVF) |
| `pai help` | Show all subcommands |

Every subcommand accepts `--help` for detailed usage.

## Examples

```bash
# Flash PAI to a USB drive
pai flash

# Verify a downloaded ISO before flashing manually
pai verify ~/Downloads/pai-v0.2.0-amd64.iso

# Check if your system can run PAI in a VM
pai doctor

# See what version you have and what's latest
pai version
```

## Prerequisites

The `pai` CLI itself only requires a POSIX shell and `curl`. Individual
subcommands may require additional tools:

- **`pai flash`** — needs a removable drive and root access
- **`pai try`** — needs `qemu-system-x86_64` or `qemu-system-aarch64`
- **`pai verify`** — needs `sha256sum`, `gsha256sum`, or `shasum`

Run `pai doctor` to check what's available on your system.

## Upgrade

```bash
brew upgrade pai
```

The formula is automatically updated when a new PAI release is published.

## Uninstall

```bash
brew uninstall pai
```

This removes the `pai` CLI, `flash.sh`, and `try.sh` from your Homebrew
prefix. It does not affect any PAI USB drives you've already created.

## How it works

The Homebrew formula installs:

- `pai` → `$(brew --prefix)/bin/pai`
- `flash.sh` → `$(brew --prefix)/libexec/pai/flash.sh`
- `try.sh` → `$(brew --prefix)/libexec/pai/try.sh`

The `pai` command is a thin POSIX shell dispatcher that routes subcommands
to the appropriate bundled script.

## Troubleshooting

### `pai: error: flash.sh not found`

The libexec directory wasn't set up correctly. Reinstall:

```bash
brew reinstall pai
```

### `pai doctor` shows warnings

Install missing prerequisites:

```bash
brew install qemu coreutils
```

### Formula audit failures

If you're contributing to the tap, run:

```bash
brew audit --strict Formula/pai.rb
brew test pai
```
