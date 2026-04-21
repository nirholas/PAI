import { APPS } from './apps.js'
import { wm } from './wm.js'
import { searchDocs, type SearchResult } from './search.ts'
import { tick } from './sound.ts'
import { PINNED, colorFor } from './pinned.ts'
import { clearAllBootFlags } from './boot.ts'

type AppEntry = {
  id: string
  title: string
  icon: string
  description: string
}

type RecentFeed = {
  changelog: Array<{ kind: 'changelog'; id: string; title: string; description: string; date?: string }>
  docs: Array<{ kind: 'docs'; id: string; title: string; description: string }>
}

const DOC_SEARCH_LIMIT = 6
const SEARCH_DEBOUNCE_MS = 80
const QUICK_SHORTCUTS: Array<{ appId: string; label: string; icon: string }> = [
  { appId: 'docs', label: 'Docs', icon: '/icons/docs.svg' },
  { appId: 'flash', label: 'Flash', icon: '/icons/flash.svg' },
  { appId: 'changelog', label: 'Changelog', icon: '/icons/changelog.svg' },
]

export class StartMenu {
  private modal: HTMLElement
  private isOpen = false
  private onSelect?: (appId: string) => void
  private searchSeq = 0
  private searchTimer: number | null = null
  private clockTimer: number | null = null
  private recentLoaded = false
  private previouslyFocused: HTMLElement | null = null

  constructor(onSelect?: (appId: string) => void) {
    this.onSelect = onSelect
    this.modal = this.buildDOM()
    document.body.appendChild(this.modal)
    this.attachListeners()
  }

  // ─── DOM ──────────────────────────────────────────────────────────────────

  private buildDOM(): HTMLElement {
    const modal = document.createElement('div')
    modal.id = 'startmenu'
    modal.className = 'startmenu'
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    modal.setAttribute('aria-label', 'Start menu')
    modal.hidden = true

    modal.innerHTML = `
      <div class="startmenu-backdrop" data-sm-dismiss="1"></div>
      <div class="startmenu-panel" role="document">
        <div class="startmenu-left">
          <header class="startmenu-user">
            <button
              class="startmenu-avatar"
              type="button"
              data-sm-action="about"
              title="About PAI"
              aria-label="About PAI"
            >
              <img src="/logo/pai-logo-white.png" alt="" draggable="false">
            </button>
            <div class="startmenu-user-meta">
              <div class="startmenu-user-name">PAI user</div>
              <div class="startmenu-user-role">Local · offline</div>
            </div>
          </header>

          <div class="startmenu-search-wrap" role="search">
            <svg class="startmenu-search-icon" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" stroke-width="1.4"/>
              <path d="M11 11l3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
            <input
              type="text"
              class="startmenu-search"
              id="startmenu-search"
              placeholder="Type here to search"
              autocomplete="off"
              spellcheck="false"
              aria-label="Search apps and documentation"
            >
          </div>

          <div class="startmenu-section-heading">Available</div>
          <div
            class="startmenu-list"
            id="startmenu-applist"
            role="listbox"
            aria-label="All applications"
          >
            ${this.renderAppList()}
          </div>
          <div
            class="startmenu-empty"
            id="startmenu-applist-empty"
            role="status"
            aria-live="polite"
            hidden
          ></div>
        </div>

        <div class="startmenu-right">
          <section class="startmenu-card startmenu-card--top">
            <div class="startmenu-shortcuts" role="group" aria-label="Quick shortcuts">
              ${QUICK_SHORTCUTS.map((s) => `
                <button
                  class="startmenu-shortcut"
                  type="button"
                  data-sm-app="${escapeAttr(s.appId)}"
                  title="${escapeAttr(s.label)}"
                  aria-label="Open ${escapeAttr(s.label)}"
                >
                  <img src="${escapeAttr(s.icon)}" alt="" aria-hidden="true">
                  <span>${escapeHtml(s.label)}</span>
                </button>
              `).join('')}
            </div>
            <div class="startmenu-clock" aria-live="off">
              <div class="startmenu-clock-time" id="startmenu-clock-time">--:--:--</div>
              <div class="startmenu-clock-date" id="startmenu-clock-date">—</div>
              <div class="startmenu-clock-actions">
                <button
                  class="startmenu-iconbtn"
                  type="button"
                  data-sm-action="lock"
                  title="Lock"
                  aria-label="Lock screen"
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/>
                    <path d="M5 7V5a3 3 0 1 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.4"/>
                  </svg>
                </button>
                <button
                  class="startmenu-iconbtn"
                  type="button"
                  data-sm-action="power"
                  title="Restart session"
                  aria-label="Restart session"
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M8 2v6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                    <path d="M4.5 4.5a5 5 0 1 0 7 0" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </section>

          <section class="startmenu-card">
            <div class="startmenu-card-header">
              <span>Pinned</span>
            </div>
            <div class="startmenu-grid" role="listbox" aria-label="Pinned applications">
              ${this.renderPinnedGrid()}
            </div>
          </section>

          <section class="startmenu-card" id="startmenu-recent-card">
            <div class="startmenu-card-header">
              <span>Recommended</span>
            </div>
            <div class="startmenu-recent" id="startmenu-recent" role="listbox" aria-label="Recommended items">
              <div class="startmenu-recent-loading">Loading…</div>
            </div>
          </section>

          <section class="startmenu-card startmenu-card--docs" id="startmenu-docs-card" hidden>
            <div class="startmenu-card-header">
              <span>Docs search</span>
            </div>
            <div class="startmenu-docs" id="startmenu-docs" role="listbox" aria-label="Documentation results"></div>
          </section>
        </div>
      </div>
    `

    return modal
  }

