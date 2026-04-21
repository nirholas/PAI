import { initIdleDetector } from './idle.js'
import { isSessionBooted, clearAllBootFlags } from './boot.ts'
import { clearAllSessionStores } from './wm.js'

function activeSession() {
  try {
    const v = +(localStorage.getItem('pai-ws') ?? 1)
    return Number.isFinite(v) && v >= 1 && v <= 4 ? v : 1
  } catch {
    return 1
  }
}

let tickInterval
let dismissHandlers = []

function pad(n) {
  return String(n).padStart(2, '0')
}

function updateClock() {
  const el = document.getElementById('lock-time')
  if (!el) return
  const now = new Date()
  el.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

export function showLockscreen() {
  const el = document.getElementById('lockscreen')
  if (!el || !el.hidden) return

  el.hidden = false
  el.getBoundingClientRect() // force reflow
  el.classList.add('lockscreen--visible')

  updateClock()
  tickInterval = setInterval(updateClock, 1000)

  const dismiss = () => hideLockscreen()
  document.addEventListener('keydown', dismiss)
  document.addEventListener('pointerdown', dismiss)
  dismissHandlers = [
    () => document.removeEventListener('keydown', dismiss),
    () => document.removeEventListener('pointerdown', dismiss),
  ]
}

export function hideLockscreen() {
  const el = document.getElementById('lockscreen')
  if (!el || el.hidden) return

  clearInterval(tickInterval)
  dismissHandlers.forEach((fn) => fn())
  dismissHandlers = []

  el.classList.remove('lockscreen--visible')
  setTimeout(() => {
    el.hidden = true
  }, 300)
}

export async function triggerShutdown() {
  const shell = document.querySelector('.shell')
  if (shell) {
    shell.classList.add('shell--shutdown')
    await new Promise((r) => setTimeout(r, 800))
    shell.classList.add('shell--shutdown-fade')
  }
  await new Promise((r) => setTimeout(r, 700))
  clearAllBootFlags()
  clearAllSessionStores()
  location.reload()
}

export function initLockscreen() {
  window.addEventListener('pai:lock', showLockscreen)
  window.addEventListener('pai:shutdown', triggerShutdown)

  // Start idle detector only after boot completes
  const startIdle = () => initIdleDetector(showLockscreen)

  if (isSessionBooted(activeSession())) {
    startIdle()
  } else {
    window.addEventListener('pai:boot-complete', startIdle, { once: true })
  }
}
