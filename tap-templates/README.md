# homebrew-tap

Homebrew tap for [PAI](https://pai.direct) — private, offline AI on a bootable USB.

## Install

```bash
brew install nirholas/tap/pai
```

Or manually:

```bash
brew tap nirholas/tap
brew install pai
```

## Usage

```bash
pai flash         # Flash PAI to a USB drive
pai try           # Launch PAI in a VM
pai verify <iso>  # Verify ISO checksum
pai doctor        # Check prerequisites
pai update        # Check for new releases
pai --help        # All subcommands
```

## More info

- Website: <https://pai.direct>
- Install docs: <https://docs.pai.direct/advanced/homebrew>
- Source: <https://github.com/nirholas/pai>
