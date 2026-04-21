// Desktop user-file icons — files from the VFS (/home/user/Desktop) rendered
// alongside the static icons in desktop.js. Shares the same grid, the same
// <div id="desktop-icons"> container, and the same .desktop-icon class, so
// CSS and visual treatment stay consistent.

// @ts-ignore — JS module without types
import { wm } from './wm.js'
// @ts-ignore
import { tick } from './sound.ts'
import {
  DESKTOP,
  basename,
  extname,
  isImage,
  isTextLike,
  list,
  remove as vfsRemove,
  rename as vfsRename,
  subscribe,
  validateName,
  type VfsEntry,
} from '../apps/fs/vfs.ts'

const GRID = 96
const ICON_W = 80
const DESKTOP_PAD = 16
const CELL_OFFSET = (GRID - ICON_W) / 2
const DRAG_THRESHOLD = 4
const USER_POS_KEY = 'pai-desktop-user-icons'

interface Pos { col: number; row: number }

function colRowToXY(col: number, row: number) {
  return {
    x: DESKTOP_PAD + col * GRID + CELL_OFFSET,
    y: DESKTOP_PAD + row * GRID + CELL_OFFSET,
  }
}

function loadUserPositions(): Record<string, Pos> {
  try {
    return JSON.parse(localStorage.getItem(USER_POS_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function saveUserPositions(positions: Record<string, Pos>): void {
  try {
    localStorage.setItem(USER_POS_KEY, JSON.stringify(positions))
  } catch {}
}

function applyPosition(el: HTMLElement, col: number, row: number): void {
  const { x, y } = colRowToXY(col, row)
  el.style.left = `${x}px`
  el.style.top = `${y}px`
  el.dataset.col = String(col)
  el.dataset.row = String(row)
}

/** Look at the DOM to decide if a given cell is free, ignoring a specific element. */
function cellOccupied(col: number, row: number, except?: HTMLElement | null): boolean {
  const icons = document.querySelectorAll<HTMLElement>('.desktop-icon')
  for (const icon of icons) {
    if (icon === except) continue
    const c = parseInt(icon.dataset.col ?? '-1', 10)
    const r = parseInt(icon.dataset.row ?? '-1', 10)
    if (c === col && r === row) return true
  }
  return false
}

function findFreeSlot(startCol: number, startRow: number, except?: HTMLElement | null): Pos {
  if (!cellOccupied(startCol, startRow, except)) return { col: startCol, row: startRow }
  for (let r = 0; r < 20; r++) {
    for (let c = 0; c < 20; c++) {
      if (!cellOccupied(c, r, except)) return { col: c, row: r }
    }
  }
  return { col: startCol, row: startRow }
}

function iconGlyphFor(entry: VfsEntry): string {
  if (isImage(entry)) return '🖼'
  const ext = extname(entry.name)
  if (['.md', '.markdown'].includes(ext)) return '📝'
  if (isTextLike(entry)) return '📄'
  return '📦'
}

function openUserFile(entry: VfsEntry): void {
  if (isTextLike(entry)) {
    wm.open('notepad', { params: { path: entry.path } })
  } else if (isImage(entry)) {
    wm.open('files', { params: { path: '/home/user/Pictures' } })
  } else {
    wm.open('files', { params: { path: DESKTOP } })
  }
}

function makeUserIconEl(entry: VfsEntry, positions: Record<string, Pos>): HTMLElement {
  const el = document.createElement('div')
  el.className = 'desktop-icon'
  el.dataset.userFile = '1'
  el.dataset.filePath = entry.path
  el.tabIndex = 0
  el.setAttribute('role', 'button')
  el.setAttribute('aria-label', entry.name)
  el.innerHTML =
    `<div class="desktop-icon__glyph" style="display:flex;align-items:center;justify-content:center;font-size:36px;line-height:1">${iconGlyphFor(entry)}</div>` +
    `<div class="desktop-icon__label">${escapeHtml(entry.name)}</div>`

  let pos = positions[entry.path]
  if (!pos) {
    pos = findFreeSlot(0, 2)
    positions[entry.path] = pos
  } else if (cellOccupied(pos.col, pos.row, null)) {
    pos = findFreeSlot(pos.col, pos.row)
    positions[entry.path] = pos
  }
  applyPosition(el, pos.col, pos.row)
  return el
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  )
}

function bindDrag(el: HTMLElement, entry: VfsEntry, positions: Record<string, Pos>): void {
  el.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return
    e.preventDefault()

    let dragging = false
    const originX = e.clientX
    const originY = e.clientY

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - originX
      const dy = ev.clientY - originY
      if (!dragging && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        dragging = true
        el.classList.add('dragging')
      }
      if (!dragging) return
      const desktop = document.getElementById('pai-desktop')!
      const dr = desktop.getBoundingClientRect()
      const relX = ev.clientX - dr.left - DESKTOP_PAD - CELL_OFFSET
      const relY = ev.clientY - dr.top - DESKTOP_PAD - CELL_OFFSET
      const snapCol = Math.max(0, Math.round(relX / GRID))
      const snapRow = Math.max(0, Math.round(relY / GRID))
      applyPosition(el, snapCol, snapRow)
    }

    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (dragging) {
        el.classList.remove('dragging')
        const col = parseInt(el.dataset.col ?? '0', 10)
        const row = parseInt(el.dataset.row ?? '0', 10)
        const slot = findFreeSlot(col, row, el)
        positions[entry.path] = slot
        saveUserPositions(positions)
        applyPosition(el, slot.col, slot.row)
      } else {
        tick()
        openUserFile(entry)
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  })

  el.addEventListener('dblclick', (e) => {
    e.preventDefault()
    openUserFile(entry)
  })

  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openUserFile(entry)
    } else if (e.key === 'Delete') {
      e.preventDefault()
      doDelete(entry)
    } else if (e.key === 'F2') {
      e.preventDefault()
      doRename(entry)
    }
  })

  el.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    e.stopPropagation()
    showUserFileMenu(entry, e.clientX, e.clientY)
  })
}

