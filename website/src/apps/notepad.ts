// Notepad — a minimal text editor backed by the virtual filesystem.
//
// Loaded by [app].astro when appId === 'notepad'. A fresh Notepad opens
// a blank unnamed buffer on DESKTOP; pass ?path=/... to open an existing file.

import { bridge } from './_bridge.js'
import {
  DESKTOP,
  basename,
  dirname,
  guessContentType,
  isTextLike,
  joinPath,
  read,
  ready,
  subscribe,
  uniqueName,
  validateName,
  write,
} from './fs/vfs.ts'

const UNTITLED = 'Untitled.txt'
const DEFAULT_DIR = DESKTOP
const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20, 24]
const PREF_KEY = 'pai-notepad-prefs'

interface Prefs {
  fontSize: number
  wrap: boolean
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREF_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<Prefs>
      return { fontSize: p.fontSize ?? 14, wrap: p.wrap ?? true }
    }
  } catch {}
  return { fontSize: 14, wrap: true }
}

function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(p))
  } catch {}
}

function currentPathParam(): string | null {
  const params = new URLSearchParams(window.location.search)
  const p = params.get('path')
  return p && p.startsWith('/') ? p : null
}

export class NotepadApp {
  private container!: HTMLElement
  private textarea!: HTMLTextAreaElement
  private filenameInput!: HTMLInputElement
  private directoryEl!: HTMLElement
  private statusEl!: HTMLElement
  private storageNoteEl!: HTMLElement

  private currentPath: string | null = null
  private currentDir: string = DEFAULT_DIR
  private savedContent = ''
  private dirty = false
  private prefs: Prefs = loadPrefs()
  private unsub: (() => void) | null = null

