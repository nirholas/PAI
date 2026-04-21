// PAI — Popout helper.
//
// Opens the focused window's app URL in a fresh standalone browser window and
// closes the in-shell window. Used by the titlebar popout button and by the
// window titlebar context menu.

import { wm } from './wm.js'
import { APPS, appUrl } from './apps.js'

type WindowState = {
  id: string
  appId: string
  title: string
  w: number
  h: number
  iframe?: HTMLIFrameElement | null
}

type WmInternal = typeof wm & {
  getFocused: () => WindowState | null
  list: () => Array<{ id: string; appId: string; title: string }>
}

const DEFAULT_W = 900
const DEFAULT_H = 640

/**
 * Popout a window by id. If no id given, pops out the focused window.
 * Returns true if the popout opened.
 */
export function popoutWindow(id?: string): boolean {
  const ref = id
    ? findById(id)
    : (wm as WmInternal).getFocused?.()
  if (!ref) return false

  const app = (APPS as Record<string, { title?: string; default?: { w?: number; h?: number } }>)[ref.appId]
  const width = ref.w ?? app?.default?.w ?? DEFAULT_W
  const height = ref.h ?? app?.default?.h ?? DEFAULT_H
  const left = Math.max(0, window.screenX + 40)
  const top = Math.max(0, window.screenY + 40)

  const url = appUrl(ref.appId)
  const features = `popup=yes,width=${width},height=${height},left=${left},top=${top}`
  const win = window.open(url, `pai-popout-${ref.id}`, features)

  if (!win) {
    // Popup blocked — fall back to a new tab.
    window.open(url, '_blank', 'noopener,noreferrer')
    return false
  }

  // Title hint for the popped-out window.
  try {
    win.addEventListener?.('load', () => {
      try {
        win.document.title = ref.title ?? app?.title ?? ref.appId
      } catch {
        /* cross-origin — ignore */
      }
    })
  } catch {
    /* ignore */
  }

  // Close the in-shell window now that the popout is open.
  wm.close(ref.id)
  return true
}

function findById(id: string): WindowState | null {
  const list = (wm as WmInternal).list?.() ?? []
  const found = list.find((w) => w.id === id)
  if (!found) return null
  // list() doesn't expose geometry; fall back to defaults.
  return {
    id: found.id,
    appId: found.appId,
    title: found.title,
    w: DEFAULT_W,
    h: DEFAULT_H,
  }
}

if (typeof window !== 'undefined') {
  ;(window as unknown as { __popout: typeof popoutWindow }).__popout = popoutWindow
}
