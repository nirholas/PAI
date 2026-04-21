import { tick } from './sound.ts'

interface MenuItem {
  label: string
  href?: string
  action?: () => void
}

const REPO_URL = 'https://github.com/nirholas/pai'

let activeMenu: HTMLUListElement | null = null

function closeMenu(): void {
  if (activeMenu) {
    activeMenu.remove()
    activeMenu = null
  }
}

function buildMenu(items: Array<MenuItem | null>): HTMLUListElement {
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
    li.setAttribute('role', 'menuitem')
    li.tabIndex = -1
    li.textContent = item.label

    li.addEventListener('click', () => {
      tick()
      closeMenu()
      if (item.href) {
        const external = /^https?:\/\//.test(item.href)
        if (external) {
          window.open(item.href, '_blank', 'noopener,noreferrer')
        } else {
          window.location.href = item.href
        }
      } else {
        item.action?.()
      }
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
    const focusable = [
      ...ul.querySelectorAll<HTMLLIElement>(
        ':scope > .context-menu__item',
      ),
    ]
    const cur = focusable.indexOf(document.activeElement as HTMLLIElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      focusable[(cur + 1) % focusable.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      focusable[(cur - 1 + focusable.length) % focusable.length]?.focus()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeMenu()
    }
  })

  return ul
}

function openMenu(items: Array<MenuItem | null>, x: number, y: number): void {
  closeMenu()
  const ul = buildMenu(items)
  document.body.appendChild(ul)

  const vw = window.innerWidth
  const vh = window.innerHeight
  const r = ul.getBoundingClientRect()
  ul.style.left = `${x + r.width > vw - 4 ? vw - r.width - 4 : x}px`
  ul.style.top = `${y + r.height > vh - 4 ? vh - r.height - 4 : y}px`

  activeMenu = ul
  ul.querySelector<HTMLLIElement>('.context-menu__item')?.focus()
}

function siteMenu(): Array<MenuItem | null> {
  const path = window.location.pathname
  const onHome = path === '/' || path === ''
  return [
    ...(onHome
      ? []
      : [{ label: 'PAI home', href: '/' } as MenuItem, null]),
    { label: 'How PAI works', href: '/how-pai-works' },
    { label: 'Install PAI', href: '/install' },
    { label: 'Documentation \u2197', href: 'https://docs.pai.direct' },
    { label: 'Support', href: '/support' },
    { label: 'News', href: '/news' },
    null,
    { label: 'Reload page', action: () => window.location.reload() },
    null,
    { label: 'View source \u2197', href: REPO_URL },
    { label: 'Report an issue \u2197', href: `${REPO_URL}/issues/new` },
  ]
}

export function initSiteMenu(): void {
  document.addEventListener('contextmenu', (e) => {
    const target = e.target as Element | null
    if (!target) return

    // Let form controls keep the native menu (paste, spell-check, etc.)
    if (target.closest('input, textarea, [contenteditable=""], [contenteditable="true"]')) {
      return
    }

    // If another handler on this page already claimed the event
    // (e.g. the desktop shell's own contextmenu logic), do nothing.
    if (e.defaultPrevented) return

    e.preventDefault()
    openMenu(siteMenu(), e.clientX, e.clientY)
  })

  document.addEventListener(
    'click',
    (e) => {
      if (activeMenu && !activeMenu.contains(e.target as Node)) closeMenu()
    },
    true,
  )

  document.addEventListener('scroll', closeMenu, { passive: true })
  window.addEventListener('blur', closeMenu)
}
