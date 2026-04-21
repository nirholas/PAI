// Virtual filesystem for PAI shell apps.
//
// Browser-local only: entries live in IndexedDB, scoped to the site origin.
// Designed to be imported from both the shell (same-origin top window) and
// app iframes (same origin, sandbox=allow-same-origin). A BroadcastChannel
// named "pai-vfs" fires on writes so desktop/files/notepad stay in sync.

import manifest from '../files/manifest.json'

// ── Types ────────────────────────────────────────────────────────────────────

export type Kind = 'dir' | 'file'

export interface VfsEntry {
  path: string
  parent: string
  name: string
  kind: Kind
  /** Text content, data URL, or external URL (for seeded items). */
  content?: string
  contentType?: string
  /** Byte length approximation for sorting / quota display. */
  size: number
  /** Seeded entries are read-only (delete/rename forbidden). */
  readOnly?: boolean
  created: number
  modified: number
}

export interface VfsEvent {
  type: 'change'
  paths: string[]
}

// ── Constants ────────────────────────────────────────────────────────────────

const DB_NAME = 'pai-vfs'
const DB_VERSION = 1
const STORE = 'entries'
const CHANNEL = 'pai-vfs'

export const HOME = '/home/user'
export const DESKTOP = `${HOME}/Desktop`
export const DOCUMENTS = `${HOME}/Documents`
export const DOWNLOADS = `${HOME}/Downloads`
export const PICTURES = `${HOME}/Pictures`

// ── Path helpers ─────────────────────────────────────────────────────────────

export function normalize(path: string): string {
  if (!path) return '/'
  const parts = path.split('/').filter(Boolean)
  const stack: string[] = []
  for (const p of parts) {
    if (p === '.') continue
    if (p === '..') stack.pop()
    else stack.push(p)
  }
  return '/' + stack.join('/')
}

export function dirname(path: string): string {
  const n = normalize(path)
  if (n === '/') return '/'
  const i = n.lastIndexOf('/')
  return i <= 0 ? '/' : n.slice(0, i)
}

export function basename(path: string): string {
  const n = normalize(path)
  return n === '/' ? '' : n.slice(n.lastIndexOf('/') + 1)
}

export function joinPath(dir: string, name: string): string {
  if (!name) return normalize(dir)
  if (name.startsWith('/')) return normalize(name)
  return normalize(`${dir}/${name}`)
}

export function extname(path: string): string {
  const base = basename(path)
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot).toLowerCase() : ''
}

// ── Validation ───────────────────────────────────────────────────────────────

const INVALID_NAME = /[\\/\u0000-\u001f]/
export const MAX_NAME_LEN = 128

export function validateName(name: string): string | null {
  if (!name || !name.trim()) return 'Name cannot be empty'
  if (name === '.' || name === '..') return 'Reserved name'
  if (name.length > MAX_NAME_LEN) return `Name too long (max ${MAX_NAME_LEN})`
  if (INVALID_NAME.test(name)) return 'Name contains invalid characters'
  return null
}

// ── IndexedDB plumbing ───────────────────────────────────────────────────────

let _dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'path' })
        store.createIndex('parent', 'parent', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return _dbPromise
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => Promise<T> | T): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode)
        const store = t.objectStore(STORE)
        let out: T
        Promise.resolve(run(store)).then(
          (v) => {
            out = v
          },
          reject,
        )
        t.oncomplete = () => resolve(out)
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error)
      }),
  )
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

// ── Events ───────────────────────────────────────────────────────────────────

let _channel: BroadcastChannel | null = null
const _localListeners = new Set<(e: VfsEvent) => void>()

function getChannel(): BroadcastChannel | null {
  if (_channel) return _channel
  if (typeof BroadcastChannel === 'undefined') return null
  _channel = new BroadcastChannel(CHANNEL)
  _channel.onmessage = (ev) => {
    const data = ev.data as VfsEvent
    if (!data || data.type !== 'change') return
    for (const fn of _localListeners) fn(data)
  }
  return _channel
}

function emit(paths: string[]): void {
  const evt: VfsEvent = { type: 'change', paths }
  for (const fn of _localListeners) fn(evt)
  getChannel()?.postMessage(evt)
}

export function subscribe(fn: (e: VfsEvent) => void): () => void {
  getChannel()
  _localListeners.add(fn)
  return () => _localListeners.delete(fn)
}

// ── Seeding ──────────────────────────────────────────────────────────────────

const WELCOME_README = `Welcome to PAI

This is a virtual file system that lives in your browser.
Anything you save here persists across reloads (same device, same browser).
To clear it, wipe this site's storage in your browser settings.

Tips:
  • Open Notepad from the launcher to create a new text file.
  • Files saved in Desktop/ appear as icons on the desktop.
  • Drop real files from your computer onto the Files window to import them.
  • Right-click an icon for Rename / Delete / Open With.

Have fun — nir
`

