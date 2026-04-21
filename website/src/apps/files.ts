// Files — the PAI file manager, backed by the virtual filesystem.
//
// Loaded by [app].astro when appId === 'files'. Supports browsing, creating,
// renaming, deleting, importing and downloading files, plus opening images
// in a lightbox and text files in Notepad.

import { bridge } from './_bridge.js'
import { Lightbox } from './files/lightbox.js'
import {
  DESKTOP,
  DOCUMENTS,
  DOWNLOADS,
  HOME,
  PICTURES,
  basename,
  dirname,
  exists,
  extname,
  guessContentType,
  isImage,
  isTextLike,
  joinPath,
  list,
  mkdir,
  quotaInfo,
  ready,
  remove as vfsRemove,
  rename as vfsRename,
  subscribe,
  uniqueName,
  validateName,
  write,
  type VfsEntry,
} from './fs/vfs.ts'

interface Place {
  label: string
  path: string
  icon: string
}

const PLACES: Place[] = [
  { label: 'Home', path: HOME, icon: '🏠' },
  { label: 'Desktop', path: DESKTOP, icon: '🖥' },
  { label: 'Documents', path: DOCUMENTS, icon: '📄' },
  { label: 'Downloads', path: DOWNLOADS, icon: '⬇' },
  { label: 'Pictures', path: PICTURES, icon: '🖼' },
]

function iconForEntry(entry: VfsEntry): string {
  if (entry.kind === 'dir') return '📁'
  if (isImage(entry)) return '🖼'
  const ext = extname(entry.name)
  if (['.md', '.markdown'].includes(ext)) return '📝'
  if (isTextLike(entry)) return '📄'
  return '📦'
}

function humanSize(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let n = bytes
  let u = 0
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024
    u++
  }
  return `${n.toFixed(n >= 10 || u === 0 ? 0 : 1)} ${units[u]}`
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString()
}

export class FilesApp {
  private container!: HTMLElement
  private historyBack: string[] = []
  private historyFwd: string[] = []
  private cwd = HOME
  private view: 'grid' | 'list' = 'grid'
  private entries: VfsEntry[] = []
  private selected = new Set<string>()
  private lastSelectedPath: string | null = null
  private unsub: (() => void) | null = null
  private lightbox: Lightbox
  private menuEl: HTMLElement | null = null

