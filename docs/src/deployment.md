---
title: Deployment
description: How PAI ships — ISO artifacts to GitHub Releases and a static website to Cloudflare Pages. No always-on backend.
---

# Deployment

## 1. What "deploy" means in PAI

PAI has **no always-on backend**. There are no application servers,
no managed databases, no Kubernetes clusters, no on-call rotation for
an API. Everything PAI produces is an artifact that users run
themselves on their own hardware.

"Deployment" in PAI therefore means exactly two things:

1. **Publishing ISO images** to GitHub Releases so users can download
   and flash them.
2. **Publishing the website** so users can learn about PAI, read the
   docs, and find the releases.

Both are append-only-ish publishing operations, not service
operations. If every server we run disappeared overnight, every PAI
user's live USB would continue to work unchanged. That property is
deliberate — see [PHILOSOPHY.md](PHILOSOPHY.md).

## 2. ISO release deployment

ISOs are built in CI by
[.github/workflows/build.yml](../.github/workflows/build.yml) and
attached to a GitHub Release when a `v*` tag is pushed. The complete
runbook — tag format, signing, announcement, post-release checks —
lives in [RELEASE.md](RELEASE.md). This page covers only the
deployment-adjacent concerns.

The distribution surface is GitHub Releases: free, CDN-backed,
content-addressable via commit SHA, and already trusted by users who
clone the repo. There is no mirror infrastructure and no plan to add
one; users who need offline distribution can verify and
re-redistribute the ISO themselves.

## 3. Website deployment

The website lives under [../website/](../website/) and is built with
[Astro](https://astro.build). Deployment is driven by
[.github/workflows/pages-deploy.yml](../.github/workflows/pages-deploy.yml).

- **Host:** Cloudflare Pages, project `pai-direct`.
- **Build command:** `npm run build` run from `website/` on Node 22.
- **Publish directory:** `website/dist/`.
- **Production branch:** `main` → `https://pai.direct` (custom
  domain).
- **Preview deploys:** every PR gets a Cloudflare preview URL,
  posted as a sticky comment by the workflow. Previews live on
  `*.pai-direct.pages.dev`.
- **MVP landing page:** an older `docs/`-only flow lives at
  [mvp-deploy.yml](../.github/workflows/mvp-deploy.yml) and targets
  the `pai-direct-mvp` project. Frozen; scheduled for removal.

### Custom domain

`pai.direct` points at Cloudflare Pages via a CNAME managed in the
Cloudflare dashboard for the same account. TLS is handled
automatically by Cloudflare (Universal SSL). DNS and domain
registration are tracked in [MAINTAINERS.md](MAINTAINERS.md).

### Cache purge

Cloudflare Pages invalidates its edge cache automatically on each
deploy, so no manual purge is needed for normal releases. If you need
a manual purge (e.g., after fixing a cached error page), use the
Cloudflare dashboard: **Caching → Configuration → Purge Everything**,
or the API:

```bash
curl -X POST \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

## 4. Signing keys & key management

PAI releases carry two independent signatures:

- **Minisign** over `SHA256SUMS`. The minisign public key is
  committed to the repo and pinned on the website; the private key
  lives on an offline maintainer-controlled device and never touches
  CI.
- **GPG** over release tags (`git tag -s`). The public key
  fingerprint is exposed to the site via the `GPG_KEY_FINGERPRINT`
  repo variable (see [development/ci-cd.md §3](development/ci-cd.md#3-secrets)).

Neither key is available to GitHub Actions. Signing is a manual step
performed by a release maintainer (see [RELEASE.md](RELEASE.md)).
This is intentional: no workflow can forge a PAI release, because no
workflow has the material to sign one.

**Access:** keys are held by the maintainers listed in
[MAINTAINERS.md](MAINTAINERS.md). At least two maintainers hold a
copy (on separate offline media) to survive device loss. Keys are
**not** escrowed with any third party.

**Rotation cadence:**

- Minisign signing key: rotate every 2 years or on suspected
  compromise. Announce the new public key in the release notes of
  the first release signed with it, and leave the old key published
  for verifying historical releases.
- GPG key: follow the key's configured expiry (extend annually).
  Rotate immediately on compromise.

Key rotation is documented in [SECURITY.md](security.md).

## 5. Rollback

### ISOs

You cannot unpublish a GitHub Release that users have already
downloaded, and you shouldn't try — the checksum is the contract. To
roll back:

1. Mark the bad release as **"Pre-release"** or edit its notes to
   prefix `⚠ DEPRECATED — see vX.Y.(Z+1)`.
2. Point the website's "latest stable" link and any `latest` release
   alias at the previous known-good version.
3. Cut a fix release (`vX.Y.Z+1`) as soon as practical. A rollback is
   a stopgap, not a resolution.
4. Add a note to [KNOWN_ISSUES.md](KNOWN_ISSUES.md).

Never delete a release entry — users verifying an older checksum
should still find it. Deprecate visibly instead.

### Website

Cloudflare Pages retains every deployment. To roll back:

1. In the Cloudflare Pages dashboard → project `pai-direct` →
   **Deployments**, find the last known-good deployment.
2. Click **… → Rollback to this deployment**.

Or re-deploy the previous commit from GitHub by reverting the bad
commit on `main`; the workflow will publish the revert automatically.

## 6. Monitoring

PAI's monitoring is deliberately minimal, because there is no system
to page on:

- **Release download counts** — visible on the GitHub Releases page
  and via `gh api repos/pai-os/pai/releases`. Used as a lagging
  popularity and adoption signal, not for alerting.
- **Website uptime** — an external probe (UptimeRobot or equivalent;
  **TODO:** confirm current provider) checks `https://pai.direct`
  every 5 minutes and notifies maintainers on prolonged outage.
  Cloudflare's own analytics cover traffic and error rates.
- **Crowd-sourced issue detection** — GitHub Issues is the primary
  signal for "something is broken." With no telemetry in the ISO (by
  design — see [PRIVACY.md](PRIVACY.md)), we rely on users to
  report problems.
- **CI health** — GitHub Actions surface failed workflows in the
  repo's Actions tab and via email to maintainers.

There is no APM, no log aggregation, no synthetic transaction
monitoring. If you find yourself wanting one of those, you are
probably looking at the wrong problem — PAI is software users install,
not a service we operate.

## See also

- [RELEASE.md](RELEASE.md) — step-by-step release runbook.
- [development/ci-cd.md](development/ci-cd.md) — the pipelines that
  drive these deployments.
- [development/debugging.md](development/debugging.md) — when a
  deploy goes wrong.
- [SECURITY.md](security.md) — supply-chain and key-management
  posture.
- [PHILOSOPHY.md](PHILOSOPHY.md) — why there is no backend.
