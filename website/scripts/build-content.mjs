#!/usr/bin/env node
/**
 * Prebuild content pipeline.
 * Copies repo docs → src/content/docs/*.md
 * Pulls GitHub releases → src/content/changelog/*.md
 * Copies SECURITY.md when it exists.
 *
 * Run automatically via `prebuild`/`predev` npm scripts.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'fs'
import { join, basename, extname } from 'path'

const ROOT = new URL('../../', import.meta.url).pathname.replace(/\/$/, '')
const CONTENT_DOCS = new URL('../src/content/docs/', import.meta.url).pathname
const CONTENT_CHANGELOG = new URL('../src/content/changelog/', import.meta.url).pathname

mkdirSync(CONTENT_DOCS, { recursive: true })
mkdirSync(CONTENT_CHANGELOG, { recursive: true })

// Clear Astro's build-time data store so stale content entries don't carry over
const BUILD_STORE = new URL('../node_modules/.astro/data-store.json', import.meta.url).pathname
if (existsSync(BUILD_STORE)) {
  rmSync(BUILD_STORE)
  console.log('[build-content] cleared node_modules/.astro/data-store.json')
}

// ── 1. Copy README.md ─────────────────────────────────────────────────────────

const readmePath = join(ROOT, 'README.md')
if (existsSync(readmePath)) {
  const raw = readFileSync(readmePath, 'utf8')
  // Strip shield badges and HTML alignment tags from README for clean MDX
  const clean = raw
    .replace(/<p align="center">[\s\S]*?<\/p>\n?/g, '')
    .replace(/!\[.*?\]\(https:\/\/img\.shields\.io.*?\)\n?/g, '')
    // README.md uses repo-relative image paths (e.g. branding/foo.png);
    // rewrite them to absolute public paths so Astro resolves them to
    // website/public/branding/*.
    .replace(/(!\[[^\]]*\]\()(branding\/)/g, '$1/$2')
    .trimStart()

  const md = `---
title: "PAI Overview"
description: "Complete overview of PAI — what it is, how it works, and how to use it."
section: "Reference"
order: 10
editPath: "README.md"
---

${clean}`

  writeFileSync(join(CONTENT_DOCS, 'overview.md'), md)
  console.log('[build-content] wrote docs/overview.md from README.md')
}

// ── 2. Copy docs/*.md ─────────────────────────────────────────────────────────

const DOCS_DIR = join(ROOT, 'docs')
const DOC_META = {
  'architecture.md': { title: 'Architecture', section: 'Reference', order: 2, desc: 'PAI system architecture, boot sequence, and component overview.' },
  'USB-FLASHING.md': { title: 'USB Flashing Guide', section: 'Guides', order: 6, desc: 'Detailed instructions for flashing PAI to a USB drive.' },
  'editions.md': { title: 'Editions', section: 'Reference', order: 11, desc: 'PAI Desktop, Web, and ARM64 edition differences.' },
}

if (existsSync(DOCS_DIR)) {
  const files = readdirSync(DOCS_DIR).filter(
    (f) => f.endsWith('.md') && !['BUILD-PLAN.md', 'LANDING-PAGE.md'].includes(f)
  )

  for (const file of files) {
    const meta = DOC_META[file]
    if (!meta) continue

    const slug = file.toLowerCase().replace(/\.md$/, '').replace(/[^a-z0-9]+/g, '-')
    const outPath = join(CONTENT_DOCS, `${slug}.md`)

    // Don't overwrite hand-crafted seed files that have more detail
    const handcrafted = ['architecture.md', 'usb-flashing.md']
    if (handcrafted.includes(`${slug}.md`) && existsSync(outPath)) {
      console.log(`[build-content] skipping ${slug}.md (hand-crafted seed exists)`)
      continue
    }

    const body = readFileSync(join(DOCS_DIR, file), 'utf8')
    const md = `---
title: "${meta.title}"
description: "${meta.desc}"
section: "${meta.section}"
order: ${meta.order}
editPath: "docs/${file}"
---

${body}`

    writeFileSync(outPath, md)
    console.log(`[build-content] wrote docs/${slug}.md from docs/${file}`)
  }
}

// ── 3. Copy SECURITY.md ───────────────────────────────────────────────────────

const secPath = join(ROOT, 'SECURITY.md')
if (existsSync(secPath)) {
  const body = readFileSync(secPath, 'utf8')
  const md = `---
title: "Security Policy"
description: "PAI security policy, threat model, and vulnerability disclosure."
section: "Reference"
order: 20
editPath: "SECURITY.md"
---

${body}`
  writeFileSync(join(CONTENT_DOCS, 'security-policy.md'), md)
  console.log('[build-content] wrote docs/security-policy.md from SECURITY.md')
}

// ── 4. Pull GitHub Releases ───────────────────────────────────────────────────

async function fetchReleases() {
  const REPO = process.env.PAI_REPO || 'nirholas/pai'
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''

  // The repo is private; anonymous requests get 404. If no token is present,
  // skip the fetch quietly — the changelog page falls back to committed seed
  // entries, and the production deploy environment should provide a token.
  if (!token) {
    console.log('[build-content] skipping releases fetch (no GITHUB_TOKEN)')
    return []
  }

  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'pai-build-content/1.0',
    Authorization: `Bearer ${token}`,
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=20`, { headers })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}${body ? `: ${body.slice(0, 160)}` : ''}`)
    }
    const releases = await res.json()
    return releases.map((r) => ({
      tagName: r.tag_name,
      body: r.body ?? '',
      publishedAt: r.published_at,
      isPrerelease: r.prerelease,
    }))
  } catch (err) {
    console.warn('[build-content] could not fetch releases:', err.message)
    return []
  }
}

const releases = await fetchReleases()

for (const release of releases) {
  const { tagName, body, publishedAt, isPrerelease } = release
  const slug = tagName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const date = new Date(publishedAt).toISOString().split('T')[0]
  const githubUrl = `https://github.com/nirholas/pai/releases/tag/${tagName}`

  const md = `---
title: "${tagName}"
date: "${date}"
description: "${body?.split('\n')[0]?.slice(0, 120) ?? ''}"
stable: ${!isPrerelease}
githubUrl: "${githubUrl}"
---

${body || '_No release notes._'}`

  writeFileSync(join(CONTENT_CHANGELOG, `${slug}.md`), md)
  console.log(`[build-content] wrote changelog/${slug}.md`)
}

if (releases.length > 0) {
  // Remove placeholder seed if real releases exist
  const placeholderPath = join(CONTENT_CHANGELOG, 'v0-1-0.md')
  if (existsSync(placeholderPath) && releases.length > 0) {
    import('fs').then(({ unlinkSync }) => {
      try { unlinkSync(placeholderPath) } catch {}
    })
  }
}

console.log('[build-content] done.')
