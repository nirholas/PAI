export const description = 'List files'

// Mirrors the layout xdg-user-dirs-update creates plus PAI's own directories.
// Sizes are representative — this is the web-shell demo; the real filesystem
// lives on the USB installation.
const TREE = {
  '~': [
    { name: 'Desktop', type: 'dir' },
    { name: 'Documents', type: 'dir' },
    { name: 'Downloads', type: 'dir' },
    { name: 'Music', type: 'dir' },
    { name: 'Pictures', type: 'dir' },
    { name: 'Videos', type: 'dir' },
    { name: '.config', type: 'dir' },
    { name: '.local', type: 'dir' },
    { name: '.bashrc', type: 'file', size: '3.8K' },
    { name: '.profile', type: 'file', size: '807' },
  ],
  '~/.config': [
    { name: 'foot', type: 'dir' },
    { name: 'gtk-3.0', type: 'dir' },
    { name: 'mako', type: 'dir' },
    { name: 'nwg-dock', type: 'dir' },
    { name: 'pai', type: 'dir' },
    { name: 'sway', type: 'dir' },
    { name: 'waybar', type: 'dir' },
  ],
  '~/.config/sway': [{ name: 'config', type: 'file', size: '4.2K' }],
  '~/.config/pai': [
    { name: 'profile', type: 'file', size: '64' },
    { name: 'welcomed', type: 'file', size: '0' },
  ],
  '~/Documents': [],
  '~/Downloads': [],
  '~/Pictures': [
    { name: 'wallpapers', type: 'dir' },
    { name: 'screenshots', type: 'dir' },
  ],
}

function normalise(raw) {
  if (!raw || raw === '~' || raw === '~/') return '~'
  const trimmed = raw.replace(/\/+$/, '')
  return trimmed.startsWith('~') ? trimmed : '~'
}

export default function ls(args, _term) {
  const flags = new Set(args.filter((a) => a.startsWith('-')).join(''))
  const longFmt = flags.has('l')
  const showHidden = flags.has('a')
  const target = args.find((a) => !a.startsWith('-'))
  const key = normalise(target)
  const entries = TREE[key]

  if (!entries) {
    return `<span class="t-red">ls: cannot access '${target}': No such file or directory</span>`
  }

  const visible = showHidden
    ? entries
    : entries.filter((e) => !e.name.startsWith('.'))

  if (!visible.length) {
    return `<span class="t-dim">(empty)</span>`
  }

  if (longFmt) {
    return visible
      .map((e) => {
        const perms = e.type === 'dir' ? 'drwxr-xr-x' : '-rw-r--r--'
        const size = e.type === 'dir' ? '4096' : e.size || '0'
        const cls = e.type === 'dir' ? 't-dir' : 't-file'
        const label = e.type === 'dir' ? `${e.name}/` : e.name
        return `<span class="t-dim">${perms}  1 user user ${size.padStart(6)}</span>  <span class="${cls}">${label}</span>`
      })
      .join('\n')
  }

  return visible
    .map((e) => {
      if (e.type === 'dir') return `<span class="t-dir">${e.name}/</span>`
      return `<span class="t-file">${e.name}</span>  <span class="t-dim">${e.size}</span>`
    })
    .join('\n')
}
