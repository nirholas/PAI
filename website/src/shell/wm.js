// PAI Window Manager — vanilla JS, zero dependencies.
// Spec: 01c-window-manager. Implements drag, resize, snap, keyboard, persistence.

import { shellBridge } from './bridge.js'
import { APPS, appUrl } from './apps.js'
import {
  tick,
  open as soundOpen,
  close as soundClose,
} from './sound.ts'
import { hotkeys } from './hotkeys.ts'

const STORAGE_PREFIX = 'pai-wm-'
const ACTIVE_WS_KEY = 'pai-ws'
const SESSION_COUNT = 4
const MIN_W = 320
const MIN_H = 240
const DEFAULT_W = 800
const DEFAULT_H = 520
const SNAP_PX = 10

// ─── State ────────────────────────────────────────────────────────────────────

/** @type {Map<string, WinState>} */
const _windows = new Map()
/** @type {string[]} — last element = topmost (focused) */
const _stack = []
let _nextId = 1
const _listeners = {}

// Active session (1..SESSION_COUNT). Persisted across reloads.
let _activeWs = (() => {
  try {
    const v = +(localStorage.getItem(ACTIVE_WS_KEY) ?? 1)
    return Number.isFinite(v) && v >= 1 && v <= SESSION_COUNT ? v : 1
  } catch {
    return 1
  }
})()

// Suppresses _saveStore writes during bulk restore.
let _restoring = false

// Single active drag or resize at a time
const _drag = { active: false, id: null, sx: 0, sy: 0, wx: 0, wy: 0 }
const _resz = {
  active: false,
  id: null,
  dir: '',
  sx: 0,
  sy: 0,
  ox: 0,
  oy: 0,
  ow: 0,
  oh: 0,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _emit(event, data) {
  ;(_listeners[event] ?? []).forEach((fn) => fn(data))
}

function _getLayer() {
  return document.getElementById('wm-layer')
}

function _layerRect() {
  const l = _getLayer()
  return l
    ? l.getBoundingClientRect()
    : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
}

function _clampPos(x, y, w, h) {
  const topbarH = document.getElementById('pai-topbar')?.offsetHeight ?? 32
  const dockH = document.getElementById('pai-dock')?.offsetHeight ?? 60
  const maxX = Math.max(0, window.innerWidth - w)
  const maxY = Math.max(topbarH, window.innerHeight - dockH - 20)
  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(topbarH, y), maxY),
  }
}

function _applyGeo(el, x, y, w, h) {
  el.style.left = `${x}px`
  el.style.top = `${y}px`
  el.style.width = `${w}px`
  el.style.height = `${h}px`
}

// ─── Stack / Z-index ──────────────────────────────────────────────────────────

function _syncStack() {
  _stack.forEach((id, i) => {
    const w = _windows.get(id)
    if (!w) return
    w.el.style.zIndex = String(i + 1)
    w.focused = i === _stack.length - 1
    w.el.classList.toggle('focused', w.focused)
    w.el.classList.toggle('unfocused', !w.focused)
  })
}

function _setFocused(id) {
  const w = _windows.get(id)
  if (!w) return
  if (w.minimized) {
    w.minimized = false
    w.el.classList.remove('minimized')
    _emit('minimize', { id, appId: w.appId, minimized: false })
  }
  const idx = _stack.indexOf(id)
  if (idx !== -1) _stack.splice(idx, 1)
  _stack.push(id)
  _syncStack()
  /** @type {HTMLElement|null} */ ;(
    _windows.get(id)?.el.querySelector('.window-titlebar')
  )?.focus()
  w.el.classList.remove('focus-flash')
  void w.el.offsetWidth
  w.el.classList.add('focus-flash')
  setTimeout(() => w.el.classList.remove('focus-flash'), 240)
  _emit('focus', { id, appId: w.appId })
}

// ─── Persistence ──────────────────────────────────────────────────────────────