  private renderAppList(): string {
    const apps = Object.values(APPS) as AppEntry[]
    return apps
      .map(
        (app) => `
      <button
        class="startmenu-listitem"
        type="button"
        data-sm-app="${escapeAttr(app.id)}"
        role="option"
        aria-selected="false"
        title="${escapeAttr(app.description)}"
      >
        <img class="startmenu-listitem-icon" src="${escapeAttr(app.icon)}" alt="" aria-hidden="true">
        <span class="startmenu-listitem-label">${escapeHtml(app.title)}</span>
      </button>
    `,
      )
      .join('')
  }

  private renderPinnedGrid(): string {
    return PINNED
      .map((id) => {
        const app = (APPS as Record<string, AppEntry>)[id]
        if (!app) return ''
        const color = colorFor(id)
        return `
      <button
        class="startmenu-tile"
        type="button"
        data-sm-app="${escapeAttr(id)}"
        role="option"
        aria-selected="false"
        style="--tile-accent:${color}"
        title="${escapeAttr(app.description)}"
      >
        <span class="startmenu-tile-icon-wrap">
          <img class="startmenu-tile-icon" src="${escapeAttr(app.icon)}" alt="" aria-hidden="true">
        </span>
        <span class="startmenu-tile-label">${escapeHtml(app.title)}</span>
      </button>
    `
      })
      .join('')
  }

  // ─── Listeners ────────────────────────────────────────────────────────────

  private attachListeners(): void {
    this.modal.addEventListener('click', this.handleClick)
    this.modal.addEventListener('mouseover', this.handleHover)

    const search = this.searchInput()
    search.addEventListener('input', () => {
      const q = search.value
      this.filterAppList(q)
      this.scheduleDocSearch(q)
    })

    document.addEventListener('keydown', this.handleKey)
  }

  private handleClick = (e: MouseEvent): void => {
    const target = e.target as HTMLElement
    if (!target) return

    if (target.closest('[data-sm-dismiss]')) {
      this.close()
      return
    }

    const actionEl = target.closest<HTMLElement>('[data-sm-action]')
    if (actionEl) {
      this.runAction(actionEl.dataset.smAction!)
      return
    }

    const appEl = target.closest<HTMLElement>('[data-sm-app]')
    if (appEl) {
      this.selectApp(appEl.dataset.smApp!)
      return
    }

    const docEl = target.closest<HTMLElement>('[data-sm-doc]')
    if (docEl) {
      this.selectDoc(docEl.dataset.smDoc!)
      return
    }

    const changelogEl = target.closest<HTMLElement>('[data-sm-changelog]')
    if (changelogEl) {
      this.selectApp('changelog')
      return
    }
  }

  private handleHover = (e: MouseEvent): void => {
    const target = e.target as HTMLElement
    const item = target.closest<HTMLElement>(
      '.startmenu-listitem, .startmenu-tile, .startmenu-recent-item, .startmenu-doc-item',
    )
    if (item) this.setFocus(item)
  }

