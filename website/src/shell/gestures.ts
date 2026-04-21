// PAI Shell Gestures — touchpad / touch gestures.
// Enabled when ?gestures=1 or on coarse pointers. No-op on desktop mouse
// unless the user explicitly opts in. Uses pointer events and the TouchEvent
// `touches` array for multi-finger detection.

// Import kept for side effects / typing; we read wm off window to avoid
// a hard dependency cycle during shell startup.
type WM = {
  switchWorkspace: (n: number) => void
  getActiveWorkspace: () => number
}

function shouldEnable(): boolean {
  try {
    const p = new URLSearchParams(location.search)
    if (p.get('gestures') === '1') return true
    if (p.get('gestures') === '0') return false
  } catch {}
  // Auto-enable on coarse pointers (touchscreens / tablets).
  return window.matchMedia('(any-pointer: coarse)').matches
}

function getWM(): WM | null {
  const wm = (window as any).__wm
  if (!wm) return null
  if (typeof wm.switchWorkspace !== 'function') return null
  return wm
}

// ── 3-finger swipe detection ──────────────────────────────────────────────────

const SWIPE_THRESHOLD = 70

type ThreeFingerStart = { x: number; y: number; t: number } | null
let threeStart: ThreeFingerStart = null

function centroid(touches: TouchList): { x: number; y: number } {
  let x = 0, y = 0, n = touches.length
  for (let i = 0; i < n; i++) {
    x += touches[i].clientX
    y += touches[i].clientY
  }
  return { x: x / n, y: y / n }
}

function onTouchStart(e: TouchEvent): void {
  if (e.touches.length === 3) {
    const c = centroid(e.touches)
    threeStart = { x: c.x, y: c.y, t: Date.now() }
  } else {
    threeStart = null
  }

  // Two-finger tap → context menu at midpoint.
  if (e.touches.length === 2) {
    const c = centroid(e.touches)
    // Defer to touchend to confirm it was a tap, not a drag.
    const startCx = c.x
    const startCy = c.y
    const onEnd = (): void => {
      document.removeEventListener('touchend', onEnd)
      const target = document.elementFromPoint(startCx, startCy) as HTMLElement | null
      if (!target) return
      target.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: startCx,
          clientY: startCy,
        }),
      )
    }
    document.addEventListener('touchend', onEnd, { once: true })
  }
}

function onTouchEnd(e: TouchEvent): void {
  if (!threeStart) return
  if (e.changedTouches.length === 0) return

  // Use any ended touch + remaining ones to compute approximate centroid delta.
  const touches = e.changedTouches
  let x = 0, y = 0
  for (let i = 0; i < touches.length; i++) {
    x += touches[i].clientX
    y += touches[i].clientY
  }
  x /= touches.length
  y /= touches.length

  const dx = x - threeStart.x
  const dy = y - threeStart.y
  const dt = Date.now() - threeStart.t
  threeStart = null
  if (dt > 700) return

  if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
    const dir = dx > 0 ? 'right' : 'left'
    switchWS(dir)
  } else if (dy < -SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
    openOverview()
  }
}

function switchWS(dir: 'left' | 'right'): void {
  const wm = getWM()
  if (!wm) return
  const cur = typeof wm.getActiveWorkspace === 'function' ? wm.getActiveWorkspace() : 1
  let next = dir === 'right' ? cur + 1 : cur - 1
  if (next < 1) next = 4
  if (next > 4) next = 1
  wm.switchWorkspace(next)
}

// ── Windows overview ──────────────────────────────────────────────────────────

let overviewEl: HTMLElement | null = null

function openOverview(): void {
  if (overviewEl) return
  const layer = document.getElementById('wm-layer')
  if (!layer) return

  const windows = Array.from(
    layer.querySelectorAll<HTMLElement>('.window'),
  )
  if (!windows.length) return

  injectOverviewStyles()

  overviewEl = document.createElement('div')
  overviewEl.className = 'pai-overview'
  overviewEl.setAttribute('role', 'dialog')
  overviewEl.setAttribute('aria-label', 'Windows overview')

  const grid = document.createElement('div')
  grid.className = 'pai-overview__grid'

  windows.forEach((win) => {
    const id = win.id
    const title = win.querySelector('.window-title')?.textContent ?? 'Window'
    const card = document.createElement('button')
    card.className = 'pai-overview__card'
    card.innerHTML = `
      <div class="pai-overview__thumb"></div>
      <div class="pai-overview__label">${escapeText(title)}</div>
    `
    card.addEventListener('click', () => {
      closeOverview()
      const wm = (window as any).__wm
      if (wm && typeof wm.focus === 'function') wm.focus(id)
    })
    grid.appendChild(card)
  })

  overviewEl.appendChild(grid)
  overviewEl.addEventListener('click', (ev) => {
    if (ev.target === overviewEl) closeOverview()
  })

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      closeOverview()
      document.removeEventListener('keydown', onKey)
    }
  }
  document.addEventListener('keydown', onKey)

  document.body.appendChild(overviewEl)
}

