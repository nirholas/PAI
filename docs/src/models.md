---
title: Models
description: How to pull new AI models in PAI, what hardware each model requires, and how to manage model storage.
updated: 2026-04-19
---

# Models

PAI uses [Ollama](https://ollama.com/) to run local language models. This page explains which models ship with PAI, how to add new ones, and what hardware each size class needs.

---

## Pre-installed models

PAI ships with two models pulled and ready to use:

| Model | Parameters | Best for |
|---|---|---|
| **Llama 3.2** | 3B | General conversation, quick Q&A, low-RAM machines |
| **Mistral** | 7B | Reasoning, writing, coding — needs 8 GB+ RAM |

Both are available immediately in Open WebUI's model selector. No download required.

---

## RAM requirements by model size

Ollama runs models in CPU-only mode (GPU libraries are stripped to keep the ISO small). RAM is the main constraint.

| Model size | Min RAM | Examples |
|---|---|---|
| 1–3B | 4 GB | Llama 3.2 3B, Phi-3 Mini, Gemma 2B |
| 7B | 8 GB | Mistral 7B, Llama 3.1 7B, Qwen2 7B |
| 13B | 16 GB | Llama 2 13B, Codellama 13B |
| 30B+ | 32 GB+ | Llama 3.1 70B (Q4 quantization, 40 GB RAM) |

These are minimums. More RAM means faster inference — Ollama can keep more of the model's key-value cache in memory.

**Inference speed (rough guide, CPU-only):**

| RAM / cores | 3B model | 7B model |
|---|---|---|
| 8 GB / 4 cores | ~10–15 tok/s | ~4–6 tok/s |
| 16 GB / 8 cores | ~15–25 tok/s | ~8–12 tok/s |
| 32 GB / 16 cores | ~25–40 tok/s | ~15–25 tok/s |

AVX2 support (most CPUs since 2013) helps significantly. AVX-512 (some Intel Skylake-X, Ice Lake, and newer) roughly doubles throughput on compatible models.

---

## Pulling a new model

Open a terminal (`Alt + Return`) and run:

```bash
ollama pull <model-name>
```

Examples:

```bash
ollama pull phi3:mini          # 2.3 GB, good on 4 GB machines
ollama pull llama3.1:8b        # 4.9 GB, solid all-rounder
ollama pull qwen2:7b           # 4.4 GB, strong multilingual
ollama pull deepseek-coder:7b  # 4.2 GB, code generation
ollama pull gemma2:9b          # 5.4 GB, strong reasoning
```

Full model library: [ollama.com/library](https://ollama.com/library)

> **On a live session without persistence**, models are downloaded into RAM and lost on shutdown. Enable [persistence](persistence/introduction.md) to keep models across reboots.

---

## Managing models

```bash
# List downloaded models
ollama list

# Remove a model (free up RAM / persistent storage)
ollama rm <model-name>

# Show model info (size, parameters, quantization)
ollama show <model-name>

# Chat directly in the terminal
ollama run <model-name>
ollama run <model-name> "your prompt here"
```

---

## Choosing the right model

**For general use on 8 GB RAM:**
Start with `llama3.2` (already installed). It's fast, capable, and fits comfortably.

**For coding:**
`deepseek-coder:6.7b` or `codellama:7b` — both fit in 8 GB and handle Python, JavaScript, Go, and most common languages.

**For longer documents or analysis:**
Use `mistral:7b` (already installed). Its 32K context window handles large pastes without truncation.

**For privacy-sensitive writing:**
Any model works equally well from a privacy standpoint — they all run locally. Pick the one that fits your RAM.

**For multilingual use:**
`qwen2:7b` handles Chinese, Japanese, Korean, and European languages better than Llama or Mistral.

---

## Running a model from the terminal vs Open WebUI

Both are equivalent — both talk to the same local Ollama server.

Use **Open WebUI** (`localhost:8080`) for:
- Conversations with history
- Switching models mid-session
- Uploading files or images (when supported by the model)

Use **`ollama run`** in the terminal for:
- Quick one-off questions
- Piping output to other tools
- Scripting

```bash
# Pipe a file to a model
cat report.txt | ollama run mistral "Summarize this in 3 bullet points"

# Generate a commit message
git diff --cached | ollama run deepseek-coder "Write a concise git commit message for these changes"
```