  constructor(container: HTMLElement) {
    this.container = container
    this.lightbox = new Lightbox()
    this.render()
    this.bind()
    this.bootstrap().catch((err) => {
      console.error('[files] init failed', err)
      this.setStatus(`Error: ${String(err?.message ?? err)}`)
    })
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="fx-root">
        <style>${FILES_CSS}</style>
        <nav class="fx-sidebar" aria-label="Places">
          <div class="fx-sidebar-label">Places</div>
          ${PLACES.map(
            (p) =>
              `<button type="button" class="fx-side-btn" data-path="${p.path}">
                <span class="fx-side-icon" aria-hidden="true">${p.icon}</span>${p.label}
              </button>`,
          ).join('')}
        </nav>
        <div class="fx-main">
          <div class="fx-toolbar" role="toolbar" aria-label="File manager toolbar">
            <button type="button" class="fx-ibtn" data-action="back" title="Back (Alt+Left)" aria-label="Back">←</button>
            <button type="button" class="fx-ibtn" data-action="forward" title="Forward (Alt+Right)" aria-label="Forward">→</button>
            <button type="button" class="fx-ibtn" data-action="up" title="Up (Alt+Up)" aria-label="Up">↑</button>
            <div class="fx-breadcrumbs" id="fx-crumbs" aria-label="Breadcrumbs"></div>
            <span class="fx-toolbar-spacer"></span>
            <button type="button" class="fx-btn" data-action="new-file" title="New text file">＋ File</button>
            <button type="button" class="fx-btn" data-action="new-folder" title="New folder">＋ Folder</button>
            <button type="button" class="fx-btn" data-action="import" title="Import a file from your computer">Import…</button>
            <span class="fx-sep" aria-hidden="true"></span>
            <button type="button" class="fx-ibtn" data-action="view-grid" title="Grid view" aria-label="Grid view">▦</button>
            <button type="button" class="fx-ibtn" data-action="view-list" title="List view" aria-label="List view">☰</button>
          </div>
          <div class="fx-content" id="fx-content" tabindex="0"></div>
          <div class="fx-statusbar">
            <span id="fx-status" class="fx-status-msg">Loading…</span>
            <span id="fx-quota" class="fx-quota"></span>
          </div>
        </div>
        <input type="file" id="fx-import" class="fx-hidden" multiple />
      </div>
    `
  }

  private bind(): void {
    this.container.querySelectorAll('.fx-side-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const path = (btn as HTMLElement).dataset.path!
        this.navigate(path)
      })
    })

    this.container.querySelectorAll('[data-action]').forEach((el) => {
      el.addEventListener('click', () => {
        const action = (el as HTMLElement).dataset.action
        this.handleAction(action).catch((err) => this.setStatus(`Error: ${String(err?.message ?? err)}`))
      })
    })

    const importInput = this.container.querySelector('#fx-import') as HTMLInputElement
    importInput.addEventListener('change', () => {
      const files = importInput.files
      if (files && files.length) this.importFiles(files)
      importInput.value = ''
    })

    const content = this.container.querySelector('#fx-content') as HTMLElement
    content.addEventListener('click', (e) => {
      const tile = (e.target as HTMLElement).closest('[data-entry-path]') as HTMLElement | null
      if (!tile) {
        this.clearSelection()
        return
      }
      this.onTileClick(tile, e)
    })
    content.addEventListener('dblclick', (e) => {
      const tile = (e.target as HTMLElement).closest('[data-entry-path]') as HTMLElement | null
      if (tile) this.openEntry(tile.dataset.entryPath!)
    })
    content.addEventListener('contextmenu', (e) => this.onContextMenu(e))

    content.addEventListener('dragover', (e) => {
      if (e.dataTransfer?.types.includes('Files')) {
        e.preventDefault()
        content.classList.add('fx-drop-active')
      }
    })
    content.addEventListener('dragleave', (e) => {
      if (e.target === content) content.classList.remove('fx-drop-active')
    })
    content.addEventListener('drop', (e) => {
      content.classList.remove('fx-drop-active')
      if (!e.dataTransfer?.files?.length) return
      e.preventDefault()
      this.importFiles(e.dataTransfer.files)
    })

    content.addEventListener('keydown', (e) => this.onContentKey(e))

    document.addEventListener('keydown', this.onGlobalKey)

    this.unsub = subscribe((evt) => {
      if (evt.paths.some((p) => p === this.cwd || dirname(p) === this.cwd)) {
        this.refresh().catch(() => {})
      }
    })
  }

  private onGlobalKey = (e: KeyboardEvent): void => {
    if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); this.goBack() }
    else if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); this.goForward() }
    else if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); this.goUp() }
  }

  private async bootstrap(): Promise<void> {
    await ready()
    const params = new URLSearchParams(window.location.search)
    const startPath = params.get('path')
    await this.navigate(startPath && startPath.startsWith('/') ? startPath : HOME, { push: false })
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  private async navigate(path: string, opts: { push?: boolean } = {}): Promise<void> {
    const push = opts.push ?? true
    if (push && path !== this.cwd) {
      this.historyBack.push(this.cwd)
      this.historyFwd = []
    }
    this.cwd = path
    this.selected.clear()
    await this.refresh()
    this.updateSidebarActive()
    this.updateToolbarState()
  }

  private async refresh(): Promise<void> {
    try {
      this.entries = await list(this.cwd)
    } catch (err) {
      this.entries = []
      this.setStatus(`Can't list ${this.cwd}: ${String((err as Error).message)}`)
    }
    this.renderCrumbs()
    this.renderContent()
    this.updateStatus()
    this.updateQuota().catch(() => {})
  }

  private goBack(): void {
    if (!this.historyBack.length) return
    this.historyFwd.push(this.cwd)
    const prev = this.historyBack.pop()!
    this.cwd = prev
    this.selected.clear()
    this.refresh()
    this.updateSidebarActive()
    this.updateToolbarState()
  }

  private goForward(): void {
    if (!this.historyFwd.length) return
    this.historyBack.push(this.cwd)
    const next = this.historyFwd.pop()!
    this.cwd = next
    this.selected.clear()
    this.refresh()
    this.updateSidebarActive()
    this.updateToolbarState()
  }

  private goUp(): void {
    if (this.cwd === '/') return
    this.navigate(dirname(this.cwd))
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  private renderCrumbs(): void {
    const parts = this.cwd === '/' ? [''] : this.cwd.split('/')
    const crumbs = this.container.querySelector('#fx-crumbs')!
    crumbs.innerHTML = ''
    let acc = ''
    parts.forEach((part, i) => {
      acc = i === 0 ? '/' : joinPath(acc, part)
      const label = i === 0 ? '/' : part
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'fx-crumb'
      btn.textContent = label
      btn.dataset.path = acc
      btn.addEventListener('click', () => this.navigate(acc))
      crumbs.appendChild(btn)
      if (i < parts.length - 1) {
        const sep = document.createElement('span')
        sep.className = 'fx-crumb-sep'
        sep.textContent = '›'
        crumbs.appendChild(sep)
      }
    })
  }

  private renderContent(): void {
    const content = this.container.querySelector('#fx-content')!
    content.innerHTML = ''
    content.classList.toggle('fx-view-grid', this.view === 'grid')
    content.classList.toggle('fx-view-list', this.view === 'list')

    if (!this.entries.length) {
      const empty = document.createElement('div')
      empty.className = 'fx-empty'
      empty.innerHTML = `
        <div class="fx-empty-glyph">📂</div>
        <div class="fx-empty-title">This folder is empty</div>
        <div class="fx-empty-hint">Drop a file here, or use + File / + Folder above.</div>
      `
      content.appendChild(empty)
      return
    }

    for (const entry of this.entries) {
      const el = this.makeTile(entry)
      content.appendChild(el)
    }
  }

  private makeTile(entry: VfsEntry): HTMLElement {
    const tile = document.createElement('div')
    tile.className = 'fx-tile'
    tile.tabIndex = 0
    tile.dataset.entryPath = entry.path
    tile.dataset.kind = entry.kind
    if (this.selected.has(entry.path)) tile.classList.add('selected')
    const icon = iconForEntry(entry)

    if (this.view === 'grid' && isImage(entry) && entry.content) {
      const thumb = document.createElement('div')
      thumb.className = 'fx-thumb'
      const img = document.createElement('img')
      img.src = entry.content
      img.alt = entry.name
      img.addEventListener('error', () => {
        thumb.innerHTML = `<span class="fx-thumb-fallback">${icon}</span>`
      })
      thumb.appendChild(img)
      const caption = document.createElement('div')
      caption.className = 'fx-tile-name'
      caption.title = entry.name
      caption.textContent = entry.name
      tile.appendChild(thumb)
      tile.appendChild(caption)
    } else {
      const iconEl = document.createElement('span')
      iconEl.className = 'fx-tile-icon'
      iconEl.setAttribute('aria-hidden', 'true')
      iconEl.textContent = icon
      const nameEl = document.createElement('span')
      nameEl.className = 'fx-tile-name'
      nameEl.title = entry.name
      nameEl.textContent = entry.name
      tile.appendChild(iconEl)
      tile.appendChild(nameEl)
      if (this.view === 'list') {
        const sizeEl = document.createElement('span')
        sizeEl.className = 'fx-tile-size'
        sizeEl.textContent = entry.kind === 'dir' ? '' : humanSize(entry.size)
        const dateEl = document.createElement('span')
        dateEl.className = 'fx-tile-date'
        dateEl.textContent = formatDate(entry.modified)
        tile.appendChild(sizeEl)
        tile.appendChild(dateEl)
      }
    }
    return tile
  }

  private updateSidebarActive(): void {
    this.container.querySelectorAll('.fx-side-btn').forEach((btn) => {
      const path = (btn as HTMLElement).dataset.path
      btn.classList.toggle('active', path === this.cwd)
    })
  }

  private updateToolbarState(): void {
    const back = this.container.querySelector('[data-action="back"]')
    const fwd = this.container.querySelector('[data-action="forward"]')
    const up = this.container.querySelector('[data-action="up"]')
    back?.toggleAttribute('disabled', this.historyBack.length === 0)
    fwd?.toggleAttribute('disabled', this.historyFwd.length === 0)
    up?.toggleAttribute('disabled', this.cwd === '/')
    const viewGrid = this.container.querySelector('[data-action="view-grid"]')
    const viewList = this.container.querySelector('[data-action="view-list"]')
    viewGrid?.classList.toggle('fx-ibtn--active', this.view === 'grid')
    viewList?.classList.toggle('fx-ibtn--active', this.view === 'list')
  }

  // ── Selection ──────────────────────────────────────────────────────────────

  private onTileClick(tile: HTMLElement, e: MouseEvent): void {
    const path = tile.dataset.entryPath!
    if (e.shiftKey && this.lastSelectedPath) {
      const a = this.entries.findIndex((x) => x.path === this.lastSelectedPath)
      const b = this.entries.findIndex((x) => x.path === path)
      if (a >= 0 && b >= 0) {
        const [lo, hi] = a < b ? [a, b] : [b, a]
        for (let i = lo; i <= hi; i++) this.selected.add(this.entries[i].path)
      }
    } else if (e.ctrlKey || e.metaKey) {
      if (this.selected.has(path)) this.selected.delete(path)
      else this.selected.add(path)
      this.lastSelectedPath = path
    } else {
      this.selected.clear()
      this.selected.add(path)
      this.lastSelectedPath = path
    }
    this.reapplySelection()
  }

  private clearSelection(): void {
    this.selected.clear()
    this.reapplySelection()
  }

  private reapplySelection(): void {
    this.container.querySelectorAll('[data-entry-path]').forEach((el) => {
      const p = (el as HTMLElement).dataset.entryPath!
      el.classList.toggle('selected', this.selected.has(p))
    })
    this.updateStatus()
  }

  private onContentKey(e: KeyboardEvent): void {
    const content = this.container.querySelector('#fx-content') as HTMLElement
    if (e.target !== content) return
    if (e.key === 'Enter' && this.selected.size === 1) {
      const path = [...this.selected][0]
      this.openEntry(path)
      e.preventDefault()
    } else if (e.key === 'Delete') {
      this.deleteSelected()
      e.preventDefault()
    } else if (e.key === 'F2' && this.selected.size === 1) {
      const path = [...this.selected][0]
      this.renameEntry(path)
      e.preventDefault()
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault()
      this.selected = new Set(this.entries.map((x) => x.path))
      this.reapplySelection()
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  private async handleAction(action: string | undefined): Promise<void> {
    switch (action) {
      case 'back':
        this.goBack(); return
      case 'forward':
        this.goForward(); return
      case 'up':
        this.goUp(); return
      case 'new-file':
        return this.newFile()
      case 'new-folder':
        return this.newFolder()
      case 'import':
        ;(this.container.querySelector('#fx-import') as HTMLInputElement).click(); return
      case 'view-grid':
        this.view = 'grid'; this.renderContent(); this.updateToolbarState(); return
      case 'view-list':
        this.view = 'list'; this.renderContent(); this.updateToolbarState(); return
    }
  }

  private async newFile(): Promise<void> {
    const name = prompt('Name for new file:', 'untitled.txt')
    if (!name) return
    const err = validateName(name.trim())
    if (err) { alert(err); return }
    const resolved = await uniqueName(this.cwd, name.trim())
    const path = joinPath(this.cwd, resolved)
    await write(path, '', { contentType: guessContentType(path) })
    bridge.openApp('notepad', { path })
  }

  private async newFolder(): Promise<void> {
    const name = prompt('Name for new folder:', 'New Folder')
    if (!name) return
    const err = validateName(name.trim())
    if (err) { alert(err); return }
    const resolved = await uniqueName(this.cwd, name.trim())
    await mkdir(joinPath(this.cwd, resolved))
  }

  private async renameEntry(path: string): Promise<void> {
    const current = basename(path)
    const next = prompt('Rename to:', current)
    if (!next || next === current) return
    const err = validateName(next.trim())
    if (err) { alert(err); return }
    if (await exists(joinPath(dirname(path), next.trim()))) {
      alert(`"${next.trim()}" already exists`)
      return
    }
    try {
      await vfsRename(path, next.trim())
    } catch (err2) {
      alert(`Rename failed: ${(err2 as Error).message}`)
    }
  }

  private async deleteSelected(): Promise<void> {
    if (!this.selected.size) return
    const paths = [...this.selected]
    const msg =
      paths.length === 1
        ? `Delete "${basename(paths[0])}"?`
        : `Delete ${paths.length} items?`
    if (!confirm(msg)) return
    for (const p of paths) {
      try {
        await vfsRemove(p)
      } catch (err) {
        alert(`Can't delete ${basename(p)}: ${(err as Error).message}`)
      }
    }
    this.selected.clear()
  }

  private async downloadEntry(path: string): Promise<void> {
    const entry = this.entries.find((x) => x.path === path)
    if (!entry || entry.kind !== 'file') return
    const name = entry.name
    const type = entry.contentType ?? guessContentType(name)
    let blob: Blob
    if (entry.content && entry.content.startsWith('/')) {
      try {
        const res = await fetch(entry.content)
        blob = await res.blob()
      } catch {
        this.setStatus(`Couldn't fetch ${entry.content}`)
        return
      }
    } else if (entry.content && entry.content.startsWith('data:')) {
      const res = await fetch(entry.content)
      blob = await res.blob()
    } else {
      blob = new Blob([entry.content ?? ''], { type })
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  private async importFiles(files: FileList): Promise<void> {
    for (const file of Array.from(files)) {
      const name = await uniqueName(this.cwd, file.name)
      const path = joinPath(this.cwd, name)
      const ct = guessContentType(name) || file.type || 'application/octet-stream'
      if (ct.startsWith('image/')) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader()
          r.onload = () => resolve(String(r.result))
          r.onerror = () => reject(r.error)
          r.readAsDataURL(file)
        })
        await write(path, dataUrl, { contentType: ct })
      } else {
        const text = await file.text()
        await write(path, text, { contentType: ct })
      }
    }
    this.setStatus(`Imported ${files.length} item${files.length === 1 ? '' : 's'}`)
  }

  // ── Open ───────────────────────────────────────────────────────────────────

  private openEntry(path: string): void {
    const entry = this.entries.find((x) => x.path === path)
    if (!entry) return
    if (entry.kind === 'dir') {
      this.navigate(path)
      return
    }
    if (isImage(entry)) {
      const images = this.entries.filter(isImage)
      const idx = images.findIndex((x) => x.path === path)
      const items = images.map((img) => ({
        id: img.path,
        src: img.content ?? '',
        caption: img.name,
        alt: img.name,
      }))
      this.lightbox.open(items, Math.max(0, idx))
      return
    }
    if (isTextLike(entry)) {
      bridge.openApp('notepad', { path })
      return
    }
    this.downloadEntry(path)
  }

  // ── Context menu ───────────────────────────────────────────────────────────

  private onContextMenu(e: MouseEvent): void {
    e.preventDefault()
    const tile = (e.target as HTMLElement).closest('[data-entry-path]') as HTMLElement | null
    this.dismissMenu()
    if (tile) {
      const path = tile.dataset.entryPath!
      if (!this.selected.has(path)) {
        this.selected.clear()
        this.selected.add(path)
        this.lastSelectedPath = path
        this.reapplySelection()
      }
      this.showEntryMenu(path, e.clientX, e.clientY)
    } else {
      this.showFolderMenu(e.clientX, e.clientY)
    }
  }

  private dismissMenu(): void {
    if (this.menuEl) {
      this.menuEl.remove()
      this.menuEl = null
    }
  }

  private showEntryMenu(path: string, x: number, y: number): void {
    const entry = this.entries.find((x) => x.path === path)
    if (!entry) return
    const items: Array<{ label: string; action: () => void; disabled?: boolean } | null> = [
      { label: 'Open', action: () => this.openEntry(path) },
    ]
    if (entry.kind === 'file' && isTextLike(entry)) {
      items.push({ label: 'Open with Notepad', action: () => bridge.openApp('notepad', { path }) })
    }
    if (entry.kind === 'file') {
      items.push({ label: 'Download', action: () => this.downloadEntry(path) })
    }
    items.push(null)
    items.push({ label: 'Rename', action: () => this.renameEntry(path), disabled: !!entry.readOnly })
    items.push({ label: 'Delete', action: () => this.deleteSelected(), disabled: !!entry.readOnly })
    this.openMenuAt(items, x, y)
  }

  private showFolderMenu(x: number, y: number): void {
    const items: Array<{ label: string; action: () => void } | null> = [
      { label: 'New text file…', action: () => this.newFile() },
      { label: 'New folder…', action: () => this.newFolder() },
      null,
      { label: 'Import file…', action: () => (this.container.querySelector('#fx-import') as HTMLInputElement).click() },
      { label: 'Refresh', action: () => this.refresh() },
    ]
    this.openMenuAt(items, x, y)
  }

  private openMenuAt(items: Array<{ label: string; action: () => void; disabled?: boolean } | null>, x: number, y: number): void {
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
      if (item.disabled) li.classList.add('disabled')
      li.textContent = item.label
      li.addEventListener('click', () => {
        if (!item.disabled) item.action()
        this.dismissMenu()
      })
      ul.appendChild(li)
    }
    document.body.appendChild(ul)
    const vw = window.innerWidth
    const vh = window.innerHeight
    const r = ul.getBoundingClientRect()
    ul.style.left = `${x + r.width > vw - 4 ? vw - r.width - 4 : x}px`
    ul.style.top = `${y + r.height > vh - 4 ? vh - r.height - 4 : y}px`
    this.menuEl = ul
    const dismiss = (ev: MouseEvent) => {
      if (!ul.contains(ev.target as Node)) {
        this.dismissMenu()
        document.removeEventListener('mousedown', dismiss, true)
      }
    }
    document.addEventListener('mousedown', dismiss, true)
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') this.dismissMenu()
    }, { once: true })
  }

  // ── Status ─────────────────────────────────────────────────────────────────

  private updateStatus(): void {
    const total = this.entries.length
    const sel = this.selected.size
    const msg =
      sel > 0
        ? `${sel} selected · ${total} item${total === 1 ? '' : 's'}`
        : `${total} item${total === 1 ? '' : 's'}`
    this.setStatus(msg)
  }

  private setStatus(msg: string): void {
    const el = this.container.querySelector('#fx-status')
    if (el) el.textContent = msg
  }

  private async updateQuota(): Promise<void> {
    try {
      const { used, quota } = await quotaInfo()
      const el = this.container.querySelector('#fx-quota')
      if (!el) return
      el.textContent = quota
        ? `${humanSize(used)} of ${humanSize(quota)} used`
        : `${humanSize(used)} used`
    } catch {}
  }
}