function doDelete(entry: VfsEntry): void {
  if (!confirm(`Delete "${entry.name}"?`)) return
  vfsRemove(entry.path).catch((err) => alert(`Delete failed: ${err.message}`))
}

function doRename(entry: VfsEntry): void {
  const next = prompt('Rename to:', entry.name)
  if (!next || next === entry.name) return
  const err = validateName(next.trim())
  if (err) { alert(err); return }
  vfsRename(entry.path, next.trim()).catch((e) => alert(`Rename failed: ${e.message}`))
}

let activeMenu: HTMLElement | null = null

function dismissMenu(): void {
  if (activeMenu) {
    activeMenu.remove()
    activeMenu = null
  }
}

function showUserFileMenu(entry: VfsEntry, x: number, y: number): void {
  dismissMenu()
  const items: Array<{ label: string; action: () => void } | null> = [
    { label: 'Open', action: () => openUserFile(entry) },
  ]
  if (isTextLike(entry)) {
    items.push({ label: 'Open with Notepad', action: () => wm.open('notepad', { params: { path: entry.path } }) })
  }
  items.push({ label: 'Reveal in Files', action: () => wm.open('files', { params: { path: DESKTOP } }) })
  items.push(null)
  if (!entry.readOnly) {
    items.push({ label: 'Rename', action: () => doRename(entry) })
    items.push({ label: 'Delete', action: () => doDelete(entry) })
  }
  renderMenu(items, x, y)
}

/** Context menu for the desktop background (empty area). Intended to be called
 *  by context-menu.js alongside the existing wallpaper / arrange items. */
export function getDesktopNewFileMenuItem(): { label: string; action: () => void } {
  return {
    label: 'New text file…',
    action: () => newTextFile().catch((e) => alert(`Create failed: ${e.message}`)),
  }
}

async function newTextFile(): Promise<void> {
  const { uniqueName, joinPath, write, guessContentType } = await import('../apps/fs/vfs.ts')
  const name = prompt('Name for new file:', 'untitled.txt')
  if (!name) return
  const err = validateName(name.trim())
  if (err) { alert(err); return }
  const resolved = await uniqueName(DESKTOP, name.trim())
  const path = joinPath(DESKTOP, resolved)
  await write(path, '', { contentType: guessContentType(path) })
  wm.open('notepad', { params: { path } })
}

