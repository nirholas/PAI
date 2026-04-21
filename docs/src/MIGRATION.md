# Upgrading PAI between versions

PAI is a **live-USB distribution**, not a traditional installed OS.
"Upgrading" means writing a newer ISO to your USB drive. Your personal
data lives in a separate **LUKS-encrypted persistence file** on the same
drive (or on a second drive) and is preserved across upgrades unless the
release notes for the target version say otherwise.

This guide describes what to do for each version transition. For what
actually changed, see [CHANGELOG.md](./CHANGELOG.md). For how releases
are built, see [RELEASE.md](./RELEASE.md).

## The general upgrade procedure

1. **Back up your persistence volume.** Copy the encrypted persistence
   file somewhere safe (another drive, a trusted host). This is your
   rollback.
2. **Verify the new ISO.** Check the SHA-256 against the value on the
   release page. Starting v0.2, also verify the minisign signature
   against the public key in `minisign.pub` — v0.1.0 ships without
   minisign signatures (see [CHANGELOG.md](./CHANGELOG.md) known
   limitations).
3. **Flash the new ISO** to your USB drive using the Flash app or
   `dd`/equivalent. This replaces the system partition only.
4. **Boot the new version** and unlock your persistence volume as usual.
5. **If something is wrong**, re-flash the previous ISO and restore the
   persistence backup from step 1.

Each version section below notes any deviations from this procedure.

## 0.0.x → 0.1.0

First public release. There is no prior PAI data to migrate. Flash the
ISO to a USB drive and boot.

## Template for future transitions

Copy this block when adding a new transition section:

```markdown
## X.Y.Z → X'.Y'.Z'

### What changed
- Short bullets of user-visible changes that affect upgraders.

### What might break
- Specific behaviors, files, or configs that differ after upgrade.

### Preserve your persistence volume
- Steps to keep your encrypted data intact. Call out any format changes
  and point at the migration tool if one is required.

### Rollback
- Exact steps to return to the prior version, including how to restore
  the persistence backup.
```

## Persistence compatibility

PAI will **never silently migrate an encrypted persistence volume** to a
new format. If a release changes the persistence layout, LUKS parameters,
or filesystem type:

- The release will be a **MAJOR** version bump (see [RELEASE.md](./RELEASE.md)
  section 2).
- The release will ship a **one-shot migration tool** that runs
  interactively, requires explicit confirmation, and writes the
  converted volume to a new file rather than overwriting the old one.
- The CHANGELOG entry and the matching section in this file will call
  out the change in the first line, not buried in a bullet list.

If none of those conditions is met for a release, your existing
persistence volume is guaranteed to continue working unchanged.
