// File preview helpers for the Files app lightbox.
// Classifies files by extension and generates HTML for inline preview of
// images, text, audio, video, and PDFs. Pure helpers — no DOM ownership.

export type FileKind = 'image' | 'text' | 'audio' | 'video' | 'pdf' | 'unknown'

const IMAGE_EXT = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'avif',
  'svg',
  'bmp',
  'ico',
])
const TEXT_EXT = new Set([
  'txt',
  'md',
  'markdown',
  'json',
  'yaml',
  'yml',
  'toml',
  'ini',
  'conf',
  'log',
  'csv',
  'tsv',
  'js',
  'ts',
  'tsx',
  'jsx',
  'mjs',
  'cjs',
  'html',
  'htm',
  'css',
  'scss',
  'sass',
  'less',
  'xml',
  'svg',
  'sh',
  'bash',
  'zsh',
  'fish',
  'py',
  'rb',
  'go',
  'rs',
  'c',
  'h',
  'cc',
  'cpp',
  'hpp',
  'java',
  'kt',
  'swift',
  'php',
  'lua',
  'sql',
  'diff',
  'patch',
  'gitignore',
  'env',
])
const AUDIO_EXT = new Set(['mp3', 'wav', 'ogg', 'oga', 'flac', 'm4a', 'aac', 'opus'])
const VIDEO_EXT = new Set(['mp4', 'webm', 'ogv', 'mov', 'm4v', 'mkv'])
const PDF_EXT = new Set(['pdf'])

/** Extract the lowercased extension (no leading dot). Empty string if none. */
export function extOf(name: string): string {
  if (!name) return ''
  const clean = name.split(/[?#]/)[0] // strip query / fragment
  const dot = clean.lastIndexOf('.')
  if (dot <= 0 || dot === clean.length - 1) return ''
  return clean.slice(dot + 1).toLowerCase()
}

export function kindOf(nameOrUrl: string): FileKind {
  const ext = extOf(nameOrUrl)
  if (IMAGE_EXT.has(ext)) return 'image'
  if (PDF_EXT.has(ext)) return 'pdf'
  if (AUDIO_EXT.has(ext)) return 'audio'
  if (VIDEO_EXT.has(ext)) return 'video'
  if (TEXT_EXT.has(ext)) return 'text'
  return 'unknown'
}

const MAX_TEXT_BYTES = 64 * 1024 // first ~64 KB

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Fetch and truncate text content. Falls back to an error string on failure. */
export async function fetchTextPreview(url: string): Promise<string> {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${res.status}`)
    const blob = await res.blob()
    const slice = blob.slice(0, MAX_TEXT_BYTES)
    const text = await slice.text()
    const truncated = blob.size > MAX_TEXT_BYTES
    return truncated
      ? text + `\n\n… (truncated, ${formatBytes(blob.size)} total)`
      : text
  } catch (e) {
    return `[Could not load preview: ${(e as Error).message}]`
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

/**
 * Build the inner HTML for a preview given a kind, URL, and caption.
 * For `text`, pass the already-fetched text content.
 */
export function renderPreviewHtml(
  kind: FileKind,
  src: string,
  caption: string,
  textContent?: string,
): string {
  const safeSrc = escapeHtml(src)
  const safeCap = escapeHtml(caption)
  switch (kind) {
    case 'image':
      return `<img class="lb-img" src="${safeSrc}" alt="${safeCap}" loading="lazy" />`
    case 'audio':
      return `<div class="lb-media">
        <audio controls preload="metadata" src="${safeSrc}" aria-label="${safeCap}"></audio>
      </div>`
    case 'video':
      return `<video class="lb-video" controls preload="metadata" playsinline>
        <source src="${safeSrc}" />
        Your browser cannot play this video.
      </video>`
    case 'pdf':
      return `<object class="lb-pdf" data="${safeSrc}" type="application/pdf">
        <div class="lb-fallback">
          <p>Your browser cannot display this PDF inline.</p>
          <p><a href="${safeSrc}" target="_blank" rel="noopener">Open in new tab ↗</a></p>
        </div>
      </object>`
    case 'text':
      return `<pre class="lb-text">${escapeHtml(textContent ?? '')}</pre>`
    default:
      return `<div class="lb-fallback">
        <p>No preview available for this file type.</p>
        <p><a href="${safeSrc}" target="_blank" rel="noopener">Open ↗</a></p>
      </div>`
  }
}