async function seedIfEmpty(): Promise<void> {
  const existing = await tx('readonly', (s) => req(s.count()))
  if (existing > 0) return

  const now = Date.now()
  const dirs = [
    '/',
    '/home',
    HOME,
    DESKTOP,
    DOCUMENTS,
    DOWNLOADS,
    PICTURES,
  ]

  await tx('readwrite', (s) => {
    for (const path of dirs) {
      const name = basename(path) || '/'
      const entry: VfsEntry = {
        path,
        parent: path === '/' ? '' : dirname(path),
        name,
        kind: 'dir',
        size: 0,
        readOnly: path !== DESKTOP && path !== DOCUMENTS && path !== DOWNLOADS,
        created: now,
        modified: now,
      }
      s.put(entry)
    }

    const readme: VfsEntry = {
      path: joinPath(DESKTOP, 'README.txt'),
      parent: DESKTOP,
      name: 'README.txt',
      kind: 'file',
      content: WELCOME_README,
      contentType: 'text/plain',
      size: WELCOME_README.length,
      created: now,
      modified: now,
    }
    s.put(readme)

    // Seed screenshots manifest into Pictures as read-only virtual images.
    // content is the public URL; the Files app treats it as an external src.
    for (const item of manifest as Array<{ id: string; src: string; caption: string; alt: string }>) {
      const fileName = `${item.id}.png`
      const entry: VfsEntry = {
        path: joinPath(PICTURES, fileName),
        parent: PICTURES,
        name: fileName,
        kind: 'file',
        content: item.src,
        contentType: 'image/png',
        size: 0,
        readOnly: true,
        created: now,
        modified: now,
      }
      s.put(entry)
    }
  })

  emit([HOME, DESKTOP, PICTURES])
}

let _seedPromise: Promise<void> | null = null
export function ready(): Promise<void> {
  if (!_seedPromise) _seedPromise = seedIfEmpty()
  return _seedPromise
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function get(path: string): Promise<VfsEntry | null> {
  await ready()
  const p = normalize(path)
  const res = await tx('readonly', (s) => req(s.get(p)))
  return (res as VfsEntry | undefined) ?? null
}

export async function exists(path: string): Promise<boolean> {
  return !!(await get(path))
}

export async function list(dirPath: string): Promise<VfsEntry[]> {
  await ready()
  const p = normalize(dirPath)
  const rows = await tx('readonly', (s) => {
    const idx = s.index('parent')
    return req(idx.getAll(IDBKeyRange.only(p)))
  })
  const entries = (rows as VfsEntry[]).slice()
  entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  })
  return entries
}

export async function read(path: string): Promise<string> {
  const entry = await get(path)
  if (!entry) throw new Error(`No such file: ${path}`)
  if (entry.kind !== 'file') throw new Error(`Not a file: ${path}`)
  return entry.content ?? ''
}

async function ensureParent(parent: string): Promise<void> {
  const entry = await get(parent)
  if (!entry) throw new Error(`Parent does not exist: ${parent}`)
  if (entry.kind !== 'dir') throw new Error(`Parent is not a directory: ${parent}`)
}

export async function mkdir(dirPath: string, opts: { silent?: boolean } = {}): Promise<VfsEntry> {
  await ready()
  const p = normalize(dirPath)
  if (p === '/') throw new Error('Cannot create root')
  const parent = dirname(p)
  await ensureParent(parent)
  const existing = await get(p)
  if (existing) {
    if (existing.kind === 'dir') return existing
    throw new Error(`A file already exists at ${p}`)
  }
  const name = basename(p)
  const err = validateName(name)
  if (err) throw new Error(err)
  const now = Date.now()
  const entry: VfsEntry = {
    path: p,
    parent,
    name,
    kind: 'dir',
    size: 0,
    created: now,
    modified: now,
  }
  await tx('readwrite', (s) => req(s.put(entry)))
  if (!opts.silent) emit([parent, p])
  return entry
}

export async function write(
  path: string,
  content: string,
  opts: { contentType?: string; silent?: boolean } = {},
): Promise<VfsEntry> {
  await ready()
  const p = normalize(path)
  const parent = dirname(p)
  await ensureParent(parent)
  const name = basename(p)
  const err = validateName(name)
  if (err) throw new Error(err)
  const prev = await get(p)
  if (prev?.kind === 'dir') throw new Error(`Is a directory: ${p}`)
  if (prev?.readOnly) throw new Error(`Read-only: ${p}`)
  const now = Date.now()
  const entry: VfsEntry = {
    path: p,
    parent,
    name,
    kind: 'file',
    content,
    contentType: opts.contentType ?? prev?.contentType ?? guessContentType(name),
    size: content.length,
    created: prev?.created ?? now,
    modified: now,
  }
  await tx('readwrite', (s) => req(s.put(entry)))
  if (!opts.silent) emit([parent, p])
  return entry
}

