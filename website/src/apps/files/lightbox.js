// Lightbox for Files.app — keyboard-navigable, Esc to close.
// Supports images (default), text, audio, video, and PDF previews.

import { kindOf, fetchTextPreview, renderPreviewHtml } from './previews.ts'

export class Lightbox {
  /** @type {HTMLElement} */
  #el
  /** @type {Array<{src: string, caption: string, alt: string}>} */
  #items = []
  /** @type {number} */
  #current = 0
  /** @type {((e: KeyboardEvent) => void) | null} */
  #keyHandler = null

  constructor() {
    this.#el = this.#build()
    document.body.appendChild(this.#el)
  }

  #build() {
    const el = document.createElement('div')
    el.className = 'lb-overlay'
    el.setAttribute('role', 'dialog')
    el.setAttribute('aria-modal', 'true')
    el.setAttribute('aria-label', 'Image lightbox')
    el.hidden = true

    el.innerHTML = `
      <div class="lb-backdrop"></div>
      <div class="lb-frame">
        <button class="lb-close" aria-label="Close lightbox">✕</button>
        <button class="lb-arrow lb-prev" aria-label="Previous item">‹</button>
        <div class="lb-img-wrap">
          <div class="lb-placeholder" aria-hidden="true">
            <span class="lb-placeholder-icon">🖼</span>
            <span class="lb-placeholder-msg"></span>
          </div>
          <img class="lb-img" src="" alt="" loading="lazy" />
          <div class="lb-preview" hidden></div>
        </div>
        <button class="lb-arrow lb-next" aria-label="Next item">›</button>
        <div class="lb-footer">
          <p class="lb-caption"></p>
          <p class="lb-counter"></p>
        </div>
      </div>
    `

    el.querySelector('.lb-backdrop').addEventListener('click', () =>
      this.close(),
    )
    el.querySelector('.lb-close').addEventListener('click', () => this.close())
    el.querySelector('.lb-prev').addEventListener('click', () => this.prev())
    el.querySelector('.lb-next').addEventListener('click', () => this.next())

    // Swipe support
    let startX = 0
    el.addEventListener(
      'touchstart',
      (e) => {
        startX = e.touches[0].clientX
      },
      { passive: true },
    )
    el.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - startX
      if (dx < -50) this.next()
      else if (dx > 50) this.prev()
    })

    return el
  }

  /**
   * @param {Array<{src: string, caption: string, alt: string}>} items
   * @param {number} startIndex
   */
  open(items, startIndex = 0) {
    this.#items = items
    this.#current = startIndex
    this.#el.hidden = false
    this.#render()
    this.#trapFocus()

    this.#keyHandler = (e) => {
      if (e.key === 'Escape') this.close()
      if (e.key === 'ArrowLeft') this.prev()
      if (e.key === 'ArrowRight') this.next()
    }
    document.addEventListener('keydown', this.#keyHandler)
    this.#el.querySelector('.lb-close').focus()
  }

  close() {
    this.#el.hidden = true
    if (this.#keyHandler) {
      document.removeEventListener('keydown', this.#keyHandler)
      this.#keyHandler = null
    }
  }

  prev() {
    this.#current =
      (this.#current - 1 + this.#items.length) % this.#items.length
    this.#render()
  }

  next() {
    this.#current = (this.#current + 1) % this.#items.length
    this.#render()
  }

  #render() {
    const item = this.#items[this.#current]
    const img = this.#el.querySelector('.lb-img')
    const placeholder = this.#el.querySelector('.lb-placeholder')
    const preview = this.#el.querySelector('.lb-preview')
    const caption = this.#el.querySelector('.lb-caption')
    const counter = this.#el.querySelector('.lb-counter')
    const prev = this.#el.querySelector('.lb-prev')
    const next = this.#el.querySelector('.lb-next')

    caption.textContent = item.caption
    counter.textContent = `${this.#current + 1} / ${this.#items.length}`
    prev.style.visibility = this.#items.length > 1 ? '' : 'hidden'
    next.style.visibility = this.#items.length > 1 ? '' : 'hidden'

    // Prefer the explicit item.type, else classify by file name/URL.
    const kind = item.type || kindOf(item.src || item.caption || '')

    // Reset shared elements.
    const msg = placeholder.querySelector('.lb-placeholder-msg')
    img.onload = null
    img.onerror = null
    img.removeAttribute('src')
    placeholder.style.display = 'none'
    preview.hidden = true
    preview.innerHTML = ''
    img.style.display = 'none'

    if (kind === 'image') {
      // Preserve the pre-existing image rendering path exactly.
      img.alt = item.alt || item.caption || ''
      img.src = item.src
      img.onload = () => {
        img.style.display = ''
        placeholder.style.display = 'none'
      }
      img.onerror = () => {
        img.style.display = 'none'
        if (msg) msg.textContent = item.caption
        placeholder.style.display = 'flex'
      }
      if (!item.src) {
        if (msg) msg.textContent = item.caption
        placeholder.style.display = 'flex'
      } else {
        img.style.display = ''
      }
      return
    }

    // Non-image kinds render into .lb-preview.
    preview.hidden = false
    const token = ++this.#renderToken

    if (kind === 'text') {
      // Show placeholder while the text loads.
      preview.innerHTML = `<pre class="lb-text">Loading…</pre>`
      fetchTextPreview(item.src)
        .then((text) => {
          if (this.#renderToken !== token) return
          preview.innerHTML = renderPreviewHtml('text', item.src, item.caption, text)
        })
        .catch(() => {
          if (this.#renderToken !== token) return
          preview.innerHTML = renderPreviewHtml('unknown', item.src, item.caption)
        })
      return
    }

    preview.innerHTML = renderPreviewHtml(kind, item.src, item.caption)
  }

  // Prevents stale async text loads from replacing newer content.
  #renderToken = 0

  #trapFocus() {
    const focusable = this.#el.querySelectorAll(
      'button, [tabindex]:not([tabindex="-1"])',
    )
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    this.#el.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    })
  }
}
