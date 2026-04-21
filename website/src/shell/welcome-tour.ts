// First-run welcome tour. Shows a sequence of tooltip steps pointing at
// real shell elements (dock, start menu, desktop). Sets `pai-welcome-done`
// on completion so subsequent loads skip it.

const DONE_KEY = 'pai-welcome-done'

interface TourStep {
  title: string
  body: string
  selector?: string
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center'
}

const STEPS: TourStep[] = [
  {
    title: 'Welcome to PAI',
    body:
      'This is a preview of the PAI desktop — the same look and feel as the live USB boot. Take a quick tour to get oriented.',
    placement: 'center',
  },
  {
    title: 'The dock',
    body: 'Click any icon in the dock to launch an app.',
    selector: '.shell__dock',
    placement: 'top',
  },
  {
    title: 'The top bar',
    body: 'Shows workspace, clock, and system indicators. Click it for quick controls.',
    selector: '.shell__topbar',
    placement: 'bottom',
  },
  {
    title: 'Right-click the desktop',
    body:
      'A context menu opens with wallpapers, icon arrangement, and quick actions.',
    selector: '.shell__desktop',
    placement: 'center',
  },
  {
    title: 'Quick search',
    body:
      'Press Cmd+K (or Ctrl+K) to open search — find apps, docs, and settings in one place.',
    placement: 'center',
  },
  {
    title: 'Drag a window',
    body: 'Grab a title bar to drag. Drag to the edge to snap, or double-click to maximize.',
    placement: 'center',
  },
]

export function hasTourRun(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === '1'
  } catch {
    return false
  }
}

export function markTourDone(): void {
  try {
    localStorage.setItem(DONE_KEY, '1')
  } catch {}
}

export function resetTour(): void {
  try {
    localStorage.removeItem(DONE_KEY)
  } catch {}
}

function injectStyles(): void {
  if (document.getElementById('pai-tour-styles')) return
  const style = document.createElement('style')
  style.id = 'pai-tour-styles'
  style.textContent = `
    .pai-tour-dim {
      position: fixed; inset: 0;
      background: rgba(10, 10, 20, 0.55);
      backdrop-filter: blur(2px);
      z-index: var(--z-modal, 50);
      animation: pai-tour-fade 180ms ease-out;
    }
    @keyframes pai-tour-fade { from { opacity: 0; } to { opacity: 1; } }
    .pai-tour-card {
      position: fixed; z-index: calc(var(--z-modal, 50) + 1);
      width: min(360px, 90vw);
      background: var(--bg-elev, #1a1a2e);
      color: var(--fg, #e0e0e0);
      border: 1px solid var(--border, #2a2a3e);
      border-radius: var(--r-window, 8px);
      padding: var(--s-4, 16px);
      font-family: var(--font-ui, system-ui, sans-serif);
      box-shadow: 0 12px 32px rgba(0,0,0,0.5);
    }
    .pai-tour-card h3 {
      font-size: 1rem; margin: 0 0 var(--s-2, 8px);
    }
    .pai-tour-card p {
      font-size: 0.875rem; color: var(--fg, #e0e0e0);
      line-height: 1.5; margin: 0 0 var(--s-3, 12px);
    }
    .pai-tour-actions {
      display: flex; gap: var(--s-2, 8px); align-items: center;
    }
    .pai-tour-step {
      margin-left: auto; font-size: 0.75rem; color: var(--fg-muted, #888);
    }
    .pai-tour-btn {
      appearance: none; border: 1px solid var(--border, #2a2a3e);
      background: var(--bg, #0f0f1a); color: var(--fg, #e0e0e0);
      border-radius: var(--r-icon, 6px);
      padding: 6px 12px; font-size: 0.8125rem; font-family: inherit;
      cursor: pointer;
    }
    .pai-tour-btn--primary {
      background: var(--pai-blue, #7aa2f7); color: #0f0f1a;
      border-color: var(--pai-blue, #7aa2f7); font-weight: 600;
    }
    .pai-tour-btn:hover { filter: brightness(1.1); }
    .pai-tour-highlight {
      position: fixed; z-index: var(--z-modal, 50);
      border: 2px solid var(--pai-blue, #7aa2f7);
      border-radius: 8px;
      box-shadow: 0 0 0 9999px rgba(10, 10, 20, 0.55);
      pointer-events: none;
      transition: all 180ms ease-out;
    }
  `
  document.head.appendChild(style)
}