function _storageKey(ws) {
  return `${STORAGE_PREFIX}${ws}`
}

function _loadStore(ws = _activeWs) {
  try {
    return JSON.parse(localStorage.getItem(_storageKey(ws)) ?? '{}')
  } catch {
    return {}
  }
}

function _saveStore() {
  if (_restoring) return
  const data = {
    windows: {},
    stack: [..._stack],
    lastFocus: _stack.at(-1) ?? null,
  }
  for (const [id, w] of _windows) {
    data.windows[id] = {
      app: w.appId,
      x: w.x,
      y: w.y,
      w: w.w,
      h: w.h,
      maximized: w.maximized,
      minimized: w.minimized,
    }
  }
  try {
    localStorage.setItem(_storageKey(_activeWs), JSON.stringify(data))
  } catch {}
}

export function clearSessionStore(ws) {
  try {
    localStorage.removeItem(_storageKey(ws))
  } catch {}
}

export function clearAllSessionStores() {
  for (let n = 1; n <= SESSION_COUNT; n++) clearSessionStore(n)
}

function _savedGeo(appId) {
  const { windows = {} } = _loadStore()
  return (
    Object.values(windows)
      .filter((v) => v.app === appId)
      .at(-1) ?? null
  )
}

// ─── Maximize / tile ──────────────────────────────────────────────────────────

function _positionWindow(entry) {
  _applyGeo(entry.el, entry.x, entry.y, entry.w, entry.h)
}

function _setMaximized(id, on) {
  const w = _windows.get(id)
  if (!w) return
  if (on && !w.maximized) {
    w.preMaxRect = { x: w.x, y: w.y, w: w.w, h: w.h }
    w.maximized = true
    w.el.classList.add('maximized')
  } else if (!on && w.maximized) {
    w.maximized = false
    w.el.classList.remove('maximized')
    if (w.preMaxRect) {
      w.x = w.preMaxRect.x
      w.y = w.preMaxRect.y
      w.w = w.preMaxRect.w
      w.h = w.preMaxRect.h
      _positionWindow(w)
    }
  }
  _saveStore()
}

function _tileTo(id, side) {
  const w = _windows.get(id)
  if (!w) return
  const lr = _layerRect()
  w.maximized = false
  w.el.classList.remove('maximized')
  if (side === 'left') {
    w.x = 0
    w.y = 0
    w.w = lr.width / 2
    w.h = lr.height
  } else {
    w.x = lr.width / 2
    w.y = 0
    w.w = lr.width / 2
    w.h = lr.height
  }
  _positionWindow(w)
  _saveStore()
}

// ─── Drag ─────────────────────────────────────────────────────────────────────

function _startDrag(e, id) {
  if (e.button !== 0) return
  if (e.target.closest('.window-controls')) return
  e.preventDefault()
  const w = _windows.get(id)
  if (!w) return
  _drag.active = true
  _drag.id = id
  _drag.sx = e.clientX
  _drag.sy = e.clientY
  _drag.wx = w.x
  _drag.wy = w.y
  w.el.classList.add('dragging')
  document.body.style.cursor = 'move'
}

function _onDragMove(e) {
  if (!_drag.active || !_drag.id) return
  const w = _windows.get(_drag.id)
  if (!w) return
  if (w.maximized) {
    const lr = _layerRect()
    const ratio = (e.clientX - lr.left) / lr.width
    _setMaximized(_drag.id, false)
    _drag.wx = e.clientX - lr.left - w.w * ratio
    _drag.wy = e.clientY - lr.top - 16
    _drag.sx = e.clientX
    _drag.sy = e.clientY
  }
  const nx = _drag.wx + (e.clientX - _drag.sx)
  const ny = _drag.wy + (e.clientY - _drag.sy)
  const c = _clampPos(nx, ny, w.w, w.h)
  w.x = c.x
  w.y = c.y
  w.el.style.left = `${w.x}px`
  w.el.style.top = `${w.y}px`
}

