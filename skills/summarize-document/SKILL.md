---
name: summarize-document
description: Summarize a document at a requested length.
version: 0.1.0
status: stable
category: files
network: none
preferred_model: qwen2.5:3b
triggers:
  - summarize this document
  - give me the tldr of this file
  - shorten this document to a paragraph
  - summarize this pdf
  - give me a summary of this file
inputs:
  - name: path
    type: path
    required: true
    description: Path to a PDF, DOCX, ODT, MD, TXT, or HTML file.
  - name: length
    type: string
    required: false
    description: "short | medium | long (default medium)"
  - name: style
    type: string
    required: false
    description: "plain (default) | bullets | executive"
outputs:
  - summary text in the chosen style and length
constraints:
  - must not upload the file
  - must refuse to process files > 50 MB without user_confirm
examples:
  - prompt: "Summarize this research paper as bullet points"
    expected: "bullets-style medium summary without network access"
  - prompt: "Give me a short tldr of this file"
    expected: "plain short summary, a few sentences"
---

# summarize-document

Summarize a PDF, DOCX, ODT, MD, TXT, or HTML file locally with no network access.
Uses a map-reduce chunking strategy so large documents are handled without truncation.

Related docs: [../../SKILLS.md](../../SKILLS.md), [../SKILL.md](../SKILL.md).

## 1. Purpose

Produce a concise, well-structured summary of any supported document at a
user-chosen length and style, entirely offline. Useful for research papers,
contracts, meeting notes, and long web pages saved as HTML.

## 2. Instructions

1. **Size guard.** Check the file size. If > 50 MB, prompt `user_confirm` before
   continuing; abort on decline.
2. **Extract text** based on file extension:
   - `.pdf` — `pdftotext -layout <path> -`
   - `.docx` / `.odt` — `pandoc --to plain <path>`
   - `.html` / `.htm` — `pandoc --strip-comments --to plain <path>`
   - `.md` / `.txt` / `.rst` — read raw
3. **Chunk** the extracted text into ~3000-token windows with a 200-token overlap.
   Approximate token count as `len(text.split()) * 1.3`.
4. **Map:** send each chunk to the model with the prompt:
   > "Summarize this passage in 3-5 sentences. Be factual; do not add information."
5. **Reduce:** concatenate the per-chunk summaries and send to the model with the
   target length instruction:
   - `short` — 2-4 sentences total
   - `medium` (default) — 1 paragraph (~150 words)
   - `long` — 3-5 paragraphs
6. **Apply style:**
   - `plain` (default) — flowing prose
   - `bullets` — unordered `-` list, one item per key point
   - `executive` — 3 sentences, then **Key decisions:** and **Open questions:** sections
7. Emit the summary. Do not emit the extracted text unless `--verbose` is set.

## 3. Guardrails

- Never upload or transmit the document.
- No em dashes in output prose; use commas or parentheses instead.
- If the file extension is not in the supported list, report the type and exit; do not guess.
- If `pdftotext` or `pandoc` is not installed, emit a clear installation hint rather than failing silently.

## 4. Example session

```
User:  Summarize ~/Documents/lease.pdf in bullets
Agent: Extracting text from lease.pdf (142 KB)...
       Chunking into 4 windows...
       Summarizing...

       - Lease term: 12 months starting 2026-06-01.
       - Monthly rent: $1,850 due on the 1st; $50/day late fee after the 5th.
       - Pet policy: one cat or dog under 25 lb with a $500 deposit.
       - Termination: 60-day written notice required from either party.
       - Utilities: tenant pays electric and internet; landlord pays water and trash.
```

## 5. Testing

Run from the skill root:

```bash
bash tests/test_basic.sh
python3 tests/test_chunking.py
python3 tests/test_length_targets.py
```

See [tests/](tests/) for details. Fixtures in [fixtures/](fixtures/).

## 6. Changelog

- `0.1.0` — Initial skill: map-reduce summarizer, three length targets, three styles.