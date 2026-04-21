// PAI — Shortcuts cheatsheet overlay.
//
// Triggered with ? or Ctrl+/. Enumerates every entry in the hotkeys registry,
// groups by category, and renders a translucent modal. Closable via Esc,
// clicking the backdrop, or re-pressing the trigger.

import { hotkeys, formatCombo, type HotkeyEntry } from './hotkeys.ts'

let _overlay: HTMLDivElement | null = null
let _isOpen = false

function groupByCategory(items: HotkeyEntry[]): Map<string, HotkeyEntry[]> {
  const groups = new Map<string, HotkeyEntry[]>()
  for (const it of items) {
    if (!it.meta.description) continue // skip un-documented entries
    const cat = it.meta.category ?? 'General'
    const arr = groups.get(cat) ?? []
    arr.push(it)
    groups.set(cat, arr)
  }
  return groups
}

function render(): void {
  if (!_overlay) return
  const panel = _overlay.querySelector('.shortcuts-help__panel')
  if (!panel) return
  const groups = groupByCategory(hotkeys.list())
  const sortedCats = [...groups.keys()].sort()
  if (!groups.size) {
    panel.innerHTML = `
      <div class="shortcuts-help__header">
        <h2>Keyboard shortcuts</h2>
        <button class="shortcuts-help__close" aria-label="Close">×</button>
      </div>
      <div class="shortcuts-help__empty">No shortcuts registered yet.</div>
    `
  } else {
    let body = ''
    for (const cat of sortedCats) {
      body += `<section class="shortcuts-help__group">
        <h3 class="shortcuts-help__group-title">${escape(cat)}</h3>
        <dl class="shortcuts-help__list">`
      for (const entry of groups.get(cat) ?? []) {
        body += `<div class="shortcuts-help__row">
          <dt><kbd>${escape(formatCombo(entry.combo))}</kbd></dt>
          <dd>${escape(entry.meta.description ?? '')}</dd>
        </div>`
      }
      body += `</dl></section>`
    }
    panel.innerHTML = `
      <div class="shortcuts-help__header">
        <h2>Keyboard shortcuts</h2>
        <button class="shortcuts-help__close" aria-label="Close">×</button>
      </div>
      <div class="shortcuts-help__body">${body}</div>
      <div class="shortcuts-help__footer">
        Press <kbd>Esc</kbd> to close. Apps may register their own shortcuts when focused.
      </div>
    `
  }
  panel
    .querySelector('.shortcuts-help__close')
    ?.addEventListener('click', () => closeShortcutsHelp())
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (m) =>
    ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[m] ?? m,
  )
}

function ensureOverlay(): HTMLDivElement {
  if (_overlay) return _overlay
  const el = document.createElement('div')
  el.className = 'shortcuts-help'
  el.setAttribute('role', 'dialog')
  el.setAttribute('aria-modal', 'true')
  el.setAttribute('aria-label', 'Keyboard shortcuts')
  el.hidden = true
  el.innerHTML = `
    <div class="shortcuts-help__backdrop"></div>
    <div class="shortcuts-help__panel"></div>
  `
  el.querySelector('.shortcuts-help__backdrop')?.addEventListener(
    'mousedown',
    (e) => {
      if (e.target === e.currentTarget) closeShortcutsHelp()
    },
  )
  document.body.appendChild(el)
  _overlay = el
  return el
}

export function openShortcutsHelp(): void {
  ensureOverlay()
  if (!_overlay) return
  render()
  _overlay.hidden = false
  _isOpen = true
  requestAnimationFrame(() => _overlay?.classList.add('is-open'))
}

export function closeShortcutsHelp(): void {
  if (!_overlay) return
  _overlay.classList.remove('is-open')
  _overlay.hidden = true
  _isOpen = false
}

export function toggleShortcutsHelp(): void {
  if (_isOpen) closeShortcutsHelp()
  else openShortcutsHelp()
}

export function initShortcutsHelp(): void {
  ensureOverlay()
  // Trigger via registry so it shows up in its own list.
  hotkeys.register('?', toggleShortcutsHelp, {
    description: 'Show keyboard shortcuts',
    category: 'Shell',
  })
  hotkeys.register('shift+?', toggleShortcutsHelp, {
    description: 'Show keyboard shortcuts',
    category: 'Shell',
  })
  hotkeys.register('ctrl+/', toggleShortcutsHelp, {
    description: 'Show keyboard shortcuts',
    category: 'Shell',
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _isOpen) {
      e.preventDefault()
      closeShortcutsHelp()
    }
  })
  document.addEventListener('pai:show-shortcuts', openShortcutsHelp as EventListener)
}
