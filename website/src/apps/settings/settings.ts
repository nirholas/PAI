// Settings app — PAI. All settings persist to localStorage and apply live.

import { bridge } from '../_bridge.js'

const LS = {
  theme: 'pai-settings-theme',
  accent: 'pai-settings-accent',
  wallpaper: 'pai-settings-wallpaper',
  widgets: 'pai-settings-widgets',
  sound: 'pai-settings-sound',
  clicks: 'pai-settings-clicks',
  volume: 'pai-settings-volume',
  privacy: 'pai-settings-privacy',
  reducedMotion: 'pai-settings-reduced-motion',
}

const ACCENTS: Array<{ name: string; color: string }> = [
  { name: 'Blue', color: '#7aa2f7' },
  { name: 'Purple', color: '#9f7aea' },
  { name: 'Green', color: '#4ade80' },
  { name: 'Yellow', color: '#fbbf24' },
  { name: 'Pink', color: '#f472b6' },
  { name: 'Red', color: '#f87171' },
]

const WALLPAPERS = [
  { id: 'default', label: 'Default', path: '/wallpapers/default.svg', bg: '#0f0f1a' },
  { id: 'dusk', label: 'Dusk', path: '/wallpapers/dusk.svg', bg: '#1f1029' },
  { id: 'midnight', label: 'Midnight', path: '/wallpapers/midnight.svg', bg: '#050510' },
]

const STATIC_SHORTCUTS: Array<{ key: string; desc: string }> = [
  { key: 'Super+1…9', desc: 'Switch workspace' },
  { key: 'Super+Space', desc: 'Open launcher' },
  { key: 'Alt+Tab', desc: 'Cycle windows' },
  { key: 'Alt+F4', desc: 'Close window' },
  { key: 'Alt+F9', desc: 'Minimize window' },
  { key: 'Super+Up', desc: 'Maximize window' },
  { key: 'Super+Left/Right', desc: 'Tile window' },
  { key: 'Ctrl+S', desc: 'Save (in editors)' },
  { key: 'Ctrl+F', desc: 'Find (in editors)' },
  { key: 'Escape', desc: 'Close modals / lightbox' },
]

function get(key: string, def: string): string {
  try { return localStorage.getItem(key) ?? def } catch { return def }
}
function set(key: string, val: string) {
  try { localStorage.setItem(key, val) } catch {}
}

function bool(key: string, def: boolean): boolean {
  const v = get(key, def ? '1' : '0')
  return v === '1'
}

function applyTheme(theme: string) {
  const shellDoc = (window.parent !== window && bridge.inShell) ? null : document
  const docs: Document[] = [document]
  try {
    if (bridge.inShell) {
      // can't set on parent directly (same-origin permits, but keep via bridge event)
      if (window.parent?.document) docs.push(window.parent.document)
    }
  } catch {}
  const resolved = theme === 'auto'
    ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : theme
  docs.forEach((d) => {
    d.documentElement.setAttribute('data-theme', resolved)
  })
}

function applyAccent(color: string) {
  const docs: Document[] = [document]
  try { if (bridge.inShell && window.parent?.document) docs.push(window.parent.document) } catch {}
  docs.forEach((d) => {
    d.documentElement.style.setProperty('--pai-blue', color)
  })
}

function applyWallpaper(id: string) {
  const w = WALLPAPERS.find((x) => x.id === id) ?? WALLPAPERS[0]
  try {
    if (bridge.inShell && window.parent?.document) {
      const root = window.parent.document.documentElement
      root.style.setProperty('--wallpaper-url', `url("${w.path}")`)
      root.style.setProperty('--wallpaper-bg', w.bg)
      // also try data attribute for any shell that keys off it
      root.setAttribute('data-wallpaper', id)
    }
  } catch {}
}

function applyPrivacy(on: boolean) {
  try {
    if (bridge.inShell && window.parent?.document) {
      window.parent.document.documentElement.classList.toggle('pai-privacy', on)
    }
  } catch {}
  document.documentElement.classList.toggle('pai-privacy', on)
}

function applyReducedMotion(on: boolean) {
  try {
    if (bridge.inShell && window.parent?.document) {
      window.parent.document.documentElement.toggleAttribute('data-reduced-motion', on)
    }
  } catch {}
  document.documentElement.toggleAttribute('data-reduced-motion', on)
}

function applyWidgets(on: boolean) {
  try {
    if (bridge.inShell && window.parent?.document) {
      window.parent.document.documentElement.classList.toggle('pai-no-widgets', !on)
    }
  } catch {}
}

