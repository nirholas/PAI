// Task Manager — PAI. Uses bridge to query window list from the shell.

import { bridge } from '../_bridge.js'

interface WindowInfo {
  id: string
  appId: string
  title: string
  minimized: boolean
  focused: boolean
}

const SERVICES = [
  { name: 'ollama.service', desc: 'Local AI model runtime', active: true },
  { name: 'pai-privacy.service', desc: 'Network privacy hardening (DNS, firewall)', active: true },
  { name: 'pai-persistence.service', desc: 'Encrypted persistence volume', active: true },
  { name: 'sway.service', desc: 'Sway Wayland compositor', active: true },
  { name: 'pipewire.service', desc: 'Audio and video session', active: true },
  { name: 'NetworkManager.service', desc: 'Network connection manager', active: true },
  { name: 'pai-airgap.timer', desc: 'Airgap watchdog (periodic check)', active: true },
  { name: 'bluetooth.service', desc: 'Bluetooth radio stack', active: false },
  { name: 'cups.service', desc: 'Printing daemon', active: false },
  { name: 'pai-backup.timer', desc: 'Scheduled encrypted backup', active: false },
]

export function mountTaskManager(root: HTMLElement) {
  // ── Tabs
  const tabs = root.querySelectorAll<HTMLButtonElement>('.tm-tab')
  const panels = root.querySelectorAll<HTMLElement>('.tm-panel')
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab!
      tabs.forEach((t) => t.setAttribute('aria-selected', t === tab ? 'true' : 'false'))
      panels.forEach((p) => p.classList.toggle('active', p.dataset.panel === target))
    })
  })

  // ── Processes (windows)
  const winBody = root.querySelector<HTMLElement>('.tm-win-body')!
  let lastList: WindowInfo[] = []

  function renderWindows(list: WindowInfo[]) {
    lastList = list
    if (!list.length) {
      winBody.innerHTML = '<tr><td colspan="4" class="tm-empty">No open windows.</td></tr>'
      return
    }
    winBody.innerHTML = ''
    list.forEach((w) => {
      const tr = document.createElement('tr')
      const status = w.minimized
        ? '<span class="pill min">Minimized</span>'
        : w.focused
        ? '<span class="pill focused">Focused</span>'
        : '<span class="pill inactive">Idle</span>'
      tr.innerHTML = `
        <td>${escHtml(w.title || w.appId)}</td>
        <td><code style="color:var(--fg-muted);font-size:0.75rem;">${escHtml(w.appId)}</code></td>
        <td>${status}</td>
        <td>
          <button class="tm-action-btn" data-action="focus" data-id="${w.id}">Focus</button>
          <button class="tm-action-btn" data-action="minimize" data-id="${w.id}">Hide</button>
          <button class="tm-action-btn danger" data-action="close" data-id="${w.id}">Close</button>
        </td>
      `
      winBody.appendChild(tr)
    })
  }

  winBody.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest('button.tm-action-btn') as HTMLButtonElement | null
    if (!t) return
    const id = t.dataset.id
    const action = t.dataset.action
    if (!id || !action) return
    // send via bridge.send (custom)
    ;(window as any).parent?.postMessage(
      {
        v: 1,
        source: 'pai-app',
        type: 'window-action',
        payload: { id, action: action === 'minimize' ? (lastList.find((w) => w.id === id)?.minimized ? 'unminimize' : 'minimize') : action },
      },
      window.location.origin,
    )
    // refresh after short delay
    setTimeout(requestWindows, 120)
  })

  bridge.on('windows', (payload: any) => {
    if (Array.isArray(payload?.list)) renderWindows(payload.list as WindowInfo[])
  })

  function requestWindows() {
    if (!bridge.inShell) {
      renderWindows([])
      return
    }
    ;(window as any).parent?.postMessage(
      { v: 1, source: 'pai-app', type: 'list-windows', payload: {} },
      window.location.origin,
    )
  }
  requestWindows()
  setInterval(requestWindows, 2000)

  // ── Metrics
  interface Series { label: string; unit: string; base: number; range: [number, number]; val: number; hist: number[]; color: string }
  const metrics: Series[] = [
    { label: 'CPU', unit: '%', base: 15, range: [3, 65], val: 15, hist: [], color: 'var(--pai-blue)' },
    { label: 'RAM', unit: '%', base: 42, range: [30, 75], val: 42, hist: [], color: 'var(--pai-green)' },
    { label: 'Disk I/O', unit: 'MB/s', base: 4, range: [0, 40], val: 4, hist: [], color: 'var(--pai-yellow)' },
    { label: 'Network', unit: 'KB/s', base: 12, range: [0, 200], val: 12, hist: [], color: 'var(--pai-purple)' },
  ]

  const metricsGrid = root.querySelector<HTMLElement>('.tm-metrics')!
  metricsGrid.innerHTML = ''
  const canvases: HTMLCanvasElement[] = []
  const valueEls: HTMLElement[] = []
  metrics.forEach((m) => {
    const card = document.createElement('div')
    card.className = 'metric'
    card.innerHTML = `
      <div class="metric-header">
        <span class="metric-label">${m.label}</span>
        <span class="metric-value" style="color:${m.color};">—</span>
      </div>
      <canvas width="300" height="80"></canvas>
    `
    metricsGrid.appendChild(card)
    canvases.push(card.querySelector('canvas')!)
    valueEls.push(card.querySelector('.metric-value')!)
  })

  function randomWalk(m: Series) {
    const delta = (Math.random() - 0.5) * (m.range[1] - m.range[0]) * 0.12
    const toward = (m.base - m.val) * 0.08
    m.val = Math.max(m.range[0], Math.min(m.range[1], m.val + delta + toward))
  }

  function draw() {
    metrics.forEach((m, i) => {
      randomWalk(m)
      m.hist.push(m.val)
      if (m.hist.length > 60) m.hist.shift()
      const unit = m.unit
      const val = m.unit === '%' ? m.val.toFixed(0) : m.val.toFixed(1)
      valueEls[i].textContent = `${val}${unit}`

      const cvs = canvases[i]
      const ctx = cvs.getContext('2d')!
      const W = cvs.width
      const H = cvs.height
      ctx.clearRect(0, 0, W, H)

      // grid
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      ctx.lineWidth = 1
      for (let y = 1; y < 4; y++) {
        ctx.beginPath()
        ctx.moveTo(0, (H / 4) * y)
        ctx.lineTo(W, (H / 4) * y)
        ctx.stroke()
      }

      const color = getComputedStyle(cvs).getPropertyValue('--pai-blue') // fallback
      const resolvedColor = resolveCssVar(m.color)

      // fill area
      const grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, resolvedColor + '55')
      grad.addColorStop(1, resolvedColor + '00')
      ctx.fillStyle = grad
      ctx.strokeStyle = resolvedColor
      ctx.lineWidth = 1.5

      const pts = m.hist
      const step = W / Math.max(1, 59)
      ctx.beginPath()
      ctx.moveTo(0, H)
      pts.forEach((v, idx) => {
        const x = idx * step
        const y = H - ((v - m.range[0]) / (m.range[1] - m.range[0])) * H
        if (idx === 0) ctx.lineTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.lineTo((pts.length - 1) * step, H)
      ctx.closePath()
      ctx.fill()

      // line
      ctx.beginPath()
      pts.forEach((v, idx) => {
        const x = idx * step
        const y = H - ((v - m.range[0]) / (m.range[1] - m.range[0])) * H
        if (idx === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
    })
  }

  function resolveCssVar(v: string): string {
    const m = v.match(/var\(([^)]+)\)/)
    if (!m) return v
    const name = m[1].trim()
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#7aa2f7'
  }

  draw()
  setInterval(draw, 1000)

  // ── Services
  const svcBody = root.querySelector<HTMLElement>('.tm-svc-body')!
  function renderServices() {
    svcBody.innerHTML = ''
    SERVICES.forEach((s) => {
      const tr = document.createElement('tr')
      tr.innerHTML = `
        <td><code>${escHtml(s.name)}</code></td>
        <td>${s.active ? '<span class="pill active">Active</span>' : '<span class="pill inactive">Inactive</span>'}</td>
        <td style="color:var(--fg-muted);">${escHtml(s.desc)}</td>
      `
      svcBody.appendChild(tr)
    })
  }
  renderServices()
}

function escHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}