function _onDragEnd(e) {
  if (!_drag.active || !_drag.id) return
  _drag.active = false
  document.body.style.cursor = ''
  const w = _windows.get(_drag.id)
  const id = _drag.id
  _drag.id = null
  if (!w) return
  w.el.classList.remove('dragging')
  const lr = _layerRect()
  const cx = e.clientX - lr.left
  const cy = e.clientY - lr.top
  if (cy <= SNAP_PX) _setMaximized(id, true)
  else if (cx <= SNAP_PX) _tileTo(id, 'left')
  else if (cx >= lr.width - SNAP_PX) _tileTo(id, 'right')
  else _saveStore()
}

// ─── Resize ───────────────────────────────────────────────────────────────────

function _startResize(e, id, dir) {
  if (e.button !== 0) return
  const w = _windows.get(id)
  if (!w || w.maximized) return
  e.preventDefault()
  e.stopPropagation()
  _resz.active = true
  _resz.id = id
  _resz.dir = dir
  _resz.sx = e.clientX
  _resz.sy = e.clientY
  _resz.ox = w.x
  _resz.oy = w.y
  _resz.ow = w.w
  _resz.oh = w.h
  w.el.classList.add('resizing')
}

function _onResizeMove(e) {
  if (!_resz.active || !_resz.id) return
  const w = _windows.get(_resz.id)
  if (!w) return
  const dx = e.clientX - _resz.sx,
    dy = e.clientY - _resz.sy
  const topbarH = document.getElementById('pai-topbar')?.offsetHeight ?? 32
  const dockH = document.getElementById('pai-dock')?.offsetHeight ?? 60
  const maxBottom = window.innerHeight - dockH
  let x = _resz.ox,
    y = _resz.oy,
    nw = _resz.ow,
    nh = _resz.oh
  if (_resz.dir.includes('e'))
    nw = Math.max(MIN_W, Math.min(window.innerWidth - _resz.ox, _resz.ow + dx))
  if (_resz.dir.includes('s'))
    nh = Math.max(MIN_H, Math.min(maxBottom - _resz.oy, _resz.oh + dy))
  if (_resz.dir.includes('w')) {
    const right = _resz.ox + _resz.ow
    nw = Math.max(MIN_W, Math.min(right, _resz.ow - dx))
    x = right - nw
  }
  if (_resz.dir.includes('n')) {
    const bottom = _resz.oy + _resz.oh
    nh = Math.max(MIN_H, Math.min(bottom - topbarH, _resz.oh - dy))
    y = bottom - nh
  }
  w.x = x
  w.y = y
  w.w = nw
  w.h = nh
  _applyGeo(w.el, x, y, nw, nh)
}

function _onResizeEnd() {
  if (!_resz.active || !_resz.id) return
  _resz.active = false
  const w = _windows.get(_resz.id)
  _resz.id = null
  if (w) {
    w.el.classList.remove('resizing')
    _saveStore()
  }
}

document.addEventListener('mousemove', (e) => {
  _onDragMove(e)
  _onResizeMove(e)
})
document.addEventListener('mouseup', (e) => {
  _onDragEnd(e)
  _onResizeEnd()
})

// ─── Focus trap ───────────────────────────────────────────────────────────────

function _setupFocusTrap(el, id) {
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      wm.close(id)
      return
    }
    if (e.key !== 'Tab') return
    if (document.activeElement?.tagName === 'IFRAME') return
    const focusable = /** @type {HTMLElement[]} */ (
      Array.from(
        el.querySelectorAll(
          '[tabindex]:not([tabindex="-1"]), button:not(:disabled)',
        ),
      ).filter((el) => el.tagName !== 'IFRAME' && el.offsetParent !== null)
    )
    if (!focusable.length) return
    const first = focusable[0],
      last = focusable.at(-1)
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  })
}

