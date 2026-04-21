// Camera — webcam app: preview, capture still, record video, filters.
//
// Loaded by [app].astro when appId === 'camera'. Permission is requested
// only after the user clicks "Enable camera" so we never fire an
// unexpected prompt on mount. Captures and recordings download locally
// via object URLs; nothing is uploaded.

import { bridge } from '../_bridge.js'

const PREF_KEY = 'pai-camera-prefs'

interface Prefs {
  mirrored: boolean
  filter: string
  deviceId: string | null
}

interface FilterPreset {
  id: string
  label: string
  css: string
}

const FILTERS: FilterPreset[] = [
  { id: 'none', label: 'None', css: 'none' },
  { id: 'gray', label: 'Grayscale', css: 'grayscale(1)' },
  { id: 'sepia', label: 'Sepia', css: 'sepia(0.8)' },
  { id: 'invert', label: 'Invert', css: 'invert(1)' },
  { id: 'contrast', label: 'Contrast', css: 'contrast(1.5) saturate(1.3)' },
  { id: 'blur', label: 'Dreamy', css: 'blur(1.5px) saturate(1.4) brightness(1.05)' },
  { id: 'noir', label: 'Noir', css: 'grayscale(1) contrast(1.4) brightness(0.9)' },
]

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREF_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Partial<Prefs>
      return {
        mirrored: p.mirrored ?? true,
        filter: typeof p.filter === 'string' ? p.filter : 'none',
        deviceId: typeof p.deviceId === 'string' ? p.deviceId : null,
      }
    }
  } catch {}
  return { mirrored: true, filter: 'none', deviceId: null }
}

function savePrefs(p: Prefs): void {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(p)) } catch {}
}

function pad2(n: number): string { return String(n).padStart(2, '0') }

function nowStamp(): string {
  const d = new Date()
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
}

function filterCssFor(id: string): string {
  return FILTERS.find((f) => f.id === id)?.css ?? 'none'
}

export class CameraApp {
  private container: HTMLElement
  private video!: HTMLVideoElement
  private stage!: HTMLElement
  private permissionPanel!: HTMLElement
  private permissionMsg!: HTMLElement
  private permissionIcon!: HTMLElement
  private recordBadge!: HTMLElement
  private deviceSelect!: HTMLSelectElement
  private photoBtn!: HTMLButtonElement
  private recBtn!: HTMLButtonElement
  private mirrorBtn!: HTMLButtonElement
  private statusEl!: HTMLElement

  private stream: MediaStream | null = null
  private recorder: MediaRecorder | null = null
  private recChunks: Blob[] = []
  private recStartTime = 0
  private recTimerId: number | null = null
  private prefs: Prefs = loadPrefs()

