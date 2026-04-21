const RESET_EVENTS = ['mousemove', 'keydown', 'pointerdown', 'touchstart', 'scroll']

export function initIdleDetector(onIdle) {
  const params = new URLSearchParams(location.search)
  const idleParam = params.get('idle')
  const timeoutMs = idleParam ? parseInt(idleParam, 10) * 1000 : 10 * 60 * 1000

  let timer

  const reset = () => {
    clearTimeout(timer)
    timer = setTimeout(onIdle, timeoutMs)
  }

  const onVisibility = () => {
    if (document.visibilityState === 'visible') reset()
  }

  RESET_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }))
  document.addEventListener('visibilitychange', onVisibility)

  reset()

  return () => {
    clearTimeout(timer)
    RESET_EVENTS.forEach((e) => window.removeEventListener(e, reset))
    document.removeEventListener('visibilitychange', onVisibility)
  }
}
