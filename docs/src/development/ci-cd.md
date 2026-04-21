---
title: CI / CD
description: GitHub Actions workflows, secrets, release automation, and branch protection for PAI.
---

# CI / CD

PAI's CI and CD run entirely on GitHub Actions. There is no
always-on backend to deploy to — see [../deployment.md](../deployment.md)
for what "deploy" means here. Release mechanics live in
[../../RELEASE.md](../RELEASE.md).

## 1. CI overview

All workflows are in [.github/workflows/](../../.github/workflows/).
They fire on standard GitHub events:

| Trigger | Workflows |
|---|---|
| `push` to `main` | [build.yml](../../.github/workflows/build.yml), [pages-deploy.yml](../../.github/workflows/pages-deploy.yml), [mvp-deploy.yml](../../.github/workflows/mvp-deploy.yml) (if `docs/**` changed) |
| `pull_request` against `main` | `build.yml`, `pages-deploy.yml` (preview) |
| Tag `v*` | `build.yml` (attaches artifacts to a GitHub Release) |
| Manual (`workflow_dispatch`) | `build.yml` |

No cron / scheduled jobs today. No matrix builds; PAI targets amd64
only until arm64 is promoted out of experimental.

## 2. Per-workflow details

### build.yml — Build PAI ISO

- **Name:** `Build PAI ISO`
- **Triggers:** push to `main`, PRs to `main`, tags `v*`, manual.
- **Runner:** `ubuntu-latest`, 60-minute timeout.
- **Jobs:** one `build` job that installs `live-build`, runs
  `sudo ./build.sh`, renames the ISO to `pai-<version>-amd64.iso`,
  generates SHA256 checksums, and uploads the ISO as an artifact
  (`retention-days: 14`).
- **Release step:** on `refs/tags/v*`, attaches the ISO, its
  `.sha256`, and `SHA256SUMS` to a GitHub Release using
  `softprops/action-gh-release@v2` with
  `generate_release_notes: true`.
- **Budget:** one ISO build is roughly 20–35 minutes on a GitHub
  hosted runner. Under CI's 60-min cap with comfortable headroom.

### pages-deploy.yml — Deploy to Cloudflare Pages

- **Name:** `Deploy to Cloudflare Pages`
- **Triggers:** push to `main` (production), PRs to `main` (preview).
- **Runner:** `ubuntu-latest`.
- **Jobs:** installs Node 22, `npm ci` under `website/`,
  `npm run build`, then `cloudflare/wrangler-action@v3` to
  `pages deploy website/dist --project-name=pai-direct`.
- **PR previews:** the workflow writes a sticky comment on the PR
  containing the Cloudflare preview URL; it updates the same comment
  on subsequent pushes rather than spamming.
- **Concurrency:** `group: pages-${{ github.ref }},
  cancel-in-progress: true` — newer pushes cancel older deploys on
  the same ref.

### mvp-deploy.yml — Deploy MVP landing page

- **Name:** `Deploy MVP landing page`
- **Triggers:** push to `main` touching `docs/**`.
- **What it does:** deploys the raw `docs/` folder to the
  `pai-direct-mvp` Cloudflare Pages project. This is the legacy
  landing path; it coexists with the Astro site in `website/` and
  will be retired once the Astro site owns everything. Treat as
  frozen — do not add new content here.

### Lint / test

**TODO:** there is currently no dedicated `lint.yml` / `test.yml`
workflow. Shell-script linting (`shellcheck`) and Astro type checks
(`astro check`) run only locally and via pre-commit. Adding a
PR-blocking lint job is tracked in [../../BACKLOG.md](../../BACKLOG.md).

## 3. Secrets

Secrets referenced by the workflows, listed by name. Values live in
GitHub → Settings → Secrets and variables → Actions.

