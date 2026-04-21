---
title: API Reference
description: Index of the local API surfaces exposed by PAI — Ollama HTTP, helper CLIs, and scripting helpers.
category: api
status: stable
---

# API Reference

PAI is a client-side Linux distribution, not a hosted service. "API" in
PAI means the **local** surfaces a user or script can call on their own
machine. There is no PAI cloud, no remote endpoint, and no account.

This page is the index. See also:

- [Endpoints](./endpoints.md) — the Ollama HTTP endpoints PAI relies on.
- [SDK / Helpers](./sdk.md) — PAI-shipped helper scripts and shell
  aliases, plus recommended client libraries.

## The three surfaces

### 1. Ollama HTTP API

The primary programmable surface. Ollama runs as a systemd unit
(`ollama.service`) and exposes an HTTP server that speaks JSON
(streaming NDJSON for generation). This is the authoritative API for
running local models, listing installed models, pulling, embedding, etc.

PAI does not fork Ollama — the HTTP contract is upstream Ollama's. PAI
only configures *how* it is launched (unit file, defaults, firewall).

### 2. PAI helper CLIs

Small shell helpers and aliases installed to the live system (for
example `pai-ask`, `pai-code`, `pai-explain`, `ask`, `models`, `pull`,
`chat`). These are convenience wrappers over the `ollama` CLI — not a
separate API.

Defined in
[`shared/includes/etc/profile.d/pai-aliases.sh`](../../shared/includes/etc/profile.d/pai-aliases.sh).

### 3. PAI scripting SDK

PAI does **not** currently ship a dedicated scripting SDK or Python
package. Users who want to script PAI should use the Ollama HTTP API
directly (via `curl`, the official `ollama` Python/JS packages, or
`jq` for NDJSON). See [sdk.md](./sdk.md).

## Network posture

- The intent is **loopback-only**: API surfaces should only be reachable
  from `127.0.0.1`. Egress is blocked by UFW unless the user explicitly
  opens it.
- **Known caveat:** the shipped `ollama.service` currently sets
  `OLLAMA_HOST=0.0.0.0`, which binds Ollama on all interfaces. On the
  default PAI image, UFW's default-deny inbound policy prevents remote
  access, but users who open ports or disable UFW will expose Ollama on
  the LAN. Tracked in
  [KNOWN_ISSUES.md](../KNOWN_ISSUES.md). To harden, change
  `OLLAMA_HOST` to `127.0.0.1` in
  [`shared/includes/etc/systemd/system/ollama.service`](../../shared/includes/etc/systemd/system/ollama.service).
- **If you intentionally expose Ollama beyond loopback, add your own
  authentication.** Ollama's HTTP API has no built-in auth. Anyone who
  can reach the port can run any installed model, pull new models, or
  delete them.

## Versioning

- **Ollama HTTP API**: follows upstream Ollama's version. PAI pins the
  Ollama binary in
  [`shared/hooks/live/0100-install-ollama.hook.chroot`](../../shared/hooks/live/0100-install-ollama.hook.chroot).
- **PAI helpers and distro**: follow PAI SemVer as described in
  [RELEASE.md](../RELEASE.md). Breaking changes to helper names or
  flags bump the major version.

## Authentication

None by default. PAI trusts the local user on a loopback interface. If
you move the API off loopback, you are responsible for adding auth
(reverse proxy with mTLS, SSH tunnel, WireGuard, etc.).

## Rate limits

None enforced. Performance is bounded by your hardware — see
[BENCHMARKS.md](../../BENCHMARKS.md) and
[PERFORMANCE.md](../../PERFORMANCE.md).