function positionCard(
  card: HTMLElement,
  rect: DOMRect | null,
  placement: TourStep['placement'],
): void {
  const margin = 12
  let top: number, left: number
  if (!rect || placement === 'center') {
    top = window.innerHeight / 2 - card.offsetHeight / 2
    left = window.innerWidth / 2 - card.offsetWidth / 2
  } else if (placement === 'top') {
    top = rect.top - card.offsetHeight - margin
    left = rect.left + rect.width / 2 - card.offsetWidth / 2
  } else if (placement === 'bottom') {
    top = rect.bottom + margin
    left = rect.left + rect.width / 2 - card.offsetWidth / 2
  } else if (placement === 'left') {
    top = rect.top + rect.height / 2 - card.offsetHeight / 2
    left = rect.left - card.offsetWidth - margin
  } else {
    top = rect.top + rect.height / 2 - card.offsetHeight / 2
    left = rect.right + margin
  }
  top = Math.max(margin, Math.min(top, window.innerHeight - card.offsetHeight - margin))
  left = Math.max(margin, Math.min(left, window.innerWidth - card.offsetWidth - margin))
  card.style.top = `${top}px`
  card.style.left = `${left}px`
}

export function startTour(): Promise<void> {
  injectStyles()
  return new Promise((resolve) => {
    let i = 0
    const dim = document.createElement('div')
    dim.className = 'pai-tour-dim'
    document.body.appendChild(dim)

    const highlight = document.createElement('div')
    highlight.className = 'pai-tour-highlight'
    highlight.style.display = 'none'
    document.body.appendChild(highlight)

    const card = document.createElement('div')
    card.className = 'pai-tour-card'
    card.setAttribute('role', 'dialog')
    card.setAttribute('aria-modal', 'true')
    document.body.appendChild(card)

    const finish = (): void => {
      markTourDone()
      dim.remove()
      highlight.remove()
      card.remove()
      document.removeEventListener('keydown', onKey)
      resolve()
    }

    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') finish()
      if (e.key === 'Enter' || e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
    }

    function prev(): void {
      if (i > 0) {
        i--
        render()
      }
    }
    function next(): void {
      if (i < STEPS.length - 1) {
        i++
        render()
      } else {
        finish()
      }
    }

    function render(): void {
      const step = STEPS[i]
      const last = i === STEPS.length - 1
      card.innerHTML = `
        <h3>${escapeText(step.title)}</h3>
        <p>${escapeText(step.body)}</p>
        <div class="pai-tour-actions">
          <button class="pai-tour-btn" data-act="skip">Skip</button>
          ${i > 0 ? '<button class="pai-tour-btn" data-act="prev">Back</button>' : ''}
          <button class="pai-tour-btn pai-tour-btn--primary" data-act="next">${last ? 'Done' : 'Next'}</button>
          <span class="pai-tour-step">${i + 1} / ${STEPS.length}</span>
        </div>
      `
      card
        .querySelectorAll<HTMLButtonElement>('.pai-tour-btn')
        .forEach((btn) => {
          btn.addEventListener('click', () => {
            const act = btn.dataset.act
            if (act === 'skip') finish()
            else if (act === 'prev') prev()
            else next()
          })
        })

      let rect: DOMRect | null = null
      if (step.selector) {
        const target = document.querySelector<HTMLElement>(step.selector)
        if (target) {
          rect = target.getBoundingClientRect()
          highlight.style.display = ''
          highlight.style.top = `${rect.top}px`
          highlight.style.left = `${rect.left}px`
          highlight.style.width = `${rect.width}px`
          highlight.style.height = `${rect.height}px`
        } else {
          highlight.style.display = 'none'
        }
      } else {
        highlight.style.display = 'none'
      }

      // Position after the DOM has a size.
      requestAnimationFrame(() => positionCard(card, rect, step.placement ?? 'center'))
      const primary = card.querySelector<HTMLButtonElement>(
        '.pai-tour-btn--primary',
      )
      primary?.focus()
    }

    document.addEventListener('keydown', onKey)
    render()
  })
}

function escapeText(s: string): string {
  const d = document.createElement('div')
  d.textContent = s
  return d.innerHTML
}

export const welcomeTour = { startTour, hasTourRun, markTourDone, resetTour, STEPS }

// Shell-side: listen for app requests to (re-)start the tour.
if (typeof window !== 'undefined') {
  window.addEventListener('message', (ev) => {
    if (ev.origin !== window.location.origin) return
    const msg = ev.data
    if (!msg || msg.v !== 1 || msg.source !== 'pai-app') return
    if (msg.type === 'run-welcome-tour') {
      resetTour()
      startTour()
    }
  })
}
