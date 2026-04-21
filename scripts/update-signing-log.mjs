#!/usr/bin/env node
/**
 * Update website/src/data/signing.json with signed artifact metadata.
 *
 * Usage:
 *   node scripts/update-signing-log.mjs --tag v0.2.0 --files signed/flash.ps1
 *
 * Called from .github/workflows/sign-scripts.yml after SignPath completes.
 */

import { createHash } from 'crypto'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REPO_ROOT = resolve(__dirname, '..')
const SIGNING_JSON = resolve(REPO_ROOT, 'website/src/data/signing.json')

const MAX_ENTRIES = 10

function parseArgs() {
  const args = process.argv.slice(2)
  let tag = ''
  const files = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tag' && args[i + 1]) {
      tag = args[++i]
    } else if (args[i] === '--files') {
      while (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        files.push(args[++i])
      }
    }
  }
  if (!tag || files.length === 0) {
    console.error('Usage: update-signing-log.mjs --tag <tag> --files <file1> [file2...]')
    process.exit(1)
  }
  return { tag, files }
}

function loadSigningJson() {
  if (!existsSync(SIGNING_JSON)) {
    return { publisher: '', thumbprint: '', auditLogUrl: '', releases: [] }
  }
  return JSON.parse(readFileSync(SIGNING_JSON, 'utf8'))
}

function computeSha256(filePath) {
  const resolved = resolve(process.cwd(), filePath)
  if (!existsSync(resolved)) {
    console.warn(`[update-signing-log] File not found: ${resolved}`)
    return null
  }
  const bytes = readFileSync(resolved)
  return createHash('sha256').update(bytes).digest('hex')
}

function main() {
  const { tag, files } = parseArgs()
  const data = loadSigningJson()

  const artifacts = []
  for (const filePath of files) {
    const sha256 = computeSha256(filePath)
    if (sha256) {
      const name = filePath.split('/').pop()
      artifacts.push({ name, sha256 })
    }
  }

  if (artifacts.length === 0) {
    console.error('[update-signing-log] No artifacts processed successfully.')
    process.exit(1)
  }

  const entry = {
    tag,
    timestamp: new Date().toISOString(),
    artifacts,
  }

  data.releases.unshift(entry)
  data.releases = data.releases.slice(0, MAX_ENTRIES)

  writeFileSync(SIGNING_JSON, JSON.stringify(data, null, 2) + '\n', 'utf8')
  console.log(`[update-signing-log] Logged ${artifacts.length} artifact(s) for ${tag}`)
}

main()
