---
title: Releasing PAI
description: Version cuts, tagging, signing, and publishing an ISO to users.
audience: maintainers
last_reviewed: 2026-04-20
---

# Releasing PAI

Releases are ISOs. No rolling updates, no in-place upgrades. Each
release is a tagged build with a signed checksum, uploaded to
GitHub Releases and GCS.

## Pre-release checklist

- [ ] [CHANGELOG.md](../CHANGELOG.md) updated.
- [ ] [TODO.md](../TODO.md) milestone entries closed or punted.
- [ ] Both AMD64 and ARM64 builds green on the cloud builders.
- [ ] Test boot on at least one bare-metal machine of each arch.
- [ ] [KNOWN_ISSUES.md](../KNOWN_ISSUES.md) reflects reality.

## Cutting the release

1. Bump the version in `VERSION`.
2. Commit: `chore(release): vX.Y.Z`.
3. Tag: `git tag -s vX.Y.Z -m "PAI vX.Y.Z"`. Signed tags only.
4. Push: `git push --tags`.

## Building the artefacts

Run the AMD64 and ARM64 cloud builders in parallel. See
[../ops-cloud-builders.md](../ops-cloud-builders.md) for the
rsync-and-build recipe.

Outputs land at:

```
artefacts/pai-<version>-amd64.iso
artefacts/pai-<version>-arm64.iso
artefacts/pai-<version>-amd64.iso.sha256
artefacts/pai-<version>-arm64.iso.sha256
```

## Signing

Sign the SHA256SUMS file with the release key:

```
gpg --detach-sign --armor SHA256SUMS
```

The release key fingerprint is published in
[../MAINTAINERS.md](../MAINTAINERS.md). Verification instructions
for users are in [../USB-FLASHING.md](../USB-FLASHING.md).

## Publishing

1. Upload ISOs + SHA256SUMS + SHA256SUMS.asc to the GitHub
   Release for the tag.
2. Upload to the Cloudflare origin at `https://get.pai.direct/`.
   The public download page points here for users who can't reach GitHub.
3. Update `docs.pai.direct/changelog` if not auto-generated.

## Post-release

- Announce on project channels listed in
  [../MAINTAINERS.md](../MAINTAINERS.md).
- Open the next milestone in GitHub issues.
- Rotate any credentials that were short-term for the release.

## Emergency revoke

If a release needs pulling (a shipped secret, a boot-breaking bug):

1. Delete the GitHub Release assets (keep the tag for audit).
2. Remove from GCS.
3. Note revocation in [../KNOWN_ISSUES.md](../KNOWN_ISSUES.md) and
   pin a GitHub Issue.
4. Communicate on all announcement channels.

Re-spin the build with the fix and ship a `X.Y.Z+1`.
