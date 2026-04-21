// Shell-side handler for app-initiated permission requests.
// Apps send: { type: 'request-permission', payload: { name, reason, reqId } }
// Shell replies: { type: 'permission-result', payload: { reqId, granted } }

import { shellBridge } from './bridge.js'
import { permissions, type PermissionName } from './permissions.ts'

function findIframeForWindow(windowId?: string): HTMLIFrameElement | null {
  if (!windowId) return null
  const el = document.getElementById(windowId)
  if (!el) return null
  return el.querySelector<HTMLIFrameElement>('iframe') ?? null
}

shellBridge.on('request-permission', async (msg: any) => {
  const payload = msg?.payload ?? {}
  const name = payload.name as PermissionName
  const reason = typeof payload.reason === 'string' ? payload.reason : ''
  const reqId = payload.reqId

  const valid: PermissionName[] = [
    'camera',
    'microphone',
    'filesystem',
    'notifications',
  ]
  let granted = false
  if (valid.includes(name)) {
    granted = await permissions.request(name, reason || `Grant ${name}?`)
  }

  const iframe = findIframeForWindow(msg.windowId)
  if (iframe) {
    shellBridge.send(
      iframe,
      'permission-result',
      { reqId, granted },
      { appId: msg.appId, windowId: msg.windowId },
    )
  }
})

// Re-export so apps/modules can call permissions.request directly inside shell.
export { permissions }
