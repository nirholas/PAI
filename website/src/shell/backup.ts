// PAI Shell Backup — export/import all `pai-*` localStorage keys as a
// downloadable JSON file. Local-only — no network calls.

const MAGIC = 'pai.backup'
const VERSION = 1
const PREFIX = 'pai-'
const EXT = '.pai-backup.json'

export interface BackupFile {
  magic: typeof MAGIC
  version: number
  createdAt: string
  hostname: string
  data: Record<string, string>
}

export interface Category {
  id: string
  label: string
  description: string
  match: (key: string) => boolean
}

// Classification for the UI checklist. Keys not matched by any category
// fall under "other". Each key is included only once (first matching
// category wins, tested in order).
export const CATEGORIES: Category[] = [
  {
    id: 'windows',
    label: 'Windows & workspaces',
    description: 'Open windows, workspace layouts, focus stack',
    match: (k) => k.startsWith('pai-wm-') || k === 'pai-ws',
  },
  {
    id: 'desktop',
    label: 'Desktop layout',
    description: 'Desktop icons, wallpaper, pinned items',
    match: (k) =>
      k.startsWith('pai-desktop-') ||
      k.startsWith('pai-wallpaper') ||
      k.startsWith('pai-pinned') ||
      k.startsWith('pai-icon-'),
  },
  {
    id: 'settings',
    label: 'Settings',
    description: 'Reduced motion, sound, theme preferences',
    match: (k) =>
      k.startsWith('pai-setting-') ||
      k === 'pai-reduced-motion' ||
      k === 'pai-sound' ||
      k === 'pai-theme' ||
      k.startsWith('pai-perm-'),
  },
  {
    id: 'appdata',
    label: 'App data',
    description: 'Per-app state (notepad, terminal, chat, etc.)',
    match: (k) =>
      k.startsWith('pai-app-') ||
      k.startsWith('pai-notepad-') ||
      k.startsWith('pai-terminal-') ||
      k.startsWith('pai-chat-'),
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Anything else with a pai- prefix',
    match: () => true, // catch-all — MUST be last
  },
]

function allPaiKeys(): string[] {
  const keys: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(PREFIX)) keys.push(k)
    }
  } catch {}
  keys.sort()
  return keys
}

export function categorize(keys: string[]): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const cat of CATEGORIES) out.set(cat.id, [])
  for (const key of keys) {
    for (const cat of CATEGORIES) {
      if (cat.match(key)) {
        out.get(cat.id)!.push(key)
        break
      }
    }
  }
  return out
}

/** Summary of current state (without exporting). */
export function summary(): { total: number; byCategory: Record<string, number>; bytes: number } {
  const keys = allPaiKeys()
  const cats = categorize(keys)
  const byCategory: Record<string, number> = {}
  let bytes = 0
  for (const [id, ks] of cats) byCategory[id] = ks.length
  for (const k of keys) {
    try {
      const v = localStorage.getItem(k) ?? ''
      bytes += k.length + v.length
    } catch {}
  }
  return { total: keys.length, byCategory, bytes }
}

function gatherData(selected: Set<string>): Record<string, string> {
  const data: Record<string, string> = {}
  const keys = allPaiKeys()
  const cats = categorize(keys)
  for (const cat of CATEGORIES) {
    if (!selected.has(cat.id)) continue
    for (const key of cats.get(cat.id) ?? []) {
      try {
        const v = localStorage.getItem(key)
        if (v !== null) data[key] = v
      } catch {}
    }
  }
  return data
}

export function exportToFile(selectedCategories?: string[]): void {
  const selected = new Set<string>(
    selectedCategories && selectedCategories.length
      ? selectedCategories
      : CATEGORIES.map((c) => c.id),
  )

  const file: BackupFile = {
    magic: MAGIC,
    version: VERSION,
    createdAt: new Date().toISOString(),
    hostname: 'pai.direct',
    data: gatherData(selected),
  }

  const blob = new Blob([JSON.stringify(file, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  a.href = url
  a.download = `pai-backup-${ts}${EXT}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export async function importFromFile(
  file: File,
  opts: { wipeFirst?: boolean } = {},
): Promise<{ restored: number; skipped: number }> {
  const text = await file.text()
  let parsed: BackupFile
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Not a valid JSON file')
  }
  if (parsed.magic !== MAGIC) {
    throw new Error('Not a PAI backup file (missing magic marker)')
  }
  if (parsed.version !== VERSION) {
    throw new Error(`Unsupported backup version: ${parsed.version}`)
  }
  if (!parsed.data || typeof parsed.data !== 'object') {
    throw new Error('Backup file has no data')
  }

  if (opts.wipeFirst) {
    for (const k of allPaiKeys()) {
      try {
        localStorage.removeItem(k)
      } catch {}
    }
  }

  let restored = 0,
    skipped = 0
  for (const [key, value] of Object.entries(parsed.data)) {
    if (!key.startsWith(PREFIX)) {
      skipped++
      continue
    }
    if (typeof value !== 'string') {
      skipped++
      continue
    }
    try {
      localStorage.setItem(key, value)
      restored++
    } catch {
      skipped++
    }
  }
  return { restored, skipped }
}

export const backup = {
  summary,
  exportToFile,
  importFromFile,
  CATEGORIES,
}
