import { probeOllama, generate, ps, getHost } from '../../ollama-client.ts'
import { fmtBytes } from '../../env.ts'

export const description = 'Run local AI models via Ollama'

function timeAgo(iso) {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return '—'
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function previewNotice(host) {
  return [
    `<span class="t-warn">No Ollama daemon reachable at ${host}.</span>`,
    '<span class="t-dim">On real PAI, the terminal talks to the system ollama service.</span>',
    '<span class="t-dim">In this web preview, browser CORS prevents the call unless you start Ollama</span>',
    `<span class="t-dim">with:  <b>OLLAMA_ORIGINS='${location.origin}' ollama serve</b></span>`,
  ].join('\n')
}

export default async function ollama(args, term) {
  const sub = args[0] || 'help'
  const host = getHost()
  const status = await probeOllama(host)

  // ── list (default with no args) ──
  if (sub === 'list' || sub === 'ls') {
    if (!status.reachable) return previewNotice(host)
    if (status.models.length === 0) {
      return '<span class="t-dim">No models installed. Try:  ollama pull llama3.2:3b</span>'
    }
    const header =
      'NAME                              ID            SIZE       MODIFIED'
    const rows = status.models.map((m) => {
      const id = (m.digest || '').slice(0, 12).padEnd(12)
      return `${m.name.padEnd(33)} ${id}  ${fmtBytes(m.size).padStart(9)}  ${timeAgo(m.modified_at)}`
    })
    return [header, ...rows].join('\n')
  }

  // ── ps ──
  if (sub === 'ps') {
    if (!status.reachable) return previewNotice(host)
    try {
      const running = await ps(host)
      if (running.length === 0) {
        return '<span class="t-dim">No models currently loaded in memory.</span>'
      }
      const header = 'NAME                              SIZE      VRAM'
      const rows = running.map(
        (m) =>
          `${m.name.padEnd(33)} ${fmtBytes(m.size).padStart(9)}  ${fmtBytes(m.size_vram ?? 0).padStart(9)}`,
      )
      return [header, ...rows].join('\n')
    } catch (e) {
      return `<span class="t-err">ollama ps failed: ${e.message}</span>`
    }
  }

  // ── run ──
  if (sub === 'run') {
    const model = args[1]
    const prompt = args.slice(2).join(' ')
    if (!model) return 'Usage: ollama run <model> [prompt]'
    if (!status.reachable) return previewNotice(host)
    if (!prompt) {
      return [
        `<span class="t-dim">Interactive mode isn't supported in the web terminal.</span>`,
        `<span class="t-dim">Pass a prompt inline:  ollama run ${model} "your question"</span>`,
      ].join('\n')
    }

    term.setEnabled(false)
    term.print(
      `\n<span class="t-dim">&gt;&gt;&gt; ollama run ${model}</span>\n<span class="t-inputecho">${escapeHtml(prompt)}</span>\n\n`,
    )
    const ctl = new AbortController()
    try {
      await generate({
        host,
        model,
        prompt,
        signal: ctl.signal,
        onToken: (tok) => {
          term.appendChar(tokenToHtml(tok))
        },
      })
      term.print('\n')
    } catch (e) {
      term.print(
        `\n<span class="t-err">generate failed: ${escapeHtml(e.message)}</span>\n`,
      )
    } finally {
      term.setEnabled(true)
    }
    return null
  }

  // ── help / unknown ──
  return [
    'Usage:',
    '  ollama list              # models available locally',
    '  ollama ps                # models currently loaded in memory',
    '  ollama run <model> "..."  # generate from a prompt (streams)',
    '',
    `Talking to: <b>${host}</b>  (override with localStorage.pai-ollama-host)`,
    status.reachable
      ? `<span class="t-dim">status: reachable · ${status.models.length} model${status.models.length === 1 ? '' : 's'}</span>`
      : `<span class="t-dim">status: not reachable (${status.error || 'no connection'})</span>`,
  ].join('\n')
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function tokenToHtml(tok) {
  // Preserve whitespace + newlines for the streaming renderer.
  return escapeHtml(tok)
    .replace(/\n/g, '<br>')
    .replace(/ /g, '&nbsp;')
    .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
}
