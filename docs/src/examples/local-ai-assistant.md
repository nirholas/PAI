---
title: "Local AI assistant: private RAG over your own documents"
description: A practical walkthrough of running a local LLM on PAI with retrieval over a personal document collection — no cloud, no telemetry, no data leaving the stick.
---

# Local AI assistant: private RAG over your own documents

By the end of this guide you will have a local assistant that can
answer questions about your own papers, notes, and PDFs without any
of that material leaving the PAI stick. The weights, the index, the
queries, and the answers all stay on-device.

Complete [getting-started.md](getting-started.md) first — you need Ollama and
persistence already working.

Before committing to this workflow for anything important, read
[../../BENCHMARKS.md](../../BENCHMARKS.md) to calibrate expectations
about speed, and [../../MODEL_CARD.md](../../MODEL_CARD.md) for what
local models will and will not do well.

---

## What you'll build

- A local embedding model for turning documents into vectors
- A local chat model for answering questions
- A vector index over a directory of your files
- A small CLI that asks questions and shows which documents the answer
  came from

**Time:** ~1 hour, plus embedding time (depends on corpus size).
**Disk:** Allow 10–20 GB in persistence for models and index.

---

## Step 1 — Pull the two models you need

You need one model for embeddings (small, fast) and one for chat
(larger, slower). Embedding and chat are different jobs — one model
for both is almost never the right choice.

```sh
ollama pull nomic-embed-text
ollama pull llama3.1:8b-instruct-q4_K_M
```

Adjust the chat model to your hardware. On 8 GB RAM, use a 3B-class
model. On a workstation with a discrete GPU, step up to 13B or larger.
Check [../../BENCHMARKS.md](../../BENCHMARKS.md) for tokens-per-second
on comparable hardware before committing.

---

## Step 2 — Organize your corpus inside persistence

Everything the assistant will read lives in one directory under
persistence so it survives reboots and nothing leaks to tmpfs.

```sh
mkdir -p ~/persist/rag/{docs,index,cache}
ln -sfn ~/persist/rag ~/rag
```

Put your PDFs, markdown, and text files under `~/rag/docs/`. A few
hundred documents is a reasonable starting size; a few thousand will
work but the initial embedding pass is long.

If you're curating research, mirror the directory structure you
already use elsewhere. Flat directories become unsearchable once the
corpus grows.

---

## Step 3 — Install the RAG tooling

PAI ships a small Python toolchain for exactly this. From a terminal:

```sh
pai-rag init ~/rag
```

That creates `~/rag/config.toml` with the defaults wired to the
models you just pulled. Open it and confirm:

- `embedding_model = "nomic-embed-text"`
- `chat_model = "llama3.1:8b-instruct-q4_K_M"`
- `index_path = "~/rag/index"`
- `cache_path = "~/rag/cache"`

If `pai-rag` is not present on your stick, see
[../installation.md](../installation.md#optional-toolchains) for the
install step — it is not in the base image.

---

## Step 4 — Build the index

This is the long step. Run it once; incremental updates are fast.

```sh
pai-rag ingest ~/rag/docs
```

Expect roughly 30–90 seconds per 100 pages on a modern laptop CPU,
faster with a GPU. The tool chunks documents, embeds each chunk, and
writes them to a local vector store under `~/rag/index`.

While it runs, check RAM usage with `htop`. If the process is swapping
heavily, reduce `batch_size` in `config.toml` and try again. Swapping
will make the pass take 10× longer than it should.

---

## Step 5 — Ask your first question

```sh
pai-rag ask "What did the 2023 review say about retrieval failure modes?"
```

The output has three parts:

1. The answer itself.
2. A numbered list of source chunks with filenames and page numbers.
3. A short confidence note about how well the retrieved chunks
   actually supported the answer.

Always read the sources, not just the answer. Local models
hallucinate. RAG reduces hallucination when the answer is in the
corpus; it does not eliminate it, and it does not help at all when
the corpus simply doesn't contain the answer.

---

## Step 6 — Update the index as your corpus grows

When you add new documents to `~/rag/docs/`, ingest only the new
files:

```sh
pai-rag ingest --incremental ~/rag/docs
```

The tool hashes files and skips anything already embedded. A weekly
cron inside persistence is a reasonable default:

```sh
( crontab -l 2>/dev/null; echo "0 6 * * 1 pai-rag ingest --incremental ~/rag/docs" ) | crontab -
```

If you change the embedding model, the index must be rebuilt from
scratch. Old vectors and new queries do not mix.

---

## Step 7 — Keep the assistant honest

Local RAG feels authoritative because it cites sources. That can mask
two failure modes:

- **Retrieval misses.** The right chunk exists but wasn't retrieved,
  so the model answers from prior knowledge instead. Look for
  answers where the cited chunks don't actually contain the claim.
- **Extraction errors.** PDF text extraction is lossy. Tables,
  formulas, and scanned pages often come through garbled. If an
  answer depends on a table, open the original.

A good habit: once a week, pick a question you already know the
answer to and ask the assistant. If it's wrong, tune.

---

## What you learned

- Why embedding and chat are separate model choices.
- How to organize a corpus so it survives reboots.
- How to build and incrementally update a local vector index.
- Why sources matter more than the answer, and how local RAG can
  still be misleading.
- How to keep the system honest as the corpus grows.

---

## Next steps

- For travel with your index, see
  [travel-and-network-hardening.md](travel-and-network-hardening.md) —
  the corpus is often the most sensitive thing on the stick.
- For what local models will not do well, see
  [../../MODEL_CARD.md](../../MODEL_CARD.md).
- For performance numbers by hardware class, see
  [../../BENCHMARKS.md](../../BENCHMARKS.md).
- For the ethics of building personal archives at scale, see
  [../../ETHICS.md](../ETHICS.md#personal-data-archives).
