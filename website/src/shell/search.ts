// PAI Spotlight — centered command palette.
//
// Cmd/Ctrl+K opens the palette. Searches apps (from APPS), open windows (from
// wm.list()), and built-in system commands. Arrow keys navigate, Enter runs,
// Esc closes.

import { APPS, appUrl } from './apps.js'
import { wm } from './wm.js'
import { tick, open as soundOpen, close as soundClose } from './sound.ts'

type Category = 'Apps' | 'Windows' | 'System' | 'Docs'

type Result = {
  id: string
  title: string
  subtitle?: string
  category: Category
  score: number
  icon?: string | null
  action: () => void
}

type DocEntry = {
  id: string
  title: string
  section: string
  description: string
  excerpt: string
}

export type SearchResult = Result

// ─── Optional doc index (kept for backwards compatibility) ────────────────────

let _docCache: DocEntry[] | null = null
let _docPending: Promise<DocEntry[]> | null = null

async function loadDocIndex(): Promise<DocEntry[]> {
  if (_docCache) return _docCache
  if (_docPending) return _docPending
  _docPending = fetch('/search-index.json')
    .then((r) => (r.ok ? r.json() : []))
    .then((data: DocEntry[]) => {
      _docCache = Array.isArray(data) ? data : []
      return _docCache
    })
    .catch(() => {
      _docPending = null
      return []
    })
  return _docPending
}