  constructor(container: HTMLElement) {
    this.container = container
    this.render()
    this.bind()
    this.applyFilter()
    this.applyMirror()
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="cm-root">
        <div class="cm-toolbar" role="toolbar" aria-label="Camera toolbar">
          <select class="cm-select cm-hidden" id="cm-device" aria-label="Camera device"></select>
          <button type="button" class="cm-btn cm-btn--primary" id="cm-photo" disabled>📷 Photo</button>
          <button type="button" class="cm-btn cm-btn--record" id="cm-rec" disabled>● Record</button>
          <button type="button" class="cm-btn" id="cm-mirror" aria-pressed="${this.prefs.mirrored}">Mirror</button>
          <span style="flex:1"></span>
          <button type="button" class="cm-btn" id="cm-stop" disabled>Stop camera</button>
        </div>

        <div class="cm-stage">
          <video class="cm-video cm-hidden" id="cm-video" autoplay playsinline muted></video>

          <div class="cm-permission" id="cm-permission">
            <div class="cm-permission-icon" id="cm-permission-icon" aria-hidden="true">📷</div>
            <h2 id="cm-permission-title">Enable camera</h2>
            <p id="cm-permission-msg">
              PAI never uses your webcam without permission. Click below and your browser will ask to allow access. Photos and clips stay on your device — nothing is uploaded.
            </p>
            <button type="button" class="cm-btn cm-btn--primary cm-enable-btn" id="cm-enable">Enable camera</button>
          </div>

          <div class="cm-recording-badge cm-hidden" id="cm-rec-badge" aria-live="polite">
            <span id="cm-rec-time">REC 00:00</span>
          </div>
        </div>

        <div class="cm-filters" role="group" aria-label="Filter presets">
          <span class="cm-filters-label">Filter</span>
          ${FILTERS.map(
            (f) =>
              `<button type="button" class="cm-btn" data-filter="${f.id}" aria-pressed="${
                this.prefs.filter === f.id
              }">${f.label}</button>`,
          ).join('')}
        </div>

        <div class="cm-status" role="status" aria-live="polite" id="cm-status">Camera is off.</div>
      </div>
    `
    this.video = this.container.querySelector('#cm-video') as HTMLVideoElement
    this.stage = this.container.querySelector('.cm-stage') as HTMLElement
    this.permissionPanel = this.container.querySelector('#cm-permission') as HTMLElement
    this.permissionMsg = this.container.querySelector('#cm-permission-msg') as HTMLElement
    this.permissionIcon = this.container.querySelector('#cm-permission-icon') as HTMLElement
    this.recordBadge = this.container.querySelector('#cm-rec-badge') as HTMLElement
    this.deviceSelect = this.container.querySelector('#cm-device') as HTMLSelectElement
    this.photoBtn = this.container.querySelector('#cm-photo') as HTMLButtonElement
    this.recBtn = this.container.querySelector('#cm-rec') as HTMLButtonElement
    this.mirrorBtn = this.container.querySelector('#cm-mirror') as HTMLButtonElement
    this.statusEl = this.container.querySelector('#cm-status') as HTMLElement
  }

  private bind(): void {
    this.container.querySelector('#cm-enable')!.addEventListener('click', () => this.enable())
    this.photoBtn.addEventListener('click', () => this.capturePhoto())
    this.recBtn.addEventListener('click', () => this.toggleRecord())
    this.mirrorBtn.addEventListener('click', () => this.toggleMirror())
    this.container.querySelector('#cm-stop')!.addEventListener('click', () => this.stopCamera())

    this.deviceSelect.addEventListener('change', () => {
      this.prefs.deviceId = this.deviceSelect.value || null
      savePrefs(this.prefs)
      this.startStream(this.deviceSelect.value).catch((err) => this.handleError(err))
    })

    this.container.querySelectorAll('[data-filter]').forEach((el) => {
      el.addEventListener('click', () => {
        const id = (el as HTMLElement).dataset.filter!
        this.prefs.filter = id
        savePrefs(this.prefs)
        this.applyFilter()
      })
    })

    // Cleanup if the iframe unloads
    window.addEventListener('pagehide', () => this.stopCamera())
  }

  // ── Permission & stream ───────────────────────────────────────────────

  private async enable(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.showDenied('Your browser does not support camera access.')
      return
    }
    this.setStatus('Requesting camera access…')
    try {
      // Kick permission with a broad request; refine to specific device afterwards.
      const constraints: MediaStreamConstraints = this.prefs.deviceId
        ? { video: { deviceId: { exact: this.prefs.deviceId } }, audio: true }
        : { video: true, audio: true }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      this.attachStream(stream)
      await this.populateDevices()
    } catch (err) {
      // Try again without audio if we were denied because of that
      if ((err as DOMException).name === 'NotFoundError' || (err as DOMException).name === 'OverconstrainedError') {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true })
          this.attachStream(stream)
          await this.populateDevices()
          this.setStatus('Camera ready (no microphone).')
          return
        } catch (err2) {
          this.handleError(err2 as Error)
          return
        }
      }
      this.handleError(err as Error)
    }
  }

  private async startStream(deviceId: string | null): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) return
    this.stopTracks()
    try {
      const constraints: MediaStreamConstraints = deviceId
        ? { video: { deviceId: { exact: deviceId } }, audio: true }
        : { video: true, audio: true }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      this.attachStream(stream)
    } catch (err) {
      this.handleError(err as Error)
    }
  }

  private attachStream(stream: MediaStream): void {
    this.stream = stream
    this.video.srcObject = stream
    this.video.classList.remove('cm-hidden')
    this.permissionPanel.classList.add('cm-hidden')
    this.photoBtn.disabled = false
    this.recBtn.disabled = false
    ;(this.container.querySelector('#cm-stop') as HTMLButtonElement).disabled = false
    const track = stream.getVideoTracks()[0]
    const label = track?.label || 'camera'
    this.setStatus(`Live: ${label}`)
    bridge.setTitle(`Camera — ${label.slice(0, 40)}`)
  }

  private stopTracks(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop()
      this.stream = null
    }
  }

  private stopCamera(): void {
    this.stopRecord(false)
    this.stopTracks()
    this.video.srcObject = null
    this.video.classList.add('cm-hidden')
    this.permissionPanel.classList.remove('cm-hidden')
    this.photoBtn.disabled = true
    this.recBtn.disabled = true
    ;(this.container.querySelector('#cm-stop') as HTMLButtonElement).disabled = true
    this.setStatus('Camera stopped.')
    bridge.setTitle('Camera')
  }

  private async populateDevices(): Promise<void> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const cams = devices.filter((d) => d.kind === 'videoinput')
      this.deviceSelect.innerHTML = ''
      for (const d of cams) {
        const opt = document.createElement('option')
        opt.value = d.deviceId
        opt.textContent = d.label || `Camera ${this.deviceSelect.options.length + 1}`
        this.deviceSelect.appendChild(opt)
      }
      if (cams.length > 1) this.deviceSelect.classList.remove('cm-hidden')
      else this.deviceSelect.classList.add('cm-hidden')
      // Select current
      const curId = this.stream?.getVideoTracks()[0]?.getSettings().deviceId
      if (curId) this.deviceSelect.value = curId
    } catch (err) {
      console.warn('[camera] enumerateDevices failed', err)
    }
  }

  private handleError(err: Error | unknown): void {
    const name = (err as DOMException).name
    const message = (err as Error).message || String(err)
    console.warn('[camera] error', err)
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      this.showDenied(
        'Camera access was denied. To enable, open your browser site settings for this page and allow camera access, then click Enable camera again.',
      )
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      this.showDenied('No webcam was found. Connect a camera and try again.')
    } else if (name === 'NotReadableError') {
      this.showDenied('The camera is in use by another app. Close the other app and try again.')
    } else {
      this.showDenied(`Couldn't start camera: ${message}`)
    }
  }

  private showDenied(msg: string): void {
    this.stopTracks()
    this.video.classList.add('cm-hidden')
    this.permissionPanel.classList.remove('cm-hidden')
    this.permissionPanel.classList.add('is-denied')
    this.permissionIcon.textContent = '⚠'
    ;(this.container.querySelector('#cm-permission-title') as HTMLElement).textContent =
      'Camera unavailable'
    this.permissionMsg.textContent = msg
    ;(this.container.querySelector('#cm-enable') as HTMLElement).textContent = 'Try again'
    this.setStatus(msg)
    this.photoBtn.disabled = true
    this.recBtn.disabled = true
  }

  // ── Mirror & filters ─────────────────────────────────────────────────

  private applyFilter(): void {
    this.video.style.filter = filterCssFor(this.prefs.filter)
    this.container.querySelectorAll('[data-filter]').forEach((el) => {
      const active = (el as HTMLElement).dataset.filter === this.prefs.filter
      el.classList.toggle('cm-btn--active', active)
      el.setAttribute('aria-pressed', String(active))
    })
  }

  private applyMirror(): void {
    this.video.classList.toggle('is-mirrored', this.prefs.mirrored)
    this.mirrorBtn.classList.toggle('cm-btn--active', this.prefs.mirrored)
    this.mirrorBtn.setAttribute('aria-pressed', String(this.prefs.mirrored))
  }

  private toggleMirror(): void {
    this.prefs.mirrored = !this.prefs.mirrored
    savePrefs(this.prefs)
    this.applyMirror()
  }

  // ── Capture ──────────────────────────────────────────────────────────

  private capturePhoto(): void {
    if (!this.stream) return
    const track = this.stream.getVideoTracks()[0]
    if (!track) return
    const { videoWidth, videoHeight } = this.video
    if (!videoWidth || !videoHeight) {
      this.setStatus('Video not ready yet — try again in a second.')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = videoWidth
    canvas.height = videoHeight
    const ctx = canvas.getContext('2d')!
    if (this.prefs.mirrored) {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.filter = filterCssFor(this.prefs.filter)
    ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (!blob) {
        this.setStatus('Capture failed.')
        return
      }
      const filename = `pai-photo-${nowStamp()}.png`
      this.download(blob, filename)
      this.setStatus(`Saved ${filename}`)
    }, 'image/png')
  }

  private toggleRecord(): void {
    if (!this.stream) return
    if (this.recorder && this.recorder.state !== 'inactive') {
      this.stopRecord(true)
    } else {
      this.startRecord()
    }
  }

  private startRecord(): void {
    if (!this.stream) return
    // Prefer vp9, fall back.
    const candidates = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ]
    let mimeType = ''
    for (const c of candidates) {
      if ((window as unknown as { MediaRecorder: typeof MediaRecorder }).MediaRecorder &&
          MediaRecorder.isTypeSupported?.(c)) {
        mimeType = c
        break
      }
    }
    try {
      this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined)
    } catch (err) {
      this.setStatus(`Recording not supported: ${String((err as Error).message)}`)
      return
    }
    this.recChunks = []
    this.recorder.ondataavailable = (e) => {
      if (e.data.size) this.recChunks.push(e.data)
    }
    this.recorder.onstop = () => {
      const blob = new Blob(this.recChunks, { type: mimeType || 'video/webm' })
      const filename = `pai-video-${nowStamp()}.webm`
      if (blob.size > 0) {
        this.download(blob, filename)
        this.setStatus(`Saved ${filename} (${(blob.size / 1024 / 1024).toFixed(1)} MB)`)
      }
    }
    try {
      this.recorder.start(1000)
    } catch (err) {
      this.setStatus(`Couldn't start recording: ${String((err as Error).message)}`)
      return
    }
    this.recStartTime = Date.now()
    this.recordBadge.classList.remove('cm-hidden')
    this.recBtn.textContent = '■ Stop'
    this.recTimerId = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.recStartTime) / 1000)
      const mm = pad2(Math.floor(elapsed / 60))
      const ss = pad2(elapsed % 60)
      const timeEl = this.container.querySelector('#cm-rec-time') as HTMLElement
      if (timeEl) timeEl.textContent = `REC ${mm}:${ss}`
    }, 500)
    this.setStatus('Recording…')
    bridge.setDirty?.(true)
  }

  private stopRecord(finalise: boolean): void {
    if (this.recTimerId != null) {
      clearInterval(this.recTimerId)
      this.recTimerId = null
    }
    this.recordBadge.classList.add('cm-hidden')
    this.recBtn.textContent = '● Record'
    bridge.setDirty?.(false)
    if (!this.recorder) return
    try {
      if (this.recorder.state !== 'inactive') {
        if (finalise) this.recorder.stop()
        else this.recorder.stop()
      }
    } catch {}
    this.recorder = null
  }

  private download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  private setStatus(msg: string): void {
    this.statusEl.textContent = msg
  }
}
