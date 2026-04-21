// PAI — Global keyboard shortcut registry.
//
// Centralises keyboard handling for the shell. Modules register combos with
// metadata (description, category, whether to preventDefault) and a handler.
// A single document-level listener dispatches matching entries in registration
// order. Handlers are skipped when focus is inside an iframe so apps can use
// their own shortcuts.
//
// Combo syntax: modifier(+modifier)*+key. Modifiers: ctrl|alt|shift|meta|super
// (super aliases to meta). Key is case-insensitive; special keys use their
// `KeyboardEvent.key` value (e.g. `ArrowLeft`, `Tab`, `F4`, `Escape`, `?`).
//
// Example:
//   hotkeys.register('ctrl+k', () => openSpotlight(), {
//     description: 'Open spotlight search',
//     category: 'Shell',
//   })

export type HotkeyMeta = {
  description?: string
  category?: string
  /** Prevent default when the combo matches. Defaults to true. */
  preventDefault?: boolean
  /** If true, fire even when focus is inside an iframe. Defaults to false. */
  global?: boolean
}

export type HotkeyEntry = {
  combo: string
  /** Normalised combo used for lookup. */
  normalized: string
  handler: (e: KeyboardEvent) => void
  meta: HotkeyMeta
}

const MOD_KEYS = new Set(['ctrl', 'alt', 'shift', 'meta'])

const entries: HotkeyEntry[] = []

export function normalizeCombo(combo: string): string {
  if (typeof combo !== 'string') return ''
  const parts = combo
    .toLowerCase()
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean)
  const mods: string[] = []
  let key = ''
  for (let p of parts) {
    if (p === 'super' || p === 'cmd' || p === 'win') p = 'meta'
    if (MOD_KEYS.has(p)) {
      if (!mods.includes(p)) mods.push(p)
    } else {
      key = p
    }
  }
  mods.sort()
  return key ? [...mods, key].join('+') : mods.join('+')
}

function comboFromEvent(e: KeyboardEvent): string {
  const mods: string[] = []
  if (e.altKey) mods.push('alt')
  if (e.ctrlKey) mods.push('ctrl')
  if (e.metaKey) mods.push('meta')
  if (e.shiftKey) mods.push('shift')
  mods.sort()
  const key = (e.key ?? '').toLowerCase()
  return key ? [...mods, key].join('+') : mods.join('+')
}

/** Register a hotkey. Returns an unregister function. */
export function register(
  combo: string,
  handler: (e: KeyboardEvent) => void,
  meta: HotkeyMeta = {},
): () => void {
  const normalized = normalizeCombo(combo)
  if (!normalized) return () => {}
  const entry: HotkeyEntry = { combo, normalized, handler, meta }
  entries.push(entry)
  return () => unregisterEntry(entry)
}

function unregisterEntry(entry: HotkeyEntry): void {
  const i = entries.indexOf(entry)
  if (i !== -1) entries.splice(i, 1)
}

/** Unregister the first entry matching this combo. */
export function unregister(combo: string): void {
  const normalized = normalizeCombo(combo)
  const i = entries.findIndex((e) => e.normalized === normalized)
  if (i !== -1) entries.splice(i, 1)
}

/** Return a read-only snapshot of registered hotkeys. */
export function list(): HotkeyEntry[] {
  return entries.slice()
}

/** Pretty-print a combo (ctrl+k → Ctrl+K). */
export function formatCombo(combo: string): string {
  return combo
    .split('+')
    .map((p) => {
      const low = p.toLowerCase()
      if (low === 'meta') return 'Super'
      if (low === 'arrowleft') return '←'
      if (low === 'arrowright') return '→'
      if (low === 'arrowup') return '↑'
      if (low === 'arrowdown') return '↓'
      if (low === ' ') return 'Space'
      if (low.length === 1) return p.toUpperCase()
      return p.charAt(0).toUpperCase() + p.slice(1)
    })
    .join('+')
}

function onKeyDown(e: KeyboardEvent): void {
  const inIframe = (document.activeElement as HTMLElement | null)?.tagName === 'IFRAME'
  const combo = comboFromEvent(e)
  // Iterate in registration order; first matching wins.
  for (const entry of entries) {
    if (entry.normalized !== combo) continue
    if (inIframe && !entry.meta.global) continue
    try {
      entry.handler(e)
    } catch (err) {
      // Keep other hotkeys alive if one throws.
      console.error('[hotkeys] handler threw', err)
    }
    if (entry.meta.preventDefault !== false) e.preventDefault()
    return
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('keydown', onKeyDown)
}

export const hotkeys = {
  register,
  unregister,
  list,
  normalizeCombo,
  formatCombo,
}

if (typeof window !== 'undefined') {
  ;(window as unknown as { hotkeys: typeof hotkeys }).hotkeys = hotkeys
}
