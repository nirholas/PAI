// Dock — floating pill launcher.
// Call initDock() once after the DOM is ready.
import { wm } from './wm.js'
import { APPS } from './apps.js'
import { tick } from './sound.ts'
import { PINNED, APP_COLORS } from './pinned.ts'

let _ctxMenu = null
let _preview = null
let _previewTimer = 0
const _pinned = PINNED.slice()

// ─── Render ───────────────────────────────────────────────────────────────────

function _render() {
  const dock = document.getElementById('dock')
  if (!dock) return

  const runningList = wm.list()
  // A single app may have many windows — aggregate by appId for pinned slots.
  const runningByApp = new Map()
  for (const w of runningList) {
    const arr = runningByApp.get(w.appId) ?? []
    arr.push(w)
    runningByApp.set(w.appId, arr)
  }
  // Back-compat alias — the rest of this function reads `running.get(id)` and
  // expects the *focused* window (or first) so it can set focus/running state.
  const running = new Map(
    [...runningByApp.entries()].map(([appId, wins]) => [
      appId,
      wins.find((w) => w.focused) ?? wins[0],
    ]),
  )
  const pinnedSet = new Set(_pinned)
  const extra = runningList.filter((w) => !pinnedSet.has(w.appId))

  const iconHtml = (id, app, color) => {
    const src = app?.icon
    return src
      ? `<img class="dock-icon-img" src="${src}" alt="" draggable="false" />`
      : `<span class="dock-icon-fallback" style="--app-color:${color}">${(id[0] ?? '?').toUpperCase()}</span>`
  }

  let html = `
    <button class="dock-icon dock-start" data-dock-start="1"
            title="Start" aria-label="Start menu"
            aria-haspopup="dialog" aria-expanded="false"
            aria-controls="startmenu" tabindex="0">
      <span class="dock-icon-face">
        <img class="dock-icon-img" src="/logo/pai-logo-white.png" alt="" draggable="false" />
      </span>
    </button>
    <span class="dock-sep" role="separator" aria-hidden="true"></span>
  `

  html += _pinned.map((id) => {
    const app = APPS[id]
    const label = app?.title ?? id
    const color = APP_COLORS[id] ?? '#7aa2f7'
    const run = running.get(id)
    const wins = runningByApp.get(id) ?? []
    const isFoc = run?.focused && !run?.minimized
    const isRun = !!run && !run.minimized
    const count = wins.length
    const countBadge =
      count > 1 ? `<span class="dock-icon-badge" aria-hidden="true">${count}</span>` : ''
    return `
      <button class="dock-icon${isFoc ? ' dock-icon--focused' : ''}${isRun ? ' dock-icon--running' : ''}"
              data-app="${id}"
              data-pinned="1"
              title="${label}"
              aria-label="${label}${isRun ? ' (running)' : ''}"
              tabindex="0">
        <span class="dock-icon-face">${iconHtml(id, app, color)}</span>
        ${countBadge}
      </button>
    `
  }).join('')

  if (extra.length) {
    html += '<span class="dock-sep" role="separator" aria-hidden="true"></span>'
    html += extra
      .map((w) => {
        const app = APPS[w.appId]
        const color = APP_COLORS[w.appId] ?? '#7aa2f7'
        return `
        <button class="dock-icon dock-icon--running${w.focused ? ' dock-icon--focused' : ''}"
                data-app="${w.appId}"
                data-wid="${w.id}"
                title="${w.title}"
                aria-label="${w.title} (running)"
                tabindex="0">
          <span class="dock-icon-face">${iconHtml(w.appId, app, color)}</span>
        </button>
      `
      })
      .join('')
  }

  dock.innerHTML = html
  _bindEvents(dock)
}

function _bindEvents(dock) {
  dock.querySelectorAll('.dock-icon').forEach((btn) => {
    if (btn.dataset.dockStart) {
      btn.addEventListener('click', _onStartClick)
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          _onStartClick(e)
        }
      })
      return
    }
    btn.addEventListener('click', _onClick)
    btn.addEventListener('contextmenu', _onContext)
    btn.addEventListener('mouseenter', _onHoverEnter)
    btn.addEventListener('mouseleave', _onHoverLeave)
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        _onClick.call(btn, e)
      }
      if (e.key === 'Escape') {
        btn.blur()
        _dismissPreview()
      }
    })
  })
}