// ─── Open ─────────────────────────────────────────────────────────────────────

function _makeWindowEl(id, appId, title, opts) {
  const appDef = APPS[appId] ?? null
  const icon = opts.icon ?? appDef?.icon ?? null
  const color = opts.color ?? '#7aa2f7'
  const initial = (opts.initial ?? appId[0] ?? 'A').toUpperCase()

  const el = document.createElement('div')
  el.className = 'window unfocused'
  el.dataset.appId = appId
  el.dataset.windowId = id
  el.setAttribute('role', 'dialog')
  el.setAttribute('aria-modal', 'false')
  el.setAttribute('aria-labelledby', `wt-${id}`)
  el.tabIndex = -1

  const iconHtml = icon
    ? `<img class="window-icon" src="${icon}" width="16" height="16" aria-hidden="true" alt="" />`
    : `<span class="window-icon" style="width:16px;height:16px;border-radius:3px;background:${color};display:inline-flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#0f0f1a;flex-shrink:0">${initial}</span>`

  el.innerHTML = `
    <div class="window-titlebar" tabindex="0" aria-label="Window titlebar — arrow keys to move">
      ${iconHtml}
      <span class="window-title" id="wt-${id}">${title}</span>
      <div class="window-controls" role="group" aria-label="Window controls">
        <button class="window-btn btn-popout"   type="button" aria-label="Pop out to new window" title="Pop out"></button>
        <button class="window-btn btn-minimize" type="button" aria-label="Minimize"></button>
        <button class="window-btn btn-maximize" type="button" aria-label="Maximize"></button>
        <button class="window-btn btn-close"    type="button" aria-label="Close"></button>
      </div>
    </div>
    <div class="window-content">
      <iframe sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads" tabindex="-1" title="App content" aria-label="${title} app"></iframe>
    </div>
    <div class="resize-handle" data-dir="n"  aria-hidden="true"></div>
    <div class="resize-handle" data-dir="s"  aria-hidden="true"></div>
    <div class="resize-handle" data-dir="e"  aria-hidden="true"></div>
    <div class="resize-handle" data-dir="w"  aria-hidden="true"></div>
    <div class="resize-handle" data-dir="nw" aria-hidden="true"></div>
    <div class="resize-handle" data-dir="ne" aria-hidden="true"></div>
    <div class="resize-handle" data-dir="sw" aria-hidden="true"></div>
    <div class="resize-handle" data-dir="se" aria-hidden="true"></div>
  `
  return el
}

