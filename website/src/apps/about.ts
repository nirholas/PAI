export class AboutApp {
  constructor(container: HTMLElement) {
    this.render(container)
  }

  private render(container: HTMLElement): void {
    const app = document.createElement('div')
    app.className = 'about-app'
    app.innerHTML = `
      <div class="about-header">
        <h1>🔒 PAI — PAI</h1>
        <p class="about-tagline">Private AI on a bootable USB drive.</p>
      </div>

      <div class="about-content">
        <section>
          <h2>What is PAI?</h2>
          <p>PAI is a bootable live-USB operating system that gives you a private, portable AI workstation. Plug it into any x86_64 PC, boot from USB, and you have:</p>
          <ul>
            <li><strong>An offline AI assistant</strong> running locally via Ollama — no cloud, no API keys, no data leaving your machine</li>
            <li><strong>A privacy-hardened environment</strong> with MAC spoofing, firewall, and Tor integration</li>
            <li><strong>A complete desktop</strong> with Sway (Wayland), Firefox ESR, and essential tools</li>
            <li><strong>Zero installation</strong> — nothing touches the host machine's hard drive</li>
          </ul>
        </section>

        <section>
          <h2>Why PAI?</h2>
          <p>Every major AI service — ChatGPT, Claude, Gemini — sends your prompts to remote servers. You have no control over who reads your data, how long it's stored, or who it's shared with.</p>
          <p><strong>PAI eliminates that trust chain.</strong> Your conversations exist only in RAM while PAI runs. Shut down, and they're gone. No logs, no history, no server-side copies.</p>
        </section>

        <section>
          <h2>Key Features</h2>
          <div class="features-grid">
            <div class="feature">
              <div class="feature-icon">🚀</div>
              <h3>Portable</h3>
              <p>Boot any x86_64 machine instantly. No installation needed.</p>
            </div>
            <div class="feature">
              <div class="feature-icon">🔐</div>
              <h3>Private</h3>
              <p>All inference happens locally. Your data never leaves your hardware.</p>
            </div>
            <div class="feature">
              <div class="feature-icon">🧠</div>
              <h3>Local AI</h3>
              <p>Run Llama, Mistral, Phi, or any GGUF-compatible model offline.</p>
            </div>
            <div class="feature">
              <div class="feature-icon">👻</div>
              <h3>Amnesic</h3>
              <p>Runs entirely in RAM. Shut down and leave no trace.</p>
            </div>
            <div class="feature">
              <div class="feature-icon">🛡️</div>
              <h3>Hardened</h3>
              <p>MAC spoofing, firewall, Tor integration, and zero telemetry.</p>
            </div>
            <div class="feature">
              <div class="feature-icon">🔓</div>
              <h3>Open Source</h3>
              <p>GPL v3. Audit the code, modify it, learn from it.</p>
            </div>
          </div>
        </section>

        <section>
          <h2>How It Works</h2>
          <pre class="about-diagram">
┌──────────────────────────────────────────┐
│         YOUR COMPUTER                    │
│  ┌──────────────────────────────────┐    │
│  │    PAI (Live USB)                │    │
│  │  ┌─────────────────────────────┐ │    │
│  │  │ Sway + Firefox + Terminal   │ │    │
│  │  │ ↓                           │ │    │
│  │  │ Chat UI (localhost:8080)    │ │    │
│  │  │ ↓                           │ │    │
│  │  │ Ollama (localhost:11434)    │ │    │
│  │  │ (Llama, Mistral, Phi, ...)  │ │    │
│  │  └─────────────────────────────┘ │    │
│  │  Linux Kernel (Debian 12)         │    │
│  │  UFW + MAC Spoof + Tor (opt-in)   │    │
│  └──────────────────────────────────┘    │
│                                          │
│  Host OS (never touched, not mounted)    │
└──────────────────────────────────────────┘</pre>
        </section>

        <section>
          <h2>Get Started</h2>
          <p>Visit <strong>pai.direct</strong> to download the ISO and flash it to USB using the one-command flasher.</p>
          <p>Or explore this web demo to see what PAI looks like in action!</p>
        </section>

        <section>
          <h2>License</h2>
          <p>PAI is free software released under the <strong>GNU General Public License v3.0</strong>.</p>
        </section>
      </div>
    `

    container.appendChild(app)
  }
}
