#!/usr/bin/env node
// Bundles PAI press-kit assets (logos + screenshots) into downloadable ZIPs.
// Run: node scripts/build-press-zip.mjs
// Output: public/downloads/pai-logos.zip, public/downloads/pai-screenshots.zip

import { createWriteStream, existsSync, readFileSync } from 'node:fs'
import { mkdir, readdir, stat } from 'node:fs/promises'
import { join, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dir = fileURLToPath(new URL('.', import.meta.url))
const root = resolve(__dir, '..')
const outDir = join(root, 'public', 'downloads')

// Simple ZIP writer (no dependencies — uses local deflate via zlib)
import { deflateRawSync } from 'node:zlib'

await mkdir(outDir, { recursive: true })

/** @param {string} name @param {Array<{name: string, data: Buffer}>} files */
async function writeZip(name, files) {
  const outPath = join(outDir, name)
  const centralDir = []
  const parts = []
  let offset = 0

  for (const { name: fname, data } of files) {
    const compressed = deflateRawSync(data, { level: 6 })
    const useDeflate = compressed.length < data.length
    const payload = useDeflate ? compressed : data
    const method = useDeflate ? 8 : 0

    const fnBuf = Buffer.from(fname)
    const crc = crc32(data)
    const localHeader = buildLocalHeader(fnBuf, method, crc, payload.length, data.length)

    centralDir.push({ fnBuf, method, crc, compressed: payload.length, uncompressed: data.length, offset })
    parts.push(localHeader, payload)
    offset += localHeader.length + payload.length
  }

  const cdBufs = centralDir.map((e) => buildCentralHeader(e.fnBuf, e.method, e.crc, e.compressed, e.uncompressed, e.offset))
  const cdSize = cdBufs.reduce((s, b) => s + b.length, 0)
  const eocd = buildEOCD(centralDir.length, cdSize, offset)

  const zip = Buffer.concat([...parts, ...cdBufs, eocd])
  await import('node:fs/promises').then(m => m.writeFile(outPath, zip))
  console.log(`  ✓ ${name}  (${(zip.length / 1024).toFixed(1)} KB,  ${files.length} files)`)
}

function buildLocalHeader(fnBuf, method, crc, compSize, uncompSize) {
  const buf = Buffer.alloc(30 + fnBuf.length)
  buf.writeUInt32LE(0x04034b50, 0)   // signature
  buf.writeUInt16LE(20, 4)            // version needed
  buf.writeUInt16LE(0, 6)             // flags
  buf.writeUInt16LE(method, 8)        // compression
  buf.writeUInt16LE(0, 10)            // mod time
  buf.writeUInt16LE(0, 12)            // mod date
  buf.writeUInt32LE(crc, 14)
  buf.writeUInt32LE(compSize, 18)
  buf.writeUInt32LE(uncompSize, 22)
  buf.writeUInt16LE(fnBuf.length, 26)
  buf.writeUInt16LE(0, 28)            // extra length
  fnBuf.copy(buf, 30)
  return buf
}

function buildCentralHeader(fnBuf, method, crc, compSize, uncompSize, localOffset) {
  const buf = Buffer.alloc(46 + fnBuf.length)
  buf.writeUInt32LE(0x02014b50, 0)   // signature
  buf.writeUInt16LE(20, 4)            // version made by
  buf.writeUInt16LE(20, 6)            // version needed
  buf.writeUInt16LE(0, 8)             // flags
  buf.writeUInt16LE(method, 10)
  buf.writeUInt16LE(0, 12)
  buf.writeUInt16LE(0, 14)
  buf.writeUInt32LE(crc, 16)
  buf.writeUInt32LE(compSize, 20)
  buf.writeUInt32LE(uncompSize, 24)
  buf.writeUInt16LE(fnBuf.length, 28)
  buf.writeUInt16LE(0, 30)            // extra
  buf.writeUInt16LE(0, 32)            // comment
  buf.writeUInt16LE(0, 34)            // disk start
  buf.writeUInt16LE(0, 36)            // internal attr
  buf.writeUInt32LE(0, 38)            // external attr
  buf.writeUInt32LE(localOffset, 42)
  fnBuf.copy(buf, 46)
  return buf
}

function buildEOCD(count, cdSize, cdOffset) {
  const buf = Buffer.alloc(22)
  buf.writeUInt32LE(0x06054b50, 0)
  buf.writeUInt16LE(0, 4)   // disk number
  buf.writeUInt16LE(0, 6)   // disk with CD
  buf.writeUInt16LE(count, 8)
  buf.writeUInt16LE(count, 10)
  buf.writeUInt32LE(cdSize, 12)
  buf.writeUInt32LE(cdOffset, 16)
  buf.writeUInt16LE(0, 20)  // comment length
  return buf
}

// CRC-32 table
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    t[i] = c
  }
  return t
})()

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

// ── Collect logo files ──────────────────────────────────────────────────────

const logoDir = join(root, 'public', 'logo')
const brandingDir = resolve(root, '..', 'branding')

async function collectFiles(dir, prefix = '') {
  if (!existsSync(dir)) return []
  const entries = await readdir(dir)
  const result = []
  for (const f of entries) {
    const full = join(dir, f)
    const s = await stat(full)
    if (s.isFile()) {
      result.push({ name: prefix + f, data: readFileSync(full) })
    }
  }
  return result
}

console.log('Building press-kit ZIPs…')

const logoFiles = [
  ...await collectFiles(logoDir, 'logos/'),
  ...await collectFiles(brandingDir, 'logos/branding/'),
]

if (logoFiles.length === 0) {
  console.warn('  ⚠  No logo files found — creating placeholder ZIP')
  logoFiles.push({ name: 'logos/README.txt', data: Buffer.from('Logo assets will be here in the next release.\n') })
}

await writeZip('pai-logos.zip', logoFiles)

// ── Collect screenshot files ────────────────────────────────────────────────

const screenshotDir = join(root, 'public', 'screenshots')
const screenshots = await collectFiles(screenshotDir, 'screenshots/')

if (screenshots.length === 0) {
  console.warn('  ⚠  No screenshots found — creating placeholder ZIP')
  screenshots.push({ name: 'screenshots/README.txt', data: Buffer.from('Screenshots will be added with the press-kit release.\n') })
}

await writeZip('pai-screenshots.zip', screenshots)

console.log(`\nDone → ${outDir}`)