// ── Styles ───────────────────────────────────────────────────────────────────

const FILES_CSS = `
  .fx-root {
    display: flex;
    height: 100%;
    background: #0f0f1a;
    color: #e5e7eb;
    font: 13px/1.4 system-ui, -apple-system, Segoe UI, sans-serif;
    overflow: hidden;
  }
  .fx-sidebar {
    width: 176px;
    flex-shrink: 0;
    background: rgba(8,8,18,0.9);
    border-right: 1px solid rgba(255,255,255,0.07);
    padding: 10px 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow-y: auto;
  }
  .fx-sidebar-label {
    padding: 4px 14px 6px;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #4b5563;
  }
  .fx-side-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    font: inherit;
    text-align: left;
    transition: background 0.1s, color 0.1s;
  }
  .fx-side-btn:hover { background: rgba(255,255,255,0.05); color: #e5e7eb; }
  .fx-side-btn.active { background: rgba(122,162,247,0.14); color: #c7d3ff; }
  .fx-side-icon { font-size: 14px; width: 18px; text-align: center; }
  .fx-main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .fx-toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    background: rgba(10,10,20,0.8);
    border-bottom: 1px solid rgba(255,255,255,0.07);
    flex-shrink: 0;
  }
  .fx-toolbar-spacer { flex: 1; }
  .fx-ibtn {
    appearance: none;
    border: 1px solid transparent;
    background: none;
    color: #e5e7eb;
    width: 28px;
    height: 28px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .fx-ibtn:hover { background: rgba(255,255,255,0.06); }
  .fx-ibtn:disabled { opacity: 0.3; cursor: not-allowed; }
  .fx-ibtn--active { background: rgba(122,162,247,0.18); color: #c7d3ff; }
  .fx-btn {
    appearance: none;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.03);
    color: #e5e7eb;
    padding: 5px 10px;
    font: inherit;
    border-radius: 4px;
    cursor: pointer;
  }
  .fx-btn:hover { background: rgba(255,255,255,0.08); }
  .fx-sep { width: 1px; height: 20px; background: rgba(255,255,255,0.08); margin: 0 4px; }
  .fx-breadcrumbs {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: 0 1 auto;
    overflow: hidden;
    padding: 0 8px;
  }
  .fx-crumb {
    appearance: none;
    border: none;
    background: none;
    color: #c7d3ff;
    cursor: pointer;
    font: inherit;
    padding: 3px 6px;
    border-radius: 3px;
    white-space: nowrap;
  }
  .fx-crumb:hover { background: rgba(255,255,255,0.06); }
  .fx-crumb-sep { color: #4b5563; font-size: 12px; }
  .fx-content {
    flex: 1;
    overflow: auto;
    padding: 12px;
    outline: none;
    position: relative;
  }
  .fx-content.fx-drop-active {
    background: rgba(122,162,247,0.06);
    outline: 2px dashed rgba(122,162,247,0.5);
    outline-offset: -8px;
  }
  .fx-view-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 8px;
    align-content: start;
  }
  .fx-view-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .fx-tile {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 6px;
    border: 1px solid transparent;
    border-radius: 6px;
    cursor: pointer;
    user-select: none;
    color: #d1d5db;
    outline: none;
  }
  .fx-view-grid .fx-tile {
    flex-direction: column;
    text-align: center;
    gap: 4px;
    min-height: 88px;
  }
  .fx-view-list .fx-tile { padding: 4px 8px; }
  .fx-tile:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.06); }
  .fx-tile.selected { background: rgba(122,162,247,0.18); border-color: rgba(122,162,247,0.45); color: #fff; }
  .fx-tile:focus-visible { border-color: rgba(122,162,247,0.8); }
  .fx-tile-icon { font-size: 28px; line-height: 1; }
  .fx-view-list .fx-tile-icon { font-size: 16px; }
  .fx-tile-name {
    font-size: 12px;
    word-break: break-word;
    overflow-wrap: anywhere;
    line-height: 1.25;
  }
  .fx-view-list .fx-tile-name { flex: 1; font-size: 13px; text-align: left; }
  .fx-view-list .fx-tile-size,
  .fx-view-list .fx-tile-date {
    color: #6b7280;
    font-size: 11px;
    min-width: 70px;
    text-align: right;
  }
  .fx-thumb {
    width: 100%;
    aspect-ratio: 4/3;
    border-radius: 4px;
    overflow: hidden;
    background: rgba(255,255,255,0.04);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .fx-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .fx-thumb-fallback { font-size: 28px; }
  .fx-empty {
    text-align: center;
    color: #6b7280;
    padding: 40px 20px;
    grid-column: 1 / -1;
  }
  .fx-empty-glyph { font-size: 44px; opacity: 0.5; }
  .fx-empty-title { font-size: 14px; margin-top: 12px; color: #9ca3af; }
  .fx-empty-hint { font-size: 12px; margin-top: 6px; }
  .fx-statusbar {
    display: flex;
    justify-content: space-between;
    padding: 4px 10px;
    background: rgba(10,10,20,0.8);
    border-top: 1px solid rgba(255,255,255,0.06);
    font-size: 11px;
    color: #9ca3af;
    flex-shrink: 0;
  }
  .fx-quota { color: #6b7280; font-style: italic; }
  .fx-hidden { display: none; }
  .fx-menu {
    position: fixed;
    list-style: none;
    margin: 0;
    padding: 4px 0;
    background: #1a1a2e;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 6px;
    box-shadow: 0 10px 24px rgba(0,0,0,0.4);
    min-width: 180px;
    z-index: 10000;
    font: 13px system-ui, sans-serif;
    color: #e5e7eb;
  }
  .fx-menu-item {
    padding: 6px 14px;
    cursor: pointer;
  }
  .fx-menu-item:hover { background: rgba(122,162,247,0.18); }
  .fx-menu-item.disabled { color: #4b5563; cursor: not-allowed; }
  .fx-menu-item.disabled:hover { background: none; }
  .fx-menu-sep {
    height: 1px;
    background: rgba(255,255,255,0.08);
    margin: 4px 0;
  }
`