export async function remove(path: string): Promise<void> {
  await ready()
  const p = normalize(path)
  if (p === '/' || p === HOME) throw new Error('Cannot delete protected path')
  const entry = await get(p)
  if (!entry) return
  if (entry.readOnly) throw new Error(`Read-only: ${p}`)
  const touched = [entry.parent, p]
  if (entry.kind === 'dir') {
    const descendants = await walkDescendants(p)
    if (descendants.some((d) => d.readOnly)) {
      throw new Error('Folder contains read-only items')
    }
    await tx('readwrite', (s) => {
      for (const d of descendants) s.delete(d.path)
      s.delete(p)
    })
    touched.push(...descendants.map((d) => d.path))
  } else {
    await tx('readwrite', (s) => req(s.delete(p)))
  }
  emit(touched)
}

async function walkDescendants(dirPath: string): Promise<VfsEntry[]> {
  const out: VfsEntry[] = []
  const queue = [dirPath]
  while (queue.length) {
    const d = queue.shift()!
    const kids = await list(d)
    for (const k of kids) {
      out.push(k)
      if (k.kind === 'dir') queue.push(k.path)
    }
  }
  return out
}

export async function rename(path: string, newName: string): Promise<VfsEntry> {
  await ready()
  const p = normalize(path)
  const err = validateName(newName)
  if (err) throw new Error(err)
  const entry = await get(p)
  if (!entry) throw new Error(`No such entry: ${p}`)
  if (entry.readOnly) throw new Error(`Read-only: ${p}`)
  if (entry.name === newName) return entry
  const parent = dirname(p)
  const newPath = joinPath(parent, newName)
  if (await exists(newPath)) throw new Error(`Already exists: ${newName}`)
  return movePath(entry, newPath)
}

export async function move(path: string, newDir: string): Promise<VfsEntry> {
  await ready()
  const p = normalize(path)
  const target = normalize(newDir)
  const entry = await get(p)
  if (!entry) throw new Error(`No such entry: ${p}`)
  if (entry.readOnly) throw new Error(`Read-only: ${p}`)
  const targetDir = await get(target)
  if (!targetDir || targetDir.kind !== 'dir') throw new Error(`Not a directory: ${target}`)
  const newPath = joinPath(target, entry.name)
  if (newPath === p) return entry
  if (await exists(newPath)) throw new Error(`Already exists at target: ${entry.name}`)
  if (entry.kind === 'dir' && (target === p || target.startsWith(p + '/'))) {
    throw new Error('Cannot move a folder into itself')
  }
  return movePath(entry, newPath)
}

async function movePath(entry: VfsEntry, newPath: string): Promise<VfsEntry> {
  const oldPath = entry.path
  const newParent = dirname(newPath)
  const newName = basename(newPath)
  const now = Date.now()
  const touched: string[] = [entry.parent, newParent, oldPath, newPath]
  const descendants = entry.kind === 'dir' ? await walkDescendants(oldPath) : []
  await tx('readwrite', (s) => {
    s.delete(oldPath)
    const moved: VfsEntry = {
      ...entry,
      path: newPath,
      parent: newParent,
      name: newName,
      modified: now,
    }
    s.put(moved)
    for (const d of descendants) {
      s.delete(d.path)
      const rel = d.path.slice(oldPath.length)
      const newChildPath = newPath + rel
      const movedChild: VfsEntry = {
        ...d,
        path: newChildPath,
        parent: newChildPath === newPath ? newParent : dirname(newChildPath),
      }
      s.put(movedChild)
      touched.push(d.path, newChildPath)
    }
  })
  emit(touched)
  const out = await get(newPath)
  return out!
}

export async function totalSize(): Promise<number> {
  await ready()
  const rows = await tx('readonly', (s) => req(s.getAll()))
  let total = 0
  for (const r of rows as VfsEntry[]) total += r.size ?? 0
  return total
}

export async function quotaInfo(): Promise<{ used: number; quota: number }> {
  if (navigator.storage?.estimate) {
    const est = await navigator.storage.estimate()
    return { used: est.usage ?? 0, quota: est.quota ?? 0 }
  }
  return { used: await totalSize(), quota: 0 }
}

// ── Naming helpers ───────────────────────────────────────────────────────────

export async function uniqueName(dir: string, desired: string): Promise<string> {
  const ext = extname(desired)
  const stem = ext ? desired.slice(0, -ext.length) : desired
  let candidate = desired
  let i = 1
  while (await exists(joinPath(dir, candidate))) {
    candidate = `${stem} (${i})${ext}`
    i++
  }
  return candidate
}

// ── Content type sniffing ────────────────────────────────────────────────────

const EXT_TYPES: Record<string, string> = {
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.json': 'application/json',
  '.js': 'text/javascript',
  '.ts': 'text/typescript',
  '.html': 'text/html',
  '.css': 'text/css',
  '.csv': 'text/csv',
  '.log': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
}

export function guessContentType(pathOrName: string): string {
  return EXT_TYPES[extname(pathOrName)] ?? 'application/octet-stream'
}

export function isTextLike(entry: Pick<VfsEntry, 'contentType' | 'name'>): boolean {
  const ct = entry.contentType ?? guessContentType(entry.name)
  return ct.startsWith('text/') || ct === 'application/json'
}

export function isImage(entry: Pick<VfsEntry, 'contentType' | 'name'>): boolean {
  const ct = entry.contentType ?? guessContentType(entry.name)
  return ct.startsWith('image/')
}