  constructor(container: HTMLElement) {
    this.container = container
    this.render()
    this.bind()
    this.bootstrap().catch((err) => {
      console.error('[notepad] init failed', err)
      this.setStatus(`Error: ${String(err?.message ?? err)}`)
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  private render(): void {
    this.container.innerHTML = `
      <div class="np-root">
        <style>${NOTEPAD_CSS}</style>
        <div class="np-toolbar" role="toolbar" aria-label="Notepad toolbar">
          <button type="button" class="np-btn" data-action="new" title="New (Ctrl+N)">New</button>
          <button type="button" class="np-btn" data-action="open" title="Open (Ctrl+O)">Open</button>
          <button type="button" class="np-btn np-btn--primary" data-action="save" title="Save (Ctrl+S)">Save</button>
          <button type="button" class="np-btn" data-action="save-as" title="Save As (Ctrl+Shift+S)">Save As…</button>
          <span class="np-sep" aria-hidden="true"></span>
          <button type="button" class="np-btn" data-action="import" title="Import a file from your computer">Import…</button>
          <button type="button" class="np-btn" data-action="download" title="Download to your computer">Download</button>
          <span class="np-sep" aria-hidden="true"></span>
          <button type="button" class="np-btn" data-action="font-dec" aria-label="Decrease font size">A−</button>
          <button type="button" class="np-btn" data-action="font-inc" aria-label="Increase font size">A+</button>
          <button type="button" class="np-btn" data-action="wrap" aria-pressed="${this.prefs.wrap}" title="Toggle word wrap">Wrap</button>
        </div>
        <div class="np-location" role="group" aria-label="File location">
          <span class="np-location-dir" id="np-dir"></span>
          <input type="text" class="np-filename" id="np-name" placeholder="Untitled.txt"
                 aria-label="File name" spellcheck="false" autocomplete="off" />
        </div>
        <textarea class="np-textarea" id="np-text" spellcheck="false" autocapitalize="off"
                  autocorrect="off" aria-label="Editor"></textarea>
        <div class="np-status" role="status" aria-live="polite">
          <span class="np-status-msg" id="np-status">Ready</span>
          <span class="np-status-right">
            <span id="np-counter">0 chars · 1 line</span>
            <span class="np-storage-note" id="np-storage">stored in your browser</span>
          </span>
        </div>
        <input type="file" id="np-import" class="np-hidden" accept="text/*,.md,.json,.log,.csv" />
      </div>
    `

    this.textarea = this.container.querySelector('#np-text') as HTMLTextAreaElement
    this.filenameInput = this.container.querySelector('#np-name') as HTMLInputElement
    this.directoryEl = this.container.querySelector('#np-dir') as HTMLElement
    this.statusEl = this.container.querySelector('#np-status') as HTMLElement
    this.storageNoteEl = this.container.querySelector('#np-storage') as HTMLElement

    this.applyPrefs()
    this.renderLocation()
  }

  private applyPrefs(): void {
    this.textarea.style.fontSize = `${this.prefs.fontSize}px`
    this.textarea.style.whiteSpace = this.prefs.wrap ? 'pre-wrap' : 'pre'
    const wrapBtn = this.container.querySelector('[data-action="wrap"]')
    wrapBtn?.setAttribute('aria-pressed', String(this.prefs.wrap))
    wrapBtn?.classList.toggle('np-btn--active', this.prefs.wrap)
  }

  private renderLocation(): void {
    this.directoryEl.textContent = `${this.currentDir}/`
    this.filenameInput.value = this.currentPath ? basename(this.currentPath) : ''
    this.filenameInput.placeholder = UNTITLED
  }

  // ── Bind ───────────────────────────────────────────────────────────────────

  private bind(): void {
    this.container.querySelectorAll('.np-btn').forEach((el) => {
      el.addEventListener('click', () => {
        const action = (el as HTMLElement).dataset.action
        this.handleAction(action).catch((err) => {
          this.setStatus(`Error: ${String(err?.message ?? err)}`)
        })
      })
    })

    this.textarea.addEventListener('input', () => {
      this.updateCounter()
      this.setDirty(this.textarea.value !== this.savedContent)
    })

    this.textarea.addEventListener('keydown', (e) => {
      // Tab inserts two spaces (unless shift: outdent)
      if (e.key === 'Tab') {
        e.preventDefault()
        const start = this.textarea.selectionStart
        const end = this.textarea.selectionEnd
        const v = this.textarea.value
        this.textarea.value = v.slice(0, start) + '  ' + v.slice(end)
        this.textarea.selectionStart = this.textarea.selectionEnd = start + 2
        this.textarea.dispatchEvent(new Event('input'))
      }
    })

    this.filenameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        this.textarea.focus()
      }
    })

    const importInput = this.container.querySelector('#np-import') as HTMLInputElement
    importInput.addEventListener('change', () => {
      const file = importInput.files?.[0]
      if (file) this.importFile(file).catch((err) => this.setStatus(`Error: ${String(err?.message ?? err)}`))
      importInput.value = ''
    })

    document.addEventListener('keydown', this.onKey, true)

    // Re-sync with VFS changes initiated elsewhere (e.g. Files app deleted our file).
    this.unsub = subscribe(async (e) => {
      if (!this.currentPath) return
      if (!e.paths.includes(this.currentPath)) return
      try {
        const latest = await read(this.currentPath)
        if (latest === this.savedContent) return
        if (!this.dirty) {
          this.textarea.value = latest
          this.savedContent = latest
          this.updateCounter()
          this.setStatus('File was updated from another app')
        } else {
          this.setStatus('This file changed on disk — your edits are unsaved')
        }
      } catch {
        // File was deleted.
        this.setStatus('The file on disk was deleted')
        this.currentPath = null
        this.setDirty(true)
        this.renderLocation()
        this.refreshTitle()
      }
    })

    window.addEventListener('beforeunload', (e) => {
      if (this.dirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    })
  }

  private onKey = (e: KeyboardEvent): void => {
    const mod = e.ctrlKey || e.metaKey
    if (!mod) return
    const key = e.key.toLowerCase()
    if (key === 's') {
      e.preventDefault()
      if (e.shiftKey) this.saveAs()
      else this.save()
    } else if (key === 'n' && !e.shiftKey) {
      e.preventDefault()
      this.newFile()
    } else if (key === 'o' && !e.shiftKey) {
      e.preventDefault()
      bridge.openApp('files')
    }
  }

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  private async bootstrap(): Promise<void> {
    await ready()
    const pathParam = currentPathParam()
    if (pathParam) {
      try {
        await this.openPath(pathParam)
        return
      } catch (err) {
        this.setStatus(`Couldn't open ${pathParam}: ${String((err as Error).message)}`)
      }
    }
    // Empty untitled buffer.
    this.textarea.value = ''
    this.savedContent = ''
    this.currentPath = null
    this.currentDir = DEFAULT_DIR
    this.renderLocation()
    this.updateCounter()
    this.refreshTitle()
    this.setStatus('New document')
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  private async handleAction(action: string | undefined): Promise<void> {
    switch (action) {
      case 'new':
        return this.newFile()
      case 'open':
        bridge.openApp('files')
        return
      case 'save':
        return this.save()
      case 'save-as':
        return this.saveAs()
      case 'import':
        ;(this.container.querySelector('#np-import') as HTMLInputElement).click()
        return
      case 'download':
        return this.download()
      case 'font-dec':
        this.adjustFont(-1)
        return
      case 'font-inc':
        this.adjustFont(+1)
        return
      case 'wrap':
        this.prefs.wrap = !this.prefs.wrap
        savePrefs(this.prefs)
        this.applyPrefs()
        return
    }
  }

  private async newFile(): Promise<void> {
    if (this.dirty && !confirm('Discard unsaved changes?')) return
    this.textarea.value = ''
    this.savedContent = ''
    this.currentPath = null
    this.currentDir = DEFAULT_DIR
    this.renderLocation()
    this.updateCounter()
    this.setDirty(false)
    this.refreshTitle()
    this.setStatus('New document')
    this.textarea.focus()
  }

  private async openPath(path: string): Promise<void> {
    const content = await read(path)
    this.textarea.value = content
    this.savedContent = content
    this.currentPath = path
    this.currentDir = dirname(path)
    this.renderLocation()
    this.updateCounter()
    this.setDirty(false)
    this.refreshTitle()
    this.setStatus(`Opened ${path}`)
    this.textarea.focus()
  }

  private async save(): Promise<void> {
    const typedName = this.filenameInput.value.trim()
    if (this.currentPath && (!typedName || typedName === basename(this.currentPath))) {
      await this.writeToPath(this.currentPath)
      return
    }
    const name = typedName || UNTITLED
    const err = validateName(name)
    if (err) {
      this.setStatus(err)
      this.filenameInput.focus()
      return
    }
    const path = joinPath(this.currentDir, name)
    await this.writeToPath(path)
  }

  private async saveAs(): Promise<void> {
    const defaultName = this.currentPath ? basename(this.currentPath) : this.filenameInput.value.trim() || UNTITLED
    const input = prompt('Save as (path or filename):', defaultName)
    if (input == null) return
    const trimmed = input.trim()
    if (!trimmed) return
    let path: string
    if (trimmed.startsWith('/')) {
      path = trimmed
    } else {
      path = joinPath(this.currentDir, trimmed)
    }
    const err = validateName(basename(path))
    if (err) {
      this.setStatus(err)
      return
    }
    const name = basename(path)
    const dir = dirname(path)
    const resolved = await uniqueName(dir, name)
    const finalPath = joinPath(dir, resolved)
    await this.writeToPath(finalPath)
  }

  private async writeToPath(path: string): Promise<void> {
    const content = this.textarea.value
    await write(path, content, { contentType: guessContentType(path) })
    this.currentPath = path
    this.currentDir = dirname(path)
    this.savedContent = content
    this.renderLocation()
    this.setDirty(false)
    this.refreshTitle()
    this.setStatus(`Saved ${path}`)
  }

  private async importFile(file: File): Promise<void> {
    const text = await file.text()
    if (this.dirty && !confirm('Discard unsaved changes?')) return
    this.textarea.value = text
    this.savedContent = ''
    this.currentPath = null
    this.currentDir = DEFAULT_DIR
    this.filenameInput.value = file.name
    this.renderLocation()
    this.filenameInput.value = file.name
    this.updateCounter()
    this.setDirty(true)
    this.refreshTitle()
    this.setStatus(`Imported ${file.name} — click Save to store it`)
  }

  private download(): void {
    const name = this.currentPath
      ? basename(this.currentPath)
      : (this.filenameInput.value.trim() || UNTITLED)
    const type = guessContentType(name)
    const blob = new Blob([this.textarea.value], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    this.setStatus(`Downloaded ${name}`)
  }

  private adjustFont(delta: number): void {
    const idx = FONT_SIZES.indexOf(this.prefs.fontSize)
    const next = Math.max(0, Math.min(FONT_SIZES.length - 1, (idx < 0 ? 2 : idx) + delta))
    this.prefs.fontSize = FONT_SIZES[next]
    savePrefs(this.prefs)
    this.applyPrefs()
  }

  // ── State helpers ──────────────────────────────────────────────────────────

  private setDirty(d: boolean): void {
    if (this.dirty === d) return
    this.dirty = d
    bridge.setDirty?.(d)
    this.refreshTitle()
  }

  private refreshTitle(): void {
    const name = this.currentPath ? basename(this.currentPath) : UNTITLED
    const title = `${this.dirty ? '• ' : ''}${name} — Notepad`
    bridge.setTitle(title)
    document.title = title
  }

  private updateCounter(): void {
    const v = this.textarea.value
    const chars = v.length
    const lines = v === '' ? 1 : v.split('\n').length
    const counter = this.container.querySelector('#np-counter')
    if (counter) counter.textContent = `${chars} char${chars === 1 ? '' : 's'} · ${lines} line${lines === 1 ? '' : 's'}`
  }

  private setStatus(msg: string): void {
    this.statusEl.textContent = msg
  }
}

// ── Styles ───────────────────────────────────────────────────────────────────

const NOTEPAD_CSS = `
  :host, .np-root { color-scheme: dark; }
  .np-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #0f0f1a;
    color: #e5e7eb;
    font: 13px/1.4 system-ui, -apple-system, Segoe UI, sans-serif;
  }
  .np-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    padding: 6px 8px;
    background: rgba(15,15,26,0.9);
    border-bottom: 1px solid rgba(255,255,255,0.08);
    flex-shrink: 0;
  }
  .np-btn {
    appearance: none;
    border: 1px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.03);
    color: #e5e7eb;
    padding: 5px 10px;
    font: inherit;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.1s, border-color 0.1s;
  }
  .np-btn:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); }
  .np-btn:focus-visible { outline: 2px solid #7aa2f7; outline-offset: 1px; }
  .np-btn--primary { background: rgba(122,162,247,0.18); border-color: rgba(122,162,247,0.4); color: #c7d3ff; }
  .np-btn--primary:hover { background: rgba(122,162,247,0.28); }
  .np-btn--active { background: rgba(122,162,247,0.18); border-color: rgba(122,162,247,0.4); color: #c7d3ff; }
  .np-sep { width: 1px; align-self: stretch; background: rgba(255,255,255,0.08); margin: 0 2px; }
  .np-location {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    background: rgba(10,10,20,0.6);
    border-bottom: 1px solid rgba(255,255,255,0.05);
    font-size: 12px;
    color: #9ca3af;
    flex-shrink: 0;
  }
  .np-location-dir { white-space: nowrap; color: #6b7280; }
  .np-filename {
    flex: 1;
    min-width: 0;
    background: transparent;
    border: 1px solid transparent;
    color: #e5e7eb;
    padding: 3px 6px;
    font: inherit;
    border-radius: 3px;
  }
  .np-filename:focus { outline: none; border-color: rgba(122,162,247,0.5); background: rgba(255,255,255,0.03); }
  .np-textarea {
    flex: 1;
    min-height: 0;
    width: 100%;
    resize: none;
    background: #0a0a14;
    color: #e5e7eb;
    border: none;
    padding: 12px 14px;
    font: 14px/1.55 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    overflow: auto;
  }
  .np-textarea:focus { outline: none; }
  .np-status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 5px 10px;
    background: rgba(10,10,20,0.8);
    border-top: 1px solid rgba(255,255,255,0.06);
    font-size: 11px;
    color: #9ca3af;
    flex-shrink: 0;
  }
  .np-status-right { display: flex; align-items: center; gap: 10px; }
  .np-storage-note {
    color: #6b7280;
    font-size: 10.5px;
    font-style: italic;
  }
  .np-hidden { display: none; }
`