  private handleKey = (e: KeyboardEvent): void => {
    // Global toggles — active whether or not menu is open.
    if (e.altKey && (e.key === 'd' || e.code === 'KeyD')) {
      e.preventDefault()
      this.toggle()
      return
    }
    if (e.key === 'Meta' || e.key === 'OS') {
      // Ignore bare meta-key press to avoid stealing OS-level shortcuts.
      return
    }

    if (!this.isOpen) return

    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        this.close()
        return
      case 'Tab':
        this.trapFocus(e)
        return
      case 'ArrowDown':
      case 'ArrowUp':
      case 'Enter':
        this.handleArrow(e)
        return
    }
  }

  private handleArrow(e: KeyboardEvent): void {
    const visible = this.focusableItems()
    if (!visible.length) return

    const focused = this.modal.querySelector<HTMLElement>('.sm-focused')
    let idx = focused ? visible.indexOf(focused) : -1

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      this.setFocus(visible[(idx + 1) % visible.length])
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      this.setFocus(visible[(idx - 1 + visible.length) % visible.length])
    } else if (e.key === 'Enter') {
      if (!focused) return
      if (document.activeElement !== this.searchInput()) return
      e.preventDefault()
      focused.click()
    }
  }

  private trapFocus(e: KeyboardEvent): void {
    const focusables = this.keyboardFocusable()
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const active = document.activeElement as HTMLElement | null

    if (e.shiftKey && active === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  // ─── Search / filter ──────────────────────────────────────────────────────

  private scheduleDocSearch(query: string): void {
    if (this.searchTimer !== null) {
      window.clearTimeout(this.searchTimer)
      this.searchTimer = null
    }
    this.searchTimer = window.setTimeout(
      () => this.runDocSearch(query),
      SEARCH_DEBOUNCE_MS,
    )
  }

  private async runDocSearch(query: string): Promise<void> {
    const seq = ++this.searchSeq
    const results = await searchDocs(query, DOC_SEARCH_LIMIT)
    if (seq !== this.searchSeq) return
    this.renderDocResults(results, query.trim().length > 0)
  }

  private renderDocResults(results: SearchResult[], hasQuery: boolean): void {
    const card = this.modal.querySelector<HTMLElement>('#startmenu-docs-card')!
    const list = this.modal.querySelector<HTMLElement>('#startmenu-docs')!
    if (!hasQuery || results.length === 0) {
      card.hidden = true
      list.innerHTML = ''
      return
    }
    list.innerHTML = results
      .map(
        (r) => `
      <button
        class="startmenu-doc-item"
        type="button"
        data-sm-doc="${escapeAttr(r.id)}"
        role="option"
        aria-selected="false"
        title="${escapeAttr(r.description)}"
      >
        <span class="startmenu-doc-title">${escapeHtml(r.title)}</span>
        ${r.description ? `<span class="startmenu-doc-desc">${escapeHtml(r.description)}</span>` : ''}
      </button>
    `,
      )
      .join('')
    card.hidden = false
  }

  private filterAppList(query: string): void {
    const q = query.trim().toLowerCase()
    const list = this.modal.querySelector<HTMLElement>('#startmenu-applist')!
    const empty = this.modal.querySelector<HTMLElement>(
      '#startmenu-applist-empty',
    )!
    const items = list.querySelectorAll<HTMLElement>('.startmenu-listitem')
    let firstVisible: HTMLElement | null = null

    items.forEach((item) => {
      const app = (APPS as Record<string, AppEntry>)[item.dataset.smApp!]
      if (!app) return
      const match =
        !q ||
        app.title.toLowerCase().includes(q) ||
        app.description.toLowerCase().includes(q)
      item.hidden = !match
      if (match && !firstVisible) firstVisible = item
    })

    if (firstVisible) {
      this.setFocus(firstVisible)
      empty.hidden = true
      empty.textContent = ''
    } else if (q) {
      empty.hidden = false
      empty.textContent = `No apps match "${query.trim()}".`
    } else {
      empty.hidden = true
      empty.textContent = ''
    }
  }

  // ─── Recommended feed ─────────────────────────────────────────────────────

  private async loadRecent(): Promise<void> {
    if (this.recentLoaded) return
    this.recentLoaded = true
    const container = this.modal.querySelector<HTMLElement>('#startmenu-recent')!
    try {
      const res = await fetch('/recent.json')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as RecentFeed
      this.renderRecent(data)
    } catch {
      this.recentLoaded = false
      container.innerHTML = `<div class="startmenu-recent-empty">Couldn't load recommendations.</div>`
    }
  }

  private renderRecent(data: RecentFeed): void {
    const container = this.modal.querySelector<HTMLElement>('#startmenu-recent')!
    const parts: string[] = []

    for (const c of data.changelog) {
      parts.push(`
        <button
          class="startmenu-recent-item"
          type="button"
          data-sm-changelog="${escapeAttr(c.id)}"
          role="option"
          aria-selected="false"
          title="${escapeAttr(c.description)}"
        >
          <span class="startmenu-recent-kind" data-kind="changelog">Release</span>
          <span class="startmenu-recent-title">${escapeHtml(c.title)}</span>
          <span class="startmenu-recent-meta">${escapeHtml(formatDate(c.date))}</span>
        </button>
      `)
    }

    for (const d of data.docs) {
      parts.push(`
        <button
          class="startmenu-recent-item"
          type="button"
          data-sm-doc="${escapeAttr(d.id)}"
          role="option"
          aria-selected="false"
          title="${escapeAttr(d.description)}"
        >
          <span class="startmenu-recent-kind" data-kind="docs">Docs</span>
          <span class="startmenu-recent-title">${escapeHtml(d.title)}</span>
          ${d.description ? `<span class="startmenu-recent-meta">${escapeHtml(d.description)}</span>` : ''}
        </button>
      `)
    }

    if (parts.length === 0) {
      container.innerHTML = `<div class="startmenu-recent-empty">No recent items yet.</div>`
      return
    }

    container.innerHTML = parts.join('')
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  private runAction(action: string): void {
    switch (action) {
      case 'about':
        this.selectApp('about')
        return
      case 'lock':
        tick()
        this.close()
        window.dispatchEvent(new CustomEvent('pai:lock'))
        return
      case 'power':
        tick()
        this.close()
        clearAllBootFlags()
        window.location.reload()
        return
    }
  }

  private selectApp(appId: string): void {
    tick()
    this.close()
    this.onSelect?.(appId)
  }

  private selectDoc(slug: string): void {
    tick()
    this.close()
    const docsApp = (APPS as Record<string, { default?: { w?: number; h?: number } }>).docs
    wm.open('docs', {
      params: { hash: slug },
      w: docsApp?.default?.w,
      h: docsApp?.default?.h,
    })
  }

  // ─── Focus / visibility ───────────────────────────────────────────────────

  private focusableItems(): HTMLElement[] {
    const sel =
      '.startmenu-listitem:not([hidden]), .startmenu-tile, .startmenu-recent-item, .startmenu-doc-item'
    return Array.from(this.modal.querySelectorAll<HTMLElement>(sel))
  }

  private keyboardFocusable(): HTMLElement[] {
    const sel =
      'button:not([disabled]):not([hidden]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    return Array.from(this.modal.querySelectorAll<HTMLElement>(sel)).filter(
      (el) => el.offsetParent !== null,
    )
  }

  private setFocus(item: HTMLElement): void {
    this.modal
      .querySelectorAll('.sm-focused')
      .forEach((el) => {
        el.classList.remove('sm-focused')
        el.setAttribute('aria-selected', 'false')
      })
    item.classList.add('sm-focused')
    if (item.getAttribute('role') === 'option') {
      item.setAttribute('aria-selected', 'true')
    }
    item.scrollIntoView({ block: 'nearest' })
  }

  private searchInput(): HTMLInputElement {
    return this.modal.querySelector<HTMLInputElement>('#startmenu-search')!
  }

  private startClock(): void {
    const render = (): void => {
      const now = new Date()
      const timeEl = this.modal.querySelector<HTMLElement>('#startmenu-clock-time')
      const dateEl = this.modal.querySelector<HTMLElement>('#startmenu-clock-date')
      if (timeEl) {
        timeEl.textContent = now.toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
        })
      }
      if (dateEl) {
        dateEl.textContent = now.toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      }
    }
    render()
    this.clockTimer = window.setInterval(render, 1000)
  }

  private stopClock(): void {
    if (this.clockTimer !== null) {
      window.clearInterval(this.clockTimer)
      this.clockTimer = null
    }
  }

  private syncAriaExpanded(expanded: boolean): void {
    const btn = document.querySelector<HTMLElement>('[data-dock-start]')
    if (btn) btn.setAttribute('aria-expanded', expanded ? 'true' : 'false')
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  toggle(): void {
    if (this.isOpen) this.close()
    else this.open()
  }

  open(): void {
    if (this.isOpen) return
    this.previouslyFocused = document.activeElement as HTMLElement | null
    this.modal.hidden = false
    // Force reflow so the open-state transition fires.
    void this.modal.offsetHeight
    this.modal.classList.add('open')
    this.isOpen = true
    tick()
    this.syncAriaExpanded(true)

    const search = this.searchInput()
    search.value = ''
    this.filterAppList('')
    this.renderDocResults([], false)
    search.focus()

    this.startClock()
    this.loadRecent()
  }

  close(): void {
    if (!this.isOpen) return
    this.modal.classList.remove('open')
    this.isOpen = false
    this.syncAriaExpanded(false)
    this.stopClock()

    // Wait for transition before hiding from AT.
    window.setTimeout(() => {
      if (!this.isOpen) this.modal.hidden = true
    }, 180)

    const prev = this.previouslyFocused
    this.previouslyFocused = null
    if (prev && document.contains(prev)) prev.focus()
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c]!,
  )
}

function escapeAttr(s: string): string {
  return escapeHtml(s)
}

function formatDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.valueOf())) return ''
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
