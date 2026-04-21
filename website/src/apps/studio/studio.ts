// Studio — creative sketch canvas with layers, undo/redo, shape tools.
//
// Loaded by [app].astro when appId === 'studio'. Everything is local:
// layers live in off-screen canvases, exports download via object URL.
//
// CTRL's Studio is actually a code editor; we adapt — a sketch app fits
// the "creative work in a privacy OS" theme better alongside Notepad.

import { bridge } from '../_bridge.js'

const PREF_KEY = 'pai-studio-prefs'
const CANVAS_W = 1200
const CANVAS_H = 800
const MAX_HISTORY = 30
const LAYER_COUNT = 3
const DEFAULT_PALETTE = [
  '#111111', '#ffffff', '#f87171', '#fbbf24', '#4ade80',
  '#7aa2f7', '#9f7aea', '#f472b6', '#64748b', '#1e3a8a',
]

type Tool = 'pen' | 'eraser' | 'bucket' | 'line' | 'rect' | 'ellipse'

interface Prefs {
  color: string
  size: number
  opacity: number
  tool: Tool
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREF_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<Prefs>
      return {
        color: typeof p.color === 'string' ? p.color : '#111111',
        size: typeof p.size === 'number' ? clamp(p.size, 1, 200) : 6,
        opacity: typeof p.opacity === 'number' ? clamp(p.opacity, 0.05, 1) : 1,
        tool: (['pen', 'eraser', 'bucket', 'line', 'rect', 'ellipse'] as Tool[]).includes(p.tool as Tool)
          ? (p.tool as Tool)
          : 'pen',
      }
    }
  } catch {}
  return { color: '#111111', size: 6, opacity: 1, tool: 'pen' }
}

function savePrefs(p: Prefs): void {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(p)) } catch {}
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function hexToRgba(hex: string, alpha: number): [number, number, number, number] {
  const m = /^#?([a-f\d]{6})$/i.exec(hex)
  if (!m) return [0, 0, 0, Math.round(alpha * 255)]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, Math.round(alpha * 255)]
}

interface Layer {
  name: string
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  visible: boolean
  domCanvas: HTMLCanvasElement // on-stage canvas that mirrors this layer
}

export class StudioApp {
  private container: HTMLElement
  private prefs: Prefs = loadPrefs()

  private stack!: HTMLElement
  private overlay!: HTMLCanvasElement
  private overlayCtx!: CanvasRenderingContext2D
  private layers: Layer[] = []
  private activeLayer = 0

  private undoStack: ImageData[][] = []
  private redoStack: ImageData[][] = []

  private isDrawing = false
  private startPt: { x: number; y: number } | null = null
  private lastPt: { x: number; y: number } | null = null
  private currentStroke: { pts: { x: number; y: number }[] } | null = null

  private statusLeft!: HTMLElement
  private statusRight!: HTMLElement

  constructor(container: HTMLElement) {
    this.container = container
    this.render()
    this.initLayers()
    this.bind()
    this.applyPrefs()
    this.pushHistory()
    this.updateStatus(`${CANVAS_W} × ${CANVAS_H} · Layer 1`)
  }

  // ── Render ────────────────────────────────────────────────────────────