function renderMenu(
  items: Array<{ label: string; action: () => void } | null>,
  x: number,
  y: number,
): void {
  const ul = document.createElement('ul')
  ul.className = 'fx-menu'
  for (const item of items) {
    if (item === null) {
      const sep = document.createElement('li')
      sep.className = 'fx-menu-sep'
      ul.appendChild(sep)
      continue
    }
    const li = document.createElement('li')
    li.className = 'fx-menu-item'
    li.textContent = item.label
    li.addEventListener('click', () => {
      item.action()
      dismissMenu()
    })
    ul.appendChild(li)
  }
  // Shared lightweight menu styles — keep isolated so desktop.js doesn't need updating.
  ul.style.cssText = `
    position: fixed; list-style: none; margin: 0; padding: 4px 0;
    background: #1a1a2e; border: 1px solid rgba(255,255,255,0.12); border-radius: 6px;
    box-shadow: 0 10px 24px rgba(0,0,0,0.4); min-width: 180px; z-index: 10000;
    font: 13px system-ui, sans-serif; color: #e5e7eb;
  `
  ul.querySelectorAll<HTMLElement>('.fx-menu-item').forEach((li) => {
    li.style.cssText = 'padding: 6px 14px; cursor: pointer;'
    li.addEventListener('mouseenter', () => (li.style.background = 'rgba(122,162,247,0.18)'))
    li.addEventListener('mouseleave', () => (li.style.background = ''))
  })
  ul.querySelectorAll<HTMLElement>('.fx-menu-sep').forEach((sep) => {
    sep.style.cssText = 'height: 1px; background: rgba(255,255,255,0.08); margin: 4px 0;'
  })
  document.body.appendChild(ul)
  const vw = window.innerWidth
  const vh = window.innerHeight
  const r = ul.getBoundingClientRect()
  ul.style.left = `${x + r.width > vw - 4 ? vw - r.width - 4 : x}px`
  ul.style.top = `${y + r.height > vh - 4 ? vh - r.height - 4 : y}px`
  activeMenu = ul
  const off = (ev: MouseEvent) => {
    if (!ul.contains(ev.target as Node)) {
      dismissMenu()
      document.removeEventListener('mousedown', off, true)
    }
  }
  document.addEventListener('mousedown', off, true)
  document.addEventListener('keydown', function once(ev) {
    if (ev.key === 'Escape') {
      dismissMenu()
      document.removeEventListener('keydown', once)
    }
  })
}

// ── Public init ─────────────────────────────────────────────────────────────

export function initDesktopUserIcons(): void {
  const layer = document.getElementById('desktop-icons')
  if (!layer) return

  const positions = loadUserPositions()

  async function render(): Promise<void> {
    let entries: VfsEntry[] = []
    try {
      entries = await list(DESKTOP)
    } catch {
      return
    }

    // Remove icons whose backing file no longer exists.
    const keep = new Set(entries.map((e) => e.path))
    layer.querySelectorAll<HTMLElement>('.desktop-icon[data-user-file="1"]').forEach((el) => {
      const p = el.dataset.filePath
      if (!p || !keep.has(p)) el.remove()
    })
    for (const key of Object.keys(positions)) {
      if (!keep.has(key)) delete positions[key]
    }

    for (const entry of entries) {
      const existing = layer.querySelector<HTMLElement>(`.desktop-icon[data-file-path="${cssEscape(entry.path)}"]`)
      if (existing) {
        const label = existing.querySelector('.desktop-icon__label')
        if (label && label.textContent !== entry.name) label.textContent = entry.name
        continue
      }
      const el = makeUserIconEl(entry, positions)
      bindDrag(el, entry, positions)
      layer.appendChild(el)
    }
    saveUserPositions(positions)
  }

  render()
  subscribe((ev) => {
    if (ev.paths.some((p) => p === DESKTOP || p.startsWith(DESKTOP + '/'))) {
      render()
    }
  })
}

function cssEscape(s: string): string {
  if (typeof (window as { CSS?: { escape?: (s: string) => string } }).CSS?.escape === 'function') {
    return (window as unknown as { CSS: { escape: (s: string) => string } }).CSS.escape(s)
  }
  return s.replace(/["\\]/g, '\\$&')
}
