// App-side postMessage bridge. Import in any /apps/* page to talk to the shell.
// All methods are no-ops when running standalone (window.self === window.top).
// CLIENT-ONLY — never import in Astro frontmatter.

const ORIGIN = window.location.origin
const inShell = window.self !== window.top

/** @type {Map<string, Set<Function>>} */
const listeners = new Map()

let _windowId = null
let _appId = null

function send(type, payload = {}) {
  if (!inShell) return
  window.parent.postMessage(
    {
      v: 1,
      source: 'pai-app',
      type,
      payload,
      appId: _appId,
      windowId: _windowId,
    },
    ORIGIN,
  )
}

function onMessage(event) {
  if (event.origin !== ORIGIN) return
  const msg = event.data
  if (!msg || msg.v !== 1 || msg.source !== 'pai-shell') return
  // Capture routing IDs from first message
  if (msg.windowId && !_windowId) _windowId = msg.windowId
  if (msg.appId && !_appId) _appId = msg.appId
  const fns = listeners.get(msg.type)
  if (fns) for (const fn of fns) fn(msg.payload ?? {})
}

if (inShell) {
  window.addEventListener('message', onMessage)
}

export const bridge = {
  /** Announce to the shell that this app is loaded and ready. */
  ready() {
    send('ready', {})
  },

  /** Update the window title bar in the shell. */
  setTitle(title) {
    send('set-title', { title })
  },

  /** Override the window icon shown in the shell (rarely needed). */
  setIcon(href) {
    send('set-icon', { href })
  },

  /** Ask the shell to open another registered app. */
  openApp(id, params = {}) {
    send('open-app', { id, params })
  },

  /** Ask the shell to close this window. */
  close() {
    send('close', {})
  },

  /** Show/hide unsaved-changes indicator in the shell window title bar. */
  setDirty(dirty) {
    send('set-dirty', { dirty })
  },

  /** Forward a console message to the shell dev panel. */
  log(...args) {
    send('log', { args: args.map(String) })
  },

  /**
   * Subscribe to a shell event (e.g. 'theme-change', 'resize', 'visibility', 'params-change').
   * @param {string} type
   * @param {(payload: object) => void} fn
   * @returns {() => void} unsubscribe
   */
  on(type, fn) {
    if (!listeners.has(type)) listeners.set(type, new Set())
    listeners.get(type).add(fn)
    return () => listeners.get(type)?.delete(fn)
  },

  /** True when running inside a shell iframe; false in standalone/direct-URL mode. */
  get inShell() {
    return inShell
  },
}