  private render(): void {
    this.container.innerHTML = `
      <div class="st-root">
        <div class="st-toolbar" role="toolbar" aria-label="Studio toolbar">
          <div class="st-toolbar-group">
            <button type="button" class="st-btn" data-tool="pen" title="Pen (B)">✏️</button>
            <button type="button" class="st-btn" data-tool="eraser" title="Eraser (E)">🩹</button>
            <button type="button" class="st-btn" data-tool="bucket" title="Fill bucket (G)">🪣</button>
            <button type="button" class="st-btn" data-tool="line" title="Line (L)">╱</button>
            <button type="button" class="st-btn" data-tool="rect" title="Rectangle (R)">▭</button>
            <button type="button" class="st-btn" data-tool="ellipse" title="Ellipse (O)">◯</button>
          </div>

          <div class="st-toolbar-group">
            <span class="st-label">Color</span>
            <input type="color" class="st-color" id="st-color" value="${this.prefs.color}" aria-label="Pick color" />
            <div class="st-swatches" id="st-swatches">
              ${DEFAULT_PALETTE.map(
                (c) =>
                  `<button type="button" class="st-swatch" data-swatch="${c}" style="background:${c}" aria-label="Use ${c}"></button>`,
              ).join('')}
            </div>
          </div>

          <div class="st-toolbar-group">
            <span class="st-label">Size</span>
            <input type="range" class="st-range" id="st-size" min="1" max="80" step="1" value="${this.prefs.size}" aria-label="Brush size" />
            <span class="st-range-value" id="st-size-val">${this.prefs.size}</span>
          </div>

          <div class="st-toolbar-group">
            <span class="st-label">Opacity</span>
            <input type="range" class="st-range" id="st-opacity" min="5" max="100" step="1" value="${Math.round(this.prefs.opacity * 100)}" aria-label="Opacity" />
            <span class="st-range-value" id="st-opacity-val">${Math.round(this.prefs.opacity * 100)}%</span>
          </div>

          <div class="st-toolbar-group">
            <button type="button" class="st-btn" id="st-undo" title="Undo (Ctrl+Z)">↶</button>
            <button type="button" class="st-btn" id="st-redo" title="Redo (Ctrl+Shift+Z)">↷</button>
          </div>

          <div class="st-toolbar-group">
            <button type="button" class="st-btn" id="st-clear" title="Clear active layer">Clear</button>
            <button type="button" class="st-btn" id="st-import" title="Import image">Import…</button>
            <button type="button" class="st-btn st-btn--primary" id="st-export" title="Export PNG (Ctrl+S)">Export PNG</button>
          </div>
        </div>

        <div class="st-stage">
          <div class="st-canvas-wrap">
            <div class="st-canvas-stack" id="st-stack" style="width:${CANVAS_W / 2}px;height:${CANVAS_H / 2}px;"></div>
          </div>
          <aside class="st-sidebar" aria-label="Layers">
            <div class="st-sidebar-title">Layers</div>
            <div id="st-layers"></div>
          </aside>
        </div>

        <div class="st-status">
          <span id="st-status-left">Ready</span>
          <span id="st-status-right">Pen</span>
        </div>

        <input type="file" id="st-file" class="st-hidden" accept="image/*" />
      </div>
    `
    this.stack = this.container.querySelector('#st-stack') as HTMLElement
    this.statusLeft = this.container.querySelector('#st-status-left') as HTMLElement
    this.statusRight = this.container.querySelector('#st-status-right') as HTMLElement
  }

  private initLayers(): void {
    // Create display canvases + off-screen buffers for each layer.
    for (let i = 0; i < LAYER_COUNT; i++) {
      const domCanvas = document.createElement('canvas')
      domCanvas.width = CANVAS_W
      domCanvas.height = CANVAS_H
      this.stack.appendChild(domCanvas)

      const buffer = document.createElement('canvas')
      buffer.width = CANVAS_W
      buffer.height = CANVAS_H
      const ctx = buffer.getContext('2d')!
      // First layer gets white background so export isn't transparent by default.
      if (i === 0) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
      }
      this.layers.push({
        name: `Layer ${i + 1}`,
        canvas: buffer,
        ctx,
        visible: true,
        domCanvas,
      })
      this.blit(this.layers[i])
    }

    // Overlay for previewing shape tools before commit.
    this.overlay = document.createElement('canvas')
    this.overlay.width = CANVAS_W
    this.overlay.height = CANVAS_H
    this.overlay.className = 'is-interactive'
    this.stack.appendChild(this.overlay)
    this.overlayCtx = this.overlay.getContext('2d')!

