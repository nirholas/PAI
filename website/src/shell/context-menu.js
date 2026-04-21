import { WALLPAPERS, setWallpaper } from './wallpaper.js'
import { ICON_DEFS, REPO_URL, arrangeIcons, iconTabUrl } from './desktop.js'
import { getDesktopNewFileMenuItem } from './desktop-files.ts'
import { wm } from './wm.js'
import { tick } from './sound.ts'
import { APPS } from './apps.js'
import { openWidgetManager } from './widgets.ts'
import { popoutWindow } from './popout.ts'

// ── Internal state ────────────────────────────────────────────────────────────

let activeMenu = null
// Shared reference to iconPositions object (populated by initContextMenu)
let _iconPositions = null

// ── Menu factory ──────────────────────────────────────────────────────────────

/**
 * @param {Array<{label:string, action?:()=>void, submenu?:Array, checked?:boolean}|null>} items
 * @param {number} x  viewport x
 * @param {number} y  viewport y
 */
function openMenu(items, x, y) {
  closeMenu()

  const menu = buildMenu(items)
  document.body.appendChild(menu)

  // Clamp to viewport
  const vw = window.innerWidth
  const vh = window.innerHeight
  const mr = menu.getBoundingClientRect()
  const left = x + mr.width > vw - 4 ? vw - mr.width - 4 : x
  const top = y + mr.height > vh - 4 ? vh - mr.height - 4 : y
  menu.style.left = `${left}px`
  menu.style.top = `${top}px`

  activeMenu = menu

  // Focus first focusable item
  const first = menu.querySelector(
    '.context-menu__item:not(.context-menu__item--muted)',
  )
  first?.focus()
}

function buildMenu(items) {
  const ul = document.createElement('ul')
  ul.className = 'context-menu'
  ul.setAttribute('role', 'menu')

  items.forEach((item) => {
    if (item === null) {
      const sep = document.createElement('li')
      sep.className = 'context-menu__sep'
      sep.setAttribute('role', 'separator')
      ul.appendChild(sep)
      return
    }

    const li = document.createElement('li')
    li.className = 'context-menu__item'
    li.setAttribute('role', item.submenu ? 'menuitem' : 'menuitem')
    li.tabIndex = -1

    if (item.checked) {
      li.setAttribute('aria-checked', 'true')
    }

    if (item.submenu) {
      li.className += ' context-menu__item--has-sub'
      li.innerHTML = `<span>${item.label}</span><span class="context-menu__arrow" aria-hidden="true">&#9654;</span>`

      const sub = buildMenu(item.submenu)
      sub.classList.add('context-menu--sub')
      li.appendChild(sub)

      // Open submenu on ArrowRight
      li.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          e.stopPropagation()
          const firstSub = sub.querySelector(
            '.context-menu__item:not(.context-menu__item--muted)',
          )
          firstSub?.focus()
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          e.stopPropagation()
          li.focus()
        }
      })

      sub.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          e.stopPropagation()
          li.focus()
        }
      })
    } else {
      li.textContent = item.label
      li.addEventListener('click', () => {
        tick()
        closeMenu()
        item.action?.()
      })
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          li.click()
        }
      })
    }

    ul.appendChild(li)
  })

  // Arrow-key navigation within this level
  ul.addEventListener('keydown', (e) => {
    const focusable = [
      ...ul.querySelectorAll(
        ':scope > .context-menu__item:not(.context-menu__item--muted)',
      ),
    ]
    const cur = focusable.indexOf(document.activeElement)

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      focusable[(cur + 1) % focusable.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      focusable[(cur - 1 + focusable.length) % focusable.length]?.focus()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeMenu()
    }
  })

  return ul
}

function closeMenu() {
  if (activeMenu) {
    activeMenu.remove()
    activeMenu = null
  }
}

// ── Menu specs ────────────────────────────────────────────────────────────────

function desktopMenu() {
  const activeWp = document.body.dataset.wallpaper ?? 'default'
  return [
    {
      label: 'Change wallpaper \u25b6',
      submenu: WALLPAPERS.map((wp) => ({
        label: wp.label,
        checked: wp.name === activeWp,
        action: () => setWallpaper(wp.name),
        // Render thumbnail via a submenu item that contains an img
        _isWallpaper: true,
        _wp: wp,
      })).map((item) => {
        // Wrap label with thumbnail for wallpaper items
        return {
          label: item.label,
          checked: item.checked,
          action: item.action,
          _wallpaperPath: item._wp.path,
        }
      }),
    },
    {
      label: 'Arrange icons',
      action: () => arrangeIcons(_iconPositions ?? {}),
    },
    null,
    getDesktopNewFileMenuItem(),
    {
      label: 'New folder',
      action: () => _toast('New folder — coming soon'),
    },
    null,
    {
      label: 'Toggle widgets',
      action: () => openWidgetManager(),
    },
    {
      label: 'Display settings',
      action: () => _openSettingsOrToast(),
    },
    null,
    {
      label: 'About PAI',
      action: () => wm.open('about', { title: 'About' }),
    },
    {
      label: 'View source \u2197',
      action: () => window.open(REPO_URL, '_blank', 'noopener,noreferrer'),
    },
  ]
}

