---
title: SDK and Helper Scripts
description: PAI-shipped shell helpers, recommended client libraries, and scripting examples.
category: api
status: experimental
---

# SDK and Helper Scripts

PAI does **not** ship a dedicated client SDK (no `pai` Python package,
no TypeScript library). What it does ship is a handful of shell aliases
and functions that wrap the `ollama` CLI, plus the standard Ollama HTTP
API described in [endpoints.md](./endpoints.md).

> **Seed document.** As PAI grows its own helpers (richer CLIs, a Python
> module, etc.), this page will be expanded. Today it is mostly a map of
> what exists plus recommended patterns for users scripting on top.

> **Warning.** Every example here assumes Ollama is loopback-only. If
> you expose the API on a LAN or public interface, you must add your
> own authentication — see [reference.md](./reference.md).

---

## Shipped helpers

All of the following live in
[`shared/includes/etc/profile.d/pai-aliases.sh`](../../shared/includes/etc/profile.d/pai-aliases.sh)
and are available in any interactive shell on a PAI system.

| Name          | Kind     | Stability    | What it does |
| ------------- | -------- | ------------ | ------------ |
| `ask`         | alias    | stable       | `ollama run` — interactive chat with a named model. |
| `models`      | alias    | stable       | `ollama list` — show installed models. |
| `pull`        | alias    | stable       | `ollama pull` — download a model. |
| `chat`        | alias    | experimental | Opens the Open WebUI front-end in Firefox at `http://localhost:8080`. |
| `pai-ask`     | function | experimental | One-shot prompt: `pai-ask "what is X?"`. Uses `$PAI_MODEL` (default `phi3:mini`). |
| `pai-code`    | function | experimental | Prepends "Write code for:" to the prompt. |
| `pai-explain` | function | experimental | Prepends "Explain this simply:" to the prompt. |

### Flags and environment

- `PAI_MODEL` — picks the model used by `pai-ask`, `pai-code`,
  `pai-explain`. Defaults to `phi3:mini`.
- No other flags. These wrappers pass stdin to `ollama run`.

### Example

```bash
# Use the default model
pai-ask "summarize the Bill of Rights in three bullets"

# Pick a bigger model for one command
PAI_MODEL=llama3.2:3b pai-explain "how does a diode work"

# Pipe a file in
cat report.md | pai-ask "summarize this in 5 bullets"
```

---

## Recommended libraries for scripting

PAI doesn't need to supply a client — the Ollama ecosystem already has
good ones.

- **`ollama` (Python)** — `pip install ollama`. Best fit for Python
  scripts.
- **`ollama` (JavaScript)** — `npm install ollama`. Works in Node and
  the browser.
- **`curl` + `jq`** — for shell scripts and pipelines. `jq` handles
  NDJSON cleanly with `-c` and stream processing.

---

## Minimal examples

### Summarize a file with the local model (shell)

```bash
#!/usr/bin/env bash
set -euo pipefail
MODEL="${PAI_MODEL:-phi3:mini}"
FILE="$1"

jq -Rns --arg m "$MODEL" --arg p "Summarize:\n$(cat "$FILE")" \
  '{model:$m, prompt:$p, stream:false}' \
| curl -sS http://127.0.0.1:11434/api/generate -d @- \
| jq -r '.response'
```

### Summarize a file (Python)

```python
import ollama, sys

with open(sys.argv[1]) as f:
    text = f.read()

resp = ollama.generate(
    model="phi3:mini",
    prompt=f"Summarize:\n{text}",
)
print(resp["response"])
```

### Generate release notes from `git log`

```bash
git log --oneline "$(git describe --tags --abbrev=0)..HEAD" \
| pai-ask "turn these commits into user-facing release notes, grouped by category"
```

### Ask a question while routed through Tor

PAI ships a Tor edition (see [editions.md](../editions.md)). The model
runs locally, so the prompt never leaves the machine — but if your
script *fetches* context from the network (say, a URL), route that
fetch through Tor:

```bash
# Fetch through Tor, then pass the body to the local model.
torsocks curl -sS https://example.com/article.html \
| pai-ask "summarize this article in plain English"
```

The `pai-ask` call itself hits `127.0.0.1:11434` and does not traverse
Tor — that's correct, because there is no remote call to anonymize.

---

## What is NOT provided (yet)

- A first-class Python/TypeScript SDK named `pai`.
- A plugin/extension API.
- Long-lived session or conversation state management beyond what
  `/api/chat` offers per-request.
- Auth, RBAC, or multi-tenant support.

Proposals for these belong in [BACKLOG.md](../../BACKLOG.md) and, if
accepted, as ADRs under [docs/adr/](../adr/).