// ─── Hover preview ───────────────────────────────────────────────────────────

function _onHoverEnter(e) {
  const btn = e.currentTarget
  const appId = btn.dataset.app
  if (!appId) return
  clearTimeout(_previewTimer)
  _previewTimer = window.setTimeout(() => _showPreview(btn, appId), 380)
}

function _onHoverLeave() {
  clearTimeout(_previewTimer)
  // Small grace period so moving to a neighbouring icon doesn't flicker.
  _previewTimer = window.setTimeout(() => _dismissPreview(), 120)
}

function _showPreview(btn, appId) {
  _dismissPreview()
  const app = APPS[appId]
  const title = app?.title ?? appId
  const wins = wm.list().filter((w) => w.appId === appId)
  const previewEl = document.createElement('div')
  previewEl.className = 'dock-preview'
  previewEl.setAttribute('role', 'tooltip')
  if (!wins.length) {
    previewEl.innerHTML = `
      <div class="dock-preview__row">
        <span class="dock-preview__title">${title}</span>
        <span class="dock-preview__sub">Not running — click to open</span>
      </div>
    `
  } else {
    previewEl.innerHTML = `
      <div class="dock-preview__header">${title}</div>
      <ul class="dock-preview__list">
        ${wins
          .map(
            (w) => `
              <li class="dock-preview__item${w.focused ? ' is-focused' : ''}"
                  data-wid="${w.id}" tabindex="0">
                <span class="dock-preview__dot${w.focused ? ' is-focused' : ''}"></span>
                <span class="dock-preview__name">${w.title}</span>
                ${w.minimized ? '<span class="dock-preview__meta">min</span>' : ''}
              </li>
            `,
          )
          .join('')}
      </ul>
    `
    previewEl.querySelectorAll('[data-wid]').forEach((item) => {
      item.addEventListener('click', () => {
        const id = item.dataset.wid
        if (!id) return
        const target = wm.list().find((w) => w.id === id)
        if (target?.minimized) wm.unminimize(id)
        else wm.focus(id)
        _dismissPreview()
      })
    })
  }
  document.body.appendChild(previewEl)
  _preview = previewEl
  const rect = btn.getBoundingClientRect()
  const pr = previewEl.getBoundingClientRect()
  const left = Math.max(
    8,
    Math.min(window.innerWidth - pr.width - 8, rect.left + rect.width / 2 - pr.width / 2),
  )
  const top = Math.max(8, rect.top - pr.height - 10)
  previewEl.style.left = `${left}px`
  previewEl.style.top = `${top}px`
  requestAnimationFrame(() => previewEl.classList.add('is-open'))
  previewEl.addEventListener('mouseenter', () => clearTimeout(_previewTimer))
  previewEl.addEventListener('mouseleave', _onHoverLeave)
}

function _dismissPreview() {
  if (_preview) {
    _preview.remove()
    _preview = null
  }
}

function _onStartClick(e) {
  e.preventDefault()
  tick()
  const menu = window.__startmenu
  if (!menu) return
  menu.toggle()
}

// ─── Click handler ────────────────────────────────────────────────────────────

function _onClick(e) {
  const btn = e.currentTarget ?? this
  const appId = btn.dataset.app
  const app = APPS[appId]
  const exist = wm.getByAppId(appId)
  tick()

  if (!exist) {
    wm.open(appId, {
      title: app?.title ?? appId,
      color: APP_COLORS[appId],
      initial: appId[0].toUpperCase(),
      w: app?.default?.w,
      h: app?.default?.h,
    })
  } else if (exist.minimized) {
    wm.unminimize(exist.id)
  } else if (exist.focused) {
    wm.minimize(exist.id)
  } else {
    wm.focus(exist.id)
  }
}

// ─── Context menu ─────────────────────────────────────────────────────────────

