export const description = 'Show available commands'

export default function help(_args, _term) {
  return [
    '<span class="t-dim">Available commands:</span>',
    '',
    '  <span class="t-cmd">help</span>       — this message',
    '  <span class="t-cmd">ls</span>         — list files',
    '  <span class="t-cmd">cat</span>        — print file contents',
    '  <span class="t-cmd">ollama</span>     — interact with local models',
    '  <span class="t-cmd">ip addr</span>    — show network interfaces',
    '  <span class="t-cmd">uname -a</span>   — kernel info',
    '  <span class="t-cmd">whoami</span>     — current user',
    '  <span class="t-cmd">neofetch</span>   — system info',
    '  <span class="t-cmd">sudo</span>       — (nice try)',
    '  <span class="t-cmd">clear</span>      — clear screen',
    '  <span class="t-cmd">exit</span>       — close terminal',
    '',
    '<span class="t-dim">This is a read-only demo. Real PAI is a live USB OS.</span>',
  ].join('\n')
}
