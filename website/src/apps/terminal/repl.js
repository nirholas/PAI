// Fake shell REPL. Call createREPL(containerEl) to boot a terminal session.

import helpCmd   from './commands/help.js'
import lsCmd     from './commands/ls.js'
import catCmd    from './commands/cat.js'
import ollamaCmd from './commands/ollama.js'
import ipCmd     from './commands/ip.js'
import unameCmd  from './commands/uname.js'
import whoamiCmd from './commands/whoami.js'
import sudoCmd   from './commands/sudo.js'
import neofetchCmd from './commands/neofetch.js'
import clearCmd  from './commands/clear.js'
import exitCmd   from './commands/exit.js'

const COMMANDS = {
  help: helpCmd,
  ls: lsCmd,
  cat: catCmd,
  ollama: ollamaCmd,
  ip: ipCmd,
  uname: unameCmd,
  whoami: whoamiCmd,
  sudo: sudoCmd,
  neofetch: neofetchCmd,
  clear: clearCmd,
  exit: exitCmd,
}

const PROMPT = '<span class="term-ps1">pai@demo</span><span class="term-sep">:</span><span class="term-cwd">~</span><span class="term-dollar">$</span>'

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function createREPL(container, bridgeClose) {
  const outputEl = container.querySelector('#term-output')
  const displayEl = container.querySelector('#term-display')
  const cursorEl = container.querySelector('#term-cursor')

  let inputBuf = ''
  let history = []
  let histIdx = -1
  let savedInput = ''
  let enabled = true

  // Public API passed to command handlers
  const term = {
    print(html) {
      const el = document.createElement('div')
      el.innerHTML = html
      outputEl.appendChild(el)
      container.scrollTop = container.scrollHeight
    },
    appendChar(html) {
      // Append to the last output line (for streaming)
      let last = outputEl.lastElementChild
      if (!last || last.classList.contains('term-inputecho')) {
        last = document.createElement('span')
        last.className = 'term-stream'
        outputEl.appendChild(last)
      }
      last.innerHTML += html
      container.scrollTop = container.scrollHeight
    },
    clear() {
      outputEl.innerHTML = ''
    },
    close() {
      if (bridgeClose) bridgeClose()
    },
    setEnabled(val) {
      enabled = val
      cursorEl.style.opacity = val ? '1' : '0.3'
    },
  }

  function updateDisplay() {
    // Show inputBuf with cursor at end
    displayEl.textContent = inputBuf
    cursorEl.textContent = '█'
  }

  function printLine(html) {
    const el = document.createElement('div')
    el.innerHTML = html
    outputEl.appendChild(el)
    container.scrollTop = container.scrollHeight
  }

  async function submit(raw) {
    const trimmed = raw.trim()

    // Echo the command line
    const echo = document.createElement('div')
    echo.className = 'term-inputecho'
    echo.innerHTML = `${PROMPT}&nbsp;${escHtml(raw)}`
    outputEl.appendChild(echo)

    if (!trimmed) {
      container.scrollTop = container.scrollHeight
      return
    }

    // Record history (avoid duplicates at top)
    if (history[0] !== trimmed) history.unshift(trimmed)
    histIdx = -1
    savedInput = ''

    // Parse: split on whitespace, handle quoted strings minimally
    const parts = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) || []
    const cmdName = parts[0]
    const args = parts.slice(1).map(a => a.replace(/^"|"$/g, ''))

    const fn = COMMANDS[cmdName]
    if (!fn) {
      printLine(`bash: ${escHtml(cmdName)}: command not found &mdash; try &#39;help&#39;`)
      container.scrollTop = container.scrollHeight
      return
    }

    try {
      const result = await fn(args, term)
      if (result !== null && result !== undefined) {
        printLine(result)
      }
    } catch (err) {
      printLine(`<span class="term-err">${escHtml(String(err))}</span>`)
    }

    container.scrollTop = container.scrollHeight
  }

  function tabComplete() {
    const names = Object.keys(COMMANDS)
    const matches = names.filter(n => n.startsWith(inputBuf))
    if (matches.length === 1) {
      inputBuf = matches[0] + ' '
      updateDisplay()
    } else if (matches.length > 1) {
      printLine(matches.join('  '))
      container.scrollTop = container.scrollHeight
    }
  }

  document.addEventListener('keydown', async e => {
    // Don't steal from other inputs
    if (e.target !== document.body && e.target !== container) {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return
    }

    if (!enabled) return

    switch (e.key) {
      case 'Enter':
        e.preventDefault()
        await submit(inputBuf)
        inputBuf = ''
        updateDisplay()
        break

      case 'Backspace':
        e.preventDefault()
        inputBuf = inputBuf.slice(0, -1)
        updateDisplay()
        break

      case 'ArrowUp':
        e.preventDefault()
        if (histIdx === -1) savedInput = inputBuf
        if (histIdx < history.length - 1) {
          histIdx++
          inputBuf = history[histIdx]
          updateDisplay()
        }
        break

      case 'ArrowDown':
        e.preventDefault()
        if (histIdx > 0) {
          histIdx--
          inputBuf = history[histIdx]
        } else if (histIdx === 0) {
          histIdx = -1
          inputBuf = savedInput
        }
        updateDisplay()
        break

      case 'Tab':
        e.preventDefault()
        tabComplete()
        break

      case 'l':
        if (e.ctrlKey) {
          e.preventDefault()
          term.clear()
        }
        break

      case 'c':
        if (e.ctrlKey) {
          e.preventDefault()
          printLine(`${PROMPT}&nbsp;${escHtml(inputBuf)}&nbsp;^C`)
          inputBuf = ''
          updateDisplay()
        }
        break

      case 'u':
        if (e.ctrlKey) {
          e.preventDefault()
          inputBuf = ''
          updateDisplay()
        }
        break

      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault()
          inputBuf += e.key
          updateDisplay()
        }
    }
  })

  // Focus the container so keydown fires
  container.setAttribute('tabindex', '0')
  container.focus()

  // Boot message
  printLine([
    '<span class="term-dim">PAI demo terminal — <strong>non-networked simulation</strong></span>',
    '<span class="term-dim">Type <span class="term-cmd">help</span> for available commands.</span>',
    '',
  ].join('\n'))
  updateDisplay()
}
