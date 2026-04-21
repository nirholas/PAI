// PAI — Desktop widgets layer.
//
// Optional, toggleable widgets that float over the desktop wallpaper. Ships
// four built-ins:
//   - clock         analog + digital
//   - sysmon        fake CPU/memory bars (animated — it's a demo)
//   - note          sticky-note (persisted to localStorage)
//   - sysinfo       PAI version + tagline
//
// Each widget stores its enabled state and position in localStorage. A widget
// manager overlay (openWidgetManager) lets the user toggle them; exposed via
// the desktop context menu.

type WidgetId = 'clock' | 'sysmon' | 'note' | 'sysinfo'

type WidgetDef = {
  id: WidgetId
  title: string
  defaultEnabled: boolean
  defaultPos: { x: number; y: number }
  render: (el: HTMLDivElement) => () => void // returns cleanup fn
}

type StoredState = {
  enabled: Record<WidgetId, boolean>
  positions: Record<WidgetId, { x: number; y: number }>
  note: string
}

const STORAGE_KEY = 'pai-widgets'

const DEFAULTS: StoredState = {
  enabled: { clock: false, sysmon: false, note: false, sysinfo: false },
  positions: {
    clock: { x: 24, y: 24 },
    sysmon: { x: 24, y: 240 },
    note: { x: 260, y: 24 },
    sysinfo: { x: 260, y: 240 },
  },
  note: '',
}

function loadState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return structuredClone(DEFAULTS)
    const parsed = JSON.parse(raw) as Partial<StoredState>
    return {
      enabled: { ...DEFAULTS.enabled, ...(parsed.enabled ?? {}) },
      positions: { ...DEFAULTS.positions, ...(parsed.positions ?? {}) },
      note: parsed.note ?? '',
    }
  } catch {
    return structuredClone(DEFAULTS)
  }
}

function saveState(state: StoredState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* quota / unavailable */
  }
}

let _state = loadState()
const _activeCleanups = new Map<WidgetId, () => void>()
let _layer: HTMLDivElement | null = null

// ─── Widget renderers ────────────────────────────────────────────────────────

