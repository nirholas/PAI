---
title: AI stack
description: How PAI wires up Ollama, Open WebUI, and the model manager, and where model weights live.
order: 5
updated: 2026-04-20
---

# AI stack

PAI ships a fully local inference stack. Nothing leaves the machine
unless the user explicitly configures it to.

## Components

| Layer          | What                                          | Runs as                          |
| -------------- | --------------------------------------------- | -------------------------------- |
| Inference      | [Ollama](https://ollama.com) daemon           | `ollama.service` (systemd user)  |
| Model manager  | `pai-recommend-model`, `pai-status`           | CLI + waybar module              |
| Chat UI        | [Open WebUI](https://openwebui.com)           | containerised on first use       |
| API surface    | Ollama HTTP API on `127.0.0.1:11434`          | loopback only                    |

See [components.md](components.md) for other subsystems and
[data-flow.md](data-flow.md) for request tracing.

## Storage

Model weights live on the persistence volume at
`/var/lib/ollama/models`. The path is included in the default
`persistence.conf`, so weights survive reboots once persistence is
unlocked. In amnesic mode weights are stored in tmpfs and disappear
at shutdown.

See [storage.md](storage.md) for the overlay layout and
[../persistence/introduction.md](../persistence/introduction.md) for
how the persistence volume is created.

## Network posture

The Ollama API binds to **loopback only**. No port is opened on any
external interface. The firewall (see [network.md](network.md))
drops inbound traffic to 11434 regardless, but the bind is the
primary defence.

Open WebUI talks to Ollama over loopback. The WebUI itself listens
on loopback and is reached via the local browser.

## Choosing and managing models

- [ai/choosing-a-model.md](../ai/choosing-a-model.md) — which model
  fits which hardware.
- [ai/managing-models.md](../ai/managing-models.md) — pulling,
  deleting, and pinning versions.
- [ai/using-ollama.md](../ai/using-ollama.md) — CLI, HTTP, Python.
- [ai/using-open-webui.md](../ai/using-open-webui.md) — chat UI.

## What the AI stack does not do

- Phone home. No analytics, no shared model telemetry.
- Cache prompts or completions outside the Ollama database.
- Route traffic through any remote inference API, even if a remote
  model key is present in the environment.