| Name | Kind | Used by | Rotation |
|---|---|---|---|
| `CLOUDFLARE_API_TOKEN` | repo secret | `pages-deploy.yml`, `mvp-deploy.yml` | Rotate in Cloudflare dashboard → API Tokens; update the secret. Quarterly, or on maintainer turnover. |
| `CLOUDFLARE_ACCOUNT_ID` | repo secret | both Pages workflows | Stable; rotate only if the account itself changes. |
| `GH_TOKEN` | repo secret | `pages-deploy.yml` build step (site generates release data at build time) | Fine-grained PAT, read-only contents/releases on `pai-os/pai`. Rotate on 90-day expiry. |
| `GPG_KEY_FINGERPRINT` | repo variable | `pages-deploy.yml` build (displayed in site footer) | Public data; rotate when the release-signing key rotates. |
| `GITHUB_TOKEN` | auto-provided | `build.yml` release step | Managed by GitHub; no rotation needed. |

Secrets are never echoed in logs. If a secret is ever exposed in a
log, rotate immediately and force-push over the log (GitHub retains
old logs until the workflow run is deleted).

## 4. Self-hosted runners

**None.** All jobs run on GitHub-hosted `ubuntu-latest` runners. This
is a deliberate security posture: self-hosted runners executing
untrusted PR code is a well-known attack vector, and PAI accepts
community PRs.

If self-hosted runners are ever added (e.g., for arm64 ISO builds),
they must:

- Be ephemeral (one job per VM, destroyed after).
- Never run on PRs from forks without maintainer approval
  (`pull_request_target` is **not** a substitute — use environments
  with required reviewers).
- Live on an isolated network with no access to production secrets
  beyond what the job strictly needs.

## 5. Release automation

Automated:

- Tagging `vX.Y.Z` triggers `build.yml`.
- `build.yml` builds the ISO, computes SHA256, and drafts a GitHub
  Release with `generate_release_notes: true`.
- Artifacts (`pai-<version>-amd64.iso`, `.sha256`, `SHA256SUMS`) are
  attached to the release automatically.

Manual:

- Writing the human-readable changelog in the release body (auto
  notes are a starting point, not the final version).
- Minisign signature over `SHA256SUMS` (keys are offline — see
  [../deployment.md#signing-keys](../deployment.md#4-signing-keys--key-management)).
- Toggling a release from "draft" to "published".
- Posting the announcement (website changelog entry, social, mailing
  list).
- Updating the "latest stable" pointer if this release is promoted.

Full procedure: [../../RELEASE.md](../RELEASE.md).

## 6. Branch protection

`main` is protected:

- **Required status checks:** `Build PAI ISO`, `Deploy to Cloudflare
  Pages`.
- **Required reviews:** 1 approving review from a
  [MAINTAINERS](../MAINTAINERS.md) member.
- **Require branches up to date:** yes.
- **Force pushes:** disabled.
- **Deletions:** disabled.
- **Linear history:** preferred (squash or rebase merge).

Tag protection: `v*` tags can only be created by maintainers.

## 7. Cost & quota awareness

PAI uses GitHub's free tier for public repos (unlimited Actions
minutes). Watch for:

- **Artifact storage cap.** Free tier = 500 MB total for private
  repos; public repos are effectively unmetered but Cloudflare and
  user trust are not. `build.yml` uses `retention-days: 14` on ISO
  artifacts so CI builds expire automatically; release artifacts
  persist forever and count against repo storage.
- **Cloudflare Pages free tier:** 500 builds/month, unlimited
  bandwidth, unlimited requests. `pages-deploy.yml` fires on every
  push to main and every PR; heavy PR activity can push toward the
  limit. The `cancel-in-progress` concurrency guard mitigates this
  somewhat.
- **GitHub Release asset size:** 2 GB/file. PAI ISOs are ~1.3 GB — a
  comfortable margin, but arm64 + amd64 + checksums + signatures is
  worth monitoring.

## See also

- [../../RELEASE.md](../RELEASE.md) — full release runbook.
- [../deployment.md](../deployment.md) — what CD actually deploys.
- [debugging.md](debugging.md) — when CI fails, start here.
- [../../SECURITY.md](../security.md) — supply-chain posture.