function _openWindow(appId, opts = {}) {
  const appDef = APPS[appId] ?? null
  const title = opts.title ?? appDef?.title ?? appId
  const id = `w${_nextId++}`

  const sg = _savedGeo(appId)
  const lr = _layerRect()
  const dw = opts.w ?? appDef?.default?.w ?? DEFAULT_W
  const dh = opts.h ?? appDef?.default?.h ?? DEFAULT_H
  const cas = ((_nextId - 2) % 8) * 24
  const geo =
    opts.geometry ??
    (sg
      ? { x: sg.x, y: sg.y, w: sg.w, h: sg.h }
      : {
          x: opts.x ?? Math.max(0, (lr.width - dw) / 2 + cas),
          y: opts.y ?? Math.max(0, (lr.height - dh) / 4 + cas),
          w: dw,
          h: dh,
        })
  const clamped = _clampPos(geo.x, geo.y, geo.w, geo.h)
  geo.x = clamped.x
  geo.y = clamped.y

  const el = _makeWindowEl(id, appId, title, opts)
  const iframe = el.querySelector('iframe')
  iframe.src = appUrl(appId, opts.params)

  // Titlebar drag + dblclick maximize + keyboard move
  const titlebar = el.querySelector('.window-titlebar')
  titlebar.addEventListener('mousedown', (e) => {
    wm.focus(id)
    _startDrag(e, id)
  })
  titlebar.addEventListener('dblclick', (e) => {
    if (e.target.closest('.window-controls')) return
    wm.toggleMaximize(id)
  })
  titlebar.addEventListener('keydown', (e) => {
    const dirs = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
    if (!dirs.includes(e.key)) return
    const w = _windows.get(id)
    if (!w || w.maximized) return
    e.preventDefault()
    const step = e.shiftKey ? 32 : 8
    let nx = w.x,
      ny = w.y
    if (e.key === 'ArrowLeft') nx -= step
    if (e.key === 'ArrowRight') nx += step
    if (e.key === 'ArrowUp') ny -= step
    if (e.key === 'ArrowDown') ny += step
    const c = _clampPos(nx, ny, w.w, w.h)
    w.x = c.x
    w.y = c.y
    w.el.style.left = `${w.x}px`
    w.el.style.top = `${w.y}px`
    _saveStore()
  })

  // Resize handles
  el.querySelectorAll('.resize-handle').forEach((handle) => {
    handle.addEventListener('mousedown', (e) => {
      wm.focus(id)
      _startResize(e, id, handle.dataset.dir)
    })
  })

  // Buttons
  el.querySelector('.btn-popout').addEventListener('click', () => {
    tick()
    // Dynamic import avoids a hard cycle and keeps wm.js standalone.
    import('./popout.ts')
      .then((m) => m.popoutWindow(id))
      .catch((err) => console.error('[wm] popout failed', err))
  })
  el.querySelector('.btn-minimize').addEventListener('click', () => {
    tick()
    wm.minimize(id)
  })
  el.querySelector('.btn-maximize').addEventListener('click', () => {
    tick()
    wm.toggleMaximize(id)
  })
  el.querySelector('.btn-close').addEventListener('click', () => {
    tick()
    wm.close(id)
  })

  // Raise on any click (capture phase to beat iframe)
  el.addEventListener('mousedown', () => wm.focus(id), true)

  _applyGeo(el, geo.x, geo.y, geo.w, geo.h)

  /** @type {WinState} */
  const state = {
    id,
    appId,
    title,
    el,
    iframe,
    x: geo.x,
    y: geo.y,
    w: geo.w,
    h: geo.h,
    focused: false,
    minimized: false,
    maximized: false,
    preMaxRect: null,
  }
  _windows.set(id, state)
  _stack.push(id)
  _getLayer()?.appendChild(el)

  requestAnimationFrame(() => el.classList.add('open'))
  _setupFocusTrap(el, id)
  _setFocused(id)

  iframe.addEventListener(
    'load',
    () => {
      shellBridge.send(iframe, 'init', {}, { appId, windowId: id })
    },
    { once: true },
  )

  _saveStore()
  if (!_restoring) soundOpen()
  _emit('open', { id, appId, title })
  return id
}

// ─── Close ────────────────────────────────────────────────────────────────────

function _closeWindow(id) {
  const w = _windows.get(id)
  if (!w) return
  const si = _stack.indexOf(id)
  if (si !== -1) _stack.splice(si, 1)
  _windows.delete(id)
  w.el.classList.add('closing')
  w.el.classList.remove('open')
  const rm = () => {
    if (w.el.parentNode) w.el.remove()
  }
  w.el.addEventListener('animationend', rm, { once: true })
  setTimeout(rm, 300)
  _saveStore()
  soundClose()
  _emit('close', { id, appId: w.appId })
  if (_stack.length > 0) _setFocused(_stack.at(-1))
}

// ─── Global keyboard shortcuts ────────────────────────────────────────────────
// Registered via the central hotkeys registry so the cheatsheet overlay can
// enumerate them. All handlers are scoped to the shell — they're skipped when
// focus is inside an iframe app (enforced by hotkeys.ts).

function _top() {
  return _stack.at(-1) ?? null
}

