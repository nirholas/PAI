---
title: Contributing to the docs
description: How to write, structure, and ship changes to PAI's documentation — covers what lives where, the style guide, frontmatter, diagrams, screenshots, and the CI link checker.
order: 200
updated: 2026-04-17
---

# Contributing to the docs

## 1. Why documentation matters

PAI is a security-sensitive, multi-audience project: people installing
it need a quickstart, operators need architecture detail, and the AI
agents that consume this repo (via `AGENTS.md` and the skills tree)
need structured, predictable content. Good docs are how we keep those
audiences from diverging. A feature without docs isn't finished, and a
doc page without a cross-link is almost invisible — so treat
documentation as part of the change, not something to follow up on.

## 2. What lives where

PAI has three documentation surfaces. Put content in the surface that
matches the audience:

| Surface | Path | Audience | Examples |
| --- | --- | --- | --- |
| Repo-root `.md` files | `/*.md` | Anyone browsing the source on GitHub | [README.md](https://github.com/nirholas/pai/blob/main/README.md), [FAQ.md](reference/faq.md), [GLOSSARY.md](reference/glossary.md), [SECURITY.md](security.md) |
| Docs site | `/docs/**/*.md` | Readers of the rendered site | [getting-started.md](./getting-started.md), [architecture.md](./architecture.md), [reference/faq.md](./reference/faq.md) |
| Authoring prompts | `/prompts/documentation/NN-*.md` | Agents and humans generating the above | [prompts/documentation/INDEX.md](../prompts/documentation/INDEX.md) |

Rules of thumb:

- If two surfaces overlap (e.g. root `FAQ.md` and
  `docs/reference/faq.md`), the root version is the canonical short
  form and the site version enriches with links. Keep them in sync on
  the same PR.
- Never write primary content into a prompt file; prompts describe
  *how* to generate docs, not the docs themselves.
- If you can't decide: prefer `/docs/`, then link to it from the
  relevant root file.

## 3. Style guide

PAI's documentation follows the conventions in
[agents/docs-agent.md](../agents/docs-agent.md). Highlights:

- **Sentence-case headings.** "Getting started," not "Getting Started."
- **Active voice.** "PAI signs each release" beats "Releases are signed
  by PAI."
- **Oxford comma.** Always.
- **No marketing language.** No "revolutionary," "seamlessly,"
  "unleash," or emojis in prose. Describe what the software does.
- **Brand is "PAI."** Never "PAI," never "pai," never "P.A.I."
- **Short paragraphs, concrete examples.** Prefer a three-line example
  over a ten-line description.
- **Link liberally.** Any term defined in the
  [glossary](./reference/glossary.md) should link to it on first use
  per page. Any concept explained in depth elsewhere should link to
  that page rather than repeating.
- **Code fences get a language tag** (` ```bash `, ` ```yaml `,
  ` ```astro `). Untagged fences don't syntax-highlight.

## 4. Frontmatter requirements

Every page under `/docs/` needs YAML frontmatter. Four fields are
required:

```yaml
---
title: Getting started
description: A one-sentence summary that shows up in search results and link previews.
order: 20
updated: 2026-04-17
---
```

- **`title`** — sentence-case, matches the first `#` heading in
  meaning but may be shorter.
- **`description`** — one sentence, under ~160 characters. Used by
  the search index at
  [website/src/pages/search-index.json.ts](../website/src/pages/search-index.json.ts)
  and by social link previews.
- **`order`** — integer; controls position in
  [DocsSidebar.astro](../website/src/components/DocsSidebar.astro).
  Lower numbers come first. Leave gaps (10, 20, 30) so new pages can
  slot in without renumbering.
- **`updated`** — ISO date (`YYYY-MM-DD`). Bump on every material
  content edit, not on typo fixes.

The schema is enforced by
[website/src/content.config.ts](../website/src/content.config.ts); a
missing or mistyped field fails the build.

## 5. Adding a new page

1. **Pick the right directory.** `docs/` top level is for landing,
   quickstart, installation, configuration. Subdirectories group by
   audience: `usage/`, `architecture/`, `development/`, `api/`,
   `agents/`, `reference/`, `adr/`.
2. **Name the file in kebab-case.** `persistent-storage.md`, not
   `PersistentStorage.md` or `persistent_storage.md`. The slug in the
   URL is the filename minus `.md`.
3. **Write the frontmatter first.** Pick an `order` that slots your
   page into the sidebar where a reader would expect to find it;
   check neighboring files' `order` values.
4. **Link to and from it.** Add at least one inbound link from a
   parent page (quickstart, overview, architecture) so the page is
   discoverable without the sidebar.
5. **Sidebar.** You do not need to edit
   [DocsSidebar.astro](../website/src/components/DocsSidebar.astro)
   directly; it reads the frontmatter of every file in `docs/` and
   sorts by `order`. If your page doesn't appear, check the
   frontmatter.
6. **Diagrams and images.** Place Mermaid source inline (see below).
   Raster images live in
   [website/public/](../website/public/) and are referenced from
   `/assets/<name>` in the rendered site; source SVGs and brand
   assets live in [branding/](../branding/).

## 6. Diagrams

- **Inline Mermaid** for anything that fits the Mermaid grammar —
  flowcharts, sequence diagrams, state machines. Mermaid renders
  client-side on the docs site:

  ````markdown
  ```mermaid
  flowchart LR
    usb([USB boot]) --> initramfs --> squashfs --> overlayfs --> session
  ```
  ````

- **Author SVGs** for anything Mermaid can't express cleanly —
  block diagrams with asymmetric layout, annotated screenshots,
  architecture posters. Source SVGs go in
  [branding/](../branding/); exports go to
  [website/public/](../website/public/) and are referenced as
  `/assets/<name>.svg`.
- **Don't commit binary diagram sources** (`.drawio`, `.fig`, `.sketch`)
  without also committing the exported SVG; readers should never need
  a proprietary tool to see the rendered diagram.

## 7. Screenshots

- **Placeholder convention.** If you need a screenshot that doesn't
  exist yet, reference
  `![alt text](../branding/TODO.png)` and open an issue tagged
  `docs-screenshot`. The placeholder file lives at
  [branding/TODO.png](../branding/TODO.png) so the build doesn't
  break.
- **Redact sensitive data.** Every screenshot must be reviewed for:
  real wallet addresses, seed phrases, email addresses, IP addresses,
  MAC addresses, hostnames, serial numbers, and anything else that
  could identify the author or the machine. When in doubt, blur or
  replace with obvious fakes (`test@example.com`,
  `192.0.2.1`). PRs containing un-redacted sensitive data will be
  closed without merge.
- **Prefer SVG or lossless PNG.** No JPEG for UI screenshots — text
  artifacts are unacceptable.
- **Alt text is required** and should describe the screenshot, not
  just label it ("PAI boot menu with the AMD64 entry highlighted,"
  not "screenshot").

## 8. Link checker

CI runs a link checker against the rendered site on every PR. It
flags:

- broken internal links (wrong path, wrong anchor),
- dead external links (4xx / 5xx / timeout),
- links to files that exist but have no frontmatter (and therefore
  aren't part of the docs site).

To run it locally before pushing:

```bash
cd website
npm install
npm run build
npm run check-links
```

The link checker honors a `.linkcheck-ignore` file at the repo root
for known-flaky external domains; add sparingly and include a comment
explaining why.

## 9. Writing for AI agents

PAI's docs are consumed by more than humans. The repo-root
`AGENTS.md` (and the skills tree under
[skills/](../skills/)) point agents at specific files and headings.
That means:

- **Descriptive headings.** "Boot sequence" beats "Overview." An
  agent searching for "how PAI boots" should find your heading by its
  words.
- **Stable anchors.** Don't rename headings unless you mean to break
  every inbound link. If you must, add a short stub under the old
  name that links to the new one for one release.
- **Self-contained sections.** An agent may read one section without
  the rest of the page. State the subject at the top of each section
  rather than relying on a two-paragraphs-up antecedent.
- **Concrete commands and paths.** Agents follow exact strings.
  "Edit `website/src/content.config.ts`" is actionable; "edit the
  config file" is not.
- **Keep the [glossary](./reference/glossary.md) and
  [FAQ](./reference/faq.md) current.** These are the two pages agents
  hit most often when resolving an unfamiliar term or question.

---

Questions about these guidelines? Open an issue or start a thread in
the repo. The [docs-agent](../agents/docs-agent.md) is the
authoritative source for anything this page doesn't cover.
