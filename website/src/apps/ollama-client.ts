// Real Ollama client.
//
// Tries http://127.0.0.1:11434 (the default Ollama listen address) and uses
// real `/api/tags`, `/api/generate`, `/api/ps` endpoints.
//
// When PAI is actually booted from USB, the web UI is local so Ollama is
// reachable. On the public web preview, CORS blocks the request and the
// client reports `reachable: false` — every consumer is built to degrade
// cleanly to an honest "no Ollama running" message rather than fake data.
//
// Host override: `localStorage.pai-ollama-host`.

const DEFAULT_HOST = 'http://127.0.0.1:11434'
const PROBE_TIMEOUT_MS = 1500
const PROBE_CACHE_MS = 30_000

export interface OllamaModel {
  name: string
  modified_at: string
  size: number
  digest: string
  details?: {
    parameter_size?: string
    quantization_level?: string
    family?: string
  }
}

export interface OllamaRunning {
  name: string
  size: number
  size_vram?: number
  expires_at?: string
}

export interface OllamaStatus {
  reachable: boolean
  host: string
  error: string | null
  models: OllamaModel[]
  probedAt: number
}

let cached: OllamaStatus | null = null
let probing: Promise<OllamaStatus> | null = null

export function getHost(): string {
  try {
    return localStorage.getItem('pai-ollama-host') || DEFAULT_HOST
  } catch {
    return DEFAULT_HOST
  }
}

export function setHost(host: string | null): void {
  try {
    if (host) localStorage.setItem('pai-ollama-host', host)
    else localStorage.removeItem('pai-ollama-host')
  } catch {
    // ignore
  }
  cached = null
}

export async function probeOllama(
  host: string = getHost(),
  force = false,
): Promise<OllamaStatus> {
  if (!force && cached && Date.now() - cached.probedAt < PROBE_CACHE_MS) {
    return cached
  }
  if (probing) return probing

  probing = (async () => {
    const out: OllamaStatus = {
      reachable: false,
      host,
      error: null,
      models: [],
      probedAt: Date.now(),
    }
    try {
      const ctl = new AbortController()
      const t = setTimeout(() => ctl.abort(), PROBE_TIMEOUT_MS)
      const r = await fetch(`${host}/api/tags`, { signal: ctl.signal })
      clearTimeout(t)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const body = (await r.json()) as { models?: OllamaModel[] }
      out.reachable = true
      out.models = body.models ?? []
    } catch (e) {
      out.error = e instanceof Error ? e.message : String(e)
    }
    cached = out
    probing = null
    return out
  })()
  return probing
}

export interface GenerateOpts {
  host?: string
  model: string
  prompt: string
  system?: string
  onToken: (token: string) => void
  signal?: AbortSignal
}

export async function generate(opts: GenerateOpts): Promise<void> {
  const host = opts.host ?? getHost()
  const r = await fetch(`${host}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: opts.model,
      prompt: opts.prompt,
      system: opts.system,
      stream: true,
    }),
    signal: opts.signal,
  })
  if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`)
  const reader = r.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const msg = JSON.parse(trimmed) as { response?: string; done?: boolean }
        if (msg.response) opts.onToken(msg.response)
      } catch {
        // partial / malformed frame — skip
      }
    }
  }
}

export async function ps(host: string = getHost()): Promise<OllamaRunning[]> {
  const r = await fetch(`${host}/api/ps`)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const j = (await r.json()) as { models?: OllamaRunning[] }
  return j.models ?? []
}
