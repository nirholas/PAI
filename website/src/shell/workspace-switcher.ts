// PAI — Workspace switcher overlay.
//
// Super+Tab or topbar button opens an overlay with 4 workspace tiles.
// Each tile shows the workspace number, a window count for that workspace,
// and the current one is highlighted. Click or arrow keys + Enter to switch.
//
// PAI already persists per-workspace state under `pai-wm-<n>`; we read it
// directly (peek-only) to count windows for inactive workspaces.

import { wm } from './wm.js'

const WS_COUNT = 4
const STORAGE_PREFIX = 'pai-wm-'

let _overlay: HTMLDivElement | null = null
let _isOpen = false
let _selectedIdx = 0

function countWindows(ws: number): number {
  const active = wm.getActiveWorkspace?.() ?? 1
  if (ws === active) return wm.list?.()?.length ?? 0
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${ws}`)
    if (!raw) return 0
    const parsed = JSON.parse(raw)
    const count = parsed && parsed.windows ? Object.keys(parsed.windows).length : 0
    return count
  } catch {
    return 0
  }
}

function render(): void {
  if (!_overlay) return
  const grid = _overlay.querySelector('.ws-switcher__grid')
  if (!grid) return
  const active = wm.getActiveWorkspace?.() ?? 1
  _selectedIdx = Math.max(0, Math.min(WS_COUNT - 1, active - 1))
  let html = ''
  for (let i = 1; i <= WS_COUNT; i++) {
    const n = countWindows(i)
    const isActive = i === active
    const isSelected = i - 1 === _selectedIdx
    html += `
      <button class="ws-switcher__tile${isActive ? ' is-active' : ''}${isSelected ? ' is-selected' : ''}"
              data-ws="${i}" type="button">
        <span class="ws-switcher__num">${i}</span>
        <span class="ws-switcher__count">${n} ${n === 1 ? 'window' : 'windows'}</span>
        ${isActive ? '<span class="ws-switcher__badge">Current</span>' : ''}
      </button>
    `
  }
  grid.innerHTML = html
  grid.querySelectorAll<HTMLButtonElement>('.ws-switcher__tile').forEach((el) => {
    el.addEventListener('click', () => {
      const ws = +(el.dataset.ws ?? 1)
      switchTo(ws)
    })
  })
}

function updateSelection(): void {
  if (!_overlay) return
  _overlay
    .querySelectorAll<HTMLElement>('.ws-switcher__tile')
    .forEach((el, i) => {
      el.classList.toggle('is-selected', i === _selectedIdx)
    })
}

function switchTo(ws: number): void {
  wm.switchWorkspace?.(ws)
  closeWorkspaceSwitcher()
}

function ensureOverlay(): HTMLDivElement {
  if (_overlay) return _overlay
  const el = document.createElement('div')
  el.className = 'ws-switcher'
  el.setAttribute('role', 'dialog')
  el.setAttribute('aria-label', 'Workspace switcher')
  el.hidden = true
  el.innerHTML = `
    <div class="ws-switcher__backdrop"></div>
    <div class="ws-switcher__panel">
      <div class="ws-switcher__title">Workspaces</div>
      <div class="ws-switcher__grid"></div>
      <div class="ws-switcher__hint">← → to navigate · Enter to switch · Esc to close</div>
    </div>
  `
  el.querySelector('.ws-switcher__backdrop')?.addEventListener('mousedown', (e) => {
    if (e.target === e.currentTarget) closeWorkspaceSwitcher()
  })
  document.body.appendChild(el)
  _overlay = el
  return el
}

function onKeyDown(e: KeyboardEvent): void {
  if (!_isOpen) return
  if (e.key === 'Escape') {
    e.preventDefault()
    closeWorkspaceSwitcher()
  } else if (e.key === 'ArrowRight' || e.key === 'Tab') {
    e.preventDefault()
    _selectedIdx = (_selectedIdx + 1) % WS_COUNT
    updateSelection()
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    _selectedIdx = (_selectedIdx - 1 + WS_COUNT) % WS_COUNT
    updateSelection()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    switchTo(_selectedIdx + 1)
  } else if (/^[1-4]$/.test(e.key)) {
    e.preventDefault()
    switchTo(parseInt(e.key, 10))
  }
}

export function openWorkspaceSwitcher(): void {
  ensureOverlay()
  if (!_overlay) return
  render()
  _overlay.hidden = false
  _isOpen = true
  requestAnimationFrame(() => _overlay?.classList.add('is-open'))
}

export function closeWorkspaceSwitcher(): void {
  if (!_overlay) return
  _overlay.classList.remove('is-open')
  _overlay.hidden = true
  _isOpen = false
}

export function toggleWorkspaceSwitcher(): void {
  if (_isOpen) closeWorkspaceSwitcher()
  else openWorkspaceSwitcher()
}

export function initWorkspaceSwitcher(): void {
  ensureOverlay()
  document.addEventListener('keydown', onKeyDown, true)
}
