# Internationalization (i18n)

## 1. What "i18n" covers in PAI

Internationalization in PAI spans three distinct surfaces, each with
its own maturity and its own contributor path:

1. **OS locale** — keyboard layouts, timezone, glibc locales, input
   methods for non-Latin scripts.
2. **Shipped applications** — the browser, wallet(s), Ollama CLI and
   other bundled tools. Each ships with its upstream localization,
   which varies from "complete" to "English only".
3. **Project materials** — this README, the `/docs/` tree, the
   website, error messages in PAI-specific scripts.

Conflating these three leads to confusion. A user asking "is PAI
available in Spanish?" may mean any of them. This document addresses
each separately.

## 2. Current state

**English is the only fully supported language for project materials
today.** Documentation, the website, commit messages, issue templates,
and PAI-specific scripts are English-only. We state this plainly so
non-English speakers can make an informed decision before adopting
PAI.

The OS locale and shipped-application surfaces are in better shape:
most bundled software supports dozens of languages out of the box, and
PAI does not strip or override those translations.

## 3. Supported OS locales

PAI ships the full Debian locale set. Any locale available via
`locale-gen` can be enabled. At first boot users can select:

- keyboard layout (from the standard X11/Wayland layout registry),
- timezone,
- primary UI locale.

**Input methods** for non-Latin scripts are available:

- **ibus** (default) with engines for CJK, Indic, Thai, and more.
- **fcitx5** as an alternative, preferred by some Chinese and
  Vietnamese users.

Switching input methods is documented in the user guide. We test
CJK (Chinese/Japanese/Korean) and a representative Indic script
(Devanagari) on each release; other scripts rely on upstream coverage.

## 4. Translation strategy for docs

Community-led, per-language subdirectories:

```
/docs/            ← English, source of truth
/docs/es/         ← Spanish
/docs/pt-BR/      ← Brazilian Portuguese
/docs/zh-Hans/    ← Simplified Chinese
...
```

The **English tree is canonical**. When English changes, translations
may lag; we do not block English-side changes on translator
availability. Translations that fall badly out of date will be marked
with a staleness banner and, if abandoned for more than two release
cycles, may be archived.

Language codes follow BCP 47 (`es`, `pt-BR`, `zh-Hans`, `zh-Hant`,
`ar`, etc.).

## 5. How to contribute a translation

1. **Fork** the repository.
2. **Copy** the English `/docs/` tree into `/docs/<lang>/`, preserving
   file names and structure.
3. **Translate** the content. Keep code blocks, command names, and
   file paths in their original form.
4. **Follow** the style guide in [prompts/documentation/](prompts/documentation/),
   adapted for your language (formality, punctuation conventions,
   script-specific typography).
5. **Cross-reference** the glossary (section 9) so key terms stay
   consistent with other translators working on the same language.
6. **Open a PR**. Tag it with `i18n` and the language code. A
   native-speaker reviewer will be requested; if none is available
   yet, the PR waits rather than merging unreviewed.

See [CONTRIBUTING.md](https://github.com/nirholas/pai/blob/main/CONTRIBUTING.md) for general contribution
workflow.

## 6. Quality standards

- **No machine-translation-only submissions.** Using MT as a first
  draft is fine — and often sensible — but the submitter must read
  the output end-to-end, fix errors, and take responsibility for the
  result. PRs that are obviously raw MT output will be closed.
- **Native-speaker review preferred.** For the first PR in a new
  language, we ask for at least one native-speaker reviewer before
  merging. Subsequent PRs in an established translation can be merged
  with fluent-speaker review.
- **Consistency over literalness.** Follow the glossary (section 9).
  A consistently translated term beats a more elegant but one-off
  choice.
- **Preserve meaning, not word count.** Translations should read as
  native text, not as transliterated English.

## 7. Website i18n

The website uses Astro content collections, which support
multi-language routing natively. The plan:

- `/` — English (default).
- `/<lang>/...` — translated routes, mirroring the English
  information architecture.
- A language switcher in the site header.
- `hreflang` tags on every translated page for search engines.

**Status:** not yet implemented. Until the Astro routing lands,
translated content lives under `/docs/<lang>/` in the repo and is
surfaced once the routing ships. Progress is tracked in
[ROADMAP.md](roadmap.md) under Phase 2 · *Translation infrastructure*.

## 8. RTL support

PAI commits to proper right-to-left rendering on the website for
Arabic, Hebrew, Persian/Farsi, and Urdu. This means:

- `dir="rtl"` set on translated pages.
- Logical CSS properties (`margin-inline-start`, `padding-inline-end`,
  `border-inline`, …) rather than physical left/right properties.
- Mirrored icons where direction is meaningful (e.g., back/forward
  arrows); untouched where it is not (e.g., a hamburger icon).
- Bidirectional text handling audited on mixed LTR/RTL passages
  (code blocks, URLs, English technical terms inside Arabic prose).

RTL regressions are treated as release blockers in translated pages,
the same as LTR regressions are on the English site.

## 9. Terminology glossary per language

A small lexicon keeps translators consistent. Terms to fix per
language include at minimum:

- **persistence** (the encrypted storage across reboots)
- **live session** (non-persistent boot)
- **encrypted** / **encryption**
- **seed phrase** / **recovery phrase**
- **wallet**
- **Tor** (proper noun — do not translate)
- **relay** (Tor sense vs. generic networking sense)
- **amnesic** (the property of forgetting between sessions)
- **compositor**, **shell**, **image** (technical senses)

The glossary lives alongside each translation at
`/docs/<lang>/GLOSSARY.md`. When translators disagree on a term, the
existing glossary entry wins for the duration of the current release
cycle; changes happen by PR with discussion.

## 10. Priority language wishlist

Based on the demographics of privacy-tool users and the scripts and
regions where PAI is most useful, our priority wishlist is:

1. **Spanish** (`es`)
2. **Portuguese** — Brazilian (`pt-BR`) and European (`pt-PT`)
3. **Russian** (`ru`)
4. **Mandarin Chinese** — Simplified (`zh-Hans`) and Traditional (`zh-Hant`)
5. **Arabic** (`ar`) — first major RTL target
6. **French** (`fr`)
7. **German** (`de`)
8. **Japanese** (`ja`)

This is a wishlist, not a commitment or a ranking of importance.
Translators who want to work on a language not listed here are equally
welcome — file an issue tagged `i18n` and we will coordinate.

See [ROADMAP.md](roadmap.md) for scheduled i18n infrastructure work
and [CONTRIBUTING.md](https://github.com/nirholas/pai/blob/main/CONTRIBUTING.md) for how to get started.
