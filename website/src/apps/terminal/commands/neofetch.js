import { getEnvInfo, fmtBytes, fmtDuration } from '../../env.ts'
import { probeOllama } from '../../ollama-client.ts'

export const description = 'Display system information'

const PAI_VERSION = '0.1.0'

export default async function neofetch(_args, _term) {
  const env = getEnvInfo()
  const host = location.hostname || 'pai.local'

  // Memory: prefer the live JS heap used/limit from env.ts; fall back to the
  // coarse Device Memory signal on browsers that don't expose performance.memory.
  const memStr =
    env.jsHeap.used != null && env.jsHeap.limit != null
      ? `${fmtBytes(env.jsHeap.used)} / ${fmtBytes(env.jsHeap.limit)} (JS heap)`
      : env.deviceMemoryGiB != null
        ? `≥ ${env.deviceMemoryGiB} GiB (device)`
        : 'unavailable'

  // Ollama status — real probe, honest fallback.
  let aiStr = 'probing…'
  try {
    const st = await probeOllama()
    if (st.reachable) {
      const n = st.models.length
      aiStr =
        n > 0
          ? `ollama · ${n} model${n === 1 ? '' : 's'} at ${st.host}`
          : `ollama reachable · no models installed`
    } else {
      aiStr = 'no ollama reachable (install from ollama.com)'
    }
  } catch {
    aiStr = 'no ollama reachable'
  }

  const gpuStr =
    env.gpu.renderer && env.gpu.renderer !== 'unknown'
      ? env.gpu.renderer
      : env.gpu.vendor

  const netStr = !env.online
    ? 'offline'
    : env.connection.effectiveType
      ? `online · ${env.connection.effectiveType}${env.connection.downlinkMbps != null ? ' · ' + env.connection.downlinkMbps + ' Mbps' : ''}`
      : 'online'

  return `<div class="neofetch">
<span class="nf-art"><span class="nf-red"> ██████╗ </span><span class="nf-blue"> █████╗ </span><span class="nf-yellow"> ██╗</span>
<span class="nf-red"> ██╔══██╗</span><span class="nf-blue">██╔══██╗</span><span class="nf-yellow"> ██║</span>
<span class="nf-red"> ██████╔╝</span><span class="nf-blue">███████║</span><span class="nf-yellow"> ██║</span>
<span class="nf-red"> ██╔═══╝ </span><span class="nf-blue">██╔══██║</span><span class="nf-yellow"> ██║</span>
<span class="nf-red"> ██║     </span><span class="nf-blue">██║  ██║</span><span class="nf-yellow"> ██║</span>
<span class="nf-red"> ╚═╝     </span><span class="nf-blue">╚═╝  ╚═╝</span><span class="nf-yellow"> ╚═╝</span></span>
<span class="nf-info"><span class="nf-label">user</span><span class="t-dim">@</span><span class="nf-label">${host}</span>
<span class="t-dim">─────────────────────────────</span>
<span class="nf-label">OS:</span>       PAI Web Preview ${PAI_VERSION} · ${env.osName}${env.osVersion ? ' ' + env.osVersion : ''} ${env.arch}
<span class="nf-label">Browser:</span>  ${env.browser}
<span class="nf-label">Shell:</span>    pai-repl 1.0
<span class="nf-label">WM:</span>       PAI Shell (web)
<span class="nf-label">Terminal:</span> pai-terminal
<span class="nf-label">Display:</span>  ${env.screen}
<span class="nf-label">Locale:</span>   ${env.locale} · ${env.timezone}
<span class="nf-label">CPU:</span>      ${env.cores ?? '—'} logical cores
<span class="nf-label">GPU:</span>      ${gpuStr}
<span class="nf-label">Memory:</span>   ${memStr}
<span class="nf-label">DevMem:</span>   ${env.deviceMemoryGiB != null ? '≥ ' + env.deviceMemoryGiB + ' GiB' : 'unavailable'}
<span class="nf-label">Network:</span>  ${netStr}
<span class="nf-label">Uptime:</span>   ${fmtDuration(env.sessionUptimeMs)}
<span class="nf-label">AI:</span>       ${aiStr}
<span class="t-dim">─────────────────────────────</span>
<span class="nf-palette">██</span><span class="nf-p1">██</span><span class="nf-p2">██</span><span class="nf-p3">██</span><span class="nf-p4">██</span><span class="nf-p5">██</span><span class="nf-p6">██</span><span class="nf-p7">██</span></span>
</div>`
}