/** Legacy doc search — kept so existing callers don't break. */
export async function searchDocs(query: string, limit = 6): Promise<Result[]> {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const entries = await loadDocIndex()
  const terms = q.split(/\s+/).filter(Boolean)
  const results: Result[] = []
  for (const e of entries) {
    const hay = `${e.title} ${e.section} ${e.description} ${e.excerpt}`.toLowerCase()
    if (terms.every((t) => hay.includes(t))) {
      results.push({
        id: `doc:${e.id}`,
        title: e.title,
        subtitle: e.description || e.section,
        category: 'Docs',
        score: scoreMatch(e.title, q),
        action: () =>
          wm.open('docs', {
            title: e.title,
            params: { hash: e.id.replace(/^#/, '') },
          }),
      })
      if (results.length >= limit) break
    }
  }
  return results
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function fuzzy(str: string, pattern: string): boolean {
  const s = str.toLowerCase()
  const p = pattern.toLowerCase()
  let pi = 0
  let si = 0
  while (pi < p.length && si < s.length) {
    if (p[pi] === s[si]) pi++
    si++
  }
  return pi === p.length
}

function scoreMatch(title: string, q: string): number {
  const t = title.toLowerCase()
  if (!q) return 0
  if (t === q) return 100
  if (t.startsWith(q)) return 80
  if (t.includes(q)) return 60
  if (fuzzy(t, q)) return 30
  return 0
}

// ─── Providers ────────────────────────────────────────────────────────────────

function appResults(q: string): Result[] {
  const out: Result[] = []
  for (const app of Object.values(APPS) as Array<{
    id: string
    title: string
    description?: string
    icon?: string
    default?: { w?: number; h?: number }
  }>) {
    const score = scoreMatch(app.title, q)
    if (!score && !fuzzy(app.id, q)) continue
    out.push({
      id: `app:${app.id}`,
      title: app.title,
      subtitle: app.description ?? 'Application',
      icon: app.icon ?? null,
      category: 'Apps',
      score: score || 15,
      action: () => {
        const existing = wm.getByAppId(app.id)
        if (existing) {
          wm.focus(existing.id)
        } else {
          wm.open(app.id, {
            title: app.title,
            w: app.default?.w,
            h: app.default?.h,
          })
        }
      },
    })
  }
  return out
}

function windowResults(q: string): Result[] {
  const out: Result[] = []
  const wins = wm.list?.() ?? []
  for (const w of wins) {
    const score = scoreMatch(w.title, q)
    if (!score && !fuzzy(w.appId, q) && !fuzzy(w.title, q)) continue
    const app = (APPS as Record<string, { icon?: string }>)[w.appId]
    out.push({
      id: `win:${w.id}`,
      title: w.title,
      subtitle: w.minimized ? 'Minimised window' : 'Open window',
      icon: app?.icon ?? null,
      category: 'Windows',
      score: score || 20,
      action: () => {
        if (w.minimized && (wm as unknown as { unminimize?: (id: string) => void }).unminimize) {
          ;(wm as unknown as { unminimize: (id: string) => void }).unminimize(w.id)
        } else {
          wm.focus(w.id)
        }
      },
    })
  }
  return out
}

type SystemCmd = {
  id: string
  title: string
  subtitle: string
  hotkey?: string
  run: () => void
}

const SYSTEM_COMMANDS: SystemCmd[] = [
  {
    id: 'lock',
    title: 'Lock',
    subtitle: 'Lock the desktop',
    hotkey: 'Ctrl+Alt+L',
    run: () => {
      const ls = (window as unknown as { __lockscreen?: { lock?: () => void } })
        .__lockscreen
      if (ls?.lock) ls.lock()
      else document.dispatchEvent(new CustomEvent('pai:lock'))
    },
  },
  {
    id: 'new-workspace',
    title: 'New workspace',
    subtitle: 'Switch to the next workspace',
    hotkey: 'Ctrl+Alt+→',
    run: () => {
      const cur = wm.getActiveWorkspace?.() ?? 1
      const next = (cur % 4) + 1
      wm.switchWorkspace?.(next)
    },
  },
  {
    id: 'toggle-theme',
    title: 'Toggle theme',
    subtitle: 'Switch between light and dark',
    run: () => {
      const html = document.documentElement
      const cur = html.dataset.theme ?? 'dark'
      const next = cur === 'dark' ? 'light' : 'dark'
      html.dataset.theme = next
      try {
        localStorage.setItem('pai-theme', next)
      } catch {}
    },
  },
  {
    id: 'show-shortcuts',
    title: 'Show shortcuts',
    subtitle: 'Open the keyboard shortcuts cheatsheet',
    hotkey: '?',
    run: () => {
      document.dispatchEvent(new CustomEvent('pai:show-shortcuts'))
    },
  },
  {
    id: 'sign-out',
    title: 'Sign out',
    subtitle: 'Clear session and return to the lock screen',
    run: () => {
      const ls = (window as unknown as { __lockscreen?: { lock?: () => void } })
        .__lockscreen
      if (ls?.lock) ls.lock()
      else document.dispatchEvent(new CustomEvent('pai:lock'))
    },
  },
]

function systemResults(q: string): Result[] {
  return SYSTEM_COMMANDS.filter(
    (cmd) => scoreMatch(cmd.title, q) || fuzzy(cmd.title, q),
  ).map((cmd) => ({
    id: `sys:${cmd.id}`,
    title: cmd.title,
    subtitle: cmd.hotkey ? `${cmd.subtitle} — ${cmd.hotkey}` : cmd.subtitle,
    icon: null,
    category: 'System',
    score: scoreMatch(cmd.title, q) || 25,
    action: cmd.run,
  }))
}

// ─── Ranking ──────────────────────────────────────────────────────────────────

function rank(results: Result[]): Result[] {
  results.sort((a, b) => b.score - a.score)
  return results.slice(0, 20)
}

// ─── DOM construction ─────────────────────────────────────────────────────────

let _overlay: HTMLDivElement | null = null
let _input: HTMLInputElement | null = null
let _listEl: HTMLDivElement | null = null
let _results: Result[] = []
let _selectedIdx = 0
let _isOpen = false

function ensureOverlay(): HTMLDivElement {
  if (_overlay) return _overlay
  const el = document.createElement('div')
  el.className = 'spotlight'
  el.setAttribute('role', 'dialog')
  el.setAttribute('aria-modal', 'true')
  el.setAttribute('aria-label', 'Spotlight search')
  el.hidden = true
  el.innerHTML = `
    <div class="spotlight__backdrop"></div>
    <div class="spotlight__panel">
      <div class="spotlight__input-wrap">
        <svg class="spotlight__icon" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.5"/>
          <line x1="11" y1="11" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <input
          class="spotlight__input"
          type="text"
          autocomplete="off"
          spellcheck="false"
          placeholder="Search apps, windows, and commands..."
          aria-label="Search"
          aria-controls="spotlight-results"
        />
      </div>
      <div
        class="spotlight__results"
        id="spotlight-results"
        role="listbox"
      ></div>
      <div class="spotlight__footer">
        <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
        <span><kbd>↵</kbd> run</span>
        <span><kbd>Esc</kbd> close</span>
      </div>
    </div>
  `
  document.body.appendChild(el)
  _overlay = el
  _input = el.querySelector('.spotlight__input')
  _listEl = el.querySelector('.spotlight__results')

  _overlay
    .querySelector('.spotlight__backdrop')
    ?.addEventListener('mousedown', (e) => {
      if (e.target === e.currentTarget) closeSpotlight()
    })
  _input?.addEventListener('input', () => runSearch(_input!.value))
  _input?.addEventListener('keydown', onKeyDown)
  return el
}

function render(): void {
  if (!_listEl) return
  if (!_results.length) {
    _listEl.innerHTML = `<div class="spotlight__empty">${
      _input?.value.trim()
        ? 'No results'
        : 'Type to search apps, windows, and commands…'
    }</div>`
    return
  }
  // group by category
  const groups = new Map<Category, Result[]>()
  for (const r of _results) {
    const arr = groups.get(r.category) ?? []
    arr.push(r)
    groups.set(r.category, arr)
  }
  let globalIdx = 0
  let html = ''
  for (const [cat, arr] of groups) {
    html += `<div class="spotlight__group-label">${cat}</div>`
    for (const r of arr) {
      const selected = globalIdx === _selectedIdx
      const iconHtml = r.icon
        ? `<img class="spotlight__row-icon" src="${r.icon}" alt="" />`
        : `<span class="spotlight__row-icon spotlight__row-icon--bullet">●</span>`
      html += `
        <div class="spotlight__row${selected ? ' is-selected' : ''}"
             role="option" aria-selected="${selected}"
             data-idx="${globalIdx}">
          ${iconHtml}
          <div class="spotlight__row-text">
            <div class="spotlight__row-title">${escapeHtml(r.title)}</div>
            ${r.subtitle ? `<div class="spotlight__row-sub">${escapeHtml(r.subtitle)}</div>` : ''}
          </div>
          <kbd class="spotlight__row-kbd">↵</kbd>
        </div>
      `
      globalIdx++
    }
  }
  _listEl.innerHTML = html
  _listEl.querySelectorAll<HTMLElement>('.spotlight__row').forEach((row) => {
    row.addEventListener('mousemove', () => {
      const idx = +(row.dataset.idx ?? 0)
      if (idx !== _selectedIdx) {
        _selectedIdx = idx
        updateSelection()
      }
    })
    row.addEventListener('click', () => {
      const idx = +(row.dataset.idx ?? 0)
      _selectedIdx = idx
      execSelected()
    })
  })
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (m) => {
    return (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] ?? m
    )
  })
}

function updateSelection(): void {
  if (!_listEl) return
  _listEl.querySelectorAll<HTMLElement>('.spotlight__row').forEach((row, i) => {
    const sel = i === _selectedIdx
    row.classList.toggle('is-selected', sel)
    row.setAttribute('aria-selected', String(sel))
    if (sel) row.scrollIntoView({ block: 'nearest' })
  })
}

// ─── Search runner ────────────────────────────────────────────────────────────

function runSearch(raw: string): void {
  const q = raw.trim().toLowerCase()
  let results: Result[] = []
  if (!q) {
    // show a default palette: all apps + commands
    results = [
      ...appResults('').slice(0, 8).map((r) => ({ ...r, score: 10 })),
      ...SYSTEM_COMMANDS.map((cmd) => ({
        id: `sys:${cmd.id}`,
        title: cmd.title,
        subtitle: cmd.hotkey
          ? `${cmd.subtitle} — ${cmd.hotkey}`
          : cmd.subtitle,
        category: 'System' as Category,
        score: 5,
        icon: null,
        action: cmd.run,
      })),
    ]
  } else {
    results = [
      ...appResults(q),
      ...windowResults(q),
      ...systemResults(q),
    ]
  }
  _results = rank(results)
  _selectedIdx = 0
  render()
}

// ─── Key handling ─────────────────────────────────────────────────────────────

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    e.preventDefault()
    closeSpotlight()
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (_results.length) {
      _selectedIdx = (_selectedIdx + 1) % _results.length
      updateSelection()
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (_results.length) {
      _selectedIdx = (_selectedIdx - 1 + _results.length) % _results.length
      updateSelection()
    }
  } else if (e.key === 'Enter') {
    e.preventDefault()
    execSelected()
  }
}

function execSelected(): void {
  const r = _results[_selectedIdx]
  if (!r) return
  tick()
  closeSpotlight()
  try {
    r.action()
  } catch (err) {
    console.error('[spotlight] action failed', err)
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function openSpotlight(): void {
  ensureOverlay()
  if (!_overlay || !_input) return
  _overlay.hidden = false
  _isOpen = true
  _input.value = ''
  runSearch('')
  soundOpen()
  requestAnimationFrame(() => {
    _overlay?.classList.add('is-open')
    _input?.focus()
  })
}

export function closeSpotlight(): void {
  if (!_overlay) return
  _overlay.classList.remove('is-open')
  _overlay.hidden = true
  _isOpen = false
  soundClose()
}

export function toggleSpotlight(): void {
  if (_isOpen) closeSpotlight()
  else openSpotlight()
}

export function initSpotlight(): void {
  ensureOverlay()
}

if (typeof window !== 'undefined') {
  ;(window as unknown as { __spotlight: { open: () => void; close: () => void; toggle: () => void } }).__spotlight = {
    open: openSpotlight,
    close: closeSpotlight,
    toggle: toggleSpotlight,
  }
}