const WIDGETS: Record<WidgetId, WidgetDef> = {
  clock: {
    id: 'clock',
    title: 'Clock',
    defaultEnabled: false,
    defaultPos: DEFAULTS.positions.clock,
    render(el) {
      el.innerHTML = `
        <div class="widget__header">Clock</div>
        <div class="widget-clock">
          <svg class="widget-clock__analog" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="2"/>
            <line class="widget-clock__hour" x1="50" y1="50" x2="50" y2="24"
                  stroke="var(--fg)" stroke-width="3" stroke-linecap="round"/>
            <line class="widget-clock__min" x1="50" y1="50" x2="50" y2="14"
                  stroke="var(--fg)" stroke-width="2" stroke-linecap="round"/>
            <line class="widget-clock__sec" x1="50" y1="50" x2="50" y2="10"
                  stroke="var(--pai-blue)" stroke-width="1" stroke-linecap="round"/>
            <circle cx="50" cy="50" r="3" fill="var(--pai-blue)"/>
          </svg>
          <div class="widget-clock__digital">
            <span class="widget-clock__time"></span>
            <span class="widget-clock__date"></span>
          </div>
        </div>
      `
      const hourH = el.querySelector<SVGLineElement>('.widget-clock__hour')!
      const minH = el.querySelector<SVGLineElement>('.widget-clock__min')!
      const secH = el.querySelector<SVGLineElement>('.widget-clock__sec')!
      const timeEl = el.querySelector<HTMLSpanElement>('.widget-clock__time')!
      const dateEl = el.querySelector<HTMLSpanElement>('.widget-clock__date')!

      const update = () => {
        const now = new Date()
        const h = now.getHours() % 12
        const m = now.getMinutes()
        const s = now.getSeconds()
        const hDeg = (h + m / 60) * 30
        const mDeg = (m + s / 60) * 6
        const sDeg = s * 6
        hourH.setAttribute('transform', `rotate(${hDeg} 50 50)`)
        minH.setAttribute('transform', `rotate(${mDeg} 50 50)`)
        secH.setAttribute('transform', `rotate(${sDeg} 50 50)`)
        timeEl.textContent = now.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
        dateEl.textContent = now.toLocaleDateString([], {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })
      }
      update()
      const id = window.setInterval(update, 1000)
      return () => window.clearInterval(id)
    },
  },

  sysmon: {
    id: 'sysmon',
    title: 'System',
    defaultEnabled: false,
    defaultPos: DEFAULTS.positions.sysmon,
    render(el) {
      el.innerHTML = `
        <div class="widget__header">System</div>
        <div class="widget-sysmon">
          <div class="widget-sysmon__row">
            <span>CPU</span>
            <span class="widget-sysmon__bar"><i data-bar="cpu"></i></span>
            <span data-val="cpu">0%</span>
          </div>
          <div class="widget-sysmon__row">
            <span>MEM</span>
            <span class="widget-sysmon__bar"><i data-bar="mem"></i></span>
            <span data-val="mem">0%</span>
          </div>
          <div class="widget-sysmon__row">
            <span>DISK</span>
            <span class="widget-sysmon__bar"><i data-bar="disk"></i></span>
            <span data-val="disk">0%</span>
          </div>
          <div class="widget-sysmon__note">Demo — not real metrics.</div>
        </div>
      `
      let cpu = 24
      let mem = 38
      const disk = 62
      const setBar = (name: string, value: number) => {
        const bar = el.querySelector<HTMLElement>(`[data-bar="${name}"]`)
        const val = el.querySelector<HTMLElement>(`[data-val="${name}"]`)
        if (bar) bar.style.width = `${value}%`
        if (val) val.textContent = `${Math.round(value)}%`
      }
      const tick = () => {
        cpu = Math.max(3, Math.min(92, cpu + (Math.random() - 0.5) * 18))
        mem = Math.max(20, Math.min(85, mem + (Math.random() - 0.5) * 6))
        setBar('cpu', cpu)
        setBar('mem', mem)
        setBar('disk', disk)
      }
      tick()
      const id = window.setInterval(tick, 1500)
      return () => window.clearInterval(id)
    },
  },

  note: {
    id: 'note',
    title: 'Note',
    defaultEnabled: false,
    defaultPos: DEFAULTS.positions.note,
    render(el) {
      el.innerHTML = `
        <div class="widget__header">Note</div>
        <textarea class="widget-note__area" rows="6" spellcheck="false"
          placeholder="A little note…"></textarea>
      `
      const ta = el.querySelector<HTMLTextAreaElement>('.widget-note__area')!
      ta.value = _state.note
      const onInput = () => {
        _state.note = ta.value
        saveState(_state)
      }
      ta.addEventListener('input', onInput)
      return () => ta.removeEventListener('input', onInput)
    },
  },

  sysinfo: {
    id: 'sysinfo',
    title: 'PAI',
    defaultEnabled: false,
    defaultPos: DEFAULTS.positions.sysinfo,
    render(el) {
      el.innerHTML = `
        <div class="widget__header">About</div>
        <div class="widget-sysinfo">
          <img class="widget-sysinfo__logo" src="/logo/pai-logo.png" alt="PAI logo" />
          <div class="widget-sysinfo__title">PAI</div>
          <div class="widget-sysinfo__tag">Private AI</div>
          <div class="widget-sysinfo__meta">v0.0.1 demo</div>
        </div>
      `
      return () => {}
    },
  },
}

// ─── Layer management ────────────────────────────────────────────────────────

function ensureLayer(): HTMLDivElement {
  if (_layer) return _layer
  let el = document.getElementById('widget-layer') as HTMLDivElement | null
  if (!el) {
    el = document.createElement('div')
    el.id = 'widget-layer'
    el.className = 'widget-layer'
    const desktop = document.getElementById('pai-desktop')
    if (desktop) desktop.appendChild(el)
    else document.body.appendChild(el)
  }
  _layer = el
  return el
}

function renderWidget(def: WidgetDef): void {
  const layer = ensureLayer()
  const existing = layer.querySelector<HTMLDivElement>(`[data-widget-id="${def.id}"]`)
  if (existing) return // already live
  const pos = _state.positions[def.id] ?? def.defaultPos
  const box = document.createElement('div')
  box.className = 'widget'
  box.dataset.widgetId = def.id
  box.style.left = `${pos.x}px`
  box.style.top = `${pos.y}px`
  layer.appendChild(box)
  const cleanup = def.render(box)
  _activeCleanups.set(def.id, cleanup)
  attachDrag(box, def.id)
}

