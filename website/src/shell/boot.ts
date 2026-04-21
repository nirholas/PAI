import { bootChime, tick } from './sound.ts'

const INIT_LINES = [
  '[  OK  ] Started systemd.',
  '[  OK  ] Reached target Network.',
  '[  OK  ] Started Ollama.',
  '[  OK  ] Started Open WebUI.',
  '[  OK  ] Reached target Graphical Interface.',
]

const SESSIONS = [1, 2, 3, 4] as const

function bootKey(session: number): string {
  return `pai-booted-${session}`
}

export function isSessionBooted(session: number): boolean {
  try {
    return localStorage.getItem(bootKey(session)) === '1'
  } catch {
    return false
  }
}

function markSessionBooted(session: number): void {
  try {
    localStorage.setItem(bootKey(session), '1')
  } catch {}
}

export function clearAllBootFlags(): void {
  try {
    for (const n of SESSIONS) localStorage.removeItem(bootKey(n))
  } catch {}
}

function getActiveSession(): number {
  try {
    const v = +(localStorage.getItem('pai-ws') ?? 1)
    return Number.isFinite(v) && v >= 1 && v <= 4 ? v : 1
  } catch {
    return 1
  }
}

function shouldSkipBoot(session: number): boolean {
  if (isSessionBooted(session)) return true
  if (new URLSearchParams(location.search).get('noboot') === '1') return true
  if (location.hash.startsWith('#app=')) return true
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true
  if (document.documentElement.hasAttribute('data-reduced-motion')) return true
  return false
}

function showShell(): void {
  document.querySelector('.shell__topbar')?.classList.remove('shell--boot-top')
  document.querySelector('.shell__dock')?.classList.remove('shell--boot-bottom')
}

function hideShell(): void {
  document.querySelector('.shell__topbar')?.classList.add('shell--boot-top')
  document.querySelector('.shell__dock')?.classList.add('shell--boot-bottom')
}

function hideSplash(splash: HTMLElement): void {
  splash.classList.add('boot-splash--hidden')
}

function resetSplash(splash: HTMLElement): void {
  splash.classList.remove('boot-splash--hidden')
  document.getElementById('boot-logo')?.classList.remove('boot-logo--in')
  document.getElementById('boot-spinner')?.classList.remove('boot-spinner--in')
  const initEl = document.getElementById('boot-init')
  if (initEl) {
    initEl.classList.remove('boot-init--in')
    initEl.innerHTML = ''
  }
}

export async function playBootSequence(session?: number): Promise<void> {
  const s = session ?? getActiveSession()
  const splash = document.getElementById('boot-splash')

  if (shouldSkipBoot(s)) {
    if (splash) hideSplash(splash)
    markSessionBooted(s)
    return
  }

  if (!splash) {
    markSessionBooted(s)
    return
  }

  resetSplash(splash)
  hideShell()

  let skipped = false

  await new Promise<void>((resolve) => {
    const skip = (): void => {
      if (skipped) return
      skipped = true
      document.removeEventListener('keydown', skip)
      document.removeEventListener('pointerdown', skip)
      showShell()
      hideSplash(splash)
      resolve()
    }

    document.addEventListener('keydown', skip)
    document.addEventListener('pointerdown', skip)

    const delay = (ms: number): Promise<void> =>
      new Promise((r) => setTimeout(r, ms))

    async function animate(): Promise<void> {
      // 0.1s — logo fades in
      await delay(100)
      document.getElementById('boot-logo')?.classList.add('boot-logo--in')
      bootChime()

      // 0.4s — spinner
      await delay(300)
      if (skipped) return
      document.getElementById('boot-spinner')?.classList.add('boot-spinner--in')

      // 0.8s — init lines stream in
      await delay(400)
      if (skipped) return
      const initEl = document.getElementById('boot-init')
      if (initEl) {
        initEl.classList.add('boot-init--in')
        for (const line of INIT_LINES) {
          if (skipped) return
          const p = document.createElement('p')
          p.textContent = line
          initEl.appendChild(p)
          tick()
          await delay(80 + Math.random() * 40)
        }
      }

      // ~1.6s — fade to desktop
      await delay(200)
      if (!skipped) {
        showShell()
        hideSplash(splash)
        resolve()
      }
    }

    animate()
  })

  markSessionBooted(s)
  window.dispatchEvent(
    new CustomEvent('pai:boot-complete', { detail: { session: s } }),
  )

  // Fire the welcome tour on first boot only.
  try {
    const { hasTourRun, startTour } = await import('./welcome-tour.ts')
    if (!hasTourRun()) setTimeout(() => startTour(), 400)
  } catch {}
}