function _onContext(e) {
  e.preventDefault()
  const btn = e.currentTarget
  const appId = btn.dataset.app
  const app = APPS[appId]
  const label = app?.title ?? appId

  _dismissCtx()
  _dismissPreview()

  const wins = wm.list().filter((w) => w.appId === appId)
  const pinned = _pinned.includes(appId)
  const running = wins.length > 0

  _ctxMenu = document.createElement('div')
  _ctxMenu.className = 'dock-ctx-menu'
  _ctxMenu.setAttribute('role', 'menu')

  const rows = [
    { ctx: 'open', label: running ? 'Show' : 'Open' },
    { ctx: 'new-window', label: 'New window' },
    { ctx: 'newtab', label: 'Open in new tab' },
    running ? { ctx: 'close-all', label: `Close all ${wins.length > 1 ? `(${wins.length})` : ''}`.trim() } : null,
    { ctx: pinned ? 'unpin' : 'pin', label: pinned ? 'Unpin from dock' : 'Pin to dock' },
    { ctx: 'sep' },
    { ctx: 'about-app', label: `About ${label}` },
  ].filter(Boolean)

  _ctxMenu.innerHTML = rows
    .map((r) =>
      r.ctx === 'sep'
        ? '<div class="dock-ctx-sep" aria-hidden="true"></div>'
        : `<button role="menuitem" data-ctx="${r.ctx}">${r.label}</button>`,
    )
    .join('')

  const on = (ctx, fn) =>
    _ctxMenu.querySelector(`[data-ctx="${ctx}"]`)?.addEventListener('click', fn)

  on('open', () => {
    const exist = wm.getByAppId(appId)
    if (exist) wm.focus(exist.id)
    else
      wm.open(appId, {
        title: label,
        color: APP_COLORS[appId],
        initial: appId[0].toUpperCase(),
      })
    _dismissCtx()
  })
  on('new-window', () => {
    wm.open(appId, {
      title: label,
      color: APP_COLORS[appId],
      initial: appId[0].toUpperCase(),
      w: app?.default?.w,
      h: app?.default?.h,
    })
    _dismissCtx()
  })
  on('newtab', () => {
    window.open(`/apps/${appId}`, '_blank', 'noopener,noreferrer')
    _dismissCtx()
  })
  on('close-all', () => {
    for (const w of wins) wm.close(w.id)
    _dismissCtx()
  })
  on('pin', () => {
    if (!_pinned.includes(appId)) _pinned.push(appId)
    _persistPinned()
    _render()
    _dismissCtx()
  })
  on('unpin', () => {
    const i = _pinned.indexOf(appId)
    if (i !== -1) _pinned.splice(i, 1)
    _persistPinned()
    _render()
    _dismissCtx()
  })
  on('about-app', () => {
    wm.open('about', {
      title: `About ${label}`,
      color: '#7aa2f7',
      initial: 'A',
    })
    _dismissCtx()
  })

  document.body.appendChild(_ctxMenu)

  const btnRect = btn.getBoundingClientRect()
  _ctxMenu.style.left = `${btnRect.left}px`
  _ctxMenu.style.bottom = `${window.innerHeight - btnRect.top + 8}px`
}

const PINNED_STORAGE = 'pai-dock-pinned'
function _persistPinned() {
  try {
    localStorage.setItem(PINNED_STORAGE, JSON.stringify(_pinned))
  } catch {}
}
function _loadPinned() {
  try {
    const raw = localStorage.getItem(PINNED_STORAGE)
    if (!raw) return
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) {
      _pinned.length = 0
      for (const id of arr) if (typeof id === 'string') _pinned.push(id)
    }
  } catch {}
}

function _dismissCtx() {
  if (_ctxMenu) {
    _ctxMenu.remove()
    _ctxMenu = null
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initDock() {
  const dock = document.getElementById('dock')
  if (!dock) return

  _loadPinned()
  _render()

  // Reactive to WM events
  wm.on('open', _render)
  wm.on('close', _render)
  wm.on('focus', _render)
  wm.on('minimize', _render)

  // Dismiss context menu on outside click
  document.addEventListener('click', (e) => {
    if (_ctxMenu && !_ctxMenu.contains(e.target)) _dismissCtx()
    if (_preview && !_preview.contains(e.target) && !e.target.closest?.('.dock-icon')) {
      _dismissPreview()
    }
  })
  // Dismiss on scroll or window blur — prevents stuck previews.
  window.addEventListener('blur', () => {
    _dismissPreview()
    _dismissCtx()
  })

  // Super+D focuses first dock icon
  document.addEventListener('keydown', (e) => {
    if (e.key === 'd' && e.metaKey) {
      e.preventDefault()
      dock.querySelector('.dock-icon')?.focus()
    }
  })
}
