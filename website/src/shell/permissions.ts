// PAI Permissions — shell-side modal prompt + persistence.
// Apps request permissions via bridge; the shell shows a modal over the UI.
// Decisions persist keyed by `pai-perm-<name>` with values:
//   'allow-once' (not persisted beyond session), 'allow-always', 'deny'.

export type PermissionName =
  | 'camera'
  | 'microphone'
  | 'filesystem'
  | 'notifications'

export type PermissionDecision = 'allow-once' | 'allow-always' | 'deny'

const LS_PREFIX = 'pai-perm-'

const PERMISSION_META: Record<
  PermissionName,
  { label: string; icon: string; risk: 'low' | 'medium' | 'high' }
> = {
  camera: { label: 'Camera', icon: 'camera', risk: 'high' },
  microphone: { label: 'Microphone', icon: 'microphone', risk: 'high' },
  filesystem: { label: 'File System', icon: 'folder', risk: 'medium' },
  notifications: { label: 'Notifications', icon: 'bell', risk: 'low' },
}

// Icon SVG snippets — inline so no asset pipeline is required.
const ICONS: Record<string, string> = {
  camera: `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  microphone: `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`,
  folder: `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
}

function storageKey(name: PermissionName): string {
  return `${LS_PREFIX}${name}`
}

function readPersisted(name: PermissionName): PermissionDecision | null {
  try {
    const v = localStorage.getItem(storageKey(name))
    if (v === 'allow-always' || v === 'deny') return v
    return null
  } catch {
    return null
  }
}

function writePersisted(name: PermissionName, decision: 'allow-always' | 'deny'): void {
  try {
    localStorage.setItem(storageKey(name), decision)
  } catch {}
}

function injectStyles(): void {
  if (document.getElementById('pai-perm-styles')) return
  const style = document.createElement('style')
  style.id = 'pai-perm-styles'
  style.textContent = `
    .pai-perm-overlay {
      position: fixed; inset: 0; z-index: var(--z-modal, 50);
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
      animation: pai-perm-fade 140ms ease-out;
    }
    @keyframes pai-perm-fade { from { opacity: 0; } to { opacity: 1; } }
    .pai-perm-card {
      background: var(--bg-elev, #1a1a2e);
      border: 1px solid var(--border, #2a2a3e);
      border-radius: var(--r-window, 8px);
      width: min(420px, 92vw);
      padding: var(--s-5, 24px);
      color: var(--fg, #e0e0e0);
      font-family: var(--font-ui, system-ui, sans-serif);
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    .pai-perm-head {
      display: flex; align-items: center; gap: var(--s-3, 12px);
      margin-bottom: var(--s-3, 12px);
    }
    .pai-perm-icon {
      width: 48px; height: 48px; flex-shrink: 0;
      border-radius: 50%;
      background: color-mix(in srgb, var(--pai-blue, #7aa2f7) 18%, transparent);
      color: var(--pai-blue, #7aa2f7);
      display: flex; align-items: center; justify-content: center;
    }
    .pai-perm-title {
      font-size: 1rem; font-weight: 600; margin: 0 0 2px;
    }
    .pai-perm-sub {
      font-size: 0.8125rem; color: var(--fg-muted, #888);
    }
    .pai-perm-reason {
      background: var(--bg, #0f0f1a);
      border: 1px solid var(--border, #2a2a3e);
      border-radius: var(--r-icon, 6px);
      padding: var(--s-3, 12px);
      font-size: 0.875rem;
      line-height: 1.45;
      margin: var(--s-3, 12px) 0 var(--s-4, 16px);
      color: var(--fg, #e0e0e0);
    }
    .pai-perm-actions {
      display: flex; flex-direction: column; gap: var(--s-2, 8px);
    }
    .pai-perm-btn {
      appearance: none; border: 1px solid var(--border, #2a2a3e);
      background: var(--bg, #0f0f1a); color: var(--fg, #e0e0e0);
      border-radius: var(--r-icon, 6px);
      padding: var(--s-2, 8px) var(--s-4, 16px);
      font-size: 0.875rem; font-family: inherit;
      cursor: pointer; text-align: center;
      transition: background 120ms, border-color 120ms;
    }
    .pai-perm-btn:hover { background: rgba(255,255,255,0.04); }
    .pai-perm-btn:focus-visible {
      outline: 2px solid var(--pai-blue, #7aa2f7); outline-offset: 2px;
    }
    .pai-perm-btn--primary {
      background: var(--pai-blue, #7aa2f7); color: #0f0f1a;
      border-color: var(--pai-blue, #7aa2f7); font-weight: 600;
    }
    .pai-perm-btn--primary:hover {
      background: color-mix(in srgb, var(--pai-blue, #7aa2f7) 85%, #fff);
    }
    .pai-perm-btn--danger { color: var(--pai-red, #f87171); }
  `
  document.head.appendChild(style)
}

