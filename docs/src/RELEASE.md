# PAI release runbook

This is the operational guide for the release captain cutting a PAI ISO
release. It is paired with [CHANGELOG.md](./CHANGELOG.md) (what shipped) and
[MIGRATION.md](./MIGRATION.md) (what users need to do to upgrade).

## 1. Cadence

PAI has **no fixed release cadence**. Cut a release when a meaningful set of
user-visible changes has accumulated — new features, model updates, or
non-trivial fixes. Avoid releases that only churn internal structure.

**Security fixes ship out-of-band** as PATCH releases as soon as a fix is
verified. Do not batch a security fix behind unrelated feature work.

## 2. Versioning rules (SemVer, PAI flavor)

PAI follows [SemVer 2.0.0](https://semver.org). For this project:

- **MAJOR (`X.0.0`)** — bump when a change breaks existing users:
  - Debian base version changes (e.g. Bookworm → Trixie).
  - LUKS / persistence volume format changes that require a one-shot
    migration tool.
  - Kernel or bootloader changes that invalidate existing USB installs.
  - Removal of a preinstalled app or model users depend on.
- **MINOR (`0.X.0`)** — bump for backwards-compatible additions:
  - New preinstalled app, new model, new supported architecture.
  - New feature in the Flash app or website.
- **PATCH (`0.0.X`)** — bump for fixes that do not change behavior:
  - Security fixes, package updates, bugfixes.

When in doubt, prefer the higher bump.

## 3. Pre-flight checklist

Before starting a build, confirm:

- [ ] `CHANGELOG.md` `[Unreleased]` moved under a new `[X.Y.Z] — YYYY-MM-DD`
      heading, with compare-link footer updated.
- [ ] `MIGRATION.md` has a section for this version transition (or explicitly
      says "no migration required").
- [ ] Website changelog entry written in
      `website/src/content/changelog/vX-Y-Z.mdx`.
- [ ] Docs in `docs/` and `website/src/content/docs/` reflect the release.
- [ ] CI green on both `x86_64` and `ARM64`.
- [ ] Smoke-tested a fresh ISO on real hardware for each architecture
      (boot, connect to network, run Ollama, unlock persistence).
- [ ] README version references, if any, are updated.
- [ ] `node scripts/gen-imager-manifest.mjs --local --dry-run` prints a
      populated manifest (or a pending note) for this version.
- [ ] `node scripts/validate-imager-manifest.mjs` passes locally.

## 4. Build steps

Build from a clean worktree on the tagged commit.

### AMD64 / x86_64

```sh
./build.sh
```

Output: `pai-vX.Y.Z-amd64.iso` in the build output directory.

### ARM64 (including Apple Silicon)

```sh
./arm64/build.sh
```

Output: `pai-vX.Y.Z-arm64.iso`.

Both builds run inside the Docker image defined by `Dockerfile.build`.

## 5. Signing and checksums

> **Status for v0.1.0:** minisign signing is not yet live — the release
> captain's hardware-token-backed keypair is provisioned for v0.2.
> v0.1.0 ships with SHA-256 checksums only. The procedure below is the
> target workflow starting v0.2; follow it once the keypair is in place
> and `minisign.pub` has been committed to the repository root.

For each ISO produced:

```sh
sha256sum pai-vX.Y.Z-amd64.iso > pai-vX.Y.Z-amd64.iso.sha256
sha256sum pai-vX.Y.Z-arm64.iso > pai-vX.Y.Z-arm64.iso.sha256

minisign -Sm pai-vX.Y.Z-amd64.iso
minisign -Sm pai-vX.Y.Z-arm64.iso
```

The minisign **secret key** lives only on the release captain's hardware
token. It is never committed, never copied to CI, and never typed on a
networked machine that is not the release workstation.

The minisign **public key** is committed to the repository root as
`minisign.pub` and is also published on the GitHub Releases page so users
can verify downloads independently of the repo.

Users verify with:

```sh
minisign -Vm pai-vX.Y.Z-amd64.iso -p minisign.pub
sha256sum -c pai-vX.Y.Z-amd64.iso.sha256
```

### 5b. Authenticode signing (PowerShell flashers)

The `flash.ps1` script is Authenticode-signed via
[SignPath](https://signpath.io) on every release. The
`.github/workflows/sign-scripts.yml` workflow runs automatically on
`release: published` and replaces the unsigned release asset with a
signed copy.

**Required repository secrets:**

| Secret              | Description                                         |
| ------------------- | --------------------------------------------------- |
| `SIGNPATH_API_TOKEN`| API token from the SignPath project dashboard        |
| `SIGNPATH_ORG_ID`   | Organization ID from SignPath account settings       |

**Setup (one-time):**

1. Apply for the SignPath OSS program at <https://signpath.io/open-source/>.
2. Once approved, create a project named `pai` in the SignPath dashboard.
3. Note the Organization ID and create an API token.
4. Add both as repository secrets in GitHub → Settings → Secrets → Actions.
5. Run a test release (`workflow_dispatch`) to verify end-to-end signing.

Users verify the signed flasher with:

```powershell
$sig = Get-AuthenticodeSignature .\flash.ps1
$sig.Status                    # Must be: Valid
$sig.SignerCertificate.Subject  # Must contain: PAI
```

See [docs/src/security/verifying-flashers.md](security/verifying-flashers.md)
for full verification instructions.

## 6. Publishing

1. Create a **signed, annotated git tag** from the release commit:
   ```sh
   git tag -s vX.Y.Z -m "PAI vX.Y.Z"
   git push origin vX.Y.Z
   ```
2. Create a **GitHub Release** for the tag. Title: `PAI vX.Y.Z`. Body:
   copy the matching CHANGELOG section verbatim, with a link back to
   [CHANGELOG.md](./CHANGELOG.md) and [MIGRATION.md](./MIGRATION.md).
3. Upload, for each architecture:
   - `pai-vX.Y.Z-<arch>.iso`
   - `pai-vX.Y.Z-<arch>.iso.sha256`
   - `pai-vX.Y.Z-<arch>.iso.minisig`
4. Keep the release as a draft until all six artifacts are attached.
   Publish only when complete.

## 6a. Windows package managers

Publishing a release automatically triggers two workflows:

- **Scoop** (`.github/workflows/update-scoop.yml`): computes the tarball
  SHA256 and dispatches a `pai-release` event to the
  [`nirholas/scoop-pai`](https://github.com/nirholas/scoop-pai) bucket
  repo. That repo's `update-formula.yml` workflow opens a PR and runs a
  smoke-test on a Windows runner. The Scoop bucket repo was bootstrapped
  with `scripts/maintenance/bootstrap-scoop-bucket.sh`.

- **Winget** (`.github/workflows/update-winget.yml`): downloads the
  `pai-cli-<version>.zip` release asset, computes its SHA256, and submits
  a manifest PR to `microsoft/winget-pkgs` via `winget-releaser`.

The first Winget submission requires a human review (usually 1–3 business
days). See `scripts/maintenance/bootstrap-winget-first-submission.md` for
the checklist. Subsequent releases update automatically.

Both workflows also support `workflow_dispatch` with a `tag` input for
manual re-runs.

## 7. Post-release

- Announce on the project's social channels (Mastodon, Twitter/X).
- Rebuild the website so the new release shows up on
  `/apps/changelog` and `/apps/flash`:
  ```sh
  cd website && npm run build
  ```
- Open a follow-up PR that re-adds an empty `[Unreleased]` section at the
  top of `CHANGELOG.md` and updates the compare-link footer to
  `v<new>...HEAD`.
- Confirm the **Publish Imager manifest** workflow ran (triggers on
  `release: { types: [published] }`). It regenerates
  `website/public/imager.json` from the live release assets and opens a
  PR on `main`. Review + merge within one business day — the URL
  `https://pai.direct/imager.json` is what Raspberry Pi Imager pulls, so
  it must point at the new arm64 `.img.xz` asset.
- Run the flasher + Imager smoke tests against the deployed site:
  ```sh
  scripts/smoke-test-flashers.sh
  ```
  All three sections (site flash.ps1, release flash.ps1, Imager
  manifest/icon) must be green.
- Confirm the **Update AUR packages** workflow ran (triggers on
  `release: { types: [published] }`). It pushes updated PKGBUILDs for
  `pai-cli` and `pai-cli-git` to the AUR. Verify at
  <https://aur.archlinux.org/packages/pai-cli>. Requires the
  `AUR_SSH_KEY` repository secret (private SSH key whose public half is
  registered on the AUR maintainer account).
- Confirm the **Update Homebrew formula** workflow ran (triggers on
  `release: { types: [published] }`). It dispatches a `pai-release`
  event to `nirholas/homebrew-tap`, which opens a PR bumping the formula.
  Verify at <https://github.com/nirholas/homebrew-tap/pulls>. Requires
  the `HOMEBREW_TAP_TOKEN` repository secret (a PAT with `repo` scope
  that can dispatch to the tap repo).
- Complete the **Raspberry Pi Imager live QA** walkthrough from
  [scripts/smoke-test-imager.md](../../scripts/smoke-test-imager.md):
  - [ ] Step 3: custom repository `https://pai.direct/imager.json` accepted
  - [ ] Step 4: PAI entry visible with correct icon, description, size
  - [ ] Step 5: flash + boot verified on a Pi 4 or Pi 5 (optional but
        recommended for MINOR/MAJOR releases)

## 8. Hotfix flow

When a shipped release has a critical bug or security issue:

1. Branch from the tag: `git checkout -b hotfix/vX.Y.Z+1 vX.Y.Z`.
2. Cherry-pick (or write) the minimal fix. No unrelated changes.
3. Bump PATCH in CHANGELOG and any version files.
4. Follow sections 3 → 6 as normal.
5. Fast-forward `main` with the hotfix so the fix is not lost on the next
   MINOR release.

## 9. Yanking a release

If a release must be withdrawn (dangerous bug, broken crypto, wrong
artifact):

1. On the GitHub Release page, check **"Set as a pre-release"** and edit
   the body to start with a prominent **⚠️ YANKED** banner explaining
   why, and which version users should use instead.
2. Add a top-level note in `CHANGELOG.md` directly under the version
   heading:
   ```markdown
   ## [X.Y.Z] — YYYY-MM-DD — YANKED

   **This release has been yanked.** Reason: <one line>.
   Users on this version should upgrade to <replacement> immediately.
   See [MIGRATION.md](./MIGRATION.md).
   ```
3. Do **not** delete the tag or the artifacts — users need them to verify
   what they already installed. Yanking is about signaling, not
   unpublishing.
4. Cut a replacement release (PATCH bump) as soon as a fix exists.

## 10. One-time setup: Homebrew tap

The Homebrew tap lives at `github.com/nirholas/homebrew-tap`. To
bootstrap it for the first time:

1. Ensure `gh` is authenticated with push access to the `nirholas` org.
2. Run the bootstrap script:
   ```sh
   scripts/maintenance/bootstrap-homebrew-tap.sh
   ```
   This creates the repo, copies the formula and CI workflow from
   `tap-templates/`, and pushes the initial commit.
3. Add a `HOMEBREW_TAP_TOKEN` secret to the main PAI repo (Settings →
   Secrets → Actions). This must be a GitHub PAT with `repo` scope that
   can dispatch workflow events to `nirholas/homebrew-tap`.
4. Verify: `brew tap nirholas/tap && brew install pai && pai --help`.
