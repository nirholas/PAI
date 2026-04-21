// Synthesised UI sounds — boot chime + soft tick. No audio files.
//
// Browsers block AudioContext until a user gesture, so the boot chime will
// often be silent on a first, clean page load. Ticks fire from click handlers,
// which always carry a gesture, so they always play once sound is enabled.

const STORAGE_KEY = 'pai-sound-muted'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = readInitialMuted()
const listeners = new Set<(muted: boolean) => void>()

function readInitialMuted(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'true') return true
    if (stored === 'false') return false
  } catch {
    /* localStorage unavailable */
  }
  // First visit: honour reduced-motion as a reduced-audio signal too.
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function getCtx(): AudioContext | null {
  if (muted) return null
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    return ctx
  }
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!Ctor) return null
  try {
    ctx = new Ctor()
  } catch {
    return null
  }
  master = ctx.createGain()
  master.gain.value = 0.7
  master.connect(ctx.destination)
  return ctx
}

// Resume the context on the first user gesture (covers autoplay policy).
function primeOnGesture(): void {
  const prime = (): void => {
    getCtx()
      ?.resume()
      .catch(() => {})
  }
  window.addEventListener('pointerdown', prime, { once: true, capture: true })
  window.addEventListener('keydown', prime, { once: true, capture: true })
}

if (typeof window !== 'undefined') primeOnGesture()

export function isMuted(): boolean {
  return muted
}

export function setMuted(next: boolean): void {
  muted = next
  try {
    localStorage.setItem(STORAGE_KEY, next ? 'true' : 'false')
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn(next))
}

export function toggleMuted(): boolean {
  setMuted(!muted)
  return muted
}

export function onMuteChange(fn: (muted: boolean) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function playChimeNow(c: AudioContext): void {
  if (!master) return
  const now = c.currentTime
  const tones = [
    { freq: 523.25, start: 0.0, dur: 0.5, peak: 0.06 }, // C5
    { freq: 783.99, start: 0.12, dur: 0.45, peak: 0.05 }, // G5
  ]
  for (const t of tones) {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = t.freq
    gain.gain.setValueAtTime(0, now + t.start)
    gain.gain.linearRampToValueAtTime(t.peak, now + t.start + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + t.start + t.dur)
    osc.connect(gain)
    gain.connect(master)
    osc.start(now + t.start)
    osc.stop(now + t.start + t.dur + 0.02)
  }
}

// Short synth chime: C5 → G5, soft sine pad. ~500ms.
// If the AudioContext is suspended (no gesture yet), queue on resume.
export function bootChime(): void {
  const c = getCtx()
  if (!c || !master) return
  if (c.state === 'running') {
    playChimeNow(c)
    return
  }
  const onState = (): void => {
    if (c.state === 'running') {
      c.removeEventListener('statechange', onState)
      playChimeNow(c)
    }
  }
  c.addEventListener('statechange', onState)
}

// ─── Extended UI sound palette ───────────────────────────────────────────────
// Each helper is a short synth voicing — all WebAudio, no samples. Gain levels
// are kept low so layered clicks don't fatigue. All are no-ops when muted or
// when the AudioContext is unavailable.

function _tone(
  c: AudioContext,
  master: GainNode,
  opts: {
    freq: number
    start?: number
    dur: number
    peak?: number
    type?: OscillatorType
    glide?: number
  },
): void {
  const now = c.currentTime + (opts.start ?? 0)
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = opts.type ?? 'sine'
  osc.frequency.setValueAtTime(opts.freq, now)
  if (opts.glide !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(1, opts.glide),
      now + opts.dur,
    )
  }
  const peak = opts.peak ?? 0.04
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(peak, now + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + opts.dur)
  osc.connect(gain)
  gain.connect(master)
  osc.start(now)
  osc.stop(now + opts.dur + 0.02)
}

function _withCtx(fn: (c: AudioContext, m: GainNode) => void): void {
  const c = getCtx()
  if (!c || !master) return
  fn(c, master)
}

// Window open — low→mid rising blip.
export function open(): void {
  _withCtx((c, m) => {
    _tone(c, m, { freq: 420, dur: 0.16, peak: 0.04, glide: 660 })
  })
}

// Window close — mid→low falling blip.
export function close(): void {
  _withCtx((c, m) => {
    _tone(c, m, { freq: 560, dur: 0.14, peak: 0.035, glide: 280 })
  })
}

// Error — soft dissonant double beep.
export function error(): void {
  _withCtx((c, m) => {
    _tone(c, m, { freq: 240, dur: 0.14, peak: 0.05, type: 'triangle' })
    _tone(c, m, {
      freq: 200,
      start: 0.12,
      dur: 0.18,
      peak: 0.05,
      type: 'triangle',
    })
  })
}

// Notification — two-note ping, like a soft chime.
export function notify(): void {
  _withCtx((c, m) => {
    _tone(c, m, { freq: 880, dur: 0.22, peak: 0.04 })
    _tone(c, m, { freq: 1320, start: 0.09, dur: 0.3, peak: 0.035 })
  })
}

// Lock — descending three-note click-chord.
export function lock(): void {
  _withCtx((c, m) => {
    _tone(c, m, { freq: 520, dur: 0.12, peak: 0.04, type: 'triangle' })
    _tone(c, m, {
      freq: 392,
      start: 0.08,
      dur: 0.16,
      peak: 0.04,
      type: 'triangle',
    })
  })
}

// Unlock — ascending two-note.
export function unlock(): void {
  _withCtx((c, m) => {
    _tone(c, m, { freq: 392, dur: 0.12, peak: 0.04, type: 'triangle' })
    _tone(c, m, {
      freq: 588,
      start: 0.08,
      dur: 0.18,
      peak: 0.04,
      type: 'triangle',
    })
  })
}

// Soft wooden tick — brief band-passed noise burst, not a mouse click.
export function tick(): void {
  const c = getCtx()
  if (!c || !master) return
  const now = c.currentTime
  const dur = 0.035

  // Noise source for the attack transient.
  const bufferSize = Math.max(1, Math.floor(c.sampleRate * dur))
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
  }
  const noise = c.createBufferSource()
  noise.buffer = buffer

  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 2200
  bp.Q.value = 6

  const noiseGain = c.createGain()
  noiseGain.gain.setValueAtTime(0.05, now)
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + dur)

  noise.connect(bp)
  bp.connect(noiseGain)
  noiseGain.connect(master)
  noise.start(now)
  noise.stop(now + dur)

  // Tiny sine ping at 1600Hz gives the tick a pitched wooden character.
  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = 1600
  const oscGain = c.createGain()
  oscGain.gain.setValueAtTime(0.025, now)
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045)
  osc.connect(oscGain)
  oscGain.connect(master)
  osc.start(now)
  osc.stop(now + 0.05)
}