function promptUser(
  name: PermissionName,
  reason: string,
): Promise<PermissionDecision> {
  injectStyles()

  return new Promise((resolve) => {
    const meta = PERMISSION_META[name]
    const overlay = document.createElement('div')
    overlay.className = 'pai-perm-overlay'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.setAttribute('aria-labelledby', 'pai-perm-title')

    overlay.innerHTML = `
      <div class="pai-perm-card">
        <div class="pai-perm-head">
          <div class="pai-perm-icon" aria-hidden="true">${ICONS[meta.icon] ?? ''}</div>
          <div>
            <h2 class="pai-perm-title" id="pai-perm-title">Allow ${meta.label} access?</h2>
            <div class="pai-perm-sub">Risk: ${meta.risk}</div>
          </div>
        </div>
        <div class="pai-perm-reason">${escapeHtml(reason)}</div>
        <div class="pai-perm-actions">
          <button class="pai-perm-btn pai-perm-btn--primary" data-choice="allow-always">Always allow</button>
          <button class="pai-perm-btn" data-choice="allow-once">Allow once</button>
          <button class="pai-perm-btn pai-perm-btn--danger" data-choice="deny">Deny</button>
        </div>
      </div>
    `

    const close = (decision: PermissionDecision): void => {
      overlay.remove()
      document.removeEventListener('keydown', onKey)
      if (decision === 'allow-always' || decision === 'deny') {
        writePersisted(name, decision)
      }
      resolve(decision)
    }

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close('deny')
    }

    overlay.querySelectorAll<HTMLButtonElement>('.pai-perm-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const c = btn.dataset.choice as PermissionDecision
        close(c)
      })
    })

    document.addEventListener('keydown', onKey)
    document.body.appendChild(overlay)

    const first = overlay.querySelector<HTMLButtonElement>('.pai-perm-btn--primary')
    first?.focus()
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export const permissions = {
  /**
   * Request a permission. Returns true if granted (allow-once/always), false if denied.
   * Previously-persisted decisions are honored without re-prompting.
   */
  async request(name: PermissionName, reason: string): Promise<boolean> {
    const persisted = readPersisted(name)
    if (persisted === 'allow-always') return true
    if (persisted === 'deny') return false
    const decision = await promptUser(name, reason)
    return decision === 'allow-always' || decision === 'allow-once'
  },

  /** Read the persisted decision for a permission, if any. */
  status(name: PermissionName): PermissionDecision | null {
    return readPersisted(name)
  },

  /** Revoke a stored decision. The next request will prompt again. */
  revoke(name: PermissionName): void {
    try {
      localStorage.removeItem(storageKey(name))
    } catch {}
  },

  /** Revoke all stored permission decisions. */
  revokeAll(): void {
    try {
      const keys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith(LS_PREFIX)) keys.push(k)
      }
      for (const k of keys) localStorage.removeItem(k)
    } catch {}
  },
}