// ── Titlebar menu ─────────────────────────────────────────────────────────────

function titlebarMenu(winId) {
  const win = wm.list().find((w) => w.id === winId)
  if (!win) return []
  return [
    {
      label: win.minimized ? 'Restore' : 'Minimise',
      action: () => {
        if (win.minimized) wm.unminimize?.(winId)
        else wm.minimize(winId)
      },
    },
    {
      label: 'Maximise',
      action: () => wm.toggleMaximize(winId),
    },
    {
      label: 'Popout to new window',
      action: () => popoutWindow(winId),
    },
    null,
    {
      label: 'Close',
      action: () => wm.close(winId),
    },
    {
      label: 'Close all windows',
      action: () => {
        for (const w of wm.list()) wm.close(w.id)
      },
    },
  ]
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function _openSettingsOrToast() {
  // Prefer the Settings app if it exists; otherwise a gentle toast.
  if (APPS.settings) {
    wm.open('settings', { title: 'Settings' })
  } else {
    _toast('Settings are not installed in this demo yet.')
  }
}

function _toast(msg) {
  let t = document.getElementById('pai-toast')
  if (!t) {
    t = document.createElement('div')
    t.id = 'pai-toast'
    t.className = 'pai-toast'
    document.body.appendChild(t)
  }
  t.textContent = msg
  t.classList.add('is-open')
  clearTimeout(t._h)
  t._h = window.setTimeout(() => t.classList.remove('is-open'), 2400)
}

function iconMenu(def) {
  const tabUrl = iconTabUrl(def)
  return [
    { label: 'Open', action: () => def.activate() },
    {
      label: 'Open in new tab \u2197',
      action: () => {
        if (tabUrl) window.open(tabUrl, '_blank', 'noopener,noreferrer')
      },
    },
    null,
    { label: 'Properties', action: () => showProperties(def) },
  ]
}

// ── Properties dialog ────────────────────────────────────────────────────────

function showProperties(def) {
  const dialog = /** @type {HTMLDialogElement|null} */ (
    document.getElementById('icon-properties')
  )
  if (!dialog) return

  const setText = (sel, text) => {
    const el = dialog.querySelector(sel)
    if (el) el.textContent = text
  }

  const url = iconTabUrl(def)
  let location = '—'
  if (url) {
    try {
      const u = new URL(url, window.location.origin)
      location = def.isExternal
        ? url
        : u.pathname + u.search + (u.hash || '')
    } catch {
      location = url
    }
  }

  setText('.icon-properties__title', def.label)
  setText('#icon-props-name', def.label)
  setText(
    '#icon-props-kind',
    def.kind ?? (def.isExternal ? 'External link' : 'Application'),
  )
  setText('#icon-props-target', def.target ?? def.label)
  setText('#icon-props-location', location)

  dialog.showModal()
}

// ── Wallpaper submenu with thumbnails ─────────────────────────────────────────
// Override buildMenu to support _wallpaperPath items

function buildWallpaperSubmenu(items) {
  const ul = document.createElement('ul')
  ul.className = 'context-menu'
  ul.setAttribute('role', 'menu')

  items.forEach((item) => {
    const li = document.createElement('li')
    li.className = 'context-menu__item'
    li.setAttribute('role', 'menuitemradio')
    li.setAttribute('aria-checked', item.checked ? 'true' : 'false')
    li.tabIndex = -1

    const thumb = document.createElement('span')
    thumb.className = 'context-menu__wp-thumb'
    thumb.style.backgroundImage = `url('${item._wallpaperPath}')`
    thumb.setAttribute('aria-hidden', 'true')

    const label = document.createElement('span')
    label.textContent = item.label

    li.appendChild(thumb)
    li.appendChild(label)

    li.addEventListener('click', () => {
      closeMenu()
      item.action?.()
    })
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        li.click()
      }
    })

    ul.appendChild(li)
  })

  ul.addEventListener('keydown', (e) => {
    const focusable = [...ul.querySelectorAll('.context-menu__item')]
    const cur = focusable.indexOf(document.activeElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      focusable[(cur + 1) % focusable.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      focusable[(cur - 1 + focusable.length) % focusable.length]?.focus()
    } else if (e.key === 'Escape') {
      closeMenu()
    }
  })

  return ul
}

