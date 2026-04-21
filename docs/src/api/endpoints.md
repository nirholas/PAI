---
title: Ollama HTTP Endpoints
description: The Ollama HTTP endpoints PAI depends on, with request/response schemas and curl examples.
category: api
status: stable
---

# Ollama HTTP Endpoints

All examples assume Ollama is running locally and reachable at
`http://127.0.0.1:11434`. PAI starts Ollama via `ollama.service`. See
[reference.md](./reference.md) for the loopback posture and the known
`OLLAMA_HOST=0.0.0.0` caveat.

> **Warning — exposing Ollama beyond loopback.** These endpoints have no
> authentication. Do not bind to a public interface without adding your
> own auth layer (reverse proxy, SSH tunnel, VPN).

Schemas below are summaries. The upstream Ollama API docs are the source
of truth; if you find a discrepancy, trust upstream.

---

## `POST /api/generate`

Single-turn completion from a prompt.

**Request body**

```json
{
  "model": "phi3:mini",
  "prompt": "Why is the sky blue?",
  "stream": true,
  "options": { "temperature": 0.7 }
}
```

**Response**

NDJSON stream (one JSON object per line) when `stream: true` (default).
Each chunk has a `response` field with a token fragment and `done:
false`, terminated by a final object with `done: true` and summary
fields (`total_duration`, `eval_count`, etc.). With `stream: false`, a
single JSON object is returned.

**Errors**

- `404` — unknown model. Pull it first (`/api/pull` or
  `ollama pull`).
- `400` — malformed body.
- `500` — runtime error (out of memory, GPU failure).

**Example**

```bash
curl http://127.0.0.1:11434/api/generate \
  -d '{"model":"phi3:mini","prompt":"Say hi","stream":false}'
```

---

## `POST /api/chat`

Multi-turn chat completion. Preferred over `/api/generate` for
conversational use because it preserves role structure.

**Request body**

```json
{
  "model": "phi3:mini",
  "messages": [
    { "role": "system", "content": "You are terse." },
    { "role": "user", "content": "Hello." }
  ],
  "stream": true
}
```

**Response**

NDJSON stream. Each chunk contains a `message` object (`role`,
`content`) and `done`. Final chunk has `done: true` plus duration/token
counts.

**Errors**

- Same as `/api/generate`.

**Example**

```bash
curl http://127.0.0.1:11434/api/chat \
  -d '{"model":"phi3:mini","messages":[{"role":"user","content":"hi"}],"stream":false}'
```

---

## `GET /api/tags`

List locally installed models.

**Response**

```json
{
  "models": [
    {
      "name": "phi3:mini",
      "modified_at": "2026-03-01T12:00:00Z",
      "size": 2147483648,
      "digest": "sha256:…"
    }
  ]
}
```

**Example**

```bash
curl http://127.0.0.1:11434/api/tags
```

---

## `POST /api/show`

Show metadata for a model (modelfile, parameters, template, license).

**Request body**

```json
{ "name": "phi3:mini" }
```

**Response**

JSON object with `modelfile`, `parameters`, `template`, `details`.

**Example**

```bash
curl http://127.0.0.1:11434/api/show -d '{"name":"phi3:mini"}'
```

---

## `POST /api/pull`

Download a model from the Ollama registry.

**Request body**

```json
{ "name": "llama3.2:3b", "stream": true }
```

**Response**

NDJSON progress stream (`status`, `digest`, `total`, `completed`).
Terminates with `{ "status": "success" }`.

**Errors**

- `404` — model not in registry.
- Network errors if egress is blocked by UFW. PAI firewall defaults
  deny outbound; you must allow DNS + HTTPS to the Ollama registry for
  pulls to succeed. See
  [`shared/hooks/live/0500-firewall.hook.chroot`](../../shared/hooks/live/0500-firewall.hook.chroot).

**Example**

```bash
curl http://127.0.0.1:11434/api/pull -d '{"name":"llama3.2:3b"}'
```

---

## `DELETE /api/delete`

Remove an installed model.

**Request body**

```json
{ "name": "llama3.2:3b" }
```

**Response**

`200 OK` on success, `404` if not found.

**Example**

```bash
curl -X DELETE http://127.0.0.1:11434/api/delete \
  -d '{"name":"llama3.2:3b"}'
```

---

## `POST /api/embeddings`

Compute embedding vectors for a prompt.

**Request body**

```json
{ "model": "nomic-embed-text", "prompt": "hello world" }
```

**Response**

```json
{ "embedding": [0.0123, -0.456, ...] }
```

**Example**

```bash
curl http://127.0.0.1:11434/api/embeddings \
  -d '{"model":"nomic-embed-text","prompt":"hello"}'
```

---

## `GET /api/ps`

List models currently loaded in memory.

**Response**

```json
{
  "models": [
    { "name": "phi3:mini", "size_vram": 2147483648, "expires_at": "…" }
  ]
}
```

**Example**

```bash
curl http://127.0.0.1:11434/api/ps
```

---

## Streaming semantics

`/api/generate`, `/api/chat`, and `/api/pull` stream NDJSON by default.
Each newline-terminated line is one JSON object. A client should parse
line-by-line and stop when it sees `"done": true` (generate/chat) or
`"status": "success"` (pull).

To disable streaming and receive a single JSON response on
generate/chat, set `"stream": false`.

---

## Differences from upstream

PAI ships upstream Ollama unchanged. Only *how* it is launched differs:

| Setting              | PAI default                           | Configured in |
| -------------------- | ------------------------------------- | ------------- |
| Bind address         | `0.0.0.0:11434` (see caveat)          | [`shared/includes/etc/systemd/system/ollama.service`](../../shared/includes/etc/systemd/system/ollama.service) |
| User / group         | `ollama` / `ollama`                   | same |
| Model storage path   | `/usr/share/ollama/.ollama/models`    | `HOME=/usr/share/ollama` in the unit file |
| Auto-start on boot   | Enabled via `WantedBy=multi-user.target` | same |
| Firewall             | UFW default-deny inbound/outbound     | [`shared/hooks/live/0500-firewall.hook.chroot`](../../shared/hooks/live/0500-firewall.hook.chroot) |

No PAI-specific HTTP endpoints are added, removed, or renamed.
