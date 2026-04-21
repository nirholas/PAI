---
title: Ollama API
description: How to talk to the local Ollama daemon — HTTP endpoints, examples, and auth notes.
audience: developers
---

# Ollama API

PAI ships Ollama with its HTTP API bound to `127.0.0.1:11434`. Any
process running in your local session can reach it; nothing on the
network can.

## Base URL

```
http://127.0.0.1:11434
```

No authentication. Loopback-only binding is the access control;
this is by design for a local workstation.

## Commonly used endpoints

### `POST /api/generate` — single-turn completion

```
curl http://127.0.0.1:11434/api/generate -d '{
  "model": "llama3.2",
  "prompt": "Explain overlayfs in one paragraph.",
  "stream": false
}'
```

### `POST /api/chat` — multi-turn with roles

```
curl http://127.0.0.1:11434/api/chat -d '{
  "model": "llama3.2",
  "messages": [
    {"role": "user", "content": "Summarise the PAI threat model."}
  ],
  "stream": false
}'
```

### `POST /api/embeddings` — embedding vectors

```
curl http://127.0.0.1:11434/api/embeddings -d '{
  "model": "nomic-embed-text",
  "prompt": "private AI on a bootable USB"
}'
```

### `GET /api/tags` — list local models

```
curl http://127.0.0.1:11434/api/tags
```

## Streaming

Set `"stream": true` to get a sequence of newline-delimited JSON
objects. Useful for chat UIs and anything that needs incremental
output.

## Python SDK

The official `ollama` Python package is preinstalled:

```python
import ollama
for chunk in ollama.chat(model="llama3.2", messages=[
    {"role": "user", "content": "hello"}
], stream=True):
    print(chunk["message"]["content"], end="", flush=True)
```

## Full reference

The complete endpoint list and request/response schemas are in
Ollama's upstream docs. PAI follows upstream exactly — we don't
fork the API surface. See also:

- [endpoints.md](endpoints.md) — system-wide endpoint inventory.
- [reference.md](reference.md) — canonical API reference.
- [sdk.md](sdk.md) — language SDK notes.
- [cli-json-shapes.md](cli-json-shapes.md) — shapes emitted by PAI
  CLI tools.

## Privacy posture

Requests never leave loopback. See
[../architecture/ai-stack.md](../architecture/ai-stack.md) and
[../architecture/network.md](../architecture/network.md).
