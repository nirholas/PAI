// Music — local-only audio player with queue, visualizer, and keyboard controls.
//
// Loaded by [app].astro when appId === 'music'. Files stay in memory as
// object URLs; nothing is uploaded or indexed. On reload, the queue
// restores filenames only (object URLs don't survive) and prompts re-add.

import { bridge } from '../_bridge.js'

const PREF_KEY = 'pai-music-prefs'
const QUEUE_KEY = 'pai-music-queue'
const ACCEPT = 'audio/*,.mp3,.ogg,.wav,.flac,.m4a,.aac,.opus'

type RepeatMode = 'off' | 'one' | 'all'

interface Prefs {
  volume: number
  shuffle: boolean
  repeat: RepeatMode
}

interface Track {
  id: string
  name: string
  title: string
  duration: number
  url: string | null // object URL, null if restored from storage (needs re-add)
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREF_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<Prefs>
      return {
        volume: typeof p.volume === 'number' ? clamp(p.volume, 0, 1) : 0.8,
        shuffle: !!p.shuffle,
        repeat: p.repeat === 'one' || p.repeat === 'all' ? p.repeat : 'off',
      }
    }
  } catch {}
  return { volume: 0.8, shuffle: false, repeat: 'off' }
}

function savePrefs(p: Prefs): void {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(p)) } catch {}
}

function loadQueueStub(): string[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) return arr.filter((x) => typeof x === 'string')
    }
  } catch {}
  return []
}

