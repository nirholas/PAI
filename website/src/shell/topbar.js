// Topbar — Waybar-style status bar.
// Call initTopbar() once after the DOM is ready.
import { wm } from './wm.js'
import { tick, isMuted, toggleMuted, onMuteChange } from './sound.ts'
import { playBootSequence, isSessionBooted, clearAllBootFlags } from './boot.ts'
import { clearAllSessionStores } from './wm.js'

// ─── Real system metrics ──────────────────────────────────────────────────────
// Browsers don't expose real CPU load. We proxy it with event-loop lag (setTimeout
// drift) — any heavy main-thread work pushes this up. We also track FPS, JS heap,
// cores, device memory, battery, network, and session uptime in the popover.

const METRIC_LEN = 40
const LAG_HIST = new Array(METRIC_LEN).fill(0)
const LAG_INTERVAL_MS = 200
const LAG_FULL_SCALE_MS = 50

const METRICS = {
  lag: 0,
  fps: 60,
  startedAt: performance.now(),
}

function _pctFromLag(ms) {
  return Math.min(100, Math.max(0, (ms / LAG_FULL_SCALE_MS) * 100))
}

let _metricsStarted = false
function _startMetrics() {
  if (_metricsStarted) return
  _metricsStarted = true

  let rafCount = 0
  let rafWinStart = 0
  function rafLoop(ts) {
    if (!rafWinStart) rafWinStart = ts
    rafCount++
    const elapsed = ts - rafWinStart
    if (elapsed >= 500) {
      METRICS.fps = Math.round((rafCount * 1000) / elapsed)
      rafCount = 0
      rafWinStart = ts
    }
    requestAnimationFrame(rafLoop)
  }
  requestAnimationFrame(rafLoop)

  let last = performance.now()
  setInterval(() => {
    const now = performance.now()
    const drift = Math.max(0, now - last - LAG_INTERVAL_MS)
    METRICS.lag = drift
    LAG_HIST.shift()
    LAG_HIST.push(drift)
    last = now
  }, LAG_INTERVAL_MS)
}

// Size a canvas so it renders crisply on hi-DPI displays. Reads the CSS box
// once, scales the backing store by devicePixelRatio, and stashes the logical
// (CSS) dimensions on the element for draw functions to use. Safe to call
// every frame — returns early unless the DPR or CSS size changed.
function _setupDpi(canvas) {
  if (!canvas) return null
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  const cssW =
    rect.width || Number(canvas.getAttribute('width')) || canvas.width
  const cssH =
    rect.height || Number(canvas.getAttribute('height')) || canvas.height
  if (
    canvas.__dpr !== dpr ||
    canvas.__cssW !== cssW ||
    canvas.__cssH !== cssH
  ) {
    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    canvas.style.width = `${cssW}px`
    canvas.style.height = `${cssH}px`
    canvas.__dpr = dpr
    canvas.__cssW = cssW
    canvas.__cssH = cssH
  }
  const ctx = canvas.getContext('2d')
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, w: cssW, h: cssH }
}

function _drawSparkline(canvas) {
  const ready = _setupDpi(canvas)
  if (!ready) return
  const { ctx, w, h } = ready
  ctx.clearRect(0, 0, w, h)
  ctx.strokeStyle = '#7aa2f7'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  LAG_HIST.forEach((ms, i) => {
    const x = (i / (LAG_HIST.length - 1)) * w
    const y = h - (_pctFromLag(ms) / 100) * h
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.stroke()
}

function _drawBigSparkline(canvas) {
  const ready = _setupDpi(canvas)
  if (!ready) return
  const { ctx, w, h } = ready
  ctx.clearRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, h / 2)
  ctx.lineTo(w, h / 2)
  ctx.stroke()
  const grad = ctx.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, 'rgba(122,162,247,0.45)')
  grad.addColorStop(1, 'rgba(122,162,247,0.02)')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.moveTo(0, h)
  LAG_HIST.forEach((ms, i) => {
    const x = (i / (LAG_HIST.length - 1)) * w
    const y = h - (_pctFromLag(ms) / 100) * h
    ctx.lineTo(x, y)
  })
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#7aa2f7'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  LAG_HIST.forEach((ms, i) => {
    const x = (i / (LAG_HIST.length - 1)) * w
    const y = h - (_pctFromLag(ms) / 100) * h
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  })
  ctx.stroke()
}

