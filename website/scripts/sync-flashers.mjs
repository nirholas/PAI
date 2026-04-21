#!/usr/bin/env node
/**
 * Sync the canonical flashers and try scripts from scripts/ into
 * website/public/ so the site can serve them at stable URLs
 * (/flash.sh, /flash.ps1, /try.sh, /try.ps1).
 * Also emit matching .sha256 siblings in coreutils format
 * (`<hex>  <filename>`), which the post-release smoke test verifies
 * against the fetched flasher body.
 *
 * For flash.ps1 and try.ps1, prefers the **signed** version from the
 * latest GitHub release (Authenticode-signed via SignPath). Falls back
 * to the local scripts/ copy if the release download fails or is
 * unavailable.
 *
 * The signed download uses the GitHub REST API directly (no gh CLI
 * dependency, works on Vercel). Private repos require GITHUB_TOKEN
 * in the environment; without it the build transparently falls back
 * to the unsigned local copy.
 *
 * Runs on `npm run build` and `npm run dev` via the `prebuild`/`predev`
 * hooks in website/package.json. website/public/.gitignore blocks all
 * output files from being committed; /scripts/ is the source of truth.
 *
 * Missing sources are warned about, not fatal, so a partial checkout still
 * builds — but if *no* flashers were found, we exit non-zero so CI fails
 * fast instead of silently deploying an empty /flash.ps1.
 */

import { createHash } from 'crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '../../')
const PUBLIC_DIR = resolve(HERE, '../public')

const REPO = process.env.PAI_REPO || 'nirholas/pai'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''

const FLASHERS = ['flash.sh', 'flash.ps1']
const TRY_SCRIPTS = ['try.sh', 'try.ps1']

// Files that should be fetched from the signed GitHub release when available.
const SIGNED_FLASHERS = new Set(['flash.ps1', 'try.ps1'])

mkdirSync(PUBLIC_DIR, { recursive: true })

function apiHeaders(extra = {}) {
  const h = {
    'user-agent': 'pai-sync-flashers/1.0',
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    ...extra,
  }
  if (GITHUB_TOKEN) h.authorization = `Bearer ${GITHUB_TOKEN}`
  return h
}

let latestReleasePromise = null
async function getLatestRelease() {
  if (!latestReleasePromise) {
    latestReleasePromise = (async () => {
      // /releases/latest excludes prereleases and drafts, so fall back to the
      // full list and take the first entry (GitHub returns them newest-first)
      // when no stable release exists yet.
      const latestRes = await fetch(
        `https://api.github.com/repos/${REPO}/releases/latest`,
        { headers: apiHeaders() },
      )
      if (latestRes.ok) return latestRes.json()
      if (latestRes.status !== 404) {
        const body = await latestRes.text().catch(() => '')
        throw new Error(
          `HTTP ${latestRes.status}${body ? `: ${body.slice(0, 160)}` : ''}`,
        )
      }
      const listRes = await fetch(
        `https://api.github.com/repos/${REPO}/releases?per_page=1`,
        { headers: apiHeaders() },
      )
      if (!listRes.ok) {
        const body = await listRes.text().catch(() => '')
        throw new Error(
          `HTTP ${listRes.status}${body ? `: ${body.slice(0, 160)}` : ''}`,
        )
      }
      const list = await listRes.json()
      if (!Array.isArray(list) || list.length === 0) {
        throw new Error('no releases found')
      }
      return list[0]
    })().catch((err) => {
      latestReleasePromise = null
      throw err
    })
  }
  return latestReleasePromise
}

/**
 * Attempt to download a signed flasher from the latest GitHub release.
 * Returns true on success, false on failure (caller falls back to local copy).
 */
async function tryDownloadSigned(name, dst) {
  if (!GITHUB_TOKEN) {
    console.log(
      `[sync-flashers] no GITHUB_TOKEN; skipping signed download for ${name} (will use local copy)`,
    )
    return false
  }
  try {
    const release = await getLatestRelease()
    const asset = (release.assets || []).find((a) => a.name === name)
    if (!asset) {
      console.log(
        `[sync-flashers] release ${release.tag_name} has no asset "${name}"; using local copy`,
      )
      return false
    }
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/releases/assets/${asset.id}`,
      { headers: apiHeaders({ accept: 'application/octet-stream' }), redirect: 'follow' },
    )
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}${body ? `: ${body.slice(0, 160)}` : ''}`)
    }
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0) throw new Error('asset body is empty')
    writeFileSync(dst, buf)
    console.log(`[sync-flashers] downloaded signed ${name} from release ${release.tag_name}`)
    return true
  } catch (err) {
    console.warn(`[sync-flashers] could not download signed ${name}: ${err.message}`)
    return false
  }
}

let copied = 0
let signed = 0
let unsigned = 0

async function syncFile(name, { allowSigned = false } = {}) {
  const src = resolve(REPO_ROOT, 'scripts', name)
  const dst = resolve(PUBLIC_DIR, name)
  const sha = resolve(PUBLIC_DIR, `${name}.sha256`)

  let usedSigned = false
  if (allowSigned && SIGNED_FLASHERS.has(name)) {
    usedSigned = await tryDownloadSigned(name, dst)
  }

  if (!usedSigned) {
    if (!existsSync(src)) {
      console.warn(`[sync-flashers] SKIP: ${src} does not exist`)
      return
    }
    if (allowSigned && SIGNED_FLASHERS.has(name)) {
      console.warn(`[sync-flashers] WARNING: using unsigned local copy of ${name}`)
    }
    copyFileSync(src, dst)
  }

  const bytes = readFileSync(dst)
  const digest = createHash('sha256').update(bytes).digest('hex')
  writeFileSync(sha, `${digest}  ${name}\n`, 'utf8')
  const { size } = statSync(dst)
  const label = usedSigned ? 'signed' : 'unsigned'
  console.log(
    `[sync-flashers] published ${name} (${size} bytes, sha256=${digest.slice(0, 12)}\u2026, ${label})`,
  )
  if (usedSigned) signed++; else unsigned++
  copied++
}

for (const name of FLASHERS) {
  await syncFile(name, { allowSigned: true })
}

for (const name of TRY_SCRIPTS) {
  await syncFile(name, { allowSigned: SIGNED_FLASHERS.has(name) })
}

if (copied === 0) {
  console.error('[sync-flashers] ERROR: no flashers published — /scripts/ empty?')
  process.exit(1)
}
console.log(`[sync-flashers] done: ${copied} published (${signed} signed, ${unsigned} unsigned)`)