function saveQueueStub(names: string[]): void {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(names)) } catch {}
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function titleFromFilename(name: string): string {
  // Strip extension and replace separators
  const stem = name.replace(/\.[^.]+$/, '')
  return stem.replace(/[_-]+/g, ' ').trim() || name
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

export class MusicApp {
  private container: HTMLElement
  private audio: HTMLAudioElement
  private queue: Track[] = []
  private currentIdx = -1
  private prefs: Prefs = loadPrefs()
  private playOrder: number[] = [] // for shuffle traversal
  private orderPos = 0
  private isSeeking = false

  // Web Audio
  private audioCtx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private sourceNode: MediaElementAudioSourceNode | null = null
  private rafId: number | null = null

  // DOM
  private canvas!: HTMLCanvasElement
  private queueEl!: HTMLElement
  private dropzoneEl!: HTMLElement
  private nowPlayingEl!: HTMLElement
  private playBtn!: HTMLButtonElement
  private seekEl!: HTMLInputElement
  private volumeEl!: HTMLInputElement
  private curTimeEl!: HTMLElement
  private durTimeEl!: HTMLElement
  private shuffleBtn!: HTMLButtonElement
  private repeatBtn!: HTMLButtonElement

  private dragSrcIdx: number | null = null

  constructor(container: HTMLElement) {
    this.container = container
    this.audio = new Audio()
    this.audio.preload = 'metadata'
    this.render()
    this.bind()
    this.restoreStubQueue()
    this.audio.volume = this.prefs.volume
    this.applyShuffle()
    this.applyRepeat()
    this.updateTransport()
    this.startVisualizer()
  }

  // ── Render ────────────────────────────────────────────────────────────

  private render(): void {
    this.container.innerHTML = `
      <div class="mp-root">
        <div class="mp-toolbar" role="toolbar" aria-label="Music toolbar">
          <button type="button" class="mp-btn mp-btn--primary" data-action="add">Add files…</button>
          <button type="button" class="mp-btn" data-action="clear">Clear queue</button>
          <span style="flex:1"></span>
          <span style="font-size:11px; color: var(--fg-muted, #888);">
            Local playback only — nothing leaves your device.
          </span>
        </div>

        <div class="mp-visualizer-wrap">
          <canvas class="mp-visualizer" id="mp-canvas"></canvas>
          <div class="mp-now-playing" id="mp-now">No track loaded</div>
        </div>

        <div class="mp-transport" role="group" aria-label="Playback controls">
          <button type="button" class="mp-btn mp-btn--icon" data-action="prev" aria-label="Previous (P)" title="Previous (P)">⏮</button>
          <button type="button" class="mp-btn mp-btn--icon mp-btn--primary" data-action="play" id="mp-play" aria-label="Play/pause (Space)" title="Play/Pause (Space)">▶</button>
          <button type="button" class="mp-btn mp-btn--icon" data-action="next" aria-label="Next (N)" title="Next (N)">⏭</button>

          <div class="mp-seek">
            <span class="mp-time" id="mp-cur">0:00</span>
            <input type="range" class="mp-range" id="mp-seek" min="0" max="0" step="0.1" value="0" aria-label="Seek" />
            <span class="mp-time" id="mp-dur">0:00</span>
          </div>

          <button type="button" class="mp-btn mp-btn--icon" data-action="shuffle" id="mp-shuffle" aria-label="Shuffle" title="Shuffle">🔀</button>
          <button type="button" class="mp-btn mp-btn--icon" data-action="repeat" id="mp-repeat" aria-label="Repeat" title="Repeat">🔁</button>

          <div class="mp-volume">
            <span aria-hidden="true" style="font-size:12px;">🔊</span>
            <input type="range" class="mp-range" id="mp-volume" min="0" max="1" step="0.01" value="${this.prefs.volume}" aria-label="Volume" />
          </div>
        </div>

        <div class="mp-dropzone" id="mp-dropzone">
          Drop audio files here or click <em>Add files…</em>
          <br /><span style="font-size:11px;">mp3 · ogg · wav · flac · m4a</span>
        </div>

        <div class="mp-queue" id="mp-queue" role="list" aria-label="Playback queue"></div>

        <div class="mp-hint">
          <kbd>Space</kbd> play/pause · <kbd>←</kbd>/<kbd>→</kbd> seek · <kbd>↑</kbd>/<kbd>↓</kbd> volume · <kbd>N</kbd>/<kbd>P</kbd> next/prev
        </div>

        <input type="file" id="mp-file" class="mp-hidden" accept="${ACCEPT}" multiple />
      </div>
    `

    this.canvas = this.container.querySelector('#mp-canvas') as HTMLCanvasElement
    this.queueEl = this.container.querySelector('#mp-queue') as HTMLElement
    this.dropzoneEl = this.container.querySelector('#mp-dropzone') as HTMLElement
    this.nowPlayingEl = this.container.querySelector('#mp-now') as HTMLElement
    this.playBtn = this.container.querySelector('#mp-play') as HTMLButtonElement
    this.seekEl = this.container.querySelector('#mp-seek') as HTMLInputElement
    this.volumeEl = this.container.querySelector('#mp-volume') as HTMLInputElement
    this.curTimeEl = this.container.querySelector('#mp-cur') as HTMLElement
    this.durTimeEl = this.container.querySelector('#mp-dur') as HTMLElement
    this.shuffleBtn = this.container.querySelector('#mp-shuffle') as HTMLButtonElement
    this.repeatBtn = this.container.querySelector('#mp-repeat') as HTMLButtonElement
  }

  // ── Bind ──────────────────────────────────────────────────────────────

  private bind(): void {
    this.container.querySelectorAll('[data-action]').forEach((el) => {
      el.addEventListener('click', () => {
        const a = (el as HTMLElement).dataset.action
        this.handleAction(a)
      })
    })

    const fileInput = this.container.querySelector('#mp-file') as HTMLInputElement
    fileInput.addEventListener('change', () => {
      const files = Array.from(fileInput.files ?? [])
      if (files.length) this.addFiles(files)
      fileInput.value = ''
    })

    // Drag-and-drop
    const dz = this.dropzoneEl
    const root = this.container.querySelector('.mp-root') as HTMLElement
    ;['dragenter', 'dragover'].forEach((ev) =>
      root.addEventListener(ev, (e) => {
        e.preventDefault()
        dz.classList.add('is-over')
      }),
    )
    ;['dragleave', 'drop'].forEach((ev) =>
      root.addEventListener(ev, (e) => {
        if (ev === 'dragleave' && e.target !== dz) return
        dz.classList.remove('is-over')
      }),
    )
    root.addEventListener('drop', (e) => {
      e.preventDefault()
      const files = Array.from((e as DragEvent).dataTransfer?.files ?? [])
      const audio = files.filter((f) => f.type.startsWith('audio/') || /\.(mp3|ogg|wav|flac|m4a|aac|opus)$/i.test(f.name))
      if (audio.length) this.addFiles(audio)
    })

    // Audio element events
    this.audio.addEventListener('loadedmetadata', () => {
      const track = this.queue[this.currentIdx]
      if (track) track.duration = this.audio.duration
      this.seekEl.max = String(this.audio.duration || 0)
      this.durTimeEl.textContent = formatTime(this.audio.duration)
      this.renderQueue()
    })
    this.audio.addEventListener('timeupdate', () => {
      if (this.isSeeking) return
      this.seekEl.value = String(this.audio.currentTime)
      this.curTimeEl.textContent = formatTime(this.audio.currentTime)
    })
    this.audio.addEventListener('ended', () => this.handleEnded())
    this.audio.addEventListener('play', () => this.updateTransport())
    this.audio.addEventListener('pause', () => this.updateTransport())
    this.audio.addEventListener('error', () => {
      const t = this.queue[this.currentIdx]
      if (t) this.nowPlayingEl.textContent = `Error loading: ${t.title}`
    })

    // Seek bar
    this.seekEl.addEventListener('input', () => { this.isSeeking = true })
    this.seekEl.addEventListener('change', () => {
      this.audio.currentTime = parseFloat(this.seekEl.value)
      this.isSeeking = false
    })

    // Volume
    this.volumeEl.addEventListener('input', () => {
      this.prefs.volume = parseFloat(this.volumeEl.value)
      this.audio.volume = this.prefs.volume
      savePrefs(this.prefs)
    })

    // Queue click (delegation)
    this.queueEl.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      const trackEl = target.closest('[data-idx]') as HTMLElement | null
      if (!trackEl) return
      const idx = parseInt(trackEl.dataset.idx || '-1', 10)
      if (idx < 0) return
      if (target.classList.contains('mp-track-remove')) {
        e.stopPropagation()
        this.removeTrack(idx)
      } else {
        this.playIndex(idx)
      }
    })

    // Drag-reorder queue
    this.queueEl.addEventListener('dragstart', (e) => {
      const trackEl = (e.target as HTMLElement).closest('[data-idx]') as HTMLElement | null
      if (!trackEl) return
      this.dragSrcIdx = parseInt(trackEl.dataset.idx || '-1', 10)
      trackEl.classList.add('is-dragging')
      ;(e as DragEvent).dataTransfer!.effectAllowed = 'move'
    })
    this.queueEl.addEventListener('dragend', () => {
      this.queueEl.querySelectorAll('.is-dragging').forEach((el) => el.classList.remove('is-dragging'))
      this.dragSrcIdx = null
    })
    this.queueEl.addEventListener('dragover', (e) => {
      e.preventDefault()
    })
    this.queueEl.addEventListener('drop', (e) => {
      e.preventDefault()
      const trackEl = (e.target as HTMLElement).closest('[data-idx]') as HTMLElement | null
      if (!trackEl || this.dragSrcIdx == null) return
      const dstIdx = parseInt(trackEl.dataset.idx || '-1', 10)
      if (dstIdx < 0 || dstIdx === this.dragSrcIdx) return
      this.reorder(this.dragSrcIdx, dstIdx)
    })

    // Keyboard
    this.container.addEventListener('keydown', this.onKey)
    this.container.tabIndex = 0
  }

  private onKey = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.isContentEditable) return
    switch (e.key) {
      case ' ':
      case 'Spacebar':
        e.preventDefault()
        this.togglePlay()
        break
      case 'ArrowLeft':
        e.preventDefault()
        this.audio.currentTime = Math.max(0, this.audio.currentTime - 5)
        break
      case 'ArrowRight':
        e.preventDefault()
        this.audio.currentTime = Math.min(this.audio.duration || 0, this.audio.currentTime + 5)
        break
      case 'ArrowUp':
        e.preventDefault()
        this.setVolume(this.prefs.volume + 0.05)
        break
      case 'ArrowDown':
        e.preventDefault()
        this.setVolume(this.prefs.volume - 0.05)
        break
      case 'n':
      case 'N':
        this.next()
        break
      case 'p':
      case 'P':
        this.prev()
        break
    }
  }

  private setVolume(v: number): void {
    this.prefs.volume = clamp(v, 0, 1)
    this.audio.volume = this.prefs.volume
    this.volumeEl.value = String(this.prefs.volume)
    savePrefs(this.prefs)
  }

  // ── Actions ───────────────────────────────────────────────────────────

  private handleAction(action: string | undefined): void {
    switch (action) {
      case 'add':
        (this.container.querySelector('#mp-file') as HTMLInputElement).click()
        break
      case 'clear':
        this.clearQueue()
        break
      case 'play':
        this.togglePlay()
        break
      case 'prev':
        this.prev()
        break
      case 'next':
        this.next()
        break
      case 'shuffle':
        this.prefs.shuffle = !this.prefs.shuffle
        this.applyShuffle()
        savePrefs(this.prefs)
        this.updateTransport()
        break
      case 'repeat':
        this.prefs.repeat =
          this.prefs.repeat === 'off' ? 'all' : this.prefs.repeat === 'all' ? 'one' : 'off'
        this.applyRepeat()
        savePrefs(this.prefs)
        this.updateTransport()
        break
    }
  }

  // ── Queue management ──────────────────────────────────────────────────

  private addFiles(files: File[]): void {
    const added: Track[] = []
    for (const f of files) {
      const url = URL.createObjectURL(f)
      const track: Track = {
        id: uid(),
        name: f.name,
        title: titleFromFilename(f.name),
        duration: 0,
        url,
      }
      this.queue.push(track)
      added.push(track)
    }
    // If any stub tracks (no URL) match by name, replace them in-place.
    this.reconcileStubs()
    this.persistQueueStub()
    this.rebuildOrder()
    this.renderQueue()
    // Auto-play first added track if nothing is loaded.
    if (this.currentIdx < 0 && added.length) {
      const idx = this.queue.indexOf(added[0])
      this.playIndex(idx)
    }
  }

  private reconcileStubs(): void {
    // For tracks restored from localStorage (no url), try to replace with
    // newly-added matching ones so the playback order is preserved.
    const stubs = this.queue.filter((t) => !t.url)
    if (!stubs.length) return
    for (const stub of stubs) {
      const match = this.queue.find((t) => t !== stub && t.url && t.name === stub.name)
      if (match) {
        const stubIdx = this.queue.indexOf(stub)
        const matchIdx = this.queue.indexOf(match)
        this.queue[stubIdx] = match
        this.queue.splice(matchIdx, 1)
      }
    }
  }

  private clearQueue(): void {
    this.audio.pause()
    for (const t of this.queue) {
      if (t.url) URL.revokeObjectURL(t.url)
    }
    this.queue = []
    this.currentIdx = -1
    this.audio.removeAttribute('src')
    this.audio.load()
    this.persistQueueStub()
    this.rebuildOrder()
    this.renderQueue()
    this.nowPlayingEl.textContent = 'No track loaded'
    this.seekEl.value = '0'
    this.seekEl.max = '0'
    this.curTimeEl.textContent = '0:00'
    this.durTimeEl.textContent = '0:00'
    this.updateTransport()
    bridge.setTitle('Music')
  }

  private removeTrack(idx: number): void {
    const t = this.queue[idx]
    if (!t) return
    if (t.url) URL.revokeObjectURL(t.url)
    const wasCurrent = idx === this.currentIdx
    this.queue.splice(idx, 1)
    if (wasCurrent) {
      this.audio.pause()
      this.currentIdx = -1
      this.audio.removeAttribute('src')
      this.nowPlayingEl.textContent = 'No track loaded'
      bridge.setTitle('Music')
    } else if (idx < this.currentIdx) {
      this.currentIdx -= 1
    }
    this.persistQueueStub()
    this.rebuildOrder()
    this.renderQueue()
  }

  private reorder(srcIdx: number, dstIdx: number): void {
    if (srcIdx < 0 || srcIdx >= this.queue.length || dstIdx < 0 || dstIdx >= this.queue.length) return
    const [moved] = this.queue.splice(srcIdx, 1)
    this.queue.splice(dstIdx, 0, moved)
    // Track current index
    if (this.currentIdx === srcIdx) this.currentIdx = dstIdx
    else if (srcIdx < this.currentIdx && dstIdx >= this.currentIdx) this.currentIdx -= 1
    else if (srcIdx > this.currentIdx && dstIdx <= this.currentIdx) this.currentIdx += 1
    this.persistQueueStub()
    this.rebuildOrder()
    this.renderQueue()
  }

  private restoreStubQueue(): void {
    const names = loadQueueStub()
    if (!names.length) {
      this.renderQueue()
      return
    }
    this.queue = names.map((name) => ({
      id: uid(),
      name,
      title: titleFromFilename(name),
      duration: 0,
      url: null,
    }))
    this.renderQueue()
  }

  private persistQueueStub(): void {
    saveQueueStub(this.queue.map((t) => t.name))
  }

  // ── Playback ──────────────────────────────────────────────────────────

  private async playIndex(idx: number): Promise<void> {
    const track = this.queue[idx]
    if (!track) return
    if (!track.url) {
      this.nowPlayingEl.textContent = `${track.title} — re-add this file to play`
      return
    }
    this.currentIdx = idx
    this.audio.src = track.url
    this.audio.currentTime = 0
    this.renderQueue()
    this.nowPlayingEl.textContent = track.title
    bridge.setTitle(`${track.title} — Music`)
    try {
      this.ensureAudioGraph()
      await this.audio.play()
    } catch (err) {
      console.warn('[music] play rejected', err)
    }
    // update shuffle order pointer
    const pos = this.playOrder.indexOf(idx)
    if (pos >= 0) this.orderPos = pos
  }

  private togglePlay(): void {
    if (!this.queue.length) return
    if (this.currentIdx < 0) {
      this.playIndex(0)
      return
    }
    if (this.audio.paused) this.audio.play().catch(() => {})
    else this.audio.pause()
  }

  private next(): void {
    if (!this.queue.length) return
    const nextIdx = this.advanceOrder(+1)
    if (nextIdx == null) {
      // end of queue, not repeating
      this.audio.pause()
      return
    }
    this.playIndex(nextIdx)
  }

  private prev(): void {
    if (!this.queue.length) return
    // If more than ~3s in, restart current instead
    if (this.audio.currentTime > 3) {
      this.audio.currentTime = 0
      return
    }
    const prevIdx = this.advanceOrder(-1)
    if (prevIdx == null) return
    this.playIndex(prevIdx)
  }

  private handleEnded(): void {
    if (this.prefs.repeat === 'one') {
      this.audio.currentTime = 0
      this.audio.play().catch(() => {})
      return
    }
    const nextIdx = this.advanceOrder(+1)
    if (nextIdx == null) {
      // reached end with repeat=off
      this.audio.pause()
      return
    }
    this.playIndex(nextIdx)
  }

  private advanceOrder(delta: number): number | null {
    if (!this.playOrder.length) return null
    const len = this.playOrder.length
    let pos = this.orderPos + delta
    if (pos >= len || pos < 0) {
      if (this.prefs.repeat === 'all') {
        pos = ((pos % len) + len) % len
      } else {
        return null
      }
    }
    this.orderPos = pos
    return this.playOrder[pos]
  }

  private rebuildOrder(): void {
    const indices = this.queue.map((_, i) => i)
    if (this.prefs.shuffle) {
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[indices[i], indices[j]] = [indices[j], indices[i]]
      }
      // If a current track exists, put it first so "next" plays something new.
      if (this.currentIdx >= 0) {
        const cur = indices.indexOf(this.currentIdx)
        if (cur > 0) {
          indices.splice(cur, 1)
          indices.unshift(this.currentIdx)
        }
      }
    }
    this.playOrder = indices
    this.orderPos = this.currentIdx >= 0 ? Math.max(0, indices.indexOf(this.currentIdx)) : 0
  }

  private applyShuffle(): void {
    this.shuffleBtn.classList.toggle('mp-btn--active', this.prefs.shuffle)
    this.shuffleBtn.setAttribute('aria-pressed', String(this.prefs.shuffle))
    this.rebuildOrder()
  }

  private applyRepeat(): void {
    const mode = this.prefs.repeat
    this.repeatBtn.classList.toggle('mp-btn--active', mode !== 'off')
    this.repeatBtn.textContent = mode === 'one' ? '🔂' : '🔁'
    this.repeatBtn.title = `Repeat: ${mode}`
    this.repeatBtn.setAttribute('aria-label', `Repeat: ${mode}`)
  }

  private updateTransport(): void {
    this.playBtn.textContent = this.audio.paused ? '▶' : '⏸'
    this.playBtn.setAttribute('aria-label', this.audio.paused ? 'Play' : 'Pause')
  }

  // ── Queue render ──────────────────────────────────────────────────────

  private renderQueue(): void {
    if (!this.queue.length) {
      this.queueEl.innerHTML = ''
      this.dropzoneEl.style.display = ''
      return
    }
    this.dropzoneEl.style.display = 'none'
    const frag = document.createDocumentFragment()
    this.queue.forEach((t, i) => {
      const el = document.createElement('div')
      el.className = 'mp-track'
      el.setAttribute('role', 'listitem')
      el.dataset.idx = String(i)
      el.draggable = true
      if (i === this.currentIdx) el.classList.add('is-current')
      if (!t.url) el.classList.add('is-missing')
      const dur = t.duration ? formatTime(t.duration) : ''
      el.innerHTML = `
        <span class="mp-track-idx">${i + 1}</span>
        <span class="mp-track-title"></span>
        <span class="mp-track-dur">${dur}</span>
        <button type="button" class="mp-track-remove" aria-label="Remove from queue" title="Remove">✕</button>
      `
      const titleEl = el.querySelector('.mp-track-title') as HTMLElement
      titleEl.textContent = t.url ? t.title : `${t.title} (re-add to play)`
      frag.appendChild(el)
    })
    this.queueEl.replaceChildren(frag)
  }

  // ── Visualizer ────────────────────────────────────────────────────────

  private ensureAudioGraph(): void {
    if (this.audioCtx) return
    try {
      const Ctx: typeof AudioContext =
        (window as unknown as { AudioContext: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
          .AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return
      this.audioCtx = new Ctx()
      this.analyser = this.audioCtx.createAnalyser()
      this.analyser.fftSize = 128
      this.sourceNode = this.audioCtx.createMediaElementSource(this.audio)
      this.sourceNode.connect(this.analyser)
      this.analyser.connect(this.audioCtx.destination)
    } catch (err) {
      console.warn('[music] audio graph failed', err)
      this.audioCtx = null
      this.analyser = null
    }
  }

  private startVisualizer(): void {
    const dpr = window.devicePixelRatio || 1
    const resize = (): void => {
      const rect = this.canvas.getBoundingClientRect()
      this.canvas.width = Math.max(1, Math.floor(rect.width * dpr))
      this.canvas.height = Math.max(1, Math.floor(rect.height * dpr))
    }
    resize()
    window.addEventListener('resize', resize)
    const ro = new ResizeObserver(resize)
    ro.observe(this.canvas)

    const ctx = this.canvas.getContext('2d')!
    const render = (): void => {
      this.rafId = requestAnimationFrame(render)
      const w = this.canvas.width
      const h = this.canvas.height
      ctx.clearRect(0, 0, w, h)

      let bars: Uint8Array | null = null
      if (this.analyser && !this.audio.paused) {
        const buf = new Uint8Array(this.analyser.frequencyBinCount)
        this.analyser.getByteFrequencyData(buf)
        bars = buf
      }

      const count = 48
      const barW = w / count
      for (let i = 0; i < count; i++) {
        let v = 0
        if (bars) {
          const srcIdx = Math.floor((i / count) * bars.length)
          v = bars[srcIdx] / 255
        } else {
          // idle pulse
          v = 0.05 + 0.03 * Math.sin(Date.now() / 600 + i * 0.3)
        }
        const barH = v * h * 0.9
        // blue→purple gradient by index
        const t = i / count
        const r = Math.round(122 + (159 - 122) * t)
        const g = Math.round(162 + (122 - 162) * t)
        const b = Math.round(247 + (234 - 247) * t)
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
        ctx.fillRect(i * barW + 1, h - barH, barW - 2, barH)
      }
    }
    render()
  }
}