hotkeys.register(
  'alt+tab',
  () => {
    const vis = _stack.filter((id) => !_windows.get(id)?.minimized)
    if (vis.length < 2) return
    _setFocused(vis.at(-2))
  },
  { description: 'Cycle focused window', category: 'Windows' },
)

hotkeys.register(
  'alt+shift+tab',
  () => {
    const vis = _stack.filter((id) => !_windows.get(id)?.minimized)
    if (vis.length < 2) return
    _setFocused(vis[0])
  },
  { description: 'Cycle focused window (reverse)', category: 'Windows' },
)

hotkeys.register(
  'alt+f4',
  () => {
    const top = _top()
    if (top) _closeWindow(top)
  },
  { description: 'Close focused window', category: 'Windows' },
)

hotkeys.register(
  'ctrl+w',
  () => {
    const top = _top()
    if (top) _closeWindow(top)
  },
  { description: 'Close focused window', category: 'Windows' },
)

hotkeys.register(
  'alt+f10',
  () => {
    const top = _top()
    if (!top) return
    const w = _windows.get(top)
    if (w) _setMaximized(top, !w.maximized)
  },
  { description: 'Toggle maximise', category: 'Windows' },
)

hotkeys.register(
  'meta+arrowup',
  () => {
    const top = _top()
    if (!top) return
    const w = _windows.get(top)
    if (w) _setMaximized(top, !w.maximized)
  },
  { description: 'Toggle maximise', category: 'Windows' },
)

hotkeys.register(
  'alt+f9',
  () => {
    const top = _top()
    if (top) wm.minimize(top)
  },
  { description: 'Minimise focused window', category: 'Windows' },
)

hotkeys.register(
  'meta+arrowdown',
  () => {
    const top = _top()
    if (top) wm.minimize(top)
  },
  { description: 'Minimise focused window', category: 'Windows' },
)

hotkeys.register(
  'meta+arrowleft',
  () => {
    const top = _top()
    if (top) _tileTo(top, 'left')
  },
  { description: 'Tile window left', category: 'Windows' },
)

hotkeys.register(
  'meta+arrowright',
  () => {
    const top = _top()
    if (top) _tileTo(top, 'right')
  },
  { description: 'Tile window right', category: 'Windows' },
)

// ─── Bridge ───────────────────────────────────────────────────────────────────

shellBridge.on('set-title', (msg) => {
  const w = _windows.get(msg.windowId)
  if (!w || !msg.payload?.title) return
  w.title = msg.payload.title
  const el = w.el.querySelector('.window-title')
  if (el) el.textContent = msg.payload.title
})

shellBridge.on('set-icon', (msg) => {
  const w = _windows.get(msg.windowId)
  if (!w || !msg.payload?.href) return
  const el = w.el.querySelector('.window-icon')
  if (el?.tagName === 'IMG') el.src = msg.payload.href
})

shellBridge.on('open-app', (msg) => {
  if (msg.payload?.id) wm.open(msg.payload.id, { params: msg.payload.params })
})

shellBridge.on('close', (msg) => {
  if (msg.windowId) _closeWindow(msg.windowId)
})

// Task Manager support: reply with current window list to requester iframe.
shellBridge.on('list-windows', (msg) => {
  const w = _windows.get(msg.windowId)
  if (!w) return
  shellBridge.send(w.iframe, 'windows', { list: wm.list() }, {
    appId: msg.appId,
    windowId: msg.windowId,
  })
})

// Task Manager actions on other windows.
shellBridge.on('window-action', (msg) => {
  const { action, id } = msg.payload || {}
  if (!id || !action) return
  if (action === 'focus') _setFocused(id)
  else if (action === 'close') _closeWindow(id)
  else if (action === 'minimize') wm.minimize(id)
  else if (action === 'unminimize') wm.unminimize(id)
})

// ─── Public API ───────────────────────────────────────────────────────────────