function destroyWidget(id: WidgetId): void {
  const layer = ensureLayer()
  const el = layer.querySelector<HTMLDivElement>(`[data-widget-id="${id}"]`)
  const cleanup = _activeCleanups.get(id)
  if (cleanup) {
    cleanup()
    _activeCleanups.delete(id)
  }
  if (el) el.remove()
}

function attachDrag(el: HTMLDivElement, id: WidgetId): void {
  const header = el.querySelector<HTMLElement>('.widget__header')
  if (!header) return
  header.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    const rect = el.getBoundingClientRect()
    const layer = ensureLayer()
    const layerRect = layer.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const baseX = rect.left - layerRect.left
    const baseY = rect.top - layerRect.top
    const onMove = (ev: MouseEvent) => {
      const x = Math.max(0, baseX + (ev.clientX - startX))
      const y = Math.max(0, baseY + (ev.clientY - startY))
      el.style.left = `${x}px`
      el.style.top = `${y}px`
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      _state.positions[id] = {
        x: parseInt(el.style.left, 10) || 0,
        y: parseInt(el.style.top, 10) || 0,
      }
      saveState(_state)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  })
}

// ─── Public toggles ───────────────────────────────────────────────────────────

export function isWidgetEnabled(id: WidgetId): boolean {
  return !!_state.enabled[id]
}

export function setWidgetEnabled(id: WidgetId, on: boolean): void {
  _state.enabled[id] = on
  saveState(_state)
  if (on) renderWidget(WIDGETS[id])
  else destroyWidget(id)
}

export function toggleWidget(id: WidgetId): void {
  setWidgetEnabled(id, !_state.enabled[id])
}

export function toggleWidgetLayer(): void {
  const layer = ensureLayer()
  if (layer.hidden) {
    layer.hidden = false
    restoreActive()
  } else {
    layer.hidden = true
  }
}

function restoreActive(): void {
  for (const id of Object.keys(WIDGETS) as WidgetId[]) {
    if (_state.enabled[id]) renderWidget(WIDGETS[id])
  }
}

// ─── Manager overlay ─────────────────────────────────────────────────────────

let _mgrEl: HTMLDivElement | null = null

export function openWidgetManager(): void {
  if (_mgrEl) return closeWidgetManager()
  const el = document.createElement('div')
  el.className = 'widget-mgr'
  el.setAttribute('role', 'dialog')
  el.setAttribute('aria-modal', 'true')
  el.setAttribute('aria-label', 'Widget manager')
  el.innerHTML = `
    <div class="widget-mgr__backdrop"></div>
    <div class="widget-mgr__panel">
      <div class="widget-mgr__header">
        <h2>Widgets</h2>
        <button class="widget-mgr__close" aria-label="Close">×</button>
      </div>
      <ul class="widget-mgr__list">
        ${(Object.values(WIDGETS) as WidgetDef[])
          .map(
            (def) => `
              <li>
                <label class="widget-mgr__row">
                  <input type="checkbox" data-widget="${def.id}" ${
                    _state.enabled[def.id] ? 'checked' : ''
                  } />
                  <span>${def.title}</span>
                </label>
              </li>
            `,
          )
          .join('')}
      </ul>
      <div class="widget-mgr__footer">Changes are saved automatically.</div>
    </div>
  `
  document.body.appendChild(el)
  _mgrEl = el

  el.querySelector('.widget-mgr__backdrop')?.addEventListener('mousedown', (e) => {
    if (e.target === e.currentTarget) closeWidgetManager()
  })
  el.querySelector('.widget-mgr__close')?.addEventListener('click', () =>
    closeWidgetManager(),
  )
  el.querySelectorAll<HTMLInputElement>('input[data-widget]').forEach((cb) => {
    cb.addEventListener('change', () => {
      setWidgetEnabled(cb.dataset.widget as WidgetId, cb.checked)
    })
  })
  requestAnimationFrame(() => el.classList.add('is-open'))
}

export function closeWidgetManager(): void {
  if (!_mgrEl) return
  _mgrEl.classList.remove('is-open')
  const el = _mgrEl
  setTimeout(() => el.remove(), 160)
  _mgrEl = null
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initWidgets(): void {
  ensureLayer()
  restoreActive()
}

if (typeof window !== 'undefined') {
  ;(window as unknown as {
    __widgets: {
      toggle: (id: WidgetId) => void
      set: (id: WidgetId, on: boolean) => void
      openManager: () => void
    }
  }).__widgets = {
    toggle: toggleWidget,
    set: setWidgetEnabled,
    openManager: openWidgetManager,
  }
}
