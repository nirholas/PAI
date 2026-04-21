// Streaming replay engine for Chat.app canned conversations.
// Drives character-by-character playback respecting prefers-reduced-motion.

const CHAR_RATE = 40 // characters per second default
const INTER_MESSAGE_DELAY = 600 // ms pause between messages

const reducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export class ReplayPlayer {
  /** @type {object} */
  #replay
  /** @type {HTMLElement} */
  #container
  /** @type {number} */
  #charRate
  /** @type {boolean} */
  #paused = false
  /** @type {boolean} */
  #running = false
  /** @type {(() => void) | null} */
  #skipResolve = null
  /** @type {AbortController} */
  #abort = new AbortController()

  /**
   * @param {object} replay  Parsed replay JSON
   * @param {HTMLElement} container  DOM node to append messages into
   * @param {object} [opts]
   * @param {number} [opts.charRate]  Characters per second
   */
  constructor(replay, container, opts = {}) {
    this.#replay = replay
    this.#container = container
    this.#charRate = opts.charRate ?? CHAR_RATE
  }

  get running() {
    return this.#running
  }

  get paused() {
    return this.#paused
  }

  pause() {
    this.#paused = true
  }

  resume() {
    this.#paused = false
  }

  /** Jump instantly to the end of the current typing animation. */
  skipTyping() {
    if (this.#skipResolve) {
      this.#skipResolve()
      this.#skipResolve = null
    }
  }

  stop() {
    this.#abort.abort()
    this.#running = false
  }

  /** @returns {Promise<void>} Resolves when replay finishes */
  async play() {
    this.#abort = new AbortController()
    this.#running = true
    this.#paused = false
    this.#container.innerHTML = ''

    const signal = this.#abort.signal

    for (const msg of this.#replay.messages) {
      if (signal.aborted) break

      // Wait while paused
      await this.#waitWhilePaused(signal)
      if (signal.aborted) break

      const bubble = this.#appendBubble(msg.role)

      if (msg.role === 'user') {
        // User messages appear instantly
        bubble.textContent = msg.content
      } else {
        // Assistant messages stream character by character
        if (reducedMotion) {
          bubble.textContent = msg.content
        } else {
          await this.#streamText(msg.content, bubble, signal)
        }
      }

      if (signal.aborted) break
      await this.#delay(INTER_MESSAGE_DELAY, signal)
    }

    this.#running = false
    this.#skipResolve = null
  }

  /** @param {string} role @returns {HTMLElement} */
  #appendBubble(role) {
    const row = document.createElement('div')
    row.className = `owui-message owui-message--${role}`

    const avatar = document.createElement('div')
    avatar.className = 'owui-avatar'
    avatar.setAttribute('aria-hidden', 'true')
    avatar.textContent = role === 'user' ? 'U' : 'AI'

    const bubble = document.createElement('div')
    bubble.className = 'owui-bubble'

    row.appendChild(avatar)
    row.appendChild(bubble)
    this.#container.appendChild(row)
    this.#container.scrollTop = this.#container.scrollHeight

    return bubble
  }

  /**
   * @param {string} text
   * @param {HTMLElement} el
   * @param {AbortSignal} signal
   */
  async #streamText(text, el, signal) {
    const msPerChar = 1000 / this.#charRate
    let i = 0

    await new Promise((resolve) => {
      this.#skipResolve = () => {
        el.textContent = text
        el.closest('.owui-message')?.scrollIntoView({ block: 'end' })
        resolve()
      }

      const tick = async () => {
        if (signal.aborted || i >= text.length) {
          this.#skipResolve = null
          resolve()
          return
        }

        // Wait while paused
        while (this.#paused && !signal.aborted) {
          await this.#delay(50, signal)
        }
        if (signal.aborted) {
          resolve()
          return
        }

        // Emit next char
        el.textContent = text.slice(0, ++i)
        this.#container.scrollTop = this.#container.scrollHeight

        setTimeout(tick, msPerChar)
      }

      setTimeout(tick, msPerChar)
    })
  }

  /**
   * @param {number} ms
   * @param {AbortSignal} signal
   */
  #delay(ms, signal) {
    return new Promise((resolve) => {
      if (signal.aborted) { resolve(); return }
      const id = setTimeout(resolve, ms)
      signal.addEventListener('abort', () => { clearTimeout(id); resolve() }, { once: true })
    })
  }

  /** @param {AbortSignal} signal */
  async #waitWhilePaused(signal) {
    while (this.#paused && !signal.aborted) {
      await this.#delay(50, signal)
    }
  }
}