export const wm = {
  open(appId, opts = {}) {
    return _openWindow(appId, opts)
  },
  close(id) {
    _closeWindow(id)
  },
  focus(id) {
    _setFocused(id)
  },

  minimize(id) {
    const w = _windows.get(id)
    if (!w || w.minimized) return
    w.minimized = true
    w.el.classList.add('minimized')
    const i = _stack.indexOf(id)
    if (i !== -1) _stack.splice(i, 1)
    _syncStack()
    _emit('minimize', { id, appId: w.appId, minimized: true })
    if (_stack.length > 0) _setFocused(_stack.at(-1))
  },

  unminimize(id) {
    const w = _windows.get(id)
    if (!w || !w.minimized) return
    w.minimized = false
    w.el.classList.remove('minimized')
    _setFocused(id)
    _emit('minimize', { id, appId: w.appId, minimized: false })
  },

  toggleMaximize(id) {
    const w = _windows.get(id)
    if (w) _setMaximized(id, !w.maximized)
  },

  list() {
    return [..._windows.values()].map(
      ({ id, appId, title, minimized, focused }) => ({
        id,
        appId,
        title,
        minimized,
        focused,
      }),
    )
  },

  getFocused() {
    const id = _stack.at(-1)
    return id ? (_windows.get(id) ?? null) : null
  },

  getByAppId(appId) {
    return [..._windows.values()].find((w) => w.appId === appId) ?? null
  },

  on(event, handler) {
    if (!_listeners[event]) _listeners[event] = []
    _listeners[event].push(handler)
    return () => {
      _listeners[event] = _listeners[event].filter((h) => h !== handler)
    }
  },

  get stack() {
    return [..._stack]
  },

  // ── Session (workspace) support ───────────────────────────────────────────
  // Each of the 4 sessions is an isolated window pool with its own persisted
  // state. Switching suspends the current session (saves + tears down DOM)
  // and resumes the target session (rebuilds DOM from storage).

  getActiveWorkspace() {
    return _activeWs
  },

  /**
   * Restore the active session's windows from storage. Idempotent — does
   * nothing if windows already exist. Call once during shell init.
   */
  restoreCurrent() {
    if (_windows.size) return
    _restoreSession(_activeWs)
  },

  switchWorkspace(ws) {
    if (!Number.isInteger(ws) || ws < 1 || ws > SESSION_COUNT) return
    if (ws === _activeWs) return
    const prev = _activeWs

    _saveStore()
    _tearDownAll()

    _activeWs = ws
    try {
      localStorage.setItem(ACTIVE_WS_KEY, String(ws))
    } catch {}

    _restoreSession(ws)
    _emit('workspace', { prev, next: ws })
  },
}

function _tearDownAll() {
  for (const w of _windows.values()) {
    if (w.el.parentNode) w.el.remove()
  }
  _windows.clear()
  _stack.length = 0
}

function _restoreSession(ws) {
  const data = _loadStore(ws)
  const wins = data.windows ?? {}
  const order = Array.isArray(data.stack)
    ? data.stack.filter((id) => wins[id])
    : Object.keys(wins)
  const lastFocus = data.lastFocus
  /** @type {Record<string, string>} */
  const idMap = {}

  _restoring = true
  try {
    for (const savedId of order) {
      const saved = wins[savedId]
      if (!saved) continue
      const newId = _openWindow(saved.app, {
        geometry: { x: saved.x, y: saved.y, w: saved.w, h: saved.h },
      })
      idMap[savedId] = newId
      if (saved.maximized) _setMaximized(newId, true)
      if (saved.minimized) wm.minimize(newId)
    }
    const focusId = lastFocus ? idMap[lastFocus] : null
    if (focusId) {
      const fw = _windows.get(focusId)
      if (fw && !fw.minimized) _setFocused(focusId)
    }
  } finally {
    _restoring = false
  }
  _saveStore()
}

if (typeof window !== 'undefined') window.wm = wm