    this.renderLayersUi()
  }

  private blit(layer: Layer): void {
    const dctx = layer.domCanvas.getContext('2d')!
    dctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
    if (layer.visible) dctx.drawImage(layer.canvas, 0, 0)
  }

  private renderLayersUi(): void {
    const host = this.container.querySelector('#st-layers') as HTMLElement
    host.innerHTML = ''
    // Render top-to-bottom (reverse so top of stack shows first).
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i]
      const row = document.createElement('div')
      row.className = 'st-layer'
      if (i === this.activeLayer) row.classList.add('is-active')
      row.dataset.idx = String(i)
      row.innerHTML = `
        <button type="button" class="st-layer-vis ${layer.visible ? 'is-visible' : ''}"
          aria-label="Toggle visibility" data-vis="${i}">${layer.visible ? '👁' : '·'}</button>
        <span class="st-layer-name">${layer.name}</span>
      `
      host.appendChild(row)
    }
  }

  // ── Bind ──────────────────────────────────────────────────────────────

  private bind(): void {
    // Tool buttons
    this.container.querySelectorAll('[data-tool]').forEach((el) => {
      el.addEventListener('click', () => {
        this.prefs.tool = (el as HTMLElement).dataset.tool as Tool
        savePrefs(this.prefs)
        this.applyPrefs()
      })
    })

    // Color picker
    const colorEl = this.container.querySelector('#st-color') as HTMLInputElement
    colorEl.addEventListener('input', () => {
      this.prefs.color = colorEl.value
      savePrefs(this.prefs)
      this.applyPrefs()
    })

    // Swatches
    this.container.querySelectorAll('[data-swatch]').forEach((el) => {
      el.addEventListener('click', () => {
        this.prefs.color = (el as HTMLElement).dataset.swatch!
        colorEl.value = this.prefs.color
        savePrefs(this.prefs)
        this.applyPrefs()
      })
    })

    // Size / opacity
    const sizeEl = this.container.querySelector('#st-size') as HTMLInputElement
    const sizeVal = this.container.querySelector('#st-size-val') as HTMLElement
    sizeEl.addEventListener('input', () => {
      this.prefs.size = parseInt(sizeEl.value, 10)
      sizeVal.textContent = String(this.prefs.size)
      savePrefs(this.prefs)
    })
    const opEl = this.container.querySelector('#st-opacity') as HTMLInputElement
    const opVal = this.container.querySelector('#st-opacity-val') as HTMLElement
    opEl.addEventListener('input', () => {
      this.prefs.opacity = parseInt(opEl.value, 10) / 100
      opVal.textContent = `${Math.round(this.prefs.opacity * 100)}%`
      savePrefs(this.prefs)
    })

    // Undo / redo / clear / export / import
    this.container.querySelector('#st-undo')!.addEventListener('click', () => this.undo())
    this.container.querySelector('#st-redo')!.addEventListener('click', () => this.redo())
    this.container.querySelector('#st-clear')!.addEventListener('click', () => this.clearActive())
    this.container.querySelector('#st-export')!.addEventListener('click', () => this.exportPng())
    this.container.querySelector('#st-import')!.addEventListener('click', () => {
      (this.container.querySelector('#st-file') as HTMLInputElement).click()
    })
    const fileInput = this.container.querySelector('#st-file') as HTMLInputElement
    fileInput.addEventListener('change', () => {
      const f = fileInput.files?.[0]
      if (f) this.importImage(f)
      fileInput.value = ''
    })

    // Layer clicks
    const layersHost = this.container.querySelector('#st-layers') as HTMLElement
    layersHost.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      const visBtn = target.closest('[data-vis]') as HTMLElement | null
      if (visBtn) {
        const idx = parseInt(visBtn.dataset.vis!, 10)
        this.layers[idx].visible = !this.layers[idx].visible
        this.blit(this.layers[idx])
        this.renderLayersUi()
        return
      }
      const row = target.closest('[data-idx]') as HTMLElement | null
      if (row) {
        this.activeLayer = parseInt(row.dataset.idx!, 10)
        this.renderLayersUi()
        this.updateStatus(`${CANVAS_W} × ${CANVAS_H} · Layer ${this.activeLayer + 1}`)
      }
    })

    // Canvas pointer events
    this.overlay.addEventListener('pointerdown', (e) => this.onPointerDown(e))
    this.overlay.addEventListener('pointermove', (e) => this.onPointerMove(e))
    this.overlay.addEventListener('pointerup', (e) => this.onPointerUp(e))
    this.overlay.addEventListener('pointercancel', () => this.cancelStroke())
    this.overlay.addEventListener('pointerleave', (e) => {
      if (this.isDrawing) this.onPointerUp(e)
    })

    // Keyboard shortcuts
    this.container.tabIndex = 0
    this.container.addEventListener('keydown', this.onKey)
  }

  private onKey = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.isContentEditable) return
    const mod = e.ctrlKey || e.metaKey
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault()
      if (e.shiftKey) this.redo()
      else this.undo()
      return
    }
    if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault()
      this.redo()
      return
    }
    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault()
      this.exportPng()
      return
    }
    if (mod) return
    switch (e.key.toLowerCase()) {
      case 'b': this.prefs.tool = 'pen'; break
      case 'e': this.prefs.tool = 'eraser'; break
      case 'g': this.prefs.tool = 'bucket'; break
      case 'l': this.prefs.tool = 'line'; break
      case 'r': this.prefs.tool = 'rect'; break
      case 'o': this.prefs.tool = 'ellipse'; break
      case '[': this.adjustSize(-2); return
      case ']': this.adjustSize(+2); return
      default: return
    }
    savePrefs(this.prefs)
    this.applyPrefs()
  }

  private adjustSize(delta: number): void {
    this.prefs.size = clamp(this.prefs.size + delta, 1, 200)
    savePrefs(this.prefs)
    const sizeEl = this.container.querySelector('#st-size') as HTMLInputElement
    const sizeVal = this.container.querySelector('#st-size-val') as HTMLElement
    sizeEl.value = String(this.prefs.size)
    sizeVal.textContent = String(this.prefs.size)
  }

  private applyPrefs(): void {
    this.container.querySelectorAll('[data-tool]').forEach((el) => {
      const active = (el as HTMLElement).dataset.tool === this.prefs.tool
      el.classList.toggle('st-btn--active', active)
    })
    this.container.querySelectorAll('[data-swatch]').forEach((el) => {
      const active = (el as HTMLElement).dataset.swatch === this.prefs.color
      el.classList.toggle('is-active', active)
    })
    this.statusRight.textContent =
      this.prefs.tool.charAt(0).toUpperCase() + this.prefs.tool.slice(1)
  }

  // ── Drawing ───────────────────────────────────────────────────────────

  private canvasPoint(e: PointerEvent): { x: number; y: number } {
    const rect = this.overlay.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_W
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_H
    return { x, y }
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    this.overlay.setPointerCapture(e.pointerId)
    this.isDrawing = true
    const pt = this.canvasPoint(e)
    this.startPt = pt
    this.lastPt = pt
    if (this.prefs.tool === 'pen' || this.prefs.tool === 'eraser') {
      this.currentStroke = { pts: [pt] }
      this.strokeSegment(pt, pt)
    } else if (this.prefs.tool === 'bucket') {
      this.floodFill(Math.round(pt.x), Math.round(pt.y))
      this.isDrawing = false
      this.pushHistory()
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.isDrawing || !this.startPt) {
      // Update cursor crosshair size preview? For now skip.
      return
    }
    const pt = this.canvasPoint(e)
    switch (this.prefs.tool) {
      case 'pen':
      case 'eraser':
        if (this.lastPt) this.strokeSegment(this.lastPt, pt)
        this.lastPt = pt
        if (this.currentStroke) this.currentStroke.pts.push(pt)
        break
      case 'line':
        this.drawOverlay(() => this.drawLine(this.overlayCtx, this.startPt!, pt))
        break
      case 'rect':
        this.drawOverlay(() => this.drawRect(this.overlayCtx, this.startPt!, pt))
        break
      case 'ellipse':
        this.drawOverlay(() => this.drawEllipse(this.overlayCtx, this.startPt!, pt))
        break
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.isDrawing) return
    const pt = this.canvasPoint(e)
    switch (this.prefs.tool) {
      case 'pen':
      case 'eraser':
        // already committed during move
        break
      case 'line':
        this.clearOverlay()
        this.drawLine(this.activeCtx(), this.startPt!, pt)
        this.blitActive()
        break
      case 'rect':
        this.clearOverlay()
        this.drawRect(this.activeCtx(), this.startPt!, pt)
        this.blitActive()
        break
      case 'ellipse':
        this.clearOverlay()
        this.drawEllipse(this.activeCtx(), this.startPt!, pt)
        this.blitActive()
        break
    }
    try { this.overlay.releasePointerCapture(e.pointerId) } catch {}
    this.isDrawing = false
    this.startPt = null
    this.lastPt = null
    this.currentStroke = null
    this.pushHistory()
  }

  private cancelStroke(): void {
    this.isDrawing = false
    this.startPt = null
    this.lastPt = null
    this.currentStroke = null
    this.clearOverlay()
  }

  private activeCtx(): CanvasRenderingContext2D {
    return this.layers[this.activeLayer].ctx
  }

  private blitActive(): void {
    this.blit(this.layers[this.activeLayer])
  }

  private clearOverlay(): void {
    this.overlayCtx.clearRect(0, 0, CANVAS_W, CANVAS_H)
  }

  private drawOverlay(fn: () => void): void {
    this.clearOverlay()
    fn()
  }

  private configureStroke(ctx: CanvasRenderingContext2D, erase = false): void {
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = this.prefs.size
    ctx.globalAlpha = erase ? 1 : this.prefs.opacity
    ctx.strokeStyle = this.prefs.color
    ctx.fillStyle = this.prefs.color
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over'
  }

  private strokeSegment(a: { x: number; y: number }, b: { x: number; y: number }): void {
    const ctx = this.activeCtx()
    this.configureStroke(ctx, this.prefs.tool === 'eraser')
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    this.blitActive()
  }

  private drawLine(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }): void {
    this.configureStroke(ctx)
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  private drawRect(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }): void {
    this.configureStroke(ctx)
    const x = Math.min(a.x, b.x)
    const y = Math.min(a.y, b.y)
    const w = Math.abs(b.x - a.x)
    const h = Math.abs(b.y - a.y)
    ctx.strokeRect(x, y, w, h)
    ctx.globalAlpha = 1
  }

  private drawEllipse(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }): void {
    this.configureStroke(ctx)
    const cx = (a.x + b.x) / 2
    const cy = (a.y + b.y) / 2
    const rx = Math.abs(b.x - a.x) / 2
    const ry = Math.abs(b.y - a.y) / 2
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  // ── Fill bucket ───────────────────────────────────────────────────────

  private floodFill(sx: number, sy: number): void {
    if (sx < 0 || sy < 0 || sx >= CANVAS_W || sy >= CANVAS_H) return
    const ctx = this.activeCtx()
    const img = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H)
    const data = img.data
    const idx = (x: number, y: number) => (y * CANVAS_W + x) * 4
    const startIdx = idx(sx, sy)
    const sr = data[startIdx]
    const sg = data[startIdx + 1]
    const sb = data[startIdx + 2]
    const sa = data[startIdx + 3]
    const [fr, fg, fb, fa] = hexToRgba(this.prefs.color, this.prefs.opacity)
    if (sr === fr && sg === fg && sb === fb && sa === fa) return

    const tol = 4
    const match = (i: number): boolean =>
      Math.abs(data[i] - sr) <= tol &&
      Math.abs(data[i + 1] - sg) <= tol &&
      Math.abs(data[i + 2] - sb) <= tol &&
      Math.abs(data[i + 3] - sa) <= tol

    const stack: number[] = [sx, sy]
    while (stack.length) {
      const y = stack.pop()!
      const x = stack.pop()!
      let xl = x
      while (xl >= 0 && match(idx(xl, y))) xl--
      xl++
      let xr = x
      while (xr < CANVAS_W && match(idx(xr, y))) xr++
      xr--
      for (let xi = xl; xi <= xr; xi++) {
        const i = idx(xi, y)
        data[i] = fr
        data[i + 1] = fg
        data[i + 2] = fb
        data[i + 3] = fa
        if (y > 0 && match(idx(xi, y - 1))) stack.push(xi, y - 1)
        if (y < CANVAS_H - 1 && match(idx(xi, y + 1))) stack.push(xi, y + 1)
      }
    }
    ctx.putImageData(img, 0, 0)
    this.blitActive()
  }

  // ── History ───────────────────────────────────────────────────────────

  private snapshotAll(): ImageData[] {
    return this.layers.map((l) => l.ctx.getImageData(0, 0, CANVAS_W, CANVAS_H))
  }

  private restore(snap: ImageData[]): void {
    snap.forEach((data, i) => {
      this.layers[i].ctx.putImageData(data, 0, 0)
      this.blit(this.layers[i])
    })
  }

  private pushHistory(): void {
    this.undoStack.push(this.snapshotAll())
    if (this.undoStack.length > MAX_HISTORY + 1) this.undoStack.shift()
    this.redoStack = []
  }

  private undo(): void {
    if (this.undoStack.length < 2) return
    const current = this.undoStack.pop()!
    this.redoStack.push(current)
    const prev = this.undoStack[this.undoStack.length - 1]
    this.restore(prev)
    this.updateStatus(`Undo (${this.undoStack.length - 1} left)`)
  }

  private redo(): void {
    const next = this.redoStack.pop()
    if (!next) return
    this.undoStack.push(next)
    this.restore(next)
    this.updateStatus('Redo')
  }

  // ── Layer ops ─────────────────────────────────────────────────────────

  private clearActive(): void {
    const layer = this.layers[this.activeLayer]
    if (this.activeLayer === 0) {
      layer.ctx.fillStyle = '#ffffff'
      layer.ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    } else {
      layer.ctx.clearRect(0, 0, CANVAS_W, CANVAS_H)
    }
    this.blit(layer)
    this.pushHistory()
    this.updateStatus(`Cleared ${layer.name}`)
  }

  // ── Import & export ───────────────────────────────────────────────────

  private async importImage(file: File): Promise<void> {
    const url = URL.createObjectURL(file)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = () => reject(new Error('Could not load image'))
        el.src = url
      })
      // Fit to canvas while keeping aspect ratio, centered.
      const scale = Math.min(CANVAS_W / img.width, CANVAS_H / img.height)
      const w = img.width * scale
      const h = img.height * scale
      const dx = (CANVAS_W - w) / 2
      const dy = (CANVAS_H - h) / 2
      const ctx = this.activeCtx()
      ctx.drawImage(img, dx, dy, w, h)
      this.blitActive()
      this.pushHistory()
      this.updateStatus(`Imported ${file.name}`)
    } catch (err) {
      this.updateStatus(`Import failed: ${String((err as Error).message)}`)
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  private exportPng(): void {
    // Flatten all visible layers onto a single canvas.
    const out = document.createElement('canvas')
    out.width = CANVAS_W
    out.height = CANVAS_H
    const octx = out.getContext('2d')!
    for (const layer of this.layers) {
      if (layer.visible) octx.drawImage(layer.canvas, 0, 0)
    }
    out.toBlob((blob) => {
      if (!blob) {
        this.updateStatus('Export failed')
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')
      a.href = url
      a.download = `pai-studio-${ts}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      this.updateStatus(`Exported ${a.download}`)
    }, 'image/png')
  }

  private updateStatus(msg: string): void {
    this.statusLeft.textContent = msg
  }
}