// ── Main init ─────────────────────────────────────────────────────────────────

export function initContextMenu(iconPositions) {
  _iconPositions = iconPositions

  const desktop = document.getElementById('pai-desktop')
  if (!desktop) return

  // Right-click on desktop background
  desktop.addEventListener('contextmenu', (e) => {
    const iconEl = e.target.closest('.desktop-icon')
    if (iconEl) {
      // icon context menu
      e.preventDefault()
      const id = iconEl.dataset.iconId
      const def = ICON_DEFS.find((d) => d.id === id)
      if (def) openMenu(iconMenu(def), e.clientX, e.clientY)
    } else {
      // desktop context menu
      e.preventDefault()
      const items = desktopMenu()
      // Replace wallpaper submenu with thumbnail version
      const wpItem = items.find((i) => i && i._wallpaperPath !== undefined)
      // Rebuild menu with special wallpaper submenu
      openMenuWithWpThumbs(items, e.clientX, e.clientY)
    }
  })

  // Close on outside click
  document.addEventListener(
    'click',
    (e) => {
      if (activeMenu && !activeMenu.contains(e.target)) closeMenu()
    },
    true,
  )

  // Close on scroll
  document.addEventListener('scroll', closeMenu, { passive: true })

  // Window titlebar right-click → titlebar menu (delegated).
  document.addEventListener('contextmenu', (e) => {
    const titlebar = e.target.closest?.('.window-titlebar')
    if (!titlebar) return
    const winEl = titlebar.closest('.window')
    const winId = winEl?.dataset.windowId
    if (!winId) return
    e.preventDefault()
    e.stopPropagation()
    openMenu(titlebarMenu(winId), e.clientX, e.clientY)
  })

  // Properties dialog wiring
  const dialog = /** @type {HTMLDialogElement|null} */ (
    document.getElementById('icon-properties')
  )
  if (dialog) {
    dialog
      .querySelector('.icon-properties__close')
      ?.addEventListener('click', () => dialog.close())
    // Close on backdrop click
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close()
    })
  }
}

// Builds the desktop context menu with wallpaper thumbnails in the submenu
function openMenuWithWpThumbs(items, x, y) {
  closeMenu()

  const ul = document.createElement('ul')
  ul.className = 'context-menu'
  ul.setAttribute('role', 'menu')

  const activeWp = document.body.dataset.wallpaper ?? 'default'

  items.forEach((item) => {
    if (item === null) {
      const sep = document.createElement('li')
      sep.className = 'context-menu__sep'
      sep.setAttribute('role', 'separator')
      ul.appendChild(sep)
      return
    }

    const li = document.createElement('li')
    li.className = 'context-menu__item'
    li.setAttribute('role', 'menuitem')
    li.tabIndex = -1

    // Wallpaper submenu item — special rendering
    if (item.label.startsWith('Change wallpaper')) {
      li.className += ' context-menu__item--has-sub'
      li.innerHTML = `<span>${item.label}</span><span class="context-menu__arrow" aria-hidden="true">&#9654;</span>`

      const sub = buildWallpaperSubmenu(
        WALLPAPERS.map((wp) => ({
          label: wp.label,
          checked: wp.name === activeWp,
          action: () => setWallpaper(wp.name),
          _wallpaperPath: wp.path,
        })),
      )
      sub.classList.add('context-menu--sub')
      li.appendChild(sub)

      li.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          e.stopPropagation()
          sub.querySelector('.context-menu__item')?.focus()
        }
      })
      sub.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          e.stopPropagation()
          li.focus()
        }
      })
    } else {
      li.textContent = item.label
      li.addEventListener('click', () => {
        tick()
        closeMenu()
        item.action?.()
      })
      li.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          li.click()
        }
      })
    }

    ul.appendChild(li)
  })

  // Arrow nav
  ul.addEventListener('keydown', (e) => {
    const focusable = [...ul.querySelectorAll(':scope > .context-menu__item')]
    const cur = focusable.indexOf(document.activeElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      focusable[(cur + 1) % focusable.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      focusable[(cur - 1 + focusable.length) % focusable.length]?.focus()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeMenu()
    }
  })

  document.body.appendChild(ul)

  const vw = window.innerWidth
  const vh = window.innerHeight
  const mr = ul.getBoundingClientRect()
  ul.style.left = `${x + mr.width > vw - 4 ? vw - mr.width - 4 : x}px`
  ul.style.top = `${y + mr.height > vh - 4 ? vh - mr.height - 4 : y}px`

  activeMenu = ul
  ul.querySelector('.context-menu__item')?.focus()
}