// ─── System monitor popover ───────────────────────────────────────────────────

function _fmtBytes(n) {
  if (!Number.isFinite(n)) return '—'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`
}

function _fmtUptime(ms) {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h) return `${h}h ${m}m`
  if (m) return `${m}m ${sec}s`
  return `${sec}s`
}

function _sysInfo() {
  const mem = performance.memory
  const heap = mem
    ? `${_fmtBytes(mem.usedJSHeapSize)} / ${_fmtBytes(mem.jsHeapSizeLimit)}`
    : 'unavailable'
  const cores = navigator.hardwareConcurrency
    ? String(navigator.hardwareConcurrency)
    : 'unknown'
  const devMem = navigator.deviceMemory
    ? `≥ ${navigator.deviceMemory} GiB`
    : 'unknown'
  const conn = navigator.connection
  const net = conn
    ? `${conn.effectiveType || '—'}${conn.downlink ? ` · ${conn.downlink} Mbps` : ''}`
    : 'unknown'
  return { heap, cores, devMem, net }
}

function _renderSysPopover(el) {
  const info = _sysInfo()
  const busy = Math.round(_pctFromLag(METRICS.lag))
  const up = _fmtUptime(performance.now() - METRICS.startedAt)
  el.innerHTML = `
    <div class="tb-sys-head">System monitor</div>
    <canvas class="tb-sys-spark" width="220" height="48" aria-hidden="true"></canvas>
    <div class="tb-sys-scale">
      <span>main-thread lag</span>
      <span>0 — ${LAG_FULL_SCALE_MS} ms</span>
    </div>
    <div class="tb-sys-rows">
      <div class="tb-sys-row"><span>Main-thread busy</span><b data-m="busy">${busy}%</b></div>
      <div class="tb-sys-row"><span>FPS</span><b data-m="fps">${METRICS.fps}</b></div>
      <div class="tb-sys-row"><span>Event-loop lag</span><b data-m="lag">${METRICS.lag.toFixed(1)} ms</b></div>
      <div class="tb-sys-sep"></div>
      <div class="tb-sys-row"><span>JS heap</span><b data-m="heap">${info.heap}</b></div>
      <div class="tb-sys-row"><span>CPU cores</span><b>${info.cores}</b></div>
      <div class="tb-sys-row"><span>Device memory</span><b>${info.devMem}</b></div>
      <div class="tb-sys-row"><span>Network</span><b data-m="net">${info.net}</b></div>
      <div class="tb-sys-row"><span>Battery</span><b data-m="battery">…</b></div>
      <div class="tb-sys-row"><span>Session uptime</span><b data-m="up">${up}</b></div>
    </div>
    <div class="tb-sys-foot">Measured live in this tab — no telemetry.</div>
  `
  _drawBigSparkline(el.querySelector('.tb-sys-spark'))
  _fillBattery(el)
}

function _updateSysPopover(el) {
  _drawBigSparkline(el.querySelector('.tb-sys-spark'))
  const info = _sysInfo()
  const set = (k, v) => {
    const n = el.querySelector(`[data-m="${k}"]`)
    if (n) n.textContent = v
  }
  set('busy', `${Math.round(_pctFromLag(METRICS.lag))}%`)
  set('fps', METRICS.fps)
  set('lag', `${METRICS.lag.toFixed(1)} ms`)
  set('heap', info.heap)
  set('net', info.net)
  set('up', _fmtUptime(performance.now() - METRICS.startedAt))
}

function _fillBattery(rootEl) {
  const row = rootEl.querySelector('[data-m="battery"]')
  if (!row) return
  if (typeof navigator.getBattery !== 'function') {
    row.textContent = 'unavailable'
    return
  }
  // Guard: popover may be re-rendered (or closed) before the promise resolves.
  // Only write back if the original row is still in the live document.
  navigator
    .getBattery()
    .then((b) => {
      if (!document.contains(row)) return
      row.textContent = `${Math.round(b.level * 100)}%${b.charging ? ' · charging' : ''}`
    })
    .catch(() => {
      if (!document.contains(row)) return
      row.textContent = 'unavailable'
    })
}

// ─── GPU info (one-shot, cached) ──────────────────────────────────────────────

let _gpuCache = null
function _gpuInfo() {
  if (_gpuCache) return _gpuCache
  const out = { vendor: 'unknown', renderer: 'unknown', maxTexture: '—' }
  let gl = null
  try {
    const c = document.createElement('canvas')
    gl = c.getContext('webgl') || c.getContext('experimental-webgl')
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      if (ext) {
        out.vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) || 'unknown'
        out.renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || 'unknown'
      } else {
        out.vendor = gl.getParameter(gl.VENDOR) || 'unknown'
        out.renderer = gl.getParameter(gl.RENDERER) || 'unknown'
      }
      const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE)
      if (maxTex) out.maxTexture = `${maxTex}×${maxTex}`
    } else {
      out.vendor = 'no WebGL'
      out.renderer = 'no WebGL'
    }
  } catch {
    // ignore — defaults stand
  } finally {
    // Release the probe GL context so we don't hold a GPU handle all session.
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  }
  _gpuCache = out
  return out
}

// ─── RAM / memory popover ─────────────────────────────────────────────────────

function _memInfo() {
  const mem = performance.memory
  return {
    used: mem ? mem.usedJSHeapSize : null,
    total: mem ? mem.totalJSHeapSize : null,
    limit: mem ? mem.jsHeapSizeLimit : null,
  }
}

function _renderRamPopover(el) {
  const m = _memInfo()
  const gpu = _gpuInfo()
  const devMem = navigator.deviceMemory
    ? `≥ ${navigator.deviceMemory} GiB`
    : 'unknown'
  const cores = navigator.hardwareConcurrency
    ? String(navigator.hardwareConcurrency)
    : 'unknown'
  const screen = `${window.screen.width}×${window.screen.height} @ ${window.devicePixelRatio || 1}×`

  el.innerHTML = `
    <div class="tb-sys-head">Memory &amp; graphics</div>
    <div class="tb-sys-rows">
      <div class="tb-sys-row"><span>JS heap used</span><b data-m="used">${m.used != null ? _fmtBytes(m.used) : 'unavailable'}</b></div>
      <div class="tb-sys-row"><span>JS heap total</span><b data-m="total">${m.total != null ? _fmtBytes(m.total) : '—'}</b></div>
      <div class="tb-sys-row"><span>Heap limit</span><b data-m="limit">${m.limit != null ? _fmtBytes(m.limit) : '—'}</b></div>
      <div class="tb-sys-row"><span>Storage used</span><b data-m="storage">…</b></div>
      <div class="tb-sys-sep"></div>
      <div class="tb-sys-row"><span>Device memory</span><b>${devMem}</b></div>
      <div class="tb-sys-row"><span>CPU cores</span><b>${cores}</b></div>
      <div class="tb-sys-sep"></div>
      <div class="tb-sys-row"><span>GPU vendor</span><b class="tb-sys-b-sm">${gpu.vendor}</b></div>
      <div class="tb-sys-row"><span>GPU renderer</span><b class="tb-sys-b-sm">${gpu.renderer}</b></div>
      <div class="tb-sys-row"><span>Max texture</span><b>${gpu.maxTexture}</b></div>
      <div class="tb-sys-row"><span>Screen</span><b>${screen}</b></div>
    </div>
    <div class="tb-sys-foot">Reported by the browser — PAI runs entirely offline.</div>
  `
  _fillStorage(el)
}

function _updateRamPopover(el) {
  const m = _memInfo()
  const set = (k, v) => {
    const n = el.querySelector(`[data-m="${k}"]`)
    if (n) n.textContent = v
  }
  if (m.used != null) set('used', _fmtBytes(m.used))
  if (m.total != null) set('total', _fmtBytes(m.total))
}

function _fillStorage(rootEl) {
  const row = rootEl.querySelector('[data-m="storage"]')
  if (!row) return
  if (!navigator.storage || typeof navigator.storage.estimate !== 'function') {
    row.textContent = 'unavailable'
    return
  }
  navigator.storage
    .estimate()
    .then(({ usage, quota }) => {
      if (!document.contains(row)) return
      if (usage == null || quota == null) {
        row.textContent = 'unavailable'
        return
      }
      row.textContent = `${_fmtBytes(usage)} / ${_fmtBytes(quota)}`
    })
    .catch(() => {
      if (!document.contains(row)) return
      row.textContent = 'unavailable'
    })
}

// ─── Network popover ──────────────────────────────────────────────────────────

function _netInfo() {
  const c = navigator.connection
  return {
    online: navigator.onLine,
    effectiveType: c?.effectiveType || 'unknown',
    type: c?.type || 'unknown',
    downlink: c?.downlink != null ? `${c.downlink} Mbps` : 'unknown',
    rtt: c?.rtt != null ? `${c.rtt} ms` : 'unknown',
    saveData: c?.saveData ? 'on' : 'off',
  }
}

function _renderNetPopover(el) {
  const n = _netInfo()
  const status = n.online ? 'online' : 'offline'
  el.innerHTML = `
    <div class="tb-sys-head">Network</div>
    <div class="tb-sys-rows">
      <div class="tb-sys-row"><span>Status</span><b data-m="status" class="${n.online ? 'tb-sys-ok' : 'tb-sys-warn'}">${status}</b></div>
      <div class="tb-sys-row"><span>Effective type</span><b data-m="etype">${n.effectiveType}</b></div>
      <div class="tb-sys-row"><span>Connection</span><b data-m="type">${n.type}</b></div>
      <div class="tb-sys-row"><span>Downlink</span><b data-m="down">${n.downlink}</b></div>
      <div class="tb-sys-row"><span>Round-trip</span><b data-m="rtt">${n.rtt}</b></div>
      <div class="tb-sys-row"><span>Data saver</span><b data-m="save">${n.saveData}</b></div>
    </div>
    <div class="tb-sys-foot">PAI makes zero network requests by itself. The browser-reported stats above only reflect your current connection.</div>
  `
}

function _updateNetPopover(el) {
  const n = _netInfo()
  const set = (k, v, cls) => {
    const node = el.querySelector(`[data-m="${k}"]`)
    if (!node) return
    node.textContent = v
    if (cls !== undefined) {
      node.classList.remove('tb-sys-ok', 'tb-sys-warn')
      if (cls) node.classList.add(cls)
    }
  }
  set(
    'status',
    n.online ? 'online' : 'offline',
    n.online ? 'tb-sys-ok' : 'tb-sys-warn',
  )
  set('etype', n.effectiveType)
  set('type', n.type)
  set('down', n.downlink)
  set('rtt', n.rtt)
  set('save', n.saveData)
}

// ─── Calendar popover ─────────────────────────────────────────────────────────

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

// Which month the user is viewing in the calendar grid. Reset to current
// month each time the popover is opened.
const _calView = { yr: 0, mo: 0 }

function _renderPopover(el, locale) {
  const now = new Date()
  const { yr, mo } = _calView
  const isCurrentMonth = yr === now.getFullYear() && mo === now.getMonth()
  const td = isCurrentMonth ? now.getDate() : -1
  const first = new Date(yr, mo, 1).getDay()
  const lastDate = new Date(yr, mo + 1, 0).getDate()

  let cells = DAYS.map((d) => `<span class="tb-cal-dh">${d}</span>`).join('')
  for (let i = 0; i < first; i++) cells += '<span></span>'
  for (let d = 1; d <= lastDate; d++) {
    cells += `<span${d === td ? ' class="tb-cal-today"' : ''}>${d}</span>`
  }

  const time = now.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  })
  const date = now.toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  el.innerHTML = `
    <div class="tb-cal-clock">
      <time class="tb-cal-time" id="tb-cal-time">${time}</time>
      <div class="tb-cal-date" id="tb-cal-date">${date}</div>
    </div>
    <div class="tb-cal-nav">
      <button class="tb-cal-navbtn" data-nav="prev" aria-label="Previous month">‹</button>
      <button class="tb-cal-title" data-nav="today" title="Jump to today">${MONTHS[mo]} ${yr}</button>
      <button class="tb-cal-navbtn" data-nav="next" aria-label="Next month">›</button>
    </div>
    <div class="tb-cal-grid">${cells}</div>
  `
}

function _updatePopoverClock(el, locale) {
  const timeEl = el.querySelector('#tb-cal-time')
  const dateEl = el.querySelector('#tb-cal-date')
  if (!timeEl || !dateEl) return
  const now = new Date()
  timeEl.textContent = now.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  })
  dateEl.textContent = now.toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ─── Shutdown easter egg ───────────────────────────────────────────────────────

function _doShutdown() {
  clearAllBootFlags()
  clearAllSessionStores()
  const shell = document.querySelector('.shell')
  if (shell) shell.classList.add('shell--shutdown')
  setTimeout(() => {
    const overlay = Object.assign(document.createElement('div'), {
      style: `position:fixed;inset:0;background:#0f0f1a;z-index:9999;display:flex;
        flex-direction:column;align-items:center;justify-content:center;gap:16px;
        font-family:var(--font-mono);font-size:13px;color:#4ade80;`,
    })
    overlay.innerHTML = `
      <img src="/logo/favicon-128.png" width="64" height="64" alt="" style="
        animation:tb-spin 1.5s linear infinite;image-rendering:pixelated">
      <span>Shutting down…</span>
    `
    const style = document.createElement('style')
    style.textContent = '@keyframes tb-spin{to{transform:rotate(360deg)}}'
    document.head.appendChild(style)
    document.body.appendChild(overlay)
    setTimeout(() => location.reload(), 3000)
  }, 500)
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initTopbar() {
  const bar = document.getElementById('topbar')
  if (!bar) return

  // ── Left ──────────────────────────────────────────────────────────────────
  bar.querySelector('.topbar-left').innerHTML = `
    <button class="tb-logo" id="tb-logo" aria-label="PAI — opens About app" title="About PAI">
      <img src="/logo/favicon-32.png" width="16" height="16" alt="PAI">
    </button>
    <span class="tb-app-title" id="tb-app-title">PAI Desktop</span>
  `

  document.getElementById('tb-logo').addEventListener('click', () => {
    tick()
    wm.open('about', { title: 'About', color: '#7aa2f7', initial: 'A' })
  })

  wm.on('focus', ({ id }) => {
    const w = wm.list().find((x) => x.id === id)
    const el = document.getElementById('tb-app-title')
    if (el) el.textContent = w ? w.title : 'PAI Desktop'
  })
  wm.on('close', () => {
    const el = document.getElementById('tb-app-title')
    const f = wm.getFocused()
    if (el) el.textContent = f ? f.title : 'PAI Desktop'
  })

  // ── Center — sessions ─────────────────────────────────────────────────────
  // Each of the four buttons is an independent session: its first activation
  // replays the boot sequence. Boot state + last-active session persist in
  // localStorage.
  const center = bar.querySelector('.topbar-center')
  let _switching = false

  function renderWs(active) {
    center.innerHTML = [1, 2, 3, 4]
      .map((n) => {
        const booted = isSessionBooted(n)
        const label = booted ? `Session ${n}` : `Session ${n} (not yet booted)`
        return `
      <button class="tb-ws${active === n ? ' tb-ws--active' : ''}${booted ? '' : ' tb-ws--cold'}"
              data-ws="${n}"
              aria-pressed="${active === n}"
              aria-label="${label}"
              title="${label}">${n}</button>
    `
      })
      .join('')
    center.querySelectorAll('.tb-ws').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (_switching) return
        const ws = +btn.dataset.ws
        if (ws === wm.getActiveWorkspace()) return
        tick()
        _switching = true
        try {
          wm.switchWorkspace(ws)
          if (!isSessionBooted(ws)) await playBootSequence(ws)
        } finally {
          _switching = false
          renderWs(ws)
        }
      })
    })
  }

  const initWs = +(localStorage.getItem('pai-ws') ?? 1)
  renderWs(initWs)
  wm.on('workspace', ({ next }) => renderWs(next))

  // ── Right — status cluster ────────────────────────────────────────────────
  bar.querySelector('.topbar-right').innerHTML = `
    <div class="tb-cluster" role="group" aria-label="System status">
      <button class="tb-widget tb-cpu" id="tb-cpu"
              title="Live system metrics — click for details"
              aria-label="Open system monitor"
              aria-haspopup="dialog" aria-expanded="false">
        <canvas class="tb-sparkline" id="tb-sparkline" width="44" height="16"
          aria-hidden="true"></canvas>
        <span class="tb-widget-label">CPU</span>
      </button>
      <div class="tb-sys-popover" id="tb-sys" role="dialog"
           aria-label="System monitor" tabindex="-1" hidden></div>
      <button class="tb-widget tb-ram" id="tb-ram"
              title="Memory &amp; graphics — click for details"
              aria-label="Open memory and graphics info"
              aria-haspopup="dialog" aria-expanded="false">
        <span class="tb-widget-icon" aria-hidden="true">▦</span>
        <span class="tb-widget-label" id="tb-ram-label">— MiB</span>
      </button>
      <div class="tb-sys-popover" id="tb-ram-pop" role="dialog"
           aria-label="Memory and graphics" tabindex="-1" hidden></div>
      <button class="tb-widget tb-net" id="tb-net"
              title="Network — click for details"
              aria-label="Open network info"
              aria-haspopup="dialog" aria-expanded="false">
        <span class="tb-widget-icon" aria-hidden="true">⊹</span>
        <span class="tb-widget-label" id="tb-net-label">local</span>
      </button>
      <div class="tb-sys-popover" id="tb-net-pop" role="dialog"
           aria-label="Network" hidden></div>
      <button class="tb-widget tb-tor"
              title="Tor available in PAI. Click to learn more."
              aria-label="Tor — click to open Security app">
        <span class="tb-tor-icon" aria-hidden="true">⬡</span>
        <span class="tb-widget-label">tor</span>
      </button>
      <button class="tb-widget tb-sound" id="tb-sound"
              title="${isMuted() ? 'Sound off — click to enable' : 'Sound on — click to mute'}"
              aria-label="${isMuted() ? 'Enable UI sounds' : 'Mute UI sounds'}"
              aria-pressed="${isMuted() ? 'false' : 'true'}">
        <span aria-hidden="true">${isMuted() ? '🔇' : '🔊'}</span>
      </button>
    </div>

    <button class="tb-clock" id="tb-clock" aria-label="Clock — click to toggle calendar">
      <time id="tb-time" aria-live="off">00:00</time>
    </button>
    <div class="tb-cal-popover" id="tb-cal" aria-label="Calendar" hidden></div>

    <button class="tb-power" id="tb-power"
            aria-label="Power menu" aria-haspopup="menu"
            aria-expanded="false">⏻</button>
    <div class="tb-power-menu" id="tb-power-menu" role="menu" hidden>
      <button role="menuitem" data-action="about">About PAI</button>
      <button role="menuitem" data-action="download">Download</button>
      <button role="menuitem" data-action="shutdown">Shutdown</button>
    </div>
  `

  // Tor
  bar.querySelector('.tb-tor').addEventListener('click', () => {
    tick()
    wm.open('security', { title: 'Security', color: '#f87171', initial: 'S' })
  })

  // Sound mute toggle
  const soundBtn = document.getElementById('tb-sound')
  function renderSound(muted) {
    soundBtn.querySelector('span').textContent = muted ? '🔇' : '🔊'
    soundBtn.title = muted
      ? 'Sound off — click to enable'
      : 'Sound on — click to mute'
    soundBtn.setAttribute(
      'aria-label',
      muted ? 'Enable UI sounds' : 'Mute UI sounds',
    )
    soundBtn.setAttribute('aria-pressed', muted ? 'false' : 'true')
  }
  soundBtn.addEventListener('click', () => {
    const nowMuted = toggleMuted()
    renderSound(nowMuted)
    if (!nowMuted) tick()
  })
  onMuteChange(renderSound)

  // Live clock. NOTE: the imported `tick` from sound.ts is the UI click sound —
  // we name the local clock updater `refreshClock` so the two don't collide.
  const timeEl = document.getElementById('tb-time')
  const clockEl = document.getElementById('tb-clock')
  const locale = navigator.language || 'en-US'
  const _tzName = new Intl.DateTimeFormat(locale, { timeZoneName: 'short' })
    .formatToParts(new Date())
    .find((p) => p.type === 'timeZoneName')?.value || ''
  function refreshClock() {
    const now = new Date()
    const hhmm = now.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    timeEl.textContent = _tzName ? `${hhmm} ${_tzName}` : hhmm
    timeEl.dateTime = now.toISOString()
    const fullDate = now.toLocaleDateString(locale, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    clockEl.title = _tzName ? `${fullDate} (${_tzName})` : fullDate
  }
  refreshClock()
  const clockInterval = setInterval(refreshClock, 1000)

  // CPU sparkline + system monitor popover
  _startMetrics()
  const spark = document.getElementById('tb-sparkline')
  const cpuBtn = document.getElementById('tb-cpu')
  const sysEl = document.getElementById('tb-sys')
  const ramBtn = document.getElementById('tb-ram')
  const ramEl = document.getElementById('tb-ram-pop')
  const ramLabel = document.getElementById('tb-ram-label')
  const netBtn = document.getElementById('tb-net')
  const netEl = document.getElementById('tb-net-pop')
  const netLabel = document.getElementById('tb-net-label')

  _drawSparkline(spark)

  // Live widget labels (RAM heap + network status)
  function refreshRamLabel() {
    const mem = performance.memory
    ramLabel.textContent = mem ? _fmtBytes(mem.usedJSHeapSize) : 'n/a'
  }
  function refreshNetLabel() {
    if (!navigator.onLine) {
      netLabel.textContent = 'offline'
      return
    }
    const et = navigator.connection?.effectiveType
    netLabel.textContent = et && et !== 'unknown' ? et : 'online'
  }
  refreshRamLabel()
  refreshNetLabel()

  // Tick the sparkline + visible popovers every 500 ms — but pause when the
  // document is hidden, so we're not burning CPU for an offscreen tab.
  let sparkInterval = 0
  function startSparkLoop() {
    if (sparkInterval) return
    sparkInterval = setInterval(() => {
      _drawSparkline(spark)
      refreshRamLabel()
      if (!sysEl.hidden) _updateSysPopover(sysEl)
      if (!ramEl.hidden) _updateRamPopover(ramEl)
    }, 500)
  }
  function stopSparkLoop() {
    if (!sparkInterval) return
    clearInterval(sparkInterval)
    sparkInterval = 0
  }
  startSparkLoop()
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopSparkLoop()
    else {
      startSparkLoop()
      _drawSparkline(spark)
      refreshRamLabel()
    }
  })

  // One handler pair covers both the pill label and the open popover.
  // `connection.change` fires when effective-type or downlink shifts.
  function handleNetChange() {
    refreshNetLabel()
    if (!netEl.hidden) _updateNetPopover(netEl)
  }
  window.addEventListener('online', handleNetChange)
  window.addEventListener('offline', handleNetChange)
  if (navigator.connection) {
    navigator.connection.addEventListener('change', handleNetChange)
  }

  // ── Group-managed popovers ────────────────────────────────────────────────
  // CPU / RAM / Net are mutually exclusive. `returnFocusTo` remembers which
  // trigger owned the active popover so Esc can restore focus (dialog pattern).
  function positionAt(btn, el) {
    const r = btn.getBoundingClientRect()
    const vw = window.innerWidth
    el.style.top = `${Math.round(r.bottom + 4)}px`
    el.style.right = `${Math.max(8, Math.round(vw - r.right))}px`
    el.style.left = 'auto'
  }

  const popovers = [
    { btn: cpuBtn, el: sysEl, render: _renderSysPopover },
    { btn: ramBtn, el: ramEl, render: _renderRamPopover },
    { btn: netBtn, el: netEl, render: _renderNetPopover },
  ]
  let returnFocusTo = null

  function openOne(target) {
    for (const p of popovers) {
      if (p === target) continue
      if (!p.el.hidden) {
        p.el.hidden = true
        p.btn.setAttribute('aria-expanded', 'false')
      }
    }
    target.render(target.el)
    target.el.hidden = false
    target.btn.setAttribute('aria-expanded', 'true')
    positionAt(target.btn, target.el)
  }

  function closeOne(target, { restoreFocus = false } = {}) {
    target.el.hidden = true
    target.btn.setAttribute('aria-expanded', 'false')
    if (restoreFocus && returnFocusTo) returnFocusTo.focus()
    returnFocusTo = null
  }

  for (const p of popovers) {
    p.btn.addEventListener('click', (e) => {
      e.stopPropagation()
      tick()
      if (p.el.hidden) {
        returnFocusTo = p.btn
        openOne(p)
      } else {
        closeOne(p)
      }
    })
  }

  document.addEventListener('click', (e) => {
    for (const p of popovers) {
      if (
        !p.el.hidden &&
        !p.btn.contains(e.target) &&
        !p.el.contains(e.target)
      ) {
        closeOne(p)
      }
    }
  })
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    for (const p of popovers) {
      if (!p.el.hidden) {
        closeOne(p, { restoreFocus: true })
        return
      }
    }
  })
  window.addEventListener('resize', () => {
    for (const p of popovers) if (!p.el.hidden) positionAt(p.btn, p.el)
  })

  window.addEventListener('unload', () => {
    clearInterval(clockInterval)
    stopSparkLoop()
  })

  // ── Calendar + clock popover ──────────────────────────────────────────────
  const clockBtn = document.getElementById('tb-clock')
  const calEl = document.getElementById('tb-cal')
  let calClockInterval = 0
  let calReturnFocus = null

  function shiftMonth(delta) {
    _calView.mo += delta
    while (_calView.mo < 0) {
      _calView.mo += 12
      _calView.yr -= 1
    }
    while (_calView.mo > 11) {
      _calView.mo -= 12
      _calView.yr += 1
    }
  }

  function openCal() {
    const now = new Date()
    _calView.yr = now.getFullYear()
    _calView.mo = now.getMonth()
    _renderPopover(calEl, locale)
    calEl.hidden = false
    positionAt(clockBtn, calEl)
    clearInterval(calClockInterval)
    calClockInterval = setInterval(
      () => _updatePopoverClock(calEl, locale),
      1000,
    )
  }

  function closeCal({ restoreFocus = false } = {}) {
    calEl.hidden = true
    clearInterval(calClockInterval)
    calClockInterval = 0
    if (restoreFocus && calReturnFocus) calReturnFocus.focus()
    calReturnFocus = null
  }

  clockBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    tick()
    if (calEl.hidden) {
      calReturnFocus = clockBtn
      openCal()
    } else {
      closeCal()
    }
  })

  calEl.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]')
    if (!nav) return
    e.stopPropagation()
    tick()
    const dir = nav.dataset.nav
    if (dir === 'prev') shiftMonth(-1)
    else if (dir === 'next') shiftMonth(1)
    else if (dir === 'today') {
      const now = new Date()
      _calView.yr = now.getFullYear()
      _calView.mo = now.getMonth()
    }
    _renderPopover(calEl, locale)
  })

  // Keyboard nav while calendar is open:
  //   ← / →   prev / next month
  //   ↑ / ↓   prev / next year
  //   Home    jump to current month
  //   Esc     close + return focus to trigger
  calEl.addEventListener('keydown', (e) => {
    if (calEl.hidden) return
    let handled = true
    switch (e.key) {
      case 'ArrowLeft':
        shiftMonth(-1)
        break
      case 'ArrowRight':
        shiftMonth(1)
        break
      case 'ArrowUp':
        _calView.yr -= 1
        break
      case 'ArrowDown':
        _calView.yr += 1
        break
      case 'Home': {
        const now = new Date()
        _calView.yr = now.getFullYear()
        _calView.mo = now.getMonth()
        break
      }
      default:
        handled = false
    }
    if (handled) {
      e.preventDefault()
      _renderPopover(calEl, locale)
    }
  })

  document.addEventListener('click', (e) => {
    if (
      !calEl.hidden &&
      !clockBtn.contains(e.target) &&
      !calEl.contains(e.target)
    ) {
      closeCal()
    }
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !calEl.hidden) closeCal({ restoreFocus: true })
  })

  // Power menu
  const powerBtn = document.getElementById('tb-power')
  const powerMenu = document.getElementById('tb-power-menu')
  powerBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    tick()
    const open = !powerMenu.hidden
    powerMenu.hidden = open
    powerBtn.setAttribute('aria-expanded', String(!open))
  })
  document.addEventListener('click', (e) => {
    if (
      !powerMenu.hidden &&
      !powerBtn.contains(e.target) &&
      !powerMenu.contains(e.target)
    ) {
      powerMenu.hidden = true
      powerBtn.setAttribute('aria-expanded', 'false')
    }
  })
  powerMenu.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action
      tick()
      powerMenu.hidden = true
      powerBtn.setAttribute('aria-expanded', 'false')
      if (action === 'about')
        wm.open('about', { title: 'About', color: '#7aa2f7', initial: 'A' })
      else if (action === 'download')
        wm.open('flash', { title: 'Flash', color: '#fbbf24', initial: 'F' })
      else if (action === 'shutdown') _doShutdown()
    })
  })
}
