// Browser-derived environment info. Real values, derived live from standard
// Web APIs — no hardcoded OS strings, no fake CPU counts, no mocked values.
//
// Consumed by:
//   - terminal/commands/{neofetch,uname,ip}.js
//   - (future) any widget that wants real system info
//
// The topbar currently has its own inline implementation to avoid coupling
// during recent refactors; it can migrate to this module later.

export interface GpuInfo {
  vendor: string
  renderer: string
  maxTexture: string
}

export interface ConnectionInfo {
  effectiveType: string | null
  downlinkMbps: number | null
  rttMs: number | null
  saveData: boolean
  type: string | null
}

export interface EnvInfo {
  osName: string
  osVersion: string | null
  arch: string
  platform: string
  browser: string
  browserVersion: string | null
  cores: number | null
  deviceMemoryGiB: number | null
  screen: string
  screenW: number
  screenH: number
  dpr: number
  locale: string
  timezone: string
  jsHeap: { used: number | null; total: number | null; limit: number | null }
  gpu: GpuInfo
  online: boolean
  connection: ConnectionInfo
  sessionUptimeMs: number
}

const bootTime = performance.now()

let gpuCache: GpuInfo | null = null

export function getGpuInfo(): GpuInfo {
  if (gpuCache) return gpuCache
  const out: GpuInfo = {
    vendor: 'unknown',
    renderer: 'unknown',
    maxTexture: '—',
  }
  let gl: WebGLRenderingContext | null = null
  try {
    const c = document.createElement('canvas')
    gl = (c.getContext('webgl') ||
      c.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      if (ext) {
        out.vendor =
          (gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) as string) || 'unknown'
        out.renderer =
          (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string) || 'unknown'
      } else {
        out.vendor = (gl.getParameter(gl.VENDOR) as string) || 'unknown'
        out.renderer = (gl.getParameter(gl.RENDERER) as string) || 'unknown'
      }
      const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
      if (maxTex) out.maxTexture = `${maxTex}×${maxTex}`
    } else {
      out.vendor = 'no WebGL'
      out.renderer = 'no WebGL'
    }
  } catch {
    // keep defaults
  } finally {
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  }
  gpuCache = out
  return out
}

function detectOS(ua: string): { name: string; version: string | null } {
  if (/Android/.test(ua)) {
    const m = ua.match(/Android ([\d.]+)/)
    return { name: 'Android', version: m?.[1] ?? null }
  }
  if (/iPhone|iPad|iPod/.test(ua)) {
    const m = ua.match(/OS ([\d_]+)/)
    return { name: 'iOS', version: m?.[1]?.replace(/_/g, '.') ?? null }
  }
  if (/Mac OS X/.test(ua)) {
    const m = ua.match(/Mac OS X ([\d_]+)/)
    return { name: 'macOS', version: m?.[1]?.replace(/_/g, '.') ?? null }
  }
  if (/Windows NT/.test(ua)) {
    const m = ua.match(/Windows NT ([\d.]+)/)
    const v = m?.[1] ?? null
    // Map NT version to marketing name where obvious
    const marketing: Record<string, string> = {
      '10.0': '10/11',
      '6.3': '8.1',
      '6.2': '8',
      '6.1': '7',
    }
    return { name: 'Windows', version: v ? (marketing[v] ?? v) : null }
  }
  if (/CrOS/.test(ua)) return { name: 'ChromeOS', version: null }
  if (/Linux/.test(ua)) return { name: 'Linux', version: null }
  return { name: 'unknown', version: null }
}

function detectBrowser(ua: string): { name: string; version: string | null } {
  // Order matters — Edge/Opera both contain "Chrome".
  const tests: Array<[RegExp, string]> = [
    [/Edg\/([\d.]+)/, 'Edge'],
    [/OPR\/([\d.]+)/, 'Opera'],
    [/Firefox\/([\d.]+)/, 'Firefox'],
    [/Chrome\/([\d.]+)/, 'Chrome'],
    [/Version\/([\d.]+).*Safari/, 'Safari'],
  ]
  for (const [re, name] of tests) {
    const m = ua.match(re)
    if (m) return { name, version: m[1] }
  }
  return { name: 'unknown', version: null }
}

function detectArch(ua: string): string {
  if (/x86_64|Win64|WOW64|amd64/i.test(ua)) return 'x86_64'
  if (/aarch64|arm64/i.test(ua)) return 'aarch64'
  if (/\barmv?\d/i.test(ua)) return 'arm'
  if (/i[3-6]86/i.test(ua)) return 'i686'
  return 'unknown'
}

export function getEnvInfo(): EnvInfo {
  const ua = navigator.userAgent
  const os = detectOS(ua)
  const br = detectBrowser(ua)
  const arch = detectArch(ua)
  const mem = (performance as unknown as { memory?: MemoryInfo }).memory
  const conn = (
    navigator as unknown as { connection?: NetworkInformation }
  ).connection

  return {
    osName: os.name,
    osVersion: os.version,
    arch,
    platform: `${os.name}${os.version ? ' ' + os.version : ''} ${arch}`.trim(),
    browser: br.version ? `${br.name} ${br.version.split('.')[0]}` : br.name,
    browserVersion: br.version,
    cores: navigator.hardwareConcurrency || null,
    deviceMemoryGiB:
      (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? null,
    screen: `${window.screen.width}×${window.screen.height} @ ${window.devicePixelRatio || 1}×`,
    screenW: window.screen.width,
    screenH: window.screen.height,
    dpr: window.devicePixelRatio || 1,
    locale: navigator.language || 'en-US',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    jsHeap: {
      used: mem?.usedJSHeapSize ?? null,
      total: mem?.totalJSHeapSize ?? null,
      limit: mem?.jsHeapSizeLimit ?? null,
    },
    gpu: getGpuInfo(),
    online: navigator.onLine,
    connection: {
      effectiveType: conn?.effectiveType ?? null,
      downlinkMbps: conn?.downlink ?? null,
      rttMs: conn?.rtt ?? null,
      saveData: Boolean(conn?.saveData),
      type: conn?.type ?? null,
    },
    sessionUptimeMs: performance.now() - bootTime,
  }
}

export function fmtBytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`
}

export function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (d) return `${d}d ${h}h ${m}m`
  if (h) return `${h}h ${m}m ${sec}s`
  if (m) return `${m}m ${sec}s`
  return `${sec}s`
}

// Ambient type shims for APIs TS doesn't include by default.

interface MemoryInfo {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
}

interface NetworkInformation extends EventTarget {
  effectiveType?: string
  downlink?: number
  rtt?: number
  saveData?: boolean
  type?: string
}