export function mountSettings(root: HTMLElement) {
  // ── Nav
  const navButtons = root.querySelectorAll<HTMLButtonElement>('.set-nav button')
  const sections = root.querySelectorAll<HTMLElement>('.set-section')
  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.section!
      navButtons.forEach((b) => b.setAttribute('aria-selected', b === btn ? 'true' : 'false'))
      sections.forEach((s) => s.classList.toggle('active', s.dataset.section === target))
    })
  })

  // ── Appearance: Theme
  const themeSel = root.querySelector<HTMLSelectElement>('.set-theme')!
  themeSel.value = get(LS.theme, 'dark')
  themeSel.addEventListener('change', () => {
    set(LS.theme, themeSel.value)
    applyTheme(themeSel.value)
  })
  applyTheme(themeSel.value)

  // ── Appearance: Accent
  const accentRow = root.querySelector<HTMLElement>('.accent-row')!
  const currentAccent = get(LS.accent, ACCENTS[0].color)
  ACCENTS.forEach((a) => {
    const sw = document.createElement('button')
    sw.className = 'accent'
    sw.style.background = a.color
    sw.title = a.name
    sw.setAttribute('aria-label', `Accent ${a.name}`)
    if (a.color.toLowerCase() === currentAccent.toLowerCase()) sw.classList.add('selected')
    sw.addEventListener('click', () => {
      accentRow.querySelectorAll('.accent').forEach((el) => el.classList.remove('selected'))
      sw.classList.add('selected')
      set(LS.accent, a.color)
      applyAccent(a.color)
    })
    accentRow.appendChild(sw)
  })
  applyAccent(currentAccent)

  // ── Appearance: Wallpaper
  const wallGrid = root.querySelector<HTMLElement>('.wall-grid')!
  const currentWall = get(LS.wallpaper, 'default')
  WALLPAPERS.forEach((w) => {
    const tile = document.createElement('button')
    tile.className = 'wall-tile'
    tile.style.background = w.bg
    tile.style.backgroundImage = `url("${w.path}")`
    tile.style.backgroundSize = 'cover'
    tile.setAttribute('aria-label', `Wallpaper ${w.label}`)
    if (w.id === currentWall) tile.classList.add('selected')
    const label = document.createElement('span')
    label.className = 'wall-label'
    label.textContent = w.label
    tile.appendChild(label)
    tile.addEventListener('click', () => {
      wallGrid.querySelectorAll('.wall-tile').forEach((el) => el.classList.remove('selected'))
      tile.classList.add('selected')
      set(LS.wallpaper, w.id)
      applyWallpaper(w.id)
    })
    wallGrid.appendChild(tile)
  })
  applyWallpaper(currentWall)

  // ── Generic toggle helper
  function bindToggle(sel: string, key: string, def: boolean, onChange: (val: boolean) => void) {
    const el = root.querySelector<HTMLInputElement>(sel)!
    el.checked = bool(key, def)
    el.addEventListener('change', () => {
      set(key, el.checked ? '1' : '0')
      onChange(el.checked)
    })
    onChange(el.checked)
  }

  bindToggle('#tog-widgets', LS.widgets, true, applyWidgets)
  bindToggle('#tog-sound', LS.sound, true, () => {})
  bindToggle('#tog-clicks', LS.clicks, true, () => {})
  bindToggle('#tog-privacy', LS.privacy, false, applyPrivacy)
  bindToggle('#tog-reduced-motion', LS.reducedMotion, false, applyReducedMotion)

  // ── Volume
  const vol = root.querySelector<HTMLInputElement>('.range-volume')!
  vol.value = get(LS.volume, '70')
  const volLbl = root.querySelector<HTMLElement>('.range-volume-label')!
  volLbl.textContent = vol.value + '%'
  vol.addEventListener('input', () => {
    set(LS.volume, vol.value)
    volLbl.textContent = vol.value + '%'
  })

  // ── Shortcuts
  const scContainer = root.querySelector<HTMLElement>('.sc-list')!
  let shortcuts: Array<{ key: string; desc: string }> = STATIC_SHORTCUTS
  try {
    const hk = (window.parent as any)?.hotkeys
    if (hk && Array.isArray(hk.list?.()) && hk.list().length) {
      shortcuts = hk.list().map((h: any) => ({ key: h.key || h.combo || '?', desc: h.desc || h.description || h.label || '?' }))
    }
  } catch {}
  scContainer.innerHTML = ''
  shortcuts.forEach((s) => {
    const k = document.createElement('span')
    k.className = 'sc-key'
    k.textContent = s.key
    const d = document.createElement('span')
    d.textContent = s.desc
    scContainer.append(k, d)
  })

  // ── About
  const buildInfo = `${new Date().toISOString().slice(0, 10)} · demo`
  const buildEl = root.querySelector<HTMLElement>('.about-build')
  if (buildEl) buildEl.textContent = buildInfo

  root.querySelector('.open-about')?.addEventListener('click', () => bridge.openApp('about'))

  // ── Reset button
  root.querySelector('.set-reset')?.addEventListener('click', () => {
    if (!confirm('Reset all settings to defaults? This will not affect your files.')) return
    Object.values(LS).forEach((k) => { try { localStorage.removeItem(k) } catch {} })
    location.reload()
  })
}
