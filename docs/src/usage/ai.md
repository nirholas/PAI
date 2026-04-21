---
title: AI on PAI
description: Run LLMs locally with Ollama and chat through Open WebUI — entirely offline.
audience: everyone
sidebar_order: 4
---

# AI on PAI

PAI ships a complete local AI stack. You can chat with an LLM, run
models from the terminal, or hit the API from your own scripts — all
without a network connection.

## The short version

1. Launch **Open WebUI** from the app menu.
2. Pick a model from the dropdown. The first run downloads weights
   (internet needed here) and stores them on persistent disk.
3. Chat.

That's it. No account, no API key, nothing leaves the machine.

## The pieces

- **Ollama** — the inference daemon. Bound to `127.0.0.1:11434`, so
  it never accepts network traffic from other hosts.
- **Open WebUI** — a familiar chat interface running in your local
  browser.
- **`pai-recommend-model`** — a helper that picks a model that fits
  your RAM and GPU.

## Deeper guides

- [Choosing a model](../ai/choosing-a-model.md) — match the model
  size to your hardware.
- [Managing models](../ai/managing-models.md) — pull, delete, and
  pin versions.
- [Using Ollama](../ai/using-ollama.md) — CLI, HTTP API, Python SDK.
- [Using Open WebUI](../ai/using-open-webui.md) — the chat UI in
  depth.

## How privacy works here

Ollama listens on loopback only. The firewall (see
[../architecture/network.md](../architecture/network.md)) drops
inbound 11434 either way. No prompts, completions, or model
metadata leave the machine. See
[../architecture/ai-stack.md](../architecture/ai-stack.md).

## Offline considerations

Model weights are persistent — once you pull a model with network,
it runs fine air-gapped. To pre-stage models for offline work, see
[../privacy/offline-mode.md](../privacy/offline-mode.md).