function closeOverview(): void {
  if (!overviewEl) return
  overviewEl.remove()
  overviewEl = null
}

function escapeText(s: string): string {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

function injectOverviewStyles(): void {
  if (document.getElementById('pai-gestures-styles')) return
  const style = document.createElement('style')
  style.id = 'pai-gestures-styles'
  style.textContent = `
    .pai-overview {
      position: fixed; inset: 0; z-index: var(--z-modal, 50);
      background: rgba(10, 10, 20, 0.85);
      backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      padding: var(--s-5, 24px);
      animation: pai-overview-fade 180ms ease-out;
    }
    @keyframes pai-overview-fade { from { opacity: 0; } to { opacity: 1; } }
    .pai-overview__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: var(--s-4, 16px);
      max-width: 1000px;
      width: 100%;
    }
    .pai-overview__card {
      display: flex; flex-direction: column; gap: var(--s-2, 8px);
      background: var(--bg-elev, #1a1a2e);
      border: 1px solid var(--border, #2a2a3e);
      border-radius: var(--r-window, 8px);
      padding: var(--s-3, 12px);
      color: var(--fg, #e0e0e0);
      font-family: var(--font-ui, system-ui, sans-serif);
      font-size: 0.875rem;
      cursor: pointer;
      transition: border-color 120ms, transform 120ms;
    }
    .pai-overview__card:hover {
      border-color: var(--pai-blue, #7aa2f7);
      transform: translateY(-2px);
    }
    .pai-overview__thumb {
      height: 110px; border-radius: var(--r-icon, 6px);
      background: linear-gradient(135deg, rgba(122,162,247,0.15), rgba(159,122,234,0.15));
    }
    .pai-overview__label {
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    /* Pinch-to-zoom visual feedback */
    .pai-pinch-zoom {
      transform-origin: center;
      transition: transform 120ms ease-out;
    }
  `
  document.head.appendChild(style)
}

// ── Pinch-to-zoom on desktop (visual only) ────────────────────────────────────

let pinchStart: number | null = null
const DESKTOP_SEL = '.shell__desktop'

function distance(touches: TouchList): number {
  const a = touches[0], b = touches[1]
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

function onPinchStart(e: TouchEvent): void {
  if (e.touches.length !== 2) return
  const target = e.target as HTMLElement
  if (!target.closest(DESKTOP_SEL)) return
  if (target.closest('.window')) return
  pinchStart = distance(e.touches)
}

function onPinchMove(e: TouchEvent): void {
  if (pinchStart === null || e.touches.length !== 2) return
  const desk = document.querySelector<HTMLElement>(DESKTOP_SEL)
  if (!desk) return
  const d = distance(e.touches)
  const scale = Math.max(0.85, Math.min(1.15, d / pinchStart))
  desk.style.transform = `scale(${scale})`
  desk.style.transformOrigin = 'center'
}

function onPinchEnd(): void {
  if (pinchStart === null) return
  pinchStart = null
  const desk = document.querySelector<HTMLElement>(DESKTOP_SEL)
  if (desk) {
    desk.style.transition = 'transform 200ms ease-out'
    desk.style.transform = ''
    setTimeout(() => {
      desk.style.transition = ''
      desk.style.transformOrigin = ''
    }, 220)
  }
}

// ── Init ─────────────────────────────────────────────────────────────────────

function init(): void {
  if (!shouldEnable()) return
  document.addEventListener('touchstart', onTouchStart, { passive: true })
  document.addEventListener('touchend', onTouchEnd, { passive: true })
  document.addEventListener('touchstart', onPinchStart, { passive: true })
  document.addEventListener('touchmove', onPinchMove, { passive: true })
  document.addEventListener('touchend', onPinchEnd, { passive: true })
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true })
  } else {
    init()
  }
}

export const gestures = {
  openOverview,
  closeOverview,
}
