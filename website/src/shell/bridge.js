// Shell-side postMessage bridge.
// Validates messages from app iframes and provides an API for the WM to
// communicate with apps. Only runs in browser context.

const ORIGIN = typeof window !== 'undefined' ? window.location.origin : ''

/** @type {Map<string, Set<Function>>} */
const handlers = new Map()

function dispatch(msg) {
  const fns = handlers.get(msg.type)
  if (fns) for (const fn of fns) fn(msg)
}

function onMessage(event) {
  if (event.origin !== ORIGIN) return
  const msg = event.data
  if (!msg || msg.v !== 1 || msg.source !== 'pai-app') return
  dispatch(msg)
}

if (typeof window !== 'undefined') {
  window.addEventListener('message', onMessage)
}

export const shellBridge = {
  /**
   * Listen for a message type sent by any app iframe.
   * @param {string} type
   * @param {(msg: {type:string, payload:object, appId:string, windowId:string}) => void} fn
   * @returns {() => void} unsubscribe
   */
  on(type, fn) {
    if (!handlers.has(type)) handlers.set(type, new Set())
    handlers.get(type).add(fn)
    return () => handlers.get(type)?.delete(fn)
  },

  /**
   * Send a typed message to a specific app iframe.
   * @param {HTMLIFrameElement} iframe
   * @param {string} type
   * @param {object} payload
   * @param {{ appId?: string, windowId?: string }} opts
   */
  send(iframe, type, payload = {}, { appId, windowId } = {}) {
    if (!iframe?.contentWindow) return
    iframe.contentWindow.postMessage(
      { v: 1, source: 'pai-shell', type, payload, appId, windowId },
      ORIGIN,
    )
  },
}
