// Hardcoded keyboard shortcut reference. If window.hotkeys (Tranche 1)
// is present at runtime, callers may prefer its live registry; this
// module provides a stable fallback so the Shortcuts app always has
// something to display.

export interface Shortcut {
  keys: string
  label: string
}

export interface ShortcutGroup {
  id: string
  title: string
  items: Shortcut[]
}

export const SHORTCUTS: ShortcutGroup[] = [
  {
    id: 'windows',
    title: 'Window management',
    items: [
      { keys: 'Alt+Tab', label: 'Cycle focused window' },
      { keys: 'Alt+F4', label: 'Close focused window' },
      { keys: 'Super+Left', label: 'Snap window to left half' },
      { keys: 'Super+Right', label: 'Snap window to right half' },
      { keys: 'Super+Up', label: 'Maximize window' },
      { keys: 'Super+Down', label: 'Restore / minimize window' },
      { keys: 'Super+D', label: 'Show desktop' },
      { keys: 'Super+1..4', label: 'Switch to workspace 1–4' },
    ],
  },
  {
    id: 'shell',
    title: 'Shell',
    items: [
      { keys: 'Cmd/Ctrl+K', label: 'Open quick search' },
      { keys: 'Alt+D', label: 'Toggle Start menu' },
      { keys: '?', label: 'Open this Shortcuts help' },
      { keys: 'Esc', label: 'Close menu / dialog' },
      { keys: 'Right-click', label: 'Open context menu' },
    ],
  },
  {
    id: 'calc',
    title: 'Calculator',
    items: [
      { keys: '0-9 . +', label: 'Enter number or operator' },
      { keys: '- * /', label: 'Subtract / multiply / divide' },
      { keys: 'Enter / =', label: 'Evaluate' },
      { keys: 'Backspace', label: 'Delete last input' },
      { keys: 'Esc', label: 'Clear' },
    ],
  },
  {
    id: 'notepad',
    title: 'Notepad',
    items: [
      { keys: 'Ctrl+S', label: 'Save file' },
      { keys: 'Ctrl+O', label: 'Open file' },
      { keys: 'Ctrl+N', label: 'New file' },
      { keys: 'Ctrl+F', label: 'Find' },
      { keys: 'Ctrl+Z', label: 'Undo' },
      { keys: 'Ctrl+Y', label: 'Redo' },
    ],
  },
  {
    id: 'music',
    title: 'Music',
    items: [
      { keys: 'Space', label: 'Play / pause' },
      { keys: 'ArrowLeft', label: 'Seek back 5s' },
      { keys: 'ArrowRight', label: 'Seek forward 5s' },
      { keys: 'ArrowUp', label: 'Volume up' },
      { keys: 'ArrowDown', label: 'Volume down' },
      { keys: 'M', label: 'Mute toggle' },
    ],
  },
  {
    id: 'terminal',
    title: 'Terminal',
    items: [
      { keys: 'Ctrl+C', label: 'Cancel current command' },
      { keys: 'Ctrl+L', label: 'Clear screen' },
      { keys: 'ArrowUp/Down', label: 'History navigation' },
      { keys: 'Tab', label: 'Autocomplete' },
    ],
  },
  {
    id: 'files',
    title: 'Files',
    items: [
      { keys: 'Enter', label: 'Open selected file' },
      { keys: 'Arrows', label: 'Navigate tiles' },
      { keys: 'Esc', label: 'Close lightbox' },
      { keys: 'ArrowLeft/Right', label: 'Previous / next in lightbox' },
    ],
  },
]

interface HotkeyRegistryEntry {
  keys: string
  label?: string
  group?: string
}

/**
 * Try to pull live hotkeys from window.hotkeys (registered by Tranche 1).
 * Returns null if no registry is present or it isn't in an expected shape.
 */
export function getLiveHotkeys(): ShortcutGroup[] | null {
  const hk = (window as any).hotkeys
  if (!hk) return null
  const list: HotkeyRegistryEntry[] | undefined =
    typeof hk.list === 'function'
      ? hk.list()
      : Array.isArray(hk.registered)
        ? hk.registered
        : Array.isArray(hk)
          ? (hk as any)
          : undefined
  if (!Array.isArray(list) || list.length === 0) return null

  const groups = new Map<string, ShortcutGroup>()
  for (const entry of list) {
    const gid = entry.group || 'general'
    if (!groups.has(gid)) {
      groups.set(gid, { id: gid, title: gid, items: [] })
    }
    groups.get(gid)!.items.push({
      keys: entry.keys,
      label: entry.label || entry.keys,
    })
  }
  return Array.from(groups.values())
}
