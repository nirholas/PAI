export class TerminalApp {
  private history: string[] = []
  private historyIndex = -1
  private outputEl!: HTMLElement

  constructor(container: HTMLElement) {
    this.render(container)
  }

  private render(container: HTMLElement): void {
    const app = document.createElement('div')
    app.className = 'terminal-app'
    app.innerHTML = `
      <div class="terminal-header">foot (PAI Terminal)</div>
      <div class="terminal-output" id="terminal-output">
        <div class="terminal-line">Welcome to PAI Terminal. Type <span style="color:#4ade80">help</span> for available commands.</div>
      </div>
      <div class="terminal-input-line">
        <span class="terminal-prompt-text">user@pai:~$&nbsp;</span>
        <input type="text" id="terminal-input" class="terminal-input" autocomplete="off" spellcheck="false">
      </div>
    `
    container.appendChild(app)

    this.outputEl = app.querySelector('#terminal-output')!
    const input = app.querySelector('#terminal-input') as HTMLInputElement

    app.addEventListener('click', () => input.focus())
    input.focus()

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        this.executeCommand(input.value)
        input.value = ''
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        this.historyIndex = Math.min(this.historyIndex + 1, this.history.length - 1)
        if (this.historyIndex >= 0) {
          input.value = this.history[this.history.length - 1 - this.historyIndex]
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        this.historyIndex = Math.max(this.historyIndex - 1, -1)
        input.value =
          this.historyIndex >= 0
            ? this.history[this.history.length - 1 - this.historyIndex]
            : ''
      }
    })
  }

  private executeCommand(cmd: string): void {
    const line = document.createElement('div')
    line.className = 'terminal-line'
    line.textContent = `user@pai:~$ ${cmd}`
    this.outputEl.appendChild(line)

    if (cmd.trim()) {
      this.history.push(cmd)
      this.historyIndex = -1
    }

    const [exe, ...args] = cmd.trim().split(/\s+/)
    const response = this.handleCommand(exe, args)

    if (response) {
      const resp = document.createElement('div')
      resp.className = 'terminal-response'
      resp.innerHTML = response
      this.outputEl.appendChild(resp)
    }

    this.outputEl.scrollTop = this.outputEl.scrollHeight
  }

  private handleCommand(exe: string, args: string[]): string {
    switch (exe?.toLowerCase()) {
      case 'ollama':
        if (args[0] === 'run') {
          const model = args[1] || 'llama3'
          return (
            `<span style="color:#888">pulling manifest...<br>pulling layers... 100%<br>running ${model}</span><br>` +
            `<span class="terminal-assistant">${this.mockResponse()}</span>`
          )
        }
        if (args[0] === 'list') {
          return `<span style="color:#888">NAME            ID            SIZE<br>llama3:latest   abc123def456  4.7 GB<br>mistral:latest  789def012abc  4.1 GB</span>`
        }
        return `ollama [command]<br>&nbsp; run &lt;model&gt; — run a model<br>&nbsp; list — list local models<br>&nbsp; pull &lt;model&gt; — download a model`

      case 'pai-privacy':
        if (args[0] === 'on') {
          return `[ <span style="color:#4ade80">OK</span> ] Tor enabled<br>[ <span style="color:#4ade80">OK</span> ] DNS over Tor active<br>[ <span style="color:#4ade80">OK</span> ] MAC spoofing: active`
        }
        if (args[0] === 'off') {
          return `[ <span style="color:#4ade80">OK</span> ] Tor disabled<br>[ <span style="color:#4ade80">OK</span> ] Network restored`
        }
        return `pai-privacy on|off — toggle Tor anonymity`

      case 'pai':
        if (args[0] === '--version') return 'PAI 0.1.0 — PAI'
        if (args[0] === '--help') {
          return (
            `PAI: Private AI on a bootable USB drive<br>` +
            `&nbsp; pai-privacy on/off — Tor toggle<br>` +
            `&nbsp; ollama run &lt;model&gt; — run an LLM<br>` +
            `&nbsp; pai --version — show version`
          )
        }
        return `pai: unknown option. Try: pai --help`

      case 'whoami':
        return 'user'

      case 'pwd':
        return '/home/user'

      case 'ls':
        return `<span style="color:#7aa2f7">Desktop/&nbsp; Documents/&nbsp; Downloads/&nbsp; Pictures/</span>&nbsp; chat-history.txt`

      case 'cat':
        if (args[0] === 'chat-history.txt') {
          return `user: What is PAI?<br>assistant: PAI is a bootable live-USB OS with local AI...`
        }
        return `cat: ${args[0] ?? ''}: No such file or directory`

      case 'clear':
        this.outputEl.innerHTML = ''
        return ''

      case 'neofetch':
        return (
          `<span style="color:#7aa2f7">.____.______________ <br>` +
          `|    |   \\______   \\<br>` +
          `|    |   /|     ___/<br>` +
          `|    |  / |    |<br>` +
          `|____|_/  |____|</span><br>` +
          `<br>` +
          `<b>OS:</b> Debian 12 (Bookworm) x86_64<br>` +
          `<b>Kernel:</b> Linux 6.1.0-pai<br>` +
          `<b>WM:</b> Sway<br>` +
          `<b>Shell:</b> zsh<br>` +
          `<b>RAM:</b> 4 GB / 7 GB<br>` +
          `<b>Disk:</b> 2.3 GB / 3.8 GB (USB)`
        )

      case 'uname':
        return 'Linux pai 6.1.0-x86_64-libc #1 SMP PAI'

      case 'help':
      case '':
      case undefined:
        return `Available commands:<br>&nbsp; <span style="color:#4ade80">ollama</span> run &lt;model&gt; &lt;prompt&gt;, list<br>&nbsp; <span style="color:#4ade80">pai</span> --version, --help<br>&nbsp; <span style="color:#4ade80">pai-privacy</span> on|off<br>&nbsp; whoami, pwd, ls, cat, clear, neofetch, uname`

      default:
        return `<span style="color:#f87171">${exe}: command not found</span>`
    }
  }

  private mockResponse(): string {
    const responses = [
      'PAI is a bootable live-USB OS built on Debian 12. It runs Ollama for local AI inference, Sway as the desktop, and boots entirely from USB with zero installation.',
      'Your AI stays on your machine. No cloud, no API keys, no data leaving your hardware. Shut down and everything is gone — it all runs in RAM.',
      'Privacy is baked in: MAC spoofing randomizes your identity, the firewall blocks incoming connections, and optional Tor routes all traffic through three relays.',
      'Think of it like Tails (privacy OS) meets Ollama (local AI). Portable, amnesic, and fully offline — boot any x86_64 machine you want.',
    ]
    return responses[Math.floor(Math.random() * responses.length)]
  }
}
