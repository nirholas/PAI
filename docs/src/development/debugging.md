---
title: Debugging
description: Triage guide for PAI build, boot, and runtime failures.
---

# Debugging

A practical triage guide for when something in PAI breaks: during the
ISO build, at boot, or at runtime in the live session. When a problem
hits production users, see also [../../RELEASE.md](../RELEASE.md)
for how to push a fix out.

## 1. Debugging strategy

Work from the smallest reproducible case outward:

1. **Reproduce** on the cheapest surface available: a QEMU boot is
   faster than a USB flash; a chroot shell is faster than a full ISO
   build.
2. **Bisect.** If it worked before, find the delta — `git bisect`
   across PAI commits, or step a single package version in the chroot
   (see §7).
3. **Log.** Add verbose flags (`set -x` in shell, `--debug` in
   `live-build`) before you start theorising.
4. **Fix the root cause, not the symptom.** Don't add a retry loop
   around a bug; find why it fails.
5. **Write the repro into a test** if the surface supports it.

## 2. Build-time failures

The ISO build runs `./build.sh` which drives `live-build` (`lb build`).
It produces `pai.iso` in the repo root. Common failure modes:

- **`debootstrap` fails fetching packages** — usually a transient
  mirror outage or a stale package index. Retry; if it persists, pick
  a different `--mirror-*` in `auto/config` or pin the Debian
  snapshot.
- **Missing host packages** — `live-build`, `debootstrap`,
  `squashfs-tools`, `xorriso`, `mtools`. Install with
  `sudo apt-get install live-build`; the CI workflow
  ([build.yml](../../.github/workflows/build.yml)) does the same.
- **Cache poisoning** — a prior failed run leaves the chroot in a
  broken state and subsequent builds reuse it. Run `sudo lb clean
  --purge` (or `sudo rm -rf cache/ chroot/ binary/ .build/`) and
  rebuild from scratch.
- **Disk space** — a full build needs ~15 GB free. `df -h .` before
  building. CI runs on `ubuntu-latest` with ~14 GB free; if CI fails
  with `No space left on device`, prune unused apt packages in the
  workflow or switch to a larger runner.
- **Network during chroot** — package hooks inside the chroot need
  outbound HTTP. Corporate proxies, `iptables` rules, and some VPNs
  break this.

Always read `binary.log` / `build.log` from the top down; the first
error is the real one.

## 3. Boot-time failures

When the ISO boots but fails before the desktop appears:

- **Kernel panic** — usually incompatible hardware or a bad
  initramfs. Note the last line before the panic; search the Debian
  kernel bug tracker with that string.
- **Initramfs hang** — "Gave up waiting for root device" means the
  live medium wasn't detected. Re-flash the USB; try a different
  port; confirm the ISO SHA256 matches
  [SHA256SUMS](../RELEASE.md#verify).
- **squashfs mount failure** — corruption on the medium. Re-verify
  the checksum and re-flash. If it reproduces on fresh media, the
  build is broken.
- **Persistence unlock failure** — wrong passphrase, or the
  persistence partition was created by a different PAI version with
  incompatible LUKS parameters. Try booting without persistence
  (`toram` or disabling the persistence option in GRUB) to confirm.

### Verbose kernel logs

Edit the GRUB entry at the boot menu (press `e`) and append to the
`linux` line:

```
loglevel=7 debug systemd.log_level=debug
```

To persist the log across reboots, add `earlyprintk=serial,ttyS0`
when booting under QEMU with a serial console.

### Serial console in QEMU

```
qemu-system-x86_64 \
  -cdrom pai.iso \
  -m 4G -smp 2 \
  -nographic \
  -append "console=ttyS0"
```

Or, with graphics enabled, `-serial stdio` captures the kernel log
to the terminal alongside the VM window.

## 4. Runtime failures

Once the desktop is up:

- **Sway crashes / won't start** — check `~/.local/share/sway/` or
  `journalctl --user -u sway`. GPU drivers are the most common
  cause; try `WLR_RENDERER=pixman sway` to force software rendering.
- **Ollama OOM** — the model exceeds available RAM. `free -h`
  before loading; pick a smaller quantisation, or boot with more
  RAM. PAI runs Ollama fully in RAM by default.
- **Tor circuit timeouts** — `systemctl --user status tor` and
  `journalctl --user -u tor`. Bridges may be needed on restrictive
  networks; check the `obfs4` configuration.
- **Wallet RPC errors** — confirm the daemon is running
  (`systemctl --user status bitcoind` or equivalent) and that the
  wallet's `rpcuser`/`rpcpassword` match the client's. `ss -tlnp |
  grep 8332` to check the RPC port is bound.

## 5. Collecting diagnostics

Useful one-liners, safe to run on a live system:

```bash
journalctl -k --no-pager                # kernel ring buffer, persistent
dmesg --human                           # same, friendlier format
free -h                                 # memory pressure
df -h                                   # disk / tmpfs usage
ss -tulpn                               # listening sockets with PIDs
swaymsg -t get_outputs                  # monitor configuration
swaymsg -t get_version                  # Sway version
lsmod | sort                            # loaded kernel modules
lspci -k                                # PCI devices and their drivers
systemctl --failed                      # any failed units
journalctl -b -p err                    # errors from current boot
```

Dump everything to a file with `> diag.txt 2>&1` and attach to the bug
report — but read it first (see §6).

## 6. Reporting a bug

File issues at the [PAI GitHub tracker](https://github.com/pai-os/pai/issues).
Useful reports include:

- PAI version (`cat /etc/pai-release` or the ISO filename).
- Host hardware summary (`lspci`, `lscpu`, RAM).
- Exact steps to reproduce.
- Diagnostics from §5, trimmed to the relevant section.
- `journalctl -b` for boot issues; `journalctl --user -u <unit>` for
  runtime issues.

**Redact before attaching:**

- `~/.ssh/`, `~/.gnupg/` — never attach.
- Bitcoin/Monero wallet files, seed phrases, mnemonic words — **never
  attach, even redacted.** If a log contains them, discard the log.
- API tokens, cookies, `Authorization:` headers — scrub with `sed` or
  replace with `REDACTED`.
- IP addresses if you care about your location; hostname if it
  identifies you.

If in doubt about whether a file is safe to share, don't share it.

## 7. Bisecting against upstream

When a package update breaks PAI, step back to the previous version
inside a chroot to confirm:

```bash
sudo lb bootstrap                        # build just the chroot
sudo chroot chroot /bin/bash
apt-cache policy <pkg>                   # see available versions
apt-get install <pkg>=<old-version>      # downgrade
exit
sudo lb chroot && sudo lb binary         # finish the build
```

Once the good version is confirmed, pin it in `config/package-lists/`
or `config/archives/` and file the upstream bug.

For PAI-side regressions, `git bisect` across the repo:

```bash
git bisect start
git bisect bad HEAD
git bisect good v0.1.0        # last known-good tag
git bisect run ./build.sh     # automate if build failure is the signal
```

## See also

- [setup.md](setup.md) — local dev environment.
- [ci-cd.md](ci-cd.md) — CI is often the first place a regression
  surfaces.
- [../../KNOWN_ISSUES.md](../KNOWN_ISSUES.md) — known broken things
  before you bisect.
- [../../SECURITY.md](../security.md) — security issues go through
  a different channel, not the public tracker.
